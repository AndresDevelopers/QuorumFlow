# Guía de Despliegue

## Entornos

### Desarrollo (Development)
- **URL**: `dev.iglesiaelderes.com`
- **Rama**: `develop`
- **Base de Datos**: Firestore en modo desarrollo
- **Autenticación**: Modo prueba habilitado

### Staging
- **URL**: `staging.iglesiaelderes.com`
- **Rama**: `staging`
- **Base de Datos**: Firestore en modo producción (datos de prueba)
- **Autenticación**: Modo producción con restricciones

### Producción
- **URL**: `app.iglesiaelderes.com`
- **Rama**: `main`
- **Base de Datos**: Firestore en modo producción
- **Autenticación**: Modo producción completo

## Proceso de Despliegue

### Despliegue Automático (CI/CD)
Cada push a las ramas `develop`, `staging` o `main` activa el flujo de CI/CD correspondiente.

### Despliegue Manual

#### 1. Preparar la versión
```bash
# Asegurarse de estar en la rama correcta
git checkout main

# Obtener los últimos cambios
git pull origin main

# Instalar dependencias
npm ci

# Construir la aplicación
npm run build
```

#### 2. Desplegar Frontend
```bash
# Iniciar sesión en Firebase
firebase login

# Desplegar hosting
firebase deploy --only hosting
```

#### 3. Desplegar Funciones
```bash
cd functions
npm ci
npm run build
firebase deploy --only functions
```

#### 4. Desplegar Reglas de Seguridad
```bash
firebase deploy --only firestore:rules,storage:rules
```

## Rollback

### Frontend
```bash
# Ver despliegues anteriores
firebase hosting:channel:list

# Revertir a una versión anterior
firebase hosting:rollback VERSION_ID
```

### Funciones
```bash
# Listar despliegues anteriores
firebase functions:log --only FUNCTION_NAME

# Revertir a una versión anterior
# 1. Revisar el commit de la versión estable
git checkout COMMIT_HASH

# 2. Desplegar la versión específica
firebase deploy --only functions
```

## Variables de Entorno

### Frontend
Las variables de entorno deben configurarse en:
- `.env.local` para desarrollo local
- Firebase Hosting para producción

### Funciones
Configurar en Firebase Console:
```bash
firebase functions:config:set app.env="production"
```

## Monitoreo
- **Errores**: Sentry
- **Rendimiento**: Firebase Performance Monitoring
- **Uso**: Google Analytics 4

## Mantenimiento

### Actualizaciones de Seguridad
1. Monitorear dependencias con `npm audit`
2. Actualizar paquetes regularmente
3. Revisar alertas de seguridad de GitHub

### Copias de Seguridad
- **Frecuencia**: Diaria
- **Retención**: 30 días
- **Ubicación**: Google Cloud Storage

## Escalabilidad
- **Firestore**: Escalado automático
- **Funciones**: Hasta 1000 instancias concurrentes
- **Hosting**: CDN global con edge caching
