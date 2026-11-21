import {
  ISSUE_TYPES,
  type Activity,
  type ActivityAction,
  type Attachment,
  type BugDetails,
  type Comment,
  type DashboardData,
  type FeatureDetails,
  type Invitation,
  type InvitationCreateResult,
  type InvitationStatus,
  type InvitationValidation,
  type Issue,
  type IssuePriority,
  type IssueStatus,
  type IssueType,
  type Project,
  type ProjectMembershipItem,
  type ProjectRole,
  type ProjectStats,
  type User,
  type UserRole,
  type UserStatus,
  type Workspace,
} from '../types';
import {
  normalizeEmail,
  normalizeFullName,
  validateEmail,
  validateFullName,
  validateOptionalDueDate,
  validatePassword,
} from '../utils/authValidation';

const STORE_KEY = 'trackly_store_v1';
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LOCAL_ATTACHMENT_BYTES = 1.5 * 1024 * 1024;
const AVATAR_COLORS = [
  '#C56A45',
  '#557A59',
  '#75553C',
  '#C47D2B',
  '#605E59',
  '#3F5F43',
  '#9A5E19',
];

interface StoredUser extends User {
  passwordHash: string;
}

interface StoredProjectMembership {
  _id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  membershipStatus: 'Active' | 'Removed';
  joinedAt: string;
}

interface StoredProject {
  _id: string;
  name: string;
  key: string;
  description: string;
  ownerId: string;
  leadId: string;
  memberIds: string[];
  issueCounter: number;
  status: 'Active' | 'Archived';
  createdAt: string;
  updatedAt: string;
}

interface StoredIssue {
  _id: string;
  issueKey: string;
  title: string;
  description: string;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  position: number;
  assigneeId: string | null;
  reporterId: string;
  projectId: string;
  dueDate: string | null;
  labels?: string[];
  bugDetails?: BugDetails;
  featureDetails?: FeatureDetails;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

interface StoredComment {
  _id: string;
  issueId: string;
  userId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredActivity {
  _id: string;
  userId: string;
  projectId: string | null;
  issueId: string | null;
  issueKey: string | null;
  action: ActivityAction;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface StoredInvitation {
  _id: string;
  email: string;
  role: UserRole;
  projectId: string | null;
  workspaceName: string;
  message: string;
  tokenHash: string;
  status: InvitationStatus;
  invitedById: string;
  expiresAt: string;
  acceptedAt?: string | null;
  acceptedById?: string | null;
  rejectedAt?: string | null;
  rejectedById?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

interface LocalStoreData {
  workspace: Workspace;
  users: StoredUser[];
  projects: StoredProject[];
  projectMemberships: StoredProjectMembership[];
  issues: StoredIssue[];
  comments: StoredComment[];
  activities: StoredActivity[];
  invitations: StoredInvitation[];
}

type HttpError = Error & { status?: number };

function httpError(message: string, status: number): HttpError {
  const err = new Error(message) as HttpError;
  err.status = status;
  return err;
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function hashPassword(password: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(`trackly_local:${password}`);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let hash = 2166136261;
  for (let i = 0; i < password.length; i += 1) {
    hash ^= password.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv_${(hash >>> 0).toString(16)}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_LOCAL_ATTACHMENT_BYTES) {
      reject(
        new Error('Attachments in temporary local mode must be 1.5 MB or smaller.')
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read attachment file.'));
    reader.readAsDataURL(file);
  });
}

function generateRawToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}${Math.random()
    .toString(16)
    .slice(2)}`;
}

function normalizeRawInviteToken(rawToken: string): string {
  const trimmed = String(rawToken || '').trim();
  if (!trimmed) return '';
  try {
    return decodeURIComponent(trimmed).trim();
  } catch {
    return trimmed;
  }
}

async function hashInvitationToken(rawToken: string): Promise<string> {
  return hashPassword(`invite:${normalizeRawInviteToken(rawToken)}`);
}

function normalizeProjectRole(role: string | undefined | null): ProjectRole {
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

function canWriteIssues(role: ProjectRole): boolean {
  return role === 'Owner' || role === 'Admin' || role === 'Member';
}

function canManageProject(role: ProjectRole): boolean {
  return role === 'Owner' || role === 'Admin';
}

function canUseLocalInviteBridge(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof fetch !== 'undefined' &&
    /^https?:/i.test(window.location?.protocol || '')
  );
}

async function bridgeMirrorInvitation(
  rawToken: string,
  invitation: Invitation
): Promise<void> {
  if (!canUseLocalInviteBridge()) return;
  try {
    await fetch('/api/local-invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawToken, invitation }),
    });
  } catch {
    // Ignore when running purely offline/static
  }
}

async function bridgeUpdateInviteStatus(params: {
  rawToken?: string;
  invitationId?: string;
  status: 'Accepted' | 'Rejected' | 'Revoked' | 'Expired';
}): Promise<void> {
  if (!canUseLocalInviteBridge()) return;
  try {
    await fetch('/api/local-invites/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch {
    // Ignore when running purely offline/static
  }
}

async function bridgeValidateInvite(rawToken: string): Promise<InvitationValidation | null> {
  if (!canUseLocalInviteBridge()) return null;
  try {
    const res = await fetch(
      `/api/local-invites/validate/${encodeURIComponent(rawToken)}`
    );
    if (!res.ok) return null;
    return (await res.json()) as InvitationValidation;
  } catch {
    return null;
  }
}

function createEmptyStore(): LocalStoreData {
  return {
    workspace: {
      _id: 'ws_default',
      name: 'Trackly Workspace',
      slug: 'trackly-workspace',
      description: 'Engineering issue tracking and release workspace.',
      defaultIssuePriority: 'Medium',
    },
    users: [],
    projects: [],
    projectMemberships: [],
    issues: [],
    comments: [],
    activities: [],
    invitations: [],
  };
}

function backfillStoreMemberships(data: LocalStoreData): void {
  const existingKeys = new Set(
    data.projectMemberships.map((m) => `${m.projectId}:${m.userId}`)
  );
  for (const proj of data.projects) {
    const candidateIds = new Set<string>([
      proj.ownerId,
      proj.leadId,
      ...(proj.memberIds || []),
    ]);
    for (const uid of candidateIds) {
      if (!uid) continue;
      const key = `${proj._id}:${uid}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      const role: ProjectRole =
        uid === proj.ownerId ? 'Owner' : uid === proj.leadId ? 'Admin' : 'Member';
      data.projectMemberships.push({
        _id: createId('pmem'),
        projectId: proj._id,
        userId: uid,
        role,
        membershipStatus: 'Active',
        joinedAt: proj.createdAt || new Date().toISOString(),
      });
    }
  }
}

function loadStore(): LocalStoreData {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return createEmptyStore();
    const parsed = JSON.parse(raw) as Partial<LocalStoreData>;
    const empty = createEmptyStore();
    const data: LocalStoreData = {
      workspace: parsed.workspace || empty.workspace,
      users: Array.isArray(parsed.users) ? parsed.users : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      projectMemberships: Array.isArray(parsed.projectMemberships)
        ? parsed.projectMemberships
        : [],
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      comments: Array.isArray(parsed.comments) ? parsed.comments : [],
      activities: Array.isArray(parsed.activities) ? parsed.activities : [],
      invitations: Array.isArray(parsed.invitations) ? parsed.invitations : [],
    };
    backfillStoreMemberships(data);
    return data;
  } catch {
    return createEmptyStore();
  }
}

function saveStore(data: LocalStoreData): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch {
    throw new Error(
      'Local browser storage quota exceeded. Try removing large attachments.'
    );
  }
}

function sanitizeUser(u: StoredUser): User {
  const { passwordHash: _ignored, ...rest } = u;
  return rest;
}

function getUserById(store: LocalStoreData, userId: string | null | undefined): User | null {
  if (!userId) return null;
  const found = store.users.find((u) => u._id === userId);
  return found ? sanitizeUser(found) : null;
}

function fallbackUser(store: LocalStoreData): User {
  if (store.users.length > 0) {
    return sanitizeUser(store.users[0]);
  }
  return {
    _id: 'deleted_user',
    name: 'Former Member',
    email: '',
    role: 'Member',
    status: 'Inactive',
    avatarColor: '#8C8983',
    createdAt: new Date().toISOString(),
  };
}

function getProjectMembership(
  store: LocalStoreData,
  projectId: string,
  userId: string
): StoredProjectMembership | undefined {
  return store.projectMemberships.find(
    (m) =>
      m.projectId === projectId &&
      m.userId === userId &&
      m.membershipStatus === 'Active'
  );
}

function getUserProjectRole(
  store: LocalStoreData,
  projectId: string,
  userId: string
): ProjectRole | null {
  const mem = getProjectMembership(store, projectId, userId);
  return mem ? mem.role : null;
}

function getAccessibleProjectIds(store: LocalStoreData, userId: string): Set<string> {
  const ids = new Set<string>();
  for (const m of store.projectMemberships) {
    if (m.userId === userId && m.membershipStatus === 'Active') {
      ids.add(m.projectId);
    }
  }
  return ids;
}

function requireProjectAccess(
  store: LocalStoreData,
  userId: string,
  projectId: string,
  capability: 'read' | 'writeIssues' | 'comment' | 'manageProject' | 'deleteProject' = 'read'
): { project: StoredProject; role: ProjectRole } {
  const project = store.projects.find((p) => p._id === projectId);
  if (!project) {
    throw httpError('Project not found.', 404);
  }
  const role = getUserProjectRole(store, projectId, userId);
  if (!role) {
    throw httpError('You do not have access to this project.', 403);
  }
  const allowed =
    capability === 'read'
      ? true
      : capability === 'writeIssues' || capability === 'comment'
        ? canWriteIssues(role)
        : capability === 'manageProject'
          ? canManageProject(role)
          : role === 'Owner';

  if (!allowed) {
    const msg =
      role === 'Viewer'
        ? 'Viewers have read-only access to this project.'
        : capability === 'deleteProject'
          ? 'Only the project owner can delete this project.'
          : 'You do not have permission to perform this action in this project.';
    throw httpError(msg, 403);
  }

  return { project, role };
}

function computeProjectStats(issues: StoredIssue[], projectId: string): ProjectStats {
  const projIssues = issues.filter((i) => i.projectId === projectId);
  const total = projIssues.length;
  const todo = projIssues.filter((i) => i.status === 'To Do').length;
  const inProgress = projIssues.filter((i) => i.status === 'In Progress').length;
  const done = projIssues.filter((i) => i.status === 'Done').length;
  const open = todo + inProgress;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, todo, inProgress, done, open, progress };
}

function hydrateProject(
  store: LocalStoreData,
  p: StoredProject,
  viewerUserId?: string
): Project {
  const owner = getUserById(store, p.ownerId) || fallbackUser(store);
  const lead = getUserById(store, p.leadId) || owner;

  const activeRows = store.projectMemberships.filter(
    (m) => m.projectId === p._id && m.membershipStatus === 'Active'
  );
  const memberships: ProjectMembershipItem[] = activeRows
    .map((m): ProjectMembershipItem | null => {
      const user = getUserById(store, m.userId);
      if (!user) return null;
      return {
        _id: m._id,
        user,
        role: m.role,
        membershipStatus: m.membershipStatus,
        joinedAt: m.joinedAt,
      };
    })
    .filter((item): item is ProjectMembershipItem => item !== null);

  const members = memberships.map((m) => m.user);
  const myProjectRole = viewerUserId
    ? getUserProjectRole(store, p._id, viewerUserId)
    : null;

  return {
    _id: p._id,
    name: p.name,
    key: p.key,
    description: p.description,
    owner,
    lead,
    members,
    memberships,
    myProjectRole,
    issueCounter: p.issueCounter,
    status: p.status,
    stats: computeProjectStats(store.issues, p._id),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function hydrateIssue(store: LocalStoreData, issue: StoredIssue): Issue {
  const proj = store.projects.find((p) => p._id === issue.projectId);
  const assignee = getUserById(store, issue.assigneeId);
  const reporter = getUserById(store, issue.reporterId) || fallbackUser(store);
  const commentCount = store.comments.filter((c) => c.issueId === issue._id).length;

  return {
    _id: issue._id,
    issueKey: issue.issueKey,
    title: issue.title,
    description: issue.description,
    type: issue.type,
    priority: issue.priority,
    status: issue.status,
    position: issue.position,
    assignee,
    reporter,
    project: proj
      ? { _id: proj._id, name: proj.name, key: proj.key }
      : { _id: issue.projectId, name: 'Deleted Project', key: 'DEL' },
    dueDate: issue.dueDate,
    labels: Array.isArray(issue.labels) ? issue.labels : [],
    bugDetails: issue.bugDetails,
    featureDetails: issue.featureDetails,
    attachments: issue.attachments || [],
    commentCount,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

function hydrateComment(store: LocalStoreData, comment: StoredComment): Comment {
  return {
    _id: comment._id,
    issue: comment.issueId,
    user: getUserById(store, comment.userId) || fallbackUser(store),
    text: comment.text,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

function hydrateActivity(store: LocalStoreData, act: StoredActivity): Activity {
  const proj = act.projectId
    ? store.projects.find((p) => p._id === act.projectId)
    : null;
  const iss = act.issueId
    ? store.issues.find((i) => i._id === act.issueId)
    : null;

  return {
    _id: act._id,
    user: getUserById(store, act.userId) || fallbackUser(store),
    project: proj ? { _id: proj._id, name: proj.name, key: proj.key } : null,
    issue: iss
      ? {
          _id: iss._id,
          issueKey: iss.issueKey,
          title: iss.title,
          status: iss.status,
        }
      : null,
    issueKey: act.issueKey,
    action: act.action,
    description: act.description,
    metadata: act.metadata,
    createdAt: act.createdAt,
  };
}

function hydrateInvitation(
  store: LocalStoreData,
  inv: StoredInvitation
): Invitation {
  const proj = inv.projectId
    ? store.projects.find((p) => p._id === inv.projectId)
    : null;
  const inviter = getUserById(store, inv.invitedById) || fallbackUser(store);

  return {
    _id: inv._id,
    email: inv.email,
    role: inv.role,
    project: proj
      ? {
          _id: proj._id,
          name: proj.name,
          key: proj.key,
          description: proj.description,
        }
      : null,
    workspaceName: inv.workspaceName,
    message: inv.message,
    status: inv.status,
    invitedBy: {
      _id: inviter._id,
      name: inviter.name,
      email: inviter.email,
      avatarColor: inviter.avatarColor,
    },
    expiresAt: inv.expiresAt,
    acceptedAt: inv.acceptedAt ?? null,
    rejectedAt: inv.rejectedAt ?? null,
    revokedAt: inv.revokedAt ?? null,
    createdAt: inv.createdAt,
  };
}

function expireStaleInvitations(store: LocalStoreData): boolean {
  const nowMs = Date.now();
  let changed = false;
  for (const inv of store.invitations) {
    if (inv.status === 'Pending' && new Date(inv.expiresAt).getTime() <= nowMs) {
      inv.status = 'Expired';
      changed = true;
    }
  }
  return changed;
}

function isIssueOverdue(issue: StoredIssue): boolean {
  if (!issue.dueDate || issue.status === 'Done') return false;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const due = new Date(issue.dueDate);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < startOfToday.getTime();
}

function pushActivity(
  store: LocalStoreData,
  entry: Omit<StoredActivity, '_id' | 'createdAt'>
): void {
  store.activities.unshift({
    _id: createId('act'),
    ...entry,
    createdAt: new Date().toISOString(),
  });
}

function requireSessionUser(store: LocalStoreData, token: string | null): StoredUser {
  if (!token || !token.startsWith('local_session:')) {
    throw httpError('Authentication required.', 401);
  }
  const userId = token.slice('local_session:'.length);
  const found = store.users.find((u) => u._id === userId);
  if (!found) {
    throw httpError('Session expired. Please sign in again.', 401);
  }
  if (found.status === 'Inactive') {
    throw httpError('Your account is inactive.', 401);
  }
  return found;
}

const PRIORITY_WEIGHT: Record<IssuePriority, number> = {
  Urgent: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

function upsertLocalMembership(
  store: LocalStoreData,
  project: StoredProject,
  userId: string,
  role: ProjectRole
): void {
  const existing = store.projectMemberships.find(
    (m) => m.projectId === project._id && m.userId === userId
  );
  if (existing) {
    existing.role = role;
    existing.membershipStatus = 'Active';
    existing.joinedAt = new Date().toISOString();
  } else {
    store.projectMemberships.push({
      _id: createId('pmem'),
      projectId: project._id,
      userId,
      role,
      membershipStatus: 'Active',
      joinedAt: new Date().toISOString(),
    });
  }
  if (!project.memberIds.includes(userId)) {
    project.memberIds.push(userId);
  }
}

export const localStore = {
  auth: {
    async register(payload: {
      name: string;
      email: string;
      password: string;
      confirmPassword: string;
      inviteToken?: string;
    }): Promise<{ token: string; user: User; pendingInvitationId?: string | null }> {
      const store = loadStore();

      const nameErr = validateFullName(payload.name);
      if (nameErr) throw httpError(nameErr, 400);

      const emailErr = validateEmail(payload.email);
      if (emailErr) throw httpError(emailErr, 400);

      const passwordErr = validatePassword(payload.password);
      if (passwordErr) throw httpError(passwordErr, 400);

      if (payload.password !== payload.confirmPassword) {
        throw httpError('Passwords do not match.', 400);
      }

      const name = normalizeFullName(payload.name);
      const email = normalizeEmail(payload.email);

      let matchedInvite: StoredInvitation | undefined;
      if (payload.inviteToken) {
        if (expireStaleInvitations(store)) {
          saveStore(store);
        }
        const tokenHash = await hashInvitationToken(payload.inviteToken.trim());
        matchedInvite = store.invitations.find((inv) => inv.tokenHash === tokenHash);
        if (!matchedInvite) {
          throw httpError('Invalid invitation link.', 404);
        }
        if (matchedInvite.status === 'Revoked') {
          throw httpError('This invitation has been revoked.', 410);
        }
        if (matchedInvite.status === 'Accepted') {
          throw httpError('This invitation has already been accepted.', 410);
        }
        if (matchedInvite.status === 'Rejected') {
          throw httpError('This invitation has already been declined.', 410);
        }
        if (matchedInvite.status === 'Expired') {
          throw httpError('This invitation link has expired.', 410);
        }
        if (matchedInvite.email.toLowerCase() !== email) {
          throw httpError(
            `This invitation was issued for ${matchedInvite.email}. Please register with that email address.`,
            403
          );
        }
      }

      const existing = store.users.find((u) => u.email.toLowerCase() === email);
      const passwordHash = await hashPassword(payload.password);

      if (existing) {
        if (existing.status === 'Invited') {
          existing.name = name;
          existing.passwordHash = passwordHash;
          existing.status = 'Active';
          saveStore(store);
          // Do NOT auto-accept invitation or create ProjectMembership during registration
          return {
            token: `local_session:${existing._id}`,
            user: sanitizeUser(existing),
            pendingInvitationId: matchedInvite ? matchedInvite._id : null,
          };
        }
        throw httpError('An account with this email already exists.', 409);
      }

      const newUser: StoredUser = {
        _id: createId('usr'),
        name,
        email,
        passwordHash,
        role: 'Member',
        title: 'Product Engineer',
        avatarColor: AVATAR_COLORS[store.users.length % AVATAR_COLORS.length],
        status: 'Active',
        notificationPrefs: {
          issueAssigned: true,
          statusChanged: true,
          comments: true,
          weeklyDigest: false,
        },
        appearancePrefs: {
          theme:
            localStorage.getItem('trackly_theme') === 'dark' ? 'dark' : 'light',
          density:
            localStorage.getItem('trackly_density') === 'comfortable'
              ? 'comfortable'
              : 'compact',
        },
        createdAt: new Date().toISOString(),
      };

      store.users.push(newUser);
      saveStore(store);

      // Strictly NO auto-join of existing projects and NO auto-accept of invitations
      return {
        token: `local_session:${newUser._id}`,
        user: sanitizeUser(newUser),
        pendingInvitationId: matchedInvite ? matchedInvite._id : null,
      };
    },

    async login(payload: {
      email: string;
      password: string;
    }): Promise<{ token: string; user: User }> {
      const store = loadStore();
      const emailErr = validateEmail(payload.email);
      if (emailErr) {
        throw httpError(emailErr, 400);
      }
      if (!payload.password) {
        throw httpError('Password is required.', 400);
      }
      const email = normalizeEmail(payload.email);

      const found = store.users.find((u) => u.email.toLowerCase() === email);
      if (!found) {
        throw httpError('Invalid email or password.', 401);
      }
      if (found.status === 'Inactive') {
        throw httpError('This account has been deactivated.', 403);
      }
      if (found.status === 'Invited' && !found.passwordHash) {
        throw httpError(
          'This seat has been invited. Use Create Account with this email to set a password.',
          401
        );
      }

      const candidateHash = await hashPassword(payload.password);
      if (found.passwordHash !== candidateHash) {
        throw httpError('Invalid email or password.', 401);
      }

      return {
        token: `local_session:${found._id}`,
        user: sanitizeUser(found),
      };
    },

    async me(token: string | null): Promise<{ user: User }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);
      return { user: sanitizeUser(current) };
    },

    async updateProfile(
      token: string | null,
      payload: Partial<User>
    ): Promise<{ user: User }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      if (payload.name !== undefined) {
        const nameErr = validateFullName(payload.name);
        if (nameErr) throw httpError(nameErr, 400);
        current.name = normalizeFullName(payload.name);
      }
      if (payload.title !== undefined) {
        current.title = payload.title.trim().slice(0, 80);
      }
      if (payload.avatarColor !== undefined) {
        current.avatarColor = payload.avatarColor;
      }
      if (payload.avatar !== undefined) {
        current.avatar = payload.avatar;
      }
      if (payload.notificationPrefs) {
        current.notificationPrefs = {
          ...(current.notificationPrefs || {
            issueAssigned: true,
            statusChanged: true,
            comments: true,
            weeklyDigest: false,
          }),
          ...payload.notificationPrefs,
        };
      }
      if (payload.appearancePrefs) {
        current.appearancePrefs = {
          ...(current.appearancePrefs || { theme: 'light', density: 'compact' }),
          ...payload.appearancePrefs,
        };
      }

      saveStore(store);
      return { user: sanitizeUser(current) };
    },

    async changePassword(
      token: string | null,
      payload: {
        currentPassword: string;
        newPassword: string;
        confirmPassword: string;
      }
    ): Promise<{ message: string }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const currentHash = await hashPassword(payload.currentPassword);
      if (current.passwordHash !== currentHash) {
        throw httpError('Current password is incorrect.', 400);
      }
      const passwordErr = validatePassword(payload.newPassword);
      if (passwordErr) {
        throw httpError(passwordErr, 400);
      }
      if (payload.newPassword !== payload.confirmPassword) {
        throw httpError('New passwords do not match.', 400);
      }

      current.passwordHash = await hashPassword(payload.newPassword);
      saveStore(store);
      return { message: 'Password updated successfully.' };
    },
  },

  dashboard: {
    async get(token: string | null, projectId?: string): Promise<DashboardData> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const accessibleProjectIds = getAccessibleProjectIds(store, current._id);
      const hasProjectFilter = Boolean(projectId && projectId !== 'all');

      if (hasProjectFilter && projectId) {
        requireProjectAccess(store, current._id, projectId, 'read');
      }

      const scopedIssues = hasProjectFilter
        ? store.issues.filter((i) => i.projectId === projectId)
        : store.issues.filter((i) => accessibleProjectIds.has(i.projectId));

      const totalIssues = scopedIssues.length;
      const openIssues = scopedIssues.filter((i) => i.status === 'To Do').length;
      const inProgressIssues = scopedIssues.filter(
        (i) => i.status === 'In Progress'
      ).length;
      const resolvedIssues = scopedIssues.filter((i) => i.status === 'Done').length;
      const myAssignedIssues = scopedIssues.filter(
        (i) => i.assigneeId === current._id && i.status !== 'Done'
      ).length;

      const overdueRaw = scopedIssues.filter(isIssueOverdue);
      const overdueIssues = overdueRaw.length;
      const overdueList = [...overdueRaw]
        .sort(
          (a, b) =>
            new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime() ||
            PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
        )
        .slice(0, 8)
        .map((i) => hydrateIssue(store, i));

      const priorities: IssuePriority[] = ['Urgent', 'High', 'Medium', 'Low'];
      const issuesByPriority = priorities.map((priority) => ({
        priority,
        count: scopedIssues.filter((i) => i.priority === priority).length,
      }));

      const issuesByType = ISSUE_TYPES.map((type) => ({
        type,
        count: scopedIssues.filter((i) => i.type === type).length,
      }));

      const scopedProjects = hasProjectFilter
        ? store.projects.filter((p) => p._id === projectId)
        : store.projects.filter((p) => accessibleProjectIds.has(p._id));

      const projectProgress = scopedProjects.map((p) => {
        const stats = computeProjectStats(store.issues, p._id);
        const lead = getUserById(store, p.leadId) || fallbackUser(store);
        return {
          _id: p._id,
          name: p.name,
          key: p.key,
          lead,
          total: stats.total,
          todo: stats.todo,
          inProgress: stats.inProgress,
          done: stats.done,
          percentage: stats.progress,
        };
      });

      const myAssignedList = scopedIssues
        .filter((i) => i.assigneeId === current._id && i.status !== 'Done')
        .sort(
          (a, b) =>
            PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] ||
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        .slice(0, 8)
        .map((i) => hydrateIssue(store, i));

      const scopedActivities = hasProjectFilter
        ? store.activities.filter((a) => a.projectId === projectId)
        : store.activities.filter(
            (a) => a.projectId && accessibleProjectIds.has(a.projectId)
          );

      const recentActivities = scopedActivities
        .slice(0, 12)
        .map((a) => hydrateActivity(store, a));

      return {
        stats: {
          totalIssues,
          openIssues,
          inProgressIssues,
          resolvedIssues,
          myAssignedIssues,
          overdueIssues,
        },
        issuesByPriority,
        issuesByType,
        projectProgress,
        myAssignedList,
        overdueList,
        recentActivities,
      };
    },
  },

  projects: {
    async list(token: string | null): Promise<{ projects: Project[] }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);
      const accessibleIds = getAccessibleProjectIds(store, current._id);
      const projects = store.projects
        .filter((p) => accessibleIds.has(p._id))
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .map((p) => hydrateProject(store, p, current._id));
      return { projects };
    },

    async get(token: string | null, id: string): Promise<{ project: Project }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);
      const { project } = requireProjectAccess(store, current._id, id, 'read');
      return { project: hydrateProject(store, project, current._id) };
    },

    async create(
      token: string | null,
      payload: {
        name: string;
        key: string;
        description?: string;
        lead?: string;
        members?: string[];
      }
    ): Promise<{ project: Project }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const name = payload.name.trim();
      const key = payload.key.trim().toUpperCase();

      if (name.length < 2) {
        throw httpError('Project name must be at least 2 characters.', 400);
      }
      if (!/^[A-Z0-9]{2,10}$/.test(key)) {
        throw httpError('Project key must be 2 to 10 letters or numbers.', 400);
      }
      if (store.projects.some((p) => p.key.toUpperCase() === key)) {
        throw httpError(`Project key "${key}" is already in use.`, 409);
      }

      // Only attach existing collaborators
      const accessibleIds = getAccessibleProjectIds(store, current._id);
      const collaboratorIds = new Set<string>([current._id]);
      for (const m of store.projectMemberships) {
        if (m.membershipStatus === 'Active' && accessibleIds.has(m.projectId)) {
          collaboratorIds.add(m.userId);
        }
      }

      const leadId =
        payload.lead && collaboratorIds.has(payload.lead) ? payload.lead : current._id;
      const memberSet = new Set<string>([current._id, leadId]);
      for (const m of payload.members || []) {
        if (collaboratorIds.has(m)) memberSet.add(m);
      }

      const now = new Date().toISOString();
      const created: StoredProject = {
        _id: createId('prj'),
        name,
        key,
        description: (payload.description || '').trim(),
        ownerId: current._id,
        leadId,
        memberIds: Array.from(memberSet),
        issueCounter: 0,
        status: 'Active',
        createdAt: now,
        updatedAt: now,
      };

      store.projects.push(created);
      for (const uid of memberSet) {
        const role: ProjectRole =
          uid === current._id ? 'Owner' : uid === leadId ? 'Admin' : 'Member';
        upsertLocalMembership(store, created, uid, role);
      }

      pushActivity(store, {
        userId: current._id,
        projectId: created._id,
        issueId: null,
        issueKey: null,
        action: 'PROJECT_CREATED',
        description: `created project ${created.name} (${created.key})`,
      });
      saveStore(store);

      return { project: hydrateProject(store, created, current._id) };
    },

    async update(
      token: string | null,
      id: string,
      payload: {
        name?: string;
        key?: string;
        description?: string;
        lead?: string;
        members?: string[];
        status?: 'Active' | 'Archived';
      }
    ): Promise<{ project: Project }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);
      const { project: found } = requireProjectAccess(
        store,
        current._id,
        id,
        'manageProject'
      );

      if (payload.name !== undefined) {
        const trimmed = payload.name.trim();
        if (trimmed.length < 2) {
          throw httpError('Project name must be at least 2 characters.', 400);
        }
        found.name = trimmed;
      }

      if (payload.key !== undefined) {
        const nextKey = payload.key.trim().toUpperCase();
        if (!/^[A-Z0-9]{2,10}$/.test(nextKey)) {
          throw httpError('Project key must be 2 to 10 letters or numbers.', 400);
        }
        if (
          store.projects.some(
            (p) => p._id !== id && p.key.toUpperCase() === nextKey
          )
        ) {
          throw httpError(`Project key "${nextKey}" is already in use.`, 409);
        }
        found.key = nextKey;
      }

      if (payload.description !== undefined) {
        found.description = payload.description.trim();
      }
      if (payload.lead !== undefined) {
        found.leadId = payload.lead;
      }
      if (payload.members !== undefined) {
        const accessibleIds = getAccessibleProjectIds(store, current._id);
        const collaboratorIds = new Set<string>([current._id, found.ownerId, found.leadId]);
        for (const m of store.projectMemberships) {
          if (m.membershipStatus === 'Active' && accessibleIds.has(m.projectId)) {
            collaboratorIds.add(m.userId);
          }
        }
        const desiredSet = new Set<string>([found.ownerId, found.leadId]);
        for (const m of payload.members) {
          if (collaboratorIds.has(m)) desiredSet.add(m);
        }
        found.memberIds = Array.from(desiredSet);
        for (const uid of desiredSet) {
          const existing = getProjectMembership(store, found._id, uid);
          if (!existing) {
            upsertLocalMembership(
              store,
              found,
              uid,
              uid === found.ownerId ? 'Owner' : uid === found.leadId ? 'Admin' : 'Member'
            );
          }
        }
        for (const row of store.projectMemberships) {
          if (
            row.projectId === found._id &&
            row.membershipStatus === 'Active' &&
            row.role !== 'Owner' &&
            !desiredSet.has(row.userId)
          ) {
            row.membershipStatus = 'Removed';
          }
        }
      } else if (payload.lead !== undefined && !found.memberIds.includes(found.leadId)) {
        upsertLocalMembership(store, found, found.leadId, 'Admin');
      }

      if (payload.status !== undefined) {
        found.status = payload.status;
      }

      found.updatedAt = new Date().toISOString();

      pushActivity(store, {
        userId: current._id,
        projectId: found._id,
        issueId: null,
        issueKey: null,
        action: 'PROJECT_UPDATED',
        description: `updated project ${found.name} (${found.key})`,
      });
      saveStore(store);

      return { project: hydrateProject(store, found, current._id) };
    },

    async updateMemberRole(
      token: string | null,
      projectId: string,
      memberId: string,
      role: ProjectRole
    ): Promise<{ project: Project }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);
      const { project, role: callerRole } = requireProjectAccess(
        store,
        current._id,
        projectId,
        'manageProject'
      );

      if (!['Admin', 'Member', 'Viewer'].includes(role)) {
        throw httpError('Role must be Admin, Member, or Viewer.', 400);
      }

      const targetMembership = getProjectMembership(store, project._id, memberId);
      if (!targetMembership) {
        throw httpError('Team member does not belong to this project.', 404);
      }
      if (targetMembership.role === 'Owner') {
        throw httpError('Project ownership cannot be modified here.', 403);
      }
      if ((role === 'Admin' || targetMembership.role === 'Admin') && callerRole !== 'Owner') {
        throw httpError('Only the project owner can promote or demote admins.', 403);
      }
      if (memberId === current._id) {
        throw httpError('You cannot change your own project role.', 400);
      }

      targetMembership.role = role;
      const targetUser = getUserById(store, memberId);
      pushActivity(store, {
        userId: current._id,
        projectId: project._id,
        issueId: null,
        issueKey: null,
        action: 'MEMBER_ROLE_UPDATED',
        description: `changed ${targetUser?.name || 'member'}'s role to ${role} in ${project.name}`,
      });
      saveStore(store);

      return { project: hydrateProject(store, project, current._id) };
    },

    async removeMember(
      token: string | null,
      projectId: string,
      memberId: string
    ): Promise<{ project: Project }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);
      const { project, role: callerRole } = requireProjectAccess(
        store,
        current._id,
        projectId,
        'manageProject'
      );

      const targetMembership = getProjectMembership(store, project._id, memberId);
      if (!targetMembership) {
        throw httpError('Team member does not belong to this project.', 404);
      }
      if (targetMembership.role === 'Owner' || project.ownerId === memberId) {
        throw httpError('The project owner cannot be removed.', 403);
      }
      if (targetMembership.role === 'Admin' && callerRole !== 'Owner') {
        throw httpError('Only the project owner can remove an admin.', 403);
      }
      if (memberId === current._id) {
        throw httpError('You cannot remove yourself from the project.', 400);
      }

      targetMembership.membershipStatus = 'Removed';
      project.memberIds = project.memberIds.filter((id) => id !== memberId);
      const targetUser = getUserById(store, memberId);
      pushActivity(store, {
        userId: current._id,
        projectId: project._id,
        issueId: null,
        issueKey: null,
        action: 'MEMBER_REMOVED',
        description: `removed ${targetUser?.name || 'member'} from ${project.name}`,
      });
      saveStore(store);

      return { project: hydrateProject(store, project, current._id) };
    },

    async delete(token: string | null, id: string): Promise<{ message: string }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);
      requireProjectAccess(store, current._id, id, 'deleteProject');

      const idx = store.projects.findIndex((p) => p._id === id);
      if (idx === -1) {
        throw httpError('Project not found.', 404);
      }

      const deletedIssueIds = new Set(
        store.issues.filter((i) => i.projectId === id).map((i) => i._id)
      );

      store.projects.splice(idx, 1);
      store.projectMemberships = store.projectMemberships.filter((m) => m.projectId !== id);
      store.issues = store.issues.filter((i) => i.projectId !== id);
      store.comments = store.comments.filter((c) => !deletedIssueIds.has(c.issueId));
      store.activities = store.activities.filter((a) => a.projectId !== id);
      store.invitations = store.invitations.filter((inv) => inv.projectId !== id);

      saveStore(store);
      return { message: 'Project deleted.' };
    },
  },

  issues: {
    async list(
      token: string | null,
      params?: {
        search?: string;
        status?: string;
        priority?: string;
        type?: string;
        assignee?: string;
        project?: string;
        sortBy?: string;
        sortOrder?: string;
      }
    ): Promise<{ issues: Issue[] }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const accessibleIds = getAccessibleProjectIds(store, current._id);
      if (params?.project && params.project !== 'all') {
        requireProjectAccess(store, current._id, params.project, 'read');
      }

      let result = store.issues.filter((i) => accessibleIds.has(i.projectId));

      if (params?.project && params.project !== 'all') {
        result = result.filter((i) => i.projectId === params.project);
      }
      if (params?.status && params.status !== 'all') {
        result = result.filter((i) => i.status === params.status);
      }
      if (params?.priority && params.priority !== 'all') {
        result = result.filter((i) => i.priority === params.priority);
      }
      if (params?.type && params.type !== 'all') {
        result = result.filter((i) => i.type === params.type);
      }
      if (params?.assignee && params.assignee !== 'all') {
        if (params.assignee === 'me') {
          result = result.filter((i) => i.assigneeId === current._id);
        } else if (params.assignee === 'unassigned') {
          result = result.filter((i) => !i.assigneeId);
        } else {
          result = result.filter((i) => i.assigneeId === params.assignee);
        }
      }
      if (params?.search) {
        const q = params.search.trim().toLowerCase();
        result = result.filter(
          (i) =>
            i.title.toLowerCase().includes(q) ||
            i.issueKey.toLowerCase().includes(q) ||
            (i.description || '').toLowerCase().includes(q) ||
            (i.labels || []).some((lbl) => lbl.toLowerCase().includes(q))
        );
      }

      const sortBy = params?.sortBy || 'createdAt';
      const sortOrder = params?.sortOrder === 'asc' ? 1 : -1;

      result.sort((a, b) => {
        if (sortBy === 'priority') {
          const diff = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
          if (diff !== 0) return diff * sortOrder;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'dueDate') {
          const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          if (aTime !== bTime) return (aTime - bTime) * sortOrder;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'position') {
          if (a.position !== b.position) return a.position - b.position;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'updatedAt') {
          return (
            (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * sortOrder
          );
        }
        return (
          (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * sortOrder
        );
      });

      return { issues: result.map((i) => hydrateIssue(store, i)) };
    },

    async get(
      token: string | null,
      id: string
    ): Promise<{ issue: Issue; comments: Comment[]; activities: Activity[] }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const found = store.issues.find((i) => i._id === id || i.issueKey === id.toUpperCase());
      if (!found) {
        throw httpError('Issue not found.', 404);
      }

      requireProjectAccess(store, current._id, found.projectId, 'read');

      const comments = store.comments
        .filter((c) => c.issueId === found._id)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        .map((c) => hydrateComment(store, c));

      const activities = store.activities
        .filter((a) => a.issueId === found._id)
        .map((a) => hydrateActivity(store, a));

      return {
        issue: hydrateIssue(store, found),
        comments,
        activities,
      };
    },

    async create(
      token: string | null,
      payload: {
        title: string;
        description?: string;
        type: IssueType;
        priority: IssuePriority;
        status: IssueStatus;
        project: string;
        assignee?: string | null;
        dueDate?: string | null;
        labels?: string[];
        bugDetails?: BugDetails;
        featureDetails?: FeatureDetails;
        attachmentFile?: File | null;
      }
    ): Promise<{ issue: Issue }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const title = payload.title.trim();
      if (title.length < 2) {
        throw httpError('Issue title must be at least 2 characters.', 400);
      }

      const dueErr = validateOptionalDueDate(payload.dueDate);
      if (dueErr) throw httpError(dueErr, 400);

      const { project: proj } = requireProjectAccess(
        store,
        current._id,
        payload.project,
        'writeIssues'
      );

      if (payload.assignee && !getUserProjectRole(store, proj._id, payload.assignee)) {
        throw httpError(
          'Issues can only be assigned to active members of the selected project.',
          400
        );
      }

      const attachments: Attachment[] = [];
      if (payload.attachmentFile) {
        const dataUrl = await readFileAsDataUrl(payload.attachmentFile);
        attachments.push({
          _id: createId('att'),
          filename: payload.attachmentFile.name,
          originalName: payload.attachmentFile.name,
          mimetype: payload.attachmentFile.type || 'application/octet-stream',
          size: payload.attachmentFile.size,
          url: dataUrl,
          uploadedBy: current._id,
          uploadedAt: new Date().toISOString(),
        });
      }

      let issueKey = '';
      do {
        proj.issueCounter += 1;
        issueKey = `${proj.key}-${String(proj.issueCounter).padStart(3, '0')}`;
      } while (store.issues.some((i) => i.issueKey === issueKey));

      const columnCount = store.issues.filter(
        (i) => i.projectId === proj._id && i.status === payload.status
      ).length;

      const cleanLabels: string[] = [];
      if (Array.isArray(payload.labels)) {
        const seen = new Set<string>();
        for (const rawLabel of payload.labels) {
          const val = String(rawLabel || '').trim().slice(0, 32);
          if (val && !seen.has(val.toLowerCase())) {
            seen.add(val.toLowerCase());
            cleanLabels.push(val);
          }
          if (cleanLabels.length >= 10) break;
        }
      }

      const now = new Date().toISOString();
      const created: StoredIssue = {
        _id: createId('iss'),
        issueKey,
        title,
        description: (payload.description || '').trim(),
        type: payload.type,
        priority: payload.priority,
        status: payload.status,
        position: columnCount,
        assigneeId: payload.assignee || null,
        reporterId: current._id,
        projectId: proj._id,
        dueDate: payload.dueDate || null,
        labels: cleanLabels,
        bugDetails:
          payload.type === 'Bug' && payload.bugDetails
            ? {
                stepsToReproduce: (payload.bugDetails.stepsToReproduce || '').trim(),
                expectedResult: (payload.bugDetails.expectedResult || '').trim(),
                actualResult: (payload.bugDetails.actualResult || '').trim(),
                environment: (payload.bugDetails.environment || '').trim(),
              }
            : undefined,
        featureDetails:
          payload.type === 'Feature Request' && payload.featureDetails
            ? {
                featureDescription: (payload.featureDetails.featureDescription || '').trim(),
                reasonForRequest: (payload.featureDetails.reasonForRequest || '').trim(),
                expectedOutcome: (payload.featureDetails.expectedOutcome || '').trim(),
              }
            : undefined,
        attachments,
        createdAt: now,
        updatedAt: now,
      };

      store.issues.push(created);
      pushActivity(store, {
        userId: current._id,
        projectId: proj._id,
        issueId: created._id,
        issueKey: created.issueKey,
        action: 'ISSUE_CREATED',
        description: `created ${created.issueKey}: ${created.title}`,
      });

      if (created.assigneeId) {
        const assignee = getUserById(store, created.assigneeId);
        if (assignee) {
          pushActivity(store, {
            userId: current._id,
            projectId: proj._id,
            issueId: created._id,
            issueKey: created.issueKey,
            action: 'ISSUE_ASSIGNED',
            description: `assigned ${created.issueKey} to ${assignee.name}`,
          });
        }
      }

      saveStore(store);
      return { issue: hydrateIssue(store, created) };
    },

    async update(
      token: string | null,
      id: string,
      payload: Partial<{
        title: string;
        description: string;
        type: IssueType;
        priority: IssuePriority;
        status: IssueStatus;
        assignee: string | null;
        dueDate: string | null;
        labels: string[];
        bugDetails: BugDetails;
        featureDetails: FeatureDetails;
      }>
    ): Promise<{ issue: Issue }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const found = store.issues.find((i) => i._id === id);
      if (!found) {
        throw httpError('Issue not found.', 404);
      }

      requireProjectAccess(store, current._id, found.projectId, 'writeIssues');

      if (payload.dueDate !== undefined) {
        const dueErr = validateOptionalDueDate(payload.dueDate);
        if (dueErr) throw httpError(dueErr, 400);
      }

      if (payload.assignee && !getUserProjectRole(store, found.projectId, payload.assignee)) {
        throw httpError('Issues can only be assigned to active members of this project.', 400);
      }

      if (payload.title !== undefined) {
        const trimmed = payload.title.trim();
        if (trimmed.length < 2) {
          throw httpError('Issue title must be at least 2 characters.', 400);
        }
        found.title = trimmed;
      }

      if (payload.description !== undefined) {
        found.description = payload.description;
      }

      if (payload.type !== undefined) {
        found.type = payload.type;
      }

      if (payload.labels !== undefined) {
        const seen = new Set<string>();
        const cleanLabels: string[] = [];
        for (const rawLabel of payload.labels) {
          const val = String(rawLabel || '').trim().slice(0, 32);
          if (val && !seen.has(val.toLowerCase())) {
            seen.add(val.toLowerCase());
            cleanLabels.push(val);
          }
          if (cleanLabels.length >= 10) break;
        }
        found.labels = cleanLabels;
      }

      if (payload.bugDetails !== undefined) {
        found.bugDetails = {
          stepsToReproduce: (payload.bugDetails.stepsToReproduce || '').trim(),
          expectedResult: (payload.bugDetails.expectedResult || '').trim(),
          actualResult: (payload.bugDetails.actualResult || '').trim(),
          environment: (payload.bugDetails.environment || '').trim(),
        };
      }

      if (payload.featureDetails !== undefined) {
        found.featureDetails = {
          featureDescription: (payload.featureDetails.featureDescription || '').trim(),
          reasonForRequest: (payload.featureDetails.reasonForRequest || '').trim(),
          expectedOutcome: (payload.featureDetails.expectedOutcome || '').trim(),
        };
      }

      if (payload.status !== undefined && payload.status !== found.status) {
        const oldStatus = found.status;
        found.status = payload.status;
        pushActivity(store, {
          userId: current._id,
          projectId: found.projectId,
          issueId: found._id,
          issueKey: found.issueKey,
          action: 'STATUS_CHANGED',
          description: `moved ${found.issueKey} from ${oldStatus} to ${payload.status}`,
          metadata: { from: oldStatus, to: payload.status },
        });
      }

      if (payload.priority !== undefined && payload.priority !== found.priority) {
        const oldPriority = found.priority;
        found.priority = payload.priority;
        pushActivity(store, {
          userId: current._id,
          projectId: found.projectId,
          issueId: found._id,
          issueKey: found.issueKey,
          action: 'PRIORITY_UPDATED',
          description: `changed ${found.issueKey} priority from ${oldPriority} to ${payload.priority}`,
          metadata: { from: oldPriority, to: payload.priority },
        });
      }

      if (payload.assignee !== undefined && payload.assignee !== found.assigneeId) {
        found.assigneeId = payload.assignee;
        const assignee = getUserById(store, payload.assignee);
        pushActivity(store, {
          userId: current._id,
          projectId: found.projectId,
          issueId: found._id,
          issueKey: found.issueKey,
          action: 'ISSUE_ASSIGNED',
          description: assignee
            ? `assigned ${found.issueKey} to ${assignee.name}`
            : `unassigned ${found.issueKey}`,
        });
      }

      if (payload.dueDate !== undefined) {
        found.dueDate = payload.dueDate;
      }

      found.updatedAt = new Date().toISOString();
      saveStore(store);
      return { issue: hydrateIssue(store, found) };
    },

    async updateStatus(
      token: string | null,
      id: string,
      status: IssueStatus,
      position?: number
    ): Promise<{ issue: Issue }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const found = store.issues.find((i) => i._id === id);
      if (!found) {
        throw httpError('Issue not found.', 404);
      }

      requireProjectAccess(store, current._id, found.projectId, 'writeIssues');

      const oldStatus = found.status;
      found.status = status;
      if (position !== undefined) {
        found.position = position;
      }
      found.updatedAt = new Date().toISOString();

      if (oldStatus !== status) {
        pushActivity(store, {
          userId: current._id,
          projectId: found.projectId,
          issueId: found._id,
          issueKey: found.issueKey,
          action: 'STATUS_CHANGED',
          description: `moved ${found.issueKey} from ${oldStatus} to ${status}`,
          metadata: { from: oldStatus, to: status },
        });
      }

      saveStore(store);
      return { issue: hydrateIssue(store, found) };
    },

    async delete(token: string | null, id: string): Promise<{ message: string }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const idx = store.issues.findIndex((i) => i._id === id);
      if (idx === -1) {
        throw httpError('Issue not found.', 404);
      }

      const target = store.issues[idx];
      const { role } = requireProjectAccess(store, current._id, target.projectId, 'writeIssues');
      const isReporter = target.reporterId === current._id;
      const canDelete = role === 'Owner' || role === 'Admin' || (role === 'Member' && isReporter);
      if (!canDelete) {
        throw httpError('Only project admins, owners, or the issue reporter can delete an issue.', 403);
      }

      const [removed] = store.issues.splice(idx, 1);
      store.comments = store.comments.filter((c) => c.issueId !== id);

      pushActivity(store, {
        userId: current._id,
        projectId: removed.projectId,
        issueId: null,
        issueKey: removed.issueKey,
        action: 'ISSUE_DELETED',
        description: `deleted ${removed.issueKey}: ${removed.title}`,
      });

      saveStore(store);
      return { message: 'Issue deleted.' };
    },

    async uploadAttachment(
      token: string | null,
      id: string,
      file: File
    ): Promise<{ issue: Issue }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const found = store.issues.find((i) => i._id === id);
      if (!found) {
        throw httpError('Issue not found.', 404);
      }

      requireProjectAccess(store, current._id, found.projectId, 'writeIssues');

      const dataUrl = await readFileAsDataUrl(file);
      const attachment: Attachment = {
        _id: createId('att'),
        filename: file.name,
        originalName: file.name,
        mimetype: file.type || 'application/octet-stream',
        size: file.size,
        url: dataUrl,
        uploadedBy: current._id,
        uploadedAt: new Date().toISOString(),
      };

      found.attachments.push(attachment);
      found.updatedAt = new Date().toISOString();

      pushActivity(store, {
        userId: current._id,
        projectId: found.projectId,
        issueId: found._id,
        issueKey: found.issueKey,
        action: 'ISSUE_UPDATED',
        description: `attached ${file.name} to ${found.issueKey}`,
      });

      saveStore(store);
      return { issue: hydrateIssue(store, found) };
    },

    async deleteAttachment(
      token: string | null,
      id: string,
      attachmentId: string
    ): Promise<{ issue: Issue }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const found = store.issues.find((i) => i._id === id);
      if (!found) {
        throw httpError('Issue not found.', 404);
      }

      requireProjectAccess(store, current._id, found.projectId, 'writeIssues');

      found.attachments = found.attachments.filter((a) => a._id !== attachmentId);
      found.updatedAt = new Date().toISOString();
      saveStore(store);
      return { issue: hydrateIssue(store, found) };
    },
  },

  comments: {
    async list(token: string | null, issueId: string): Promise<{ comments: Comment[] }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const issue = store.issues.find((i) => i._id === issueId);
      if (!issue) throw httpError('Issue not found.', 404);
      requireProjectAccess(store, current._id, issue.projectId, 'read');

      const comments = store.comments
        .filter((c) => c.issueId === issueId)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        .map((c) => hydrateComment(store, c));
      return { comments };
    },

    async create(
      token: string | null,
      issueId: string,
      text: string
    ): Promise<{ comment: Comment }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const issue = store.issues.find((i) => i._id === issueId);
      if (!issue) {
        throw httpError('Issue not found.', 404);
      }
      requireProjectAccess(store, current._id, issue.projectId, 'comment');

      const trimmed = text.trim();
      if (!trimmed) {
        throw httpError('Comment text cannot be empty.', 400);
      }

      const now = new Date().toISOString();
      const comment: StoredComment = {
        _id: createId('cmt'),
        issueId,
        userId: current._id,
        text: trimmed,
        createdAt: now,
        updatedAt: now,
      };

      store.comments.push(comment);
      issue.updatedAt = now;

      pushActivity(store, {
        userId: current._id,
        projectId: issue.projectId,
        issueId: issue._id,
        issueKey: issue.issueKey,
        action: 'COMMENT_ADDED',
        description: `commented on ${issue.issueKey}`,
      });

      saveStore(store);
      return { comment: hydrateComment(store, comment) };
    },

    async update(
      token: string | null,
      commentId: string,
      text: string
    ): Promise<{ comment: Comment }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const target = store.comments.find((c) => c._id === commentId);
      if (!target) {
        throw httpError('Comment not found.', 404);
      }
      const issue = store.issues.find((i) => i._id === target.issueId);
      if (!issue) throw httpError('Associated issue not found.', 404);
      requireProjectAccess(store, current._id, issue.projectId, 'comment');

      if (target.userId !== current._id) {
        throw httpError('You can only edit your own comments.', 403);
      }
      const trimmed = text.trim();
      if (!trimmed) {
        throw httpError('Comment text cannot be empty.', 400);
      }

      target.text = trimmed;
      target.updatedAt = new Date().toISOString();
      saveStore(store);
      return { comment: hydrateComment(store, target) };
    },

    async delete(token: string | null, commentId: string): Promise<{ message: string }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const idx = store.comments.findIndex((c) => c._id === commentId);
      if (idx === -1) {
        throw httpError('Comment not found.', 404);
      }
      const target = store.comments[idx];
      const issue = store.issues.find((i) => i._id === target.issueId);
      if (!issue) throw httpError('Associated issue not found.', 404);
      const { role } = requireProjectAccess(store, current._id, issue.projectId, 'comment');

      if (target.userId !== current._id && !canManageProject(role)) {
        throw httpError('You do not have permission to delete this comment.', 403);
      }

      store.comments.splice(idx, 1);
      saveStore(store);
      return { message: 'Comment deleted.' };
    },
  },

  activities: {
    async list(
      token: string | null,
      params?: {
        project?: string;
        action?: string;
        user?: string;
        limit?: number;
      }
    ): Promise<{ activities: Activity[] }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const accessibleIds = getAccessibleProjectIds(store, current._id);
      if (params?.project && params.project !== 'all') {
        requireProjectAccess(store, current._id, params.project, 'read');
      }

      let list = store.activities.filter(
        (a) => a.projectId && accessibleIds.has(a.projectId)
      );
      if (params?.project && params.project !== 'all') {
        list = list.filter((a) => a.projectId === params.project);
      }
      if (params?.action && params.action !== 'all') {
        list = list.filter((a) => a.action === params.action);
      }
      if (params?.user && params.user !== 'all') {
        list = list.filter((a) => a.userId === params.user);
      }
      if (params?.limit) {
        list = list.slice(0, params.limit);
      }

      return { activities: list.map((a) => hydrateActivity(store, a)) };
    },
  },

  users: {
    async list(token: string | null): Promise<{ users: User[] }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const accessibleIds = getAccessibleProjectIds(store, current._id);
      const collaboratorIds = new Set<string>([current._id]);
      for (const m of store.projectMemberships) {
        if (m.membershipStatus === 'Active' && accessibleIds.has(m.projectId)) {
          collaboratorIds.add(m.userId);
        }
      }

      const users: User[] = store.users
        .filter((u) => collaboratorIds.has(u._id))
        .map((u) => {
          const clean = sanitizeUser(u);
          const assignedIssues = store.issues.filter(
            (i) => accessibleIds.has(i.projectId) && i.assigneeId === u._id
          );
          const openAssigned = assignedIssues.filter((i) => i.status !== 'Done');
          const userProjects = store.projectMemberships
            .filter(
              (m) =>
                m.userId === u._id &&
                m.membershipStatus === 'Active' &&
                accessibleIds.has(m.projectId)
            )
            .map((m) => {
              const p = store.projects.find((proj) => proj._id === m.projectId);
              return p
                ? { _id: p._id, name: p.name, key: p.key, projectRole: m.role }
                : null;
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item));

          return {
            ...clean,
            assignedCount: assignedIssues.length,
            openAssignedCount: openAssigned.length,
            projects: userProjects,
          };
        });

      return { users };
    },

    async invite(
      token: string | null,
      payload: {
        name: string;
        email: string;
        role: UserRole;
        title?: string;
        projectIds?: string[];
      }
    ): Promise<{ user: User }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const requestedIds = payload.projectIds || [];
      if (requestedIds.length === 0) {
        throw httpError(
          'Direct team member creation requires selecting at least one project you manage.',
          400
        );
      }

      const managedProjects: StoredProject[] = [];
      for (const pid of requestedIds) {
        const access = requireProjectAccess(store, current._id, pid, 'manageProject');
        if (payload.role === 'Admin' && access.role !== 'Owner') {
          throw httpError('Only a project owner can assign the Admin role.', 403);
        }
        managedProjects.push(access.project);
      }

      if (payload.role === 'Owner') {
        throw httpError('Project ownership cannot be assigned directly.', 400);
      }

      const nameErr = validateFullName(payload.name);
      if (nameErr) throw httpError(nameErr, 400);

      const emailErr = validateEmail(payload.email);
      if (emailErr) throw httpError(emailErr, 400);

      const name = normalizeFullName(payload.name);
      const email = normalizeEmail(payload.email);

      if (store.users.some((u) => u.email.toLowerCase() === email)) {
        throw httpError(
          'A user with this email already exists. Send them a project invitation link instead.',
          409
        );
      }

      const invited: StoredUser = {
        _id: createId('usr'),
        name,
        email,
        passwordHash: '',
        role: payload.role,
        title: (payload.title || payload.role).trim(),
        avatarColor: AVATAR_COLORS[store.users.length % AVATAR_COLORS.length],
        status: 'Invited',
        createdAt: new Date().toISOString(),
      };

      store.users.push(invited);
      const projectRole = normalizeProjectRole(payload.role);
      for (const proj of managedProjects) {
        upsertLocalMembership(store, proj, invited._id, projectRole);
        pushActivity(store, {
          userId: current._id,
          projectId: proj._id,
          issueId: null,
          issueKey: null,
          action: 'MEMBER_INVITED',
          description: `added ${invited.name} (${projectRole}) to ${proj.name}`,
        });
      }

      saveStore(store);
      return { user: sanitizeUser(invited) };
    },

    async update(
      token: string | null,
      id: string,
      payload: Partial<{
        name: string;
        role: UserRole;
        title: string;
        status: UserStatus;
      }>
    ): Promise<{ user: User }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);
      if (id !== current._id) {
        throw httpError(
          'Use project member settings to manage roles within a specific project.',
          403
        );
      }

      const target = store.users.find((u) => u._id === id);
      if (!target) {
        throw httpError('Team member not found.', 404);
      }

      if (payload.name !== undefined) {
        const nameErr = validateFullName(payload.name);
        if (nameErr) throw httpError(nameErr, 400);
        target.name = normalizeFullName(payload.name);
      }
      if (payload.title !== undefined) target.title = payload.title.trim();

      saveStore(store);
      return { user: sanitizeUser(target) };
    },
  },

  invitations: {
    async list(
      token: string | null,
      projectId?: string
    ): Promise<{ invitations: Invitation[] }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      if (expireStaleInvitations(store)) {
        saveStore(store);
      }

      const manageableProjectIds = new Set<string>();
      for (const m of store.projectMemberships) {
        if (
          m.userId === current._id &&
          m.membershipStatus === 'Active' &&
          canManageProject(m.role)
        ) {
          manageableProjectIds.add(m.projectId);
        }
      }

      let filtered: StoredInvitation[];
      if (projectId && projectId !== 'all') {
        requireProjectAccess(store, current._id, projectId, 'manageProject');
        filtered = store.invitations.filter((inv) => inv.projectId === projectId);
      } else {
        filtered = store.invitations.filter(
          (inv) =>
            (inv.projectId && manageableProjectIds.has(inv.projectId)) ||
            (!inv.projectId && inv.invitedById === current._id)
        );
      }

      const invitations = [...filtered]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .map((inv) => hydrateInvitation(store, inv));
      return { invitations };
    },

    async mine(token: string | null): Promise<{ invitations: Invitation[] }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      if (expireStaleInvitations(store)) {
        saveStore(store);
      }

      const myEmail = current.email.toLowerCase();
      const invitations = store.invitations
        .filter((inv) => inv.email.toLowerCase() === myEmail && inv.status === 'Pending')
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .map((inv) => hydrateInvitation(store, inv));

      return { invitations };
    },

    async create(
      token: string | null,
      payload: {
        email: string;
        role: UserRole;
        projectId?: string | null;
        message?: string;
      }
    ): Promise<InvitationCreateResult> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const emailErr = validateEmail(payload.email);
      if (emailErr) throw httpError(emailErr, 400);
      const email = normalizeEmail(payload.email);

      if (payload.role === 'Owner') {
        throw httpError('Project ownership cannot be granted via invitation.', 400);
      }

      expireStaleInvitations(store);

      const scopedProjectId =
        payload.projectId && payload.projectId !== 'workspace'
          ? payload.projectId
          : null;
      if (!scopedProjectId) {
        throw httpError('Please select a project for this invitation.', 400);
      }

      const { project: proj, role: callerRole } = requireProjectAccess(
        store,
        current._id,
        scopedProjectId,
        'manageProject'
      );

      if (payload.role === 'Admin' && callerRole !== 'Owner') {
        throw httpError('Only the project owner can invite a project Admin.', 403);
      }

      const existingUser = store.users.find((u) => u.email.toLowerCase() === email);
      if (existingUser) {
        if (existingUser.status === 'Inactive') {
          throw httpError('An inactive account already exists for this email.', 409);
        }
        if (getUserProjectRole(store, proj._id, existingUser._id)) {
          throw httpError(`${existingUser.name} is already a member of ${proj.name}.`, 409);
        }
      }

      const duplicatePending = store.invitations.find(
        (inv) =>
          inv.email.toLowerCase() === email &&
          inv.projectId === scopedProjectId &&
          inv.status === 'Pending'
      );
      if (duplicatePending) {
        throw httpError(
          `An active pending invitation already exists for ${email} in ${proj.name}.`,
          409
        );
      }

      const rawToken = generateRawToken();
      const tokenHash = await hashInvitationToken(rawToken);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + INVITE_TTL_MS).toISOString();

      const created: StoredInvitation = {
        _id: createId('inv'),
        email,
        role: payload.role,
        projectId: scopedProjectId,
        workspaceName: proj.name,
        message: (payload.message || '').trim().slice(0, 500),
        tokenHash,
        status: 'Pending',
        invitedById: current._id,
        expiresAt,
        createdAt: now.toISOString(),
      };

      store.invitations.unshift(created);
      pushActivity(store, {
        userId: current._id,
        projectId: scopedProjectId,
        issueId: null,
        issueKey: null,
        action: 'INVITATION_CREATED',
        description: `invited ${email} to ${proj.name} as ${payload.role}`,
      });
      saveStore(store);
      const hydrated = hydrateInvitation(store, created);
      await bridgeMirrorInvitation(rawToken, hydrated);

      return {
        invitation: hydrated,
        inviteToken: rawToken,
        invitePath: `/invite/${rawToken}`,
      };
    },

    async validate(rawToken: string): Promise<InvitationValidation> {
      const store = loadStore();
      if (expireStaleInvitations(store)) {
        saveStore(store);
      }

      const cleaned = normalizeRawInviteToken(rawToken);
      if (!cleaned || cleaned.length < 16) {
        return {
          valid: false,
          status: 'Invalid',
          reason: 'This invitation link is invalid or malformed.',
        };
      }

      const tokenHash = await hashInvitationToken(cleaned);
      let found = store.invitations.find((inv) => inv.tokenHash === tokenHash);

      if (!found) {
        const bridged = await bridgeValidateInvite(cleaned);
        if (bridged) {
          if (bridged.valid && bridged.invitation) {
            const bInv = bridged.invitation;
            let inviterId = store.users.find((u) => u.name === bInv.invitedByName)?._id;
            if (!inviterId) {
              inviterId = createId('usr');
              store.users.push({
                _id: inviterId,
                name: bInv.invitedByName,
                email: 'admin@workspace.local',
                passwordHash: '',
                role: 'Member',
                status: 'Active',
                avatarColor: AVATAR_COLORS[0],
                createdAt: bInv.createdAt,
              });
            }
            if (bInv.project && !store.projects.some((p) => p._id === bInv.project!._id)) {
              const pRec: StoredProject = {
                _id: bInv.project._id,
                name: bInv.project.name,
                key: bInv.project.key,
                description: bInv.project.description || '',
                ownerId: inviterId,
                leadId: inviterId,
                memberIds: [inviterId],
                issueCounter: 0,
                status: 'Active',
                createdAt: bInv.createdAt,
                updatedAt: bInv.createdAt,
              };
              store.projects.push(pRec);
              upsertLocalMembership(store, pRec, inviterId, 'Owner');
            }
            found = {
              _id: bInv._id,
              email: bInv.email,
              role: bInv.role,
              projectId: bInv.project ? bInv.project._id : null,
              workspaceName: bInv.workspaceName,
              message: bInv.message,
              tokenHash,
              status: 'Pending',
              invitedById: inviterId,
              expiresAt: bInv.expiresAt,
              createdAt: bInv.createdAt,
            };
            store.invitations.unshift(found);
            saveStore(store);
          }
          return bridged;
        }

        return {
          valid: false,
          status: 'Invalid',
          reason: 'This invitation link could not be found.',
        };
      }

      if (found.status === 'Revoked') {
        return {
          valid: false,
          status: 'Revoked',
          reason: 'This invitation has been revoked by a project administrator.',
        };
      }
      if (found.status === 'Accepted') {
        return {
          valid: false,
          status: 'Accepted',
          reason: 'This invitation has already been accepted.',
        };
      }
      if (found.status === 'Rejected') {
        return {
          valid: false,
          status: 'Rejected',
          reason: 'This invitation has been declined by the recipient.',
        };
      }
      if (found.status === 'Expired') {
        return {
          valid: false,
          status: 'Expired',
          reason:
            'This invitation link has expired. Ask a project administrator to generate a fresh link.',
        };
      }

      const hydrated = hydrateInvitation(store, found);
      return {
        valid: true,
        status: 'Pending',
        invitation: {
          _id: hydrated._id,
          email: hydrated.email,
          role: hydrated.role,
          project: hydrated.project,
          workspaceName: hydrated.workspaceName,
          message: hydrated.message,
          invitedByName: hydrated.invitedBy.name,
          expiresAt: hydrated.expiresAt,
          createdAt: hydrated.createdAt,
        },
      };
    },

    async accept(
      token: string | null,
      rawToken: string
    ): Promise<{ message: string; projectId: string | null; user: User }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);
      if (expireStaleInvitations(store)) {
        saveStore(store);
      }

      const tokenHash = await hashInvitationToken(String(rawToken || '').trim());
      const inv = store.invitations.find((item) => item.tokenHash === tokenHash);
      if (!inv) throw httpError('Invalid invitation link.', 404);
      return finalizeLocalAccept(store, current, inv, normalizeRawInviteToken(rawToken));
    },

    async acceptById(
      token: string | null,
      id: string
    ): Promise<{ message: string; projectId: string | null; user: User }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);
      if (expireStaleInvitations(store)) {
        saveStore(store);
      }

      const inv = store.invitations.find((item) => item._id === id);
      if (!inv) throw httpError('Invitation not found.', 404);
      return finalizeLocalAccept(store, current, inv);
    },

    async reject(
      token: string | null,
      rawToken: string
    ): Promise<{ message: string; invitation: Invitation }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);
      if (expireStaleInvitations(store)) {
        saveStore(store);
      }

      const tokenHash = await hashInvitationToken(String(rawToken || '').trim());
      const inv = store.invitations.find((item) => item.tokenHash === tokenHash);
      if (!inv) throw httpError('Invalid invitation link.', 404);
      return finalizeLocalReject(store, current, inv, normalizeRawInviteToken(rawToken));
    },

    async rejectById(
      token: string | null,
      id: string
    ): Promise<{ message: string; invitation: Invitation }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);
      if (expireStaleInvitations(store)) {
        saveStore(store);
      }

      const inv = store.invitations.find((item) => item._id === id);
      if (!inv) throw httpError('Invitation not found.', 404);
      return finalizeLocalReject(store, current, inv);
    },

    async resend(token: string | null, id: string): Promise<InvitationCreateResult> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const inv = store.invitations.find((item) => item._id === id);
      if (!inv) throw httpError('Invitation not found.', 404);

      if (inv.projectId) {
        requireProjectAccess(store, current._id, inv.projectId, 'manageProject');
      } else if (inv.invitedById !== current._id) {
        throw httpError('You do not have permission to resend this invitation.', 403);
      }

      if (inv.status === 'Accepted') {
        throw httpError('This invitation has already been accepted.', 400);
      }
      if (inv.status === 'Revoked') {
        throw httpError(
          'Revoked invitations cannot be resent. Create a new invitation instead.',
          400
        );
      }

      const rawToken = generateRawToken();
      inv.tokenHash = await hashInvitationToken(rawToken);
      inv.status = 'Pending';
      inv.expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
      saveStore(store);

      const hydrated = hydrateInvitation(store, inv);
      await bridgeMirrorInvitation(rawToken, hydrated);

      return {
        invitation: hydrated,
        inviteToken: rawToken,
        invitePath: `/invite/${rawToken}`,
      };
    },

    async revoke(token: string | null, id: string): Promise<{ invitation: Invitation }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);

      const inv = store.invitations.find((item) => item._id === id);
      if (!inv) throw httpError('Invitation not found.', 404);

      if (inv.projectId) {
        requireProjectAccess(store, current._id, inv.projectId, 'manageProject');
      } else if (inv.invitedById !== current._id) {
        throw httpError('You do not have permission to revoke this invitation.', 403);
      }

      if (inv.status === 'Accepted') {
        throw httpError('Accepted invitations cannot be revoked.', 400);
      }
      if (inv.status === 'Rejected') {
        throw httpError('Declined invitations cannot be revoked.', 400);
      }
      if (inv.status === 'Revoked') {
        throw httpError('This invitation is already revoked.', 400);
      }

      inv.status = 'Revoked';
      inv.revokedAt = new Date().toISOString();
      pushActivity(store, {
        userId: current._id,
        projectId: inv.projectId,
        issueId: null,
        issueKey: null,
        action: 'INVITATION_REVOKED',
        description: `revoked the invitation for ${inv.email}`,
      });
      saveStore(store);
      await bridgeUpdateInviteStatus({ invitationId: inv._id, status: 'Revoked' });

      return { invitation: hydrateInvitation(store, inv) };
    },
  },

  workspace: {
    async get(token: string | null): Promise<{ workspace: Workspace }> {
      const store = loadStore();
      requireSessionUser(store, token);
      return { workspace: store.workspace };
    },

    async update(
      token: string | null,
      payload: Partial<Workspace>
    ): Promise<{ workspace: Workspace }> {
      const store = loadStore();
      const current = requireSessionUser(store, token);
      const hasManagedProject = store.projectMemberships.some(
        (m) =>
          m.userId === current._id &&
          m.membershipStatus === 'Active' &&
          canManageProject(m.role)
      );
      if (current.role !== 'Admin' && !hasManagedProject) {
        throw httpError(
          'Only project administrators or workspace administrators can update workspace settings.',
          403
        );
      }

      if (payload.name !== undefined && !payload.name.trim()) {
        throw httpError('Workspace name is required.', 400);
      }
      if (payload.slug !== undefined) {
        const nextSlug = payload.slug.trim().toLowerCase();
        if (!/^[a-z0-9-]{2,40}$/.test(nextSlug)) {
          throw httpError(
            'Workspace slug must be 2–40 lowercase letters, numbers, or hyphens.',
            400
          );
        }
      }

      store.workspace = {
        ...store.workspace,
        ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
        ...(payload.slug !== undefined
          ? { slug: payload.slug.trim().toLowerCase() }
          : {}),
        ...(payload.description !== undefined
          ? { description: payload.description.trim() }
          : {}),
        ...(payload.defaultIssuePriority !== undefined
          ? { defaultIssuePriority: payload.defaultIssuePriority }
          : {}),
      };

      saveStore(store);
      return { workspace: store.workspace };
    },
  },
};

async function finalizeLocalAccept(
  store: LocalStoreData,
  current: StoredUser,
  inv: StoredInvitation,
  rawToken?: string
): Promise<{ message: string; projectId: string | null; user: User }> {
  if (inv.status === 'Revoked') throw httpError('This invitation has been revoked.', 410);
  if (inv.status === 'Accepted') throw httpError('This invitation has already been accepted.', 410);
  if (inv.status === 'Rejected') throw httpError('This invitation has already been declined.', 410);
  if (inv.status === 'Expired') throw httpError('This invitation link has expired.', 410);
  if (current.email.toLowerCase() !== inv.email.toLowerCase()) {
    throw httpError(
      `This invitation was issued for ${inv.email}. Please sign in with that email address.`,
      403
    );
  }

  if (current.status === 'Invited') {
    current.status = 'Active';
  }

  const projectRole = normalizeProjectRole(inv.role);
  if (inv.projectId) {
    const proj = store.projects.find((p) => p._id === inv.projectId);
    if (!proj) {
      throw httpError('The project associated with this invitation no longer exists.', 404);
    }
    upsertLocalMembership(store, proj, current._id, projectRole);
  }

  inv.status = 'Accepted';
  inv.acceptedAt = new Date().toISOString();
  inv.acceptedById = current._id;

  pushActivity(store, {
    userId: current._id,
    projectId: inv.projectId,
    issueId: null,
    issueKey: null,
    action: 'INVITATION_ACCEPTED',
    description: `accepted invitation as ${projectRole}`,
  });

  saveStore(store);
  await bridgeUpdateInviteStatus({
    rawToken,
    invitationId: inv._id,
    status: 'Accepted',
  });
  return {
    message: 'Invitation accepted.',
    projectId: inv.projectId,
    user: sanitizeUser(current),
  };
}

async function finalizeLocalReject(
  store: LocalStoreData,
  current: StoredUser,
  inv: StoredInvitation,
  rawToken?: string
): Promise<{ message: string; invitation: Invitation }> {
  if (inv.status === 'Revoked') throw httpError('This invitation has been revoked.', 410);
  if (inv.status === 'Accepted') throw httpError('This invitation has already been accepted.', 410);
  if (inv.status === 'Rejected') throw httpError('This invitation has already been declined.', 410);
  if (inv.status === 'Expired') throw httpError('This invitation link has expired.', 410);
  if (current.email.toLowerCase() !== inv.email.toLowerCase()) {
    throw httpError(
      `This invitation was issued for ${inv.email}. Please sign in with that email address.`,
      403
    );
  }

  inv.status = 'Rejected';
  inv.rejectedAt = new Date().toISOString();
  inv.rejectedById = current._id;

  pushActivity(store, {
    userId: current._id,
    projectId: inv.projectId,
    issueId: null,
    issueKey: null,
    action: 'INVITATION_REJECTED',
    description: `declined invitation for ${inv.email}`,
  });

  saveStore(store);
  await bridgeUpdateInviteStatus({
    rawToken,
    invitationId: inv._id,
    status: 'Rejected',
  });

  return {
    message: 'Invitation declined.',
    invitation: hydrateInvitation(store, inv),
  };
}
