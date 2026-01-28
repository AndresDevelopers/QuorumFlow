# Guía de Notificaciones

## Sistema Simplificado de Notificaciones

El sistema de notificaciones de QuorumFlow utiliza un enfoque simplificado que **no requiere configuración de claves VAPID** ni configuración adicional por parte del desarrollador.

### Características Principales

- **Activo por defecto**: Las notificaciones están activadas automáticamente para todos los usuarios
- **Sin configuración VAPID**: No necesitas generar ni configurar claves VAPID
- **Control del usuario**: Cada usuario puede desactivar las notificaciones desde Settings
- **Notificaciones in-app**: Todas las notificaciones se muestran en el header de la aplicación
- **Filtrado inteligente**: Solo se envían notificaciones a usuarios que las tienen activadas

### Variables de Entorno Requeridas

Solo necesitas las variables estándar de Firebase:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=tu-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=tu-app-id
FIREBASE_SERVICE_ACCOUNT_KEY={"key":"tu-service-account-key"}
```

## Cómo Funcionan las Notificaciones

### Estado por Defecto

- **Todos los usuarios nuevos** tienen las notificaciones **ACTIVADAS por defecto**
- No se requiere ninguna acción del usuario para empezar a recibir notificaciones
- Las notificaciones aparecen automáticamente en el header de la aplicación (campana)
- Las notificaciones push se envían a dispositivos móviles mediante Firebase Cloud Messaging (FCM)

### Desactivar Notificaciones (Opcional)

Si un usuario NO desea recibir notificaciones:

1. Inicia sesión en la aplicación
2. Ve a **Settings** (Configuración)
3. En la sección **Notifications**, desactiva el switch "Recibir Notificaciones"
4. A partir de ese momento, NO recibirá notificaciones de ningún tipo

## Cómo Probar las Notificaciones

### Probar Notificación de Familia Urgente

1. Ve a **Ministración** > **Necesidades Urgentes**
2. Selecciona una familia de la lista
3. Agrega una observación describiendo la necesidad
4. Haz clic en **Marcar como Urgente**
5. Todos los usuarios con notificaciones activadas recibirán:
   - Una notificación en la app (campana en el header)
   - Una notificación push en su dispositivo

## Solución de Problemas

### El switch de notificaciones no cambia

**Problema**: El switch en Settings no responde o vuelve a su estado anterior.

**Soluciones**:
1. Verifica que estés conectado a internet
2. Revisa la consola del navegador para ver errores de Firestore
3. Asegúrate de tener permisos para modificar tu perfil de usuario
4. Intenta cerrar sesión y volver a iniciar sesión

### No veo notificaciones en el header

**Problema**: Marqué una familia como urgente pero no aparece la notificación.

**Soluciones**:
1. Verifica que tu switch de notificaciones esté **ACTIVADO** en Settings
2. Recarga la página para actualizar las notificaciones
3. Revisa que la notificación se haya creado en Firestore (colección `c_notifications`)
4. Verifica que tu `userId` coincida con el de la sesión actual

## Arquitectura Técnica

### Flujo de Notificaciones

1. **Usuario marca familia como urgente** → `urgentClient.tsx`
2. **Sistema verifica preferencias** → `notification-helpers.ts` filtra usuarios con notificaciones activas
3. **Se crean notificaciones in-app** → Firestore (colección `c_notifications`)
4. **Notificaciones aparecen en el header** → `notification-bell.tsx` las muestra
5. **Notificaciones push enviadas** → API `/api/send-fcm-notification` envía mediante FCM
6. **Service worker recibe push** → `firebase-messaging-sw.js` maneja notificaciones
7. **Usuario hace clic** → Navega a `/ministering/urgent`

### Archivos Clave

- `src/app/(main)/settings/page.tsx` - Configuración de preferencias de notificaciones
- `src/app/(main)/ministering/urgent/urgentClient.tsx` - Lógica para marcar familias urgentes
- `src/lib/notification-helpers.ts` - Helpers para crear notificaciones (con filtrado)
- `src/components/notification-bell.tsx` - Componente de notificaciones en el header
- `src/app/api/send-fcm-notification/route.ts` - API para enviar notificaciones FCM
- `public/firebase-messaging-sw.js` - Service worker para manejar notificaciones push FCM
- `src/lib/firebase-messaging.ts` - Inicialización y manejo de FCM

### Modelo de Datos

**Colección `c_users`**:
```typescript
{
  userId: string,
  name: string,
  notificationsEnabled: boolean, // true por defecto
  // ... otros campos
}
```

**Colección `c_notifications`**:
```typescript
{
  id: string,
  userId: string,
  title: string,
  body: string,
  createdAt: Timestamp,
  isRead: boolean,
  contextType: 'urgent_family' | 'activity' | ...,
  actionUrl: string
}
```

**Colección `c_push_subscriptions`**:
```typescript
{
  userId: string,
  fcmToken: string // Token para notificaciones push FCM
}
```

## Verificación

Para verificar que todo está funcionando correctamente:

1. **Verifica el service worker**:
   - Abre DevTools > Application > Service Workers
   - Deberías ver el service worker registrado y activo

2. **Verifica la suscripción**:
   - Abre DevTools > Application > Storage > IndexedDB
   - Busca la colección `pushSubscriptions` en Firestore
   - Deberías ver tu suscripción guardada

3. **Prueba manual**:
   - Usa la consola del navegador para enviar una notificación de prueba:
   ```javascript
   fetch('/api/send-fcm-notification', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       title: 'Prueba',
       body: 'Esta es una notificación de prueba',
       url: '/'
     })
   })
   ```

## Seguridad

- Las claves VAPID privadas **NUNCA** deben exponerse en el cliente
- Solo la clave pública VAPID se incluye en el código del cliente
- Las notificaciones push se envían desde el servidor usando la clave privada
- Las suscripciones se almacenan de forma segura en Firestore

## Limitaciones Conocidas

- **iOS Safari**: Las notificaciones push solo funcionan si la app está instalada como PWA
- **Modo desarrollo**: Las notificaciones push están deshabilitadas en desarrollo
- **Permisos**: Si el usuario deniega los permisos, debe habilitarlos manualmente en la configuración del navegador
