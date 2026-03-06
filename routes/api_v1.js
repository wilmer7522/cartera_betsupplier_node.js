import express from "express";
import bcrypt from "bcryptjs";
import { 
  crearApiKey, 
  obtenerApiKey, 
  listarApiKeys, 
  eliminarApiKey, 
  desactivarApiKey, 
  activarApiKey,
  middlewareApiKey,
  PERMISOS,
  validarPermisos
} from "../utils/api_key_utils.js";
import { getDb } from "../database.js";
import { obtenerUsuarioActual, soloAdmin } from "../utils/auth_utils.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// === HELPERS ===
const getBaseConocimiento = () => getDb().collection("base_conocimiento");
const getUsuarios = () => getDb().collection("usuarios");
const getPagos = () => getDb().collection("pagos_recibidos");

// === RESPUESTA ESTÁNDAR ===
function respuestaApi(success, data = null, message = "", statusCode = 200) {
  return {
    success,
    data,
    message,
    timestamp: new Date().toISOString(),
    statusCode
  };
}

// === VALIDACIÓN DE DATOS ===
function validarDatosCliente(data) {
  const errores = [];
  
  if (!data.Cliente || data.Cliente.toString().trim().length === 0) {
    errores.push("El NIT del cliente es requerido");
  }
  
  if (!data.Nombre_Cliente || data.Nombre_Cliente.toString().trim().length === 0) {
    errores.push("El nombre del cliente es requerido");
  }
  
  if (data.Saldo !== undefined && isNaN(parseFloat(data.Saldo))) {
    errores.push("El saldo debe ser un número válido");
  }
  
  return errores;
}

function validarDatosVendedor(data) {
  const errores = [];
  
  if (!data.correo || data.correo.toString().trim().length === 0) {
    errores.push("El correo del vendedor es requerido");
  }
  
  if (!data.nombre || data.nombre.toString().trim().length === 0) {
    errores.push("El nombre del vendedor es requerido");
  }
  
  return errores;
}

// === 1. ENDPOINTS DE AUTENTICACIÓN Y GESTIÓN DE API KEYS ===

// POST /api/v1/auth/crear-key
// Crear una nueva API Key (requiere autenticación de usuario administrador)
router.post("/auth/crear-key", obtenerUsuarioActual, soloAdmin, async (req, res) => {
  try {
    const { nombre_app, permisos, limite_requests } = req.body;
    
    if (!nombre_app || !permisos) {
      return res.status(400).json(respuestaApi(false, null, "Nombre de app y permisos son requeridos", 400));
    }
    
    if (!Array.isArray(permisos)) {
      return res.status(400).json(respuestaApi(false, null, "Los permisos deben ser un arreglo", 400));
    }
    
    // Validar que los permisos sean válidos
    const permisosValidos = Object.values(PERMISOS);
    const permisosInvalidos = permisos.filter(p => !permisosValidos.includes(p));
    
    if (permisosInvalidos.length > 0) {
      return res.status(400).json(respuestaApi(false, null, `Permisos inválidos: ${permisosInvalidos.join(', ')}`, 400));
    }
    
    const apiKey = await crearApiKey({
      nombre_app,
      permisos,
      limite_requests: limite_requests || 1000
    });
    
    res.status(201).json(respuestaApi(true, apiKey, "API Key creada exitosamente", 201));
  } catch (error) {
    console.error("Error creando API Key:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// GET /api/v1/auth/validar-key
// Validar una API Key (sin autenticación de usuario, solo con API Key)
router.get("/auth/validar-key", middlewareApiKey(null), async (req, res) => {
  try {
    const apiKeyData = await obtenerApiKey(req.apiKey.key);
    
    if (!apiKeyData) {
      return res.status(404).json(respuestaApi(false, null, "API Key no encontrada", 404));
    }
    
    const info = {
      nombre_app: apiKeyData.nombre_app,
      activa: apiKeyData.activa,
      permisos: apiKeyData.permisos,
      requests_realizados: apiKeyData.requests_realizados,
      limite_requests: apiKeyData.limite_requests,
      fecha_creacion: apiKeyData.fecha_creacion
    };
    
    res.json(respuestaApi(true, info, "API Key válida", 200));
  } catch (error) {
    console.error("Error validando API Key:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// GET /api/v1/admin/api-keys
// Listar todas las API Keys (solo administradores con API Key)
router.get("/admin/api-keys", middlewareApiKey(PERMISOS.ADMIN_API_KEYS), async (req, res) => {
  try {
    const apiKeys = await listarApiKeys();
    res.json(respuestaApi(true, apiKeys, "API Keys listadas exitosamente", 200));
  } catch (error) {
    console.error("Error listando API Keys:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// PUT /api/v1/admin/api-keys/:key/activar
// Activar una API Key
router.put("/admin/api-keys/:key/activar", middlewareApiKey(PERMISOS.ADMIN_API_KEYS), async (req, res) => {
  try {
    const { key } = req.params;
    await activarApiKey(key);
    res.json(respuestaApi(true, null, "API Key activada exitosamente", 200));
  } catch (error) {
    console.error("Error activando API Key:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// PUT /api/v1/admin/api-keys/:key/desactivar
// Desactivar una API Key
router.put("/admin/api-keys/:key/desactivar", middlewareApiKey(PERMISOS.ADMIN_API_KEYS), async (req, res) => {
  try {
    const { key } = req.params;
    await desactivarApiKey(key);
    res.json(respuestaApi(true, null, "API Key desactivada exitosamente", 200));
  } catch (error) {
    console.error("Error desactivando API Key:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// DELETE /api/v1/admin/api-keys/:key
// Eliminar una API Key
router.delete("/admin/api-keys/:key", middlewareApiKey(PERMISOS.ADMIN_API_KEYS), async (req, res) => {
  try {
    const { key } = req.params;
    const eliminado = await eliminarApiKey(key);
    
    if (!eliminado) {
      return res.status(404).json(respuestaApi(false, null, "API Key no encontrada", 404));
    }
    
    res.json(respuestaApi(true, null, "API Key eliminada exitosamente", 200));
  } catch (error) {
    console.error("Error eliminando API Key:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// === 2. ENDPOINTS CRUD PARA CLIENTES ===

// GET /api/v1/clientes
// Listar clientes con filtros
router.get("/clientes", middlewareApiKey(PERMISOS.CLIENTES_READ), async (req, res) => {
  try {
    const { page = 1, limit = 50, nit, nombre, vendedor } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    
    let query = {};
    
    if (nit) {
      query.Cliente = { $regex: nit, $options: 'i' };
    }
    
    if (nombre) {
      query.Nombre_Cliente = { $regex: nombre, $options: 'i' };
    }
    
    if (vendedor) {
      query.Nombre_Vendedor = { $regex: vendedor, $options: 'i' };
    }
    
    const total = await getBaseConocimiento().countDocuments(query);
    const clientes = await getBaseConocimiento()
      .find(query)
      .skip(skip)
      .limit(limitNum)
      .toArray();
    
    const resultado = {
      clientes,
      total,
      pagina: parseInt(page),
      limite: limitNum,
      total_paginas: Math.ceil(total / limitNum),
      tiene_siguiente: skip + limitNum < total,
      tiene_anterior: parseInt(page) > 1
    };
    
    res.json(respuestaApi(true, resultado, "Clientes listados exitosamente", 200));
  } catch (error) {
    console.error("Error listando clientes:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// GET /api/v1/clientes/:nit
// Consultar cliente por NIT
router.get("/clientes/:nit", middlewareApiKey(PERMISOS.CLIENTES_READ), async (req, res) => {
  try {
    const { nit } = req.params;
    const cliente = await getBaseConocimiento().findOne({ Cliente: nit });
    
    if (!cliente) {
      return res.status(404).json(respuestaApi(false, null, "Cliente no encontrado", 404));
    }
    
    res.json(respuestaApi(true, cliente, "Cliente encontrado exitosamente", 200));
  } catch (error) {
    console.error("Error consultando cliente:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// POST /api/v1/clientes
// Crear nuevo cliente
router.post("/clientes", middlewareApiKey(PERMISOS.CLIENTES_WRITE), async (req, res) => {
  try {
    const data = req.body;
    const errores = validarDatosCliente(data);
    
    if (errores.length > 0) {
      return res.status(400).json(respuestaApi(false, null, errores.join('; '), 400));
    }
    
    // Verificar si el cliente ya existe
    const existe = await getBaseConocimiento().findOne({ Cliente: data.Cliente });
    if (existe) {
      return res.status(409).json(respuestaApi(false, null, "Ya existe un cliente con este NIT", 409));
    }
    
    // Establecer valores por defecto
    const cliente = {
      ...data,
      Cliente: data.Cliente.toString().trim(),
      Nombre_Cliente: data.Nombre_Cliente.toString().trim().toUpperCase(),
      Saldo: data.Saldo !== undefined ? parseFloat(data.Saldo) : 0,
      Fecha_Creacion: new Date(),
      Ultima_Actualizacion: new Date()
    };
    
    await getBaseConocimiento().insertOne(cliente);
    
    res.status(201).json(respuestaApi(true, cliente, "Cliente creado exitosamente", 201));
  } catch (error) {
    console.error("Error creando cliente:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// PUT /api/v1/clientes/:nit
// Actualizar cliente
router.put("/clientes/:nit", middlewareApiKey(PERMISOS.CLIENTES_UPDATE), async (req, res) => {
  try {
    const { nit } = req.params;
    const data = req.body;
    
    const cliente = await getBaseConocimiento().findOne({ Cliente: nit });
    if (!cliente) {
      return res.status(404).json(respuestaApi(false, null, "Cliente no encontrado", 404));
    }
    
    const errores = validarDatosCliente(data);
    if (errores.length > 0) {
      return res.status(400).json(respuestaApi(false, null, errores.join('; '), 400));
    }
    
    const updateData = {
      ...data,
      Nombre_Cliente: data.Nombre_Cliente?.toString().trim().toUpperCase(),
      Saldo: data.Saldo !== undefined ? parseFloat(data.Saldo) : cliente.Saldo,
      Ultima_Actualizacion: new Date()
    };
    
    await getBaseConocimiento().updateOne({ Cliente: nit }, { $set: updateData });
    
    const clienteActualizado = await getBaseConocimiento().findOne({ Cliente: nit });
    
    res.json(respuestaApi(true, clienteActualizado, "Cliente actualizado exitosamente", 200));
  } catch (error) {
    console.error("Error actualizando cliente:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// DELETE /api/v1/clientes/:nit
// Eliminar cliente
router.delete("/clientes/:nit", middlewareApiKey(PERMISOS.CLIENTES_DELETE), async (req, res) => {
  try {
    const { nit } = req.params;
    
    const cliente = await getBaseConocimiento().findOne({ Cliente: nit });
    if (!cliente) {
      return res.status(404).json(respuestaApi(false, null, "Cliente no encontrado", 404));
    }
    
    await getBaseConocimiento().deleteOne({ Cliente: nit });
    
    res.json(respuestaApi(true, null, "Cliente eliminado exitosamente", 200));
  } catch (error) {
    console.error("Error eliminando cliente:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// GET /api/v1/clientes/:nit/cartera
// Consultar cartera de un cliente
router.get("/clientes/:nit/cartera", middlewareApiKey(PERMISOS.CARTERA_READ), async (req, res) => {
  try {
    const { nit } = req.params;
    
    const cliente = await getBaseConocimiento().findOne({ Cliente: nit });
    if (!cliente) {
      return res.status(404).json(respuestaApi(false, null, "Cliente no encontrado", 404));
    }
    
    // Aquí podrías implementar la lógica para calcular la cartera
    // Por ahora devolvemos el cliente como cartera base
    const cartera = {
      cliente: cliente.Nombre_Cliente,
      nit: cliente.Cliente,
      saldo_actual: cliente.Saldo || 0,
      fecha_actualizacion: cliente.Ultima_Actualizacion || new Date()
    };
    
    res.json(respuestaApi(true, cartera, "Cartera del cliente", 200));
  } catch (error) {
    console.error("Error consultando cartera:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// GET /api/v1/clientes/:nit/pagos
// Consultar pagos de un cliente
router.get("/clientes/:nit/pagos", middlewareApiKey(PERMISOS.PAGOS_READ), async (req, res) => {
  try {
    const { nit } = req.params;
    
    const pagos = await getPagos().find({ 
      nit_cliente: nit.toString() 
    }).toArray();
    
    const resultado = {
      cliente: nit,
      total_pagos: pagos.length,
      pagos: pagos
    };
    
    res.json(respuestaApi(true, resultado, "Pagos del cliente", 200));
  } catch (error) {
    console.error("Error consultando pagos:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// === 3. ENDPOINTS CRUD PARA VENDEDORES ===

// GET /api/v1/vendedores
// Listar vendedores
router.get("/vendedores", middlewareApiKey(PERMISOS.VENDEDORES_READ), async (req, res) => {
  try {
    const vendedores = await getUsuarios().find({ rol: "vendedor" }).toArray();
    
    // Eliminar información sensible
    const vendedoresLimpio = vendedores.map(v => ({
      _id: v._id,
      correo: v.correo,
      nombre: v.nombre,
      rol: v.rol,
      vendedores_asociados: v.vendedores_asociados,
      clientes_asociados: v.clientes_asociados,
      fecha_creacion: v.fecha_creacion || v.createdAt,
      ultimo_login: v.ultimo_login
    }));
    
    res.json(respuestaApi(true, vendedoresLimpio, "Vendedores listados exitosamente", 200));
  } catch (error) {
    console.error("Error listando vendedores:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// GET /api/v1/vendedores/:id
// Consultar vendedor por ID
router.get("/vendedores/:id", middlewareApiKey(PERMISOS.VENDEDORES_READ), async (req, res) => {
  try {
    const { id } = req.params;
    const vendedor = await getUsuarios().findOne({ _id: id, rol: "vendedor" });
    
    if (!vendedor) {
      return res.status(404).json(respuestaApi(false, null, "Vendedor no encontrado", 404));
    }
    
    const vendedorLimpio = {
      _id: vendedor._id,
      correo: vendedor.correo,
      nombre: vendedor.nombre,
      rol: vendedor.rol,
      vendedores_asociados: vendedor.vendedores_asociados,
      clientes_asociados: vendedor.clientes_asociados,
      fecha_creacion: vendedor.fecha_creacion || vendedor.createdAt,
      ultimo_login: vendedor.ultimo_login
    };
    
    res.json(respuestaApi(true, vendedorLimpio, "Vendedor encontrado exitosamente", 200));
  } catch (error) {
    console.error("Error consultando vendedor:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// POST /api/v1/vendedores
// Crear nuevo vendedor
router.post("/vendedores", middlewareApiKey(PERMISOS.VENDEDORES_WRITE), async (req, res) => {
  try {
    const data = req.body;
    const errores = validarDatosVendedor(data);
    
    if (errores.length > 0) {
      return res.status(400).json(respuestaApi(false, null, errores.join('; '), 400));
    }
    
    // Verificar si el correo ya existe
    const existe = await getUsuarios().findOne({ correo: data.correo.toLowerCase() });
    if (existe) {
      return res.status(409).json(respuestaApi(false, null, "Ya existe un usuario con este correo", 409));
    }
    
    const hashed = await bcrypt.hash(data.password || "temporal123", 10);
    const nuevoVendedor = {
      correo: data.correo.toLowerCase(),
      password: hashed,
      nombre: data.nombre.trim().toUpperCase(),
      rol: "vendedor",
      vendedores_asociados: data.vendedores_asociados || [],
      clientes_asociados: data.clientes_asociados || [],
      fecha_creacion: new Date(),
      ultimo_login: null
    };
    
    await getUsuarios().insertOne(nuevoVendedor);
    
    // Eliminar información sensible para la respuesta
    const respuesta = { ...nuevoVendedor };
    delete respuesta.password;
    
    res.status(201).json(respuestaApi(true, respuesta, "Vendedor creado exitosamente", 201));
  } catch (error) {
    console.error("Error creando vendedor:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// PUT /api/v1/vendedores/:id
// Actualizar vendedor
router.put("/vendedores/:id", middlewareApiKey(PERMISOS.VENDEDORES_UPDATE), async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const vendedor = await getUsuarios().findOne({ _id: id, rol: "vendedor" });
    if (!vendedor) {
      return res.status(404).json(respuestaApi(false, null, "Vendedor no encontrado", 404));
    }
    
    const updateData = {
      nombre: data.nombre?.trim().toUpperCase(),
      vendedores_asociados: data.vendedores_asociados,
      clientes_asociados: data.clientes_asociados,
      ultimo_login: vendedor.ultimo_login
    };
    
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }
    
    await getUsuarios().updateOne({ _id: id }, { $set: updateData });
    
    const vendedorActualizado = await getUsuarios().findOne({ _id: id });
    const respuesta = { ...vendedorActualizado };
    delete respuesta.password;
    
    res.json(respuestaApi(true, respuesta, "Vendedor actualizado exitosamente", 200));
  } catch (error) {
    console.error("Error actualizando vendedor:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// DELETE /api/v1/vendedores/:id
// Eliminar vendedor
router.delete("/vendedores/:id", middlewareApiKey(PERMISOS.VENDEDORES_DELETE), async (req, res) => {
  try {
    const { id } = req.params;
    
    const vendedor = await getUsuarios().findOne({ _id: id, rol: "vendedor" });
    if (!vendedor) {
      return res.status(404).json(respuestaApi(false, null, "Vendedor no encontrado", 404));
    }
    
    await getUsuarios().deleteOne({ _id: id });
    
    res.json(respuestaApi(true, null, "Vendedor eliminado exitosamente", 200));
  } catch (error) {
    console.error("Error eliminando vendedor:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// GET /api/v1/vendedores/:id/clientes
// Consultar clientes asignados a un vendedor
router.get("/vendedores/:id/clientes", middlewareApiKey(PERMISOS.CLIENTES_READ), async (req, res) => {
  try {
    const { id } = req.params;
    
    const vendedor = await getUsuarios().findOne({ _id: id, rol: "vendedor" });
    if (!vendedor) {
      return res.status(404).json(respuestaApi(false, null, "Vendedor no encontrado", 404));
    }
    
    const clientes = await getBaseConocimiento().find({
      Nombre_Vendedor: { $regex: vendedor.nombre, $options: 'i' }
    }).toArray();
    
    const resultado = {
      vendedor: vendedor.nombre,
      id_vendedor: id,
      total_clientes: clientes.length,
      clientes: clientes
    };
    
    res.json(respuestaApi(true, resultado, "Clientes del vendedor", 200));
  } catch (error) {
    console.error("Error consultando clientes del vendedor:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// === 4. ENDPOINTS ADMINISTRATIVOS ===

// GET /api/v1/admin/estadisticas
// Obtener estadísticas generales
router.get("/admin/estadisticas", middlewareApiKey(PERMISOS.ADMIN_ESTADISTICAS), async (req, res) => {
  try {
    const totalClientes = await getBaseConocimiento().countDocuments();
    const totalVendedores = await getUsuarios().countDocuments({ rol: "vendedor" });
    const totalPagos = await getPagos().countDocuments();
    
    // Calcular saldo total de cartera
    const carteraCursor = getBaseConocimiento().find({}, { projection: { Saldo: 1 } });
    let saldoTotal = 0;
    await carteraCursor.forEach(doc => {
      saldoTotal += parseFloat(doc.Saldo || 0);
    });
    
    const estadisticas = {
      clientes: {
        total: totalClientes,
        activos: totalClientes // Podrías agregar lógica para clientes activos
      },
      vendedores: {
        total: totalVendedores
      },
      pagos: {
        total_registrados: totalPagos
      },
      cartera: {
        saldo_total: saldoTotal,
        moneda: "COP"
      },
      fecha_consulta: new Date().toISOString()
    };
    
    res.json(respuestaApi(true, estadisticas, "Estadísticas generales", 200));
  } catch (error) {
    console.error("Error obteniendo estadísticas:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// GET /api/v1/admin/usuarios
// Listar todos los usuarios (para administración)
router.get("/admin/usuarios", middlewareApiKey(PERMISOS.ADMIN_FULL), async (req, res) => {
  try {
    const usuarios = await getUsuarios().find({}, { projection: { password: 0 } }).toArray();
    
    res.json(respuestaApi(true, usuarios, "Usuarios listados exitosamente", 200));
  } catch (error) {
    console.error("Error listando usuarios:", error);
    res.status(500).json(respuestaApi(false, null, `Error interno: ${error.message}`, 500));
  }
});

// === 5. ENDPOINTS DE PRUEBA Y UTILIDADES ===

// GET /api/v1/test
// Endpoint de prueba para verificar conexión
router.get("/test", middlewareApiKey(null), (req, res) => {
  res.json(respuestaApi(true, {
    mensaje: "API externa funcionando correctamente",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    api_key_valida: true,
    permisos: req.apiKey?.permisos || []
  }, "Prueba exitosa", 200));
});

// GET /api/v1/permisos
// Listar todos los permisos disponibles
router.get("/permisos", (req, res) => {
  res.json(respuestaApi(true, {
    permisos: Object.values(PERMISOS),
    descripcion: {
      "clientes:read": "Lectura de clientes",
      "clientes:write": "Creación de clientes",
      "clientes:update": "Actualización de clientes",
      "clientes:delete": "Eliminación de clientes",
      "vendedores:read": "Lectura de vendedores",
      "vendedores:write": "Creación de vendedores",
      "vendedores:update": "Actualización de vendedores",
      "vendedores:delete": "Eliminación de vendedores",
      "pagos:read": "Lectura de pagos",
      "pagos:write": "Creación de pagos",
      "cartera:read": "Lectura de cartera",
      "admin:full": "Acceso administrativo completo",
      "admin:api_keys": "Gestión de API Keys",
      "admin:estadisticas": "Acceso a estadísticas"
    }
  }, "Permisos disponibles", 200));
});

export default router;