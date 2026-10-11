import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { requireScopeByMethod } from '../../middleware/scope';
import {
  SCOPE_ADMIN_READ,
  SCOPE_FULL,
  SCOPE_MCP_READ
} from '../../services/domain/token/scopes';
import { userService } from '../../services/domain/user';
import { logger } from '../../utils/system/logger';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Writing here changes the account the token is attached to -- including its
// email address, which is where a password reset would be sent. That is
// account takeover rather than an integration task, so it takes full access: a
// scoped token can read the profile it acts as and nothing more (#217).
router.use(
  requireScopeByMethod({
    read: [SCOPE_MCP_READ, SCOPE_ADMIN_READ],
    write: [SCOPE_FULL]
  })
);

// Get profile
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const profile = await userService.getProfile(req.userId!);
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update profile
router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const profile = await userService.updateProfile(req.userId!, req.body);
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Change password
router.post('/change-password', async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  try {
    await userService.changePassword(req.userId!, currentPassword, newPassword);
    res.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    const status = (error as any).statusCode || 500;
    res.status(status).json({ error: error.message });
  }
});

// Alias for password change (PUT support and underscores)
router.put('/password', async (req: AuthRequest, res: Response) => {
  const { current_password, new_password, currentPassword, newPassword } = req.body;
  const current = currentPassword || current_password;
  const next = newPassword || new_password;

  try {
    await userService.changePassword(req.userId!, current, next);
    res.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    const status = (error as any).statusCode || 500;
    res.status(status).json({ error: error.message });
  }
});

export default router;
