import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

router.post('/signature', (req, res) => {
  const { reference, amountInCents, currency } = req.body;

  // ESTO ES LO QUE NECESITAMOS VER EN LOS LOGS DE RENDER:
  console.log("--- DEBUG FIRMA ---");
  console.log("Referencia:", reference);
  console.log("Monto en Centavos:", amountInCents);
  console.log("Moneda:", currency);
  console.log("Cadena a encriptar:", `${reference}${amountInCents}${currency}XXXXX`);
  
  const wompiIntegritySecret = process.env.WOMPI_INTEGRITY_SECRET;

  if (!wompiIntegritySecret) {
    return res.status(500).json({ error: 'WOMPI_INTEGRITY_SECRET is not defined in environment variables.' });
  }

  // --- CORRECCIÓN AQUÍ ---
  // El formato correcto para el Checkout Web es:
  // referencia + monto_en_centavos + moneda + secreto_de_integridad
  const concatenatedString = `${reference}${amountInCents}${currency}${wompiIntegritySecret}`;
  
  const hash = crypto.createHash('sha256').update(concatenatedString).digest('hex');

  res.json({ signature: hash, reference });
});

export default router;