import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { userAccountService } from '../../src/services/domain/user/UserAccountService';
import { userProfileService } from '../../src/services/domain/user/UserProfileService';
import { userRepository } from '../../src/models';

vi.mock('../../src/models', () => ({
  userRepository: {
    findByEmail: vi.fn(),
    create: vi.fn(),
    setAdmin: vi.fn(),
    findById: vi.fn(),
    adminUpdateUser: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    updatePassword: vi.fn(),
  },
}));

vi.mock('../../src/utils/system/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('User Domain Services (UserAccountService & UserProfileService)', () => {
  const mockRepo = userRepository as unknown as Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('UserAccountService', () => {
    describe('createUser', () => {
      it('throws 409 Conflict if email is already registered', async () => {
        mockRepo.findByEmail.mockResolvedValue({ id: 1, email: 'exists@example.com' });

        await expect(
          userAccountService.createUser({
            email: 'exists@example.com',
            password: 'password123',
          })
        ).rejects.toThrow('Email already registered');
      });

      it('hashes password and creates user with admin flag if specified', async () => {
        mockRepo.findByEmail.mockResolvedValue(null);
        mockRepo.create.mockResolvedValue({ id: 5, email: 'new@example.com' });
        mockRepo.setAdmin.mockResolvedValue(true);

        const result = await userAccountService.createUser({
          email: 'new@example.com',
          password: 'plainPassword123',
          is_admin: true,
        });

        expect(result.id).toBe(5);
        expect(mockRepo.create).toHaveBeenCalled();
        const hashArg = mockRepo.create.mock.calls[0][1];
        expect(hashArg).not.toBe('plainPassword123');
        expect(await bcrypt.compare('plainPassword123', hashArg)).toBe(true);
        expect(mockRepo.setAdmin).toHaveBeenCalledWith(5, true);
      });
    });

    describe('adminUpdateUser', () => {
      it('throws error when target user does not exist', async () => {
        mockRepo.findById.mockResolvedValue(null);

        await expect(
          userAccountService.adminUpdateUser(99, 1, { name: 'Bob' })
        ).rejects.toThrow('User not found');
      });

      it('prevents setting password on SSO/OIDC accounts (Auth bypass protection)', async () => {
        mockRepo.findById.mockResolvedValue({
          id: 10,
          email: 'sso@company.com',
          auth_provider: 'oidc',
        });

        await expect(
          userAccountService.adminUpdateUser(10, 1, { password: 'newPassword123' })
        ).rejects.toThrow(/signs in through SSO.*cannot be set here/);
      });

      it('prevents changing email address on SSO/OIDC accounts', async () => {
        mockRepo.findById.mockResolvedValue({
          id: 10,
          email: 'sso@company.com',
          auth_provider: 'oidc',
        });

        await expect(
          userAccountService.adminUpdateUser(10, 1, { email: 'different@company.com' })
        ).rejects.toThrow(/signs in through SSO.*email address is managed by the identity provider/);
      });

      it('validates email format on local accounts', async () => {
        mockRepo.findById.mockResolvedValue({ id: 2, email: 'local@test.com', auth_provider: 'local' });

        await expect(
          userAccountService.adminUpdateUser(2, 1, { email: 'not-an-email' })
        ).rejects.toThrow('Invalid email format');
      });

      it('prevents removing your own admin status', async () => {
        mockRepo.findById.mockResolvedValue({ id: 1, email: 'admin@test.com', is_admin: true });

        await expect(
          userAccountService.adminUpdateUser(1, 1, { is_admin: false })
        ).rejects.toThrow('Cannot remove your own admin status');
      });

      it('prevents disabling your own account', async () => {
        mockRepo.findById.mockResolvedValue({ id: 1, email: 'admin@test.com', disabled: false });

        await expect(
          userAccountService.adminUpdateUser(1, 1, { disabled: true })
        ).rejects.toThrow('Cannot disable your own account');
      });

      it('enforces minimum 8 character password length', async () => {
        mockRepo.findById.mockResolvedValue({ id: 2, email: 'user@test.com', auth_provider: 'local' });

        await expect(
          userAccountService.adminUpdateUser(2, 1, { password: 'short' })
        ).rejects.toThrow('Password must be at least 8 characters');
      });
    });

    describe('deleteUser & setAdminStatus self-protection', () => {
      it('prevents self-deletion', async () => {
        await expect(userAccountService.deleteUser(1, 1)).rejects.toThrow(
          'Cannot delete your own account'
        );
        expect(mockRepo.delete).not.toHaveBeenCalled();
      });

      it('prevents self-admin demotion via setAdminStatus', async () => {
        await expect(userAccountService.setAdminStatus(1, 1, false)).rejects.toThrow(
          'Cannot remove your own admin status'
        );
        expect(mockRepo.setAdmin).not.toHaveBeenCalled();
      });
    });
  });

  describe('UserProfileService', () => {
    describe('updateProfile', () => {
      it('normalises default_refresh_interval when present', async () => {
        mockRepo.getProfile.mockResolvedValue({ id: 2, default_refresh_interval: 43200 });
        mockRepo.updateProfile.mockResolvedValue({ id: 2, default_refresh_interval: 3600 });

        // 300s is below the 1-hour minimum, so it should be clamped to 3600
        await userProfileService.updateProfile(2, { default_refresh_interval: 300 });

        expect(mockRepo.updateProfile).toHaveBeenCalledWith(2, {
          name: undefined,
          currency: undefined,
          locale: undefined,
          default_refresh_interval: 3600,
        });
      });
    });

    describe('changePassword', () => {
      it('rejects passwords shorter than 8 characters', async () => {
        await expect(
          userProfileService.changePassword(2, 'currentPass', 'short')
        ).rejects.toThrow('New password must be at least 8 characters');
      });

      it('throws 400 when attempting to change password on SSO account with no hash', async () => {
        mockRepo.findById.mockResolvedValue({ id: 2, email: 'sso@test.com', password_hash: null });

        await expect(
          userProfileService.changePassword(2, 'currentPass', 'newPassword123')
        ).rejects.toThrow(/signs in with SSO and has no password/);
      });

      it('throws 401 when current password does not match', async () => {
        const hash = await bcrypt.hash('correctPassword', 10);
        mockRepo.findById.mockResolvedValue({ id: 2, email: 'user@test.com', password_hash: hash });

        await expect(
          userProfileService.changePassword(2, 'wrongPassword', 'newPassword123')
        ).rejects.toThrow('Current password is incorrect');
      });

      it('updates password when current password matches', async () => {
        const hash = await bcrypt.hash('correctPassword', 10);
        mockRepo.findById.mockResolvedValue({ id: 2, email: 'user@test.com', password_hash: hash });
        mockRepo.updatePassword.mockResolvedValue(true);

        await userProfileService.changePassword(2, 'correctPassword', 'newSecurePassword123');

        expect(mockRepo.updatePassword).toHaveBeenCalled();
        const newHash = mockRepo.updatePassword.mock.calls[0][1];
        expect(await bcrypt.compare('newSecurePassword123', newHash)).toBe(true);
      });
    });
  });
});
