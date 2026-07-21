import bcrypt from 'bcryptjs';
import { userRepository, UserProfile } from '../../../models';
import { logger } from '../../../utils/system/logger';

export class UserProfileService {
  /**
   * User: Get personal profile
   */
  async getProfile(userId: number): Promise<UserProfile> {
    const profile = await userRepository.getProfile(userId);
    if (!profile) throw new Error('User not found');
    return profile;
  }

  /**
   * User: Update personal profile
   */
  async updateProfile(userId: number, data: any): Promise<UserProfile | null> {
    const { name, currency, locale, preferred_currency } = data;

    const oldProfile = await userRepository.getProfile(userId);
    const profile = await userRepository.updateProfile(userId, { name, currency, locale, preferred_currency });

    if (!profile) return null;

    // Log changes
    const changes: string[] = [];
    if (oldProfile) {
      const keys = Object.keys(data);
      keys.forEach(key => {
        const newVal = data[key];
        const oldVal = (oldProfile as any)[key];
        if (newVal !== undefined && JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
          changes.push(`${key}: ${oldVal} -> ${newVal}`);
        }
      });
    }

    if (changes.length > 0) {
      logger.info(`User | Profile Updated | ID: ${userId} | ${changes.join(' | ')}`, 'Profile');
    }

    return profile;
  }

  /**
   * User: Change personal password
   */
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }

    const user = await userRepository.findById(userId);
    if (!user) throw new Error('User not found');

    // SSO-provisioned accounts have no password to change or verify against.
    // Their credentials live with the identity provider.
    if (!user.password_hash) {
      const err = new Error(
        'This account signs in with SSO and has no password. Change it with your identity provider.'
      );
      (err as any).statusCode = 400;
      throw err;
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      const err = new Error('Current password is incorrect');
      (err as any).statusCode = 401;
      throw err;
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await userRepository.updatePassword(userId, newPasswordHash);
    logger.info(`User | Password Changed | ID: ${userId}`, 'Profile');
  }
}

export const userProfileService = new UserProfileService();
