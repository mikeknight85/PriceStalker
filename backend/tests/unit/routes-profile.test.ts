import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const user = {
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
};

vi.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.userId = 7;
    next();
  },
}));

vi.mock('../../src/middleware/scope', () => ({
  requireScopeByMethod: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../src/services/domain/user', () => ({
  userService: user,
}));

vi.mock('../../src/utils/system/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('Profile Routes', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const router = (await import('../../src/routes/profile')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/profile', router);

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /api/profile returns the current user profile', async () => {
    const mockProfile = { id: 7, email: 'user7@example.com', locale: 'en-US' };
    user.getProfile.mockResolvedValue(mockProfile);

    const res = await fetch(`${baseUrl}/api/profile`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(mockProfile);
    expect(user.getProfile).toHaveBeenCalledWith(7);
  });

  it('PUT /api/profile updates user profile', async () => {
    const updatedProfile = { id: 7, email: 'updated@example.com', locale: 'fr-FR' };
    user.updateProfile.mockResolvedValue(updatedProfile);

    const res = await fetch(`${baseUrl}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'fr-FR' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(updatedProfile);
    expect(user.updateProfile).toHaveBeenCalledWith(7, { locale: 'fr-FR' });
  });

  it('POST /api/profile/change-password changes user password', async () => {
    user.changePassword.mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/profile/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'oldpassword', newPassword: 'newpassword123' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe('Password updated successfully');
    expect(user.changePassword).toHaveBeenCalledWith(7, 'oldpassword', 'newpassword123');
  });

  it('PUT /api/profile/password supports underscore parameter alias', async () => {
    user.changePassword.mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/profile/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: 'oldpassword', new_password: 'newpassword123' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe('Password updated successfully');
    expect(user.changePassword).toHaveBeenCalledWith(7, 'oldpassword', 'newpassword123');
  });

  it('returns appropriate error code when changePassword rejects', async () => {
    const err: any = new Error('Current password does not match');
    err.statusCode = 400;
    user.changePassword.mockRejectedValue(err);

    const res = await fetch(`${baseUrl}/api/profile/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'wrong', newPassword: 'newpassword123' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Current password does not match');
  });
});
