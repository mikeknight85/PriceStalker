import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { userQueries } from '../models';

export const adminMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.userId!;
    const user = await userQueries.findById(userId);

    if (!user || !user.is_admin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ error: 'Failed to verify admin status' });
  }
};
