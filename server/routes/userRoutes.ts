import { Router } from 'express';
import { getUsers, inviteUser, updateUser } from '../controllers/userController.ts';
import { protect } from '../middleware/auth.ts';

const router = Router();

router.use(protect);
router.get('/', getUsers);
router.post('/invite', inviteUser);
router.patch('/:id', updateUser);

export default router;
