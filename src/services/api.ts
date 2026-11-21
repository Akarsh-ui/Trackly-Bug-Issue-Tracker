import type {
  Activity,
  BugDetails,
  Comment,
  DashboardData,
  FeatureDetails,
  Invitation,
  InvitationCreateResult,
  InvitationValidation,
  Issue,
  IssuePriority,
  IssueStatus,
  IssueType,
  Project,
  ProjectRole,
  User,
  UserRole,
  UserStatus,
  Workspace,
} from '../types';
import { localStore } from './localStore';

const TOKEN_STORAGE_KEY = 'trackly_jwt_token';
export const USE_REMOTE_API =
  typeof import.meta !== 'undefined' &&
  import.meta.env?.VITE_USE_API === 'true';

export function getStoredToken(): string | null {
  try {
    return (
      sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
      localStorage.getItem(TOKEN_STORAGE_KEY)
    );
  } catch {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }
}

export function setStoredToken(token: string | null, remember = true): void {
  if (token) {
    if (remember) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      try {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      } catch {
        // ignore if sessionStorage is unavailable
      }
    } else {
      try {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      } catch {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      }
    }
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    try {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // ignore if sessionStorage is unavailable
    }
  }
}

async function runLocal<T>(fn: () => Promise<T>, allowUnauthorized = false): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const status = (err as Error & { status?: number })?.status;
    if (status === 401 && !allowUnauthorized) {
      setStoredToken(null);
      window.dispatchEvent(new CustomEvent('trackly:unauthorized'));
    }
    throw err;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (
      response.status === 401 &&
      !endpoint.startsWith('/auth/login') &&
      !endpoint.startsWith('/auth/register')
    ) {
      setStoredToken(null);
      window.dispatchEvent(new CustomEvent('trackly:unauthorized'));
    }
    const err = new Error(
      data.message || `Request failed (${response.status})`
    ) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  return data as T;
}

export const api = {
  auth: {
    login: (payload: { email: string; password: string }) =>
      USE_REMOTE_API
        ? request<{ token: string; user: User }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(payload),
          })
        : runLocal(() => localStore.auth.login(payload), true),

    register: (payload: {
      name: string;
      email: string;
      password: string;
      confirmPassword: string;
      inviteToken?: string;
    }) =>
      USE_REMOTE_API
        ? request<{ token: string; user: User }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(payload),
          })
        : runLocal(() => localStore.auth.register(payload), true),

    me: () =>
      USE_REMOTE_API
        ? request<{ user: User }>('/auth/me')
        : runLocal(() => localStore.auth.me(getStoredToken())),

    updateProfile: (payload: Partial<User>) =>
      USE_REMOTE_API
        ? request<{ user: User }>('/auth/profile', {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : runLocal(() => localStore.auth.updateProfile(getStoredToken(), payload)),

    changePassword: (payload: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }) =>
      USE_REMOTE_API
        ? request<{ message: string }>('/auth/password', {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : runLocal(() => localStore.auth.changePassword(getStoredToken(), payload)),
  },

  dashboard: {
    get: (projectId?: string) => {
      if (!USE_REMOTE_API) {
        return runLocal(() => localStore.dashboard.get(getStoredToken(), projectId));
      }
      const qs =
        projectId && projectId !== 'all'
          ? `?projectId=${encodeURIComponent(projectId)}`
          : '';
      return request<DashboardData>(`/dashboard${qs}`);
    },
  },

  projects: {
    list: () =>
      USE_REMOTE_API
        ? request<{ projects: Project[] }>('/projects')
        : runLocal(() => localStore.projects.list(getStoredToken())),

    get: (id: string) =>
      USE_REMOTE_API
        ? request<{ project: Project }>(`/projects/${id}`)
        : runLocal(() => localStore.projects.get(getStoredToken(), id)),

    create: (payload: {
      name: string;
      key: string;
      description?: string;
      lead?: string;
      members?: string[];
    }) =>
      USE_REMOTE_API
        ? request<{ project: Project }>('/projects', {
            method: 'POST',
            body: JSON.stringify(payload),
          })
        : runLocal(() => localStore.projects.create(getStoredToken(), payload)),

    update: (
      id: string,
      payload: {
        name?: string;
        key?: string;
        description?: string;
        lead?: string;
        members?: string[];
        status?: 'Active' | 'Archived';
      }
    ) =>
      USE_REMOTE_API
        ? request<{ project: Project }>(`/projects/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : runLocal(() => localStore.projects.update(getStoredToken(), id, payload)),

    delete: (id: string) =>
      USE_REMOTE_API
        ? request<{ message: string }>(`/projects/${id}`, {
            method: 'DELETE',
          })
        : runLocal(() => localStore.projects.delete(getStoredToken(), id)),

    updateMemberRole: (projectId: string, memberId: string, role: ProjectRole) =>
      USE_REMOTE_API
        ? request<{ project: Project }>(`/projects/${projectId}/members/${memberId}`, {
            method: 'PATCH',
            body: JSON.stringify({ role }),
          })
        : runLocal(() =>
            localStore.projects.updateMemberRole(getStoredToken(), projectId, memberId, role)
          ),

    removeMember: (projectId: string, memberId: string) =>
      USE_REMOTE_API
        ? request<{ project: Project }>(`/projects/${projectId}/members/${memberId}`, {
            method: 'DELETE',
          })
        : runLocal(() =>
            localStore.projects.removeMember(getStoredToken(), projectId, memberId)
          ),
  },

  issues: {
    list: (params?: {
      search?: string;
      status?: string;
      priority?: string;
      type?: string;
      assignee?: string;
      project?: string;
      sortBy?: string;
      sortOrder?: string;
    }) => {
      if (!USE_REMOTE_API) {
        return runLocal(() => localStore.issues.list(getStoredToken(), params));
      }
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v && v !== 'all') searchParams.set(k, v);
        });
      }
      const qs = searchParams.toString();
      return request<{ issues: Issue[] }>(`/issues${qs ? `?${qs}` : ''}`);
    },

    get: (id: string) =>
      USE_REMOTE_API
        ? request<{ issue: Issue; comments: Comment[]; activities: Activity[] }>(
            `/issues/${id}`
          )
        : runLocal(() => localStore.issues.get(getStoredToken(), id)),

    create: (payload: {
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
    }) => {
      if (!USE_REMOTE_API) {
        return runLocal(() => localStore.issues.create(getStoredToken(), payload));
      }
      const formData = new FormData();
      formData.append('title', payload.title);
      formData.append('description', payload.description || '');
      formData.append('type', payload.type);
      formData.append('priority', payload.priority);
      formData.append('status', payload.status);
      formData.append('project', payload.project);
      if (payload.assignee) formData.append('assignee', payload.assignee);
      if (payload.dueDate) formData.append('dueDate', payload.dueDate);
      if (payload.labels && payload.labels.length > 0) {
        formData.append('labels', JSON.stringify(payload.labels));
      }
      if (payload.bugDetails) {
        formData.append('bugDetails', JSON.stringify(payload.bugDetails));
      }
      if (payload.featureDetails) {
        formData.append('featureDetails', JSON.stringify(payload.featureDetails));
      }
      if (payload.attachmentFile) {
        formData.append('attachment', payload.attachmentFile);
      }

      return request<{ issue: Issue }>('/issues', {
        method: 'POST',
        body: formData,
      });
    },

    update: (
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
    ) =>
      USE_REMOTE_API
        ? request<{ issue: Issue }>(`/issues/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : runLocal(() => localStore.issues.update(getStoredToken(), id, payload)),

    updateStatus: (id: string, status: IssueStatus, position?: number) =>
      USE_REMOTE_API
        ? request<{ issue: Issue }>(`/issues/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status, position }),
          })
        : runLocal(() =>
            localStore.issues.updateStatus(getStoredToken(), id, status, position)
          ),

    delete: (id: string) =>
      USE_REMOTE_API
        ? request<{ message: string }>(`/issues/${id}`, {
            method: 'DELETE',
          })
        : runLocal(() => localStore.issues.delete(getStoredToken(), id)),

    uploadAttachment: (id: string, file: File) => {
      if (!USE_REMOTE_API) {
        return runLocal(() =>
          localStore.issues.uploadAttachment(getStoredToken(), id, file)
        );
      }
      const formData = new FormData();
      formData.append('file', file);
      return request<{ issue: Issue }>(`/issues/${id}/attachments`, {
        method: 'POST',
        body: formData,
      });
    },

    deleteAttachment: (id: string, attachmentId: string) =>
      USE_REMOTE_API
        ? request<{ issue: Issue }>(`/issues/${id}/attachments/${attachmentId}`, {
            method: 'DELETE',
          })
        : runLocal(() =>
            localStore.issues.deleteAttachment(getStoredToken(), id, attachmentId)
          ),
  },

  comments: {
    list: (issueId: string) =>
      USE_REMOTE_API
        ? request<{ comments: Comment[] }>(`/issues/${issueId}/comments`)
        : runLocal(() => localStore.comments.list(getStoredToken(), issueId)),

    create: (issueId: string, text: string) =>
      USE_REMOTE_API
        ? request<{ comment: Comment }>(`/issues/${issueId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ text }),
          })
        : runLocal(() =>
            localStore.comments.create(getStoredToken(), issueId, text)
          ),

    update: (commentId: string, text: string) =>
      USE_REMOTE_API
        ? request<{ comment: Comment }>(`/comments/${commentId}`, {
            method: 'PATCH',
            body: JSON.stringify({ text }),
          })
        : runLocal(() =>
            localStore.comments.update(getStoredToken(), commentId, text)
          ),

    delete: (commentId: string) =>
      USE_REMOTE_API
        ? request<{ message: string }>(`/comments/${commentId}`, {
            method: 'DELETE',
          })
        : runLocal(() => localStore.comments.delete(getStoredToken(), commentId)),
  },

  activities: {
    list: (params?: {
      project?: string;
      action?: string;
      user?: string;
      limit?: number;
    }) => {
      if (!USE_REMOTE_API) {
        return runLocal(() =>
          localStore.activities.list(getStoredToken(), params)
        );
      }
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== 'all') searchParams.set(k, String(v));
        });
      }
      const qs = searchParams.toString();
      return request<{ activities: Activity[] }>(
        `/activities${qs ? `?${qs}` : ''}`
      );
    },
  },

  users: {
    list: () =>
      USE_REMOTE_API
        ? request<{ users: User[] }>('/users')
        : runLocal(() => localStore.users.list(getStoredToken())),

    invite: (payload: {
      name: string;
      email: string;
      role: UserRole;
      title?: string;
      projectIds?: string[];
    }) =>
      USE_REMOTE_API
        ? request<{ user: User }>('/users/invite', {
            method: 'POST',
            body: JSON.stringify(payload),
          })
        : runLocal(() => localStore.users.invite(getStoredToken(), payload)),

    update: (
      id: string,
      payload: Partial<{
        name: string;
        role: UserRole;
        title: string;
        status: UserStatus;
      }>
    ) =>
      USE_REMOTE_API
        ? request<{ user: User }>(`/users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : runLocal(() => localStore.users.update(getStoredToken(), id, payload)),
  },

  invitations: {
    list: (projectId?: string) => {
      if (!USE_REMOTE_API) {
        return runLocal(() => localStore.invitations.list(getStoredToken(), projectId));
      }
      const qs =
        projectId && projectId !== 'all'
          ? `?projectId=${encodeURIComponent(projectId)}`
          : '';
      return request<{ invitations: Invitation[] }>(`/invitations${qs}`);
    },

    mine: () =>
      USE_REMOTE_API
        ? request<{ invitations: Invitation[] }>('/invitations/mine')
        : runLocal(() => localStore.invitations.mine(getStoredToken())),

    create: (payload: {
      email: string;
      role: UserRole;
      projectId?: string | null;
      message?: string;
    }) =>
      USE_REMOTE_API
        ? request<InvitationCreateResult>('/invitations', {
            method: 'POST',
            body: JSON.stringify(payload),
          })
        : runLocal(() => localStore.invitations.create(getStoredToken(), payload)),

    validate: (token: string) =>
      USE_REMOTE_API
        ? request<InvitationValidation>(
            `/invitations/validate/${encodeURIComponent(token)}`
          )
        : localStore.invitations.validate(token),

    accept: (token: string) =>
      USE_REMOTE_API
        ? request<{ message: string; projectId: string | null; user: User }>(
            `/invitations/${encodeURIComponent(token)}/accept`,
            { method: 'POST' }
          )
        : runLocal(() => localStore.invitations.accept(getStoredToken(), token)),

    acceptById: (id: string) =>
      USE_REMOTE_API
        ? request<{ message: string; projectId: string | null; user: User }>(
            `/invitations/mine/${encodeURIComponent(id)}/accept`,
            { method: 'POST' }
          )
        : runLocal(() => localStore.invitations.acceptById(getStoredToken(), id)),

    reject: (token: string) =>
      USE_REMOTE_API
        ? request<{ message: string; invitation: Invitation }>(
            `/invitations/${encodeURIComponent(token)}/reject`,
            { method: 'POST' }
          )
        : runLocal(() => localStore.invitations.reject(getStoredToken(), token)),

    rejectById: (id: string) =>
      USE_REMOTE_API
        ? request<{ message: string; invitation: Invitation }>(
            `/invitations/mine/${encodeURIComponent(id)}/reject`,
            { method: 'POST' }
          )
        : runLocal(() => localStore.invitations.rejectById(getStoredToken(), id)),

    resend: (id: string) =>
      USE_REMOTE_API
        ? request<InvitationCreateResult>(`/invitations/${id}/resend`, {
            method: 'POST',
          })
        : runLocal(() => localStore.invitations.resend(getStoredToken(), id)),

    revoke: (id: string) =>
      USE_REMOTE_API
        ? request<{ invitation: Invitation }>(`/invitations/${id}/revoke`, {
            method: 'POST',
          })
        : runLocal(() => localStore.invitations.revoke(getStoredToken(), id)),
  },

  workspace: {
    get: () =>
      USE_REMOTE_API
        ? request<{ workspace: Workspace }>('/workspace')
        : runLocal(() => localStore.workspace.get(getStoredToken())),

    update: (payload: Partial<Workspace>) =>
      USE_REMOTE_API
        ? request<{ workspace: Workspace }>('/workspace', {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : runLocal(() => localStore.workspace.update(getStoredToken(), payload)),
  },
};
