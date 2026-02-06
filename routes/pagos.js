import express from "express";
import { getDb } from "../database.js";
import dotenv from "dotenv";
import * as XLSX from "xlsx";
import crypto from "crypto";

dotenv.config();

const router = express.Router();

const WOMPI_PRIVATE_KEY =
  process.env.WOMPI_SECRET || process.env.WOMPI_PRIVATE_KEY;
const WOMPI_EVENT_SECRET = process.env.WOMPI_EVENT_SECRET;
const WOMPI_API_URL = "https://sandbox.wompi.co/v1/transactions";

// POST /pagos/confirmacion
router.post("/confirmacion", async (req, res) => {
  if (!WOMPI_PRIVATE_KEY) {
    console.error(
      "❌ Error: WOMPI_SECRET no está definido en las variables de entorno.",
    );
    return res
      .status(500)
      .json({
        error: "Error de configuración del servidor (Wompi Key missing).",
      });
  }

  const { transaction_id } = req.body;

  if (!transaction_id) {
    return res.status(400).json({ error: "Falta el ID de la transacción." });
  }

  try {
    // 1. Consultar la API de Wompi
    const response = await fetch(`${WOMPI_API_URL}/${transaction_id}`, {
      headers: {
        Authorization: `Bearer ${WOMPI_PRIVATE_KEY}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error al consultar la transacción en Wompi:", errorData);
      return res
        .status(response.status)
        .json({
          error: "Error al verificar la transacción con Wompi.",
          details: errorData,
        });
    }

    const transaction = await response.json();
    const { data: tx } = transaction;

    // 2. Validar que el pago esté 'APPROVED'
    if (tx.status !== "APPROVED") {
      return res.status(200).json({
        mensaje: `El pago no fue aprobado. Estado: ${tx.status}`,
        status: tx.status,
      });
    }

    // 3. Verificar si la transacción ya fue procesada
    const db = getDb();
    const pagosCollection = db.collection("pagos_recibidos");
    const pagoExistente = await pagosCollection.findOne({
      transaccion_id: tx.id,
    });

    if (pagoExistente) {
      return res.status(200).json({
        mensaje: "Este pago ya fue procesado anteriormente.",
        status: "DUPLICADO",
        pago: pagoExistente,
      });
    }

    // 4. Extraer datos y guardarlos en MongoDB
    const referenceParts = tx.reference.split("-");
    const referencia_factura =
      referenceParts.length > 1 ? referenceParts[1] : tx.reference;

    // 🔥 BÚSQUEDA DE DATOS SEGUROS EN BASE DE CONOCIMIENTO 🔥
    let nit_cliente = tx.customer_data?.legal_id || "No disponible";
    let nombre_cliente = tx.customer_data?.full_name || "No disponible";
    let datos_verificados = false;

    try {
      const baseConocimiento = db.collection("base_conocimiento");
      // Buscamos por documento (factura). Convertimos a string por si acaso.
      const facturaInfo = await baseConocimiento.findOne({
        Documento: referencia_factura,
      });

      if (facturaInfo) {
        // Usamos los datos de la base de conocimiento
        nit_cliente = facturaInfo.Cliente || nit_cliente;
        nombre_cliente = facturaInfo.Nombre_Cliente || nombre_cliente;
        datos_verificados = true;
      } else {
        console.warn(
          `⚠️ Factura ${referencia_factura} NO encontrada en BD. Usando datos de Wompi.`,
        );
      }
    } catch (err) {
      console.error("Error buscando factura en BD:", err);
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
      _wompi_raw_data: tx, // Guardar el objeto completo para futuras referencias
    };

    await pagosCollection.insertOne(nuevoPago);

    // 5. Simular sincronización (asíncrona, no bloqueante)
    // sincronizarConAppExterna(nuevoPago).catch(err => {
    //     console.error("Error en el proceso de sincronización:", err);
    // });

    // 6. Responder al frontend
    res.status(201).json({
      mensaje: "Pago aprobado y registrado exitosamente.",
      status: "APROBADO",
      pago: {
        referencia: nuevoPago.referencia_factura,
        monto: nuevoPago.monto,
        cliente: nuevoPago.nombre_cliente,
      },
    });
  } catch (error) {
    console.error("Error en el endpoint de confirmación de pago:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor al procesar el pago." });
  }
});

// GET /pagos/reporte-excel
router.get("/reporte-excel", async (req, res) => {
  try {
    const { fecha } = req.query; // YYYY-MM-DD

    if (!fecha) {
      return res
        .status(400)
        .json({ error: "Debes proporcionar una fecha (YYYY-MM-DD)." });
    }

    // Calcular inicio y fin del día en UTC (o local, dependiendo de cómo guardes las fechas)
    // Asumiendo que 'fecha' viene en formato local 'YYYY-MM-DD' y queremos buscar todo ese día.
    const startOfDay = new Date(`${fecha}T00:00:00.000Z`);
    const endOfDay = new Date(`${fecha}T23:59:59.999Z`);

    const db = getDb();
    const pagosCollection = db.collection("pagos_recibidos");

    const pagos = await pagosCollection
      .find({
        fecha_pago: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      })
      .toArray();

    if (pagos.length === 0) {
      return res
        .status(404)
        .json({ error: "No se encontraron pagos para la fecha especificada." });
    }

    // Transformar datos para Excel
    const dataForExcel = pagos.map((p) => ({
      "ID Transacción": p.transaccion_id,
      "Referencia Factura": p.referencia_factura,
      Monto: p.monto,
      "NIT Cliente": p.nit_cliente,
      "Nombre Cliente": p.nombre_cliente,
      "Tipo de Pago": p.payment_type || 'N/A', // Nuevo campo
      "Motivo de Pago": p.payment_motive || 'N/A', // Nuevo campo
      "Fecha Pago": p.fecha_pago
        ? new Date(p.fecha_pago).toLocaleString("es-CO")
        : "",
    }));

    // Crear Workbook y Worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pagos");

    // Generar buffer
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    });

    // Configurar headers para descarga
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=reporte_pagos_${fecha}.xlsx`,
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.send(excelBuffer);
  } catch (error) {
    console.error("Error generando reporte Excel:", error);
    res.status(500).json({ error: "Error al generar el reporte." });
  }
});

// GET /pagos/estado/:transactionId
router.get("/estado/:transactionId", async (req, res) => {
  try {
    const { transactionId } = req.params;
    const db = getDb();
    const pagosCollection = db.collection("pagos_recibidos");
    const baseConocimiento = db.collection("base_conocimiento"); // Get base_conocimiento collection

    const pago = await pagosCollection.findOne({
      transaccion_id: transactionId,
    });

    if (pago) {
      let facturaInfo = null;
      if (pago.referencia_factura) {
        facturaInfo = await baseConocimiento.findOne({ Documento: pago.referencia_factura });
      }

      const totalPagadoHastaAhora = (await pagosCollection.aggregate([
        { $match: { referencia_factura: pago.referencia_factura, transaccion_id: { $ne: transactionId } } },
        { $group: { _id: null, total: { $sum: "$monto" } } }
      ]).toArray())[0]?.total || 0;

      const saldoOriginal = facturaInfo?.Saldo || 0;
      const nuevoSaldo = saldoOriginal - (totalPagadoHastaAhora + pago.monto);

      return res.status(200).json({
        status: "APROBADO",
        pago: {
          referencia: pago.referencia_factura,
          monto: pago.monto,
          cliente: pago.nombre_cliente,
          nit: pago.nit_cliente,
          fecha: pago.fecha_pago,
          webhook_procesado: pago.metodo_confirmacion === 'webhook', // Adjusted to use metodo_confirmacion
          payment_type: pago.payment_type, // Nuevo campo
          payment_motive: pago.payment_motive, // Nuevo campo
          // Datos de la factura original
          documento_original: facturaInfo?.Documento || pago.referencia_factura,
          saldo_original_factura: saldoOriginal,
          nuevo_saldo_factura: nuevoSaldo,
          nombre_cliente_factura: facturaInfo?.Nombre_Cliente || pago.nombre_cliente,
        },
      });
    } else {
      return res.status(404).json({
        status: "PENDIENTE",
        mensaje: "Pago no encontrado o aún no procesado.",
      });
    }
  } catch (error) {
    console.error("Error consultando estado del pago:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor al consultar estado." });
  }
});

// GET /wompi/config
router.get("/wompi/config", async (req, res) => {
  try {
    const publicKey =
      process.env.WOMPI_PUBLIC || "pub_test_uQxOPFVJOt6iPjd9Dt3302Wd7PeKb8Jd";

    res.status(200).json({
      publicKey: publicKey,
    });
  } catch (error) {
    console.error("Error obteniendo configuración de Wompi:", error);
    res
      .status(500)
      .json({
        error: "Error interno del servidor al obtener configuración de Wompi.",
      });
  }
});

// POST /wompi/signature (endpoint consolidado para firma y clave pública)
router.post("/wompi/signature", async (req, res) => {
  try {
    const { reference, amountInCents, currency } = req.body;

    if (!reference || !amountInCents || !currency) {
      return res
        .status(400)
        .json({
          error:
            "Faltan parámetros requeridos: reference, amountInCents, currency",
        });
    }

    const wompiIntegritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    const publicKey =
      process.env.WOMPI_PUBLIC || "pub_test_uQxOPFVJOt6iPjd9Dt3302Wd7PeKb8Jd";

    if (!wompiIntegritySecret) {
      return res
        .status(500)
        .json({
          error:
            "WOMPI_INTEGRITY_SECRET no está definido en las variables de entorno.",
        });
    }

    // Crear el payload para la firma según documentación de Wompi (Checkout Web)
    // El orden CORRECTO es: reference + amountInCents + currency + integritySecret
    const payload = `${reference}${amountInCents}${currency}${wompiIntegritySecret}`;

    console.log("--- DEBUG FIRMA ---");
    console.log("Payload a firmar:", payload);

    // Calcular la firma SHA-256 (Wompi requiere SHA-256, no MD5)
    const signature = crypto.createHash("sha256").update(payload).digest("hex");

    res.status(200).json({
      signature: signature,
      publicKey: publicKey,
    });
  } catch (error) {
    console.error("Error generando firma de Wompi:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor al generar firma de Wompi." });
  }
});

// POST /pagos/wompi-webhook (versión ultra-simple para depuración)
router.post("/wompi-webhook", (req, res) => {
  console.log("--- NUEVO EVENTO RECIBIDO ---");
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).send("OK");
});

// Ruta para pruebas de webhook
router.post("/test-webhook", async (req, res) => {
  try {
    console.log("🧪 [PRUEBA] Webhook de prueba recibido");
    console.log("🧪 [PRUEBA] Body:", JSON.stringify(req.body, null, 2));

    res.status(200).json({
      message: "Webhook de prueba procesado",
      timestamp: new Date().toISOString(),
      body: req.body,
    });
  } catch (error) {
    console.error("❌ [PRUEBA] Error en webhook de prueba:", error);
    res.status(200).json({ error: "Error en webhook de prueba" });
  }
});

// --- LÓGICA REUTILIZABLE PARA GUARDAR EN BASE DE DATOS ---
async function processAndSaveTransaction(transaction, paymentOption = 'desconocido', paymentMotive = null) {
  const db = getDb();
  const pagosCollection = db.collection("pagos_recibidos");
  const tx = transaction;

  // 1. Verificar si la transacción ya fue procesada
  const pagoExistente = await pagosCollection.findOne({ transaccion_id: tx.id });
  if (pagoExistente) {
    // If it exists, check if we need to update payment_type/motive from a redirect call
    if (pagoExistente.payment_type === 'webhook_event' && paymentOption !== 'desconocido' && paymentOption !== 'webhook_event') {
      console.log(`[Shared] Actualizando payment_type para TX ${tx.id} de 'webhook_event' a '${paymentOption}'.`);
      await pagosCollection.updateOne(
        { transaccion_id: tx.id },
        { $set: { payment_type: paymentOption, payment_motive: paymentMotive } }
      );
      return { status: "UPDATED", data: { ...pagoExistente, payment_type: paymentOption, payment_motive: paymentMotive } };
    }
    console.log(`[Shared] Transacción ${tx.id} ya fue procesada (DUPLICADO).`);
    return { status: "DUPLICATED", data: pagoExistente };
  }

  // 2. Extraer datos y guardarlos en MongoDB
  const referenceParts = tx.reference.split("-");
  const referencia_factura = referenceParts.length > 1 ? referenceParts[1] : tx.reference;

  const baseConocimiento = db.collection("base_conocimiento");
  const facturaInfo = await baseConocimiento.findOne({ Documento: referencia_factura });

  const nuevoPago = {
    transaccion_id: tx.id,
    referencia_factura,
    monto: tx.amount_in_cents / 100,
    nit_cliente: facturaInfo?.Cliente || tx.customer_data?.legal_id || "No disponible",
    nombre_cliente: facturaInfo?.Nombre_Cliente || tx.customer_data?.full_name || "No disponible",
    fecha_pago: new Date(tx.created_at),
    metodo_confirmacion: tx.sent_at ? 'webhook' : 'redirect', // Identificar cómo se confirmó
    sincronizado_app_externa: false,
    datos_verificados_bd: !!facturaInfo,
    payment_type: paymentOption, // Nuevo campo
    payment_motive: paymentMotive, // Nuevo campo
    _wompi_raw_data: tx,
  };

  await pagosCollection.insertOne(nuevoPago);
  console.log(`✅ [Shared] Transacción ${tx.id} APROBADA y guardada en BD.`);
  return { status: "CREATED", data: nuevoPago };
}


// --- ENDPOINT DE WEBHOOK (EVENTOS) ---
router.post("/events", async (req, res) => {
    const eventSecret = process.env.WOMPI_EVENTS_SECRET;
    if (!eventSecret) {
        console.error("CRITICAL: WOMPI_EVENTS_SECRET no está configurado.");
        return res.status(500).json({ error: "Server configuration error" });
    }

    try {
        const { event, data, signature, timestamp } = req.body;
        const { transaction } = data;

        // 1. Verificar la firma del evento para asegurar que es de Wompi
        const signatureProperties = {
            "transaction.id": transaction.id,
            "transaction.status": transaction.status,
            "transaction.amount_in_cents": transaction.amount_in_cents,
        };
        const concatenatedString = `${signatureProperties["transaction.id"]}${signatureProperties["transaction.status"]}${signatureProperties["transaction.amount_in_cents"]}${timestamp}${eventSecret}`;
        const calculatedSignature = crypto.createHash('sha256').update(concatenatedString).digest('hex');

        if (calculatedSignature !== signature.checksum) {
            console.warn(`[Webhook] Firma inválida para transacción ${transaction.id}.`);
            return res.status(401).json({ error: "Invalid signature" });
        }

        console.log(`[Webhook] Evento '${event}' recibido y verificado para TX: ${transaction.id}`);

        // 2. Procesar solo si es una transacción aprobada
        if (event === "transaction.updated" && transaction.status === "APPROVED") {
            // Webhooks no tienen acceso directo a paymentOption/paymentMotive del frontend
            // Se guardarán como 'webhook_event' y null por defecto en este caso.
            await processAndSaveTransaction(transaction, 'webhook_event', null); 
        }

        // 3. Responder a Wompi que todo está bien
        res.status(200).json({ message: "Event received" });

    } catch (error) {
        console.error("[Webhook] Error procesando el evento:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// Ruta de redirección que procesa la confirmación del pago
router.get("/response", async (req, res) => {
  console.log("--- PROCESANDO RESPUESTA DE WOMPI (REDIRECCIÓN) ---");
  console.log("Query params recibidos:", req.query);

  const { id: transaction_id, env: wompi_env, paymentOption, paymentMotive } = req.query; // Extraer nuevos campos

  if (!transaction_id) {
    return res.redirect(`${process.env.FRONTEND_URL}/payment-response?status=error&message=NO_TX_ID`);
  }

  try {
    const wompiApiUrl = wompi_env === 'test' ? 'https://sandbox.wompi.co/v1/transactions' : 'https://production.wompi.co/v1/transactions';
    console.log(`[Redirect] Verificando TX contra URL: ${wompiApiUrl}`);
    
    const privateKey = process.env.WOMPI_PRIVATE_KEY || process.env.WOMPI_SECRET;
    if (!privateKey) {
        console.error("CRITICAL: [Redirect] No se encontró la llave privada de Wompi.");
        return res.redirect(`${process.env.FRONTEND_URL}/payment-response?status=error&message=CONFIG_ERROR`);
    }

    const response = await fetch(`${wompiApiUrl}/${transaction_id}`, {
      headers: { Authorization: `Bearer ${privateKey}` },
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("[Redirect] Error al consultar la transacción en Wompi:", errorData);
        return res.redirect(`${process.env.FRONTEND_URL}/payment-response?status=error&message=WOMPI_VERIFICATION_FAILED`);
    }

    const transactionWrapper = await response.json();
    const tx = transactionWrapper.data;

    if (tx.status === "APPROVED") {
        await processAndSaveTransaction(tx, paymentOption, paymentMotive); // Pasar los nuevos campos
    }
    
    res.redirect(`${process.env.FRONTEND_URL}/payment-response?status=${tx.status}&ref=${tx.reference}&tx_id=${tx.id}`);

  } catch (error) {
    console.error("[Redirect] Error catastrófico en el endpoint /response:", error);
    res.redirect(`${process.env.FRONTEND_URL}/payment-response?status=error&message=SERVER_ERROR`);
  }
});

// El resto de tus rutas (reporte-excel, estado, config, signature, etc.) permanecen aquí...
// ...
export default router;
