import { NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { fetchLatestChurchNews } from '@/lib/church-news';

const bodySchema = z.object({
  message: z.string().min(2).max(3000).optional(),
  imageDataUrl: z.string().max(6_000_000).regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, 'Imagen inválida').optional(),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).max(20).default([]),
}).refine((data) => Boolean((data.message && data.message.trim().length > 0) || data.imageDataUrl), {
  message: 'Debe incluir texto o imagen.',
});

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_CHAT_MODEL = process.env.DEEPSEEK_CHAT_MODEL ?? 'deepseek-v4-flash';

const systemPrompt = `Eres un asistente especializado exclusivamente en temas de La Iglesia de Jesucristo de los Santos de los Últimos Días.

Reglas obligatorias:
1) Solo puedes responder temas del evangelio de Jesucristo desde fuentes oficiales de la Iglesia (manuales, discursos, sitio oficial, Biblioteca del Evangelio, Biblia y obras canónicas) y su interpretación oficial.
2) Si el usuario pregunta algo no relacionado, responde con amabilidad que este chat es exclusivo de temas de la Iglesia.
3) No inventes citas. Si no estás seguro, dilo y sugiere revisar una fuente oficial.
4) Si el usuario pide noticias/actualidad, utiliza el bloque "CONTEXT_NEWS" para confirmar información reciente. Si no hay datos verificables allí, indícalo explícitamente.
5) Responde en español, claro y pastoral, incluyendo recomendaciones prácticas de estudio cuando ayude.`;

export async function POST(request: Request) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { error: 'DEEPSEEK_API_KEY no está configurada en el servidor.' },
      { status: 500 }
    );
  }

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const { message, imageDataUrl, history } = parsed.data;

  let contextNews = 'No se pudo verificar noticias oficiales recientes en este momento.';
  try {
    const news = await fetchLatestChurchNews();
    if (news.length > 0) {
      contextNews = news
        .map((item, index) => `${index + 1}. ${item.title} | ${item.publishedAt} | ${item.link}`)
        .join('\n');
    }
  } catch (error) {
    logger.warn({ error, message: 'No fue posible obtener noticias oficiales para church-chat.' });
  }

  const messages = [
    { role: 'system', content: `${systemPrompt}\n\nCONTEXT_NEWS:\n${contextNews}` },
    ...history.map((item) => ({ role: item.role, content: item.content })),
    {
      role: 'user',
      content: imageDataUrl
        ? [
            { type: 'text', text: message?.trim() || 'Analiza esta imagen dentro del contexto oficial de la Iglesia.' },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ]
        : message,
    },
  ];

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_CHAT_MODEL,
        messages,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ message: 'DeepSeek request failed in church-chat route', status: response.status, errorText });
      return NextResponse.json(
        { error: 'No se pudo obtener respuesta de DeepSeek.' },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const answer = data.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      return NextResponse.json({ error: 'Respuesta vacía de DeepSeek.' }, { status: 502 });
    }

    return NextResponse.json({ answer, contextNews });
  } catch (error) {
    logger.error({ error, message: 'Unexpected error in church-chat route' });
    return NextResponse.json({ error: 'Error inesperado al consultar la IA.' }, { status: 500 });
  }
}
