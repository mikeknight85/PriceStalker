import { Response, NextFunction, RequestHandler } from 'express';
import { AuthRequest } from './auth';
import { logger } from '../utils/system/logger';
import { TokenScope, scopesSatisfy } from '../services/domain/token/scopes';

/**
 * Scope enforcement for system API tokens (issue #217).
 *
 * Sits beside `adminMiddleware` and answers a different question. `admin.ts`
 * asks *who* is calling and whether that person is an administrator -- which it
 * resolves from the database on every request, so a system token has never been
 * able to bypass the admin check. `requireScope` asks what the *credential* is
 * allowed to do, which until now nothing asked at all.
 *
 * Both run: a token still has to belong to an administrator to reach
 * `/api/admin`, and now it also has to hold a scope that covers the route.
 */

/** Methods that cannot change state, and so only need a read scope. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const enforce = (
  req: AuthRequest,
  res: Response,
  required: readonly TokenScope[]
): boolean => {
  // Signed-in people carry no scopes, and should not. Scopes describe machine
  // credentials; a human at a browser is authorised by `adminMiddleware` and by
  // the per-row ownership checks in the services. Enforcing scopes here would
  // lock every user out of the application, since no JWT grants any.
  if (!req.isSystemToken) {
    return true;
  }

  if (scopesSatisfy(req.tokenScopes, required)) {
    return true;
  }

  // The label, not the token. Enough for an operator to find the row in Admin
  // and widen or replace it.
  logger.warn(
    `Auth | Token scope denied | '${req.tokenLabel ?? 'unknown token'}' | ` +
      `${req.method} ${req.originalUrl} requires one of: ${required.join(', ')}`,
    'Auth'
  );

  res.status(403).json({
    error: 'This API token is not authorised for this operation',
    required_scopes: [...required]
  });
  return false;
};

/**
 * Requires a system token to hold at least one of `required`.
 *
 * `'*'` satisfies everything, which is what keeps tokens issued before
 * migration 022 working exactly as they do today.
 */
export const requireScope = (...required: TokenScope[]): RequestHandler => {
  if (required.length === 0) {
    throw new Error('requireScope needs at least one scope');
  }
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (enforce(req, res, required)) next();
  };
};

/**
 * Requires a different scope set depending on whether the request can change
 * anything.
 *
 * Most routers mix reads and writes under one mount, and splitting the
 * requirement by method is both less code and harder to get wrong than
 * annotating each handler -- a new route added to the router inherits the
 * guard instead of silently shipping unguarded.
 */
export const requireScopeByMethod = (spec: {
  read: TokenScope[];
  write: TokenScope[];
}): RequestHandler => {
  if (spec.read.length === 0 || spec.write.length === 0) {
    throw new Error('requireScopeByMethod needs at least one scope on each side');
  }
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const required = SAFE_METHODS.has(req.method) ? spec.read : spec.write;
    if (enforce(req, res, required)) next();
  };
};
