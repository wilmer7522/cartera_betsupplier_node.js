# Configuración del Webhook de Wompi

## Resumen de la Implementación

Se ha implementado un webhook de Wompi para asegurar el registro automático de pagos aprobados en tu base de datos MongoDB, eliminando la dependencia del clic del usuario en el botón "Finalizar proceso".

## Endpoints Implementados

### 1. Webhook de Wompi
- **Ruta**: `POST /api/payments/wompi-webhook`
- **Descripción**: Recibe eventos de Wompi cuando una transacción es actualizada
- **Validación**: Verifica la firma de Wompi usando el secreto de eventos
- **Procesamiento**: Guarda automáticamente pagos aprobados en MongoDB

### 2. Consulta de Estado de Pago
- **Ruta**: `GET /api/payments/estado/:transactionId`
- **Descripción**: Consulta si un pago ya fue procesado por el webhook
- **Uso**: Frontend verifica el estado sin depender del proceso manual

## Configuración en el Dashboard de Wompi

Para configurar el webhook en tu cuenta de Wompi:

1. **Inicia sesión** en tu cuenta de Wompi
2. **Ve a la sección de "Eventos"** en el dashboard
3. **Busca la configuración de Webhooks**
4. **Agrega una nueva URL de webhook** con la siguiente URL:

### URLs de Webhook

**Para desarrollo local (con ngrok recomendado):**
```
https://tudominio.ngrok.io/api/payments/wompi-webhook
```

**Para producción:**
```
https://api.portal.betsupplier.co/api/payments/wompi-webhook
```

5. **Selecciona los eventos** que deseas recibir:
   - `transaction.updated` (Recomendado para pagos)

6. **Guarda la configuración**

## Variables de Entorno

Asegúrate de tener configuradas las siguientes variables en tu `.env`:

```env
# Clave privada de Wompi para consultas API
WOMPI_SECRET=prv_test_ME5OhWtglvDF2AKWZzpwIGs91LTFuBCA

# Secreto de eventos de Wompi para validación de webhooks
WOMPI_EVENT_SECRET=test_events_PfCNpPjtHpVNAfxvZIUXspOtXzcNZZNl
```

## Flujo de Trabajo

### Antes (con dependencia del usuario):
1. Usuario paga en Wompi
2. Usuario debe hacer clic en "Finalizar proceso"
3. Frontend llama a `/pagos/confirmacion`
4. Backend consulta API de Wompi y guarda en MongoDB

### Después (con webhook automático):
1. Usuario paga en Wompi
2. Wompi envía webhook a tu endpoint automáticamente
3. Backend valida firma y guarda en MongoDB
4. Frontend consulta estado del pago
5. Muestra resumen sin depender del clic del usuario

## Beneficios

- ✅ **Registro automático**: Los pagos se guardan en MongoDB sin intervención del usuario
- ✅ **Mayor confiabilidad**: Elimina la dependencia del clic en "Finalizar proceso"
- ✅ **Validación de seguridad**: Firma de Wompi asegura que solo Wompi pueda enviar datos
- ✅ **Procesamiento asíncrono**: El webhook se procesa en el momento que Wompi aprueba el pago
- ✅ **Compatibilidad**: Mantén el endpoint manual para pruebas o casos especiales

## Pruebas

Para probar el webhook:

1. Configura la URL en el dashboard de Wompi
2. Realiza un pago de prueba
3. Verifica que el pago se registre automáticamente en MongoDB
4. Confirma que la página de respuesta muestre el estado correcto

## Notas Importantes

- El webhook es público y no requiere autenticación del usuario
- La validación de la firma es crucial para evitar registros falsos
- Los pagos procesados por webhook incluyen un flag `webhook_procesado: true`
- El endpoint manual `/pagos/confirmacion` sigue funcionando para compatibilidad