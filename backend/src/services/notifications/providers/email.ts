import nodemailer from 'nodemailer';
import { NotificationProvider, NotificationPayload } from '../types';
import { logger } from '../../../utils/system/logger';
import { interpolateTemplate, defaultEmailTemplate } from '../utils';

export class EmailProvider implements NotificationProvider {
  constructor(
    private smtpHost: string,
    private smtpPort: number,
    private from: string,
    private to: string,
    private subjectTemplate: string | null | undefined,
    private bodyTemplate: string | null | undefined
  ) {}

  async send(payload: NotificationPayload): Promise<boolean> {
    try {
      // A configured template wins, whatever the event -- it is the user's
      // choice, and the variables to make one event-aware now exist. Only the
      // fallback is chosen per event, because a single default cannot describe
      // a price drop and a product going missing at the same time.
      const defaults = defaultEmailTemplate(payload.type);
      const subject = interpolateTemplate(this.subjectTemplate || defaults.subject, payload);
      const body = interpolateTemplate(this.bodyTemplate || defaults.body, payload);

      const transporter = nodemailer.createTransport({
        host: this.smtpHost,
        port: this.smtpPort,
        secure: false, // Open relay, no encryption
        tls: {
          rejectUnauthorized: false, // Allow self-signed or internal certs
        }
      });

      await transporter.sendMail({
        from: this.from,
        to: this.to,
        subject,
        text: body,
      });

      logger.info(`Notify | Email | Sent to ${this.to} via ${this.smtpHost}`, 'Notifications');
      return true;
    } catch (error) {
      logger.error(`Notify | Email | Failed: ${error}`, 'Notifications', error);
      return false;
    }
  }
}
