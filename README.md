# 🕊️ QuorumFlow - Sistema de Gestión para Élderes

Una aplicación web moderna diseñada específicamente para la gestión eficiente del Quórum de los Élderes en la Iglesia de Jesucristo de los Santos de los Últimos Días. Este sistema digitaliza y optimiza las responsabilidades administrativas y pastorales de los élderes, facilitando el trabajo del secretario del quórum y mejorando la atención a los miembros.

## 📱 ¿Qué es exactamente?

**QuorumFlow** es una plataforma integral que centraliza:
- **Gestión de miembros**: Información completa de cada élder (datos personales, ministerios asignados, historial de llamamientos)
- **Seguimiento**: Registro de visitas ministeriales, casas visitadas, y necesidades espirituales identificadas
- **Asignación de responsabilidades**: Distribución y seguimiento de llamamientos dentro del quórum
- **Reportes y estadísticas**: Análisis de la actividad ministerial y participación sacramental
- **Comunicación**: Sistema de notificaciones para reuniones, actividades y recordatorios ministeriales

## 🚀 Características Principales

### Para el Secretario del Quórum
- **Dashboard personalizado** con vista rápida de pendientes y actividades
- **Registro digital de asistencia** a reuniones del quórum y actividades
- **Generación automática de reportes** mensuales para el presidente del quórum
- **Gestión de ministerios asignados** con seguimiento de progreso
- **Anotaciones por voz** con reconocimiento automático de voz en español
  - Auto-inicio del reconocimiento al abrir diálogos
  - Transcripción en tiempo real
  - Alternancia entre voz y texto manual
  - Compatibilidad con navegadores modernos

### Para los Élderes
- **Perfil personal actualizable** con información de contacto y disponibilidad
- **Calendario integrado** de actividades ministeriales y reuniones
- **Sistema de notificaciones** para nuevas asignaciones o cambios
- **Historial de servicio** y ministerios desempeñados

### Para el Presidencia del Quórum
- **Análisis visual** de la salud espiritual del quórum
- **Identificación de élderes inactivos** o que necesitan apoyo
- **Planificación estratégica** de ministerios y asignaciones
- **Comunicación masiva** segmentada por grupos o ministerios

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

5. **Ejecutar en desarrollo**
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

### Medidas de Seguridad
- **Autenticación Firebase** con encriptación de extremo a extremo
- **Validación de datos** en cliente y servidor
- **Rate limiting** para prevenir abuso
- **Headers de seguridad** configurados (CSP, HSTS, etc.)
- **Sin datos sensibles** almacenados localmente

### Privacidad de Datos
- **Cumplimiento con GDPR** y leyes de privacidad
- **Datos encriptados** en tránsito y en reposo
- **Acceso basado en roles** (Secretario, Élder, Presidencia)
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
  <p>Desarrollado con ❤️ para fortalecer el trabajo del Secretario del quórum</p>
  <p><em>"El servicio es la esencia del sacerdocio"</em></p>
</div>
