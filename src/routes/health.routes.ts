import { Router } from 'express';
import { checkHealth } from '../controllers/health.controller';

const router: Router = Router();

router.get('/health', checkHealth);

export default router;
