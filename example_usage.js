// Ejemplo de uso de la API Externa Cartera Betsupplier
// Este script muestra cómo integrarse con la API desde una aplicación externa

const axios = require('axios');

// Configuración básica
const BASE_URL = 'https://portal.betsupplier.co/api/v1';
const API_KEY = 'tu_api_key_aqui'; // Reemplaza con tu API Key real

// Configuración de axios con headers comunes
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  }
});

// Manejador de errores
api.interceptors.response.use(
  response => response,
  error => {
    console.error('❌ Error en la solicitud:', {
      status: error.response?.status,
      message: error.response?.data?.message,
      data: error.response?.data
    });
    return Promise.reject(error);
  }
);

// === FUNCIONES DE EJEMPLO ===

// 1. Validar API Key
async function validarApiKey() {
  console.log('🔍 Validando API Key...');
  try {
    const response = await api.get('/auth/validar-key');
    console.log('✅ API Key válida:', response.data.data);
    return response.data.data;
  } catch (error) {
    console.error('❌ API Key inválida o expirada');
    throw error;
  }
}

// 2. Listar clientes con paginación
async function listarClientes(page = 1, limit = 10) {
  console.log(`📋 Listando clientes (página ${page})...`);
  try {
    const response = await api.get('/clientes', {
      params: { page, limit }
    });
    console.log(`✅ Clientes encontrados: ${response.data.data.total}`);
    console.log('Primeros 3 clientes:', response.data.data.clientes.slice(0, 3));
    return response.data.data;
  } catch (error) {
    console.error('❌ Error listando clientes');
    throw error;
  }
}

// 3. Buscar cliente por NIT
async function buscarClientePorNit(nit) {
  console.log(`🔍 Buscando cliente con NIT: ${nit}...`);
  try {
    const response = await api.get(`/clientes/${nit}`);
    console.log('✅ Cliente encontrado:', response.data.data);
    return response.data.data;
  } catch (error) {
    console.error(`❌ Cliente con NIT ${nit} no encontrado`);
    throw error;
  }
}

// 4. Crear nuevo cliente
async function crearCliente(clienteData) {
  console.log('➕ Creando nuevo cliente...');
  try {
    const response = await api.post('/clientes', clienteData);
    console.log('✅ Cliente creado exitosamente:', response.data.data);
    return response.data.data;
  } catch (error) {
    console.error('❌ Error creando cliente');
    throw error;
  }
}

// 5. Actualizar cliente
async function actualizarCliente(nit, updateData) {
  console.log(`📝 Actualizando cliente ${nit}...`);
  try {
    const response = await api.put(`/clientes/${nit}`, updateData);
    console.log('✅ Cliente actualizado:', response.data.data);
    return response.data.data;
  } catch (error) {
    console.error('❌ Error actualizando cliente');
    throw error;
  }
}

// 6. Consultar cartera de cliente
async function consultarCartera(nit) {
  console.log(`💰 Consultando cartera del cliente ${nit}...`);
  try {
    const response = await api.get(`/clientes/${nit}/cartera`);
    console.log('✅ Cartera consultada:', response.data.data);
    return response.data.data;
  } catch (error) {
    console.error('❌ Error consultando cartera');
    throw error;
  }
}

// 7. Consultar pagos de cliente
async function consultarPagos(nit) {
  console.log(`💳 Consultando pagos del cliente ${nit}...`);
  try {
    const response = await api.get(`/clientes/${nit}/pagos`);
    console.log(`✅ Pagos encontrados: ${response.data.data.total_pagos}`);
    console.log('Detalles de pagos:', response.data.data.pagos);
    return response.data.data;
  } catch (error) {
    console.error('❌ Error consultando pagos');
    throw error;
  }
}

// 8. Listar vendedores
async function listarVendedores() {
  console.log('👥 Listando vendedores...');
  try {
    const response = await api.get('/vendedores');
    console.log(`✅ Vendedores encontrados: ${response.data.data.length}`);
    console.log('Vendedores:', response.data.data.map(v => ({ id: v._id, nombre: v.nombre, correo: v.correo })));
    return response.data.data;
  } catch (error) {
    console.error('❌ Error listando vendedores');
    throw error;
  }
}

// 9. Consultar clientes de un vendedor
async function consultarClientesDeVendedor(vendedorId) {
  console.log(`👥 Consultando clientes del vendedor ${vendedorId}...`);
  try {
    const response = await api.get(`/vendedores/${vendedorId}/clientes`);
    console.log(`✅ Clientes encontrados: ${response.data.data.total_clientes}`);
    console.log('Clientes del vendedor:', response.data.data.clientes);
    return response.data.data;
  } catch (error) {
    console.error('❌ Error consultando clientes del vendedor');
    throw error;
  }
}

// 10. Obtener estadísticas (requiere permisos admin)
async function obtenerEstadisticas() {
  console.log('📊 Obteniendo estadísticas generales...');
  try {
    const response = await api.get('/admin/estadisticas');
    console.log('✅ Estadísticas obtenidas:', response.data.data);
    return response.data.data;
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas (verifica permisos admin)');
    throw error;
  }
}

// 11. Endpoint de prueba
async function endpointDePrueba() {
  console.log('🧪 Probando endpoint de prueba...');
  try {
    const response = await api.get('/test');
    console.log('✅ Prueba exitosa:', response.data.data);
    return response.data.data;
  } catch (error) {
    console.error('❌ Error en endpoint de prueba');
    throw error;
  }
}

// === FLUJO DE EJEMPLO COMPLETO ===
async function flujoEjemploCompleto() {
  console.log('🚀 Iniciando flujo de ejemplo completo...\n');

  try {
    // 1. Validar API Key
    await validarApiKey();

    // 2. Probar endpoint de prueba
    await endpointDePrueba();

    // 3. Listar algunos clientes
    await listarClientes(1, 5);

    // 4. Buscar un cliente específico (si existe)
    try {
      const cliente = await buscarClientePorNit('123456789');
      
      // 5. Consultar su cartera y pagos
      await consultarCartera(cliente.Cliente);
      await consultarPagos(cliente.Cliente);
    } catch (error) {
      console.log('⚠️ No se encontró cliente de ejemplo, continuando...');
    }

    // 6. Listar vendedores
    const vendedores = await listarVendedores();
    
    // 7. Si hay vendedores, consultar sus clientes
    if (vendedores.length > 0) {
      await consultarClientesDeVendedor(vendedores[0]._id);
    }

    // 8. Intentar obtener estadísticas (puede fallar si no tienes permisos admin)
    try {
      await obtenerEstadisticas();
    } catch (error) {
      console.log('ℹ️ Estadísticas no disponibles (permisos admin requeridos)');
    }

    console.log('\n✅ Flujo de ejemplo completado exitosamente!');

  } catch (error) {
    console.error('\n❌ Error en el flujo de ejemplo:', error.message);
  }
}

// === EJEMPLOS ESPECÍFICOS ===

// Ejemplo: Crear un cliente de prueba
async function ejemploCrearCliente() {
  console.log('➕ Ejemplo: Creando cliente de prueba...');
  
  const nuevoCliente = {
    Cliente: "987654321",
    Nombre_Cliente: "EMPRESA DE PRUEBA S.A.S",
    Saldo: 5000000.00,
    Nombre_Vendedor: "JUAN PEREZ"
  };

  try {
    const clienteCreado = await crearCliente(nuevoCliente);
    console.log('✅ Cliente de prueba creado:', clienteCreado);
    
    // Consultar la cartera del cliente creado
    await consultarCartera(clienteCreado.Cliente);
    
    return clienteCreado;
  } catch (error) {
    console.error('❌ No se pudo crear el cliente de prueba');
    throw error;
  }
}

// Ejemplo: Actualizar un cliente
async function ejemploActualizarCliente(nit, nuevosDatos) {
  console.log(`📝 Ejemplo: Actualizando cliente ${nit}...`);
  
  try {
    const clienteActualizado = await actualizarCliente(nit, nuevosDatos);
    console.log('✅ Cliente actualizado:', clienteActualizado);
    return clienteActualizado;
  } catch (error) {
    console.error('❌ No se pudo actualizar el cliente');
    throw error;
  }
}

// === FUNCIONES PARA ADMINISTRADORES ===

// NOTA: Estas funciones requieren autenticación de usuario administrador, no solo API Key

// Crear una nueva API Key (requiere JWT de usuario admin)
async function crearNuevaApiKey(jwtTokenAdmin, nombreApp, permisos) {
  console.log('🔑 Creando nueva API Key...');
  
  const apiAdmin = axios.create({
    baseURL: BASE_URL,
    headers: {
      'Authorization': `Bearer ${jwtTokenAdmin}`,
      'Content-Type': 'application/json'
    }
  });

  try {
    const response = await apiAdmin.post('/auth/crear-key', {
      nombre_app: nombreApp,
      permisos: permisos,
      limite_requests: 1000
    });
    
    console.log('✅ Nueva API Key creada:', response.data.data.key);
    console.log('💡 Guarda esta API Key en un lugar seguro!');
    return response.data.data;
  } catch (error) {
    console.error('❌ Error creando API Key');
    throw error;
  }
}

// === EXPORTAR FUNCIONES ===
module.exports = {
  // Funciones principales
  validarApiKey,
  listarClientes,
  buscarClientePorNit,
  crearCliente,
  actualizarCliente,
  consultarCartera,
  consultarPagos,
  listarVendedores,
  consultarClientesDeVendedor,
  obtenerEstadisticas,
  endpointDePrueba,
  
  // Flujos completos
  flujoEjemploCompleto,
  
  // Ejemplos específicos
  ejemploCrearCliente,
  ejemploActualizarCliente,
  
  // Funciones de administración (requieren JWT de admin)
  crearNuevaApiKey
};

// === EJECUCIÓN DIRECTA ===
// Si ejecutas este archivo directamente: node example_usage.js
if (require.main === module) {
  // Cambia esto a la función que deseas probar
  flujoEjemploCompleto();
}