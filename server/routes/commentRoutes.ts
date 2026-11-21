import { Router } from 'express';
import { deleteComment, updateComment } from '../controllers/commentController.ts';
import { protect } from '../middleware/auth.ts';

const router = Router();

router.use(protect);
router.patch('/:commentId', updateComment);
router.delete('/:commentId', deleteComment);

export default router;
