import pool from '../../../config/database';
import { logger } from '../../../utils/system/logger';
import nodemailer from 'nodemailer';

export type DBState = 'HEALTHY' | 'DEGRADED' | 'FAILED';

export class DatabaseHealthMonitor {
  private currentState: DBState = 'HEALTHY';
  private failureCount = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private isChecking = false;
  private isSimulated = false;

  // Cached admin details from warm times
  private cachedAdminEmail: string | null = null;

  start() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.checkHealth(), 30000); // Check every 30 seconds
    
    // Attempt cache seed on startup
    this.warmCache();
  }

  async forceCheck() {
    await this.checkHealth();
  }

  private async warmCache() {
    try {
      const result = await pool.query("SELECT email FROM users WHERE id = 1");
      if (result.rows[0]?.email) {
        this.cachedAdminEmail = result.rows[0].email;
      }
    } catch (e) {
      // Database not ready, will rely on ENV variables
    }
  }

  private async checkHealth() {
    if (this.isChecking || this.isSimulated) return;
    this.isChecking = true;

    try {
      await pool.query('SELECT 1');
      this.markHealthy();
    } catch (error) {
      this.handleFailure(error as Error);
    } finally {
      this.isChecking = false;
    }
  }

  getStatus() {
    return {
      state: this.currentState,
      failureCount: this.failureCount,
      cachedAdminEmail: this.cachedAdminEmail,
      isChecking: this.isChecking,
      isSimulated: this.isSimulated
    };
  }

  setSimulatedState(state: DBState) {
    const previous = this.currentState;
    this.isSimulated = true;
    this.currentState = state;

    if (state === 'HEALTHY' && previous === 'FAILED') {
      this.sendAlertEmail('Database Outage Resolved (SIMULATED)', 'The simulated database outage has been resolved.');
    } else if (state === 'FAILED' && previous !== 'FAILED') {
      this.sendAlertEmail('CRITICAL: Database Offline Alert (SIMULATED)', 'Simulated database transition to FAILED.');
    }
  }

  clearSimulation() {
    this.isSimulated = false;
    this.failureCount = 0;
    this.checkHealth();
  }

  markHealthy() {
    this.failureCount = 0;
    if (this.currentState === 'FAILED') {
      logger.info('DatabaseHealthMonitor | Connection restored', 'Database');
      this.sendAlertEmail('Database Outage Resolved', 'The database has successfully recovered and the system is back online.');
    }
    this.currentState = 'HEALTHY';
  }

  markDegraded(err: Error) {
    if (this.currentState === 'HEALTHY') {
      this.currentState = 'DEGRADED';
    }
    logger.warn(`DatabaseHealthMonitor | Degraded: ${err.message}`, 'Database');
  }

  markFailed() {
    this.handleFailure(new Error('Manual transition to offline'));
  }

  private handleFailure(error: Error) {
    this.failureCount++;
    logger.error(`DatabaseHealthMonitor | Probe failed (${this.failureCount}/3): ${error.message}`, 'Database', error);

    if (this.currentState !== 'FAILED' && this.failureCount >= 3) {
      this.currentState = 'FAILED';
      logger.error('DatabaseHealthMonitor | State transitioned to FAILED', 'Database');
      this.sendAlertEmail(
        'CRITICAL: Database Offline Alert',
        `The backend database has crashed or is unreachable.\n\nError: ${error.message}\nTime: ${new Date().toISOString()}`
      );
    }
  }

  async sendAlertEmail(subject: string, text: string) {
    const toEmail = this.cachedAdminEmail || process.env.ADMIN_ALERT_EMAIL || 'admin@localhost';
    const smtpHost = process.env.SMTP_FALLBACK_HOST;
    const smtpPort = parseInt(process.env.SMTP_FALLBACK_PORT || '587', 10);
    const smtpUser = process.env.SMTP_FALLBACK_USER;
    const smtpPass = process.env.SMTP_FALLBACK_PASS;
    const emailFrom = process.env.SMTP_FALLBACK_FROM || 'pricestalker-monitor@localhost';

    if (!smtpHost) {
      logger.error('DatabaseHealthMonitor | Cannot send alert email: SMTP_FALLBACK_HOST is not set in environment', 'Database');
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

      await transporter.sendMail({
        from: emailFrom,
        to: toEmail,
        subject,
        text,
      });

      logger.info(`DatabaseHealthMonitor | Outage alert email successfully sent to ${toEmail}`, 'Database');
      return { success: true, to: toEmail };
    } catch (emailErr: any) {
      logger.error('DatabaseHealthMonitor | Failed to deliver alert email', 'Database', emailErr);
      return { success: false, error: emailErr.message };
    }
  }
}

export const databaseHealthMonitor = new DatabaseHealthMonitor();
