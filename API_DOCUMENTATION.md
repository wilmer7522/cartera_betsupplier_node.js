# API Externa Cartera Betsupplier

Documentación para la API externa que permite a aplicaciones web terceras gestionar clientes, vendedores y realizar operaciones CRUD completas.

## 🚀 URL Base

```
https://portal.betsupplier.co/api/v1
```

## 🔑 Autenticación

Todas las operaciones externas requieren una API Key que debe enviarse en los headers de la solicitud.

### Headers Requeridos

```http
X-API-Key: tu_api_key_aqui
```

Alternativamente, puedes usar:

```http
Authorization: Bearer tu_api_key_aqui
```

## 📋 Permisos Disponibles

| Permiso | Descripción |
|---------|-------------|
| `clientes:read` | Lectura de clientes |
| `clientes:write` | Creación de clientes |
| `clientes:update` | Actualización de clientes |
| `clientes:delete` | Eliminación de clientes |
| `vendedores:read` | Lectura de vendedores |
| `vendedores:write` | Creación de vendedores |
| `vendedores:update` | Actualización de vendedores |
| `vendedores:delete` | Eliminación de vendedores |
| `pagos:read` | Lectura de pagos |
| `pagos:write` | Creación de pagos |
| `cartera:read` | Lectura de cartera |
| `admin:full` | Acceso administrativo completo |
| `admin:api_keys` | Gestión de API Keys |
| `admin:estadisticas` | Acceso a estadísticas |

## 📤 Formato de Respuesta

Todas las respuestas siguen el siguiente formato estándar:

```json
{
  "success": boolean,
  "data": object|array|null,
  "message": string,
  "timestamp": string,
  "statusCode": number
}
```

## 🔧 Endpoints

### 1. Gestión de API Keys

#### Crear API Key (Requiere autenticación de usuario administrador)

**POST** `/api/v1/auth/crear-key`

**Headers:**
- `Authorization: Bearer [JWT_TOKEN_DE_USUARIO_ADMIN]`

**Body:**
```json
{
  "nombre_app": "Nombre de tu Aplicación",
  "permisos": ["clientes:read", "clientes:write", "vendedores:read"],
  "limite_requests": 1000
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "key": "ak_tu_nueva_api_key",
    "nombre_app": "Nombre de tu Aplicación",
    "permisos": ["clientes:read", "clientes:write", "vendedores:read"],
    "fecha_creacion": "2024-01-01T00:00:00.000Z"
  },
  "message": "API Key creada exitosamente",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 201
}
```

#### Validar API Key

**GET** `/api/v1/auth/validar-key`

**Headers:**
- `X-API-Key: tu_api_key_aqui`

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "nombre_app": "Nombre de tu Aplicación",
    "activa": true,
    "permisos": ["clientes:read", "clientes:write"],
    "requests_realizados": 45,
    "limite_requests": 1000,
    "fecha_creacion": "2024-01-01T00:00:00.000Z"
  },
  "message": "API Key válida",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 200
}
```

### 2. Clientes

#### Listar Clientes

**GET** `/api/v1/clientes`

**Parámetros de Query:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Límite de resultados por página (default: 50, máximo: 100)
- `nit` (opcional): Filtrar por NIT
- `nombre` (opcional): Filtrar por nombre
- `vendedor` (opcional): Filtrar por vendedor

**Headers:**
- `X-API-Key: tu_api_key_aqui`

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "clientes": [
      {
        "Cliente": "123456789",
        "Nombre_Cliente": "EMPRESA DE PRUEBA LTDA",
        "Saldo": 1500000.00,
        "Nombre_Vendedor": "JUAN PEREZ",
        "Fecha_Creacion": "2024-01-01T00:00:00.000Z",
        "Ultima_Actualizacion": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 1,
    "pagina": 1,
    "limite": 50,
    "total_paginas": 1,
    "tiene_siguiente": false,
    "tiene_anterior": false
  },
  "message": "Clientes listados exitosamente",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 200
}
```

#### Consultar Cliente por NIT

**GET** `/api/v1/clientes/{nit}`

**Headers:**
- `X-API-Key: tu_api_key_aqui`

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "Cliente": "123456789",
    "Nombre_Cliente": "EMPRESA DE PRUEBA LTDA",
    "Saldo": 1500000.00,
    "Nombre_Vendedor": "JUAN PEREZ",
    "Fecha_Creacion": "2024-01-01T00:00:00.000Z",
    "Ultima_Actualizacion": "2024-01-01T00:00:00.000Z"
  },
  "message": "Cliente encontrado exitosamente",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 200
}
```

#### Crear Cliente

**POST** `/api/v1/clientes`

**Headers:**
- `X-API-Key: tu_api_key_aqui`
- `Content-Type: application/json`

**Body:**
```json
{
  "Cliente": "987654321",
  "Nombre_Cliente": "NUEVA EMPRESA S.A.S",
  "Saldo": 2000000.00,
  "Nombre_Vendedor": "MARIA GOMEZ"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "Cliente": "987654321",
    "Nombre_Cliente": "NUEVA EMPRESA S.A.S",
    "Saldo": 2000000.00,
    "Nombre_Vendedor": "MARIA GOMEZ",
    "Fecha_Creacion": "2024-01-01T00:00:00.000Z",
    "Ultima_Actualizacion": "2024-01-01T00:00:00.000Z"
  },
  "message": "Cliente creado exitosamente",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 201
}
```

#### Actualizar Cliente

**PUT** `/api/v1/clientes/{nit}`

**Headers:**
- `X-API-Key: tu_api_key_aqui`
- `Content-Type: application/json`

**Body:**
```json
{
  "Nombre_Cliente": "EMPRESA ACTUALIZADA LTDA",
  "Saldo": 1800000.00,
  "Nombre_Vendedor": "CARLOS RUIZ"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "Cliente": "123456789",
    "Nombre_Cliente": "EMPRESA ACTUALIZADA LTDA",
    "Saldo": 1800000.00,
    "Nombre_Vendedor": "CARLOS RUIZ",
    "Fecha_Creacion": "2024-01-01T00:00:00.000Z",
    "Ultima_Actualizacion": "2024-01-01T12:00:00.000Z"
  },
  "message": "Cliente actualizado exitosamente",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "statusCode": 200
}
```

#### Eliminar Cliente

**DELETE** `/api/v1/clientes/{nit}`

**Headers:**
- `X-API-Key: tu_api_key_aqui`

**Respuesta:**
```json
{
  "success": true,
  "data": null,
  "message": "Cliente eliminado exitosamente",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "statusCode": 200
}
```

#### Consultar Cartera de Cliente

**GET** `/api/v1/clientes/{nit}/cartera`

**Headers:**
- `X-API-Key: tu_api_key_aqui`

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "cliente": "EMPRESA DE PRUEBA LTDA",
    "nit": "123456789",
    "saldo_actual": 1500000.00,
    "fecha_actualizacion": "2024-01-01T00:00:00.000Z"
  },
  "message": "Cartera del cliente",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 200
}
```

#### Consultar Pagos de Cliente

**GET** `/api/v1/clientes/{nit}/pagos`

**Headers:**
- `X-API-Key: tu_api_key_aqui`

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "cliente": "123456789",
    "total_pagos": 3,
    "pagos": [
      {
        "transaccion_id": "txn_123456789",
        "referencia_factura": "FAC-001",
        "monto": 500000.00,
        "fecha_pago": "2024-01-01T10:00:00.000Z",
        "nombre_cliente": "EMPRESA DE PRUEBA LTDA"
      }
    ]
  },
  "message": "Pagos del cliente",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 200
}
```

### 3. Vendedores

#### Listar Vendedores

**GET** `/api/v1/vendedores`

**Headers:**
- `X-API-Key: tu_api_key_aqui`

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "correo": "juan.perez@empresa.com",
      "nombre": "JUAN PEREZ",
      "rol": "vendedor",
      "vendedores_asociados": [],
      "clientes_asociados": [
        {
          "nit": "123456789",
          "nombre": "EMPRESA DE PRUEBA LTDA"
        }
      ],
      "fecha_creacion": "2024-01-01T00:00:00.000Z",
      "ultimo_login": "2024-01-01T15:00:00.000Z"
    }
  ],
  "message": "Vendedores listados exitosamente",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 200
}
```

#### Consultar Vendedor por ID

**GET** `/api/v1/vendedores/{id}`

**Headers:**
- `X-API-Key: tu_api_key_aqui`

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "correo": "juan.perez@empresa.com",
    "nombre": "JUAN PEREZ",
    "rol": "vendedor",
    "vendedores_asociados": [],
    "clientes_asociados": [
      {
        "nit": "123456789",
        "nombre": "EMPRESA DE PRUEBA LTDA"
      }
    ],
    "fecha_creacion": "2024-01-01T00:00:00.000Z",
    "ultimo_login": "2024-01-01T15:00:00.000Z"
  },
  "message": "Vendedor encontrado exitosamente",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 200
}
```

#### Crear Vendedor

**POST** `/api/v1/vendedores`

**Headers:**
- `X-API-Key: tu_api_key_aqui`
- `Content-Type: application/json`

**Body:**
```json
{
  "correo": "nuevo.vendedor@empresa.com",
  "nombre": "NUEVO VENDEDOR",
  "password": "password123",
  "vendedores_asociados": [],
  "clientes_asociados": [
    {
      "nit": "987654321",
      "nombre": "NUEVA EMPRESA S.A.S"
    }
  ]
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "correo": "nuevo.vendedor@empresa.com",
    "nombre": "NUEVO VENDEDOR",
    "rol": "vendedor",
    "vendedores_asociados": [],
    "clientes_asociados": [
      {
        "nit": "987654321",
        "nombre": "NUEVA EMPRESA S.A.S"
      }
    ],
    "fecha_creacion": "2024-01-01T00:00:00.000Z",
    "ultimo_login": null
  },
  "message": "Vendedor creado exitosamente",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 201
}
```

#### Actualizar Vendedor

**PUT** `/api/v1/vendedores/{id}`

**Headers:**
- `X-API-Key: tu_api_key_aqui`
- `Content-Type: application/json`

**Body:**
```json
{
  "nombre": "VENDEDOR ACTUALIZADO",
  "clientes_asociados": [
    {
      "nit": "123456789",
      "nombre": "EMPRESA DE PRUEBA LTDA"
    },
    {
      "nit": "987654321",
      "nombre": "NUEVA EMPRESA S.A.S"
    }
  ]
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "correo": "juan.perez@empresa.com",
    "nombre": "VENDEDOR ACTUALIZADO",
    "rol": "vendedor",
    "vendedores_asociados": [],
    "clientes_asociados": [
      {
        "nit": "123456789",
        "nombre": "EMPRESA DE PRUEBA LTDA"
      },
      {
        "nit": "987654321",
        "nombre": "NUEVA EMPRESA S.A.S"
      }
    ],
    "fecha_creacion": "2024-01-01T00:00:00.000Z",
    "ultimo_login": "2024-01-01T15:00:00.000Z"
  },
  "message": "Vendedor actualizado exitosamente",
  "timestamp": "2024-01-01T16:00:00.000Z",
  "statusCode": 200
}
```

#### Eliminar Vendedor

**DELETE** `/api/v1/vendedores/{id}`

**Headers:**
- `X-API-Key: tu_api_key_aqui`

**Respuesta:**
```json
{
  "success": true,
  "data": null,
  "message": "Vendedor eliminado exitosamente",
  "timestamp": "2024-01-01T16:00:00.000Z",
  "statusCode": 200
}
```

#### Consultar Clientes de Vendedor

**GET** `/api/v1/vendedores/{id}/clientes`

**Headers:**
- `X-API-Key: tu_api_key_aqui`

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "vendedor": "JUAN PEREZ",
    "id_vendedor": "507f1f77bcf86cd799439011",
    "total_clientes": 2,
    "clientes": [
      {
        "Cliente": "123456789",
        "Nombre_Cliente": "EMPRESA DE PRUEBA LTDA",
        "Saldo": 1500000.00,
        "Nombre_Vendedor": "JUAN PEREZ"
      }
    ]
  },
  "message": "Clientes del vendedor",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 200
}
```

### 4. Administración

#### Obtener Estadísticas

**GET** `/api/v1/admin/estadisticas`

**Headers:**
- `X-API-Key: tu_api_key_aqui`

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "clientes": {
      "total": 150,
      "activos": 150
    },
    "vendedores": {
      "total": 10
    },
    "pagos": {
      "total_registrados": 250
    },
    "cartera": {
      "saldo_total": 150000000.00,
      "moneda": "COP"
    },
    "fecha_consulta": "2024-01-01T00:00:00.000Z"
  },
  "message": "Estadísticas generales",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 200
}
```

#### Listar Usuarios

**GET** `/api/v1/admin/usuarios`

**Headers:**
- `X-API-Key: tu_api_key_aqui`

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439010",
      "correo": "admin@empresa.com",
      "nombre": "ADMINISTRADOR",
      "rol": "admin",
      "fecha_creacion": "2024-01-01T00:00:00.000Z",
      "ultimo_login": "2024-01-01T14:00:00.000Z"
    }
  ],
  "message": "Usuarios listados exitosamente",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 200
}
```

### 5. Utilidades

#### Endpoint de Prueba

**GET** `/api/v1/test`

**Headers:**
- `X-API-Key: tu_api_key_aqui`

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "mensaje": "API externa funcionando correctamente",
    "version": "1.0.0",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "api_key_valida": true,
    "permisos": ["clientes:read", "clientes:write"]
  },
  "message": "Prueba exitosa",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 200
}
```

#### Listar Permisos Disponibles

**GET** `/api/v1/permisos`

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "permisos": [
      "clientes:read",
      "clientes:write",
      "clientes:update",
      "clientes:delete",
      "vendedores:read",
      "vendedores:write",
      "vendedores:update",
      "vendedores:delete",
      "pagos:read",
      "pagos:write",
      "cartera:read",
      "admin:full",
      "admin:api_keys",
      "admin:estadisticas"
    ],
    "descripcion": {
      "clientes:read": "Lectura de clientes",
      "clientes:write": "Creación de clientes",
      // ... más descripciones
    }
  },
  "message": "Permisos disponibles",
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
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 401
}
```

### 403 - Prohibido
```json
{
  "success": false,
  "data": null,
  "message": "No tiene permisos para realizar esta operación: clientes:write",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 403
}
```

### 404 - No Encontrado
```json
{
  "success": false,
  "data": null,
  "message": "Cliente no encontrado",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 404
}
```

### 409 - Conflicto
```json
{
  "success": false,
  "data": null,
  "message": "Ya existe un cliente con este NIT",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 409
}
```

### 429 - Demasiadas Solicitudes
```json
{
  "success": false,
  "data": null,
  "message": "Límite de 1000 requests por hora alcanzado",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "statusCode": 429
}
```

## 🔒 Seguridad

- Las API Keys tienen un límite de requests por hora (configurable)
- Las API Keys pueden ser desactivadas o eliminadas en cualquier momento
- Todas las contraseñas de vendedores son encriptadas automáticamente
- Se registra la actividad de todas las API Keys para auditoría

## 📞 Soporte

Para cualquier consulta o soporte técnico, contacta al administrador de tu cuenta o al equipo de desarrollo.

---

**Última actualización:** Enero 2024