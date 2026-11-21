import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import type { Invitation, IssueStatus, Project, User, Workspace } from '../types';

interface CreateIssueDefaults {
  projectId?: string;
  status?: IssueStatus;
}

interface WorkspaceContextValue {
  workspace: Workspace | null;
  projects: Project[];
  members: User[];
  pendingInvitations: Invitation[];
  loadingPendingInvitations: boolean;
  pendingInvitationsError: string;
  loadingWorkspace: boolean;
  refreshProjects: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  refreshPendingInvitations: () => Promise<void>;
  activeIssueId: string | null;
  openIssue: (issueId: string) => void;
  closeIssue: () => void;
  createIssueOpen: boolean;
  createIssueDefaults: CreateIssueDefaults;
  openCreateIssue: (defaults?: CreateIssueDefaults) => void;
  closeCreateIssue: () => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dataVersion: number;
  notifyDataChanged: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [loadingPendingInvitations, setLoadingPendingInvitations] = useState(false);
  const [pendingInvitationsError, setPendingInvitationsError] = useState('');
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);

  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
  const [createIssueOpen, setCreateIssueOpen] = useState(false);
  const [createIssueDefaults, setCreateIssueDefaults] = useState<CreateIssueDefaults>({});
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  const notifyDataChanged = useCallback(() => {
    setDataVersion((v) => v + 1);
  }, []);

  const refreshProjects = useCallback(async () => {
    if (!isAuthenticated) return;
    const { projects: list } = await api.projects.list();
    setProjects(list);
  }, [isAuthenticated]);

  const refreshMembers = useCallback(async () => {
    if (!isAuthenticated) return;
    const { users } = await api.users.list();
    setMembers(users);
  }, [isAuthenticated]);

  const refreshWorkspace = useCallback(async () => {
    if (!isAuthenticated) return;
    const { workspace: ws } = await api.workspace.get();
    setWorkspace(ws);
  }, [isAuthenticated]);

  const refreshPendingInvitations = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoadingPendingInvitations(true);
      setPendingInvitationsError('');
      const { invitations } = await api.invitations.mine();
      setPendingInvitations(invitations);
    } catch (err) {
      setPendingInvitationsError(
        err instanceof Error ? err.message : 'Unable to load pending invitations.'
      );
    } finally {
      setLoadingPendingInvitations(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !user?._id) {
      setProjects([]);
      setMembers([]);
      setPendingInvitations([]);
      setPendingInvitationsError('');
      setLoadingPendingInvitations(false);
      setWorkspace(null);
      setActiveIssueId(null);
      setCreateIssueOpen(false);
      setCreateIssueDefaults({});
      setCommandPaletteOpen(false);
      return;
    }

    let cancelled = false;
    setProjects([]);
    setMembers([]);
    setPendingInvitations([]);
    setPendingInvitationsError('');
    setActiveIssueId(null);
    setLoadingWorkspace(true);

    Promise.all([
      refreshWorkspace(),
      refreshProjects(),
      refreshMembers(),
      refreshPendingInvitations(),
    ])
      .catch(() => {
        // Handled by individual pages / pendingInvitationsError
      })
      .finally(() => {
        if (!cancelled) setLoadingWorkspace(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    user?._id,
    refreshWorkspace,
    refreshProjects,
    refreshMembers,
    refreshPendingInvitations,
  ]);

  // Global Cmd+K / Ctrl+K command palette shortcut
  useEffect(() => {
    if (!isAuthenticated) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAuthenticated]);

  const openIssue = useCallback((issueId: string) => {
    setActiveIssueId(issueId);
  }, []);

  const closeIssue = useCallback(() => {
    setActiveIssueId(null);
  }, []);

  const openCreateIssue = useCallback((defaults: CreateIssueDefaults = {}) => {
    setCreateIssueDefaults(defaults);
    setCreateIssueOpen(true);
  }, []);

  const closeCreateIssue = useCallback(() => {
    setCreateIssueOpen(false);
    setCreateIssueDefaults({});
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        projects,
        members,
        pendingInvitations,
        loadingPendingInvitations,
        pendingInvitationsError,
        loadingWorkspace,
        refreshProjects,
        refreshMembers,
        refreshWorkspace,
        refreshPendingInvitations,
        activeIssueId,
        openIssue,
        closeIssue,
        createIssueOpen,
        createIssueDefaults,
        openCreateIssue,
        closeCreateIssue,
        commandPaletteOpen,
        setCommandPaletteOpen,
        dataVersion,
        notifyDataChanged,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return ctx;
}
