# Chat de la Iglesia (DeepSeek)

## Objetivo

Este módulo agrega una página de chat enfocada **solo** en contenido oficial de La Iglesia de Jesucristo de los Santos de los Últimos Días.

## Alcance funcional

- Ruta: `/church-chat`.
- Historial de conversaciones en `localStorage` (cliente).
- Botón para crear un chat nuevo.
- Restricción temática por *system prompt*:
  - Manuales y textos oficiales de la Iglesia.
  - Evangelio de Jesucristo y Escrituras (Antiguo/Nuevo Testamento) según interpretación oficial de la Iglesia.
  - Si el usuario sale del tema, el asistente responde que el chat es exclusivo para temas de la Iglesia.
- Verificación de noticias oficiales recientes:
  - Se consulta el RSS de Newsroom de la Iglesia.
  - Se adjunta como contexto al prompt para preguntas de actualidad.

## Variables de entorno

Agregar al archivo `.env`:

```bash
# Se reutiliza para changelog + chat
DEEPSEEK_API_KEY=tu_api_key
# opcional para endpoint del chat
DEEPSEEK_CHAT_MODEL=deepseek-v4-flash
```

Si `DEEPSEEK_CHAT_MODEL` no está definida, el sistema usa `deepseek-v4-flash`.

## Endpoints

- `POST /api/church-chat`
  - Entrada: `{ message: string, history: Array<{role, content}> }`
  - Salida: `{ answer: string, contextNews: string }`

## Notas de seguridad

- No se hardcodean secretos.
- Validación de entrada con Zod.
- El backend evita exponer la API key al cliente.
