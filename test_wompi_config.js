#!/usr/bin/env node

/**
 * Script para probar el endpoint de configuración de Wompi
 */

import axios from 'axios';

console.log('🧪 PRUEBA DEL ENDPOINT DE CONFIGURACIÓN DE WOMPI');
console.log('===============================================\n');

const API_URL = 'http://localhost:8000/wompi/config';

console.log('📡 Enviando solicitud al endpoint de configuración...\n');
console.log('URL:', API_URL);
console.log('Método: GET');
console.log('Headers: Content-Type: application/json');
console.log('\n' + '='.repeat(50) + '\n');

// Enviar solicitud de prueba
axios.get(API_URL)
.then(response => {
  console.log('✅ RESPUESTA DEL ENDPOINT:');
  console.log('Status:', response.status);
  console.log('Data:', response.data);
  
  if (response.data.publicKey) {
    console.log('\n🔍 DATOS DE CONFIGURACIÓN:');
    console.log('=========================');
    console.log('Clave Pública:', response.data.publicKey);
    console.log('Formato:', response.data.publicKey.startsWith('pub_') ? '✅ Correcto' : '❌ Incorrecto');
    
    if (response.data.publicKey === 'pub_test_uQxOPFVJOt6iPjd9Dt3302Wd7PeKb8Jd') {
      console.log('✅ Clave pública correcta (sandbox)');
    } else {
      console.log('⚠️ Clave pública diferente a la esperada');
    }
  }
  
  console.log('\n🎉 ¡El endpoint de configuración está funcionando correctamente!');
  console.log('El frontend ahora puede obtener la clave pública desde el backend.');
})
.catch(error => {
  console.log('❌ ERROR EN EL ENDPOINT:');
  
  if (error.response) {
    console.log('Status:', error.response.status);
    console.log('Data:', error.response.data);
  } else if (error.request) {
    console.log('No se recibió respuesta del servidor');
    console.log('Verifica que tu servidor Node.js esté en ejecución en el puerto 8000');
  } else {
    console.log('Error:', error.message);
  }
  
  console.log('\n🔍 PASOS PARA SOLUCIONAR EL PROBLEMA:');
  console.log('1. Verifica que tu servidor Node.js esté en ejecución en el puerto 8000');
  console.log('2. Verifica que el endpoint /wompi/config esté correctamente implementado');
  console.log('3. Verifica que la variable de entorno WOMPI_PUBLIC esté configurada');
});

console.log('\n⏳ Enviando solicitud al endpoint de configuración...\n');