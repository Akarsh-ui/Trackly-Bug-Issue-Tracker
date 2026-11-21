import { Router } from 'express';
import {
  acceptInvitation,
  acceptMyInvitationById,
  createInvitation,
  listInvitations,
  listMyPendingInvitations,
  rejectInvitation,
  rejectMyInvitationById,
  resendInvitation,
  revokeInvitation,
  validateInvitationToken,
} from '../controllers/invitationController.ts';
import { protect } from '../middleware/auth.ts';

const router = Router();

// Public validation route so invitees can inspect project/role before signing in
router.get('/validate/:token', validateInvitationToken);

// Authenticated management, pending-dashboard, acceptance, and rejection routes
router.get('/mine', protect, listMyPendingInvitations);
router.post('/mine/:id/accept', protect, acceptMyInvitationById);
router.post('/mine/:id/reject', protect, rejectMyInvitationById);

router.get('/', protect, listInvitations);
router.post('/', protect, createInvitation);
router.post('/:token/accept', protect, acceptInvitation);
router.post('/:token/reject', protect, rejectInvitation);
router.post('/:id/resend', protect, resendInvitation);
router.post('/:id/revoke', protect, revokeInvitation);

export default router;
