import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { logger } from './logger';
import { userRepository } from '../../models';

export function asyncHandler(
  handler: (req: AuthRequest, res: Response) => Promise<any>,
  contextPrefix: string,
  category: string,
  defaultErrorMsg: string
) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await handler(req, res);
    } catch (error: any) {
      if (res.headersSent) return;

      // Unify specific error mappings from controllers
      if (error instanceof TypeError && error.message === 'Invalid URL') {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      if (error.statusCode === 409) {
        return res.status(409).json({
          error: error.message,
          message: error.message.includes('tracking') ? 'You are already tracking this product.' : undefined,
          existingProductId: error.existingProductId
        });
      }

      if (
        error.message?.includes('URL format') || 
        error.message?.includes('extract price') || 
        error.message === 'Domain is required'
      ) {
        return res.status(400).json({ error: error.message });
      }

      if (error.message?.includes('duplicate key value')) {
        return res.status(409).json({ error: 'You are already tracking this product' });
      }

      if (error.statusCode && error.statusCode < 500) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      // Default error handling
      logger.error(`${contextPrefix} | Failed | ${error.message}`, category, error);
      res.status(error.statusCode || 500).json({ error: defaultErrorMsg });
    }
  };
}

export function parseIdParam(req: AuthRequest, paramName: string = 'id'): number | null {
  const id = parseInt(req.params[paramName], 10);
  if (isNaN(id)) {
    return null;
  }
  return id;
}


/**
 * Whether the caller is an administrator.
 *
 * Resolved per request from the database rather than from the token, so
 * revoking someone's admin rights takes effect immediately instead of when
 * their JWT expires. Only routes that offer a cross-user bypass should call it
 * -- listing routes deliberately do not, because an administrator's own
 * dashboard must keep showing only their own products.
 */
export async function callerIsAdmin(req: AuthRequest): Promise<boolean> {
  if (req.isAdmin !== undefined) return req.isAdmin;
  // A system token acts on behalf of the installation rather than a person and
  // is scoped elsewhere; it does not get the cross-user bypass.
  if (req.isSystemToken || !req.userId) {
    req.isAdmin = false;
    return false;
  }
  const user = await userRepository.findById(req.userId);
  req.isAdmin = user?.is_admin === true;
  return req.isAdmin;
}
