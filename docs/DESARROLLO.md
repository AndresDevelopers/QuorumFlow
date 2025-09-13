# Guía de Desarrollo

## Requisitos Previos
- Node.js 18+
- npm 9+ o yarn 1.22+
- Firebase CLI
- Git
- Cuenta de Firebase

## Configuración del Entorno

### 1. Clonar el repositorio
```bash
git clone [URL_DEL_REPOSITORIO]
cd iglesia-elderes
```

### 2. Instalar dependencias
```bash
# Instalar dependencias del frontend
npm install

# Instalar dependencias de las funciones
cd functions
npm install
cd ..
```

### 3. Configurar variables de entorno
1. Copiar el archivo `.env.example` a `.env.local`
2. Configurar las variables según tu entorno de desarrollo

### 4. Iniciar el servidor de desarrollo
```bash
# Frontend
npm run dev

# Funciones de Firebase (en otra terminal)
cd functions
npm run serve
```

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
```

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
