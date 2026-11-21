import crypto from 'crypto';
import type { Response, NextFunction } from 'express';
import type { Types } from 'mongoose';
import { Invitation, type IInvitation } from '../models/Invitation.ts';
import { Project } from '../models/Project.ts';
import { ProjectMembership } from '../models/ProjectMembership.ts';
import { User, type IUser, type UserRole } from '../models/User.ts';
import { Workspace } from '../models/Workspace.ts';
import { Activity } from '../models/Activity.ts';
import { config } from '../config/env.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { normalizeEmail, validateEmail } from '../utils/validation.ts';
import {
  assertValidObjectId,
  canManageProject,
  getAccessibleProjectIds,
  normalizeProjectRole,
  requireProjectAccess,
} from '../utils/projectAuth.ts';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ALLOWED_INVITE_ROLES: UserRole[] = [
  'Admin',
  'Engineering Lead',
  'Developer',
  'Designer',
  'QA Engineer',
  'Member',
  'Viewer',
];

export function normalizeRawToken(rawToken: unknown): string {
  const trimmed = String(rawToken || '').trim();
  if (!trimmed) return '';
  try {
    return decodeURIComponent(trimmed).trim();
  } catch {
    return trimmed;
  }
}

export function hashInvitationToken(rawToken: string): string {
  return crypto.createHash('sha256').update(normalizeRawToken(rawToken)).digest('hex');
}

function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

async function expireStaleInvitations(): Promise<void> {
  await Invitation.updateMany(
    { status: 'Pending', expiresAt: { $lte: new Date() } },
    { $set: { status: 'Expired' } }
  );
}

function sanitizeInvitationDoc(inv: Record<string, unknown>) {
  const copy = { ...inv };
  delete copy.tokenHash;
  return copy;
}

export async function listInvitations(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    await expireStaleInvitations();

    const { projectId } = req.query;
    const { projectIds, roleByProjectId } = await getAccessibleProjectIds(req.user._id);
    const manageableProjectIds = projectIds.filter((pid) => {
      const role = roleByProjectId.get(String(pid));
      return role ? canManageProject(role) : false;
    });

    let filter: Record<string, unknown>;
    if (projectId && projectId !== 'all') {
      const { project } = await requireProjectAccess(
        req.user._id,
        projectId,
        'manageProject'
      );
      filter = { project: project._id };
    } else {
      filter = {
        $or: [
          { project: { $in: manageableProjectIds } },
          { project: null, invitedBy: req.user._id },
        ],
      };
    }

    const invitations = await Invitation.find(filter)
      .select('-tokenHash')
      .populate('project', 'name key description')
      .populate('invitedBy', 'name email avatarColor')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ invitations });
  } catch (err) {
    next(err);
  }
}

export async function listMyPendingInvitations(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    await expireStaleInvitations();

    const invitations = await Invitation.find({
      email: req.user.email.toLowerCase(),
      status: 'Pending',
      expiresAt: { $gt: new Date() },
    })
      .select('-tokenHash')
      .populate('project', 'name key description')
      .populate('invitedBy', 'name email avatarColor')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ invitations });
  } catch (err) {
    next(err);
  }
}

export async function createInvitation(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const { email, role = 'Member', projectId, message = '' } = req.body;

    const emailError = validateEmail(email);
    if (emailError) {
      throw new AppError(emailError, 400);
    }
    const normalizedEmail = normalizeEmail(email);

    if (role === 'Owner') {
      throw new AppError('Cannot invite a user directly as Owner.', 400);
    }
    if (!ALLOWED_INVITE_ROLES.includes(role)) {
      throw new AppError('Invalid team role selected.', 400);
    }

    await expireStaleInvitations();

    let projectDoc = null;
    let senderRole: 'Owner' | 'Admin' | 'Member' | 'Viewer' = 'Member';

    if (projectId && projectId !== 'workspace') {
      const access = await requireProjectAccess(
        req.user._id,
        projectId,
        'manageProject'
      );
      projectDoc = access.project;
      senderRole = access.role;

      // Never allow elevating invitee beyond sender's authority
      const targetNormalizedRole = normalizeProjectRole(role);
      if (targetNormalizedRole === 'Admin' && senderRole !== 'Owner') {
        throw new AppError(
          'Only a project owner can invite another project admin.',
          403
        );
      }
    } else {
      // Workspace-level invitation requires user to own/admin at least one project or hold global Admin
      const { projectIds, roleByProjectId } = await getAccessibleProjectIds(req.user._id);
      const managesAnyProject = projectIds.some((pid) => {
        const r = roleByProjectId.get(String(pid));
        return r ? canManageProject(r) : false;
      });
      if (!managesAnyProject && req.user.role !== 'Admin') {
        throw new AppError(
          'Please select a project you own or administer to send an invitation.',
          403
        );
      }
      if (
        normalizeProjectRole(role) === 'Admin' &&
        req.user.role !== 'Admin' &&
        !projectIds.some((pid) => roleByProjectId.get(String(pid)) === 'Owner')
      ) {
        throw new AppError(
          'You cannot invite a member with higher authority than your own.',
          403
        );
      }
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      if (existingUser.status === 'Inactive') {
        throw new AppError(
          'An inactive account exists for this email.',
          409
        );
      }
      if (projectDoc) {
        const existingMembership = await ProjectMembership.findOne({
          project: projectDoc._id,
          user: existingUser._id,
          membershipStatus: 'Active',
        }).lean();
        const isLegacyMember =
          String(projectDoc.owner) === String(existingUser._id) ||
          String(projectDoc.lead) === String(existingUser._id) ||
          projectDoc.members.some((m) => String(m) === String(existingUser._id));

        if (existingMembership || isLegacyMember) {
          throw new AppError(
            `${existingUser.name} is already a member of ${projectDoc.name}.`,
            409
          );
        }
      }
    }

    const duplicatePending = await Invitation.findOne({
      email: normalizedEmail,
      project: projectDoc ? projectDoc._id : null,
      status: 'Pending',
      expiresAt: { $gt: new Date() },
    });
    if (duplicatePending) {
      throw new AppError(
        `An active pending invitation already exists for ${normalizedEmail}${
          projectDoc ? ` in ${projectDoc.name}` : ''
        }.`,
        409
      );
    }

    const workspace = await Workspace.findOne().lean();
    const workspaceName = workspace?.name || 'Trackly Engineering';

    const rawToken = generateRawToken();
    const tokenHash = hashInvitationToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const created = await Invitation.create({
      email: normalizedEmail,
      role,
      project: projectDoc ? projectDoc._id : null,
      workspaceName,
      message: String(message || '').trim().slice(0, 500),
      tokenHash,
      status: 'Pending',
      invitedBy: req.user._id,
      expiresAt,
    });

    await Activity.create({
      user: req.user._id,
      project: projectDoc ? projectDoc._id : null,
      action: 'INVITATION_CREATED',
      description: `created a ${role} invitation for ${normalizedEmail}${
        projectDoc ? ` (${projectDoc.key})` : ''
      }`,
    });

    const populated = await Invitation.findById(created._id)
      .select('-tokenHash')
      .populate('project', 'name key description')
      .populate('invitedBy', 'name email avatarColor')
      .lean();

    const invitePath = `/invite/${rawToken}`;
    res.status(201).json({
      invitation: populated,
      inviteToken: rawToken,
      invitePath,
      ...(config.frontendUrl
        ? { inviteUrl: `${config.frontendUrl}${invitePath}` }
        : {}),
    });
  } catch (err) {
    next(err);
  }
}

export async function validateInvitationToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawToken = normalizeRawToken(req.params.token);
    if (!rawToken || rawToken.length < 16) {
      res.json({
        valid: false,
        status: 'Invalid',
        reason: 'This invitation link is invalid or malformed.',
      });
      return;
    }

    const tokenHash = hashInvitationToken(rawToken);
    const invitation = await Invitation.findOne({ tokenHash })
      .populate('project', 'name key description')
      .populate('invitedBy', 'name email avatarColor');

    if (!invitation) {
      res.json({
        valid: false,
        status: 'Invalid',
        reason: 'This invitation link could not be found.',
      });
      return;
    }

    if (invitation.status === 'Pending' && invitation.expiresAt <= new Date()) {
      invitation.status = 'Expired';
      await invitation.save();
    }

    if (invitation.status === 'Revoked') {
      res.json({
        valid: false,
        status: 'Revoked',
        reason: 'This invitation has been revoked by a project administrator.',
      });
      return;
    }

    if (invitation.status === 'Accepted') {
      res.json({
        valid: false,
        status: 'Accepted',
        reason: 'This invitation has already been accepted.',
      });
      return;
    }

    if (invitation.status === 'Rejected') {
      res.json({
        valid: false,
        status: 'Rejected',
        reason: 'This invitation was declined by the recipient.',
      });
      return;
    }

    if (invitation.status === 'Expired') {
      res.json({
        valid: false,
        status: 'Expired',
        reason: 'This invitation link has expired. Ask an administrator to generate a fresh link.',
      });
      return;
    }

    const inviter = invitation.invitedBy as unknown as { name?: string } | null;
    const proj = invitation.project as unknown as {
      _id: string;
      name: string;
      key: string;
      description?: string;
    } | null;

    res.json({
      valid: true,
      status: 'Pending',
      invitation: {
        _id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        project: proj
          ? {
              _id: String(proj._id),
              name: proj.name,
              key: proj.key,
              description: proj.description || '',
            }
          : null,
        workspaceName: invitation.workspaceName,
        message: invitation.message,
        invitedByName: inviter?.name || 'Project Administrator',
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function performAcceptInvitation(
  invitation: IInvitation,
  authUser: IUser,
  res: Response
): Promise<void> {
  if (invitation.status === 'Revoked') {
    throw new AppError('This invitation has been revoked.', 410);
  }
  if (invitation.status === 'Accepted') {
    throw new AppError('This invitation has already been accepted.', 409);
  }
  if (invitation.status === 'Rejected') {
    throw new AppError('This invitation has already been declined.', 409);
  }
  if (invitation.status === 'Expired' || invitation.expiresAt <= new Date()) {
    if (invitation.status !== 'Expired') {
      invitation.status = 'Expired';
      await invitation.save();
    }
    throw new AppError('This invitation link has expired.', 410);
  }

  if (authUser.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new AppError(
      `This invitation was issued for ${invitation.email}. Please sign in with that email address.`,
      403
    );
  }

  const userDoc = await User.findById(authUser._id);
  if (!userDoc) {
    throw new AppError('Authenticated account could not be found.', 404);
  }
  if (userDoc.status === 'Inactive') {
    throw new AppError('Your account is inactive.', 403);
  }

  const now = new Date();
  const claimed = await Invitation.findOneAndUpdate(
    {
      _id: invitation._id,
      status: 'Pending',
      expiresAt: { $gt: now },
    },
    {
      $set: {
        status: 'Accepted',
        acceptedAt: now,
        acceptedBy: userDoc._id,
      },
    },
    { new: true }
  );

  if (!claimed) {
    throw new AppError('This invitation has already been used or expired.', 409);
  }

  const projId = (invitation.project
    ? (invitation.project as unknown as { _id?: Types.ObjectId })._id ||
      (invitation.project as Types.ObjectId)
    : null) as Types.ObjectId | null;

  try {
    if (userDoc.status === 'Invited') {
      userDoc.status = 'Active';
      await userDoc.save();
    }

    if (projId) {
      const normalizedRole = normalizeProjectRole(invitation.role);
      const membershipRole = normalizedRole === 'Owner' ? 'Admin' : normalizedRole;

      await ProjectMembership.findOneAndUpdate(
        { project: projId, user: userDoc._id },
        {
          $set: {
            role: membershipRole,
            membershipStatus: 'Active',
            joinedAt: now,
          },
        },
        { upsert: true, new: true }
      );

      await Project.findByIdAndUpdate(projId, {
        $addToSet: { members: userDoc._id },
      });
    }

    await Activity.create({
      user: userDoc._id,
      project: projId || null,
      action: 'INVITATION_ACCEPTED',
      description: `accepted invitation as ${invitation.role}`,
    });
  } catch (err) {
    // Rollback invitation claim if membership creation failed
    await Invitation.findByIdAndUpdate(claimed._id, {
      $set: { status: 'Pending', acceptedAt: null, acceptedBy: null },
    }).catch(() => undefined);
    throw err;
  }

  res.json({
    message: 'Invitation accepted.',
    projectId: projId ? String(projId) : null,
    user: {
      _id: userDoc._id,
      name: userDoc.name,
      email: userDoc.email,
      role: userDoc.role,
      title: userDoc.title,
      avatar: userDoc.avatar,
      avatarColor: userDoc.avatarColor,
      status: userDoc.status,
      notificationPrefs: userDoc.notificationPrefs,
      appearancePrefs: userDoc.appearancePrefs,
      createdAt: userDoc.createdAt,
    },
  });
}

async function performRejectInvitation(
  invitation: IInvitation,
  authUser: IUser,
  res: Response
): Promise<void> {
  if (invitation.status === 'Revoked') {
    throw new AppError('This invitation has been revoked.', 410);
  }
  if (invitation.status === 'Accepted') {
    throw new AppError('This invitation has already been accepted.', 409);
  }
  if (invitation.status === 'Rejected') {
    throw new AppError('This invitation has already been declined.', 409);
  }
  if (invitation.status === 'Expired' || invitation.expiresAt <= new Date()) {
    if (invitation.status !== 'Expired') {
      invitation.status = 'Expired';
      await invitation.save();
    }
    throw new AppError('This invitation link has expired.', 410);
  }

  if (authUser.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new AppError(
      `This invitation was issued for ${invitation.email}. Only the invited recipient can reject it.`,
      403
    );
  }

  const now = new Date();
  const updated = await Invitation.findOneAndUpdate(
    {
      _id: invitation._id,
      status: 'Pending',
      expiresAt: { $gt: now },
    },
    {
      $set: {
        status: 'Rejected',
        rejectedAt: now,
        rejectedBy: authUser._id,
      },
    },
    { new: true }
  )
    .select('-tokenHash')
    .populate('project', 'name key description')
    .populate('invitedBy', 'name email avatarColor')
    .lean();

  if (!updated) {
    throw new AppError('This invitation is no longer pending.', 409);
  }

  const projId = (invitation.project
    ? (invitation.project as unknown as { _id?: Types.ObjectId })._id ||
      (invitation.project as Types.ObjectId)
    : null) as Types.ObjectId | null;

  await Activity.create({
    user: authUser._id,
    project: projId || null,
    action: 'INVITATION_REJECTED',
    description: `declined invitation for ${invitation.email}`,
  });

  res.json({
    message: 'Invitation declined.',
    invitation: sanitizeInvitationDoc(updated as unknown as Record<string, unknown>),
  });
}

export async function acceptInvitation(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Please sign in or register to accept this invitation.', 401);
    }
    const rawToken = normalizeRawToken(req.params.token);
    if (!rawToken) {
      throw new AppError('Invitation token is required.', 400);
    }

    const tokenHash = hashInvitationToken(rawToken);
    const invitation = await Invitation.findOne({ tokenHash });
    if (!invitation) {
      throw new AppError('Invalid invitation link.', 404);
    }

    await performAcceptInvitation(invitation, req.user, res);
  } catch (err) {
    next(err);
  }
}

export async function acceptMyInvitationById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }
    const id = assertValidObjectId(req.params.id, 'invitation');
    const invitation = await Invitation.findById(id);
    if (!invitation) {
      throw new AppError('Invitation not found.', 404);
    }

    await performAcceptInvitation(invitation, req.user, res);
  } catch (err) {
    next(err);
  }
}

export async function rejectInvitation(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Please sign in to decline this invitation.', 401);
    }
    const rawToken = normalizeRawToken(req.params.token);
    if (!rawToken) {
      throw new AppError('Invitation token is required.', 400);
    }

    const tokenHash = hashInvitationToken(rawToken);
    const invitation = await Invitation.findOne({ tokenHash });
    if (!invitation) {
      throw new AppError('Invalid invitation link.', 404);
    }

    await performRejectInvitation(invitation, req.user, res);
  } catch (err) {
    next(err);
  }
}

export async function rejectMyInvitationById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }
    const id = assertValidObjectId(req.params.id, 'invitation');
    const invitation = await Invitation.findById(id);
    if (!invitation) {
      throw new AppError('Invitation not found.', 404);
    }

    await performRejectInvitation(invitation, req.user, res);
  } catch (err) {
    next(err);
  }
}

async function assertCanManageInvitation(
  user: IUser,
  invitation: IInvitation
): Promise<void> {
  if (invitation.project) {
    await requireProjectAccess(user._id, invitation.project, 'manageProject');
    return;
  }
  if (String(invitation.invitedBy) !== String(user._id) && user.role !== 'Admin') {
    throw new AppError('You do not have permission to manage this invitation.', 403);
  }
}

export async function resendInvitation(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const id = assertValidObjectId(req.params.id, 'invitation');
    const invitation = await Invitation.findById(id);
    if (!invitation) throw new AppError('Invitation not found.', 404);

    await assertCanManageInvitation(req.user, invitation);

    if (invitation.status === 'Accepted') {
      throw new AppError('This invitation has already been accepted.', 400);
    }
    if (invitation.status === 'Revoked') {
      throw new AppError(
        'Revoked invitations cannot be resent. Create a new invitation instead.',
        400
      );
    }
    if (invitation.status === 'Rejected') {
      throw new AppError(
        'Declined invitations cannot be resent. Create a new invitation instead.',
        400
      );
    }

    const rawToken = generateRawToken();
    invitation.tokenHash = hashInvitationToken(rawToken);
    invitation.status = 'Pending';
    invitation.expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await invitation.save();

    const populated = await Invitation.findById(invitation._id)
      .select('-tokenHash')
      .populate('project', 'name key description')
      .populate('invitedBy', 'name email avatarColor')
      .lean();

    const invitePath = `/invite/${rawToken}`;
    res.json({
      invitation: populated,
      inviteToken: rawToken,
      invitePath,
      ...(config.frontendUrl
        ? { inviteUrl: `${config.frontendUrl}${invitePath}` }
        : {}),
    });
  } catch (err) {
    next(err);
  }
}

export async function revokeInvitation(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const id = assertValidObjectId(req.params.id, 'invitation');
    const invitation = await Invitation.findById(id);
    if (!invitation) throw new AppError('Invitation not found.', 404);

    await assertCanManageInvitation(req.user, invitation);

    if (invitation.status === 'Accepted') {
      throw new AppError('Accepted invitations cannot be revoked.', 400);
    }
    if (invitation.status === 'Rejected') {
      throw new AppError('Declined invitations are already closed.', 400);
    }
    if (invitation.status === 'Revoked') {
      throw new AppError('This invitation is already revoked.', 400);
    }

    invitation.status = 'Revoked';
    invitation.revokedAt = new Date();
    await invitation.save();

    await Activity.create({
      user: req.user._id,
      project: invitation.project || null,
      action: 'INVITATION_REVOKED',
      description: `revoked the invitation for ${invitation.email}`,
    });

    const populated = await Invitation.findById(invitation._id)
      .select('-tokenHash')
      .populate('project', 'name key description')
      .populate('invitedBy', 'name email avatarColor')
      .lean();

    res.json({ invitation: populated });
  } catch (err) {
    next(err);
  }
}
