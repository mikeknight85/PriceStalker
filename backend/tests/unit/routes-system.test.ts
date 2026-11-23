import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

vi.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.userId = 1;
    next();
  },
}));

vi.mock('../../src/middleware/scope', () => ({
  requireScope: () => (_req: any, _res: any, next: any) => next(),
}));

describe('System Routes', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    const router = (await import('../../src/routes/system')).default;
    const app = express();
    app.use('/api/system', router);

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /api/system/version returns the current app version', async () => {
    const res = await fetch(`${baseUrl}/api/system/version`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: string };
    expect(body.version).toBeDefined();
    expect(typeof body.version).toBe('string');
  });
});
