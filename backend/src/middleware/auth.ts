import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { systemApiTokenService } from '../services/domain/token';
import { logger } from '../utils/system/logger';

export interface AuthRequest extends Request {
  userId?: number;
  isSystemToken?: boolean;
  tokenLabel?: string;
}

interface JwtPayload {
  userId: number;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'No authorization header provided' });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({ error: 'Invalid authorization header format' });
    return;
  }

  const token = parts[1];

  // 0. Heuristic: If it looks like a JWT (3 parts), skip system token check to save DB calls/noise
  const isLikelyJwt = token.split('.').length === 3;

  // 1. Check for static admin token first (Bootstrap/Emergency Access)
  if (process.env.ADMIN_API_TOKEN && token === process.env.ADMIN_API_TOKEN) {
    req.userId = 1; // Assume primary admin user ID
    req.isSystemToken = true;
    req.tokenLabel = 'Static Admin Token';
    logger.info(`Auth | Static Admin Token used`, 'Auth');
    next();
    return;
  }

  // 2. Check for DB-backed system tokens (only if not a JWT)
  if (!isLikelyJwt) {
    try {
      const sysToken = await systemApiTokenService.verifyToken(token);
      if (sysToken) {
        req.userId = sysToken.admin_id || 1; // Fallback to 1 if not linked to specific user
        req.isSystemToken = true;
        req.tokenLabel = sysToken.label;
        logger.info(`Auth | System API Token used: '${sysToken.label}'`, 'Auth');
        next();
        return;
      }
    } catch (error) {
      logger.error('Auth | System Token verification failed', 'Auth', error);
    }
  }

  // 3. Check for User JWT
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    res.status(500).json({ error: 'Authentication failed' });
  }
};

export const generateToken = (userId: number): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
};
