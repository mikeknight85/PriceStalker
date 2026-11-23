import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const authServiceMock = {
  isRegistrationEnabled: vi.fn(),
  registerUser: vi.fn(),
  loginUser: vi.fn(),
};

const passwordResetServiceMock = {
  isEnabled: vi.fn(),
  requestReset: vi.fn(),
  resetPassword: vi.fn(),
};

vi.mock('../../src/services/domain/auth', () => ({
  authService: authServiceMock,
}));

vi.mock('../../src/services/domain/auth/password-reset', () => ({
  passwordResetService: passwordResetServiceMock,
}));

vi.mock('../../src/routes/auth/oidc', () => ({
  default: express.Router(),
}));

describe('Auth Routes (/api/auth)', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const router = (await import('../../src/routes/auth')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/auth', router);

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('GET /api/auth/registration-status', () => {
    it('returns registration enabled status', async () => {
      authServiceMock.isRegistrationEnabled.mockResolvedValueOnce(true);

      const res = await fetch(`${baseUrl}/api/auth/registration-status`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ enabled: true, registration_enabled: true });
    });
  });

  describe('POST /api/auth/register', () => {
    it('registers a user and returns 201', async () => {
      authServiceMock.registerUser.mockResolvedValueOnce({
        user: { id: 1, email: 'new@example.com' },
        token: 'jwt-token-123',
      });

      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@example.com', password: 'secretpassword123' }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.token).toBe('jwt-token-123');
      expect(authServiceMock.registerUser).toHaveBeenCalledWith('new@example.com', 'secretpassword123');
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in and returns tokens', async () => {
      authServiceMock.loginUser.mockResolvedValueOnce({
        user: { id: 1, email: 'user@example.com' },
        token: 'token-abc',
      });

      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'pwd' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.token).toBe('token-abc');
      expect(authServiceMock.loginUser).toHaveBeenCalledWith('user@example.com', 'pwd');
    });
  });

  describe('GET /api/auth/password-reset-status', () => {
    it('returns password reset enabled status', async () => {
      passwordResetServiceMock.isEnabled.mockResolvedValueOnce(true);

      const res = await fetch(`${baseUrl}/api/auth/password-reset-status`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ enabled: true });
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('always responds identically for enumeration protection', async () => {
      passwordResetServiceMock.requestReset.mockResolvedValueOnce(undefined);

      const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'any@example.com' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toContain('If that email belongs to an account');
      expect(passwordResetServiceMock.requestReset).toHaveBeenCalledWith(
        'any@example.com',
        expect.any(String),
        expect.any(String)
      );
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('consumes reset token and sets new password', async () => {
      passwordResetServiceMock.resetPassword.mockResolvedValueOnce(undefined);

      const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'valid-reset-token', password: 'brandNewPassword!' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toContain('Password updated');
      expect(passwordResetServiceMock.resetPassword).toHaveBeenCalledWith(
        'valid-reset-token',
        'brandNewPassword!'
      );
    });
  });
});
