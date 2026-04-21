import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { userQueries, systemSettingsQueries } from '../models';

const router = Router();

// All routes require authentication + admin
router.use(authMiddleware);
router.use(adminMiddleware);

// Get all users
router.get('/users', async (_req: AuthRequest, res: Response) => {
  try {
    const users = await userQueries.findAll();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create a new user
router.post('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, is_admin } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    const existingUser = await userQueries.findByEmail(email);
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await userQueries.create(email, passwordHash);

    // Set admin status if specified
    if (is_admin) {
      await userQueries.setAdmin(user.id, true);
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        is_admin: is_admin || false,
      },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Delete a user
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const targetId = parseInt(req.params.id, 10);

    if (isNaN(targetId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // Prevent deleting yourself
    if (targetId === userId) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const deleted = await userQueries.delete(targetId);

    if (!deleted) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Toggle admin status for a user
router.put('/users/:id/admin', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const targetId = parseInt(req.params.id, 10);
    const { is_admin } = req.body;

    if (isNaN(targetId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // Prevent removing your own admin status
    if (targetId === userId && !is_admin) {
      res.status(400).json({ error: 'Cannot remove your own admin status' });
      return;
    }

    const updated = await userQueries.setAdmin(targetId, is_admin);

    if (!updated) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ message: `Admin status ${is_admin ? 'granted' : 'revoked'} successfully` });
  } catch (error) {
    console.error('Error updating admin status:', error);
    res.status(500).json({ error: 'Failed to update admin status' });
  }
});

// Get system settings
router.get('/settings', async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await systemSettingsQueries.getAll();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({ error: 'Failed to fetch system settings' });
  }
});

// Update system settings
router.put('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const { registration_enabled } = req.body;

    if (registration_enabled !== undefined) {
      await systemSettingsQueries.set('registration_enabled', String(registration_enabled));
    }

    const settings = await systemSettingsQueries.getAll();
    res.json(settings);
  } catch (error) {
    console.error('Error updating system settings:', error);
    res.status(500).json({ error: 'Failed to update system settings' });
  }
});

export default router;
