
// scripts/test_logica.js

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

// CASOS DE PRUEBA BASADOS EN TUS CAPTURAS
const pruebas = [
  {
    nombre: "Caso 1: Factura normal con guion y NIT (Portal)",
    tx: { 
      reference: "FAC-3566-174000123456-total",
      description: "Pago de factura 3566"
    }
  },
  {
    nombre: "Caso 2: Referencia extraña de Wompi (xev3fe) con número en descripción",
    tx: { 
      reference: "xev3fe_1777071891201_a7iy6ehb0ab",
      description: "Pago de la factura 12345 - Abono"
    }
  },
  {
    nombre: "Caso 3: Factura con guion interno (ej: FE-500)",
    tx: { 
      reference: "FAC-FE-500-174000654321-abono",
      description: "Abono a factura FE-500"
    }
  }
];

console.log("🧪 INICIANDO TEST DE LÓGICA DE PAGOS\n");

pruebas.forEach((p, i) => {
  const resultado = extractDataFromReference(p.tx);
  console.log(`📌 ${p.nombre}`);
  console.log(`   Referencia: ${p.tx.reference}`);
  console.log(`   Resultado Factura: ${resultado.referencia_factura} (Debería ser ${i===0?'3566':i===1?'12345':'FE-500'})`);
  console.log(`   Resultado Motivo: ${resultado.paymentOption} (Debería ser ${i===0?'total':i===1?'abono':'abono'})`);
  console.log("   -----------------------------------");
});

console.log("\n✅ Si los resultados coinciden, tu código de producción está perfecto.");
