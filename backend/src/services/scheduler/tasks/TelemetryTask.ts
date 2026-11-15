import { telemetryService } from '../../domain/system/telemetry.service';
import { logger } from '../../../utils/system/logger';

/**
 * Scheduled background task for sending the daily anonymous telemetry ping.
 * Completely safe and non-blocking.
 */
export async function runTelemetryPing(): Promise<void> {
  try {
    await telemetryService.sendPing();
  } catch (error) {
    logger.debug('Scheduler | Telemetry | Skipped or error in task', 'Scheduler', error);
  }
}

/**
 * The startup ping. Unlike runTelemetryPing this is gated on the last
 * successful ping, so an instance that restarts repeatedly still only
 * contributes one heartbeat per day.
 */
export async function runTelemetryBootPing(): Promise<void> {
  try {
    await telemetryService.sendBootPing();
  } catch (error) {
    logger.debug('Scheduler | Telemetry | Skipped or error in boot ping', 'Scheduler', error);
  }
}
