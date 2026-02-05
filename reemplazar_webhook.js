#!/usr/bin/env node

/**
 * Script para reemplazar el webhook actual con la versión depurada
 */

import fs from 'fs';
import path from 'path';

console.log('🔧 REEMPLAZO DEL WEBHOOK CON VERSIÓN DEPURADA');
console.log('==============================================\n');

// Rutas de los archivos
const rutaWebhookActual = path.join(process.cwd(), 'routes/pagos.js');
const rutaWebhookDebug = path.join(process.cwd(), 'routes/pagos_webhook_debug.js');
const rutaWebhookBackup = path.join(process.cwd(), 'routes/pagos_webhook_backup.js');

console.log('📋 ARCHIVOS INVOLUCRADOS:');
console.log('========================');
console.log('✅ Webhook actual:', rutaWebhookActual);
console.log('✅ Webhook depurado:', rutaWebhookDebug);
console.log('✅ Backup del webhook:', rutaWebhookBackup);
console.log('');

// Verificar que existan los archivos
if (!fs.existsSync(rutaWebhookActual)) {
  console.error('❌ Error: No se encontró el archivo pagos.js');
  process.exit(1);
}

if (!fs.existsSync(rutaWebhookDebug)) {
  console.error('❌ Error: No se encontró el archivo pagos_webhook_debug.js');
  process.exit(1);
}

// Crear backup del webhook actual
try {
  const contenidoActual = fs.readFileSync(rutaWebhookActual, 'utf8');
  fs.writeFileSync(rutaWebhookBackup, contenidoActual);
  console.log('✅ Backup creado exitosamente:', rutaWebhookBackup);
} catch (error) {
  console.error('❌ Error creando backup:', error.message);
  process.exit(1);
}

// Leer el contenido del webhook depurado
let contenidoDebug;
try {
  contenidoDebug = fs.readFileSync(rutaWebhookDebug, 'utf8');
} catch (error) {
  console.error('❌ Error leyendo webhook depurado:', error.message);
  process.exit(1);
}

// Extraer solo la parte del webhook del archivo depurado
const inicioWebhook = contenidoDebug.indexOf('// POST /pagos/wompi-webhook (versión depurada)');
const finWebhook = contenidoDebug.indexOf('export default router;', inicioWebhook);

if (inicioWebhook === -1 || finWebhook === -1) {
  console.error('❌ Error: No se encontró la sección del webhook en el archivo depurado');
  process.exit(1);
}

const seccionWebhook = contenidoDebug.substring(inicioWebhook, finWebhook + 'export default router;'.length);

console.log('🔍 CONTENIDO DEL WEBHOOK DEPURADO:');
console.log('==================================');
console.log(seccionWebhook.substring(0, 500) + '...');
console.log('');

// Leer el webhook actual y reemplazar la sección del webhook
let contenidoActual;
try {
  contenidoActual = fs.readFileSync(rutaWebhookActual, 'utf8');
} catch (error) {
  console.error('❌ Error leyendo webhook actual:', error.message);
  process.exit(1);
}

// Encontrar la sección del webhook actual
const inicioWebhookActual = contenidoActual.indexOf('// POST /pagos/wompi-webhook');
const finWebhookActual = contenidoActual.indexOf('export default router;', inicioWebhookActual);

if (inicioWebhookActual === -1) {
  console.error('❌ Error: No se encontró la sección del webhook en el archivo actual');
  process.exit(1);
}

// Construir el nuevo contenido
const nuevoContenido = contenidoActual.substring(0, inicioWebhookActual) + seccionWebhook;

// Escribir el nuevo contenido
try {
  fs.writeFileSync(rutaWebhookActual, nuevoContenido);
  console.log('✅ Webhook reemplazado exitosamente!');
  console.log('✅ Archivo actualizado:', rutaWebhookActual);
} catch (error) {
  console.error('❌ Error escribiendo webhook actualizado:', error.message);
  process.exit(1);
}

console.log('\n🎯 PASOS SIGUIENTES:');
console.log('====================');
console.log('1. Reinicia tu servidor Node.js');
console.log('2. Ejecuta el script de prueba: node test_webhook_debug.js');
console.log('3. Revisa los logs del servidor para ver los mensajes de depuración');
console.log('4. Identifica qué error específico está ocurriendo');
console.log('5. Si hay errores, el webhook devolverá 200 para evitar reintentos de Wompi');
console.log('');

console.log('🔍 MENSAJES DE DEPURACIÓN QUE VERÁS:');
console.log('=====================================');
console.log('🔍 [MIDDLEWARE] - Verificación del body-parser');
console.log('🔍 [FIRMA] - Validación de la firma de Wompi');
console.log('🔍 [ESTRUCTURA] - Validación de la estructura del evento');
console.log('🔍 [PROCESAMIENTO] - Procesamiento y guardado del pago');
console.log('🔍 [ERROR] - Captura de cualquier error con stack trace');
console.log('');

console.log('🚀 ¡LISTO PARA PROBAR!');
console.log('======================');
console.log('El webhook ahora tiene depuración paso a paso para identificar');
console.log('exactamente cuál de los 3 fallos técnicos está ocurriendo.');