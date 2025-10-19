# Esquema de Base de Datos

## Colecciones Principales

### Usuarios (`users`)
```typescript
interface User {
  uid: string;                    // ID único de Firebase Auth
  email: string;                 // Correo electrónico
  displayName: string;           // Nombre para mostrar
  photoURL?: string;             // URL de la foto de perfil
  phoneNumber?: string;          // Teléfono de contacto
  birthDate?: Date;              // Fecha de nacimiento
  address?: string;              // Dirección
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  baptismDate?: Date;            // Fecha de bautismo
  membershipStatus: 'visitor' | 'member' | 'counselor' | 'president' | 'secretary';
  groups: string[];              // IDs de grupos a los que pertenece
  roles: ('user' | 'counselor' | 'president' | 'secretary')[]; // Roles ministeriales (presidente y consejeros pueden ver Ajustes; solo 'secretary' administra roles)
  lastLogin?: Date;              // Último inicio de sesión
  createdAt: Date;               // Fecha de creación
  updatedAt: Date;               // Última actualización
}
```

### Grupos (`groups`)
```typescript
interface Group {
  id: string;                    // ID único del grupo
  name: string;                  // Nombre del grupo
  description: string;           // Descripción
  type: 'cell' | 'ministry' | 'department' | 'other';
  leaders: string[];             // IDs de los líderes
  members: string[];             // IDs de los miembros
  meetingDay: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
  meetingTime: string;           // Hora de reunión (HH:MM)
  meetingLocation: string;       // Lugar de reunión
  isActive: boolean;             // Si el grupo está activo
  createdAt: Date;
  updatedAt: Date;
}
```

### Eventos (`events`)
```typescript
interface Event {
  id: string;                    // ID único del evento
  title: string;                 // Título del evento
  description: string;           // Descripción detallada
  start: Date;                   // Fecha y hora de inicio
  end: Date;                     // Fecha y hora de finalización
  location: string;              // Ubicación del evento
  type: 'service' | 'meeting' | 'outreach' | 'social' | 'other';
  category: 'worship' | 'prayer' | 'bible_study' | 'fellowship' | 'training' | 'other';
  isRecurring: boolean;          // Si es un evento recurrente
  recurrenceRule?: string;       // Regla de recurrencia (RRULE)
  attendees: string[];           // IDs de usuarios confirmados
  maxAttendees?: number;         // Límite de asistentes
  imageUrl?: string;             // URL de la imagen del evento
  createdBy: string;             // ID del creador
  createdAt: Date;
  updatedAt: Date;
}
```

### Donaciones (`donations`)
```typescript
interface Donation {
  id: string;                    // ID único de la donación
  amount: number;                // Monto de la donación
  currency: string;              // Moneda (USD, MXN, etc.)
  type: 'tithe' | 'offering' | 'mission' | 'building' | 'other';
  paymentMethod: 'cash' | 'credit_card' | 'bank_transfer' | 'check' | 'other';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  donorId: string;               // ID del donante
  donorName: string;             // Nombre del donante
  isAnonymous: boolean;          // Si la donación es anónima
  receiptNumber: string;         // Número de recibo
  notes?: string;                // Notas adicionales
  createdAt: Date;
  updatedAt: Date;
}
```

### Asistencia (`attendance`)
```typescript
interface Attendance {
  id: string;                    // ID único del registro
  eventId: string;               // ID del evento
  userId: string;                // ID del usuario
  status: 'present' | 'absent' | 'late' | 'excused';
  checkInTime?: Date;            // Hora de registro
  checkOutTime?: Date;           // Hora de salida
  notes?: string;                // Notas adicionales
  recordedBy: string;            // ID del usuario que registró
  createdAt: Date;
}
```

### Anotaciones (`c_anotaciones`)
```typescript
interface Annotation {
  id: string;                    // ID único de la anotación
  text: string;                  // Contenido de la anotación
  source: 'dashboard' | 'council' | 'family-search' | 'missionary-work';
  isCouncilAction: boolean;      // Si es una acción para el consejo
  isResolved: boolean;           // Si la anotación ha sido resuelta
  createdAt: Timestamp;          // Fecha de creación
  updatedAt?: Timestamp;         // Fecha de última actualización
  createdBy?: string;            // ID del usuario que creó la anotación
  inputMethod?: 'voice' | 'text' | 'mixed'; // Método de entrada utilizado
}
```

**Notas sobre el sistema de anotaciones:**
- Soporta entrada por voz usando Web Speech API
- Auto-inicio del reconocimiento de voz al abrir diálogos
- Transcripción en tiempo real con fallback a texto manual
- Gestión de estados de grabación y errores de la API de voz

### Notificaciones (`c_notifications`)
```typescript
interface AppNotification {
  id: string;                        // ID del documento
  userId: string;                    // Usuario destinatario
  title: string;                     // Título visible en app y push
  body: string;                      // Mensaje descriptivo
  createdAt: Timestamp;              // Fecha de creación (serverTimestamp)
  isRead: boolean;                   // Estado de lectura en la campana
  actionUrl?: string;                // Ruta directa en la aplicación
  actionType?: 'navigate' | 'external';
  contextType?:
    | 'convert'
    | 'activity'
    | 'service'
    | 'member'
    | 'council'
    | 'baptism'
    | 'birthday'
    | 'investigator'
    | 'urgent_family'
    | 'missionary_assignment';       // Contexto semántico para navegación
  contextId?: string;                // Identificador del recurso asociado
}
```

**Eventos que generan notificaciones automáticas:**
- Creación de una nueva actividad (`c_actividades`).
- Marcado de una familia como urgente dentro de ministración (`c_ministracion`).
- Creación de una nueva asignación misional (`c_obra_misional_asignaciones`).

Cada evento dispara una Cloud Function que almacena la notificación para todos los usuarios y envía push a los dispositivos con suscripción activa.

## Subcolecciones

### Notas Pastorales (`users/{userId}/pastoral_notes`)
```typescript
interface PastoralNote {
  id: string;
  title: string;
  content: string;
  category: 'counseling' | 'prayer_request' | 'follow_up' | 'other';
  isConfidential: boolean;
  createdBy: string;             // ID del pastor/líder
  createdAt: Date;
  updatedAt: Date;
}
```

### Tareas (`groups/{groupId}/tasks`)
```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo: string[];          // IDs de usuarios asignados
  createdBy: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

## Índices
```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "start", "order": "ASCENDING" },
        { "fieldPath": "type", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "donations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "donorId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "membershipStatus", "order": "ASCENDING" },
        { "fieldPath": "displayName", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "c_anotaciones",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "source", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "c_anotaciones",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isCouncilAction", "order": "ASCENDING" },
        { "fieldPath": "isResolved", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

## Migraciones

### Crear una nueva migración
```bash
cd functions
npx firebase-tools firestore:make-migration add_new_field_to_users --project your-project-id
```

### Ejecutar migraciones pendientes
```bash
npx firebase-tools firestore:migrate --project your-project-id
```

### Revertir la última migración
```bash
npx firebase-tools firestore:migrate:rollback --project your-project-id
```

## Copias de Seguridad

### Crear copia de seguridad
```bash
gcloud firestore export gs://[BUCKET_NAME]/backups/$(date +%Y%m%d) --collection-ids=users,groups,events,donations
```

### Restaurar desde copia de seguridad
```bash
gcloud firestore import gs://[BUCKET_NAME]/backups/20230615/
```
