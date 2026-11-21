import { Router } from 'express';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  updateProjectMemberRole,
  removeProjectMember,
  deleteProject,
} from '../controllers/projectController.ts';
import { protect } from '../middleware/auth.ts';

const router = Router();

router.use(protect);
router.get('/', getProjects);
router.post('/', createProject);
router.get('/:id', getProjectById);
router.patch('/:id', updateProject);
router.patch('/:id/members/:memberId', updateProjectMemberRole);
router.delete('/:id/members/:memberId', removeProjectMember);
router.delete('/:id', deleteProject);

export default router;
