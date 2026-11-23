import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const systemServiceMock = {
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getAISettings: vi.fn(),
  updateAISettings: vi.fn(),
  getProviderModels: vi.fn(),
  refreshProviderModels: vi.fn(),
};

const telemetryServiceMock = {
  getStatus: vi.fn(),
  sendPing: vi.fn(),
};

vi.mock('../../../src/services/domain/system', () => ({
  systemService: systemServiceMock,
}));

vi.mock('../../../src/services/domain/system/telemetry.service', () => ({
  telemetryService: telemetryServiceMock,
}));

vi.mock('../../src/services/domain/system', () => ({
  systemService: systemServiceMock,
}));

vi.mock('../../src/services/domain/system/telemetry.service', () => ({
  telemetryService: telemetryServiceMock,
}));

describe('Admin Settings Routes (/api/admin/settings)', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const systemRouter = (await import('../../src/routes/admin/settings/system')).default;
    const aiConfigRouter = (await import('../../src/routes/admin/settings/ai/config')).default;

    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.userId = 1;
      next();
    });
    app.use('/api/admin/settings/system', systemRouter);
    app.use('/api/admin/settings/ai', aiConfigRouter);

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('System Settings Routes', () => {
    it('GET /api/admin/settings/system returns system settings', async () => {
      systemServiceMock.getSettings.mockResolvedValueOnce({
        default_check_interval: 60,
        telemetry_enabled: true,
      });

      const res = await fetch(`${baseUrl}/api/admin/settings/system`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        default_check_interval: 60,
        telemetry_enabled: true,
      });
      expect(systemServiceMock.getSettings).toHaveBeenCalled();
    });

    it('PUT /api/admin/settings/system updates system settings', async () => {
      systemServiceMock.updateSettings.mockResolvedValueOnce({
        default_check_interval: 120,
      });

      const res = await fetch(`${baseUrl}/api/admin/settings/system`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_check_interval: 120 }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.default_check_interval).toBe(120);
      expect(systemServiceMock.updateSettings).toHaveBeenCalledWith(
        { default_check_interval: 120 },
        1
      );
    });

    it('GET /api/admin/settings/system/telemetry returns telemetry status', async () => {
      telemetryServiceMock.getStatus.mockResolvedValueOnce({
        enabled: true,
        last_ping: '2026-11-23T00:00:00Z',
      });

      const res = await fetch(`${baseUrl}/api/admin/settings/system/telemetry`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.enabled).toBe(true);
    });

    it('POST /api/admin/settings/system/telemetry/ping triggers telemetry ping', async () => {
      telemetryServiceMock.sendPing.mockResolvedValueOnce({ success: true, message: 'Ping sent' });

      const res = await fetch(`${baseUrl}/api/admin/settings/system/telemetry/ping`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(telemetryServiceMock.sendPing).toHaveBeenCalled();
    });
  });

  describe('AI Settings Routes', () => {
    it('GET /api/admin/settings/ai returns AI settings', async () => {
      systemServiceMock.getAISettings.mockResolvedValueOnce({
        enabled: true,
        default_provider: 'openai',
      });

      const res = await fetch(`${baseUrl}/api/admin/settings/ai`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.default_provider).toBe('openai');
    });

    it('PUT /api/admin/settings/ai updates AI settings', async () => {
      systemServiceMock.updateAISettings.mockResolvedValueOnce({
        enabled: true,
        default_provider: 'anthropic',
      });

      const res = await fetch(`${baseUrl}/api/admin/settings/ai`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_provider: 'anthropic' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.default_provider).toBe('anthropic');
      expect(systemServiceMock.updateAISettings).toHaveBeenCalledWith(
        { default_provider: 'anthropic' },
        1
      );
    });

    it('GET /api/admin/settings/ai/:provider/models returns models list', async () => {
      systemServiceMock.getProviderModels.mockResolvedValueOnce({
        models: ['gpt-4o', 'gpt-4o-mini'],
      });

      const res = await fetch(`${baseUrl}/api/admin/settings/ai/openai/models`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.models).toEqual(['gpt-4o', 'gpt-4o-mini']);
      expect(systemServiceMock.getProviderModels).toHaveBeenCalledWith('openai');
    });

    it('POST /api/admin/settings/ai/:provider/models/refresh refreshes models', async () => {
      systemServiceMock.refreshProviderModels.mockResolvedValueOnce({
        models: ['claude-3-5-sonnet-20241022'],
      });

      const res = await fetch(`${baseUrl}/api/admin/settings/ai/anthropic/models/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: 'sk-ant-test', base_url: null }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.models).toEqual(['claude-3-5-sonnet-20241022']);
      expect(systemServiceMock.refreshProviderModels).toHaveBeenCalledWith('anthropic', {
        apiKey: 'sk-ant-test',
        baseUrl: null,
      });
    });
  });
});
