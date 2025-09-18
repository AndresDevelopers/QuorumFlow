# Estrategia de Pruebas

## Tipos de Pruebas

### 1. Pruebas Unitarias
- **Objetivo**: Verificar el funcionamiento de componentes individuales
- **Herramientas**: Jest, React Testing Library
- **Cobertura Mínima**: 80% de líneas de código

### 2. Pruebas de Integración
- **Objetivo**: Verificar la interacción entre componentes
- **Herramientas**: Jest, Testing Library
- **Enfoque**: Pruebas de flujos completos

### 3. Pruebas E2E
- **Objetivo**: Verificar flujos completos de usuario
- **Herramientas**: Cypress
- **Cubrir**: Flujos críticos de la aplicación

## Estructura de Pruebas

```
tests/
  unit/
    components/
      Button.test.tsx
      Form.test.tsx
    utils/
      formatters.test.ts
      validators.test.ts
  integration/
    auth/
      login.flow.test.ts
    events/
      create-event.flow.test.ts
  e2e/
    auth.cy.ts
    events.cy.ts
  mocks/
    firebase.ts
    api.ts
```

## Configuración de Entorno de Pruebas

### Configuración de Jest
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.stories.tsx',
  ],
};
```

### Configuración de Cypress
```javascript
// cypress.config.js
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
  env: {
    apiUrl: 'http://localhost:5001/your-project/us-central1/api',
  },
});
```

## Pruebas de Componentes

### Ejemplo: Botón
```typescript
// tests/unit/components/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '@/components/Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## Pruebas de API

### Ejemplo: Autenticación
```typescript
// tests/integration/auth/login.flow.test.ts
import { login } from '@/services/auth';
import { mockAuth } from '@/tests/mocks/firebase';

describe('Login Flow', () => {
  beforeEach(() => {
    mockAuth.signInWithEmailAndPassword.mockClear();
  });

  it('should login with valid credentials', async () => {
    const mockUser = { uid: '123', email: 'test@example.com' };
    mockAuth.signInWithEmailAndPassword.mockResolvedValueOnce({
      user: mockUser,
    });

    const result = await login('test@example.com', 'password123');
    
    expect(result.user).toEqual(mockUser);
    expect(mockAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(
      'test@example.com',
      'password123'
    );
  });
});
```

## Pruebas E2E

### Ejemplo: Flujo de Inicio de Sesión
```typescript
// tests/e2e/auth.cy.ts
describe('Authentication', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should log in with valid credentials', () => {
    // Mock de la respuesta de la API
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 200,
      body: {
        user: {
          uid: '123',
          email: 'test@example.com',
        },
        token: 'mock-jwt-token',
      },
    }).as('loginRequest');

    // Llenar el formulario
    cy.get('input[name="email"]').type('test@example.com');
    cy.get('input[name="password"]').type('password123');
    
    // Enviar formulario
    cy.get('button[type="submit"]').click();

    // Verificar que se hizo la petición
    cy.wait('@loginRequest');
    
    // Verificar redirección
    cy.url().should('include', '/dashboard');
  });
});
```

## Pruebas de Rendimiento

### Lighthouse CI
```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI

on: [push]

jobs:
  lhci:
    name: Lighthouse CI
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Use Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm ci
      - run: npm run build
      - run: npm start &
      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli@0.9.0
          lhci autorun
```

## Pruebas de Accesibilidad

### Configuración de Jest Axe
```typescript
// jest.setup.js
import { toHaveNoViolations } from 'jest-axe';
import 'jest-axe/extend-expect';

expect.extend(toHaveNoViolations);
```

### Ejemplo de Prueba de Accesibilidad
```typescript
// tests/unit/components/AccessibleForm.test.tsx
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import AccessibleForm from '@/components/AccessibleForm';

it('should have no accessibility violations', async () => {
  const { container } = render(<AccessibleForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## Cobertura de Código

### Configuración de Cobertura
```json
// package.json
{
  "scripts": {
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  },
  "jest": {
    "collectCoverageFrom": [
      "src/**/*.{js,jsx,ts,tsx}",
      "!**/node_modules/**",
      "!**/vendor/**"
    ]
  }
}
```

### Generar Reporte de Cobertura
```bash
npm test -- --coverage --watchAll=false
```

## Pruebas de Carga

### Configuración de k6
```javascript
// tests/load/auth-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const url = 'http://localhost:3000/api/auth/login';
  const payload = JSON.stringify({
    email: 'test@example.com',
    password: 'password123',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'is status 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

## Pruebas de Seguridad

### OWASP ZAP
```bash
# Ejecutar ZAP en modo daemon
docker run -u zap -p 8080:8080 -i owasp/zap2docker-stable zap.sh -daemon \
  -host 0.0.0.0 -port 8080 -config api.disablekey=true \
  -config api.addrs.addr.name=.* -config api.addrs.addr.regex=true

# Ejecutar escaneo de seguridad
zap-cli quick-scan -s all \
  -r http://localhost:3000 \
  -l Medium \
  --spider
```

## Integración Continua

### GitHub Actions
```yaml
# .github/workflows/tests.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Use Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm ci
      - run: npm run build
      - run: npm test
        env:
          CI: true
          FIREBASE_CONFIG: '{}'
          NEXT_PUBLIC_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          # Otras variables de entorno necesarias
```

## Pruebas de Regresión Visual

### Configuración de Percy
```javascript
// .percy.js
module.exports = {
  version: 2,
  snapshot: {
    widths: [375, 768, 1280, 1920],
    minHeight: 1024,
    percyCSS: '.some-selector { display: none; }',
  },
  discovery: {
    networkIdleTimeout: 250,
    concurrency: 5,
  },
};
```

### Ejemplo de Prueba Visual
```typescript
// tests/visual/HomePage.visual-test.tsx
import { percySnapshot } from '@percy/puppeteer';
import { setup } from '../helpers';

describe('HomePage', () => {
  beforeEach(async () => {
    await page.goto('http://localhost:3000');
  });

  it('should display the home page', async () => {
    await expect(page).toMatch('Bienvenido');
    await percySnapshot(page, 'Home Page');
  });
});
```
