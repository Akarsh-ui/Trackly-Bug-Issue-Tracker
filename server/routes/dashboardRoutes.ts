import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController.ts';
import { protect } from '../middleware/auth.ts';

const router = Router();

router.use(protect);
router.get('/', getDashboardStats);

export default router;
