#!/usr/bin/env node

/**
 * Script para configurar el webhook de Wompi automáticamente
 * o proporcionar las instrucciones exactas para hacerlo manualmente
 */

import axios from 'axios';

// Configuración
const WOMPI_PUBLIC_KEY = 'pub_test_uQxOPFVJOt6iPjd9Dt3302Wd7PeKb8Jd';
const WOMPI_PRIVATE_KEY = 'prv_test_ME5OhWtglvDF2AKWZzpwIGs91LTFuBCA';
const WOMPI_EVENT_SECRET = 'test_events_PfCNpPjtHpVNAfxvZIUXspOtXzcNZZNl';

// URLs de webhook (ajusta según tu entorno)
const WEBHOOK_URL_DESARROLLO = 'https://11fb-2803-960-e100-2e01-e107-d108-347b-b41a.ngrok-free.app/api/payments/wompi-webhook';
const WEBHOOK_URL_PRODUCCION = 'https://api.portal.betsupplier.co/api/payments/wompi-webhook';

console.log('🔧 Configuración del Webhook de Wompi');
console.log('=====================================\n');

console.log('Para que los pagos se registren automáticamente en tu base de datos');
console.log('sin que el cliente tenga que hacer clic en "Finalizar proceso",');
console.log('debes configurar el webhook en tu cuenta de Wompi.\n');

console.log('📋 PASOS PARA CONFIGURAR EL WEBHOOK:\n');

console.log('1. INICIA SESIÓN EN TU CUENTA DE WOMPI');
console.log('   URL: https://dashboard.wompi.co\n');

console.log('2. VE A LA SECCIÓN DE "EVENTOS" O "WEBHOOKS"');
console.log('   Normalmente está en el menú lateral o en Configuración.\n');

console.log('3. AGREGA UN NUEVO WEBHOOK CON ESTA INFORMACIÓN:\n');

console.log('   🔗 URL del Webhook:');
console.log('   - Desarrollo (con ngrok):', WEBHOOK_URL_DESARROLLO);
console.log('   - Producción:', WEBHOOK_URL_PRODUCCION);
console.log('   \n   ⚠️  IMPORTANTE: Elige la URL según tu entorno\n');

console.log('   📋 Eventos a recibir:');
console.log('   - Selecciona: transaction.updated');
console.log('   - (Este evento se dispara cuando Wompi cambia el estado de una transacción)\n');

console.log('   🔐 Secreto de Eventos (para validación):');
console.log('   - Copia este valor y guárdalo en tu cuenta de Wompi:');
console.log('   -', WOMPI_EVENT_SECRET);
console.log('   \n   ⚠️  Este secreto es diferente del secreto de integridad\n');

console.log('4. GUARDA LA CONFIGURACIÓN\n');

console.log('✅ ¿CÓMO SABRÁS QUE FUNCIONA?\n');

console.log('   Después de configurar el webhook:');
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

console.log('   1. Si usas ngrok para desarrollo, asegúrate de que esté activo');
console.log('   2. El webhook es público y no requiere autenticación del usuario');
console.log('   3. La validación de la firma es crucial para evitar registros falsos');
console.log('   4. Los pagos procesados por webhook tendrán el flag "webhook_procesado: true"\n');

console.log('🎯 RESULTADO ESPERADO:\n');

console.log('   Con el webhook configurado:');
console.log('   - Los pagos se registrarán automáticamente en el momento que Wompi los apruebe');
console.log('   - No dependerás de que el cliente haga clic en "Finalizar proceso"');
console.log('   - Tendrás una experiencia de usuario mucho más fluida');
console.log('   - Eliminarás la posibilidad de perder pagos por abandono del proceso\n');

console.log('¿NECESITAS AYUDA?\n');

console.log('   Si tienes problemas para configurar el webhook:');
console.log('   1. Verifica que la URL del webhook sea accesible desde internet');
console.log('   2. Asegúrate de que tu servidor esté escuchando en el puerto correcto (8000)');
console.log('   3. Revisa los logs de tu servidor para ver si llegan las solicitudes');
console.log('   4. Confirma que el secreto de eventos coincida exactamente\n');

console.log('🚀 ¡Listo! Una vez configures el webhook, tu sistema funcionará automáticamente.');