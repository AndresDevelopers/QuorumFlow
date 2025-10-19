# 🕊️ QuorumFlow - Sistema de Gestión para la Presidencia del Quórum

Una aplicación web moderna diseñada específicamente para la presidencia del Quórum de Élderes (presidente, consejeros y secretario) en la Iglesia de Jesucristo de los Santos de los Últimos Días. El sistema digitaliza y optimiza las responsabilidades administrativas y pastorales que recaen sobre la presidencia, facilitando la coordinación interna y el apoyo directo a los hogares ministrados.

## 📱 ¿Qué es exactamente?

**QuorumFlow** es una plataforma integral que centraliza:
- **Gestión de miembros**: Información completa de cada élder con visión consolidada para la presidencia
- **Seguimiento**: Registro de visitas ministeriales, hogares atendidos y necesidades espirituales priorizadas por la presidencia
- **Asignación de responsabilidades**: Distribución y seguimiento de llamamientos y ministraciones entre secretario, presidente y consejeros
- **Reportes y estadísticas**: Análisis de la actividad ministerial y participación sacramental para la toma de decisiones de la presidencia
- **Comunicación**: Sistema de notificaciones interno para reuniones de presidencia, consejos y recordatorios ministeriales

### Roles admitidos en la app
- **Secretario del Quórum (`secretary`)**: Responsable de la administración total, la gestión de permisos y la consolidación de reportes.
- **Presidente del Quórum (`president`)**: Acceso estratégico para revisar indicadores, asignar prioridades y coordinar las decisiones del consejo.
- **Consejeros del Quórum (`counselor`)**: Herramientas operativas para dar seguimiento a las familias y acciones delegadas.
- **Usuario en espera (`user`)**: Estado temporal sin acceso a datos hasta que la presidencia asigne un rol de liderazgo.

## 🚀 Características Principales

### Funciones clave para el Secretario del Quórum
- **Dashboard personalizado** con vista rápida de pendientes y actividades
- **Registro digital de asistencia** a reuniones del quórum y actividades
- **Generación automática de reportes** mensuales para el presidente del quórum
- **Gestión de ministerios asignados** con seguimiento de progreso
- **Anotaciones por voz** con reconocimiento automático de voz en español
  - Auto-inicio del reconocimiento al abrir diálogos
  - Transcripción en tiempo real
  - Alternancia entre voz y texto manual
  - Compatibilidad con navegadores modernos

### Funciones clave para los Consejeros del Quórum
- **Panel del consejero** con fichas de las familias y asignaciones ministeriales delegadas
- **Calendario compartido** de reuniones de presidencia y visitas programadas
- **Sistema de notificaciones** específico para tareas asignadas por el presidente o el secretario
  - Alertas inmediatas al programar nuevas actividades bajo su responsabilidad
  - Avisos cuando una familia se marca como urgente en ministración
  - Recordatorios de tareas relacionadas con la obra misional
- **Registro histórico de seguimiento** para documentar el acompañamiento a cada hogar

### Funciones clave para el Presidente del Quórum
- **Análisis visual** de la salud espiritual del quórum
- **Identificación de élderes inactivos** o que necesitan apoyo prioritario
- **Planificación estratégica** de ministerios y asignaciones junto al secretario
- **Comunicación masiva** segmentada por grupos o ministerios para dirigir iniciativas

## 🛠️ Tecnología y Arquitectura

### Stack Tecnológico Moderno
- **Next.js 15** con App Router para máxima performance
- **TypeScript** para código robusto y mantenible
- **Firebase** como backend sin servidor (Firestore, Auth, Functions)
- **Tailwind CSS** para diseño responsive mobile-first
- **PWA (Progressive Web App)** funciona offline como app nativa
- **Multi-idioma** Español/English con cambio instantáneo
- **Web Speech API** para reconocimiento de voz nativo del navegador

### Diseño Mobile-First
- **100% responsive** optimizado para teléfonos y tablets
- **Touch-friendly** con gestos intuitivos
- **Offline-first** funciona sin conexión a internet
- **Instalable** como app en dispositivos móviles

## 📋 Instalación y Configuración

### Requisitos Previos
- Node.js v20 o superior
- Cuenta de Firebase activa
- Conocimientos básicos de terminal/comandos

### Pasos de Instalación

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/tu-usuario/iglesia-digital.git
   cd iglesia-digital
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar Firebase**
   - Crear proyecto en [Firebase Console](https://console.firebase.google.com)
   - Habilitar: Authentication, Firestore Database, Storage, Functions
   - Copiar las credenciales en el archivo `.env`

4. **Variables de Entorno**
   Renombrar `.env.example` a `.env` y completar:
   ```bash
   # Firebase Configuration
   NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_dominio.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_bucket.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id

   # Sentry (opcional para tracking de errores)
   NEXT_PUBLIC_SENTRY_DSN=tu_sentry_dsn
   ```

5. **Configurar roles iniciales**
   - Completar el flujo de registro en la aplicación para crear la cuenta de administrador inicial.
   - Abrir la colección `users` en Firestore y actualizar el campo `role` de esa cuenta a un valor con privilegios (por ejemplo `admin`).
   - Mientras el campo permanezca como `user`, la cuenta seguirá viendo la página de acceso restringido.
   - Repetir el proceso para cada cuenta que requiera acceso completo y documentar los cambios según la política de auditoría.

6. **Ejecutar en desarrollo**
   ```bash
   npm run dev
   ```
   Abrir [http://localhost:9005](http://localhost:9005)

## 🔧 Desarrollo y Contribución

### Scripts Disponibles
- `npm run dev` - Servidor de desarrollo (puerto 9005 con Turbopack)
- `npm run build` - Build para producción
- `npm run start` - Servidor de producción
- `npm run lint` - Análisis de código
- `npm run test` - Ejecución de tests

### Estructura del Proyecto
```
src/
├── app/                    # Rutas y páginas principales
│   ├── (auth)/            # Autenticación (login/registro)
│   ├── (main)/            # App principal para usuarios autenticados
│   │   ├── dashboard/     # Panel principal
│   │   ├── members/       # Gestión de miembros
│   │   ├── reports/       # Reportes y estadísticas
│   │   └── settings/      # Configuración
├── components/            # Componentes reutilizables
│   ├── shared/           # Componentes compartidos (voice-annotations, etc.)
│   ├── members/          # Componentes específicos de miembros
│   ├── reports/          # Componentes de reportes
│   └── ui/              # Componentes UI genéricos
├── lib/                  # Utilidades y configuraciones
├── contexts/             # Contextos de React
├── hooks/                # Hooks personalizados
└── locales/              # Traducciones (es/en)
```

## 📊 Monitoreo y Rendimiento

### Optimizaciones Implementadas
- **Bundle optimizado** con tree-shaking y lazy loading
- **Imágenes optimizadas** con Next.js Image component
- **Caching inteligente** con Service Worker
- **Code splitting** automático por rutas

### Tracking de Errores con Sentry
- Configuración optimizada para mínimo impacto en performance
- Sampling inteligente: 100% en desarrollo, 2-10% en producción
- Filtrado automático de errores de navegador/extensiones
- Session Replay opcional y lazy-loaded

## 🔐 Seguridad y Privacidad

### Gestión de roles y acceso
- **Rol por defecto `user`**: Al registrarse, todas las cuentas nuevas se crean en Firestore con el campo `role: "user"` para garantizar el principio de menor privilegio.
- **Página de acceso restringido**: Cuentas con rol `user` verán automáticamente la página `no-permission`, donde se explica cómo solicitar elevación de privilegios y se ofrece el cierre de sesión seguro.
- **Roles de liderazgo**: Actualiza el campo `role` del usuario a `"president"` o `"counselor"` para otorgar acceso completo a las secciones operativas y a la página de Ajustes (sin visibilidad de Gestión de Roles). Usa `"secretary"` cuando el usuario deba administrar Ajustes y permisos (los valores heredados `"admin"` siguen normalizándose a secretario).
- **Auditoría**: Los cambios de rol deben registrarse en los logs administrativos y acompañarse de revisión periódica para asegurar el acceso mínimo necesario.

### Medidas de Seguridad
- **Autenticación Firebase** con encriptación de extremo a extremo
- **Validación de datos** en cliente y servidor
- **Rate limiting** para prevenir abuso
- **Headers de seguridad** configurados (CSP, HSTS, etc.)
- **Sin datos sensibles** almacenados localmente

### Privacidad de Datos
- **Cumplimiento con GDPR** y leyes de privacidad
- **Datos encriptados** en tránsito y en reposo
- **Acceso basado en roles** (Secretario, Presidente y Consejeros del quórum; las cuentas sin asignación permanecen bloqueadas)
- **Logs de auditoría** para acciones críticas
- **Eliminación segura** de datos personales

## 📱 Instalación como PWA

### En Dispositivos Móviles
1. Abrir la aplicación en el navegador
2. Buscar el botón "Agregar a pantalla de inicio"
3. Confirmar la instalación
4. La app funcionará offline como aplicación nativa

### Ventajas PWA
- **Sin App Store** - instalación directa desde web
- **Actualizaciones automáticas** sin intervención del usuario
- **Funciona offline** con sincronización automática
- **Tamaño mínimo** comparado con apps nativas

## 🤝 Contribuir al Proyecto

### Cómo Contribuir
1. Fork el repositorio
2. Crear rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add: nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

### Guías de Contribución
- Leer [CONTRIBUTING.md](CONTRIBUTING.md) para estándares de código
- Seguir [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Mantener actualizadas las traducciones en ambos idiomas
- Incluir tests para nuevas funcionalidades

### Cumplimiento de Estándares Personalizados
- Consultar la [Matriz de Cumplimiento](docs/COMPLIANCE.md) para conocer el estado de cada regla personalizada, brechas detectadas y próximos pasos priorizados.

## 📞 Soporte y Comunidad

### ¿Necesitas Ayuda?
- 📧 Email: [guachoboy@protonmail.com](mailto:guachoboy@protonmail.com)


### Reportar Problemas
- 🐛 [Bug Report](https://github.com/AndresDevelopers/QuorumFlow/issues/new?template=bug_report.md)
- ✨ [Feature Request](https://github.com/AndresDevelopers/QuorumFlow/issues/new?template=feature_request.md)
- 🔒 [Security Issue](https://github.com/AndresDevelopers/QuorumFlow/security/advisories/new)

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver archivo [LICENSE](LICENSE) para detalles.

---

<div align="center">
  <p>Desarrollado con ❤️ para fortalecer el trabajo de la Presidencia del quórum</p>
  <p><em>"El servicio es la esencia del sacerdocio"</em></p>
</div>
