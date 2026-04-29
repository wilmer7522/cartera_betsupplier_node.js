// scripts/reparar_pagos.js
import { connectDB, getDb, client } from "../database.js";
import dotenv from "dotenv";
dotenv.config();

/**
 * Lógica idéntica a la de pagos.js para asegurar consistencia
 */
function extractDataFromReference(tx) {
  const reference = tx.reference || "";
  const description = tx.description || "";
  const parts = reference.split("-");
  
  let referencia_factura = reference;
  let paymentOption = "total"; 
  let paymentMotive = null;

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
  
  if (referencia_factura.startsWith("xev3") || referencia_factura.length > 20) {
    const matchFactura = description.match(/\d+/);
    if (matchFactura) {
      referencia_factura = matchFactura[0];
    }
    const descLower = description.toLowerCase();
    if (descLower.includes("abono") || descLower.includes("abona")) {
      paymentOption = "abono";
    } else if (descLower.includes("otro") || descLower.includes("motivo")) {
      paymentOption = "otro";
    }
  }

  return { referencia_factura, paymentOption, paymentMotive };
}

async function reparar() {
  try {
    const db = await connectDB();
    const pagosCollection = db.collection("pagos_recibidos");
    const baseConocimiento = db.collection("base_conocimiento");

    console.log("🔍 Iniciando proceso de reparación de pagos...");

    const pagos = await pagosCollection.find({}).sort({ fecha_pago: -1 }).limit(50).toArray();
    console.log(`📊 Analizando los últimos ${pagos.length} pagos registrados.`);

    let reparados = 0;

    for (const pago of pagos) {
      // Obtenemos los datos crudos de Wompi guardados en el registro
      const txRaw = pago._wompi_raw_data?.data || pago._wompi_raw_data;
      
      if (!txRaw || !txRaw.reference) {
        continue;
      }

      const { referencia_factura, paymentOption, paymentMotive } = extractDataFromReference(txRaw);

      // Verificamos si hay cambios necesarios
      const necesitaCambio = 
        referencia_factura !== pago.referencia_factura || 
        paymentOption !== pago.payment_type ||
        (paymentMotive && paymentMotive !== pago.payment_motive);

      if (necesitaCambio) {
        console.log(`\n🛠️  Reparando transacción: ${pago.transaccion_id}`);
        console.log(`   De: [${pago.referencia_factura}] -> A: [${referencia_factura}]`);
        console.log(`   Tipo: [${pago.payment_type}] -> A: [${paymentOption}]`);

        // Buscamos datos correctos del cliente en la base de conocimiento
        const facturaInfo = await baseConocimiento.findOne({ Documento: referencia_factura });
        
        const updateDoc = {
          $set: {
            referencia_factura: referencia_factura,
            payment_type: paymentOption,
            payment_motive: paymentMotive || pago.payment_motive,
            datos_verificados_bd: !!facturaInfo
          }
        };

        if (facturaInfo) {
          updateDoc.$set.nit_cliente = facturaInfo.Cliente;
          updateDoc.$set.nombre_cliente = facturaInfo.Nombre_Cliente;
          console.log(`   ✅ Cliente vinculado: ${facturaInfo.Nombre_Cliente} (NIT: ${facturaInfo.Cliente})`);
        } else {
          console.log(`   ⚠️  No se encontró la factura ${referencia_factura} en la base de conocimiento.`);
        }

        await pagosCollection.updateOne({ _id: pago._id }, updateDoc);
        reparados++;
      }
    }

    console.log(`\n🎉 Reparación finalizada. Total registros corregidos: ${reparados}`);
  } catch (error) {
    console.error("❌ Error durante la reparación:", error);
  } finally {
    await client.close();
    process.exit(0);
  }
}

reparar();
