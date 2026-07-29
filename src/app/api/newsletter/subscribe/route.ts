import { NextRequest, NextResponse } from "next/server";
import { firestoreAdmin } from "@/lib/firebase-admin";
import { sendWelcomeEmail } from "@/lib/newsletter";
import logger from "@/lib/logger";

/**
 * POST /api/newsletter/subscribe
 * Suscribe un email al boletín de noticias.
 * Cuerpo: { email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { email?: string } | null;
    const email = body?.email?.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    // Verificar si ya está suscrito
    const existing = await firestoreAdmin
      .collection("c_newsletter_subscribers")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json({ message: "Ya estás suscrito al boletín", subscribed: true });
    }

    // Guardar en Firestore
    await firestoreAdmin.collection("c_newsletter_subscribers").add({
      email,
      subscribedAt: new Date(),
      source: "register",
    });

    // Enviar email de bienvenida (no bloqueante)
    sendWelcomeEmail(email).catch((err) => {
      logger.error({ message: "[newsletter] Error enviando welcome email", error: err });
    });

    return NextResponse.json({ message: "Suscripción exitosa", subscribed: true });
  } catch (error) {
    logger.error({ message: "[newsletter] Error en subscribe", error });
    return NextResponse.json({ error: "Error al procesar la suscripción" }, { status: 500 });
  }
}
