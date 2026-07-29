import { NextRequest, NextResponse } from "next/server";
import { firestoreAdmin } from "@/lib/firebase-admin";
import { requireAppAdmin } from "@/lib/app-admin";
import { requireAuth, getErrorStatus, AuthHttpError } from "@/lib/api-auth";
import { sendBulkNewsletter } from "@/lib/newsletter";
import { enforceRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

export interface NewsletterSubscriber {
  id: string;
  email: string;
  subscribedAt: string;
  source: string;
}

/**
 * GET /api/app-admin/newsletter
 * Lista todos los suscriptores del boletín.
 */
export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(request, "api");
  if (limited) return limited;

  try {
    const { uid } = await requireAuth(request);
    await requireAppAdmin(uid);

    const snap = await firestoreAdmin
      .collection("c_newsletter_subscribers")
      .orderBy("subscribedAt", "desc")
      .get();

    const subscribers: NewsletterSubscriber[] = [];
    snap.forEach((doc) => {
      const data = doc.data();
      subscribers.push({
        id: doc.id,
        email: data.email || "",
        subscribedAt: data.subscribedAt?.toDate?.()?.toISOString?.() ?? null,
        source: data.source || "desconocido",
      });
    });

    return NextResponse.json({ subscribers, total: subscribers.length });
  } catch (error) {
    const status = getErrorStatus(error, 500);
    if (error instanceof AuthHttpError) {
      return NextResponse.json({ error: error.message }, { status });
    }
    logger.error({ message: "[app-admin/newsletter] Error listando suscriptores", error });
    return NextResponse.json({ error: "Error al cargar suscriptores" }, { status: 500 });
  }
}

/**
 * POST /api/app-admin/newsletter
 * Envía un boletín a todos los suscriptores.
 * Cuerpo: { subject: string, content: string (HTML) }
 */
export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "api");
  if (limited) return limited;

  try {
    const { uid } = await requireAuth(request);
    await requireAppAdmin(uid);

    const body = (await request.json().catch(() => null)) as {
      subject?: string;
      content?: string;
    } | null;

    const subject = body?.subject?.trim();
    const content = body?.content?.trim();

    if (!subject) {
      return NextResponse.json({ error: "El asunto es obligatorio" }, { status: 400 });
    }
    if (!content) {
      return NextResponse.json({ error: "El contenido es obligatorio" }, { status: 400 });
    }

    // Obtener todos los suscriptores
    const snap = await firestoreAdmin.collection("c_newsletter_subscribers").get();
    const emails: string[] = [];
    snap.forEach((doc) => {
      const data = doc.data();
      if (data.email) emails.push(data.email);
    });

    if (emails.length === 0) {
      return NextResponse.json({ error: "No hay suscriptores para enviar el boletín" }, { status: 400 });
    }

    const result = await sendBulkNewsletter(subject, content, emails);

    return NextResponse.json({
      message: "Boletín enviado",
      total: emails.length,
      success: result.success,
      failed: result.failed,
    });
  } catch (error) {
    const status = getErrorStatus(error, 500);
    if (error instanceof AuthHttpError) {
      return NextResponse.json({ error: error.message }, { status });
    }
    logger.error({ message: "[app-admin/newsletter] Error enviando boletín", error });
    return NextResponse.json({ error: "Error al enviar el boletín" }, { status: 500 });
  }
}
