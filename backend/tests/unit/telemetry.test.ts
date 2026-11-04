import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelemetryService, TELEMETRY_ENDPOINT } from '../../src/services/domain/system/telemetry.service';
import { systemSettingsRepository } from '../../src/models';
import axios from 'axios';

vi.mock('../../src/models', () => ({
  systemSettingsRepository: {
    get: vi.fn(),
    set: vi.fn(),
    getAll: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../src/config/database', () => ({
  default: {
    query: vi.fn().mockResolvedValue({
      rows: [{ items_count: '25', stores_count: '42', users_count: '2' }],
    }),
  },
}));

vi.mock('axios');

describe('TelemetryService', () => {
  let service: TelemetryService;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.DISABLE_TELEMETRY;
    delete process.env.DO_NOT_TRACK;
    delete process.env.TELEMETRY_ENABLED;
    service = new TelemetryService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isEnvDisabled', () => {
    it('returns false when no opt-out environment variables are set', () => {
      expect(service.isEnvDisabled()).toBe(false);
    });

    it('returns true when DISABLE_TELEMETRY is set', () => {
      process.env.DISABLE_TELEMETRY = 'true';
      expect(service.isEnvDisabled()).toBe(true);
    });

    it('returns true when DO_NOT_TRACK is set', () => {
      process.env.DO_NOT_TRACK = '1';
      expect(service.isEnvDisabled()).toBe(true);
    });

    it('returns true when TELEMETRY_ENABLED is false', () => {
      process.env.TELEMETRY_ENABLED = 'false';
      expect(service.isEnvDisabled()).toBe(true);
    });
  });

  describe('isEnabled', () => {
    it('returns true when enabled in settings and not disabled by env', async () => {
      vi.mocked(systemSettingsRepository.get).mockResolvedValue('true');
      expect(await service.isEnabled()).toBe(true);
    });

    it('returns false when disabled in settings', async () => {
      vi.mocked(systemSettingsRepository.get).mockResolvedValue('false');
      expect(await service.isEnabled()).toBe(false);
    });

    it('returns false when env disables it even if setting is true', async () => {
      process.env.DISABLE_TELEMETRY = 'true';
      vi.mocked(systemSettingsRepository.get).mockResolvedValue('true');
      expect(await service.isEnabled()).toBe(false);
    });
  });

  describe('getInstanceId', () => {
    it('returns existing valid UUID from settings', async () => {
      const validUuid = '12345678-1234-4234-8234-123456789abc';
      vi.mocked(systemSettingsRepository.get).mockResolvedValue(validUuid);

      const id = await service.getInstanceId();
      expect(id).toBe(validUuid);
      expect(systemSettingsRepository.set).not.toHaveBeenCalled();
    });

    it('generates, persists, and returns a new UUID if missing', async () => {
      vi.mocked(systemSettingsRepository.get).mockResolvedValue(null);

      const id = await service.getInstanceId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(systemSettingsRepository.set).toHaveBeenCalledWith('telemetry_instance_id', id);
    });
  });

  describe('getPayload', () => {
    it('generates privacy-preserving payload with coarse buckets and zero PII', async () => {
      vi.mocked(systemSettingsRepository.get).mockResolvedValue('12345678-1234-4234-8234-123456789abc');
      vi.mocked(systemSettingsRepository.getAll).mockResolvedValue({
        searxng_enabled: 'true',
        remote_scraper_url: 'http://localhost:3000',
      });

      const payload = await service.getPayload();

      expect(payload.instance_id).toBe('12345678-1234-4234-8234-123456789abc');
      expect(payload.version).toBeDefined();
      expect(payload.os.platform).toBe(process.platform);
      expect(payload.os.arch).toBe(process.arch);
      expect(payload.features.searxng_enabled).toBe(true);
      expect(payload.features.remote_scraper_enabled).toBe(true);

      // Verify coarse buckets
      expect(payload.usage.items_bucket).toBe('11-50');
      expect(payload.usage.stores_bucket).toBe('11-50');
      expect(payload.usage.users_bucket).toBe('2-5');

      // Verify zero PII or URLs
      const payloadString = JSON.stringify(payload);
      expect(payloadString).not.toContain('http://localhost:3000');
    });
  });

  describe('sendPing', () => {
    it('does not send request if telemetry is disabled', async () => {
      vi.mocked(systemSettingsRepository.get).mockResolvedValue('false');

      const result = await service.sendPing();
      expect(result.success).toBe(false);
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('sends POST request and updates last_ping_at on success', async () => {
      vi.mocked(systemSettingsRepository.get).mockImplementation(async (key) => {
        if (key === 'telemetry_enabled') return 'true';
        if (key === 'telemetry_instance_id') return '12345678-1234-4234-8234-123456789abc';
        return null;
      });
      vi.mocked(axios.post).mockResolvedValue({ data: { ok: true } });

      const result = await service.sendPing();
      expect(result.success).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        TELEMETRY_ENDPOINT,
        expect.objectContaining({
          instance_id: '12345678-1234-4234-8234-123456789abc',
        }),
        expect.any(Object)
      );
      expect(systemSettingsRepository.set).toHaveBeenCalledWith('telemetry_last_ping_at', expect.any(String));
    });

    it('catches network errors safely and does not throw', async () => {
      vi.mocked(systemSettingsRepository.get).mockImplementation(async (key) => {
        if (key === 'telemetry_enabled') return 'true';
        if (key === 'telemetry_instance_id') return '12345678-1234-4234-8234-123456789abc';
        return null;
      });
      vi.mocked(axios.post).mockRejectedValue(new Error('Connection timed out'));

      const result = await service.sendPing();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection timed out');
    });
  });
});
