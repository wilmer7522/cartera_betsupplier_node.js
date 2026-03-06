# 🚀 API Externa Cartera Betsupplier

## ¿Qué es esto?

Una API RESTful completa que permite a aplicaciones web externas gestionar clientes, vendedores y realizar operaciones CRUD completas sobre tu sistema de cartera.

## ✨ Características

- 🔑 **Autenticación segura** con API Keys
- 🔄 **Operaciones CRUD completas** para clientes y vendedores
- 📊 **Consultas avanzadas** con filtros y paginación
- 🔒 **Control de permisos** detallado por operaciones
- 📈 **Estadísticas y reportes** en tiempo real
- 🛡️ **Rate limiting** y seguridad avanzada
- 📝 **Documentación completa** y ejemplos de uso

## 🚀 Comenzar Rápido

### 1. Obtener una API Key

Para obtener una API Key, un usuario administrador de tu sistema debe crearla:

```bash
# Solicitud HTTP (requiere JWT de usuario admin)
POST /api/v1/auth/crear-key
Authorization: Bearer [JWT_TOKEN_DE_ADMIN]
Content-Type: application/json

{
  "nombre_app": "Mi Aplicación Externa",
  "permisos": ["clientes:read", "clientes:write", "vendedores:read"],
  "limite_requests": 1000
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "key": "ak_tu_nueva_api_key_aqui",
    "nombre_app": "Mi Aplicación Externa",
    "permisos": ["clientes:read", "clientes:write", "vendedores:read"],
    "fecha_creacion": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. Hacer tu primera solicitud

```bash
# Validar tu API Key
GET /api/v1/auth/validar-key
X-API-Key: ak_tu_nueva_api_key_aqui
```

```bash
# Listar clientes
GET /api/v1/clientes?page=1&limit=10
X-API-Key: ak_tu_nueva_api_key_aqui
```

### 3. Ejemplo en JavaScript

```javascript
const axios = require('axios');

const API_KEY = 'ak_tu_nueva_api_key_aqui';
const BASE_URL = 'https://portal.betsupplier.co/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-API-Key': API_KEY
  }
});

// Listar clientes
async function listarClientes() {
  try {
    const response = await api.get('/clientes');
    console.log('Clientes:', response.data.data.clientes);
    return response.data.data;
  } catch (error) {
    console.error('Error:', error.response.data.message);
  }
}

listarClientes();
```

## 📚 Endpoints Principales

### Clientes

| Operación | Método | Endpoint | Permisos Requeridos |
|-----------|--------|----------|-------------------|
| Listar clientes | GET | `/clientes` | `clientes:read` |
| Buscar por NIT | GET | `/clientes/{nit}` | `clientes:read` |
| Crear cliente | POST | `/clientes` | `clientes:write` |
| Actualizar cliente | PUT | `/clientes/{nit}` | `clientes:update` |
| Eliminar cliente | DELETE | `/clientes/{nit}` | `clientes:delete` |
| Consultar cartera | GET | `/clientes/{nit}/cartera` | `cartera:read` |
| Consultar pagos | GET | `/clientes/{nit}/pagos` | `pagos:read` |

### Vendedores

| Operación | Método | Endpoint | Permisos Requeridos |
|-----------|--------|----------|-------------------|
| Listar vendedores | GET | `/vendedores` | `vendedores:read` |
| Buscar por ID | GET | `/vendedores/{id}` | `vendedores:read` |
| Crear vendedor | POST | `/vendedores` | `vendedores:write` |
| Actualizar vendedor | PUT | `/vendedores/{id}` | `vendedores:update` |
| Eliminar vendedor | DELETE | `/vendedores/{id}` | `vendedores:delete` |
| Consultar clientes | GET | `/vendedores/{id}/clientes` | `clientes:read` |

### Administración

| Operación | Método | Endpoint | Permisos Requeridos |
|-----------|--------|----------|-------------------|
| Estadísticas | GET | `/admin/estadisticas` | `admin:estadisticas` |
| Listar usuarios | GET | `/admin/usuarios` | `admin:full` |
| Crear API Key | POST | `/auth/crear-key` | Autenticación de usuario admin |

## 🔑 Permisos Disponibles

```javascript
[
  "clientes:read",     // Lectura de clientes
  "clientes:write",    // Creación de clientes
  "clientes:update",   // Actualización de clientes
  "clientes:delete",   // Eliminación de clientes
  "vendedores:read",   // Lectura de vendedores
  "vendedores:write",  // Creación de vendedores
  "vendedores:update", // Actualización de vendedores
  "vendedores:delete", // Eliminación de vendedores
  "pagos:read",        // Lectura de pagos
  "pagos:write",       // Creación de pagos
  "cartera:read",      // Lectura de cartera
  "admin:full",        // Acceso administrativo completo
  "admin:api_keys",    // Gestión de API Keys
  "admin:estadisticas" // Acceso a estadísticas
]
```

## 📤 Formato de Respuesta

Todas las respuestas siguen este formato estándar:

```json
{
  "success": true|false,
  "data": object|array|null,
  "message": "Descripción del resultado",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 200
}
```

## 🚨 Errores Comunes

### 401 - No Autorizado
```json
{
  "success": false,
  "data": null,
  "message": "API Key requerida",
  "statusCode": 401
}
```

### 403 - Prohibido
```json
{
  "success": false,
  "data": null,
  "message": "No tiene permisos para realizar esta operación: clientes:write",
  "statusCode": 403
}
```

### 429 - Demasiadas Solicitudes
```json
{
  "success": false,
  "data": null,
  "message": "Límite de 1000 requests por hora alcanzado",
  "statusCode": 429
}
```

## 🛡️ Seguridad

- **Rate Limiting**: Máximo 1000 requests por hora (configurable)
- **API Keys**: Claves únicas y seguras con seguimiento de actividad
- **Permisos**: Control granular por operaciones específicas
- **Auditoría**: Registro completo de todas las solicitudes
- **Desactivación**: API Keys pueden ser desactivadas en cualquier momento

## 📁 Archivos del Proyecto

```
cartera_betsupplier_node.js/
├── routes/
│   ├── api_v1.js              # Endpoints de la API externa
│   └── usuarios.js            # Endpoints de usuarios existentes
├── utils/
│   ├── api_key_utils.js       # Gestión de API Keys y autenticación
│   └── auth_utils.js          # Autenticación JWT existente
├── API_DOCUMENTATION.md       # Documentación completa de la API
├── example_usage.js           # Ejemplos de uso en JavaScript
└── README_API.md              # Guía rápida (este archivo)
```

## 🔧 Pruebas Rápidas

### Usando el script de ejemplo

1. Instala las dependencias:
```bash
npm install axios
```

2. Edita el archivo `example_usage.js` y reemplaza:
```javascript
const API_KEY = 'tu_api_key_aqui';
```

3. Ejecuta el script:
```bash
node example_usage.js
```

### Pruebas con curl

```bash
# Validar API Key
curl -H "X-API-Key: tu_api_key_aqui" \
     https://portal.betsupplier.co/api/v1/auth/validar-key

# Listar clientes
curl -H "X-API-Key: tu_api_key_aqui" \
     "https://portal.betsupplier.co/api/v1/clientes?page=1&limit=5"

# Crear cliente
curl -X POST \
     -H "X-API-Key: tu_api_key_aqui" \
     -H "Content-Type: application/json" \
     -d '{
       "Cliente": "123456789",
       "Nombre_Cliente": "EMPRESA DE PRUEBA LTDA",
       "Saldo": 1000000.00,
       "Nombre_Vendedor": "JUAN PEREZ"
     }' \
     https://portal.betsupplier.co/api/v1/clientes
```

## 📞 Soporte

Para soporte técnico o consultas sobre la API:

1. **Documentación completa**: Revisa `API_DOCUMENTATION.md`
2. **Ejemplos de código**: Consulta `example_usage.js`
3. **Contacto**: Contacta al administrador de tu cuenta

## 🔄 Actualizaciones

- **Versión**: 1.0.0
- **Última actualización**: Enero 2024
- **Compatibilidad**: Node.js 14+ / Express 4+

---

**⚠️ Importante**: Esta API es para uso externo. No compartas tus API Keys y mantén tus credenciales seguras.