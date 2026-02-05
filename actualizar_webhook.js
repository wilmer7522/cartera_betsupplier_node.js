#!/usr/bin/env node

/**
 * Script para actualizar la URL del webhook en Wompi
 */

import readline from 'readline';

// Configuración
const WOMPI_EVENT_SECRET = 'test_events_PfCNpPjtHpVNAfxvZIUXspOtXzcNZZNl';

// Crear interfaz de lectura
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔧 ACTUALIZACIÓN DE URL DEL WEBHOOK DE WOMPI');
console.log('============================================\n');

console.log('Para que los pagos se registren automáticamente en tu base de datos');
console.log('sin que el cliente tenga que hacer clic en "Finalizar proceso",');
console.log('necesitas actualizar la URL del webhook en tu cuenta de Wompi.\n');

rl.question('🔗 Por favor, ingresa la URL pública de ngrok para el puerto 8000 (ej: https://abcd1234.ngrok-free.app): ', (ngrokUrl) => {
  if (!ngrokUrl) {
    console.log('❌ No ingresaste una URL válida. Por favor, ejecuta este script nuevamente.');
    rl.close();
    return;
  }

  // Limpiar la URL (eliminar espacios y asegurar formato correcto)
  const cleanUrl = ngrokUrl.trim().replace(/\/$/, '');
  const webhookUrl = `${cleanUrl}/pagos/wompi-webhook`;

  console.log('\n✅ URL DEL WEBHOOK CONFIGURADA:');
  console.log('==============================\n');
  
  console.log('📋 INFORMACIÓN PARA CONFIGURAR EN WOMPI:\n');
  console.log('1. INICIA SESIÓN EN TU CUENTA DE WOMPI');
  console.log('   URL: https://dashboard.wompi.co\n');
  
  console.log('2. VE A LA SECCIÓN DE "EVENTOS" O "WEBHOOKS"\n');
  
  console.log('3. EDITA EL WEBHOOK EXISTENTE O CREA UNO NUEVO CON ESTA INFORMACIÓN:\n');
  console.log('   🔗 URL del Webhook:');
  console.log('   ', webhookUrl);
  console.log('   \n   📋 Eventos a recibir:');
  console.log('   - Selecciona: transaction.updated');
  console.log('   \n   🔐 Secreto de Eventos (para validación):');
  console.log('   -', WOMPI_EVENT_SECRET);
  console.log('   \n   ⚠️  IMPORTANTE: Asegúrate de que el secreto coincida exactamente\n');
  
  console.log('4. GUARDA LA CONFIGURACIÓN\n');
  
  console.log('✅ ¿CÓMO SABRÁS QUE FUNCIONA?\n');
  console.log('   Después de actualizar la URL:');
  console.log('   1. Realiza un pago de prueba');
  console.log('   2. Wompi enviará automáticamente una notificación a tu servidor');
  console.log('   3. Tu servidor procesará el webhook y guardará el pago en MongoDB');
  console.log('   4. El pago aparecerá en tu base de datos incluso si el cliente no hace clic en "Finalizar proceso"\n');
  
  console.log('🔍 VERIFICACIÓN DEL WEBHOOK:\n');
  console.log('   Puedes verificar que el webhook está funcionando observando:');
  console.log('   - Los logs de tu servidor (busca mensajes como "✅ Pago registrado por webhook")');
  console.log('   - La colección "pagos_recibidos" en tu base de datos MongoDB');
  console.log('   - El endpoint GET /api/payments/estado/{transactionId}\n');
  
  console.log('💡 CONSEJOS IMPORTANTES:\n');
  console.log('   1. Asegúrate de que ngrok esté activo y mostrando tráfico');
  console.log('   2. El webhook es público y no requiere autenticación del usuario');
  console.log('   3. La validación de la firma es crucial para evitar registros falsos');
  console.log('   4. Los pagos procesados por webhook tendrán el flag "webhook_procesado: true"\n');
  
  console.log('🎯 RESULTADO ESPERADO:\n');
  console.log('   Con la URL actualizada:');
  console.log('   - Los pagos se registrarán automáticamente en el momento que Wompi los apruebe');
  console.log('   - No dependerás de que el cliente haga clic en "Finalizar proceso"');
  console.log('   - Tendrás una experiencia de usuario mucho más fluida');
  console.log('   - Eliminarás la posibilidad de perder pagos por abandono del proceso\n');
  
  console.log('🚀 ¡Listo! Una vez actualices la URL en Wompi, tu sistema funcionará automáticamente.');
  
  rl.close();
});