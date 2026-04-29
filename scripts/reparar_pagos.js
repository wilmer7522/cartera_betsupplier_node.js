// scripts/reparar_pagos.js
import { connectDB, getDb, client } from "../database.js";

/**
 * Lógica robusta para extraer datos de la referencia (la misma que pusimos en pagos.js)
 */
function extractDataFromReference(reference) {
  if (!reference) return { referencia_factura: null, paymentOption: "desconocido", paymentMotive: null };
  const parts = reference.split("-");
  
  let referencia_factura = reference;
  let paymentOption = "desconocido";
  let paymentMotive = null;

  if (parts[0] === "FAC" && parts.length >= 2) {
    let tsIndex = -1;
    for (let i = 1; i < parts.length; i++) {
        // Buscamos el timestamp (10-15 dígitos)
      if (/^\d{10,15}$/.test(parts[i])) {
        tsIndex = i;
        break;
      }
    }

    if (tsIndex !== -1) {
      referencia_factura = parts.slice(1, tsIndex).join("-");
      if (parts[tsIndex + 1]) {
        paymentOption = parts[tsIndex + 1];
      }
      if (parts.length > tsIndex + 2) {
        paymentMotive = parts.slice(tsIndex + 2).join("-").replace(/_/g, " ");
      }
    } else {
      referencia_factura = parts.length > 1 ? parts[1] : reference;
      paymentOption = parts.length > 3 ? parts[3] : "desconocido";
      paymentMotive = parts.length > 4 ? parts.slice(4).join("-").replace(/_/g, " ") : null;
    }
  }
  
  return { referencia_factura, paymentOption, paymentMotive };
}

async function reparar() {
  try {
    const db = await connectDB();
    const pagosCollection = db.collection("pagos_recibidos");
    const baseConocimiento = db.collection("base_conocimiento");

    console.log("🔍 Buscando pagos para reparar...");

    // Buscamos pagos donde la referencia guardada parece truncada o incorrecta
    // O simplemente procesamos los más recientes para estar seguros.
    const pagos = await pagosCollection.find({}).sort({ fecha_pago: -1 }).limit(20).toArray();

    console.log(`📊 Analizando los últimos ${pagos.length} pagos...`);

    let reparados = 0;

    for (const pago of pagos) {
      const rawRef = pago._wompi_raw_data?.reference || pago._wompi_raw_data?.data?.reference;
      
      if (!rawRef) {
        console.log(`  ⏭️ Pago ${pago.transaccion_id} no tiene raw_data.reference, saltando.`);
        continue;
      }

      const { referencia_factura, paymentOption, paymentMotive } = extractDataFromReference(rawRef);

      // Si los datos extraídos son diferentes a los guardados, reparamos
      if (referencia_factura !== pago.referencia_factura || 
          paymentOption !== pago.payment_type || 
          paymentMotive !== pago.payment_motive) {
        
        console.log(`  🛠️ Reparando ${pago.transaccion_id}:`);
        console.log(`     Anterior: [${pago.referencia_factura}] [${pago.payment_type}]`);
        console.log(`     Nuevo:    [${referencia_factura}] [${paymentOption}]`);

        // Volvemos a buscar en base de conocimiento con la factura correcta
        const facturaInfo = await baseConocimiento.findOne({ Documento: referencia_factura });
        
        const updateDoc = {
          $set: {
            referencia_factura: referencia_factura,
            payment_type: paymentOption,
            payment_motive: paymentMotive,
            datos_verificados_bd: !!facturaInfo
          }
        };

        if (facturaInfo) {
          updateDoc.$set.nit_cliente = facturaInfo.Cliente;
          updateDoc.$set.nombre_cliente = facturaInfo.Nombre_Cliente;
          console.log(`     ✅ Cliente encontrado: ${facturaInfo.Nombre_Cliente}`);
        } else {
            console.log(`     ⚠️ Factura ${referencia_factura} no encontrada en base_conocimiento.`);
        }

        await pagosCollection.updateOne({ _id: pago._id }, updateDoc);
        reparados++;
      }
    }

    console.log(`\n🎉 Proceso terminado. Se repararon ${reparados} pagos.`);
  } catch (error) {
    console.error("❌ Error durante la reparación:", error);
  } finally {
    await client.close();
    process.exit(0);
  }
}

reparar();
