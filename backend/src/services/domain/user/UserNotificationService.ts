import { userRepository } from '../../../models';
import { NotificationSettings } from '../../../models/types';
import {
  changedNotificationFields,
  resolveCredentialUpdates,
} from './notification-credentials';

/** The outcome of a settings update, as the route needs to report it. */
export interface NotificationSettingsUpdate {
  /** The settings after the write, or null when the user does not exist. */
  settings: NotificationSettings | null;
  /**
   * The names of the fields that actually changed -- names only, never values,
   * because several of them are credentials and this is logged.
   */
  changes: string[];
}

export class UserNotificationService {
  /**
   * Get user notification settings, credentials included.
   *
   * This is the server-side view: the scheduler, the test-notification
   * endpoints and the CLI script all need the real credentials to send
   * anything. What the API may return is `toNotificationSettingsView`'s job
   * (issue #272).
   */
  async getNotificationSettings(userId: number) {
    return await userRepository.getNotificationSettings(userId);
  }

  /**
   * Update user notification settings.
   *
   * Credential fields are resolved first: one the request left alone is dropped
   * rather than overwritten with the empty value the form was given in place of
   * the secret (issue #272).
   */
  async updateNotificationSettings(
    userId: number,
    updates: Partial<NotificationSettings>
  ): Promise<NotificationSettingsUpdate> {
    const resolved = resolveCredentialUpdates(updates);
    const previous = await userRepository.getNotificationSettings(userId);

    // Every field the request named was an untouched credential. There is
    // nothing to write, and nothing changed, which is not an error.
    if (Object.keys(resolved).length === 0) {
      return { settings: previous, changes: [] };
    }

    const settings = await userRepository.updateNotificationSettings(userId, resolved);
    const changes = previous ? changedNotificationFields(previous, resolved) : [];
    return { settings, changes };
  }
}

export const userNotificationService = new UserNotificationService();
