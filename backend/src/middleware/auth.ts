import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { systemApiTokenService, SystemTokenVerification } from '../services/domain/token';
import { SCOPE_FULL } from '../services/domain/token/scopes';
import { logger } from '../utils/system/logger';

export interface AuthRequest extends Request {
  userId?: number;
  isSystemToken?: boolean;
  tokenLabel?: string;
  /**
   * What the presenting credential is allowed to do, set alongside
   * `isSystemToken` and enforced by `requireScope` (`middleware/scope.ts`).
   *
   * Only system tokens have scopes. A browser session leaves this undefined,
   * because a person's authority comes from their account rather than from the
   * credential they signed in with.
   *
   * Typed as `string[]` rather than `TokenScope[]`: the values come from a
   * database column an operator can edit by hand, and an unrecognised entry has
   * to mean "grants nothing" rather than a type error.
   */
  tokenScopes?: string[];
  /**
   * Resolved on demand by routes that offer an administrator bypass, not on
   * every request. It is deliberately not carried in the JWT: a token minted
   * before a demotion would keep asserting admin until it expired.
   */
  isAdmin?: boolean;
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
    // Documented as bootstrap/emergency access, so it keeps full access. It is
    // the one credential an operator reaches for when the database-backed ones
    // are the problem; scoping it would defeat the point.
    req.tokenScopes = [SCOPE_FULL];
    logger.info(`Auth | Static Admin Token used`, 'Auth');
    next();
    return;
  }

  // 2. Check for DB-backed system tokens (only if not a JWT)
  if (!isLikelyJwt) {
    let verification: SystemTokenVerification | undefined;
    try {
      verification = await systemApiTokenService.verifyToken(token);
    } catch (error) {
      logger.error('Auth | System Token verification failed', 'Auth', error);
      verification = undefined;
    }

    if (verification) {
      switch (verification.outcome) {
        case 'valid': {
          const sysToken = verification.token;
          req.userId = sysToken.admin_id;
          req.isSystemToken = true;
          req.tokenLabel = sysToken.label;
          req.tokenScopes = sysToken.scopes;
          logger.info(
            `Auth | System API Token used: '${sysToken.label}' | scopes: ${sysToken.scopes.join(', ') || 'none'}`,
            'Auth'
          );
          next();
          return;
        }
        case 'expired':
          // Rejected here, before anything looks at scopes or admin status: an
          // expired credential is not a permissions question.
          res.status(401).json({ error: 'Token expired' });
          return;
        case 'unlinked':
          // Replaces `req.userId = sysToken.admin_id || 1`. A token that names
          // no user used to silently become user 1; now it fails, because
          // there is no identity to act as.
          res.status(401).json({
            error: 'This API token is not linked to a user account and can no longer be used'
          });
          return;
        case 'no-match':
          // Not one of ours. Fall through to the JWT check below -- it may
          // still be a session token that failed the three-part heuristic.
          break;
      }
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
