import { systemLogRepository } from '../../../models';

export class LogService {
  /**
   * Get system logs with filters
   */
  async getLogs(params: { page?: number; limit?: number; level?: string; context?: string; search?: string }) {
    return await systemLogRepository.findAll({
      page: params.page || 1,
      limit: params.limit || 30,
      level: params.level,
      context: params.context,
      search: params.search
    });
  }

  /**
   * Delete specific logs by ID
   */
  async deleteLogs(ids: number[]) {
    return await systemLogRepository.deleteByIds(ids);
  }

  /**
   * Clear logs based on filters
   */
  async clearLogs(filters: { level?: string; context?: string }) {
    return await systemLogRepository.clearAll(filters);
  }

  /**
   * Run automated log cleanup
   * @param days Number of days of logs to keep
   */
  async cleanupLogs(days: number): Promise<number> {
    return await systemLogRepository.cleanup(days);
  }
}

export const logService = new LogService();
