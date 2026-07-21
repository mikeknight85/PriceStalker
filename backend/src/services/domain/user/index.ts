import { userAccountService } from './UserAccountService';
import { userProfileService } from './UserProfileService';
import { userNotificationService } from './UserNotificationService';

// Re-export individual services
export * from './UserAccountService';
export * from './UserProfileService';
export * from './UserNotificationService';

// Unified UserService class for compatibility
export class UserService {
  createUser = userAccountService.createUser.bind(userAccountService);
  adminUpdateUser = userAccountService.adminUpdateUser.bind(userAccountService);
  deleteUser = userAccountService.deleteUser.bind(userAccountService);
  setAdminStatus = userAccountService.setAdminStatus.bind(userAccountService);
  getAllUsers = userAccountService.getAllUsers.bind(userAccountService);
  
  getProfile = userProfileService.getProfile.bind(userProfileService);
  updateProfile = userProfileService.updateProfile.bind(userProfileService);
  changePassword = userProfileService.changePassword.bind(userProfileService);
  
  getNotificationSettings = userNotificationService.getNotificationSettings.bind(userNotificationService);
  updateNotificationSettings = userNotificationService.updateNotificationSettings.bind(userNotificationService);
}

export const userService = new UserService();
