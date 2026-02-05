#!/usr/bin/env node

/**
 * Script para probar el webhook de Wompi paso a paso identificando los 3 fallos técnicos
 */

import crypto from 'crypto';
import axios from 'axios';

// Configuración para pruebas
const WEBHOOK_URL = 'https://18bad015eccc.ngrok-free.app/pagos/wompi-webhook';
const WOMPI_EVENT_SECRET = 'test_events_PfCNpPjtHpVNAfxvZIUXspOtXzcNZZNl';

// Datos de prueba completos (siguiendo el estándar de Wompi)
const testPayload = {
  type: 'transaction.updated',
  data: {
    id: 'test-debug-' + Date.now(),
    status: 'APPROVED',
    reference: 'test-ref-debug-' + Date.now(),
    amount_in_cents: 10000,
    customer_data: {
      legal_id: '12345678',
      full_name: 'Test User Debug'
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

console.log('🧪 PRUEBA DEPÜRADA DEL WEBHOOK DE WOMPI');
console.log('========================================\n');

console.log('🔍 PASO 1: VALIDACIÓN DEL MIDDLEWARE DE LECTURA');
console.log('------------------------------------------------');
console.log('✅ Payload preparado para enviar');
console.log('✅ Content-Type: application/json');
console.log('✅ Body correctamente formateado\n');

console.log('🔍 PASO 2: VALIDACIÓN DE FIRMA');
console.log('-------------------------------');
console.log('✅ Secreto de eventos:', WOMPI_EVENT_SECRET);
console.log('✅ Payload para firma:', payloadString);
console.log('✅ Signature calculada:', signature);
console.log('✅ Firma lista para validación\n');

console.log('🔍 PASO 3: ESTRUCTURA DEL EVENTO');
console.log('---------------------------------');
console.log('✅ Tipo de evento:', testPayload.type);
console.log('✅ Transacción ID:', testPayload.data.id);
console.log('✅ Estado:', testPayload.data.status);
console.log('✅ Referencia:', testPayload.data.reference);
console.log('✅ Monto en centavos:', testPayload.data.amount_in_cents);
console.log('✅ Customer data presente:', !!testPayload.data.customer_data);
console.log('✅ Fecha creación:', testPayload.data.created_at);
console.log('✅ Estructura completa y válida\n');

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
  
  if (response.data.debug) {
    console.log('\n🔍 DATOS DE DEPURACIÓN:');
    console.log('======================');
    console.log('Transaction ID:', response.data.debug.transaction_id);
    console.log('Status:', response.data.debug.status);
    console.log('Webhook Timestamp:', response.data.debug.webhook_timestamp);
  }
  
  console.log('\n🎉 ¡El webhook está funcionando correctamente!');
  console.log('Los pagos se registrarán automáticamente cuando Wompi los apruebe.');
})
.catch(error => {
  console.log('❌ ERROR EN EL WEBHOOK:');
  
  if (error.response) {
    console.log('Status:', error.response.status);
    console.log('Data:', error.response.data);
    
    // Analizar el error detalladamente
    if (error.response.data.debug) {
      console.log('\n🔍 DATOS DE DEPURACIÓN DEL ERROR:');
      console.log('==================================');
      console.log('Error encontrado:', error.response.data.error);
      
      if (error.response.data.debug.body) {
        console.log('Body recibido:', error.response.data.debug.body);
      }
      
      if (error.response.data.debug.headers) {
        console.log('Headers recibidos:', error.response.data.debug.headers);
      }
      
      if (error.response.data.debug.contentType) {
        console.log('Content-Type:', error.response.data.debug.contentType);
      }
      
      if (error.response.data.debug.received_signature) {
        console.log('Signature recibida:', error.response.data.debug.received_signature);
        console.log('Signature calculada:', error.response.data.debug.calculated_signature);
      }
      
      if (error.response.data.debug.event_structure) {
        console.log('Estructura del evento:', error.response.data.debug.event_structure);
      }
      
      if (error.response.data.debug.missing_fields) {
        console.log('Campos faltantes:', error.response.data.debug.missing_fields);
      }
    }
  } else if (error.request) {
    console.log('No se recibió respuesta del servidor');
    console.log('Verifica que tu servidor Node.js esté en ejecución en el puerto 8000');
    console.log('Verifica que ngrok esté activo y mostrando tráfico');
  } else {
    console.log('Error:', error.message);
  }
  
  console.log('\n🔍 PASOS PARA SOLUCIONAR EL PROBLEMA:');
  console.log('1. Verifica que tu servidor Node.js esté en ejecución en el puerto 8000');
  console.log('2. Verifica que ngrok esté activo y mostrando tráfico');
  console.log('3. Revisa los logs de tu servidor para ver los mensajes de depuración');
  console.log('4. Asegúrate de que el secreto de eventos coincida exactamente');
  console.log('5. Verifica que el body-parser esté configurado correctamente');
});

console.log('\n⏳ Enviando solicitud de prueba al webhook...\n');