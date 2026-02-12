import express from 'express';
import { getDb } from '../database.js';
import { sincronizarConAppExterna } from '../services/syncService.js';
import * as XLSX from 'xlsx';
import crypto from 'crypto';
import dotenv from "dotenv";

dotenv.config();



const router = express.Router();

const WOMPI_PRIVATE_KEY = process.env.WOMPI_SECRET || process.env.WOMPI_PRIVATE_KEY;
const WOMPI_EVENT_SECRET = process.env.WOMPI_EVENT_SECRET;
const WOMPI_API_URL = 'https://sandbox.wompi.co/v1/transactions';

// POST /pagos/wompi-webhook (versión depurada)
router.post('/wompi-webhook', async (req, res) => {
  try {

    // 1. VALIDACIÓN DEL MIDDLEWARE DE LECTURA
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ 
        error: 'Body vacío o no parseado por middleware',
        debug: {
          body: req.body,
          headers: req.headers,
          contentType: req.headers['content-type']
        }
      });
    }

    // 2. VALIDACIÓN DE FIRMA DE WOMPI
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
      return res.status(400).json({ 
        error: 'Firma de webhook inválida.',
        debug: {
          received_signature: signature,
          calculated_signature: expectedSignature,
          payload: payload,
          wompi_event_secret: WOMPI_EVENT_SECRET
        }
      });
    }

    // 3. PROCESAMIENTO DEL EVENTO
    const event = req.body;
    
    // Validar que es un evento de actualización de transacción
    if (event.type !== 'transaction.updated') {
      return res.status(200).json({ message: 'Evento no procesado' });
    }

    // 4. VALIDACIÓN DE LA ESTRUCTURA DEL EVENTO
    if (!event.data) {
      return res.status(400).json({ 
        error: 'Estructura de evento inválida: falta campo "data"',
        debug: { event_structure: Object.keys(event) }
      });
    }

    const transaction = event.data;

    // Validar campos esenciales de la transacción
    const requiredFields = ['id', 'status', 'reference', 'amount_in_cents', 'customer_data', 'created_at'];
    const missingFields = requiredFields.filter(field => !transaction[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Transacción incompleta',
        missing_fields: missingFields,
        debug: { transaction_keys: Object.keys(transaction) }
      });
    }

    // Validar que la transacción esté aprobada
    if (transaction.status !== 'APPROVED') {
      return res.status(200).json({ message: 'Transacción no aprobada' });
    }

    // 5. VERIFICACIÓN DE DUPLICADOS
    const db = getDb();
    const pagosCollection = db.collection('pagos_recibidos');
    const pagoExistente = await pagosCollection.findOne({ transaccion_id: transaction.id });

    if (pagoExistente) {
      return res.status(200).json({ message: 'Transacción ya procesada' });
    }

    // 6. PROCESAMIENTO Y GUARDADO
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
      webhook_procesado: true,
      webhook_timestamp: new Date()
    };

    await pagosCollection.insertOne(nuevoPago);

    // 7. SINCRONIZACIÓN ASÍNCRONA
    try {
      sincronizarConAppExterna(nuevoPago).catch(err => {
        // Error handling for synchronization
      });
    } catch (err) {
      // Error handling for synchronization initiation
    }

    // 8. RESPUESTA FINAL
    res.status(200).json({ 
      message: 'Webhook procesado exitosamente',
      debug: {
        transaction_id: transaction.id,
        status: transaction.status,
        webhook_timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    res.status(200).json({ 
      error: 'Error interno del servidor al procesar webhook.',
      debug: {
        message: error.message,
        stack: error.stack
      }
    });
  }
});

// Ruta para pruebas de webhook
router.post('/test-webhook', async (req, res) => {
  try {
    res.status(200).json({ 
      message: 'Webhook de prueba procesado',
      timestamp: new Date().toISOString(),
      body: req.body
    });
  } catch (error) {
    res.status(200).json({ error: 'Error en webhook de prueba' });
  }
});

export default router;