#!/usr/bin/env node

/**
 * Script para probar el webhook de Wompi y verificar que esté funcionando correctamente
 */

import crypto from 'crypto';
import axios from 'axios';

// Configuración
const WEBHOOK_URL = 'https://11fb-2803-960-e100-2e01-e107-d108-347b-b41a.ngrok-free.app/pagos/wompi-webhook';
const WOMPI_EVENT_SECRET = 'test_events_PfCNpPjtHpVNAfxvZIUXspOtXzcNZZNl';

// Datos de prueba
const testPayload = {
  type: 'transaction.updated',
  data: {
    id: 'test-12345-' + Date.now(),
    status: 'APPROVED',
    reference: 'test-ref-' + Date.now(),
    amount_in_cents: 10000,
    customer_data: {
      legal_id: '12345678',
      full_name: 'Test User'
    },
    created_at: new Date().toISOString()
  }
};

// Generar firma HMAC-SHA256
const payloadString = JSON.stringify(testPayload);
const signature = crypto
  .createHmac('sha256', WOMPI_EVENT_SECRET)
  .update(payloadString)
  .digest('hex');

console.log('🧪 PRUEBA DEL WEBHOOK DE WOMPI');
console.log('==============================\n');

console.log('📡 Enviando solicitud de prueba al webhook...\n');
console.log('URL:', WEBHOOK_URL);
console.log('Método: POST');
console.log('Content-Type: application/json');
console.log('x-wompi-signature:', signature);
console.log('\nPayload:', payloadString);
console.log('\n' + '='.repeat(50) + '\n');

// Enviar solicitud de prueba
axios.post(WEBHOOK_URL, testPayload, {
  headers: {
    'Content-Type': 'application/json',
    'x-wompi-signature': signature
  }
})
.then(response => {
  console.log('✅ RESPUESTA DEL WEBHOOK:');
  console.log('Status:', response.status);
  console.log('Data:', response.data);
  console.log('\n🎉 ¡El webhook está funcionando correctamente!');
  console.log('Los pagos se registrarán automáticamente cuando Wompi los apruebe.');
})
.catch(error => {
  console.log('❌ ERROR EN EL WEBHOOK:');
  if (error.response) {
    console.log('Status:', error.response.status);
    console.log('Data:', error.response.data);
  } else if (error.request) {
    console.log('No se recibió respuesta del servidor');
    console.log('Verifica que tu servidor esté escuchando en el puerto 8000');
    console.log('Verifica que ngrok esté activo y la URL sea correcta');
  } else {
    console.log('Error:', error.message);
  }
  
  console.log('\n🔍 PASOS PARA SOLUCIONAR EL PROBLEMA:');
  console.log('1. Verifica que tu servidor Node.js esté en ejecución');
  console.log('2. Verifica que ngrok esté activo y mostrando tráfico');
  console.log('3. Verifica que la URL del webhook en Wompi sea correcta');
  console.log('4. Revisa los logs de tu servidor para ver si llegan las solicitudes');
  console.log('5. Asegúrate de que el secreto de eventos coincida exactamente');
});

console.log('\n⏳ Esperando respuesta del webhook...\n');