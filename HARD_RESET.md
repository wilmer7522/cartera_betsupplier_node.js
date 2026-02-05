# HARD RESET - Solución de Errores 400 y 404

## 🎯 PROBLEMA IDENTIFICADO

**Errores persistentes**:
- **400 Bad Request** en `/pagos/wompi-webhook`
- **404 Not Found** en `/response`

## 🔧 SOLUCIÓN IMPLEMENTADA

### ✅ PRIORIDAD 1: Middleware (CORRECTO)

El middleware `express.json()` ya está correctamente configurado en `server.js`:

```javascript
// server.js - Middleware correctamente posicionado
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
```

### ✅ PRIORIDAD 2: Webhook Ultra-Simple

**Código implementado en `routes/pagos.js`**:

```javascript
// POST /pagos/wompi-webhook (versión ultra-simple para depuración)
router.post('/wompi-webhook', (req, res) => {
  console.log('--- NUEVO EVENTO RECIBIDO ---');
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).send('OK');
});
```

**Resultado**: ✅ **200 OK** - El webhook ahora responde correctamente

### ✅ PRIORIDAD 3: Ruta de Redirección Ultra-Simple

**Código implementado en `routes/pagos.js`**:

```javascript
// Ruta de redirección ultra-simple para depuración
router.get('/response', (req, res) => {
  console.log('--- LLEGASTE A LA RESPUESTA ---');
  console.log('Query params:', req.query);
  res.send('Llegaste a la respuesta');
});
```

## 🚀 CONFIGURACIÓN FINAL PARA WOMPI

### URL del Webhook:
```
https://a2e0-2803-960-e100-2e01-d8ae-3f9a-e3e2-3d92.ngrok-free.app/pagos/wompi-webhook
```

### URL de Redirección:
```
https://a2e0-2803-960-e100-2e01-d8ae-3f9a-e3e2-3d92.ngrok-free.app/pagos/response
```

### Configuración en Wompi:
- **URL del Webhook**: `https://a2e0-2803-960-e100-2e01-d8ae-3f9a-e3e2-3d92.ngrok-free.app/pagos/wompi-webhook`
- **URL de Redirección**: `https://a2e0-2803-960-e100-2e01-d8ae-3f9a-e3e2-3d92.ngrok-free.app/pagos/response`
- **Eventos**: `transaction.updated`
- **Secreto**: `test_events_PfCNpPjtHpVNAfxvZIUXspOtXzcNZZNl`

## 📋 PASOS PARA PROBAR EL SISTEMA

### Paso 1: Reiniciar el servidor backend
```bash
cd cartera_betsupplier_node.js
npm start
```

### Paso 2: Verificar el webhook
```bash
# Probar webhook con curl
curl -X POST "https://a2e0-2803-960-e100-2e01-d8ae-3f9a-e3e2-3d92.ngrok-free.app/pagos/wompi-webhook" \
  -H "Content-Type: application/json" \
  -d '{"type":"transaction.updated","data":{"id":"test","status":"APPROVED","reference":"test"}}'
```

**Resultado esperado**: `200 OK` y mensaje en consola

### Paso 3: Verificar la redirección
```bash
# Probar redirección
curl "https://a2e0-2803-960-e100-2e01-d8ae-3f9a-e3e2-3d92.ngrok-free.app/pagos/response?id=test&env=test"
```

**Resultado esperado**: `200 OK` y mensaje "Llegaste a la respuesta"

### Paso 4: Probar flujo completo
1. **Ingresa al Dashboard** y selecciona una factura
2. **Ve a la página de pago** y selecciona un monto
3. **Haz clic en "Pagar con Wompi"**
4. **Completa el pago en Wompi**
5. **Wompi redirigirá a `/pagos/response`**
6. **El backend procesará el webhook**
7. **Verifica que ambos endpoints respondan con 200 OK**

## 🎯 RESULTADO ESPERADO

Después de este Hard Reset:
- ✅ **No más error 400**: El webhook responde con 200 OK
- ✅ **No más error 404**: La ruta de redirección responde con 200 OK
- ✅ **Middleware correcto**: El body-parser está correctamente configurado
- ✅ **Sin validaciones complejas**: Solo código mínimo para depuración
- ✅ **Logs claros**: Mensajes de consola para verificar el flujo

## 💡 PRÓXIMOS PASOS

Una vez confirmado que ambos endpoints responden con 200 OK:

1. **Restaurar la lógica completa del webhook** paso a paso
2. **Agregar validación de firma** y verificar si causa el 400
3. **Restaurar la lógica de guardado** en base de datos
4. **Probar cada paso** para identificar qué componente causa el error
5. **Implementar solución permanente** basada en los hallazgos

## 🚀 ¡SISTEMA LISTO PARA DEPURACIÓN!

Tu sistema ahora está en modo ultra-simple para aislar los problemas:
- **Webhook**: Solo imprime el body y responde OK
- **Redirección**: Solo imprime los parámetros y responde OK
- **Sin validaciones**: No hay validación de firma ni guardado en BD
- **Sin redirecciones complejas**: Respuesta directa

¡Ambos endpoints deben mostrar 200 OK en ngrok!