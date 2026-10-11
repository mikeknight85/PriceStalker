import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { adminMiddleware } from '../../middleware/admin';
import { requireScope, requireScopeByMethod } from '../../middleware/scope';
import {
  SCOPE_ADMIN_READ,
  SCOPE_ADMIN_SYSTEM,
  SCOPE_ADMIN_WRITE,
  SCOPE_FULL,
  SCOPE_MCP_EXTRACT,
  SCOPE_MCP_READ
} from '../../services/domain/token/scopes';
import { systemService } from '../../services/domain/system';

import usersRoutes from './users';
import settingsRoutes from './settings';
import retailersRoutes from './retailers';
import debugRoutes from './debug';
import tokensRoutes from './tokens';
import logsRoutes from './logs';
import commandsRoutes from './commands';
import authConfigRoutes from './auth-config';

const router = Router();

// Publicly check if debug is enabled (no auth required for this specific check)
router.get('/debug/status', async (_req, res) => {
  try {
    const settings = await systemService.getSettings();
    const val = settings.debug_page_enabled as any;
    const isEnabled = val === 'true' || val === true;
    res.json({ enabled: isEnabled });
  } catch (e) {
    res.json({ enabled: false });
  }
});

// All other admin routes require auth and admin status
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * Scope requirements for the administrative tree (issue #217).
 *
 * These only constrain system API tokens -- a signed-in administrator is
 * unaffected, and a token issued before migration 022 holds `'*'` and so is
 * unaffected too. What changes is that a token issued *for* one job can now be
 * limited to it: an uptime monitor no longer reaches `run-migration` just
 * because the account it was minted by is an administrator.
 *
 * Read requirements accept `mcp:read` alongside `admin:read` because the
 * read-only diagnostics in ADR 001 §2.1 (logs, retailer config, db health) are
 * exactly this tree's GET routes.
 */
const adminConfig = requireScopeByMethod({
  read: [SCOPE_ADMIN_READ, SCOPE_MCP_READ],
  write: [SCOPE_ADMIN_WRITE]
});

router.use('/users', adminConfig, usersRoutes);
router.use('/settings', adminConfig, settingsRoutes);
router.use('/retailers', adminConfig, retailersRoutes);

// `POST /debug/extract` fetches a URL the caller chooses, which is the SSRF
// surface issue #165 is fixing. It gets its own scope so that the read-only
// diagnostics can be granted without it.
router.use(
  '/debug',
  requireScopeByMethod({
    read: [SCOPE_ADMIN_READ, SCOPE_MCP_READ],
    write: [SCOPE_MCP_EXTRACT, SCOPE_ADMIN_WRITE]
  }),
  debugRoutes
);

// Minting a token is how a narrow token would widen itself, so writing here
// takes full access: a scoped token can list tokens but cannot issue one.
router.use(
  '/system-tokens',
  requireScopeByMethod({ read: [SCOPE_ADMIN_READ], write: [SCOPE_FULL] }),
  tokensRoutes
);

// Clearing the log destroys the audit trail, so it sits with the operational
// commands rather than with ordinary configuration writes.
router.use(
  '/logs',
  requireScopeByMethod({
    read: [SCOPE_ADMIN_READ, SCOPE_MCP_READ],
    write: [SCOPE_ADMIN_SYSTEM]
  }),
  logsRoutes
);

// `run-migration` lives here.
router.use('/command', requireScope(SCOPE_ADMIN_SYSTEM), commandsRoutes);

// Authentication and SSO configuration. Not readable with `mcp:read`: it is
// the one admin GET whose response describes how people sign in.
router.use(
  '/auth',
  requireScopeByMethod({ read: [SCOPE_ADMIN_READ], write: [SCOPE_ADMIN_WRITE] }),
  authConfigRoutes
);

export default router;
