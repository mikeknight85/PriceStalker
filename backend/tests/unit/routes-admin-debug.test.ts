import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const systemServiceMock = {
  getSettings: vi.fn(),
  saveDebugHtml: vi.fn(),
};

const databaseHealthMonitorMock = {
  getStatus: vi.fn(),
  sendAlertEmail: vi.fn(),
  clearSimulation: vi.fn(),
  setSimulatedState: vi.fn(),
};

const scrapeProductWithVotingMock = vi.fn();
const tryAIExtractionMock = vi.fn();

vi.mock('../../src/services/domain/system', () => ({
  systemService: systemServiceMock,
  databaseHealthMonitor: databaseHealthMonitorMock,
}));

vi.mock('../../src/services/scraper', () => ({
  scrapeProductWithVoting: scrapeProductWithVotingMock,
}));

vi.mock('../../src/services/ai', () => ({
  tryAIExtraction: tryAIExtractionMock,
}));

vi.mock('../../src/utils/system/url-safety', () => ({
  assertUrlIsSafe: vi.fn().mockResolvedValue(undefined),
}));

describe('Admin Debug Routes (/api/admin/debug)', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const router = (await import('../../src/routes/admin/debug')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/admin/debug', router);

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('GET /api/admin/debug/status', () => {
    it('returns enabled: true when debug_page_enabled is set', async () => {
      systemServiceMock.getSettings.mockResolvedValueOnce({ debug_page_enabled: 'true' });

      const res = await fetch(`${baseUrl}/api/admin/debug/status`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ enabled: true });
    });

    it('returns enabled: false when disabled', async () => {
      systemServiceMock.getSettings.mockResolvedValueOnce({ debug_page_enabled: 'false' });

      const res = await fetch(`${baseUrl}/api/admin/debug/status`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ enabled: false });
    });
  });

  describe('POST /api/admin/debug/extract', () => {
    it('returns 400 when url is missing', async () => {
      const res = await fetch(`${baseUrl}/api/admin/debug/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('URL is required');
    });

    it('returns 403 when debug page is disabled in system settings', async () => {
      systemServiceMock.getSettings.mockResolvedValueOnce({ debug_page_enabled: 'false' });

      const res = await fetch(`${baseUrl}/api/admin/debug/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/item' }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Debug page is currently disabled');
    });

    it('runs scraper extraction when enabled', async () => {
      systemServiceMock.getSettings.mockResolvedValueOnce({ debug_page_enabled: 'true' });
      scrapeProductWithVotingMock.mockResolvedValueOnce({
        url: 'https://example.com/item',
        price: { price: 29.99 },
        html: '<html><body>price: 29.99</body></html>',
      });
      systemServiceMock.saveDebugHtml.mockReturnValueOnce('/debug_html/test.html');

      const res = await fetch(`${baseUrl}/api/admin/debug/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/item', returnHtml: false }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.price).toEqual({ price: 29.99 });
      expect(data.debugFileUrl).toBe('/debug_html/test.html');
      // returnHtml is false so html is omitted
      expect(data.html).toBeUndefined();
    });
  });

  describe('GET /api/admin/debug/db-health', () => {
    it('returns database health status', async () => {
      databaseHealthMonitorMock.getStatus.mockReturnValueOnce({
        state: 'HEALTHY',
        lastChecked: '2026-11-23T00:00:00.000Z',
      });

      const res = await fetch(`${baseUrl}/api/admin/debug/db-health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.state).toBe('HEALTHY');
    });
  });

  describe('POST /api/admin/debug/db-health/test-alert', () => {
    it('returns 200 when alert email succeeds', async () => {
      databaseHealthMonitorMock.sendAlertEmail.mockResolvedValueOnce({ success: true });

      const res = await fetch(`${baseUrl}/api/admin/debug/db-health/test-alert`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Test alert successfully sent');
    });

    it('returns 500 when alert email fails', async () => {
      databaseHealthMonitorMock.sendAlertEmail.mockResolvedValueOnce({ success: false, error: 'SMTP failed' });

      const res = await fetch(`${baseUrl}/api/admin/debug/db-health/test-alert`, {
        method: 'POST',
      });
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Failed to send alert');
    });
  });

  describe('POST /api/admin/debug/db-health/simulate', () => {
    it('clears simulation on RESET', async () => {
      const res = await fetch(`${baseUrl}/api/admin/debug/db-health/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'RESET' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toContain('Simulation cleared');
      expect(databaseHealthMonitorMock.clearSimulation).toHaveBeenCalled();
    });

    it('returns 400 on invalid simulation state', async () => {
      const res = await fetch(`${baseUrl}/api/admin/debug/db-health/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'INVALID_STATE' }),
      });
      expect(res.status).toBe(400);
    });

    it('sets simulated state on valid state', async () => {
      databaseHealthMonitorMock.getStatus.mockReturnValueOnce({ state: 'DEGRADED' });

      const res = await fetch(`${baseUrl}/api/admin/debug/db-health/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'DEGRADED' }),
      });
      expect(res.status).toBe(200);
      expect(databaseHealthMonitorMock.setSimulatedState).toHaveBeenCalledWith('DEGRADED');
    });
  });
});
