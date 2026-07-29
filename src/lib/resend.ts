import { Resend } from "resend";

const API_KEY = process.env.RESEND_API_KEY;

export const resend = API_KEY && API_KEY !== "re_placeholder" ? new Resend(API_KEY) : null;

export function isResendConfigured(): boolean {
  return resend !== null;
}
