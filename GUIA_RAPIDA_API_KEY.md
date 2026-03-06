# 🚀 GUÍA RÁPIDA - Generar API Key para Uso Externo

## ✅ ¿Qué tienes listo?

Tu API externa para aplicaciones web está completamente implementada y lista para usar. Solo necesitas generar una API Key para que las aplicaciones externas puedan acceder a tu sistema.

## 🔑 PASO 1: Obtener tu JWT Token de Administrador

Para generar una API Key, necesitas un JWT Token de administrador. Sigue estos pasos:

### Opción A: Desde el Panel de Administración (Recomendado)

1. **Inicia sesión** en tu panel de administración: `https://portal.betsupplier.co`
2. **Abre las herramientas de desarrollo** del navegador:
   - Chrome/Edge: Presiona `F12` o clic derecho → "Inspeccionar"
   - Firefox: Presiona `F12` o clic derecho → "Inspeccionar elemento"
3. **Ve a la pestaña "Application"** (o "Almacenamiento" en algunos navegadores)
4. **Busca en "Local Storage"** → Selecciona `https://portal.betsupplier.co`
5. **Encuentra la clave "token"** y copia su valor
6. **¡Ese es tu JWT Token!**

### Opción B: Desde el Login

Si estás en desarrollo y usas `localhost`, también puedes obtener el token desde la consola después de iniciar sesión.

---

## 🔧 PASO 2: Generar la API Key

Tienes 3 formas de generar tu API Key:

### Forma 1: Script Rápido (Recomendado)

```bash
# Uso básico
node crear_api_key.js "TU_JWT_TOKEN_AQUÍ"

# Con parámetros personalizados
node crear_api_key.js "TU_JWT_TOKEN" "Nombre de tu App" "clientes:read,clientes:write,vendedores:read" 2000
```

**Ejemplo real:**
```bash
node crear_api_key.js "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." "Mi Sistema Externo" "clientes:read,clientes:write,vendedores:read" 1500
```

### Forma 2: Script Interactivo

```bash
node generar_api_key.js
```

Este script te hará preguntas paso a paso para configurar tu API Key.

### Forma 3: Directamente con curl

```bash
curl -X POST https://portal.betsupplier.co/api/v1/auth/crear-key \
  -H "Authorization: Bearer TU_JWT_TOKEN_AQUÍ" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre_app": "Mi Aplicación",
    "permisos": ["clientes:read", "clientes:write", "vendedores:read"],
    "limite_requests": 1000
  }'
```

---

## 📋 PASO 3: Elegir los Permisos Adecuados

### Permisos Básicos para Uso Externo

```bash
# Solo lectura (recomendado para consultas)
clientes:read,vendedores:read,pagos:read,cartera:read

# Lectura y escritura (para gestión completa)
clientes:read,clientes:write,clientes:update,vendedores:read,pagos:read,cartera:read

# Acceso administrativo (solo si necesitas gestionar todo)
admin:full
```

### Combinaciones Comunes

```bash
# Para consultas de cartera y pagos
clientes:read,pagos:read,cartera:read

# Para gestión de clientes completa
clientes:read,clientes:write,clientes:update,clientes:delete

# Para integración con sistemas ERP
clientes:read,clientes:write,vendedores:read,pagos:read,cartera:read
```

---

## 🚀 PASO 4: Comenzar a Usar tu API Key

Una vez generada tu API Key, podrás usarla en cualquier solicitud:

### Ejemplo con curl

```bash
# Listar clientes
curl -H "X-API-Key: TU_API_KEY_AQUÍ" \
     "https://portal.betsupplier.co/api/v1/clientes?page=1&limit=10"

# Consultar un cliente específico
curl -H "X-API-Key: TU_API_KEY_AQUÍ" \
     https://portal.betsupplier.co/api/v1/clientes/123456789

# Consultar cartera de un cliente
curl -H "X-API-Key: TU_API_KEY_AQUÍ" \
     https://portal.betsupplier.co/api/v1/clientes/123456789/cartera
```

### Ejemplo en JavaScript

```javascript
const axios = require('axios');

const API_KEY = 'TU_API_KEY_AQUÍ';
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
  } catch (error) {
    console.error('Error:', error.response.data.message);
  }
}

listarClientes();
```

---

## 📊 PASO 5: Monitorear y Gestionar tu API Key

### Verificar tu API Key

```bash
curl -H "X-API-Key: TU_API_KEY_AQUÍ" \
     https://portal.betsupplier.co/api/v1/auth/validar-key
```

### Listar todas tus API Keys (requiere permisos admin)

```bash
curl -H "X-API-Key: TU_API_KEY_AQUÍ" \
     https://portal.betsupplier.co/api/v1/admin/api-keys
```

### Desactivar una API Key (requiere permisos admin)

```bash
curl -X PUT -H "X-API-Key: TU_API_KEY_AQUÍ" \
     https://portal.betsupplier.co/api/v1/admin/api-keys/TU_API_KEY/activar
```

---

## ⚠️ RECOMENDACIONES DE SEGURIDAD

1. **Guarda tu API Key en un lugar seguro** - No la expongas en código público
2. **Usa permisos mínimos** - Solo otorga los permisos que realmente necesitas
3. **Monitorea el uso** - Revisa regularmente las estadísticas de uso
4. **Establece límites adecuados** - Ajusta el límite de requests según tu necesidad
5. **Desactiva si es necesario** - Puedes desactivar la API Key en cualquier momento

---

## 🆘 SOLUCIÓN DE PROBLEMAS

### Error 401 - Token no válido
- **Causa**: El JWT Token ha expirado o no es válido
- **Solución**: Inicia sesión nuevamente y obtén un nuevo token

### Error 403 - Permisos insuficientes
- **Causa**: No tienes permisos de administrador
- **Solución**: Asegúrate de iniciar sesión con una cuenta de administrador

### Error de conexión
- **Causa**: El servidor no está disponible
- **Solución**: Verifica que el servidor esté en funcionamiento

### API Key no funciona
- **Causa**: La API Key está desactivada o no tiene permisos
- **Solución**: Verifica el estado de la API Key y sus permisos

---

## 📞 ¿NECESITAS AYUDA?

- **Documentación completa**: `API_DOCUMENTATION.md`
- **Guía rápida**: `README_API.md`
- **Ejemplos de uso**: `example_usage.js`
- **Scripts de generación**: `crear_api_key.js` y `generar_api_key.js`

---

## 🎉 ¡LISTO!

Con estos pasos, tu API externa está lista para que cualquier aplicación web pueda:
- Consultar datos de clientes y vendedores
- Realizar operaciones CRUD completas
- Acceder a estadísticas y reportes
- Gestionar pagos y cartera

**¿Listo para comenzar?** Ejecuta el script de generación y comienza a integrar tu sistema externo con tu plataforma de cartera. 🚀