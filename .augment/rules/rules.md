---
type: "always_apply"
description: "Rules General"
---

## **🚨 MANDATOS CRÍTICOS (CALIDAD Y SEGURIDAD)**

1. **Eficiencia DRY**: **ANTES** de escribir código, analiza el proyecto para reutilizar lógica. Máximo 3% de duplicidad.  
2. **Tooling & Supply Chain**:  
   * Gestor: pnpm (versiones exactas).  
   * 🛡️ **Inmutabilidad**: CI/CD con pnpm install \--frozen-lockfile.  
   * 🛑 **Scripts**: pnpm install \--ignore-scripts por defecto.  
3. **Integridad de Datos**: Prisma \+ RLS \+ Transacciones Financieras obligatorias.  
4. **Zero Hardcoding**: 🛑 **PROHIBIDO** hardcodear secretos. Uso estricto de .env para código, **tests y scripts**.  
5. **Flujo Atómico**: Cada cambio exige la actualización inmediata de su **documentación** y sus **tests**.  
   * **Evolución de Tests**: Si la lógica cambia, el test **debe** actualizarse para reflejar el nuevo comportamiento, pero **manteniendo su propósito original** de validar rigurosamente la función.  
6. **Validación Final**: pnpm lint \+ tsc \+ pnpm build.  
7. **Regla de Oro de Tests**: Jamás modificar un test para falsear un éxito. Si falla por error de código, arregla el código. Si falla por cambio de lógica intencional, actualiza el test con coherencia y rigor.

---

## **🏗️ ARQUITECTURA, CACHÉ Y ESCALADO (AIO)**

* **Feature-First**: Organización por funcionalidad en src/features/\[name\].  
* **Estrategia de Caché Multinivel**:  
  * ☁️ **Cloudflare (Edge)**: Caché agresiva para assets estáticos. Escudo anti-DDoS.  
  * ⚡ **Upstash Redis**: Uso obligatorio para **Rate Limiting** e **Idempotency Keys** (TTL 24h).  
  * 🚀 **Next.js Cache**: Uso de unstable\_cache o ISR con etiquetas de invalidación (revalidateTag).  
* **Patrones**: Repository Pattern, Server Actions, Error Boundary.  
* **Métricas**: Complejidad Cognitiva \< 15\. Deuda Técnica \< 5%.  
* **AIO (AI-Optimized)**: Automatización de contenido y escalado programático.

---

## **🌐 EXPERIENCIA GLOBAL E INTERNACIONALIZACIÓN**

* **Internacionalización (i18n)**:  
  * **Idiomas**: Soporte es / en.  
  * **Fallback**: Inglés (en) por defecto para evitar textos vacíos.  
  * **Routing**: Rutas localizadas obligatorias (ej: /en/dashboard).  
* **Theming (UI/UX)**:  
  * **Multi-Tema**: Soporte nativo Claro y Oscuro.  
  * **No Flash**: Implementación sin parpadeos de hidratación.

---

## **🔒 SEGURIDAD AVANZADA: TRANSACCIONAL Y ANTI-HACKING**

* **Headers**: HSTS, X-Frame-Options: DENY, nosniff, CSP Estricta y Permissions-Policy.  
* **CSRF & Origin**: Verificación de header Origin vs Host en cada mutación. SameSite Strict.  
* **Idempotencia Financiera**: Llaves obligatorias en pagos. Verificar en Upstash Redis antes de procesar.  
* **Protección de Identidad**: Respuestas de Auth genéricas ("Credenciales inválidas") para evitar enumeración.  
* **Blindaje de Archivos**: Escaneo Anti-Malware (VirusTotal/ClamAV) \+ Cuarentena obligatoria.  
* **Logs Seguros**: 🛑 **PROHIBIDO** console.log. Logger redactado (filtro de secretos) e invisible para el cliente.

---

## **🚀 UX, SEO 2026 Y SXO (SEARCH EXPERIENCE)**

* **Mobile-First**: Base 320px. Touch targets mín. 44px. PWA Offline.  
* **GEO & AEO (AI Optimization)**:  
  * Secciones de Q\&A optimizadas para fraseo de prompts reales.  
  * Bloques FAQ enriquecidos y señales de entidad para ser citado por IAs.  
  * Snippets optimizados para resultados de "cero clics".  
* **SXO (Search Experience)**: Emparejamiento de intención (*Intent Match*) y flujo de navegación dinámico.  
* **SEO Técnico**: Metadata dinámica localizada, JSON-LD y H1 único.

---

## **🛡️ VALIDACIÓN Y TIPADO ESTRICTO**

* **TypeScript**: Strict Mode. Prohibido el uso de any.  
* **Zod**: Única fuente de verdad para validación de datos.  
* **Cobertura**: Mínimo 80% en lógica de negocio y flujos financieros.

---

## **🎯 FILOSOFÍA IA**

1. **División de Poderes**: Cloudflare (Perímetro), Upstash (Velocidad), Prisma (Verdad).  
2. **Consistencia Atómica**: No existe código sin su test y documentación coherente.  
3. **Defensa en Profundidad**: Verifica siempre Headers, Origen e Idempotencia.  
4. **SEO 2026**: Ser encontrado (AEO), ser citado (GEO), ser escalado (AIO) y ser elegido (SXO).