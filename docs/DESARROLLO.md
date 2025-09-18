# Guía de Desarrollo

## Requisitos Previos
- Node.js 20+
- npm 9+ o yarn 1.22+
- Firebase CLI
- Git
- Cuenta de Firebase
- Navegador compatible con Web Speech API (Chrome, Edge, Safari)

## Configuración del Entorno

### 1. Configuración del IDE
El proyecto incluye configuraciones recomendadas para VS Code en `.vscode/settings.json`:
- TypeScript auto-closing tags deshabilitado para mejor control manual
- Otras configuraciones del equipo pueden añadirse según necesidades

### 2. Clonar el repositorio
```bash
git clone [URL_DEL_REPOSITORIO]
cd iglesia-elderes
```

### 3. Instalar dependencias
```bash
# Instalar dependencias del frontend
npm install

# Instalar dependencias de las funciones
cd functions
npm install
cd ..
```

### 4. Configurar variables de entorno
1. Copiar el archivo `.env.example` a `.env.local`
2. Configurar las variables según tu entorno de desarrollo

### 5. Iniciar el servidor de desarrollo
```bash
# Frontend (puerto 9005 con Turbopack)
npm run dev

# Funciones de Firebase (en otra terminal)
cd functions
npm run serve
```

El servidor de desarrollo se ejecuta en [http://localhost:9005](http://localhost:9005) con Turbopack habilitado para builds más rápidos.

## Estructura del Código

### Convenciones de Código
- **TypeScript**: Tipado estricto
- **Estilos**: Tailwind CSS con convenciones BEM
- **Formato**: Prettier + ESLint
- **Commits**: Conventional Commits

### Estructura de Componentes
```typescript
components/
  feature-name/
    ComponentName.tsx     # Componente principal
    ComponentName.styles.ts # Estilos específicos
    ComponentName.test.tsx  # Pruebas unitarias
    index.ts              # Exportación pública
  shared/                 # Componentes compartidos
    voice-annotations.tsx # Sistema de anotaciones por voz
    index.ts              # Exportaciones del módulo shared
```

### Funcionalidades Especiales

#### Sistema de Caché de Miembros
El sistema implementa un mecanismo de caché local para optimizar la carga de datos de miembros:

**Características:**
- **Almacenamiento local**: Usa localStorage para persistir datos entre sesiones
- **Sincronización automática**: Actualiza datos cada 5 minutos cuando la página está visible
- **Invalidación inteligente**: Limpia caché automáticamente después de operaciones CRUD
- **Sincronización entre pestañas**: Propaga cambios entre múltiples ventanas del navegador

**Claves de caché utilizadas:**
```typescript
'members_cache'           // Datos de miembros serializados
'members_cache_timestamp' // Timestamp de la última actualización
'members_cache_version'   // Versión del caché para control de cambios
```

**Comportamiento de invalidación:**
- **Después de crear/editar**: Limpia caché y fuerza actualización
- **Después de eliminar**: Limpia todas las claves de caché y refresca datos
- **Cambio de visibilidad**: Verifica actualizaciones al volver a la pestaña
- **Eventos de storage**: Escucha cambios desde otras pestañas

#### Reconocimiento de Voz
El sistema incluye reconocimiento de voz nativo usando la Web Speech API:

**Configuración:**
```typescript
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = false;
recognition.interimResults = false;
recognition.lang = 'es-ES';
```

**Consideraciones de desarrollo:**
- Verificar disponibilidad de la API antes de usar
- Manejar errores de permisos del micrófono
- Implementar fallback para navegadores no compatibles
- Limpiar recursos al desmontar componentes
- Exportar componentes desde `src/components/shared/index.ts` para facilitar importaciones

## Flujo de Trabajo

### 1. Crear una rama
```bash
git checkout -b feature/nombre-de-la-funcionalidad
```

### 2. Desarrollar la funcionalidad
- Escribir código siguiendo las convenciones
- Añadir pruebas unitarias
- Actualizar la documentación si es necesario

### 3. Hacer commit de los cambios
```bash
git add .
git commit -m "feat: agregar funcionalidad X"
```

### 4. Subir los cambios
```bash
git push origin feature/nombre-de-la-funcionalidad
```

### 5. Crear un Pull Request
- Revisar los cambios
- Pasar las pruebas de CI/CD
- Obtener aprobación de al menos un revisor

## Pruebas

### Ejecutar pruebas unitarias
```bash
# Todas las pruebas
npm test

# Pruebas específicas
npm test -- ComponentName.test.tsx
```

### Pruebas de integración
```bash
cd functions
npm run test
```

### Pruebas de Funcionalidades de Voz
Para probar el reconocimiento de voz:

1. **Navegador requerido**: Chrome, Edge o Safari
2. **Permisos**: Permitir acceso al micrófono cuando se solicite
3. **Entorno**: Usar HTTPS en producción (requerido por la Web Speech API)
4. **Pruebas manuales**:
   - Abrir diálogo de nueva anotación
   - Verificar que el reconocimiento se inicie automáticamente
   - Hablar claramente en español
   - Verificar transcripción en tiempo real
   - Probar alternancia entre voz y texto manual

### Pruebas del Sistema de Caché
Para verificar el funcionamiento del caché de miembros:

1. **Carga inicial**:
   - Abrir la página de miembros
   - Verificar que los datos se cargan desde el servidor
   - Comprobar que se almacenan en localStorage

2. **Persistencia entre sesiones**:
   - Recargar la página
   - Verificar carga rápida desde caché
   - Confirmar actualización automática en segundo plano

3. **Sincronización entre pestañas**:
   - Abrir múltiples pestañas de la aplicación
   - Crear/editar/eliminar un miembro en una pestaña
   - Verificar que los cambios se reflejan automáticamente en otras pestañas

4. **Invalidación de caché**:
   - Realizar operaciones CRUD (crear, editar, eliminar miembros)
   - Verificar que el caché se limpia correctamente
   - Confirmar que se obtienen datos frescos del servidor

5. **Herramientas de desarrollo**:
   - Usar DevTools > Application > Local Storage
   - Inspeccionar las claves `members_cache*`
   - Verificar timestamps y versiones de caché

## Depuración

### Frontend
- Usar las DevTools del navegador
- Configuración de source maps en `next.config.js`

### Backend
- Logs en tiempo real: `firebase functions:log`
- Depuración local: Configurar VSCode para depurar Firebase Functions

## Recursos Útiles
- [Documentación de Next.js](https://nextjs.org/docs)
- [Documentación de Firebase](https://firebase.google.com/docs)
- [Guía de estilo de TypeScript](https://google.github.io/styleguide/tsguide.html)
