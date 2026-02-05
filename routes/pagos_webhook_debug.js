import express from 'express';
import { getDb } from '../database.js';
import { sincronizarConAppExterna } from '../services/syncService.js';
import dotenv from 'dotenv';
import * as XLSX from 'xlsx';
import crypto from 'crypto';

dotenv.config();

const router = express.Router();

const WOMPI_PRIVATE_KEY = process.env.WOMPI_SECRET || process.env.WOMPI_PRIVATE_KEY;
const WOMPI_EVENT_SECRET = process.env.WOMPI_EVENT_SECRET;
const WOMPI_API_URL = 'https://sandbox.wompi.co/v1/transactions';

// POST /pagos/wompi-webhook (versión depurada)
router.post('/wompi-webhook', async (req, res) => {
  try {
    console.log('🔍 [WEBHOOK] Inicio de procesamiento de webhook');
    console.log('🔍 [WEBHOOK] Headers recibidos:', req.headers);
    console.log('🔍 [WEBHOOK] Body recibido:', JSON.stringify(req.body, null, 2));

    // 1. VALIDACIÓN DEL MIDDLEWARE DE LECTURA
    console.log('🔍 [MIDDLEWARE] Verificando body-parser...');
    
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('❌ [MIDDLEWARE] Body vacío o no parseado');
      console.log('🔍 [MIDDLEWARE] Tipo de req.body:', typeof req.body);
      console.log('🔍 [MIDDLEWARE] Contenido de req.body:', req.body);
      return res.status(400).json({ 
        error: 'Body vacío o no parseado por middleware',
        debug: {
          body: req.body,
          headers: req.headers,
          contentType: req.headers['content-type']
        }
      });
    }

    console.log('✅ [MIDDLEWARE] Body correctamente parseado');

    // 2. VALIDACIÓN DE FIRMA DE WOMPI
    console.log('🔍 [FIRMA] Validando firma de Wompi...');
    
    const signature = req.headers['x-wompi-signature'];
    const payload = JSON.stringify(req.body);
    
    if (!WOMPI_EVENT_SECRET) {
      console.error("❌ [FIRMA] WOMPI_EVENT_SECRET no está definido");
      return res.status(500).json({ error: "Error de configuración del servidor (Wompi Event Secret missing)." });
    }

    if (!signature) {
      console.warn("⚠️ [FIRMA] Webhook sin firma recibido");
      return res.status(400).json({ error: 'Firma de webhook requerida.' });
    }

    console.log('🔍 [FIRMA] Signature recibida:', signature);
    console.log('🔍 [FIRMA] Payload para validación:', payload);

    // Calcular el hash esperado
    const expectedSignature = crypto
      .createHmac('sha256', WOMPI_EVENT_SECRET)
      .update(payload)
      .digest('hex');

    console.log('🔍 [FIRMA] Signature calculada:', expectedSignature);
    console.log('🔍 [FIRMA] Coinciden las firmas?', signature === expectedSignature);

    if (signature !== expectedSignature) {
      console.warn("⚠️ [FIRMA] Firma de webhook inválida");
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

    console.log('✅ [FIRMA] Firma validada exitosamente');

    // 3. PROCESAMIENTO DEL EVENTO
    console.log('🔍 [EVENTO] Procesando evento...');
    
    const event = req.body;
    
    // Validar que es un evento de actualización de transacción
    if (event.type !== 'transaction.updated') {
      console.log(`⚠️ [EVENTO] Evento ignorado: ${event.type}`);
      return res.status(200).json({ message: 'Evento no procesado' });
    }

    console.log('✅ [EVENTO] Tipo de evento válido:', event.type);

    // 4. VALIDACIÓN DE LA ESTRUCTURA DEL EVENTO
    console.log('🔍 [ESTRUCTURA] Validando estructura del evento...');
    
    if (!event.data) {
      console.error('❌ [ESTRUCTURA] No se encontró el campo "data" en el evento');
      console.log('🔍 [ESTRUCTURA] Estructura del evento:', JSON.stringify(event, null, 2));
      return res.status(400).json({ 
        error: 'Estructura de evento inválida: falta campo "data"',
        debug: { event_structure: Object.keys(event) }
      });
    }

    const transaction = event.data;
    console.log('🔍 [ESTRUCTURA] Transacción recibida:', JSON.stringify(transaction, null, 2));

    // Validar campos esenciales de la transacción
    const requiredFields = ['id', 'status', 'reference', 'amount_in_cents', 'customer_data', 'created_at'];
    const missingFields = requiredFields.filter(field => !transaction[field]);
    
    if (missingFields.length > 0) {
      console.error('❌ [ESTRUCTURA] Campos faltantes en la transacción:', missingFields);
      return res.status(400).json({ 
        error: 'Transacción incompleta',
        missing_fields: missingFields,
        debug: { transaction_keys: Object.keys(transaction) }
      });
    }

    console.log('✅ [ESTRUCTURA] Estructura de transacción válida');

    // Validar que la transacción esté aprobada
    if (transaction.status !== 'APPROVED') {
      console.log(`⚠️ [ESTADO] Transacción no aprobada: ${transaction.status}`);
      return res.status(200).json({ message: 'Transacción no aprobada' });
    }

    console.log('✅ [ESTADO] Transacción aprobada');

    // 5. VERIFICACIÓN DE DUPLICADOS
    console.log('🔍 [DUPLICADO] Verificando si la transacción ya fue procesada...');
    
    const db = getDb();
    const pagosCollection = db.collection('pagos_recibidos');
    const pagoExistente = await pagosCollection.findOne({ transaccion_id: transaction.id });

    if (pagoExistente) {
      console.log(`⚠️ [DUPLICADO] Transacción ya procesada: ${transaction.id}`);
      return res.status(200).json({ message: 'Transacción ya procesada' });
    }

    console.log('✅ [DUPLICADO] Transacción no duplicada');

    // 6. PROCESAMIENTO Y GUARDADO
    console.log('🔍 [PROCESAMIENTO] Procesando y guardando pago...');
    
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
        console.log('✅ [BD] Datos verificados en base de conocimiento');
      } else {
        console.warn(`⚠️ [BD] Factura ${referencia_factura} NO encontrada en BD. Usando datos de Wompi.`);
      }
    } catch (err) {
      console.error("❌ [BD] Error buscando factura en BD:", err);
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
    console.log(`✅ [PROCESAMIENTO] Pago registrado por webhook: ${transaction.id}`);

    // 7. SINCRONIZACIÓN ASÍNCRONA
    try {
      sincronizarConAppExterna(nuevoPago).catch(err => {
        console.error("❌ [SINCRONIZACIÓN] Error en el proceso de sincronización:", err);
      });
      console.log('✅ [SINCRONIZACIÓN] Sincronización iniciada');
    } catch (err) {
      console.error("❌ [SINCRONIZACIÓN] Error iniciando sincronización:", err);
    }

    // 8. RESPUESTA FINAL
    console.log('✅ [RESPUESTA] Webhook procesado exitosamente');
    res.status(200).json({ 
      message: 'Webhook procesado exitosamente',
      debug: {
        transaction_id: transaction.id,
        status: transaction.status,
        webhook_timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ [ERROR] Error en el webhook de Wompi:', error);
    console.error('❌ [ERROR] Stack trace:', error.stack);
    
    // Devolver 200 para evitar reintentos de Wompi
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
    console.log('🧪 [PRUEBA] Webhook de prueba recibido');
    console.log('🧪 [PRUEBA] Body:', JSON.stringify(req.body, null, 2));
    
    res.status(200).json({ 
      message: 'Webhook de prueba procesado',
      timestamp: new Date().toISOString(),
      body: req.body
    });
  } catch (error) {
    console.error('❌ [PRUEBA] Error en webhook de prueba:', error);
    res.status(200).json({ error: 'Error en webhook de prueba' });
  }
});

export default router;