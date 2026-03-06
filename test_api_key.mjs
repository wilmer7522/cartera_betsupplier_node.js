#!/usr/bin/env node

/**
 * Script para probar la creación de API Key directamente
 */

import axios from 'axios';

const BASE_URL = 'https://portal.betsupplier.co';
const API_URL = `${BASE_URL}/api/v1`;

async function probarApiKey() {
  console.log('🧪 Probando creación de API Key...\n');

  const jwtToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb3JyZW8iOiJ3aWxtZXI3NTIyQGdtYWlsLmNvbSIsInJvbCI6ImFkbWluIiwiZXhwIjoxNzcyODI0MzM3LCJpYXQiOjE3NzI4MjI1Mzd9.uNa0nS25COmgaBFTNlMGbP5Ubzxd6SSIPFuIVonj574";
  const nombreApp = "Plataforma Externa";
  const permisos = [
    "clientes:read",
    "clientes:write", 
    "clientes:update",
    "clientes:delete",
    "vendedores:read",
    "vendedores:write",
    "vendedores:update",
    "vendedores:delete",
    "pagos:read",
    "cartera:read",
    "admin:estadisticas"
  ];
  const limite = 2000;

  try {
    console.log('📡 Enviando solicitud al servidor...');
    console.log(`URL: ${API_URL}/auth/crear-key`);
    console.log(`JWT Token: ${jwtToken.substring(0, 20)}...`);
    console.log(`Aplicación: ${nombreApp}`);
    console.log(`Permisos: ${permisos.join(', ')}`);
    console.log(`Límite: ${limite}\n`);

    const response = await axios.post(`${API_URL}/auth/crear-key`, {
      nombre_app: nombreApp,
      permisos: permisos,
      limite_requests: limite
    }, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 segundos de timeout
    });

    console.log('✅ Respuesta del servidor:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.success) {
      const apiKey = response.data.data;
      console.log('\n🎉 ¡API Key creada exitosamente!');
      console.log('================================');
      console.log(`🔑 API Key: ${apiKey.key}`);
      console.log(`📝 Aplicación: ${apiKey.nombre_app}`);
      console.log(`🔑 Permisos: ${apiKey.permisos.join(', ')}`);
      console.log(`📊 Límite: ${apiKey.limite_requests} requests/hora`);
      console.log(`📅 Creada: ${new Date(apiKey.fecha_creacion).toLocaleString()}`);
      
      console.log('\n💡 Para usar esta API Key:');
      console.log('==========================');
      console.log(`Header: X-API-Key: ${apiKey.key}`);
      console.log('');
      console.log('Ejemplo de solicitud:');
      console.log(`curl -H "X-API-Key: ${apiKey.key}" \\`);
      console.log(`     ${API_URL}/clientes`);
    }

  } catch (error) {
    console.log('❌ Error en la solicitud:');
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Status Text: ${error.response.statusText}`);
      console.log(`   URL: ${error.config?.url}`);
      console.log(`   Method: ${error.config?.method}`);
      
      if (error.response.data) {
        console.log('   Response Data:');
        console.log(JSON.stringify(error.response.data, null, 2));
      }
    } else if (error.request) {
      console.log('   No response received');
      console.log('   Request made but no response');
    } else {
      console.log(`   Error Message: ${error.message}`);
    }
  }
}

probarApiKey();