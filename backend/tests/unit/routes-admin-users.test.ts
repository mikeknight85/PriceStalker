import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const userServiceMock = {
  getAllUsers: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  setAdminStatus: vi.fn(),
  adminUpdateUser: vi.fn(),
};

vi.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.userId = 1;
    req.user = { is_admin: true };
    next();
  },
  adminMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../src/services/domain/user', () => ({
  userService: userServiceMock,
}));

describe('Admin Users Routes (/api/admin/users)', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const router = (await import('../../src/routes/admin/users')).default;
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.userId = 1;
      req.user = { id: 1, is_admin: true };
      next();
    });
    app.use('/api/admin/users', router);

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('GET /api/admin/users', () => {
    it('returns list of all users', async () => {
      userServiceMock.getAllUsers.mockResolvedValueOnce([{ id: 1, email: 'admin@example.com' }]);

      const res = await fetch(`${baseUrl}/api/admin/users`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual([{ id: 1, email: 'admin@example.com' }]);
      expect(userServiceMock.getAllUsers).toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/users', () => {
    it('returns 400 when email or password is missing', async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }), // missing password
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Email and password are required');
    });

    it('creates a user and returns 201', async () => {
      userServiceMock.createUser.mockResolvedValueOnce({
        id: 2,
        email: 'user@example.com',
        name: 'User',
        currency: 'USD',
        locale: 'en-US',
      });

      const res = await fetch(`${baseUrl}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'Password123!',
          name: 'User',
          is_admin: false,
          currency: 'USD',
          locale: 'en-US',
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.message).toBe('User created successfully');
      expect(data.user.id).toBe(2);
      expect(userServiceMock.createUser).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'Password123!',
        name: 'User',
        is_admin: false,
        currency: 'USD',
        locale: 'en-US',
      });
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    it('returns 400 for invalid user ID', async () => {
      const res = await fetch(`${baseUrl}/api/admin/users/invalid`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid user ID');
    });

    it('returns 404 when user is not found', async () => {
      userServiceMock.deleteUser.mockResolvedValueOnce(false);

      const res = await fetch(`${baseUrl}/api/admin/users/99`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('User not found');
    });

    it('returns 200 on successful deletion', async () => {
      userServiceMock.deleteUser.mockResolvedValueOnce(true);

      const res = await fetch(`${baseUrl}/api/admin/users/2`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('User deleted successfully');
      expect(userServiceMock.deleteUser).toHaveBeenCalledWith(2, 1);
    });
  });

  describe('PUT /api/admin/users/:id/admin', () => {
    it('returns 400 for invalid user ID', async () => {
      const res = await fetch(`${baseUrl}/api/admin/users/invalid/admin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_admin: true }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when user is not found', async () => {
      userServiceMock.setAdminStatus.mockResolvedValueOnce(false);

      const res = await fetch(`${baseUrl}/api/admin/users/99/admin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_admin: true }),
      });
      expect(res.status).toBe(404);
    });

    it('toggles admin status successfully', async () => {
      userServiceMock.setAdminStatus.mockResolvedValueOnce(true);

      const res = await fetch(`${baseUrl}/api/admin/users/2/admin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_admin: true }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Admin status granted successfully');
      expect(userServiceMock.setAdminStatus).toHaveBeenCalledWith(2, 1, true);
    });
  });

  describe('PUT /api/admin/users/:id', () => {
    it('returns 400 for invalid user ID', async () => {
      const res = await fetch(`${baseUrl}/api/admin/users/invalid`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });
      expect(res.status).toBe(400);
    });

    it('updates user details successfully', async () => {
      userServiceMock.adminUpdateUser.mockResolvedValueOnce({
        id: 2,
        email: 'user@example.com',
        name: 'New Name',
      });

      const res = await fetch(`${baseUrl}/api/admin/users/2`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('User updated successfully');
      expect(data.user.name).toBe('New Name');
      expect(userServiceMock.adminUpdateUser).toHaveBeenCalledWith(2, 1, { name: 'New Name' });
    });
  });
});
