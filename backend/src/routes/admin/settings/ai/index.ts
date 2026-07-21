import { Router } from 'express';
import configRoutes from './config';
import testsRoutes from './tests';

const router = Router();

router.use('/', testsRoutes);
router.use('/', configRoutes);

export default router;
