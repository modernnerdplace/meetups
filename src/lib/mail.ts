import nodemailer, { type Transporter } from "nodemailer";
import { smtpConfig } from "@/lib/env";

let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  const config = smtpConfig();
  if (!config) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    });
  }
  return transporter;
}

export type MailResult = { delivered: boolean };

/** Verstuurt een mail. Zonder SMTP-instellingen belandt de inhoud in de console,
 *  zodat je lokaal gewoon kunt inloggen. */
export async function sendMail(message: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<MailResult> {
  const config = smtpConfig();
  const transport = getTransport();
  if (!config || !transport) {
    console.info(
      `[mail] SMTP is not configured, printing instead.\n  to: ${message.to}\n  subject: ${message.subject}\n${message.text}`,
    );
    return { delivered: false };
  }
  await transport.sendMail({
    from: config.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  return { delivered: true };
}
