import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Project } from '../models/Project.ts';
import { ProjectMembership, type ProjectRole } from '../models/ProjectMembership.ts';
import { Issue } from '../models/Issue.ts';
import { Comment } from '../models/Comment.ts';
import { Activity } from '../models/Activity.ts';
import { Invitation } from '../models/Invitation.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';
import {
  assertValidObjectId,
  getAccessibleProjectIds,
  getCollaboratorUserIds,
  requireProjectAccess,
  syncLegacyMembershipsForProject,
} from '../utils/projectAuth.ts';

async function attachMembershipsToProjects<
  T extends { _id?: unknown; members?: unknown },
>(projects: T[], currentUserId: string) {
  if (projects.length === 0) {
    return [] as Array<
      T & {
        memberships: Array<{
          _id: unknown;
          user: Record<string, unknown>;
          role: ProjectRole;
          membershipStatus: string;
          joinedAt: Date;
        }>;
        myProjectRole: ProjectRole | null;
      }
    >;
  }
  const projectIds = projects.map((p) => p._id as mongoose.Types.ObjectId);

  const memberships = await ProjectMembership.find({
    project: { $in: projectIds },
    membershipStatus: 'Active',
  })
    .populate('user', 'name email avatar avatarColor role title status')
    .sort({ joinedAt: 1 })
    .lean<
      Array<{
        _id: unknown;
        project: unknown;
        user: Record<string, unknown> | null;
        role: ProjectRole;
        membershipStatus: string;
        joinedAt: Date;
      }>
    >();

  const byProject = new Map<
    string,
    Array<{
      _id: unknown;
      user: Record<string, unknown>;
      role: ProjectRole;
      membershipStatus: string;
      joinedAt: Date;
    }>
  >();

  for (const m of memberships) {
    if (!m.user) continue;
    const pid = String(m.project);
    const list = byProject.get(pid) || [];
    list.push({
      _id: m._id,
      user: m.user,
      role: m.role,
      membershipStatus: m.membershipStatus,
      joinedAt: m.joinedAt,
    });
    byProject.set(pid, list);
  }

  return projects.map((project) => {
    const pid = String(project._id);
    const projMemberships = byProject.get(pid) || [];
    const activeUsers = projMemberships.map((m) => m.user);
    const myMembership = projMemberships.find(
      (m) => String((m.user as { _id?: unknown })._id) === currentUserId
    );
    return {
      ...project,
      members: activeUsers.length > 0 ? activeUsers : project.members,
      memberships: projMemberships,
      myProjectRole: myMembership?.role || null,
    };
  });
}

export async function getProjects(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const { projectIds } = await getAccessibleProjectIds(req.user._id);
    if (projectIds.length === 0) {
      res.json({ projects: [] });
      return;
    }

    const [projects, issueStats] = await Promise.all([
      Project.find({ _id: { $in: projectIds } })
        .populate('owner', 'name email avatar avatarColor role')
        .populate('lead', 'name email avatar avatarColor role')
        .populate('members', 'name email avatar avatarColor role title status')
        .sort({ createdAt: -1 })
        .lean(),
      Issue.aggregate([
        { $match: { project: { $in: projectIds } } },
        {
          $group: {
            _id: '$project',
            total: { $sum: 1 },
            todo: { $sum: { $cond: [{ $eq: ['$status', 'To Do'] }, 1, 0] } },
            inProgress: {
              $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] },
            },
            done: { $sum: { $cond: [{ $eq: ['$status', 'Done'] }, 1, 0] } },
          },
        },
      ]),
    ]);

    for (const p of projects) {
      await syncLegacyMembershipsForProject(p);
    }

    const statsMap = new Map<
      string,
      { total: number; todo: number; inProgress: number; done: number }
    >();
    for (const s of issueStats) {
      statsMap.set(String(s._id), {
        total: s.total,
        todo: s.todo,
        inProgress: s.inProgress,
        done: s.done,
      });
    }

    const withMemberships = await attachMembershipsToProjects(
      projects as unknown as Array<Record<string, unknown>>,
      String(req.user._id)
    );

    const enriched = withMemberships.map((project) => {
      const counts = statsMap.get(String(project._id)) || {
        total: 0,
        todo: 0,
        inProgress: 0,
        done: 0,
      };
      const progress =
        counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

      return {
        ...project,
        stats: {
          ...counts,
          open: counts.todo + counts.inProgress,
          progress,
        },
      };
    });

    res.json({ projects: enriched });
  } catch (err) {
    next(err);
  }
}

export async function getProjectById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const { project } = await requireProjectAccess(req.user._id, req.params.id, 'read');

    const [populated, issueStats] = await Promise.all([
      Project.findById(project._id)
        .populate('owner', 'name email avatar avatarColor role')
        .populate('lead', 'name email avatar avatarColor role')
        .populate('members', 'name email avatar avatarColor role title status')
        .lean(),
      Issue.aggregate([
        { $match: { project: project._id } },
        {
          $group: {
            _id: '$project',
            total: { $sum: 1 },
            todo: { $sum: { $cond: [{ $eq: ['$status', 'To Do'] }, 1, 0] } },
            inProgress: {
              $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] },
            },
            done: { $sum: { $cond: [{ $eq: ['$status', 'Done'] }, 1, 0] } },
          },
        },
      ]),
    ]);

    if (!populated) {
      throw new AppError('Project not found.', 404);
    }

    const [withMemberships] = await attachMembershipsToProjects(
      [populated as unknown as Record<string, unknown>],
      String(req.user._id)
    );

    const counts = issueStats[0] || { total: 0, todo: 0, inProgress: 0, done: 0 };
    const progress =
      counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

    res.json({
      project: {
        ...withMemberships,
        stats: {
          total: counts.total,
          todo: counts.todo,
          inProgress: counts.inProgress,
          done: counts.done,
          open: counts.todo + counts.inProgress,
          progress,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createProject(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const { name, key, description, lead, members } = req.body;
    if (!name || !String(name).trim() || !key) {
      throw new AppError('Project name and project key are required.', 400);
    }

    const normalizedKey = String(key).toUpperCase().trim();
    if (!/^[A-Z0-9]{2,10}$/.test(normalizedKey)) {
      throw new AppError(
        'Project key must be 2–10 uppercase letters or numbers (e.g. WEB, API).',
        400
      );
    }

    const existing = await Project.findOne({ key: normalizedKey });
    if (existing) {
      throw new AppError(`Project key "${normalizedKey}" is already in use.`, 409);
    }

    // Only allow adding existing collaborators (users who already share a project with req.user)
    // to prevent probing/attaching unrelated accounts across tenants.
    const allowedCollaborators = new Set(
      (await getCollaboratorUserIds(req.user._id)).map(String)
    );

    const leadIdStr =
      lead && mongoose.isValidObjectId(String(lead)) && allowedCollaborators.has(String(lead))
        ? String(lead)
        : String(req.user._id);

    const memberSet = new Set<string>([String(req.user._id), leadIdStr]);
    if (Array.isArray(members)) {
      for (const rawMid of members) {
        const mid = String(rawMid || '');
        if (mongoose.isValidObjectId(mid) && allowedCollaborators.has(mid)) {
          memberSet.add(mid);
        }
      }
    }

    const project = await Project.create({
      name: String(name).trim(),
      key: normalizedKey,
      description: description ? String(description).trim() : '',
      owner: req.user._id,
      lead: new mongoose.Types.ObjectId(leadIdStr),
      members: Array.from(memberSet).map((id) => new mongoose.Types.ObjectId(id)),
    });

    const membershipDocs = Array.from(memberSet).map((uid) => ({
      project: project._id,
      user: new mongoose.Types.ObjectId(uid),
      role:
        uid === String(req.user!._id)
          ? ('Owner' as ProjectRole)
          : uid === leadIdStr
            ? ('Admin' as ProjectRole)
            : ('Member' as ProjectRole),
      membershipStatus: 'Active' as const,
      joinedAt: new Date(),
    }));
    await ProjectMembership.insertMany(membershipDocs);

    await Activity.create({
      user: req.user._id,
      project: project._id,
      action: 'PROJECT_CREATED',
      description: `created project ${project.name} (${project.key})`,
    });

    const populated = await Project.findById(project._id)
      .populate('owner', 'name email avatar avatarColor role')
      .populate('lead', 'name email avatar avatarColor role')
      .populate('members', 'name email avatar avatarColor role title status')
      .lean();

    const [withMemberships] = await attachMembershipsToProjects(
      [populated as unknown as Record<string, unknown>],
      String(req.user._id)
    );

    res.status(201).json({
      project: {
        ...withMemberships,
        stats: { total: 0, todo: 0, inProgress: 0, done: 0, open: 0, progress: 0 },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProject(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const { project } = await requireProjectAccess(
      req.user._id,
      req.params.id,
      'manageProject'
    );
    const { name, key, description, lead, members, status } = req.body;

    if (name !== undefined) {
      if (!String(name).trim()) {
        throw new AppError('Project name cannot be empty.', 400);
      }
      project.name = String(name).trim();
    }
    if (description !== undefined) project.description = String(description).trim();
    if (status !== undefined) {
      if (!['Active', 'Archived'].includes(String(status))) {
        throw new AppError('Invalid project status.', 400);
      }
      project.status = status;
    }

    if (key !== undefined) {
      const normalizedKey = String(key).toUpperCase().trim();
      if (!/^[A-Z0-9]{2,10}$/.test(normalizedKey)) {
        throw new AppError(
          'Project key must be 2–10 uppercase letters or numbers (e.g. WEB, API).',
          400
        );
      }
      if (normalizedKey !== project.key) {
        const collision = await Project.findOne({ key: normalizedKey });
        if (collision) {
          throw new AppError(`Project key "${normalizedKey}" is already taken.`, 409);
        }
        project.key = normalizedKey;
      }
    }

    const activeMemberships = await ProjectMembership.find({
      project: project._id,
      membershipStatus: 'Active',
    }).lean();
    const existingMemberSet = new Set(activeMemberships.map((m) => String(m.user)));
    const allowedCollaborators = new Set(
      (await getCollaboratorUserIds(req.user._id)).map(String)
    );

    if (lead !== undefined) {
      const leadStr = String(lead);
      if (!mongoose.isValidObjectId(leadStr)) {
        throw new AppError('Invalid project lead identifier.', 400);
      }
      if (!existingMemberSet.has(leadStr) && !allowedCollaborators.has(leadStr)) {
        throw new AppError('Project lead must be an active member or collaborator.', 400);
      }
      project.lead = new mongoose.Types.ObjectId(leadStr);
    }

    if (Array.isArray(members)) {
      const nextMemberIds = new Set<string>([
        String(project.owner),
        String(project.lead),
      ]);
      for (const rawMid of members) {
        const mid = String(rawMid || '');
        if (
          mongoose.isValidObjectId(mid) &&
          (existingMemberIdsHas(existingMemberSet, mid) || allowedCollaborators.has(mid))
        ) {
          nextMemberIds.add(mid);
        }
      }

      // Sync removals & additions in ProjectMembership (never remove Owner)
      const toRemove = activeMemberships.filter(
        (m) => m.role !== 'Owner' && !nextMemberIds.has(String(m.user))
      );
      if (toRemove.length > 0) {
        await ProjectMembership.updateMany(
          { _id: { $in: toRemove.map((r) => r._id) } },
          { $set: { membershipStatus: 'Removed' } }
        );
      }

      for (const mid of nextMemberIds) {
        if (!existingMemberSet.has(mid)) {
          await ProjectMembership.findOneAndUpdate(
            { project: project._id, user: new mongoose.Types.ObjectId(mid) },
            {
              $set: {
                membershipStatus: 'Active',
                role: mid === String(project.owner) ? 'Owner' : 'Member',
                joinedAt: new Date(),
              },
            },
            { upsert: true }
          );
        }
      }

      project.members = Array.from(nextMemberIds).map(
        (uid) => new mongoose.Types.ObjectId(uid)
      ) as unknown as typeof project.members;
    } else if (lead !== undefined) {
      const leadStr = String(project.lead);
      if (!existingMemberSet.has(leadStr)) {
        await ProjectMembership.findOneAndUpdate(
          { project: project._id, user: project.lead },
          {
            $set: {
              membershipStatus: 'Active',
              role: leadStr === String(project.owner) ? 'Owner' : 'Admin',
              joinedAt: new Date(),
            },
          },
          { upsert: true }
        );
      }
      const memberSet = new Set<string>([
        ...project.members.map(String),
        leadStr,
      ]);
      project.members = Array.from(memberSet).map(
        (uid) => new mongoose.Types.ObjectId(uid)
      ) as unknown as typeof project.members;
    }

    await project.save();

    await Activity.create({
      user: req.user._id,
      project: project._id,
      action: 'PROJECT_UPDATED',
      description: `updated project settings for ${project.name} (${project.key})`,
    });

    const populated = await Project.findById(project._id)
      .populate('owner', 'name email avatar avatarColor role')
      .populate('lead', 'name email avatar avatarColor role')
      .populate('members', 'name email avatar avatarColor role title status')
      .lean();

    const [withMemberships] = await attachMembershipsToProjects(
      [populated as unknown as Record<string, unknown>],
      String(req.user._id)
    );

    res.json({ project: withMemberships });
  } catch (err) {
    next(err);
  }
}

function existingMemberIdsHas(set: Set<string>, id: string): boolean {
  return set.has(id);
}

export async function updateProjectMemberRole(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const { project, role: callerRole } = await requireProjectAccess(
      req.user._id,
      req.params.id,
      'manageProject'
    );
    const memberUserId = assertValidObjectId(req.params.memberId, 'member');
    const nextRole = String(req.body?.role || '') as ProjectRole;

    if (!['Admin', 'Member', 'Viewer'].includes(nextRole)) {
      throw new AppError('Project role must be Admin, Member, or Viewer.', 400);
    }
    if (nextRole === 'Admin' && callerRole !== 'Owner') {
      throw new AppError('Only the project owner can promote members to Admin.', 403);
    }

    const targetMembership = await ProjectMembership.findOne({
      project: project._id,
      user: memberUserId,
      membershipStatus: 'Active',
    }).populate('user', 'name email');

    if (!targetMembership) {
      throw new AppError('Project member not found.', 404);
    }
    if (targetMembership.role === 'Owner') {
      throw new AppError('The project owner role cannot be modified here.', 400);
    }
    if (targetMembership.role === 'Admin' && callerRole !== 'Owner') {
      throw new AppError('Only the project owner can change an Admin role.', 403);
    }

    targetMembership.role = nextRole;
    await targetMembership.save();

    const targetUser = targetMembership.user as unknown as { name?: string };
    await Activity.create({
      user: req.user._id,
      project: project._id,
      action: 'MEMBER_ROLE_UPDATED',
      description: `changed ${targetUser?.name || 'member'}'s project role to ${nextRole}`,
    });

    res.json({ membership: targetMembership });
  } catch (err) {
    next(err);
  }
}

export async function removeProjectMember(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const { project, role: callerRole } = await requireProjectAccess(
      req.user._id,
      req.params.id,
      'manageProject'
    );
    const memberUserId = assertValidObjectId(req.params.memberId, 'member');

    const targetMembership = await ProjectMembership.findOne({
      project: project._id,
      user: memberUserId,
      membershipStatus: 'Active',
    }).populate('user', 'name email');

    if (!targetMembership) {
      throw new AppError('Project member not found.', 404);
    }
    if (targetMembership.role === 'Owner') {
      throw new AppError('The project owner cannot be removed from the project.', 400);
    }
    if (targetMembership.role === 'Admin' && callerRole !== 'Owner') {
      throw new AppError('Only the project owner can remove a project Admin.', 403);
    }

    targetMembership.membershipStatus = 'Removed';
    await targetMembership.save();

    await Project.findByIdAndUpdate(project._id, {
      $pull: { members: memberUserId },
    });

    const targetUser = targetMembership.user as unknown as { name?: string };
    await Activity.create({
      user: req.user._id,
      project: project._id,
      action: 'MEMBER_REMOVED',
      description: `removed ${targetUser?.name || 'member'} from ${project.key}`,
    });

    res.json({ message: 'Member removed from project.' });
  } catch (err) {
    next(err);
  }
}

export async function deleteProject(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const { project } = await requireProjectAccess(
      req.user._id,
      req.params.id,
      'deleteProject'
    );

    const projectIssues = await Issue.find({ project: project._id }).select('_id').lean();
    const issueIds = projectIssues.map((i) => i._id);

    await Promise.all([
      Comment.deleteMany({ issue: { $in: issueIds } }),
      Issue.deleteMany({ project: project._id }),
      Activity.deleteMany({ project: project._id }),
      Invitation.deleteMany({ project: project._id }),
      ProjectMembership.deleteMany({ project: project._id }),
      Project.findByIdAndDelete(project._id),
    ]);

    res.json({ message: `Project ${project.name} deleted.` });
  } catch (err) {
    next(err);
  }
}
