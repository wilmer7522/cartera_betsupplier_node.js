#!/usr/bin/env node

/**
 * Script para probar el webhook de Wompi directamente en el entorno local
 * sin depender de ngrok
 */

import crypto from 'crypto';
import axios from 'axios';

// Configuración para pruebas locales
const WEBHOOK_URL = 'http://localhost:8000/pagos/wompi-webhook';
const WOMPI_EVENT_SECRET = 'test_events_PfCNpPjtHpVNAfxvZIUXspOtXzcNZZNl';

// Datos de prueba
const testPayload = {
  type: 'transaction.updated',
  data: {
    id: 'test-local-' + Date.now(),
    status: 'APPROVED',
    reference: 'test-ref-local-' + Date.now(),
    amount_in_cents: 10000,
    customer_data: {
      legal_id: '12345678',
      full_name: 'Test User Local'
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

console.log('🧪 PRUEBA LOCAL DEL WEBHOOK DE WOMPI');
console.log('====================================\n');

console.log('📡 Enviando solicitud de prueba al webhook local...\n');
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
  console.log('✅ RESPUESTA DEL WEBHOOK LOCAL:');
  console.log('Status:', response.status);
  console.log('Data:', response.data);
  console.log('\n🎉 ¡El webhook local está funcionando correctamente!');
  console.log('Los pagos se registrarán automáticamente cuando Wompi los apruebe.');
  
  // Verificar que el pago se haya registrado
  console.log('\n🔍 Verificando que el pago se haya registrado...');
  return axios.get(`http://localhost:8000/pagos/estado/${testPayload.data.id}`);
})
.then(response => {
  console.log('✅ VERIFICACIÓN DEL PAGO:');
  console.log('Status:', response.data.status);
  console.log('Pago:', response.data.pago);
  console.log('\n🎉 ¡El pago se registró correctamente en la base de datos!');
})
.catch(error => {
  console.log('❌ ERROR EN EL WEBHOOK LOCAL:');
  if (error.response) {
    console.log('Status:', error.response.status);
    console.log('Data:', error.response.data);
  } else if (error.request) {
    console.log('No se recibió respuesta del servidor');
    console.log('Verifica que tu servidor Node.js esté en ejecución en el puerto 8000');
    console.log('Comando para iniciar el servidor: cd cartera_betsupplier_node.js && npm start');
  } else {
    console.log('Error:', error.message);
  }
  
  console.log('\n🔍 PASOS PARA SOLUCIONAR EL PROBLEMA:');
  console.log('1. Verifica que tu servidor Node.js esté en ejecución en el puerto 8000');
  console.log('2. Comando para iniciar el servidor: cd cartera_betsupplier_node.js && npm start');
  console.log('3. Verifica que el secreto de eventos coincida exactamente');
  console.log('4. Revisa los logs de tu servidor para ver si llegan las solicitudes');
});

console.log('\n⏳ Esperando respuesta del webhook local...\n');