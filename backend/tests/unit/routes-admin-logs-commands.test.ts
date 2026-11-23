import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const systemServiceMock = {
  getLogs: vi.fn(),
  deleteLogs: vi.fn(),
  clearLogs: vi.fn(),
  runMigrations: vi.fn(),
};

vi.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.userId = 1;
    req.user = { is_admin: true };
    next();
  },
  adminMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../src/services/domain/system', () => ({
  systemService: systemServiceMock,
}));

vi.mock('../../src/utils/cache', () => ({
  configCache: { invalidate: vi.fn() },
  regionalMappingCache: { clear: vi.fn() },
  settingsCache: { clear: vi.fn() },
}));

describe('Admin Logs and Commands Routes', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const logsRouter = (await import('../../src/routes/admin/logs')).default;
    const commandsRouter = (await import('../../src/routes/admin/commands')).default;

    const app = express();
    app.use(express.json());
    app.use('/api/admin/logs', logsRouter);
    app.use('/api/admin/commands', commandsRouter);

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('GET /api/admin/logs', () => {
    it('retrieves system logs with pagination and filters', async () => {
      systemServiceMock.getLogs.mockResolvedValueOnce({
        logs: [{ id: 1, message: 'Log 1', level: 'info' }],
        total: 1,
      });

      const res = await fetch(`${baseUrl}/api/admin/logs?page=2&limit=10&level=error&context=Scraper&search=test`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(1);
      expect(systemServiceMock.getLogs).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        level: 'error',
        context: 'Scraper',
        search: 'test',
      });
    });
  });

  describe('DELETE /api/admin/logs', () => {
    it('returns 400 when ids is not an array', async () => {
      const res = await fetch(`${baseUrl}/api/admin/logs`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: 'invalid' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('IDs array required');
    });

    it('deletes logs by array of IDs', async () => {
      systemServiceMock.deleteLogs.mockResolvedValueOnce(3);

      const res = await fetch(`${baseUrl}/api/admin/logs`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [1, 2, 3] }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true, deleted: 3 });
      expect(systemServiceMock.deleteLogs).toHaveBeenCalledWith([1, 2, 3]);
    });
  });

  describe('DELETE /api/admin/logs/clear', () => {
    it('clears logs filtered by level or context', async () => {
      systemServiceMock.clearLogs.mockResolvedValueOnce(15);

      const res = await fetch(`${baseUrl}/api/admin/logs/clear?level=debug&context=Scraper`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true, deleted: 15 });
      expect(systemServiceMock.clearLogs).toHaveBeenCalledWith({
        level: 'debug',
        context: 'Scraper',
      });
    });
  });

  describe('POST /api/admin/commands', () => {
    it('handles clear-settings-cache command', async () => {
      const res = await fetch(`${baseUrl}/api/admin/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'clear-settings-cache' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('System caches cleared successfully');
    });

    it('handles run-migration command', async () => {
      systemServiceMock.runMigrations.mockResolvedValueOnce({ success: true, applied: ['025_test'] });

      const res = await fetch(`${baseUrl}/api/admin/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'run-migration' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.applied).toEqual(['025_test']);
      expect(systemServiceMock.runMigrations).toHaveBeenCalled();
    });

    it('returns 400 for test-searxng when url is missing', async () => {
      const res = await fetch(`${baseUrl}/api/admin/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'test-searxng', params: {} }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('SearXNG URL is required');
    });

    it('returns 400 for unknown command', async () => {
      const res = await fetch(`${baseUrl}/api/admin/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'unknown-cmd' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toBe('Unknown command');
    });
  });
});
