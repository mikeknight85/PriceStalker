import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../utils/system/route-helpers';
import { APP_VERSION } from '../utils/system/app-version';

const router = Router();

// Auth is per-router in this app, not global. Without this line the endpoint
// would be open to anonymous callers, which is the opposite of what the comment
// below describes.
router.use(authMiddleware);

/**
 * What is actually running, for the version line in the user menu.
 *
 * Behind authentication deliberately. The version is not secret, but
 * advertising it to anonymous callers hands an attacker a shortcut to whichever
 * CVEs apply to this build, and everyone who needs to read it is signed in.
 */
router.get('/version', asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json({ version: APP_VERSION });
}, 'System', 'System', 'Failed to read version'));

export default router;
