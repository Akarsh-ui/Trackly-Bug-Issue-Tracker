import { Router } from 'express';
import { getWorkspace, updateWorkspace } from '../controllers/workspaceController.ts';
import { protect, requireRole } from '../middleware/auth.ts';

const router = Router();

router.use(protect);
router.get('/', getWorkspace);
router.patch('/', requireRole(['Admin']), updateWorkspace);

export default router;
