import { Router } from 'express';
import { getActivities } from '../controllers/activityController.ts';
import { protect } from '../middleware/auth.ts';

const router = Router();

router.use(protect);
router.get('/', getActivities);

export default router;
