import express from "express";
import { getDb } from "../database.js";
import * as XLSX from "xlsx";
import crypto from "crypto";
import { formatInTimeZone } from "date-fns-tz";
import dotenv from "dotenv";

dotenv.config();



const router = express.Router();
const WOMPI_PRIVATE_KEY =
  process.env.WOMPI_SECRET || process.env.WOMPI_PRIVATE_KEY;

/**
 * Extrae de forma robusta la información de una referencia de pago de Wompi.
 * Si falla la referencia, intenta buscar en la descripción o usa valores por defecto seguros.
 */
function extractDataFromReference(tx) {
  const reference = tx.reference || "";
  const description = tx.description || "";
  const parts = reference.split("-");
  
  // 1. Valores por defecto (Cambiamos 'desconocido' por 'total' para no romper robots)
  let referencia_factura = reference;
  let paymentOption = "total"; 
  let paymentMotive = null;

  // 2. Intentar parsear por formato estándar FAC-
  if (parts[0] === "FAC" && parts.length >= 2) {
    let tsIndex = -1;
    for (let i = 1; i < parts.length; i++) {
      if (/^\d{10,15}$/.test(parts[i])) {
        tsIndex = i;
        break;
      }
    }

    if (tsIndex !== -1) {
      referencia_factura = parts.slice(1, tsIndex).join("-");
      paymentOption = parts[tsIndex + 1] || "total";
      if (parts.length > tsIndex + 2) {
        paymentMotive = parts.slice(tsIndex + 2).join("-").replace(/_/g, " ");
      }
    }
  } 

  return { referencia_factura, paymentOption, paymentMotive };
}
// Se elimina la constante WOMPI_EVENT_SECRET (singular) para evitar confusión.
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

    // 4. Extraer datos y guardarlos en MongoDB usando lógica robusta
    const { 
      referencia_factura, 
      paymentOption: payment_type, 
      paymentMotive: payment_motive 
    } = extractDataFromReference(tx);

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
      payment_type, // Se añaden estos campos para consistencia
      payment_motive,
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
    const { fecha, fechaFin } = req.query; // YYYY-MM-DD

    if (!fecha) {
      return res
        .status(400)
        .json({ error: "Debes proporcionar una fecha de inicio (YYYY-MM-DD)." });
    }

    // El inicio del rango es el comienzo del día 'fecha'
    const startOfDay = new Date(`${fecha}T00:00:00.000Z`);

    // Si se proporciona fechaFin, el fin del rango es el final de ese día.
    // Si no, el fin del rango es el final del mismo día 'fecha'.
    const endOfDay = fechaFin 
      ? new Date(`${fechaFin}T23:59:59.999Z`)
      : new Date(`${fecha}T23:59:59.999Z`);

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
        .json({ error: "No se encontraron pagos para el rango de fechas especificado." });
    }

    // Obtener NITs únicos para buscar correos (asegurando que sean strings)
    const nitsUnicos = [...new Set(pagos.map(p => p.nit_cliente?.toString().trim()).filter(nit => nit && nit !== 'No disponible'))];
    
    // Buscar usuarios que tengan estos NITs asociados
    const usuarios = await db.collection('usuarios').find({
      'clientes_asociados.nit': { $in: nitsUnicos }
    }).toArray();

    // Crear mapa de NIT -> Correo
    const nitToEmail = {};
    usuarios.forEach(u => {
      if (u.clientes_asociados && Array.isArray(u.clientes_asociados)) {
        u.clientes_asociados.forEach(c => {
          const nit = (typeof c === 'object' ? c.nit : c).toString().trim();
          if (nitsUnicos.includes(nit)) {
            nitToEmail[nit] = u.correo;
          }
        });
      }
    });

    // Transformar datos para Excel
    const dataForExcel = pagos.map((p) => ({
      "ID Transacción": p.transaccion_id,
      "Referencia Factura": p.referencia_factura,
      Monto: p.monto,
      "NIT Cliente": p.nit_cliente,
      "Nombre Cliente": p.nombre_cliente,
      "Tipo de Pago": p.payment_type || 'N/A',
      "Motivo de Pago": p.payment_motive || 'N/A',
      "Fecha Pago": p.fecha_pago
        ? formatInTimeZone(p.fecha_pago, 'America/Bogota', 'dd/MM/yyyy HH:mm:ss')
        : "",
      "Correo": p.nit_cliente ? (nitToEmail[p.nit_cliente.toString().trim()] || '') : '',
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

    // Nombre de archivo dinámico
    const nombreArchivo = "Reporte_de_Pagos_Cartera.xlsx";

    // Configurar headers para descarga
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${nombreArchivo}`,
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
    const baseConocimiento = db.collection("base_conocimiento");

    const pago = await pagosCollection.findOne({
      transaccion_id: transactionId,
    });

    if (pago) {
      let facturaInfo = null;
      if (pago.referencia_factura) {
        facturaInfo = await baseConocimiento.findOne({ Documento: pago.referencia_factura });
      }

      // Función auxiliar para parsear valores monetarios (maneja comas y puntos)
      const parseCurrencyToFloat = (value) => {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const cleaned = value.replace(/\./g, '').replace(/,/g, '.');
          return parseFloat(cleaned);
        }
        return 0;
      };

      const saldoOriginal = parseCurrencyToFloat(facturaInfo?.Saldo || 0);
      
      // Cálculo corregido: se resta solo el monto de este pago, no el acumulado.
      const nuevoSaldo = saldoOriginal - pago.monto;

      const responsePayload = {
        status: "APROBADO",
        pago: {
          referencia: pago.referencia_factura,
          monto: pago.monto,
          cliente: pago.nombre_cliente,
          nit: pago.nit_cliente,
          fecha: pago.fecha_pago 
            ? formatInTimeZone(pago.fecha_pago, 'America/Bogota', "d 'de' MMMM 'de' yyyy, h:mm a")
            : null,
          webhook_procesado: pago.metodo_confirmacion === 'webhook',
          payment_type: pago.payment_type,
          payment_motive: pago.payment_motive,
          // Datos de la factura original para visualización
          documento_original: facturaInfo?.Documento || pago.referencia_factura,
          saldo_original_factura: saldoOriginal,
          nuevo_saldo_factura: nuevoSaldo, // Este es el valor calculado para mostrar
          nombre_cliente_factura: facturaInfo?.Nombre_Cliente || pago.nombre_cliente,
        },
      };

      return res.status(200).json(responsePayload);
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
  
  res.status(200).send("OK");
});

// Ruta para pruebas de webhook
router.post("/test-webhook", async (req, res) => {
  try {
    

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
async function processAndSaveTransaction(transaction) {
  const db = getDb();
  const pagosCollection = db.collection("pagos_recibidos");
  const tx = transaction;

  // 1. Verificar si la transacción ya fue procesada
  const pagoExistente = await pagosCollection.findOne({ transaccion_id: tx.id });
  if (pagoExistente) {
    
    return { status: "DUPLICATED", data: pagoExistente };
  }

  // 2. Extraer datos de la referencia y de la transacción usando lógica robusta
  const { 
    referencia_factura, 
    paymentOption, 
    paymentMotive 
  } = extractDataFromReference(tx);

  const montoPagadoReal = tx.amount_in_cents / 100;

  const baseConocimiento = db.collection("base_conocimiento");
  const facturaInfo = await baseConocimiento.findOne({ Documento: referencia_factura });

  const nuevoPago = {
    transaccion_id: tx.id,
    referencia_factura,
    monto: montoPagadoReal,
    nit_cliente: facturaInfo?.Cliente || tx.customer_data?.legal_id || "No disponible",
    nombre_cliente: facturaInfo?.Nombre_Cliente || tx.customer_data?.full_name || "No disponible",
    fecha_pago: new Date(tx.created_at), // revertido a UTC
    metodo_confirmacion: tx.sent_at ? 'webhook' : 'redirect',
    sincronizado_app_externa: false,
    datos_verificados_bd: !!facturaInfo,
    payment_type: paymentOption,
    payment_motive: paymentMotive,
    _wompi_raw_data: tx,
  };

  await pagosCollection.insertOne(nuevoPago);
  
  
  // La lógica de `payment_intents` ha sido eliminada.

  return { status: "CREATED", data: nuevoPago };
}


// --- ENDPOINT DE WEBHOOK (EVENTOS) ---
router.post("/events", async (req, res) => {
    // REVERTIDO: Volvemos a usar la variable en plural para coincidir con la configuración del servidor.
    const eventSecret = process.env.WOMPI_EVENTS_SECRET;
    if (!eventSecret) {
        console.error("CRITICAL: WOMPI_EVENTS_SECRET (plural) no está configurado en las variables de entorno.");
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

        

        // 2. Procesar solo si es una transacción aprobada y proviene del portal (FAC-)
        if (event === "transaction.updated" && transaction.status === "APPROVED") {
            if (transaction.reference && transaction.reference.startsWith("FAC-")) {
                await processAndSaveTransaction(transaction); 
            } else {
                console.log(`[Webhook] Ignorando transacción externa o manual: ${transaction.reference}`);
            }
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
  

  const { id: transaction_id, env: wompi_env } = req.query;

  if (!transaction_id) {
    return res.redirect(`${process.env.FRONTEND_URL}/payment-response?status=error&message=NO_TX_ID`);
  }

  try {
    const wompiApiUrl = wompi_env === 'test' ? 'https://sandbox.wompi.co/v1/transactions' : 'https://production.wompi.co/v1/transactions';
    
    
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
        if (tx.reference && tx.reference.startsWith("FAC-")) {
            await processAndSaveTransaction(tx);
        } else {
            console.log(`[Redirect] Ignorando transacción aprobada pero externa: ${tx.reference}`);
        }
    }
    
    res.redirect(`${process.env.FRONTEND_URL}/payment-response?status=${tx.status}&ref=${tx.reference}&tx_id=${tx.id}`);

  } catch (error) {
    console.error("[Redirect] Error catastrófico en el endpoint /response:", error);
    res.redirect(`${process.env.FRONTEND_URL}/payment-response?status=error&message=SERVER_ERROR`);
  }
});

export default router;
