import nodemailer from 'nodemailer';
import { logger } from './logger';

/**
 * System email transport backed by the SMTP_FALLBACK_* environment settings
 * (the same configuration the database health alerts use). Distinct from the
 * per-user email notification channel, which is configured in the UI.
 */
export function isSystemMailerConfigured(): boolean {
  return Boolean(process.env.SMTP_FALLBACK_HOST);
}

export async function sendSystemEmail(
  to: string,
  subject: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const smtpHost = process.env.SMTP_FALLBACK_HOST;
  const smtpPort = parseInt(process.env.SMTP_FALLBACK_PORT || '587', 10);
  const smtpUser = process.env.SMTP_FALLBACK_USER;
  const smtpPass = process.env.SMTP_FALLBACK_PASS;
  const emailFrom = process.env.SMTP_FALLBACK_FROM || 'pricestalker@localhost';

  if (!smtpHost) {
    return { success: false, error: 'SMTP_FALLBACK_HOST is not set' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      tls: {
        rejectUnauthorized: false,
      }
    });

    await transporter.sendMail({ from: emailFrom, to, subject, text });
    return { success: true };
  } catch (error: any) {
    logger.error(`Mailer | Failed to send "${subject}"`, 'System', error);
    return { success: false, error: error.message };
  }
}
