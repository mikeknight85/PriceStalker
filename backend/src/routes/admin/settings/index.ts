import { Router } from 'express';
import systemSettingsRoutes from './system';
import aiSettingsRoutes from './ai';

const router = Router();

router.use('/ai', aiSettingsRoutes);
router.use('/', systemSettingsRoutes);

export default router;
