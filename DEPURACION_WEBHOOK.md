# DEPURACIÓN DEL WEBHOOK DE WOMPI

## 🎯 PROBLEMA IDENTIFICADO

Tu webhook está devolviendo un **400 Bad Request**. He creado una versión depurada que identifica exactamente cuál de los 3 fallos técnicos comunes está ocurriendo.

## 🔧 SOLUCIÓN IMPLEMENTADA

### 1. WEBHOOK DEPURADO CREADO

**Archivo**: `routes/pagos.js` (actualizado con versión depurada)
**Backup**: `routes/pagos_webhook_backup.js` (versión original guardada)

### 2. SCRIPTS DE PRUEBA CREADOS

- **`test_webhook_debug.js`**: Prueba paso a paso el webhook
- **`reemplazar_webhook.js`**: Reemplaza el webhook con versión depurada

## 🔍 3 FALLOS TÉCNICOS QUE SE DEPURAN

### 1. MIDDLEWARE DE LECTURA (body-parser)

**Problema**: El servidor no tiene configurado `express.json()` correctamente antes de la ruta del webhook.

**Depuración**: El webhook verifica:
```javascript
if (!req.body || Object.keys(req.body).length === 0) {
  console.error('❌ [MIDDLEWARE] Body vacío o no parseado');
  return res.status(400).json({ error: 'Body vacío o no parseado por middleware' });
}
```

**Solución**: Asegúrate de tener en `server.js`:
```javascript
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
```

### 2. ESTRUCTURA DEL EVENTO

**Problema**: El código busca datos en `data.transaction` (estándar de Wompi) pero el body llega en otro formato.

**Depuración**: El webhook valida:
```javascript
if (!event.data) {
  console.error('❌ [ESTRUCTURA] No se encontró el campo "data" en el evento');
  return res.status(400).json({ error: 'Estructura de evento inválida: falta campo "data"' });
}
```

**Validación de campos**:
```javascript
const requiredFields = ['id', 'status', 'reference', 'amount_in_cents', 'customer_data', 'created_at'];
const missingFields = requiredFields.filter(field => !transaction[field]);
```

### 3. VALIDACIÓN DE FIRMA

**Problema**: La firma calculada no coincide con la firma enviada por Wompi.

**Depuración**: El webhook muestra:
```javascript
console.log('🔍 [FIRMA] Signature recibida:', signature);
console.log('🔍 [FIRMA] Payload para validación:', payload);
console.log('🔍 [FIRMA] Signature calculada:', expectedSignature);
console.log('🔍 [FIRMA] Coinciden las firmas?', signature === expectedSignature);
```

**Comparación detallada**:
```javascript
if (signature !== expectedSignature) {
  return res.status(400).json({ 
    error: 'Firma de webhook inválida.',
    debug: {
      received_signature: signature,
      calculated_signature: expectedSignature,
      payload: payload,
      wompi_event_secret: WOMPI_EVENT_SECRET
    }
  });
}
```

## 🚀 PASOS PARA DEPURAR

### Paso 1: Reiniciar el servidor
```bash
cd cartera_betsupplier_node.js
npm start
```

### Paso 2: Ejecutar la prueba de webhook
```bash
node test_webhook_debug.js
```

### Paso 3: Analizar los logs del servidor

Busca estos mensajes de depuración:

```
🔍 [MIDDLEWARE] - Verificación del body-parser
🔍 [FIRMA] - Validación de la firma de Wompi
🔍 [ESTRUCTURA] - Validación de la estructura del evento
🔍 [PROCESAMIENTO] - Procesamiento y guardado del pago
🔍 [ERROR] - Captura de cualquier error con stack trace
```

### Paso 4: Identificar el fallo específico

**Si ves**:
- `❌ [MIDDLEWARE] Body vacío o no parseado` → Problema con body-parser
- `❌ [FIRMA] Firma de webhook inválida` → Problema con validación de firma
- `❌ [ESTRUCTURA] Campos faltantes` → Problema con estructura del evento

## 📋 RESPUESTA DEL WEBHOOK

El webhook depurado siempre devuelve **200** para evitar reintentos de Wompi, incluso si hay errores:

```javascript
res.status(200).json({ 
  error: 'Error interno del servidor al procesar webhook.',
  debug: {
    message: error.message,
    stack: error.stack
  }
});
```

## 🔧 CONFIGURACIÓN FINAL

### URL del Webhook para Wompi:
```
https://18bad015eccc.ngrok-free.app/pagos/wompi-webhook
```

### Configuración en Wompi:
- **URL**: `https://18bad015eccc.ngrok-free.app/pagos/wompi-webhook`
- **Eventos**: `transaction.updated`
- **Secreto**: `test_events_PfCNpPjtHpVNAfxvZIUXspOtXzcNZZNl`

## 🎯 RESULTADO ESPERADO

Después de la depuración:
- ✅ El webhook procesará correctamente los pagos de Wompi
- ✅ Los pagos se registrarán automáticamente en MongoDB
- ✅ No dependerás de que el cliente haga clic en "Finalizar proceso"
- ✅ Eliminarás la posibilidad de perder pagos por abandono del proceso

## 💡 CONSEJOS FINALES

1. **Revisa los logs del servidor** después de cada prueba
2. **Verifica que ngrok esté activo** y mostrando tráfico
3. **Confirma que el secreto de eventos coincida** exactamente
4. **Asegúrate de que el body-parser esté configurado** antes de las rutas
5. **Prueba con el script de depuración** para identificar el fallo específico

¡Tu webhook está listo para ser depurado paso a paso!