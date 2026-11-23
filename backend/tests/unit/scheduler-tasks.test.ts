import { describe, it, expect, vi, beforeEach } from 'vitest';

const system = {
  cleanupLogs: vi.fn(),
};

const notification = {
  cleanup: vi.fn(),
};

const exchangeRateRepo = {
  getAll: vi.fn(),
};

const currencyConversion = {
  updateRates: vi.fn(),
};

const telemetry = {
  sendPing: vi.fn(),
  sendBootPing: vi.fn(),
};

const settingsCacheMock = {
  getAISettings: vi.fn(),
};

const aiSettingsMock = {
  refreshProviderModels: vi.fn(),
};

vi.mock('../../src/utils/cache', () => ({
  settingsCache: settingsCacheMock,
}));

vi.mock('../../src/services/domain/system/settings/ai', () => ({
  aiSettingsService: aiSettingsMock,
}));

vi.mock('../../src/models', () => ({
  exchangeRateRepository: exchangeRateRepo,
}));

vi.mock('../../src/services/domain/system', () => ({
  systemService: system,
}));

vi.mock('../../src/services/domain/notification', () => ({
  notificationService: notification,
}));

vi.mock('../../src/services/currency-conversion', () => ({
  currencyConversionService: currencyConversion,
}));

vi.mock('../../src/services/domain/system/telemetry.service', () => ({
  telemetryService: telemetry,
}));

vi.mock('../../src/utils/system/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('Scheduler Tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CleanupTask', () => {
    it('cleans up old logs and notifications without throwing', async () => {
      system.cleanupLogs.mockResolvedValue(15);
      notification.cleanup.mockResolvedValue(5);

      const { runCleanup } = await import(
        '../../src/services/scheduler/tasks/CleanupTask'
      );
      await runCleanup();

      expect(system.cleanupLogs).toHaveBeenCalledWith(14);
      expect(notification.cleanup).toHaveBeenCalledWith(30);
    });

    it('catches and logs errors gracefully when cleanup fails', async () => {
      system.cleanupLogs.mockRejectedValue(new Error('DB disconnect'));

      const { runCleanup } = await import(
        '../../src/services/scheduler/tasks/CleanupTask'
      );
      await expect(runCleanup()).resolves.not.toThrow();
    });
  });

  describe('ExchangeRateTask', () => {
    it('updateExchangeRates calls currencyConversionService.updateRates', async () => {
      currencyConversion.updateRates.mockResolvedValue(undefined);

      const { updateExchangeRates } = await import(
        '../../src/services/scheduler/tasks/ExchangeRateTask'
      );
      await updateExchangeRates();

      expect(currencyConversion.updateRates).toHaveBeenCalledTimes(1);
    });

    it('checkInitialExchangeRates triggers initial fetch when rate table is empty', async () => {
      exchangeRateRepo.getAll
        .mockResolvedValueOnce([]) // initial check: empty
        .mockResolvedValueOnce([{ from_currency: 'USD', to_currency: 'EUR', updated_at: new Date() }]); // after fetch: populated
      currencyConversion.updateRates.mockResolvedValue(undefined);

      const { checkInitialExchangeRates } = await import(
        '../../src/services/scheduler/tasks/ExchangeRateTask'
      );
      await checkInitialExchangeRates();

      expect(currencyConversion.updateRates).toHaveBeenCalled();
    });

    it('checkInitialExchangeRates detects fresh rates under 36 hours', async () => {
      const now = new Date();
      exchangeRateRepo.getAll.mockResolvedValue([
        { from_currency: 'USD', to_currency: 'EUR', updated_at: now },
      ]);

      const { checkInitialExchangeRates } = await import(
        '../../src/services/scheduler/tasks/ExchangeRateTask'
      );
      await checkInitialExchangeRates();

      expect(currencyConversion.updateRates).not.toHaveBeenCalled();
    });

    it('checkInitialExchangeRates detects stale rates older than 36 hours', async () => {
      const staleDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago
      exchangeRateRepo.getAll.mockResolvedValue([
        { from_currency: 'USD', to_currency: 'EUR', updated_at: staleDate },
      ]);

      const { checkInitialExchangeRates } = await import(
        '../../src/services/scheduler/tasks/ExchangeRateTask'
      );
      await checkInitialExchangeRates();

      expect(currencyConversion.updateRates).not.toHaveBeenCalled();
    });
  });

  describe('TelemetryTask', () => {
    it('runTelemetryPing invokes telemetryService.sendPing safely', async () => {
      telemetry.sendPing.mockResolvedValue(undefined);

      const { runTelemetryPing } = await import(
        '../../src/services/scheduler/tasks/TelemetryTask'
      );
      await expect(runTelemetryPing()).resolves.not.toThrow();
      expect(telemetry.sendPing).toHaveBeenCalledTimes(1);
    });

    it('runTelemetryBootPing invokes telemetryService.sendBootPing safely', async () => {
      telemetry.sendBootPing.mockRejectedValue(new Error('Network offline'));

      const { runTelemetryBootPing } = await import(
        '../../src/services/scheduler/tasks/TelemetryTask'
      );
      await expect(runTelemetryBootPing()).resolves.not.toThrow();
      expect(telemetry.sendBootPing).toHaveBeenCalledTimes(1);
    });
  });

  describe('AIModelRefreshTask', () => {
    it('returns cleanly when AI settings are null', async () => {
      settingsCacheMock.getAISettings.mockResolvedValue(null);

      const { refreshAIModels } = await import(
        '../../src/services/scheduler/tasks/AIModelRefreshTask'
      );
      await expect(refreshAIModels()).resolves.not.toThrow();
      expect(aiSettingsMock.refreshProviderModels).not.toHaveBeenCalled();
    });

    it('refreshes only configured providers and handles provider errors gracefully', async () => {
      settingsCacheMock.getAISettings.mockResolvedValue({
        gemini_api_key: 'gemini-key',
        openai_api_key: null,
        ollama_base_url: 'http://localhost:11434',
      });
      aiSettingsMock.refreshProviderModels
        .mockResolvedValueOnce({ models: ['gemini-1.5-flash'] })
        .mockRejectedValueOnce(new Error('Ollama offline'));

      const { refreshAIModels } = await import(
        '../../src/services/scheduler/tasks/AIModelRefreshTask'
      );
      await expect(refreshAIModels()).resolves.not.toThrow();

      expect(aiSettingsMock.refreshProviderModels).toHaveBeenCalledTimes(2);
      expect(aiSettingsMock.refreshProviderModels).toHaveBeenCalledWith('gemini', {
        apiKey: 'gemini-key',
        baseUrl: undefined,
      });
      expect(aiSettingsMock.refreshProviderModels).toHaveBeenCalledWith('ollama', {
        apiKey: undefined,
        baseUrl: 'http://localhost:11434',
      });
    });
  });
});
