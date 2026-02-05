import crypto from 'crypto';

// Variables de entorno
const WOMPI_INTEGRITY_SECRET = 'test_integrity_sejifHGd84SmAiLxORVGdPX8tJ9rc2B1';
const WOMPI_PUBLIC = 'pub_test_uQxOPFVJOt6iPjd9Dt3302Wd7PeKb8Jd';

// Datos de prueba
const reference = 'FAC-12345-1234567890';
const amountInCents = 10000;
const currency = 'COP';

console.log('🔍 DEPURACIÓN DE FIRMA WOMPI');
console.log('=============================');
console.log('');

console.log('📋 DATOS DE ENTRADA:');
console.log(`- Reference: ${reference}`);
console.log(`- Amount in Cents: ${amountInCents}`);
console.log(`- Currency: ${currency}`);
console.log(`- Integrity Secret: ${WOMPI_INTEGRITY_SECRET}`);
console.log('');

// Calcular payload según documentación de Wompi
const payload = `${currency}${amountInCents}${reference}${WOMPI_INTEGRITY_SECRET}`;
console.log('📝 PAYLOAD CALCULADO:');
console.log(`"${payload}"`);
console.log('');

// Calcular firma MD5
const signature = crypto.createHash('md5').update(payload).digest('hex');
console.log('🔐 FIRMA CALCULADA:');
console.log(`"${signature}"`);
console.log('');

// Mostrar resultado final
console.log('✅ RESULTADO FINAL:');
console.log(JSON.stringify({
  signature: signature,
  publicKey: WOMPI_PUBLIC,
  payload: payload
}, null, 2));

console.log('');
console.log('🔍 VERIFICACIÓN MANUAL:');
console.log('Puedes verificar este MD5 en línea usando:');
console.log(`- Texto: ${payload}`);
console.log(`- Algoritmo: MD5`);
console.log(`- Resultado esperado: ${signature}`);