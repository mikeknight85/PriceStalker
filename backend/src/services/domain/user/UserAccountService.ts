import bcrypt from 'bcryptjs';
import { userRepository, User, UserProfile } from '../../../models';
import { logger } from '../../../utils/system/logger';

export class UserAccountService {
  /**
   * Admin: Create a new user
   */
  async createUser(data: {
    email: string;
    password: string;
    is_admin?: boolean;
    currency?: string;
    locale?: string;
  }): Promise<User> {
    const { email, password, is_admin, currency, locale } = data;

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      const err = new Error('Email already registered');
      (err as any).statusCode = 409;
      throw err;
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await userRepository.create(email, passwordHash, currency, locale);

    if (is_admin) {
      await userRepository.setAdmin(user.id, true);
    }

    logger.info(`User | Created | ${email} (Admin: ${is_admin || false})`, 'Admin');
    return user;
  }

  /**
   * Admin: Update user details
   */
  async adminUpdateUser(targetId: number, currentUserId: number, data: any): Promise<UserProfile> {
    const { email, name, currency, locale, password, is_admin, disabled } = data;
    const updates: any = {};

    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }
      updates.email = email;
    }

    if (name !== undefined) updates.name = name;
    if (currency !== undefined) updates.currency = currency;
    if (locale !== undefined) updates.locale = locale;

    if (is_admin !== undefined) {
      if (targetId === currentUserId && !is_admin) {
        throw new Error('Cannot remove your own admin status');
      }
      updates.is_admin = is_admin;
    }

    if (disabled !== undefined) {
      if (targetId === currentUserId && disabled) {
        throw new Error('Cannot disable your own account');
      }
      updates.disabled = disabled;
    }

    if (password) {
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }
      const saltRounds = 12;
      updates.password_hash = await bcrypt.hash(password, saltRounds);
    }

    const user = await userRepository.adminUpdateUser(targetId, updates);
    if (!user) {
      throw new Error('User not found');
    }

    logger.info(`User | Admin Update | ID: ${targetId}`, 'Admin');
    return user;
  }

  /**
   * Admin: Delete user
   */
  async deleteUser(targetId: number, currentUserId: number): Promise<boolean> {
    if (targetId === currentUserId) {
      throw new Error('Cannot delete your own account');
    }

    const deleted = await userRepository.delete(targetId);
    if (deleted) {
      logger.info(`User | Deleted | ID: ${targetId}`, 'Admin');
    }
    return deleted;
  }

  /**
   * Admin: Toggle admin status
   */
  async setAdminStatus(targetId: number, currentUserId: number, is_admin: boolean): Promise<boolean> {
    if (targetId === currentUserId && !is_admin) {
      throw new Error('Cannot remove your own admin status');
    }

    const updated = await userRepository.setAdmin(targetId, is_admin);
    if (updated) {
      logger.info(`User | Admin Status | ID: ${targetId} -> ${is_admin}`, 'Admin');
    }
    return updated;
  }

  /**
   * Get all users (Admin)
   */
  async getAllUsers() {
    return await userRepository.findAll();
  }
}

export const userAccountService = new UserAccountService();
