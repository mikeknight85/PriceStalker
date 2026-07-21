import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import crudRoutes from './crud';
import bulkRoutes from './bulk';
import scanRoutes from './scan';
import searchRoutes from './search';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Sub-routes
router.use('/search', searchRoutes);
router.use('/bulk', bulkRoutes);
router.use('/', scanRoutes); // Scan routes have IDs, must be before generic crud if there are overlaps, but crud has ID routes too.
router.use('/', crudRoutes);

export default router;
