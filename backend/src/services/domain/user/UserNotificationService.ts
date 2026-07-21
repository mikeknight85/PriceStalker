import { userRepository } from '../../../models';

export class UserNotificationService {
  /**
   * Get user notification settings
   */
  async getNotificationSettings(userId: number) {
    return await userRepository.getNotificationSettings(userId);
  }

  /**
   * Update user notification settings
   */
  async updateNotificationSettings(userId: number, data: any) {
    return await userRepository.updateNotificationSettings(userId, data);
  }
}

export const userNotificationService = new UserNotificationService();

