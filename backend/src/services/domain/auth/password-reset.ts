import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { userRepository } from '../../../models';
import { systemService } from '../system';
import { logger } from '../../../utils/system/logger';
import { isSystemMailerConfigured, sendSystemEmail } from '../../../utils/system/mailer';
import { passwordResetRepository } from './repositories/password-reset.repository';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Basic in-memory throttle so the endpoint cannot be used to spam mailboxes
// or probe accounts at volume. Per-key (IP and email), 5 requests per hour.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entries = (requestLog.get(key) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (entries.length >= RATE_LIMIT) {
    requestLog.set(key, entries);
    return true;
  }
  entries.push(now);
  requestLog.set(key, entries);
  return false;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class PasswordResetService {
  /**
   * Reset is available when the admin toggle allows it AND the system mailer
   * is configured — without SMTP the email could never be delivered.
   */
  async isEnabled(): Promise<boolean> {
    const setting = await systemService.getSetting('password_reset_enabled');
    return setting !== 'false' && isSystemMailerConfigured();
  }

  /**
   * Issues a reset token and emails the link. Always resolves without
   * revealing whether the email belongs to an account (no user enumeration).
   */
  async requestReset(email: string, baseUrl: string, clientIp: string): Promise<void> {
    if (!(await this.isEnabled())) {
      const err = new Error('Password reset is not available on this server');
      (err as any).statusCode = 404;
      throw err;
    }

    if (!email || typeof email !== 'string') {
      const err = new Error('Email is required');
      (err as any).statusCode = 400;
      throw err;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (isRateLimited(`ip:${clientIp}`) || isRateLimited(`email:${normalizedEmail}`)) {
      logger.warn(`Auth | Password Reset | Rate limited request for ${normalizedEmail}`, 'Auth');
      return; // Indistinguishable from success, on purpose.
    }

    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user || user.disabled) {
      logger.info('Auth | Password Reset | Requested for unknown or disabled account', 'Auth');
      return;
    }
    if (!user.password_hash) {
      // SSO-only account: there is no password to reset.
      logger.info(`Auth | Password Reset | Requested for SSO-only account ID ${user.id}`, 'Auth');
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await passwordResetRepository.create(user.id, hashToken(token), expiresAt);

    const resetUrl = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${token}`;
    const result = await sendSystemEmail(
      user.email,
      'PriceStalker password reset',
      `A password reset was requested for your PriceStalker account.\n\n` +
      `Open this link to choose a new password (valid for 1 hour):\n\n` +
      `${resetUrl}\n\n` +
      `If you did not request this, you can ignore this email; your password is unchanged.`
    );

    if (result.success) {
      logger.info(`Auth | Password Reset | Email sent for user ID ${user.id}`, 'Auth');
    } else {
      logger.error(`Auth | Password Reset | Email delivery failed for user ID ${user.id}: ${result.error}`, 'Auth');
    }
  }

  /**
   * Consumes a token and sets the new password.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!token || typeof token !== 'string') {
      const err = new Error('Reset token is required');
      (err as any).statusCode = 400;
      throw err;
    }
    if (!newPassword || newPassword.length < 8) {
      const err = new Error('Password must be at least 8 characters');
      (err as any).statusCode = 400;
      throw err;
    }

    const row = await passwordResetRepository.findValidByHash(hashToken(token));
    if (!row) {
      const err = new Error('This reset link is invalid or has expired. Request a new one.');
      (err as any).statusCode = 400;
      throw err;
    }

    const user = await userRepository.findById(row.user_id);
    if (!user || user.disabled) {
      const err = new Error('This reset link is invalid or has expired. Request a new one.');
      (err as any).statusCode = 400;
      throw err;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await userRepository.updatePassword(user.id, passwordHash);
    await passwordResetRepository.markUsed(row.id);
    await passwordResetRepository.deleteExpired();

    logger.info(`Auth | Password Reset | Password changed for user ID ${user.id}`, 'Auth');
  }
}

export const passwordResetService = new PasswordResetService();
