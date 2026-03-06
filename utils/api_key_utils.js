import { getDb } from "../database.js";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const getApiKeysCollection = () => getDb().collection("api_keys");

// === FUNCIONES DE APOYO ===

// Generar una API Key única y segura
function generarApiKey() {
  return "ak_" + crypto.randomBytes(32).toString("hex");
}

// Validar permisos para una operación específica
function tienePermiso(apiKeyData, operacion) {
  if (!apiKeyData || !apiKeyData.activa) return false;
  
  // Si tiene permiso de administrador, puede hacer cualquier cosa
  if (apiKeyData.permisos.includes("admin:full")) return true;
  
  // Verificar permisos específicos para la operación
  return apiKeyData.permisos.includes(operacion);
}

// === FUNCIONES PRINCIPALES ===

// Crear una nueva API Key
export async function crearApiKey(data) {
  const { nombre_app, permisos, limite_requests = 1000 } = data;
  
  if (!nombre_app || !permisos || !Array.isArray(permisos)) {
    throw new Error("Datos inválidos para crear API Key");
  }

  const apiKey = generarApiKey();
  const nuevaApiKey = {
    key: apiKey,
    nombre_app: nombre_app.trim(),
    permisos: permisos,
    fecha_creacion: new Date(),
    ultima_actividad: new Date(),
    activa: true,
    limite_requests: limite_requests,
    requests_realizados: 0,
    requests_hora: 0,
    ultima_reset_hora: new Date()
  };

  await getApiKeysCollection().insertOne(nuevaApiKey);
  return {
    key: apiKey,
    nombre_app: nuevaApiKey.nombre_app,
    permisos: nuevaApiKey.permisos,
    fecha_creacion: nuevaApiKey.fecha_creacion
  };
}

// Obtener API Key por su valor
export async function obtenerApiKey(key) {
  return await getApiKeysCollection().findOne({ key });
}

// Actualizar actividad de la API Key
export async function registrarActividad(key) {
  const ahora = new Date();
  const unaHoraAtras = new Date(ahora.getTime() - 60 * 60 * 1000);
  
  const updateDoc = {
    $inc: { 
      requests_realizados: 1,
      requests_hora: 1
    },
    $set: { 
      ultima_actividad: ahora 
    },
    $setOnInsert: {
      ultima_reset_hora: unaHoraAtras
    }
  };

  // Resetear contador de requests por hora cada 60 minutos
  const apiKey = await getApiKeysCollection().findOne({ key });
  if (apiKey && ahora - apiKey.ultima_reset_hora > 60 * 60 * 1000) {
    updateDoc.$set.requests_hora = 1;
    updateDoc.$set.ultima_reset_hora = ahora;
  }

  await getApiKeysCollection().updateOne({ key }, updateDoc);
}

// Verificar si la API Key tiene límite de requests
export async function verificarLimiteRequests(key) {
  const apiKey = await getApiKeysCollection().findOne({ key });
  if (!apiKey) return { permitido: false, mensaje: "API Key no válida" };
  
  if (!apiKey.activa) return { permitido: false, mensaje: "API Key desactivada" };
  
  if (apiKey.requests_hora >= apiKey.limite_requests) {
    return { 
      permitido: false, 
      mensaje: `Límite de ${apiKey.limite_requests} requests por hora alcanzado` 
    };
  }

  return { permitido: true };
}

// Desactivar una API Key
export async function desactivarApiKey(key) {
  await getApiKeysCollection().updateOne({ key }, { $set: { activa: false } });
}

// Activar una API Key
export async function activarApiKey(key) {
  await getApiKeysCollection().updateOne({ key }, { $set: { activa: true } });
}

// Listar todas las API Keys (para administradores)
export async function listarApiKeys() {
  return await getApiKeysCollection().find({}, { projection: { key: 0 } }).toArray();
}

// Eliminar una API Key
export async function eliminarApiKey(key) {
  const result = await getApiKeysCollection().deleteOne({ key });
  return result.deletedCount > 0;
}

// === MIDDLEWARE DE AUTENTICACIÓN ===

export function middlewareApiKey(operacionRequerida) {
  return async (req, res, next) => {
    try {
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          message: "API Key requerida",
          timestamp: new Date().toISOString()
        });
      }

      // Obtener y validar la API Key
      const apiKeyData = await obtenerApiKey(apiKey);
      
      if (!apiKeyData) {
        return res.status(401).json({
          success: false,
          message: "API Key inválida",
          timestamp: new Date().toISOString()
        });
      }

      if (!apiKeyData.activa) {
        return res.status(403).json({
          success: false,
          message: "API Key desactivada",
          timestamp: new Date().toISOString()
        });
      }

      // Verificar límite de requests
      const limite = await verificarLimiteRequests(apiKey);
      if (!limite.permitido) {
        return res.status(429).json({
          success: false,
          message: limite.mensaje,
          timestamp: new Date().toISOString()
        });
      }

      // Registrar actividad
      await registrarActividad(apiKey);

      // Verificar permisos para la operación
      if (operacionRequerida && !tienePermiso(apiKeyData, operacionRequerida)) {
        return res.status(403).json({
          success: false,
          message: `No tiene permisos para realizar esta operación: ${operacionRequerida}`,
          timestamp: new Date().toISOString()
        });
      }

      // Adjuntar información de la API Key al request
      req.apiKey = {
        key: apiKey,
        nombre_app: apiKeyData.nombre_app,
        permisos: apiKeyData.permisos,
        requests_realizados: apiKeyData.requests_realizados
      };

      next();
    } catch (error) {
      console.error("Error en middleware de API Key:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
        timestamp: new Date().toISOString()
      });
    }
  };
}

// === PERMISOS ESTÁNDAR ===
export const PERMISOS = {
  // Clientes
  CLIENTES_READ: "clientes:read",
  CLIENTES_WRITE: "clientes:write",
  CLIENTES_UPDATE: "clientes:update",
  CLIENTES_DELETE: "clientes:delete",
  
  // Vendedores
  VENDEDORES_READ: "vendedores:read",
  VENDEDORES_WRITE: "vendedores:write",
  VENDEDORES_UPDATE: "vendedores:update",
  VENDEDORES_DELETE: "vendedores:delete",
  
  // Pagos
  PAGOS_READ: "pagos:read",
  PAGOS_WRITE: "pagos:write",
  
  // Cartera
  CARTERA_READ: "cartera:read",
  
  // Administración
  ADMIN_FULL: "admin:full",
  ADMIN_API_KEYS: "admin:api_keys",
  ADMIN_ESTADISTICAS: "admin:estadisticas"
};

// === FUNCIONES DE VALIDACIÓN ===

export function validarPermisos(permisos, operacion) {
  return permisos.includes(PERMISOS.ADMIN_FULL) || permisos.includes(operacion);
}

export function obtenerPermisosPorRol(rol) {
  switch (rol) {
    case 'admin':
      return Object.values(PERMISOS);
    case 'vendedor':
      return [
        PERMISOS.CLIENTES_READ,
        PERMISOS.PAGOS_READ,
        PERMISOS.CARTERA_READ,
        PERMISOS.VENDEDORES_READ
      ];
    case 'cliente':
      return [
        PERMISOS.CLIENTES_READ,
        PERMISOS.PAGOS_READ,
        PERMISOS.CARTERA_READ
      ];
    default:
      return [];
  }
}