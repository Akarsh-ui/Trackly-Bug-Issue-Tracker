import crypto from 'crypto';
import { Router, type Request, type Response } from 'express';

interface LocalBridgeInvite {
  _id: string;
  email: string;
  role: string;
  project: { _id: string; name: string; key: string } | null;
  workspaceName: string;
  message: string;
  tokenHash: string;
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Expired' | 'Revoked';
  invitedBy: {
    _id: string;
    name: string;
    email: string;
    avatarColor?: string;
  };
  expiresAt: string;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

const localInvitesByHash = new Map<string, LocalBridgeInvite>();

function hashLocalInviteToken(rawToken: string): string {
  return crypto
    .createHash('sha256')
    .update(`trackly_local_bridge:${rawToken}`)
    .digest('hex');
}

function expireIfNeeded(record: LocalBridgeInvite): void {
  if (
    record.status === 'Pending' &&
    new Date(record.expiresAt).getTime() <= Date.now()
  ) {
    record.status = 'Expired';
  }
}

const router = Router();

router.post('/', (req: Request, res: Response) => {
  const { rawToken, invitation } = req.body || {};
  const cleaned = String(rawToken || '').trim();
  if (!cleaned || !invitation || !invitation.email) {
    res.status(400).json({ message: 'Invalid local invitation sync payload.' });
    return;
  }

  const bridgeHash = hashLocalInviteToken(cleaned);
  const record: LocalBridgeInvite = {
    _id: String(invitation._id || `inv_${Date.now()}`),
    email: String(invitation.email).trim().toLowerCase(),
    role: String(invitation.role || 'Member'),
    project: invitation.project || null,
    workspaceName: String(invitation.workspaceName || 'Trackly Workspace'),
    message: String(invitation.message || ''),
    tokenHash: bridgeHash,
    status: invitation.status || 'Pending',
    invitedBy: invitation.invitedBy || {
      _id: 'usr_admin',
      name: 'Workspace Administrator',
      email: '',
    },
    expiresAt: String(invitation.expiresAt || new Date(Date.now() + 7 * 86400000).toISOString()),
    acceptedAt: invitation.acceptedAt || null,
    rejectedAt: invitation.rejectedAt || null,
    revokedAt: invitation.revokedAt || null,
    createdAt: String(invitation.createdAt || new Date().toISOString()),
  };

  localInvitesByHash.set(bridgeHash, record);
  res.json({ ok: true });
});

router.get('/validate/:token', (req: Request, res: Response) => {
  let cleaned = String(req.params.token || '').trim();
  try {
    cleaned = decodeURIComponent(cleaned).trim();
  } catch {
    // keep trimmed value
  }
  if (!cleaned || cleaned.length < 16) {
    res.json({
      valid: false,
      status: 'Invalid',
      reason: 'This invitation link is invalid or malformed.',
    });
    return;
  }

  const bridgeHash = hashLocalInviteToken(cleaned);
  const found = localInvitesByHash.get(bridgeHash);
  if (!found) {
    res.json({
      valid: false,
      status: 'Invalid',
      reason: 'This invitation link could not be found.',
    });
    return;
  }

  expireIfNeeded(found);

  if (found.status === 'Revoked') {
    res.json({
      valid: false,
      status: 'Revoked',
      reason: 'This invitation has been revoked by a project administrator.',
    });
    return;
  }
  if (found.status === 'Accepted') {
    res.json({
      valid: false,
      status: 'Accepted',
      reason: 'This invitation has already been accepted.',
    });
    return;
  }
  if (found.status === 'Rejected') {
    res.json({
      valid: false,
      status: 'Rejected',
      reason: 'This invitation has been declined by the recipient.',
    });
    return;
  }
  if (found.status === 'Expired') {
    res.json({
      valid: false,
      status: 'Expired',
      reason:
        'This invitation link has expired. Ask a project administrator to generate a fresh link.',
    });
    return;
  }

  res.json({
    valid: true,
    status: 'Pending',
    invitation: {
      _id: found._id,
      email: found.email,
      role: found.role,
      project: found.project,
      workspaceName: found.workspaceName,
      message: found.message,
      invitedByName: found.invitedBy?.name || 'Project Administrator',
      expiresAt: found.expiresAt,
      createdAt: found.createdAt,
    },
  });
});

router.post('/status', (req: Request, res: Response) => {
  const { rawToken, invitationId, status } = req.body || {};
  if (!['Accepted', 'Rejected', 'Revoked', 'Expired'].includes(String(status))) {
    res.status(400).json({ message: 'Invalid invitation status.' });
    return;
  }

  if (rawToken) {
    const bridgeHash = hashLocalInviteToken(String(rawToken).trim());
    const found = localInvitesByHash.get(bridgeHash);
    if (found) {
      found.status = status;
      if (status === 'Accepted') found.acceptedAt = new Date().toISOString();
      if (status === 'Rejected') found.rejectedAt = new Date().toISOString();
      if (status === 'Revoked') found.revokedAt = new Date().toISOString();
    }
  } else if (invitationId) {
    for (const found of localInvitesByHash.values()) {
      if (found._id === invitationId) {
        found.status = status;
        if (status === 'Accepted') found.acceptedAt = new Date().toISOString();
        if (status === 'Rejected') found.rejectedAt = new Date().toISOString();
        if (status === 'Revoked') found.revokedAt = new Date().toISOString();
      }
    }
  }

  res.json({ ok: true });
});

export default router;
