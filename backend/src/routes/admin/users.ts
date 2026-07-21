import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { userService } from '../../services/domain/user';
import { asyncHandler, parseIdParam } from '../../utils/system/route-helpers';

const router = Router();

router.get('/', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const users = await userService.getAllUsers();
  res.json(users);
}, 'Admin | Fetch Users', 'Admin', 'Failed to fetch users'));

router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password, is_admin, currency, locale } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = await userService.createUser({ email, password, is_admin, currency, locale });

  res.status(201).json({
    message: 'User created successfully',
    user: {
      id: user.id,
      email: user.email,
      is_admin: is_admin || false,
      currency: user.currency,
      locale: user.locale
    },
  });
}, 'Admin | Create User', 'Admin', 'Failed to create user'));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const targetId = parseIdParam(req);

  if (targetId === null) {
    res.status(400).json({ error: 'Invalid user ID' });
    return;
  }

  const userId = req.userId!;
  const deleted = await userService.deleteUser(targetId, userId);

  if (!deleted) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ message: 'User deleted successfully' });
}, 'Admin | Delete User', 'Admin', 'Failed to delete user'));

router.put('/:id/admin', asyncHandler(async (req: AuthRequest, res: Response) => {
  const targetId = parseIdParam(req);
  const { is_admin } = req.body;

  if (targetId === null) {
    res.status(400).json({ error: 'Invalid user ID' });
    return;
  }

  const userId = req.userId!;
  const updated = await userService.setAdminStatus(targetId, userId, is_admin);

  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ message: `Admin status ${is_admin ? 'granted' : 'revoked'} successfully` });
}, 'Admin | Toggle Admin', 'Admin', 'Failed to toggle admin status'));

router.put('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const targetId = parseIdParam(req);

  if (targetId === null) {
    res.status(400).json({ error: 'Invalid user ID' });
    return;
  }

  const userId = req.userId!;
  const user = await userService.adminUpdateUser(targetId, userId, req.body);

  res.json({ message: 'User updated successfully', user });
}, 'Admin | Update User', 'Admin', 'Failed to update user'));

export default router;
