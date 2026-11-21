import { Router } from 'express';
import {
  getIssues,
  getIssueById,
  createIssue,
  updateIssue,
  updateIssueStatus,
  deleteIssue,
  uploadAttachment,
  deleteAttachment,
} from '../controllers/issueController.ts';
import {
  getCommentsByIssue,
  createComment,
} from '../controllers/commentController.ts';
import { protect } from '../middleware/auth.ts';
import { upload } from '../middleware/upload.ts';

const router = Router();

router.use(protect);
router.get('/', getIssues);
router.post('/', upload.single('attachment'), createIssue);
router.get('/:id', getIssueById);
router.patch('/:id', updateIssue);
router.patch('/:id/status', updateIssueStatus);
router.delete('/:id', deleteIssue);

router.post('/:id/attachments', upload.single('file'), uploadAttachment);
router.delete('/:id/attachments/:attachmentId', deleteAttachment);

router.get('/:issueId/comments', getCommentsByIssue);
router.post('/:issueId/comments', createComment);

export default router;
