import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { requireScopeByMethod } from '../../middleware/scope';
import { SCOPE_MCP_READ, SCOPE_MCP_WRITE } from '../../services/domain/token/scopes';
import crudRoutes from './crud';
import bulkRoutes from './bulk';
import scanRoutes from './scan';
import searchRoutes from './search';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// A system token needs a scope that covers the tracked catalogue (issue #217).
// Signed-in people and tokens issued before migration 022 are unaffected; what
// this stops is a token granted `mcp:read` being able to untrack a product.
router.use(requireScopeByMethod({ read: [SCOPE_MCP_READ], write: [SCOPE_MCP_WRITE] }));

// Sub-routes
router.use('/search', searchRoutes);
router.use('/bulk', bulkRoutes);
router.use('/', scanRoutes); // Scan routes have IDs, must be before generic crud if there are overlaps, but crud has ID routes too.
router.use('/', crudRoutes);

export default router;
