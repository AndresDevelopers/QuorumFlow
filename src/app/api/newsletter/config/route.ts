import { NextResponse } from "next/server";
import { isResendConfigured } from "@/lib/resend";

/**
 * GET /api/newsletter/config
 * Devuelve si el boletín está habilitado (Resend configurado).
 */
export async function GET() {
  return NextResponse.json({ enabled: isResendConfigured() });
}
