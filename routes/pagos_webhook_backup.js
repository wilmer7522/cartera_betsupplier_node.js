import express from 'express';
import { getDb } from '../database.js';
import { sincronizarConAppExterna } from '../services/syncService.js';
import * as XLSX from 'xlsx';
import crypto from 'crypto';



const router = express.Router();

const WOMPI_PRIVATE_KEY = process.env.WOMPI_SECRET || process.env.WOMPI_PRIVATE_KEY;
const WOMPI_EVENT_SECRET = process.env.WOMPI_EVENT_SECRET;
const WOMPI_API_URL = 'https://sandbox.wompi.co/v1/transactions';

// POST /pagos/confirmacion
router.post('/confirmacion', async (req, res) => {
  if (!WOMPI_PRIVATE_KEY) {
  }

  const { transaction_id } = req.body;

  if (!transaction_id) {
    return res.status(400).json({ error: 'Falta el ID de la transacción.' });
  }

  try {
    // 1. Consultar la API de Wompi
    const response = await fetch(`${WOMPI_API_URL}/${transaction_id}`, {
      headers: {
        'Authorization': `Bearer ${WOMPI_PRIVATE_KEY}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ error: 'Error al verificar la transacción con Wompi.', details: errorData });
    }

    const transaction = await response.json();
    const { data: tx } = transaction;

    // 2. Validar que el pago esté 'APPROVED'
    if (tx.status !== 'APPROVED') {
      return res.status(200).json({
        mensaje: `El pago no fue aprobado. Estado: ${tx.status}`,
        status: tx.status,
      });
    }

    // 3. Verificar si la transacción ya fue procesada
    const db = getDb();
    const pagosCollection = db.collection('pagos_recibidos');
    const pagoExistente = await pagosCollection.findOne({ transaccion_id: tx.id });

    if (pagoExistente) {
      return res.status(200).json({
        mensaje: 'Este pago ya fue procesado anteriormente.',
        status: 'DUPLICADO',
        pago: pagoExistente
      });
    }

    // 4. Extraer datos y guardarlos en MongoDB
    const referenceParts = tx.reference.split('-');
    const referencia_factura = referenceParts.length > 1 ? referenceParts[1] : tx.reference;
    
    // 🔥 BÚSQUEDA DE DATOS SEGUROS EN BASE DE CONOCIMIENTO 🔥
    let nit_cliente = tx.customer_data?.legal_id || 'No disponible';
    let nombre_cliente = tx.customer_data?.full_name || 'No disponible';
    let datos_verificados = false;

    try {
      const baseConocimiento = db.collection('base_conocimiento');
      // Buscamos por documento (factura). Convertimos a string por si acaso.
      const facturaInfo = await baseConocimiento.findOne({ Documento: referencia_factura });

      if (facturaInfo) {
        
        // Usamos los datos de la base de conocimiento
        nit_cliente = facturaInfo.Cliente || nit_cliente;
        nombre_cliente = facturaInfo.Nombre_Cliente || nombre_cliente;
        datos_verificados = true;
      }
    } catch (err) {
      // Error handling for database query
    }

    const nuevoPago = {
      transaccion_id: tx.id,
      referencia_factura,
      monto: tx.amount_in_cents / 100, // Guardar en la unidad principal (e.g., pesos)
      nit_cliente,
      nombre_cliente,
      fecha_pago: new Date(tx.created_at),
      sincronizado_app_externa: false,
      datos_verificados_bd: datos_verificados, // Flag para saber si se cruzó con BD
      _wompi_raw_data: tx // Guardar el objeto completo para futuras referencias
    };

    await pagosCollection.insertOne(nuevoPago);
   

    // 5. Ejecutar la sincronización (asíncrona, no bloqueante)
    sincronizarConAppExterna(nuevoPago).catch(err => {
        // Error handling for synchronization
    });

    // 6. Responder al frontend
    res.status(201).json({
      mensaje: 'Pago aprobado y registrado exitosamente.',
      status: 'APROBADO',
      pago: {
        referencia: nuevoPago.referencia_factura,
        monto: nuevoPago.monto,
        cliente: nuevoPago.nombre_cliente,
      }
    });

  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor al procesar el pago.' });
  }
});

// GET /pagos/reporte-excel
router.get('/reporte-excel', async (req, res) => {
  try {
    const { fecha } = req.query; // YYYY-MM-DD

    if (!fecha) {
      return res.status(400).json({ error: 'Debes proporcionar una fecha (YYYY-MM-DD).' });
    }

    // Calcular inicio y fin del día en UTC (o local, dependiendo de cómo guardes las fechas)
    // Asumiendo que 'fecha' viene en formato local 'YYYY-MM-DD' y queremos buscar todo ese día.
    const startOfDay = new Date(`${fecha}T00:00:00.000Z`);
    const endOfDay = new Date(`${fecha}T23:59:59.999Z`);

    const db = getDb();
    const pagosCollection = db.collection('pagos_recibidos');

    const pagos = await pagosCollection.find({
      fecha_pago: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    }).toArray();

    if (pagos.length === 0) {
      return res.status(404).json({ error: 'No se encontraron pagos para la fecha especificada.' });
    }

    // Transformar datos para Excel
    const dataForExcel = pagos.map(p => ({
      'ID Transacción': p.transaccion_id,
      'Referencia Factura': p.referencia_factura,
      'Monto': p.monto,
      'NIT Cliente': p.nit_cliente,
      'Nombre Cliente': p.nombre_cliente,
      'Fecha Pago': p.fecha_pago ? new Date(p.fecha_pago).toLocaleString('es-CO') : '',
    }));

    // Crear Workbook y Worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pagos');

    // Generar buffer
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // Configurar headers para descarga
    res.setHeader('Content-Disposition', `attachment; filename=reporte_pagos_${fecha}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    res.send(excelBuffer);

  } catch (error) {
    res.status(500).json({ error: 'Error al generar el reporte.' });
  }
});

// GET /pagos/estado/:transactionId
router.get('/estado/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const db = getDb();
    const pagosCollection = db.collection('pagos_recibidos');

    const pago = await pagosCollection.findOne({ transaccion_id: transactionId });

    if (pago) {
      return res.status(200).json({
        status: 'APROBADO',
        pago: {
          referencia: pago.referencia_factura,
          monto: pago.monto,
          cliente: pago.nombre_cliente,
          fecha: pago.fecha_pago,
          webhook_procesado: pago.webhook_procesado || false
        }
      });
    } else {
      return res.status(404).json({
        status: 'PENDIENTE',
        mensaje: 'Pago no encontrado o aún no procesado.'
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor al consultar estado.' });
  }
});

// POST /pagos/wompi-webhook
router.post('/wompi-webhook', async (req, res) => {
  try {
    // 1. Validar firma de Wompi
    const signature = req.headers['x-wompi-signature'];
    const payload = JSON.stringify(req.body);
    
    if (!WOMPI_EVENT_SECRET) {
      return res.status(500).json({ error: "Error de configuración del servidor (Wompi Event Secret missing)." });
    }

    if (!signature) {
      return res.status(400).json({ error: 'Firma de webhook requerida.' });
    }

    // Calcular el hash esperado
    const expectedSignature = crypto
      .createHmac('sha256', WOMPI_EVENT_SECRET)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: 'Firma de webhook inválida.' });
    }

    // 2. Procesar el evento
    const event = req.body;
    
    // Validar que es un evento de actualización de transacción
    if (event.type !== 'transaction.updated') {
      return res.status(200).json({ message: 'Evento no procesado' });
    }

    const transaction = event.data;
    
    // Validar que la transacción esté aprobada
    if (transaction.status !== 'APPROVED') {
      return res.status(200).json({ message: 'Transacción no aprobada' });
    }

    // 3. Verificar si la transacción ya fue procesada
    const db = getDb();
    const pagosCollection = db.collection('pagos_recibidos');
    const pagoExistente = await pagosCollection.findOne({ transaccion_id: transaction.id });

    if (pagoExistente) {
      return res.status(200).json({ message: 'Transacción ya procesada' });
    }

    // 4. Extraer datos y guardarlos en MongoDB
    const referenceParts = transaction.reference.split('-');
    const referencia_factura = referenceParts.length > 1 ? referenceParts[1] : transaction.reference;
    
    let nit_cliente = transaction.customer_data?.legal_id || 'No disponible';
    let nombre_cliente = transaction.customer_data?.full_name || 'No disponible';
    let datos_verificados = false;

    try {
      const baseConocimiento = db.collection('base_conocimiento');
      const facturaInfo = await baseConocimiento.findOne({ Documento: referencia_factura });

      if (facturaInfo) {
        nit_cliente = facturaInfo.Cliente || nit_cliente;
        nombre_cliente = facturaInfo.Nombre_Cliente || nombre_cliente;
        datos_verificados = true;
      }
    } catch (err) {
      // Error handling for database query
    }

    const nuevoPago = {
      transaccion_id: transaction.id,
      referencia_factura,
      monto: transaction.amount_in_cents / 100,
      nit_cliente,
      nombre_cliente,
      fecha_pago: new Date(transaction.created_at),
      sincronizado_app_externa: false,
      datos_verificados_bd: datos_verificados,
      _wompi_raw_data: transaction,
      webhook_procesado: true, // Flag para identificar pagos por webhook
      webhook_timestamp: new Date()
    };

    await pagosCollection.insertOne(nuevoPago);

    // 5. Ejecutar la sincronización (asíncrona, no bloqueante)
    sincronizarConAppExterna(nuevoPago).catch(err => {
        // Error handling for synchronization
    });

    // 6. Responder a Wompi
    res.status(200).json({ message: 'Webhook procesado exitosamente' });

  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor al procesar webhook.' });
  }
});

export default router;
