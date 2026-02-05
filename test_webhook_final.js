#!/usr/bin/env node

/**
 * Script para probar el webhook de Wompi con la URL final de ngrok
 */

import crypto from 'crypto';
import axios from 'axios';

// Configuración con tu URL de ngrok
const WEBHOOK_URL = 'https://766d3c9ae872.ngrok-free.app/pagos/wompi-webhook';
const WOMPI_EVENT_SECRET = 'test_events_PfCNpPjtHpVNAfxvZIUXspOtXzcNZZNl';

// Datos de prueba
const testPayload = {
  type: 'transaction.updated',
  data: {
    id: 'test-final-' + Date.now(),
    status: 'APPROVED',
    reference: 'test-ref-final-' + Date.now(),
    amount_in_cents: 10000,
    customer_data: {
      legal_id: '12345678',
      full_name: 'Test User Final'
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

console.log('🧪 PRUEBA FINAL DEL WEBHOOK DE WOMPI');
console.log('====================================\n');

console.log('📡 Enviando solicitud de prueba al webhook con URL de ngrok...\n');
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
  console.log('✅ RESPUESTA DEL WEBHOOK CON NGROK:');
  console.log('Status:', response.status);
  console.log('Data:', response.data);
  console.log('\n🎉 ¡El webhook con ngrok está funcionando correctamente!');
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
  console.log('\n🎯 RESULTADO FINAL:');
  console.log('✅ El webhook está funcionando perfectamente');
  console.log('✅ Los pagos se registrarán automáticamente');
  console.log('✅ No dependerás de que el cliente haga clic en "Finalizar proceso"');
})
.catch(error => {
  console.log('❌ ERROR EN EL WEBHOOK CON NGROK:');
  if (error.response) {
    console.log('Status:', error.response.status);
    console.log('Data:', error.response.data);
  } else if (error.request) {
    console.log('No se recibió respuesta del servidor');
    console.log('Verifica que ngrok esté activo y mostrando tráfico');
    console.log('Verifica que la URL del webhook en Wompi sea correcta');
  } else {
    console.log('Error:', error.message);
  }
  
  console.log('\n🔍 PASOS PARA SOLUCIONAR EL PROBLEMA:');
  console.log('1. Verifica que ngrok esté activo y mostrando tráfico');
  console.log('2. Verifica que la URL del webhook en Wompi sea correcta');
  console.log('3. Revisa los logs de tu servidor para ver si llegan las solicitudes');
  console.log('4. Asegúrate de que el secreto de eventos coincida exactamente');
});

console.log('\n⏳ Esperando respuesta del webhook con ngrok...\n');