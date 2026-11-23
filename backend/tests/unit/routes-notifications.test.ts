import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const notification = {
  getRecentWithCount: vi.fn(),
  getPaginatedHistory: vi.fn(),
  getUnreadCount: vi.fn(),
  markAllAsRead: vi.fn(),
  markAsRead: vi.fn(),
  deleteAll: vi.fn(),
};

vi.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.userId = 15;
    next();
  },
}));

vi.mock('../../src/middleware/scope', () => ({
  requireScopeByMethod: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../src/services/domain/notification', () => ({
  notificationService: notification,
}));

vi.mock('../../src/utils/system/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('Notifications Routes', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const router = (await import('../../src/routes/notifications')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/notifications', router);

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /api/notifications/recent returns recent items with count', async () => {
    const mockRecent = {
      notifications: [{ id: 1, message: 'Price dropped' }],
      total: 1,
    };
    notification.getRecentWithCount.mockResolvedValue(mockRecent);

    const res = await fetch(`${baseUrl}/api/notifications/recent?limit=5`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(mockRecent);
    expect(notification.getRecentWithCount).toHaveBeenCalledWith(15, 5);
  });

  it('GET /api/notifications/history returns paginated history with filters', async () => {
    const mockHistory = {
      items: [{ id: 2, message: 'Back in stock' }],
      page: 1,
      total: 1,
    };
    notification.getPaginatedHistory.mockResolvedValue(mockHistory);

    const res = await fetch(`${baseUrl}/api/notifications/history?page=2&limit=25&filter=price_drop`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(mockHistory);
    expect(notification.getPaginatedHistory).toHaveBeenCalledWith(15, 2, 25, 'price_drop');
  });

  it('GET /api/notifications/count returns unread count badge', async () => {
    notification.getUnreadCount.mockResolvedValue(4);

    const res = await fetch(`${baseUrl}/api/notifications/count`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ count: 4 });
    expect(notification.getUnreadCount).toHaveBeenCalledWith(15);
  });

  it('POST /api/notifications/read-all marks all notifications as read', async () => {
    notification.markAllAsRead.mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/notifications/read-all`, { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe('All notifications marked as read');
    expect(notification.markAllAsRead).toHaveBeenCalledWith(15);
  });

  it('POST and PUT /api/notifications/:id/read mark specific notification as read', async () => {
    notification.markAsRead.mockResolvedValue(undefined);

    const resPost = await fetch(`${baseUrl}/api/notifications/99/read`, { method: 'POST' });
    expect(resPost.status).toBe(200);
    const resPut = await fetch(`${baseUrl}/api/notifications/99/read`, { method: 'PUT' });
    expect(resPut.status).toBe(200);

    expect(notification.markAsRead).toHaveBeenCalledWith(99, 15);
  });

  it('DELETE /api/notifications/all clears all notifications', async () => {
    notification.deleteAll.mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/notifications/all`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe('All notifications cleared');
    expect(notification.deleteAll).toHaveBeenCalledWith(15);
  });
});
