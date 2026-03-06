#!/usr/bin/env node

/**
 * Script rápido para crear una API Key
 * 
 * Uso: node crear_api_key.js [JWT_TOKEN] [NOMBRE_APP] [PERMISOS]
 * 
 * Ejemplo: node crear_api_key.js "tu_jwt_token" "Mi App" "clientes:read,clientes:write"
 */

const axios = require('axios');

const BASE_URL = 'https://portal.betsupplier.co';
const API_URL = `${BASE_URL}/api/v1`;

async function crearApiKey() {
  console.log('🔑 Creando API Key para uso externo...\n');

  // Obtener parámetros de línea de comandos
  const args = process.argv.slice(2);
  const jwtToken = args[0];
  const nombreApp = args[1] || 'Aplicación Externa';
  const permisosInput = args[2] || 'clientes:read,vendedores:read';
  const limite = args[3] ? parseInt(args[3]) : 1000;

  // Si no hay JWT Token, mostrar instrucciones
  if (!jwtToken) {
    console.log('❌ ERROR: Se requiere un JWT Token de administrador');
    console.log('');
    console.log('Uso:');
    console.log('  node crear_api_key.js [JWT_TOKEN] [NOMBRE_APP] [PERMISOS] [LIMITE]');
    console.log('');
    console.log('Ejemplo:');
    console.log('  node crear_api_key.js "tu_jwt_token_aqui" "Mi Sistema" "clientes:read,clientes:write" 2000');
    console.log('');
    console.log('Para obtener tu JWT Token:');
    console.log('1. Inicia sesión en el panel de administración');
    console.log('2. Abre las herramientas de desarrollo del navegador (F12)');
    console.log('3. Ve a la pestaña "Application" o "Almacenamiento"');
    console.log('4. Busca "token" en Local Storage');
    console.log('5. Copia el valor del token');
    process.exit(1);
  }

  try {
    console.log('📝 Datos de la API Key:');
    console.log(`   Aplicación: ${nombreApp}`);
    console.log(`   Permisos: ${permisosInput}`);
    console.log(`   Límite: ${limite} requests/hora`);
    console.log('');

    const permisos = permisosInput.split(',').map(p => p.trim());

    const response = await axios.post(`${API_URL}/auth/crear-key`, {
      nombre_app: nombreApp,
      permisos: permisos,
      limite_requests: limite
    }, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      const apiKey = response.data.data;
      
      console.log('✅ ¡API Key creada exitosamente!\n');
      console.log('📋 Detalles de la API Key:');
      console.log('=========================');
      console.log(`🔑 API Key: ${apiKey.key}`);
      console.log(`📝 Aplicación: ${apiKey.nombre_app}`);
      console.log(`🔑 Permisos: ${apiKey.permisos.join(', ')}`);
      console.log(`📊 Límite: ${apiKey.limite_requests} requests/hora`);
      console.log(`📅 Creada: ${new Date(apiKey.fecha_creacion).toLocaleString()}`);
      console.log('');

      console.log('💡 Cómo usar esta API Key:');
      console.log('==========================');
      console.log('Header en tus solicitudes:');
      console.log(`X-API-Key: ${apiKey.key}`);
      console.log('');
      console.log('Ejemplo con curl:');
      console.log(`curl -H "X-API-Key: ${apiKey.key}" \\`);
      console.log(`     ${API_URL}/clientes`);
      console.log('');

      console.log('⚠️  Recomendaciones:');
      console.log('====================');
      console.log('• Guarda esta API Key en un lugar seguro');
      console.log('• No la compartas ni la expongas en código público');
      console.log('• Monitorea su uso regularmente');
      console.log('• Puedes desactivarla desde el panel de administración si es necesario');

    } else {
      console.log('❌ Error al crear la API Key:', response.data.message);
    }

  } catch (error) {
    if (error.response) {
      console.log('❌ Error del servidor:');
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Mensaje: ${error.response.data.message || error.response.statusText}`);
      
      if (error.response.status === 401) {
        console.log('');
        console.log('💡 Posibles causas:');
        console.log('   • El JWT Token ha expirado');
        console.log('   • El JWT Token no es válido');
        console.log('   • No tienes permisos de administrador');
        console.log('   • Inicia sesión nuevamente y obtén un nuevo token');
      }
    } else if (error.request) {
      console.log('❌ Error de conexión:');
      console.log('   No se pudo conectar al servidor');
      console.log('   Verifica que el servidor esté en funcionamiento');
      console.log(`   URL: ${API_URL}`);
    } else {
      console.log('❌ Error inesperado:', error.message);
    }
  }
}

// Ejecutar el script
crearApiKey();