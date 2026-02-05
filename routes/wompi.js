import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

router.post('/signature', (req, res) => {
  const { reference, amountInCents, currency, redirectUrl } = req.body; // <-- 1. RECIBIR redirectUrl

  const wompiIntegritySecret = process.env.WOMPI_INTEGRITY_SECRET;

  if (!wompiIntegritySecret) {
    console.error('[WOMPI-SIGNATURE-ERROR] WOMPI_INTEGRITY_SECRET no está definida.');
    return res.status(500).json({ error: 'WOMPI_INTEGRITY_SECRET is not defined in environment variables.' });
  }

  // --- 2. LOGS DE DEPURACIÓN ESTRATÉGICOS ---
  // Esto te dirá exactamente qué valores se están usando en Render.
  console.log('[WOMPI-SIGNATURE] Creando firma con los siguientes valores:');
  console.log({
    reference,
    amountInCents,
    currency,
    redirectUrl,
    secretLast4: wompiIntegritySecret.slice(-4) // NO LOGUEAR EL SECRETO COMPLETO
  });
  
  // --- 3. CORRECCIÓN DE LA CADENA CONCATENADA ---
  const concatenatedString = `${reference}${amountInCents}${currency}${redirectUrl}${wompiIntegritySecret}`;
  
  const hash = crypto.createHash('sha256').update(concatenatedString).digest('hex');

  console.log('[WOMPI-SIGNATURE] String Concatenado:', concatenatedString);
  console.log('[WOMPI-SIGNATURE] Hash Generado:', hash);

  res.json({ signature: hash });
});

export default router;