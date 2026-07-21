import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { userService } from '../../services/domain/user';
import { logger } from '../../utils/system/logger';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

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
