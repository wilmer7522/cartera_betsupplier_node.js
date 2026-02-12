import express from 'express';
import crypto from 'crypto';
import dotenv from "dotenv";

dotenv.config();


const router = express.Router();

router.post('/signature', (req, res) => {
  const { reference, amountInCents, currency, redirectUrl } = req.body; // <-- 1. RECIBIR redirectUrl

  const wompiIntegritySecret = process.env.WOMPI_INTEGRITY_SECRET;

  if (!wompiIntegritySecret) {
  }

  // --- 3. CORRECCIÓN DE LA CADENA CONCATENADA ---
  const concatenatedString = `${reference}${amountInCents}${currency}${redirectUrl}${wompiIntegritySecret}`;
  
  const hash = crypto.createHash('sha256').update(concatenatedString).digest('hex');

  res.json({ signature: hash });
});

export default router;