# Arquitectura del Sistema

## Stack Tecnológico
- **Frontend**: Next.js 15 con TypeScript
- **Backend**: Firebase Functions (Node.js 20)
- **Base de Datos**: Firestore (NoSQL)
- **Autenticación**: Firebase Authentication
- **Almacenamiento**: Firebase Storage
- **Hosting**: Firebase Hosting / Vercel
- **CI/CD**: GitHub Actions
- **Monitoreo**: Sentry
- **Reconocimiento de Voz**: Web Speech API (nativo del navegador)

## Estructura del Proyecto
```
├── src/
│   ├── app/            # Rutas de la aplicación (Next.js App Router)
│   ├── components/     # Componentes reutilizables
│   │   ├── shared/     # Componentes compartidos (voice-annotations, etc.)
│   │   ├── dashboard/  # Componentes específicos del dashboard
│   │   └── ui/         # Componentes UI primitivos
│   ├── contexts/       # Contextos de React
│   ├── lib/            # Utilidades y configuraciones
│   │   ├── types.ts    # Definiciones de TypeScript
│   │   └── collections.ts # Referencias a colecciones de Firestore
│   └── hooks/          # Hooks personalizados
├── public/             # Archivos estáticos
├── functions/          # Código de Cloud Functions
│   ├── src/
│   │   ├── services/   # Lógica de negocio
│   │   ├── types/      # Tipos de TypeScript
│   │   └── index.ts    # Punto de entrada
└── docs/               # Documentación
```

## Patrones de Diseño
- **Arquitectura por Características**: Organización del código por funcionalidad
- **Repository Pattern**: Para el acceso a datos
- **Factory Pattern**: Para la creación de objetos complejos
- **Observer Pattern**: Para manejo de eventos
- **Inyección de Dependencias**: Para un código más testeable y mantenible

## Flujo de Datos
1. **Frontend**: Componentes React que consumen la API
2. **Caché Local**: Sistema de caché en localStorage para optimización
3. **API**: Firebase Functions que actúan como capa intermedia
4. **Base de Datos**: Firestore para almacenamiento persistente
5. **Autenticación**: Firebase Auth para gestión de usuarios
6. **Almacenamiento**: Firebase Storage para archivos multimedia

### Sistema de Caché
El sistema implementa una estrategia de caché híbrida:
- **Cache-first**: Carga inicial desde caché local si está disponible
- **Background sync**: Actualización automática en segundo plano
- **Invalidación inteligente**: Limpieza automática después de mutaciones
- **Cross-tab sync**: Sincronización entre múltiples pestañas del navegador

## Funcionalidades Avanzadas

### Sistema de Caché Inteligente
Implementación de caché local para optimizar el rendimiento y la experiencia del usuario:

#### Características:
- **Persistencia local**: Almacenamiento en localStorage del navegador
- **Sincronización automática**: Actualización periódica cada 5 minutos
- **Invalidación consistente**: Limpieza automática tras operaciones CRUD
- **Comunicación entre pestañas**: Eventos personalizados y storage events
- **Fallback robusto**: Degradación elegante cuando el servidor no está disponible

#### Estrategia de Caché:
1. **Carga inicial**: Intenta cargar desde caché, luego actualiza desde servidor
2. **Operaciones CRUD**: Invalida caché inmediatamente y fuerza actualización
3. **Visibilidad de página**: Refresca datos al volver a la pestaña activa
4. **Auto-refresh**: Actualización automática cada 5 minutos en páginas visibles

#### Gestión de Versiones:
- **Timestamp**: Control de antigüedad de los datos
- **Version key**: Identificador único para cada actualización
- **Cross-tab events**: Propagación de cambios entre ventanas

### Sistema de Anotaciones por Voz
El componente `VoiceAnnotations` implementa reconocimiento de voz usando la Web Speech API:

#### Características:
- **Auto-inicio**: El reconocimiento se inicia automáticamente al abrir el diálogo
- **Idioma**: Configurado para español (es-ES)
- **Feedback visual**: Indicador de estado de grabación con animación
- **Fallback**: Entrada manual de texto como alternativa
- **Gestión de errores**: Manejo robusto de errores de la API de voz

#### Flujo de Trabajo:
1. Usuario abre diálogo de nueva anotación
2. Sistema inicia automáticamente el reconocimiento de voz
3. Usuario habla y el texto se transcribe en tiempo real
4. Usuario puede alternar entre voz y texto manual
5. Anotación se guarda en Firestore con metadatos de origen

#### Estructura del Componente:
- **Ubicación**: `src/components/shared/voice-annotations.tsx`
- **Exportación**: Disponible desde `src/components/shared/index.ts`
- **Importación**: `import { VoiceAnnotations } from '@/components/shared'`

#### Compatibilidad:
- **Navegadores soportados**: Chrome, Edge, Safari (con webkit)
- **Detección automática**: Verifica disponibilidad de la API antes de usar
- **Degradación elegante**: Funciona solo con texto si la voz no está disponible

## Decisiones de Diseño Clave
- **PWA**: Aplicación Web Progresiva para experiencia móvil
- **Mobile-First**: Diseño responsivo con enfoque en móviles
- **Seguridad**: Validación en frontend y backend
- **Rendimiento**: Carga bajo demanda y code-splitting
- **Accesibilidad**: Reconocimiento de voz para facilitar la entrada de datos
- **Experiencia de Usuario**: Auto-inicio del reconocimiento de voz al abrir diálogos
