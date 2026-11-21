import type { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { User } from '../models/User.ts';
import { Project } from '../models/Project.ts';
import { ProjectMembership } from '../models/ProjectMembership.ts';
import { Issue } from '../models/Issue.ts';
import { Activity } from '../models/Activity.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';
import {
  normalizeEmail,
  normalizeFullName,
  validateEmail,
  validateFullName,
  validatePassword,
} from '../utils/validation.ts';
import {
  assertValidObjectId,
  getAccessibleProjectIds,
  getCollaboratorUserIds,
  normalizeProjectRole,
  requireProjectAccess,
} from '../utils/projectAuth.ts';

export async function getUsers(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const [{ projectIds }, collaboratorIds] = await Promise.all([
      getAccessibleProjectIds(req.user._id),
      getCollaboratorUserIds(req.user._id),
    ]);

    const [users, issueCounts, projects, memberships] = await Promise.all([
      User.find({ _id: { $in: collaboratorIds } })
        .select('-password')
        .sort({ createdAt: 1 })
        .lean(),
      projectIds.length > 0
        ? Issue.aggregate([
            {
              $match: {
                project: { $in: projectIds },
                assignee: { $ne: null },
              },
            },
            {
              $group: {
                _id: '$assignee',
                totalAssigned: { $sum: 1 },
                openAssigned: {
                  $sum: { $cond: [{ $ne: ['$status', 'Done'] }, 1, 0] },
                },
              },
            },
          ])
        : Promise.resolve([]),
      projectIds.length > 0
        ? Project.find({ _id: { $in: projectIds } }).select('name key').lean()
        : Promise.resolve([]),
      projectIds.length > 0
        ? ProjectMembership.find({
            project: { $in: projectIds },
            user: { $in: collaboratorIds },
            membershipStatus: 'Active',
          })
            .select('project user role')
            .lean()
        : Promise.resolve([]),
    ]);

    const countMap = new Map<string, { totalAssigned: number; openAssigned: number }>();
    for (const row of issueCounts) {
      countMap.set(String(row._id), {
        totalAssigned: row.totalAssigned,
        openAssigned: row.openAssigned,
      });
    }

    const projectById = new Map<string, { _id: unknown; name: string; key: string }>();
    for (const p of projects) {
      projectById.set(String(p._id), { _id: p._id, name: p.name, key: p.key });
    }

    const userProjectMap = new Map<
      string,
      Array<{ _id: unknown; name: string; key: string; projectRole: string }>
    >();
    for (const m of memberships) {
      const proj = projectById.get(String(m.project));
      if (!proj) continue;
      const uid = String(m.user);
      const list = userProjectMap.get(uid) || [];
      list.push({ ...proj, projectRole: m.role });
      userProjectMap.set(uid, list);
    }

    const enriched = users.map((u) => {
      const uid = String(u._id);
      const stats = countMap.get(uid) || { totalAssigned: 0, openAssigned: 0 };

      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        title: u.title,
        avatar: u.avatar,
        avatarColor: u.avatarColor,
        status: u.status,
        createdAt: u.createdAt,
        assignedCount: stats.totalAssigned,
        openAssignedCount: stats.openAssigned,
        projects: userProjectMap.get(uid) || [],
      };
    });

    res.json({ users: enriched });
  } catch (err) {
    next(err);
  }
}

export async function inviteUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const { name, email, role, title, password, projectIds } = req.body;
    const nameError = validateFullName(name);
    if (nameError) throw new AppError(nameError, 400);

    const emailError = validateEmail(email);
    if (emailError) throw new AppError(emailError, 400);

    const requestedIds = Array.isArray(projectIds) ? projectIds : [];
    if (requestedIds.length === 0) {
      throw new AppError(
        'Direct team member creation requires selecting at least one project you manage.',
        400
      );
    }

    const managedProjects = [];
    for (const pid of requestedIds) {
      const access = await requireProjectAccess(req.user._id, pid, 'manageProject');
      if (role === 'Admin' && access.role !== 'Owner') {
        throw new AppError('Only a project owner can assign the Admin role.', 403);
      }
      managedProjects.push(access.project);
    }

    if (role === 'Owner') {
      throw new AppError('Project ownership cannot be assigned directly.', 400);
    }

    if (password) {
      const pwErr = validatePassword(password);
      if (pwErr) throw new AppError(pwErr, 400);
    }

    const normalizedEmail = normalizeEmail(email);
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw new AppError(
        'A user with this email already exists. Send them a project invitation link instead.',
        409
      );
    }

    const tempPassword =
      password || `Trk!${crypto.randomBytes(6).toString('hex')}9A`;

    const member = await User.create({
      name: normalizeFullName(name),
      email: normalizedEmail,
      password: tempPassword,
      role: role || 'Member',
      title: title ? String(title).trim() : 'Software Engineer',
      status: 'Invited',
    });

    const projectRole = normalizeProjectRole(role || 'Member');
    for (const proj of managedProjects) {
      await ProjectMembership.findOneAndUpdate(
        { project: proj._id, user: member._id },
        {
          $set: {
            role: projectRole,
            membershipStatus: 'Active',
            joinedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
      await Project.updateOne(
        { _id: proj._id },
        { $addToSet: { members: member._id } }
      );
      await Activity.create({
        user: req.user._id,
        project: proj._id,
        action: 'MEMBER_INVITED',
        description: `added ${member.name} (${projectRole}) to ${proj.name}`,
      });
    }

    res.status(201).json({
      user: {
        _id: member._id,
        name: member.name,
        email: member.email,
        role: member.role,
        title: member.title,
        avatar: member.avatar,
        avatarColor: member.avatarColor,
        status: member.status,
        createdAt: member.createdAt,
        assignedCount: 0,
        openAssignedCount: 0,
        projects: managedProjects.map((p) => ({
          _id: p._id,
          name: p.name,
          key: p.key,
          projectRole,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const targetId = assertValidObjectId(req.params.id, 'user');
    const isSelf = String(targetId) === String(req.user._id);
    if (!isSelf) {
      throw new AppError(
        'Use project member settings to manage roles within a specific project.',
        403
      );
    }

    const { name, title } = req.body;
    const user = await User.findById(targetId);
    if (!user) throw new AppError('Team member not found.', 404);

    if (name !== undefined) {
      const nameError = validateFullName(name);
      if (nameError) throw new AppError(nameError, 400);
      user.name = normalizeFullName(name);
    }
    if (title !== undefined) user.title = String(title).trim();

    await user.save();

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        title: user.title,
        avatar: user.avatar,
        avatarColor: user.avatarColor,
        status: user.status,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}
