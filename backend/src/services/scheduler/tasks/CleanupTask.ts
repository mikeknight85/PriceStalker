import { logger } from '../../../utils/system/logger';
import { systemService } from '../../domain/system';
import { notificationService } from '../../domain/notification';

export async function runCleanup(): Promise<void> {
  try {
    const deletedLogs = await systemService.cleanupLogs(14);
    if (deletedLogs > 0) {
      logger.info(`System | Log Cleanup | Removed ${deletedLogs} logs older than 14 days`, 'Scheduler');
    }

    const deletedNotifications = await notificationService.cleanup(30);
    if (deletedNotifications > 0) {
      logger.info(`System | Notify Cleanup | Removed ${deletedNotifications} notifications older than 30 days`, 'Scheduler');
    }
  } catch (error) {
    logger.error('System | Cleanup | Failed to run automated cleanup', 'Scheduler', error);
  }
}
