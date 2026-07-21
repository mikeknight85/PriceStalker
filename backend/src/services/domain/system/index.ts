import { currencyService } from './CurrencyService';
import { currencyConversionService } from './CurrencyConversionService';
import { settingsService } from './SettingsService';
import { logService } from './LogService';
import { migrationService } from './MigrationService';
import { debugService } from './DebugService';

// Re-export individual services
export * from './CurrencyService';
export * from './CurrencyConversionService';
export * from './SettingsService';
export * from './LogService';
export * from './MigrationService';
export * from './DebugService';
export * from './SettingsListenerService';
export * from './DatabaseHealthMonitor';

// Unified SystemService class for compatibility
export class SystemService {
  getCurrencies = currencyService.getCurrencies.bind(currencyService);
  getSettings = settingsService.getSettings.bind(settingsService);
  getSetting = settingsService.getSetting.bind(settingsService);
  updateSettings = settingsService.updateSettings.bind(settingsService);
  getAISettings = settingsService.getAISettings.bind(settingsService);
  updateAISettings = settingsService.updateAISettings.bind(settingsService);
  refreshGeminiModels = settingsService.refreshGeminiModels.bind(settingsService);
  getLogs = logService.getLogs.bind(logService);
  deleteLogs = logService.deleteLogs.bind(logService);
  clearLogs = logService.clearLogs.bind(logService);
  cleanupLogs = logService.cleanupLogs.bind(logService);
  runMigrations = migrationService.runMigrations.bind(migrationService);
  saveDebugHtml = debugService.saveDebugHtml.bind(debugService);
}

export const systemService = new SystemService();
