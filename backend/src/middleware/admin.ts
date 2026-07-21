import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { userRepository } from '../models';
import { logger } from '../utils/system/logger';

/**
 * Middleware that requires the authenticated user to have admin privileges.
 * Must be used AFTER authMiddleware.
 */
export const adminMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await userRepository.findById(userId);

    if (!user || !user.is_admin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    next();
  } catch (error) {
    const err = error as Error;
    logger.error('Admin middleware error', 'Auth', err);
    res.status(500).json({ error: 'Internal server error during authorization' });
  }
};
