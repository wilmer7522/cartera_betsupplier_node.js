import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// Variables de entorno
const WOMPI_INTEGRITY_SECRET = 'test_integrity_sejifHGd84SmAiLxORVGdPX8tJ9rc2B1';
const WOMPI_PUBLIC = 'pub_test_uQxOPFVJOt6iPjd9Dt3302Wd7PeKb8Jd';

// Endpoint de prueba para firma
app.post('/test-firma', (req, res) => {
  try {
    const { reference, amountInCents, currency } = req.body;

    console.log('🔍 [TEST] Solicitud de firma recibida');
    console.log('🔍 [TEST] Body:', JSON.stringify(req.body, null, 2));

    if (!reference || !amountInCents || !currency) {
      return res.status(400).json({ 
        error: 'Faltan parámetros requeridos: reference, amountInCents, currency',
        received: { reference, amountInCents, currency }
      });
    }

    // Calcular payload según documentación de Wompi
    const payload = `${currency}${amountInCents}${reference}${WOMPI_INTEGRITY_SECRET}`;
    console.log('📝 [TEST] Payload calculado:', payload);

    // Calcular firma MD5
    const signature = crypto.createHash('md5').update(payload).digest('hex');
    console.log('🔐 [TEST] Firma calculada:', signature);

    res.status(200).json({
      signature: signature,
      publicKey: WOMPI_PUBLIC,
      payload: payload,
      debug: {
        currency: currency,
        amountInCents: amountInCents,
        reference: reference,
        integritySecret: WOMPI_INTEGRITY_SECRET
      }
    });
  } catch (error) {
    console.error('❌ [TEST] Error en endpoint de prueba:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// Endpoint para probar con datos específicos
app.get('/test-firma', (req, res) => {
  const reference = 'FAC-12345-1234567890';
  const amountInCents = 10000;
  const currency = 'COP';

  const payload = `${currency}${amountInCents}${reference}${WOMPI_INTEGRITY_SECRET}`;
  const signature = crypto.createHash('md5').update(payload).digest('hex');

  res.status(200).json({
    signature: signature,
    publicKey: WOMPI_PUBLIC,
    payload: payload,
    test_data: {
      reference: reference,
      amountInCents: amountInCents,
      currency: currency
    }
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ Servidor de prueba de firma escuchando en puerto ${PORT}`);
  console.log('🔍 Endpoints disponibles:');
  console.log(`- POST http://localhost:${PORT}/test-firma`);
  console.log(`- GET  http://localhost:${PORT}/test-firma`);
});