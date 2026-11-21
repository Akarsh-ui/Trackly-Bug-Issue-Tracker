export type UserRole =
  | 'Owner'
  | 'Admin'
  | 'Engineering Lead'
  | 'Developer'
  | 'Designer'
  | 'QA Engineer'
  | 'Member'
  | 'Viewer';

export type ProjectRole = 'Owner' | 'Admin' | 'Member' | 'Viewer';

export type UserStatus = 'Active' | 'Invited' | 'Inactive';

export const ISSUE_TYPES = [
  'Bug',
  'Feature Request',
  'Task',
  'Improvement',
  'UI/UX',
  'Performance',
  'Security',
  'Documentation',
  'Research / Spike',
  'Maintenance',
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];
export type IssuePriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type IssueStatus = 'To Do' | 'In Progress' | 'Done';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  title?: string;
  avatar?: string;
  avatarColor?: string;
  status: UserStatus;
  notificationPrefs?: {
    issueAssigned: boolean;
    statusChanged: boolean;
    comments: boolean;
    weeklyDigest: boolean;
  };
  appearancePrefs?: {
    theme: 'light' | 'dark';
    density: 'compact' | 'comfortable';
  };
  assignedCount?: number;
  openAssignedCount?: number;
  projects?: Array<{ _id: string; name: string; key: string; projectRole?: ProjectRole }>;
  createdAt: string;
}

export interface ProjectStats {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  open: number;
  progress: number;
}

export interface ProjectMembershipItem {
  _id?: string;
  user: User;
  role: ProjectRole;
  membershipStatus: 'Active' | 'Removed';
  joinedAt: string;
}

export interface Project {
  _id: string;
  name: string;
  key: string;
  description: string;
  owner: User;
  lead: User;
  members: User[];
  memberships?: ProjectMembershipItem[];
  myProjectRole?: ProjectRole | null;
  issueCounter: number;
  status: 'Active' | 'Archived';
  stats?: ProjectStats;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  _id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface BugDetails {
  stepsToReproduce?: string;
  expectedResult?: string;
  actualResult?: string;
  environment?: string;
}

export interface FeatureDetails {
  featureDescription?: string;
  reasonForRequest?: string;
  expectedOutcome?: string;
}

export interface Issue {
  _id: string;
  issueKey: string;
  title: string;
  description: string;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  position: number;
  assignee: User | null;
  reporter: User;
  project: { _id: string; name: string; key: string };
  dueDate: string | null;
  labels?: string[];
  bugDetails?: BugDetails;
  featureDetails?: FeatureDetails;
  attachments: Attachment[];
  commentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  _id: string;
  issue: string;
  user: User;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export type ActivityAction =
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'ISSUE_CREATED'
  | 'ISSUE_ASSIGNED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_UPDATED'
  | 'COMMENT_ADDED'
  | 'ISSUE_UPDATED'
  | 'ISSUE_DELETED'
  | 'MEMBER_INVITED'
  | 'MEMBER_ROLE_UPDATED'
  | 'MEMBER_REMOVED'
  | 'INVITATION_CREATED'
  | 'INVITATION_ACCEPTED'
  | 'INVITATION_REJECTED'
  | 'INVITATION_REVOKED';

export interface Activity {
  _id: string;
  user: User;
  project: { _id: string; name: string; key: string } | null;
  issue: { _id: string; issueKey: string; title: string; status?: IssueStatus } | null;
  issueKey: string | null;
  action: ActivityAction;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Workspace {
  _id: string;
  name: string;
  slug: string;
  description: string;
  defaultIssuePriority: IssuePriority;
}

export type InvitationStatus =
  | 'Pending'
  | 'Accepted'
  | 'Rejected'
  | 'Expired'
  | 'Revoked';

export interface Invitation {
  _id: string;
  email: string;
  role: UserRole;
  project: { _id: string; name: string; key: string; description?: string } | null;
  workspaceName: string;
  message: string;
  status: InvitationStatus;
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

export interface InvitationCreateResult {
  invitation: Invitation;
  inviteToken: string;
  invitePath: string;
  inviteUrl?: string;
}

export interface InvitationValidation {
  valid: boolean;
  status: InvitationStatus | 'Invalid';
  reason?: string;
  invitation?: {
    _id: string;
    email: string;
    role: UserRole;
    project: { _id: string; name: string; key: string; description?: string } | null;
    workspaceName: string;
    message: string;
    invitedByName: string;
    expiresAt: string;
    createdAt: string;
  };
}

export interface DashboardData {
  stats: {
    totalIssues: number;
    openIssues: number;
    inProgressIssues: number;
    resolvedIssues: number;
    myAssignedIssues: number;
    overdueIssues: number;
  };
  issuesByPriority: Array<{ priority: IssuePriority; count: number }>;
  issuesByType: Array<{ type: IssueType; count: number }>;
  projectProgress: Array<{
    _id: string;
    name: string;
    key: string;
    lead: User;
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    percentage: number;
  }>;
  myAssignedList: Issue[];
  overdueList: Issue[];
  recentActivities: Activity[];
}
