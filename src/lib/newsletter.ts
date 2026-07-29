import { resend, isResendConfigured } from "./resend";
import logger from "./logger";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Sionflow <boletin@sionflow.app>";

/**
 * Envía un email de bienvenida al boletín a un nuevo suscriptor.
 */
export async function sendWelcomeEmail(email: string): Promise<boolean> {
  if (!isResendConfigured()) {
    logger.warn({ message: "[newsletter] Resend no configurado, email de bienvenida no enviado." });
    return false;
  }

  try {
    const { data, error } = await resend!.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: "Bienvenido al boletín de Sionflow",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1a1a1a; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px;">
            Boletin de Sionflow
          </h1>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Gracias por suscribirte a nuestro boletin. A partir de ahora recibiras noticias,
            actualizaciones y anuncios importantes de Sionflow.
          </p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
            Si no solicitaste esta suscripcion, puedes ignorar este mensaje.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin-top: 24px;" />
          <p style="color: #9ca3af; font-size: 12px;">
            Sionflow - Sistema de gestion para presidencias de Quorum y Sociedad de Socorro.
          </p>
        </div>
      `,
    });

    if (error) {
      logger.error({ message: "[newsletter] Error enviando email de bienvenida", error, email });
      return false;
    }

    logger.info({ message: "[newsletter] Email de bienvenida enviado", email, id: data?.id });
    return true;
  } catch (err) {
    logger.error({ message: "[newsletter] Error enviando email de bienvenida", error: err, email });
    return false;
  }
}

/**
 * Envía un boletín masivo a todos los suscriptores.
 * @returns Número de envíos exitosos.
 */
export async function sendBulkNewsletter(
  subject: string,
  htmlContent: string,
  subscribers: string[]
): Promise<{ success: number; failed: number }> {
  if (!isResendConfigured()) {
    logger.warn({ message: "[newsletter] Resend no configurado, boletín no enviado." });
    return { success: 0, failed: subscribers.length };
  }

  let success = 0;
  let failed = 0;

  for (const email of subscribers) {
    try {
      const { error } = await resend!.emails.send({
        from: FROM_EMAIL,
        to: [email],
        subject,
        html: htmlContent,
      });

      if (error) {
        logger.error({ message: "[newsletter] Error enviando boletín a suscriptor", error, email });
        failed++;
      } else {
        success++;
      }
    } catch (err) {
      logger.error({ message: "[newsletter] Error enviando boletín a suscriptor", error: err, email });
      failed++;
    }
  }

  logger.info({ message: "[newsletter] Envío masivo completado", success, failed });
  return { success, failed };
}
