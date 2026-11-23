import { describe, it, expect, vi, beforeEach } from 'vitest';

const users = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  updatePassword: vi.fn(),
};

const passwordResetRepo = {
  create: vi.fn(),
  findValidByHash: vi.fn(),
  markUsed: vi.fn(),
  deleteExpired: vi.fn(),
};

const system = {
  getSetting: vi.fn(),
};

const mailer = {
  isSystemMailerConfigured: vi.fn(),
  sendSystemEmail: vi.fn(),
};

vi.mock('../../src/models', () => ({
  userRepository: users,
}));

vi.mock('../../src/services/domain/auth/repositories/password-reset.repository', () => ({
  passwordResetRepository: passwordResetRepo,
}));

vi.mock('../../src/services/domain/system', () => ({
  systemService: system,
}));

vi.mock('../../src/utils/system/mailer', () => ({
  isSystemMailerConfigured: () => mailer.isSystemMailerConfigured(),
  sendSystemEmail: (...args: any[]) => mailer.sendSystemEmail(...args),
}));

vi.mock('../../src/utils/system/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('PasswordResetService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isEnabled', () => {
    it('returns true when enabled in system settings and mailer is configured', async () => {
      system.getSetting.mockResolvedValue('true');
      mailer.isSystemMailerConfigured.mockReturnValue(true);

      const { passwordResetService } = await import(
        '../../src/services/domain/auth/password-reset'
      );
      expect(await passwordResetService.isEnabled()).toBe(true);
    });

    it('returns false when system setting is false', async () => {
      system.getSetting.mockResolvedValue('false');
      mailer.isSystemMailerConfigured.mockReturnValue(true);

      const { passwordResetService } = await import(
        '../../src/services/domain/auth/password-reset'
      );
      expect(await passwordResetService.isEnabled()).toBe(false);
    });

    it('returns false when mailer is not configured', async () => {
      system.getSetting.mockResolvedValue('true');
      mailer.isSystemMailerConfigured.mockReturnValue(false);

      const { passwordResetService } = await import(
        '../../src/services/domain/auth/password-reset'
      );
      expect(await passwordResetService.isEnabled()).toBe(false);
    });
  });

  describe('requestReset', () => {
    it('throws 404 when password reset is disabled', async () => {
      system.getSetting.mockResolvedValue('false');
      mailer.isSystemMailerConfigured.mockReturnValue(true);

      const { passwordResetService } = await import(
        '../../src/services/domain/auth/password-reset'
      );
      await expect(
        passwordResetService.requestReset('user@example.com', 'http://localhost', '127.0.0.1')
      ).rejects.toThrow(/not available/);
    });

    it('throws 400 when email is empty or invalid', async () => {
      system.getSetting.mockResolvedValue('true');
      mailer.isSystemMailerConfigured.mockReturnValue(true);

      const { passwordResetService } = await import(
        '../../src/services/domain/auth/password-reset'
      );
      await expect(
        passwordResetService.requestReset('', 'http://localhost', '127.0.0.1')
      ).rejects.toThrow(/Email is required/);
    });

    it('resolves silently without sending email when account does not exist or is disabled', async () => {
      system.getSetting.mockResolvedValue('true');
      mailer.isSystemMailerConfigured.mockReturnValue(true);
      users.findByEmail.mockResolvedValue(null);

      const { passwordResetService } = await import(
        '../../src/services/domain/auth/password-reset'
      );
      await passwordResetService.requestReset('unknown@example.com', 'http://localhost', '10.0.0.1');

      expect(passwordResetRepo.create).not.toHaveBeenCalled();
      expect(mailer.sendSystemEmail).not.toHaveBeenCalled();
    });

    it('refuses reset for SSO-only accounts without password hash', async () => {
      system.getSetting.mockResolvedValue('true');
      mailer.isSystemMailerConfigured.mockReturnValue(true);
      users.findByEmail.mockResolvedValue({
        id: 42,
        email: 'sso@example.com',
        password_hash: null,
      });

      const { passwordResetService } = await import(
        '../../src/services/domain/auth/password-reset'
      );
      await passwordResetService.requestReset('sso@example.com', 'http://localhost', '10.0.0.2');

      expect(passwordResetRepo.create).not.toHaveBeenCalled();
      expect(mailer.sendSystemEmail).not.toHaveBeenCalled();
    });

    it('creates hashed reset token and sends email link for valid local account', async () => {
      system.getSetting.mockResolvedValue('true');
      mailer.isSystemMailerConfigured.mockReturnValue(true);
      users.findByEmail.mockResolvedValue({
        id: 10,
        email: 'user@example.com',
        password_hash: '$2a$12$somehash',
      });
      mailer.sendSystemEmail.mockResolvedValue({ success: true });

      const { passwordResetService } = await import(
        '../../src/services/domain/auth/password-reset'
      );
      await passwordResetService.requestReset('User@Example.com', 'http://localhost:3000/', '10.0.0.3');

      expect(passwordResetRepo.create).toHaveBeenCalledTimes(1);
      const [userId, hashToken, expiresAt] = passwordResetRepo.create.mock.calls[0];
      expect(userId).toBe(10);
      expect(hashToken).toHaveLength(64); // SHA-256 hex
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

      expect(mailer.sendSystemEmail).toHaveBeenCalledTimes(1);
      expect(mailer.sendSystemEmail.mock.calls[0][0]).toBe('user@example.com');
      expect(mailer.sendSystemEmail.mock.calls[0][2]).toContain('http://localhost:3000/reset-password?token=');
    });
  });

  describe('resetPassword', () => {
    it('rejects missing token or password under 8 characters', async () => {
      const { passwordResetService } = await import(
        '../../src/services/domain/auth/password-reset'
      );
      await expect(passwordResetService.resetPassword('', 'newpassword123')).rejects.toThrow(/token is required/);
      await expect(passwordResetService.resetPassword('sometoken', 'short')).rejects.toThrow(/at least 8 characters/);
    });

    it('rejects invalid or expired tokens', async () => {
      passwordResetRepo.findValidByHash.mockResolvedValue(null);

      const { passwordResetService } = await import(
        '../../src/services/domain/auth/password-reset'
      );
      await expect(passwordResetService.resetPassword('invalidtoken', 'newpassword123')).rejects.toThrow(/invalid or has expired/);
    });

    it('updates password and cleans up token on valid reset', async () => {
      passwordResetRepo.findValidByHash.mockResolvedValue({
        id: 99,
        user_id: 10,
      });
      users.findById.mockResolvedValue({
        id: 10,
        email: 'user@example.com',
        disabled: false,
      });

      const { passwordResetService } = await import(
        '../../src/services/domain/auth/password-reset'
      );
      await passwordResetService.resetPassword('validtoken123', 'a-strong-new-password');

      expect(users.updatePassword).toHaveBeenCalledTimes(1);
      expect(users.updatePassword.mock.calls[0][0]).toBe(10);
      expect(users.updatePassword.mock.calls[0][1]).toMatch(/^\$2[aby]\$/); // bcrypt hash
      expect(passwordResetRepo.markUsed).toHaveBeenCalledWith(99);
      expect(passwordResetRepo.deleteExpired).toHaveBeenCalled();
    });
  });
});
