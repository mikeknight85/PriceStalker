import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { authService } from '../../services/domain/auth';
import { logger } from '../../utils/system/logger';
import { asyncHandler } from '../../utils/system/route-helpers';

const router = Router();

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

export default router;
