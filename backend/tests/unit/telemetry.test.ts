import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelemetryService, TELEMETRY_ENDPOINT, BOOT_PING_MIN_AGE_MS } from '../../src/services/domain/system/telemetry.service';
import { systemSettingsRepository, telemetryRepository } from '../../src/models';
import axios from 'axios';

vi.mock('../../src/models', () => ({
  systemSettingsRepository: {
    get: vi.fn(),
    set: vi.fn(),
    getAll: vi.fn().mockResolvedValue({}),
  },
  telemetryRepository: {
    getEntityCounts: vi.fn().mockResolvedValue({
      itemsCount: 25,
      storesCount: 42,
      usersCount: 2,
    }),
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

describe('TelemetryService | opt-out and heartbeat guards', () => {
  let service: TelemetryService;
  const originalEnv = { ...process.env };
  const settingsGet = vi.mocked(systemSettingsRepository.get);

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.DISABLE_TELEMETRY;
    delete process.env.DO_NOT_TRACK;
    delete process.env.TELEMETRY_ENABLED;
    vi.mocked(telemetryRepository.getEntityCounts).mockResolvedValue({
      itemsCount: 25,
      storesCount: 42,
      usersCount: 2,
    });
    service = new TelemetryService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isEnabled | the default-on branch', () => {
    it('is enabled when the setting has never been written', async () => {
      settingsGet.mockResolvedValue(null);
      expect(await service.isEnabled()).toBe(true);
    });

    it('is enabled when the setting holds an unrecognised value', async () => {
      settingsGet.mockResolvedValue('maybe');
      expect(await service.isEnabled()).toBe(true);
    });

    it('is disabled only for the exact string "false"', async () => {
      settingsGet.mockResolvedValue('false');
      expect(await service.isEnabled()).toBe(false);
    });
  });

  describe('isEnvDisabled | accepted opt-out spellings', () => {
    it.each(['true', 'TRUE', '1', 'yes', ' 1 '])(
      'DISABLE_TELEMETRY=%s opts out',
      (value) => {
        process.env.DISABLE_TELEMETRY = value;
        expect(service.isEnvDisabled()).toBe(true);
      }
    );

    it.each(['true', '1', 'YES'])('DO_NOT_TRACK=%s opts out', (value) => {
      process.env.DO_NOT_TRACK = value;
      expect(service.isEnvDisabled()).toBe(true);
    });

    it('TELEMETRY_ENABLED=false opts out', () => {
      process.env.TELEMETRY_ENABLED = 'false';
      expect(service.isEnvDisabled()).toBe(true);
    });

    it.each(['false', '0', 'no', ''])(
      'DISABLE_TELEMETRY=%s does not opt out',
      (value) => {
        process.env.DISABLE_TELEMETRY = value;
        expect(service.isEnvDisabled()).toBe(false);
      }
    );
  });

  describe('shouldSendBootPing', () => {
    const now = new Date('2026-11-15T12:00:00.000Z');

    it('pings when no successful ping is recorded', async () => {
      settingsGet.mockResolvedValue(null);
      expect(await service.shouldSendBootPing(now)).toBe(true);
    });

    it('pings when the stored timestamp is unparseable', async () => {
      settingsGet.mockResolvedValue('not-a-date');
      expect(await service.shouldSendBootPing(now)).toBe(true);
    });

    it('does not ping when the last ping is newer than the minimum age', async () => {
      settingsGet.mockResolvedValue(
        new Date(now.getTime() - BOOT_PING_MIN_AGE_MS + 60_000).toISOString()
      );
      expect(await service.shouldSendBootPing(now)).toBe(false);
    });

    it('pings once the last ping reaches the minimum age', async () => {
      settingsGet.mockResolvedValue(
        new Date(now.getTime() - BOOT_PING_MIN_AGE_MS).toISOString()
      );
      expect(await service.shouldSendBootPing(now)).toBe(true);
    });
  });

  describe('sendBootPing | restarts do not each ping', () => {
    it('suppresses the request when a ping was already delivered today', async () => {
      settingsGet.mockResolvedValue(new Date().toISOString());

      const result = await service.sendBootPing();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Already pinged recently');
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('sends when the heartbeat is due', async () => {
      settingsGet.mockImplementation(async (key: string) => {
        if (key === 'telemetry_last_ping_at') {
          return new Date(Date.now() - BOOT_PING_MIN_AGE_MS - 1000).toISOString();
        }
        if (key === 'telemetry_instance_id') {
          return '3f1a9c6e-1b2d-4c3e-8a9b-0d1e2f3a4b5c';
        }
        return null;
      });
      vi.mocked(axios.post).mockResolvedValue({ status: 204 });

      const result = await service.sendBootPing();

      expect(result.success).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        TELEMETRY_ENDPOINT,
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('payload', () => {
    beforeEach(() => {
      settingsGet.mockImplementation(async (key: string) =>
        key === 'telemetry_instance_id' ? '3f1a9c6e-1b2d-4c3e-8a9b-0d1e2f3a4b5c' : null
      );
    });

    it('does not disclose uptime', async () => {
      const payload = await service.getPayload();

      expect(payload.runtime).not.toHaveProperty('uptime_hours');
      expect(JSON.stringify(payload)).not.toContain('uptime');
    });

    it('reports usage only as coarse buckets', async () => {
      const payload = await service.getPayload();

      expect(payload.usage).toEqual({
        items_bucket: '11-50',
        stores_bucket: '11-50',
        users_bucket: '2-5',
      });
      expect(JSON.stringify(payload)).not.toContain('25');
      expect(JSON.stringify(payload)).not.toContain('42');
    });

    it('falls back to unknown buckets when the count query fails', async () => {
      vi.mocked(telemetryRepository.getEntityCounts).mockRejectedValue(new Error('db down'));

      const payload = await service.getPayload();

      expect(payload.usage).toEqual({
        items_bucket: 'unknown',
        stores_bucket: 'unknown',
        users_bucket: 'unknown',
      });
    });
  });
});
