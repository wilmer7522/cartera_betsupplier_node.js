#!/usr/bin/env node

/**
 * Script para generar una API Key para uso externo
 * 
 * Este script te permite crear una API Key para que aplicaciones externas
 * puedan acceder a tu sistema de cartera.
 * 
 * Uso:
 * node generar_api_key.js
 * 
 * O con parámetros:
 * node generar_api_key.js --nombre "Mi Aplicación" --permisos "clientes:read,clientes:write,vendedores:read" --limite 2000
 */

const axios = require('axios');
const readline = require('readline');
const process = require('process');

// Configuración
const BASE_URL = 'https://portal.betsupplier.co';
const API_URL = `${BASE_URL}/api/v1`;

// Interfaz de línea de comandos
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function pregunta(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

async function main() {
  console.log('🔑 Generador de API Keys para Cartera Betsupplier');
  console.log('================================================\n');

  try {
    // Obtener parámetros de línea de comandos
    const args = process.argv.slice(2);
    const params = {};
    
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--nombre' && args[i + 1]) {
        params.nombre = args[i + 1];
        i++;
      } else if (args[i] === '--permisos' && args[i + 1]) {
        params.permisos = args[i + 1].split(',').map(p => p.trim());
        i++;
      } else if (args[i] === '--limite' && args[i + 1]) {
        params.limite = parseInt(args[i + 1]);
        i++;
      }
    }

    // Si no hay parámetros, pedirlos interactivamente
    if (Object.keys(params).length === 0) {
      console.log('Por favor, proporciona la información para crear la API Key:\n');

      // Obtener JWT Token del administrador
      const jwtToken = await pregunta('🔐 Ingresa tu JWT Token de administrador: ');
      if (!jwtToken) {
        console.log('❌ Se requiere un JWT Token de administrador');
        process.exit(1);
      }

      // Nombre de la aplicación
      const nombreApp = await pregunta('📝 Nombre de la aplicación (ej: Mi Sistema Externo): ');
      if (!nombreApp) {
        console.log('❌ Se requiere un nombre para la aplicación');
        process.exit(1);
      }

      // Permisos
      console.log('\n📋 Permisos disponibles:');
      console.log('- clientes:read     (Lectura de clientes)');
      console.log('- clientes:write    (Creación de clientes)');
      console.log('- clientes:update   (Actualización de clientes)');
      console.log('- clientes:delete   (Eliminación de clientes)');
      console.log('- vendedores:read   (Lectura de vendedores)');
      console.log('- vendedores:write  (Creación de vendedores)');
      console.log('- vendedores:update (Actualización de vendedores)');
      console.log('- vendedores:delete (Eliminación de vendedores)');
      console.log('- pagos:read        (Lectura de pagos)');
      console.log('- pagos:write       (Creación de pagos)');
      console.log('- cartera:read      (Lectura de cartera)');
      console.log('- admin:estadisticas (Acceso a estadísticas)');
      console.log('- admin:api_keys    (Gestión de API Keys)');
      console.log('- admin:full        (Acceso administrativo completo)\n');

      const permisosInput = await pregunta('🔑 Permisos (separados por comas, ej: clientes:read,clientes:write): ');
      const permisos = permisosInput.split(',').map(p => p.trim()).filter(p => p);

      if (permisos.length === 0) {
        console.log('❌ Se requiere al menos un permiso');
        process.exit(1);
      }

      // Límite de requests
      const limiteInput = await pregunta('📊 Límite de requests por hora (default: 1000): ');
      const limite = limiteInput ? parseInt(limiteInput) : 1000;

      params.jwtToken = jwtToken;
      params.nombre = nombreApp;
      params.permisos = permisos;
      params.limite = limite;

    } else {
      // Si hay parámetros, pedir el JWT Token
      const jwtToken = await pregunta('🔐 Ingresa tu JWT Token de administrador: ');
      if (!jwtToken) {
        console.log('❌ Se requiere un JWT Token de administrador');
        process.exit(1);
      }
      params.jwtToken = jwtToken;
    }

    // Crear la API Key
    console.log('\n🚀 Creando API Key...\n');

    const response = await axios.post(`${API_URL}/auth/crear-key`, {
      nombre_app: params.nombre,
      permisos: params.permisos,
      limite_requests: params.limite
    }, {
      headers: {
        'Authorization': `Bearer ${params.jwtToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      const apiKey = response.data.data;
      
      console.log('✅ API Key creada exitosamente!\n');
      console.log('📋 Información de la API Key:');
      console.log('================================');
      console.log(`🔑 API Key: ${apiKey.key}`);
      console.log(`📝 Aplicación: ${apiKey.nombre_app}`);
      console.log(`🔑 Permisos: ${apiKey.permisos.join(', ')}`);
      console.log(`📊 Límite: ${apiKey.limite_requests} requests/hora`);
      console.log(`📅 Creada: ${new Date(apiKey.fecha_creacion).toLocaleString()}`);
      console.log('');

      console.log('💡 Para usar esta API Key en tus solicitudes:');
      console.log('=============================================');
      console.log(`Header: X-API-Key: ${apiKey.key}`);
      console.log('');
      console.log('Ejemplo de solicitud:');
      console.log(`curl -H "X-API-Key: ${apiKey.key}" \\`);
      console.log('     https://portal.betsupplier.co/api/v1/clientes');
      console.log('');

      console.log('⚠️  IMPORTANTE:');
      console.log('===============');
      console.log('• Guarda esta API Key en un lugar seguro');
      console.log('• No compartas esta API Key');
      console.log('• Puedes desactivarla en cualquier momento desde el panel de administración');
      console.log('• Monitorea su uso a través de los endpoints de estadísticas');

    } else {
      console.log('❌ Error al crear la API Key:', response.data.message);
    }

  } catch (error) {
    if (error.response) {
      console.log('❌ Error del servidor:');
      console.log('Status:', error.response.status);
      console.log('Mensaje:', error.response.data.message || error.response.statusText);
    } else if (error.request) {
      console.log('❌ Error de red: No se pudo conectar al servidor');
      console.log('Verifica que el servidor esté en funcionamiento');
    } else {
      console.log('❌ Error inesperado:', error.message);
    }
  } finally {
    rl.close();
  }
}

// Mostrar ayuda si se usa --help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('🔑 Generador de API Keys para Cartera Betsupplier');
  console.log('');
  console.log('Uso: node generar_api_key.js [opciones]');
  console.log('');
  console.log('Opciones:');
  console.log('  --nombre <nombre>     Nombre de la aplicación');
  console.log('  --permisos <lista>    Permisos separados por comas');
  console.log('  --limite <número>     Límite de requests por hora (default: 1000)');
  console.log('  --help, -h           Mostrar esta ayuda');
  console.log('');
  console.log('Ejemplo:');
  console.log('  node generar_api_key.js --nombre "Mi App" --permisos "clientes:read,clientes:write" --limite 2000');
  console.log('');
  console.log('Nota: Deberás proporcionar tu JWT Token de administrador para crear la API Key.');
  process.exit(0);
}

// Ejecutar el script
main();