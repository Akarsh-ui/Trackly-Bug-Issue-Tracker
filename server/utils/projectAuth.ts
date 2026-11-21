import mongoose, { type Types } from 'mongoose';
import { Project, type IProject } from '../models/Project.ts';
import {
  ProjectMembership,
  type ProjectRole,
} from '../models/ProjectMembership.ts';
import { AppError } from '../middleware/errorHandler.ts';

export type ProjectCapability =
  | 'read'
  | 'writeIssues'
  | 'comment'
  | 'manageProject'
  | 'deleteProject';

export function normalizeProjectRole(role: string | undefined | null): ProjectRole {
  switch (role) {
    case 'Owner':
      return 'Owner';
    case 'Admin':
    case 'Engineering Lead':
      return 'Admin';
    case 'Viewer':
      return 'Viewer';
    case 'Member':
    case 'Developer':
    case 'Designer':
    case 'QA Engineer':
    default:
      return 'Member';
  }
}

export function canReadProject(role: ProjectRole): boolean {
  return role === 'Owner' || role === 'Admin' || role === 'Member' || role === 'Viewer';
}

export function canWriteIssues(role: ProjectRole): boolean {
  return role === 'Owner' || role === 'Admin' || role === 'Member';
}

export function canComment(role: ProjectRole): boolean {
  return role === 'Owner' || role === 'Admin' || role === 'Member';
}

export function canManageProject(role: ProjectRole): boolean {
  return role === 'Owner' || role === 'Admin';
}

export function canDeleteProject(role: ProjectRole): boolean {
  return role === 'Owner';
}

export function canDeleteIssue(role: ProjectRole, isReporter: boolean): boolean {
  if (role === 'Owner' || role === 'Admin') return true;
  if (role === 'Member') return isReporter;
  return false;
}

export function assertValidObjectId(id: unknown, label = 'resource'): mongoose.Types.ObjectId {
  const str = String(id || '').trim();
  if (!mongoose.isValidObjectId(str)) {
    throw new AppError(`Invalid ${label} identifier.`, 400);
  }
  return new mongoose.Types.ObjectId(str);
}

/**
 * Safely backfills ProjectMembership records for legacy Project documents where
 * owner / lead / members already exist in MongoDB, without overriding explicit
 * Active or Removed ProjectMembership rows.
 */
export async function syncLegacyMembershipsForUser(
  userId: Types.ObjectId | string
): Promise<void> {
  const uid = new mongoose.Types.ObjectId(String(userId));
  const legacyProjects = await Project.find({
    $or: [{ owner: uid }, { lead: uid }, { members: uid }],
  })
    .select('_id owner lead members createdAt')
    .lean();

  if (legacyProjects.length === 0) return;

  const existing = await ProjectMembership.find({
    user: uid,
    project: { $in: legacyProjects.map((p) => p._id) },
  })
    .select('project')
    .lean();

  const existingProjectSet = new Set(existing.map((m) => String(m.project)));

  const ops = legacyProjects
    .filter((p) => !existingProjectSet.has(String(p._id)))
    .map((p) => {
      const role: ProjectRole =
        String(p.owner) === String(uid)
          ? 'Owner'
          : String(p.lead) === String(uid)
            ? 'Admin'
            : 'Member';
      return {
        updateOne: {
          filter: { project: p._id, user: uid },
          update: {
            $setOnInsert: {
              project: p._id,
              user: uid,
              role,
              membershipStatus: 'Active',
              joinedAt: p.createdAt || new Date(),
            },
          },
          upsert: true,
        },
      };
    });

  if (ops.length > 0) {
    await ProjectMembership.bulkWrite(ops, { ordered: false }).catch(() => {
      // Ignore duplicate key races under concurrent requests
    });
  }
}

export async function syncLegacyMembershipsForProject(
  project: Pick<IProject, '_id' | 'owner' | 'lead' | 'members' | 'createdAt'>
): Promise<void> {
  const candidateIds = new Set<string>();
  if (project.owner) candidateIds.add(String(project.owner));
  if (project.lead) candidateIds.add(String(project.lead));
  for (const m of project.members || []) {
    candidateIds.add(String((m as unknown as { _id?: unknown })._id || m));
  }
  if (candidateIds.size === 0) return;

  const existing = await ProjectMembership.find({
    project: project._id,
  })
    .select('user')
    .lean();
  const existingUsers = new Set(existing.map((e) => String(e.user)));

  const ownerId = String(
    (project.owner as unknown as { _id?: unknown })?._id || project.owner || ''
  );
  const leadId = String(
    (project.lead as unknown as { _id?: unknown })?._id || project.lead || ''
  );

  const ops = Array.from(candidateIds)
    .filter((uid) => mongoose.isValidObjectId(uid) && !existingUsers.has(uid))
    .map((uid) => {
      const role: ProjectRole =
        uid === ownerId ? 'Owner' : uid === leadId ? 'Admin' : 'Member';
      return {
        updateOne: {
          filter: {
            project: project._id,
            user: new mongoose.Types.ObjectId(uid),
          },
          update: {
            $setOnInsert: {
              project: project._id,
              user: new mongoose.Types.ObjectId(uid),
              role,
              membershipStatus: 'Active',
              joinedAt: project.createdAt || new Date(),
            },
          },
          upsert: true,
        },
      };
    });

  if (ops.length > 0) {
    await ProjectMembership.bulkWrite(ops, { ordered: false }).catch(() => {
      // Ignore duplicate key races
    });
  }
}

export async function getAccessibleProjectIds(userId: Types.ObjectId | string): Promise<{
  projectIds: Types.ObjectId[];
  roleByProjectId: Map<string, ProjectRole>;
}> {
  const uid = new mongoose.Types.ObjectId(String(userId));
  await syncLegacyMembershipsForUser(uid);

  const memberships = await ProjectMembership.find({
    user: uid,
    membershipStatus: 'Active',
  })
    .select('project role')
    .lean();

  const roleByProjectId = new Map<string, ProjectRole>();
  const projectIds: Types.ObjectId[] = [];
  for (const m of memberships) {
    roleByProjectId.set(String(m.project), m.role);
    projectIds.push(m.project as Types.ObjectId);
  }

  return { projectIds, roleByProjectId };
}

export async function requireProjectAccess(
  userId: Types.ObjectId | string,
  projectId: unknown,
  capability: ProjectCapability = 'read'
): Promise<{
  project: IProject;
  role: ProjectRole;
}> {
  const pid = assertValidObjectId(projectId, 'project');
  const project = await Project.findById(pid);
  if (!project) {
    throw new AppError('Project not found.', 404);
  }

  const uid = new mongoose.Types.ObjectId(String(userId));
  let membership = await ProjectMembership.findOne({
    project: project._id,
    user: uid,
  });

  if (!membership) {
    await syncLegacyMembershipsForProject(project);
    membership = await ProjectMembership.findOne({
      project: project._id,
      user: uid,
    });
  }

  if (!membership || membership.membershipStatus !== 'Active') {
    throw new AppError('You do not have access to this project.', 403);
  }

  const role = membership.role;
  const allowed =
    capability === 'read'
      ? canReadProject(role)
      : capability === 'writeIssues'
        ? canWriteIssues(role)
        : capability === 'comment'
          ? canComment(role)
          : capability === 'manageProject'
            ? canManageProject(role)
            : canDeleteProject(role);

  if (!allowed) {
    const msg =
      role === 'Viewer'
        ? 'Viewers have read-only access to this project.'
        : capability === 'deleteProject'
          ? 'Only the project owner can delete this project.'
          : 'You do not have permission to perform this action in this project.';
    throw new AppError(msg, 403);
  }

  return { project, role };
}

export async function isActiveProjectMember(
  userId: Types.ObjectId | string,
  projectId: Types.ObjectId | string
): Promise<boolean> {
  if (!mongoose.isValidObjectId(String(userId)) || !mongoose.isValidObjectId(String(projectId))) {
    return false;
  }
  const membership = await ProjectMembership.findOne({
    project: new mongoose.Types.ObjectId(String(projectId)),
    user: new mongoose.Types.ObjectId(String(userId)),
    membershipStatus: 'Active',
  })
    .select('_id')
    .lean();
  if (membership) return true;

  const project = await Project.findById(projectId)
    .select('_id owner lead members createdAt')
    .lean();
  if (!project) return false;

  await syncLegacyMembershipsForProject(project);
  const synced = await ProjectMembership.findOne({
    project: project._id,
    user: new mongoose.Types.ObjectId(String(userId)),
    membershipStatus: 'Active',
  })
    .select('_id')
    .lean();
  return Boolean(synced);
}

export async function getCollaboratorUserIds(
  userId: Types.ObjectId | string
): Promise<Types.ObjectId[]> {
  const uid = new mongoose.Types.ObjectId(String(userId));
  const { projectIds } = await getAccessibleProjectIds(uid);

  const uniqueIds = new Map<string, Types.ObjectId>();
  uniqueIds.set(String(uid), uid);

  if (projectIds.length > 0) {
    const memberships = await ProjectMembership.find({
      project: { $in: projectIds },
      membershipStatus: 'Active',
    })
      .select('user')
      .lean();
    for (const m of memberships) {
      uniqueIds.set(String(m.user), m.user as Types.ObjectId);
    }
  }

  return Array.from(uniqueIds.values());
}
