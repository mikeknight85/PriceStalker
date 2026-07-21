import pool from '../../../../config/database';
import { 
  User, 
  UserProfile, 
  NotificationSettings
} from '../../../../models/types';

import { userAccountRepository } from './user-account.repository';
import { userProfileRepository } from './user-profile.repository';
import { userSettingsRepository } from './user-settings.repository';

export const userRepository = {
  ...userAccountRepository,
  ...userProfileRepository,
  ...userSettingsRepository,
};

export * from './user-account.repository';
export * from './user-profile.repository';
export * from './user-settings.repository';
