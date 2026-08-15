import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { authService } from '../../services/domain/auth';
import { passwordResetService } from '../../services/domain/auth/password-reset';
import { logger } from '../../utils/system/logger';
import { asyncHandler } from '../../utils/system/route-helpers';
import oidcRoutes from './oidc';

const router = Router();

// OIDC / SSO. The sub-router 404s when SSO is disabled.
router.use('/oidc', oidcRoutes);

// Get registration status
router.get('/registration-status', asyncHandler(async (_req, res) => {
  const enabled = await authService.isRegistrationEnabled();
  res.json({ enabled, registration_enabled: enabled });
}, 'Auth | Status', 'Auth', 'Failed to fetch registration status'));

// Register a new user
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.registerUser(email, password);
  res.status(201).json(result);
}, 'Auth | Register', 'Auth', 'Failed to register user'));

// Login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.loginUser(email, password);
  res.json(result);
}, 'Auth | Login', 'Auth', 'Failed to login'));

// Password reset availability (admin toggle + configured system mailer)
router.get('/password-reset-status', asyncHandler(async (_req, res) => {
  const enabled = await passwordResetService.isEnabled();
  res.json({ enabled });
}, 'Auth | Reset Status', 'Auth', 'Failed to fetch password reset status'));

// Request a password reset email. Always responds identically, so the
// endpoint cannot be used to probe which emails have accounts.
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;
  const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  await passwordResetService.requestReset(email, baseUrl, req.ip || 'unknown');
  res.json({ message: 'If that email belongs to an account, a reset link has been sent.' });
}, 'Auth | Forgot Password', 'Auth', 'Failed to process password reset request'));

// Consume a reset token and set the new password
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  await passwordResetService.resetPassword(token, password);
  res.json({ message: 'Password updated. You can now log in with your new password.' });
}, 'Auth | Reset Password', 'Auth', 'Failed to reset password'));

export default router;
