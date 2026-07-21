import nodemailer from 'nodemailer';
import { NotificationProvider, NotificationPayload } from '../types';
import { logger } from '../../../utils/system/logger';
import { interpolateTemplate } from '../utils';

export class EmailProvider implements NotificationProvider {
  constructor(
    private smtpHost: string,
    private smtpPort: number,
    private from: string,
    private to: string,
    private subjectTemplate: string,
    private bodyTemplate: string
  ) {}

  async send(payload: NotificationPayload): Promise<boolean> {
    try {
      const subject = interpolateTemplate(this.subjectTemplate, payload);
      const body = interpolateTemplate(this.bodyTemplate, payload);

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
