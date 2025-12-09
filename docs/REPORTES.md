# Guía de Reportes Anuales

## Resumen
La generación de reportes anuales utiliza dos Cloud Functions (`generateCompleteReport` y `generateReport`) que combinan datos de Firestore con una plantilla Word almacenada en Cloud Storage. El flujo ahora embebe automáticamente las imágenes de las actividades para replicar el diseño de referencia proporcionado (OneDrive, plantilla "Reporte Anual").

> **Nota:** El diseño visual sigue la referencia compartida por presidencia. Solo se reemplaza el contenido dinámico dentro de la plantilla actual; no cambies el archivo de base sin validar el layout con el documento fuente.

## Requisitos Previos
- Proyecto de Firebase con Firestore, Authentication y Storage habilitados.
- Plantilla DOCX basada en el diseño de referencia subida a `gs://<tu-bucket>/template/reporte.docx`.
- Colecciones con los datos esperados: `c_actividades`, `c_bautismos`, `c_futuros_miembros`, `c_nuevos_conversos`, `c_miembros`, `c_reporte_anual`.
- Variables VAPID configuradas si se usa la función de notificaciones (`firebase functions:config:set vapid.public_key="..." vapid.private_key="..."`).

## Configuración Paso a Paso
1. **Instalar dependencias**
   ```bash
   npm install
   cd functions
   npm install
   ```
   Las funciones incorporan el módulo interno `ModernImageModule` (Docxtemplater + `@xmldom/xmldom`) junto con `axios` para descargar y embeber imágenes.

2. **Configurar la plantilla**
   - Descarga la referencia de diseño compartida y ajusta tu plantilla Word siguiendo esa estructura.
   - Sube el archivo final como `template/reporte.docx` en Cloud Storage (misma ubicación usada antes).
   - Verifica permisos: el servicio de Cloud Functions necesita lectura sobre la carpeta `template/`.

3. **Datos e imágenes**
   - Las actividades deben incluir el arreglo `imageUrls` con URLs públicas o firmadas (HTTPS).
   - Opcional: añade campos `additionalText`, `context`, `learning`, `location` para que aparezcan en el documento.

4. **Emulación local**
   ```bash
   firebase emulators:start --only functions,firestore,storage
   ```
   Carga datos de prueba en las colecciones indicadas y coloca la plantilla en el emulador de Storage (`template/reporte.docx`).

5. **Despliegue**
   ```bash
   cd functions
   npm run build
   firebase deploy --only functions:generateCompleteReport,functions:generateReport
   ```

## Flujo de Datos
1. `generateCompleteReport`
   - Recupera todas las actividades (o solo las del año seleccionado).
   - Prepara metadatos de galería (`hasImages`, `imageCount`, miniaturas, captions).
   - Descarga las imágenes y las incrusta mediante Docxtemplater siguiendo el diseño del documento.
   - Devuelve un `base64` listo para descarga en el frontend.

2. `generateReport`
   - Versión resumida que reutiliza la misma canalización de imágenes para mantener consistencia.

Ambas funciones escriben registros en los logs de Firebase (`functions.logger`) para facilitar depuración.

## Checklist de Verificación
- [ ] Plantilla `template/reporte.docx` sincronizada con el diseño de referencia.
- [ ] Configuración VAPID (opcional) cargada si se usan notificaciones push.
- [ ] Campos `imageUrls` presentes en actividades con fotografías.
- [ ] Dependencias instaladas tanto en el proyecto web como en `functions/`.
- [ ] Permisos de Cloud Storage correctos para lectura por parte de las funciones.

Cumplir esta lista garantiza que la descarga de reportes incluya las imágenes y respete el layout solicitado.
