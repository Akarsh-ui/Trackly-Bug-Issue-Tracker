import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2, UserPlus, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import type { Activity, Issue, IssueStatus, Project, ProjectRole } from '../types';
import { formatRelativeTime, formatShortDate } from '../utils/formatters';
import { Avatar } from '../components/Avatar';
import { PriorityBadge, StatusBadge, TypeIndicator } from '../components/IssueBadges';
import { KanbanBoard } from '../components/KanbanBoard';
import { ConfirmDialog } from '../components/ConfirmDialog';

type ProjectTab = 'overview' | 'issues' | 'board' | 'activity' | 'settings';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    members: allMembers,
    openIssue,
    openCreateIssue,
    refreshProjects,
    dataVersion,
    notifyDataChanged,
  } = useWorkspace();

  const [tab, setTab] = useState<ProjectTab>('overview');
  const [project, setProject] = useState<Project | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Settings form state
  const [editName, setEditName] = useState('');
  const [editKey, setEditKey] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLead, setEditLead] = useState('');
  const [editMembers, setEditMembers] = useState<string[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadWorkspace = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const [projRes, issuesRes, actRes] = await Promise.all([
        api.projects.get(id),
        api.issues.list({ project: id }),
        api.activities.list({ project: id, limit: 40 }),
      ]);
      setProject(projRes.project);
      setIssues(issuesRes.issues);
      setActivities(actRes.activities);

      setEditName(projRes.project.name);
      setEditKey(projRes.project.key);
      setEditDescription(projRes.project.description || '');
      setEditLead(projRes.project.lead?._id || '');
      setEditMembers(projRes.project.members.map((m) => m._id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load project');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace, dataVersion]);

  const handleMoveIssue = async (
    issueId: string,
    nextStatus: IssueStatus,
    targetPosition?: number
  ) => {
    if (project?.myProjectRole === 'Viewer') {
      toast.error('Viewers have read-only access and cannot move issues');
      return;
    }
    const previous = issues;
    setIssues((curr) =>
      curr.map((i) =>
        i._id === issueId
          ? { ...i, status: nextStatus, position: targetPosition ?? i.position }
          : i
      )
    );
    try {
      await api.issues.updateStatus(issueId, nextStatus, targetPosition);
      toast.success(`Moved issue to ${nextStatus}`);
      await refreshProjects();
      notifyDataChanged();
    } catch (err) {
      setIssues(previous);
      toast.error(err instanceof Error ? err.message : 'Failed to move issue');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    const trimmedName = editName.trim();
    const upperKey = editKey.trim().toUpperCase();
    if (trimmedName.length < 2) {
      toast.error('Project name must be at least 2 characters');
      return;
    }
    if (!/^[A-Z0-9]{2,10}$/.test(upperKey)) {
      toast.error('Project key must be 2 to 10 letters or numbers');
      return;
    }

    try {
      setSavingSettings(true);
      const { project: updated } = await api.projects.update(project._id, {
        name: trimmedName,
        key: upperKey,
        description: editDescription,
        lead: editLead,
        members: editMembers,
      });
      setProject((prev) => (prev ? { ...updated, stats: prev.stats } : updated));
      await refreshProjects();
      notifyDataChanged();
      toast.success('Project settings updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    try {
      setDeleting(true);
      await api.projects.delete(project._id);
      toast.success(`Deleted ${project.name}`);
      await refreshProjects();
      notifyDataChanged();
      navigate('/projects');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, nextRole: ProjectRole) => {
    if (!project) return;
    try {
      setUpdatingMemberId(memberId);
      const { project: updated } = await api.projects.updateMemberRole(
        project._id,
        memberId,
        nextRole
      );
      setProject((prev) => (prev ? { ...updated, stats: prev.stats } : updated));
      await refreshProjects();
      notifyDataChanged();
      toast.success(`Updated member role to ${nextRole}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update member role');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!project) return;
    try {
      setUpdatingMemberId(memberId);
      const { project: updated } = await api.projects.removeMember(
        project._id,
        memberId
      );
      setProject((prev) => (prev ? { ...updated, stats: prev.stats } : updated));
      setEditMembers(updated.members.map((m) => m._id));
      await refreshProjects();
      notifyDataChanged();
      toast.success(`Removed ${memberName} from ${project.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  if (loading && !project) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-[#E4E2DC] dark:bg-[#2E2D2A] rounded" />
        <div className="h-48 w-full bg-white dark:bg-[#201F1D] rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A]" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-8 text-center rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] text-xs text-[#B3473B]">
        {error || 'Project not found'}
      </div>
    );
  }

  const myRole: ProjectRole =
    project.myProjectRole ||
    (project.owner?._id === user?._id
      ? 'Owner'
      : project.lead?._id === user?._id
      ? 'Admin'
      : 'Member');
  const isViewer = myRole === 'Viewer';
  const canWriteIssues = myRole !== 'Viewer';
  const canEditProject = myRole === 'Owner' || myRole === 'Admin';
  const canDeleteProject = myRole === 'Owner';

  const memberEntries =
    project.memberships && project.memberships.length > 0
      ? project.memberships.filter((m) => m.membershipStatus === 'Active')
      : project.members.map((m) => ({
          user: m,
          role: (project.owner?._id === m._id
            ? 'Owner'
            : project.lead?._id === m._id
            ? 'Admin'
            : 'Member') as ProjectRole,
          membershipStatus: 'Active' as const,
          joinedAt: project.createdAt,
        }));

  const availableDirectoryMembers = Array.from(
    new Map(
      [...project.members, ...allMembers].map((m) => [m._id, m])
    ).values()
  );

  const stats = project.stats || {
    total: issues.length,
    todo: 0,
    inProgress: 0,
    done: 0,
    open: 0,
    progress: 0,
  };

  const tabs: Array<{ id: ProjectTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'issues', label: `Issues (${issues.length})` },
    { id: 'board', label: 'Kanban Board' },
    { id: 'activity', label: 'Activity' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="space-y-5">
      {/* Project Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-xs font-medium px-2 py-0.5 rounded bg-[#F0EFEA] dark:bg-[#2A2926] text-[#6B6964] dark:text-[#A8A49B] border border-[#E4E2DC] dark:border-[#3A3835]">
              {project.key}
            </span>
            <h1 className="text-[22px] font-semibold tracking-tight text-[#1F1F1E] dark:text-[#F3F0EE]">
              {project.name}
            </h1>
            <span className="font-mono text-[10.5px] px-2 py-0.5 rounded border border-[#E4E2DC] dark:border-[#34322E] bg-[#FAFAF8] dark:bg-[#191816] text-[#6B6964] dark:text-[#A8A49B]">
              {myRole}
            </span>
          </div>
          {project.description && (
            <p className="mt-1 text-[13px] text-[#6B6964] dark:text-[#A8A49B] max-w-2xl">
              {project.description}
            </p>
          )}
        </div>

        {canWriteIssues ? (
          <button
            type="button"
            onClick={() => openCreateIssue({ projectId: project._id })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white transition-colors whitespace-nowrap shrink-0 self-start"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New {project.key} Issue</span>
          </button>
        ) : (
          <span className="inline-flex items-center px-3 py-1.5 text-xs font-mono rounded border border-[#E4E2DC] dark:border-[#34322E] bg-[#FAFAF8] dark:bg-[#191816] text-[#6B6964] dark:text-[#A8A49B] self-start">
            Read-only access
          </span>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-5 border-b border-[#E4E2DC] dark:border-[#2E2D2A] overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`pb-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              tab === t.id
                ? 'border-[#C56A45] text-[#1F1F1E] dark:text-[#F3F0EE]'
                : 'border-transparent text-[#6B6964] dark:text-[#A8A49B] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 border border-[#E4E2DC] dark:border-[#2E2D2A] rounded-lg bg-white dark:bg-[#201F1D] divide-y sm:divide-y-0 sm:divide-x divide-[#E4E2DC] dark:divide-[#2E2D2A]">
            <div className="p-4">
              <div className="text-xs text-[#6B6964] dark:text-[#A8A49B]">Total Issues</div>
              <div className="mt-1 text-2xl font-semibold font-mono tabular-nums">
                {stats.total}
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-[#6B6964] dark:text-[#A8A49B]">To Do</div>
              <div className="mt-1 text-2xl font-semibold font-mono tabular-nums">
                {stats.todo}
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-[#6B6964] dark:text-[#A8A49B]">In Progress</div>
              <div className="mt-1 text-2xl font-semibold font-mono tabular-nums">
                {stats.inProgress}
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-[#6B6964] dark:text-[#A8A49B]">Completion</div>
              <div className="mt-1 text-2xl font-semibold font-mono tabular-nums">
                {stats.progress}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E4E2DC] dark:border-[#2E2D2A] flex items-center justify-between">
                <h2 className="text-[14px] font-semibold">Recent Issues</h2>
                <button
                  type="button"
                  onClick={() => setTab('issues')}
                  className="text-xs text-[#6B6964] hover:text-[#C56A45]"
                >
                  View all
                </button>
              </div>
              {issues.length === 0 ? (
                <div className="p-8 text-center space-y-2.5">
                  <p className="text-xs text-[#8C8983]">
                    No issues reported for {project.name} yet.
                  </p>
                  {canWriteIssues && (
                    <button
                      type="button"
                      onClick={() => openCreateIssue({ projectId: project._id })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create your first issue</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A]">
                  {issues.slice(0, 6).map((issue) => (
                    <button
                      key={issue._id}
                      type="button"
                      onClick={() => openIssue(issue._id)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-[#F4F3EE] dark:hover:bg-[#252422] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-[11px] text-[#6B6964] shrink-0 w-20">
                          {issue.issueKey}
                        </span>
                        <span className="text-[13px] font-medium truncate">
                          {issue.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <PriorityBadge priority={issue.priority} />
                        <StatusBadge status={issue.status} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E4E2DC] dark:border-[#2E2D2A] flex items-center justify-between gap-2">
                <h2 className="text-[14px] font-semibold">
                  Project Members ({memberEntries.length})
                </h2>
                {canEditProject && (
                  <Link
                    to="/team"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#C56A45] hover:underline"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Invite</span>
                  </Link>
                )}
              </div>
              <div className="divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A]">
                {memberEntries.map((entry) => {
                  const m = entry.user;
                  const memberRole = entry.role;
                  const isSelf = m._id === user?._id;
                  const isOwnerEntry =
                    memberRole === 'Owner' || project.owner?._id === m._id;
                  const canManageEntry =
                    canEditProject &&
                    !isSelf &&
                    !isOwnerEntry &&
                    (myRole === 'Owner' || memberRole !== 'Admin');

                  return (
                    <div
                      key={m._id}
                      className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          name={m.name}
                          color={m.avatarColor}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="font-medium truncate flex items-center gap-1.5">
                            <span className="truncate">{m.name}</span>
                            {project.lead?._id === m._id && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#FCF3E6] dark:bg-[#332719] text-[#B8681C] dark:text-[#E5A95E] shrink-0">
                                LEAD
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#6B6964] dark:text-[#A8A49B] truncate">
                            {m.email}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {canManageEntry ? (
                          <>
                            <select
                              aria-label={`Project role for ${m.name}`}
                              value={memberRole}
                              disabled={updatingMemberId === m._id}
                              onChange={(e) =>
                                handleUpdateMemberRole(
                                  m._id,
                                  e.target.value as ProjectRole
                                )
                              }
                              className="h-7 px-1.5 text-[11px] font-mono rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-[#FAFAF8] dark:bg-[#181817]"
                            >
                              {myRole === 'Owner' && (
                                <option value="Admin">Admin</option>
                              )}
                              <option value="Member">Member</option>
                              <option value="Viewer">Viewer</option>
                            </select>
                            <button
                              type="button"
                              disabled={updatingMemberId === m._id}
                              onClick={() => handleRemoveMember(m._id, m.name)}
                              title={`Remove ${m.name} from project`}
                              className="p-1 rounded text-[#8C8983] hover:text-[#B3473B] hover:bg-[#FBEAE8] dark:hover:bg-[#361E1C] disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-[#F0EFEA] dark:bg-[#2A2926] text-[#6B6964] dark:text-[#A8A49B]">
                            {memberRole}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'issues' && (
        <div className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] overflow-x-auto">
          {issues.length === 0 ? (
            <div className="p-10 text-center space-y-2.5">
              <p className="text-xs text-[#8C8983]">No issues in {project.name} yet.</p>
              {canWriteIssues && (
                <button
                  type="button"
                  onClick={() => openCreateIssue({ projectId: project._id })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create your first issue</span>
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="border-b border-[#E4E2DC] dark:border-[#2E2D2A] bg-[#FAFAF8] dark:bg-[#1A1918] text-[11px] font-mono uppercase tracking-wider text-[#6B6964] dark:text-[#A8A49B]">
                  <th className="py-2.5 px-4 font-medium">Key</th>
                  <th className="py-2.5 px-4 font-medium">Title</th>
                  <th className="py-2.5 px-4 font-medium">Type</th>
                  <th className="py-2.5 px-4 font-medium">Priority</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">Assignee</th>
                  <th className="py-2.5 px-4 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A] text-[13px]">
                {issues.map((issue) => (
                  <tr
                    key={issue._id}
                    onClick={() => openIssue(issue._id)}
                    className="hover:bg-[#F4F3EE] dark:hover:bg-[#252422] cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-xs text-[#6B6964] dark:text-[#A8A49B] whitespace-nowrap">
                      {issue.issueKey}
                    </td>
                    <td className="py-2.5 px-4 font-medium max-w-md truncate">
                      {issue.title}
                    </td>
                    <td className="py-2.5 px-4">
                      <TypeIndicator type={issue.type} />
                    </td>
                    <td className="py-2.5 px-4">
                      <PriorityBadge priority={issue.priority} />
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusBadge status={issue.status} />
                    </td>
                    <td className="py-2.5 px-4">
                      {issue.assignee ? (
                        <div className="flex items-center gap-2">
                          <Avatar
                            name={issue.assignee.name}
                            color={issue.assignee.avatarColor}
                            size="xs"
                          />
                          <span className="text-xs">{issue.assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#8C8983]">Unassigned</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-[#6B6964] dark:text-[#A8A49B] whitespace-nowrap">
                      {formatShortDate(issue.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'board' && (
        <KanbanBoard
          issues={issues}
          onMoveIssue={handleMoveIssue}
          onOpenIssue={openIssue}
          readOnly={isViewer}
          onCreateInColumn={(status) =>
            openCreateIssue({ projectId: project._id, status })
          }
        />
      )}

      {tab === 'activity' && (
        <div className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A]">
          {activities.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8C8983]">
              No recent activity yet for this project.
            </div>
          ) : (
            activities.map((act) => (
              <div
                key={act._id}
                className="px-4 py-3 flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  <Avatar
                    name={act.user?.name}
                    color={act.user?.avatarColor}
                    size="xs"
                    className="mt-0.5"
                  />
                  <div>
                    <p>
                      <span className="font-medium">{act.user?.name}</span>{' '}
                      <span className="text-[#6B6964] dark:text-[#A8A49B]">
                        {act.description}
                      </span>
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-[#8C8983] shrink-0">
                  {formatRelativeTime(act.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'settings' && (
          <div className="max-w-2xl space-y-6">
            {!canEditProject && (
              <div className="rounded-lg border border-[#E4E2DC] dark:border-[#34322E] bg-[#FAFAF8] dark:bg-[#191816] px-4 py-3 text-xs text-[#6B6964] dark:text-[#A8A49B]">
                Only the project owner or a project admin can modify project settings.
              </div>
            )}

            <form
              onSubmit={handleSaveSettings}
              className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold">Project Details &amp; Members</h2>
                {canEditProject && (
                  <Link
                    to="/team"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#C56A45] hover:underline"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Invite Member</span>
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                    Project Name <span className="text-[#B3473B]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!canEditProject}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full h-9 px-3 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                    Key <span className="text-[#B3473B]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    disabled={!canEditProject}
                    value={editKey}
                    onChange={(e) => setEditKey(e.target.value.toUpperCase())}
                    className="w-full h-9 px-3 text-[13px] font-mono uppercase rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  disabled={!canEditProject}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full p-2.5 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                  Project Lead
                </label>
                <select
                  disabled={!canEditProject}
                  value={editLead}
                  onChange={(e) => {
                    const nextLead = e.target.value;
                    setEditLead(nextLead);
                    if (nextLead) {
                      setEditMembers((prev) =>
                        prev.includes(nextLead) ? prev : [...prev, nextLead]
                      );
                    }
                  }}
                  className="w-full h-9 px-2.5 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] disabled:opacity-60"
                >
                  {availableDirectoryMembers.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1.5">
                  Team Members ({editMembers.length})
                </label>
                <div className="max-h-44 overflow-y-auto border border-[#E4E2DC] dark:border-[#3A3835] rounded divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A] bg-[#FAFAF8] dark:bg-[#181817]">
                  {availableDirectoryMembers.map((m) => {
                    const isRequiredLead = m._id === editLead;
                    const isProjectOwner = m._id === project.owner?._id;
                    const membership = memberEntries.find((e) => e.user._id === m._id);
                    const isAdminLocked =
                      myRole === 'Admin' && membership?.role === 'Admin' && m._id !== user?._id;
                    const locked =
                      !canEditProject || isRequiredLead || isProjectOwner || isAdminLocked;
                    const checked = editMembers.includes(m._id) || isRequiredLead;
                    return (
                      <label
                        key={m._id}
                        className={`flex items-center justify-between px-3 py-2 text-[13px] ${
                          locked
                            ? 'opacity-80 cursor-default'
                            : 'cursor-pointer hover:bg-[#F4F3EE] dark:hover:bg-[#252422]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={locked}
                            onChange={() => {
                              if (locked) return;
                              setEditMembers((prev) =>
                                prev.includes(m._id)
                                  ? prev.filter((idItem) => idItem !== m._id)
                                  : [...prev, m._id]
                              );
                            }}
                            className="w-3.5 h-3.5 accent-[#C56A45]"
                          />
                          <span>{m.name}</span>
                          {isRequiredLead && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#FCF3E6] dark:bg-[#332719] text-[#B8681C] dark:text-[#E5A95E]">
                              LEAD
                            </span>
                          )}
                          {isProjectOwner && !isRequiredLead && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#F0EFEA] dark:bg-[#2A2926] text-[#6B6964] dark:text-[#A8A49B]">
                              OWNER
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-[#6B6964]">
                          {membership?.role || 'Collaborator'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {canEditProject && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-4 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white disabled:opacity-60"
                  >
                    {savingSettings ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              )}
            </form>

            {canDeleteProject && (
              <div className="rounded-lg border border-[#B3473B]/30 bg-[#FBEAE8]/50 dark:bg-[#361E1C]/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#B3473B] dark:text-[#EB8B80]">
                    Delete Project
                  </h3>
                  <p className="text-xs text-[#6B6964] dark:text-[#A8A49B] mt-0.5">
                    Permanently remove this project and all associated issues.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded bg-[#B3473B] hover:bg-[#99392E] text-white shrink-0 self-start sm:self-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Project</span>
                </button>
              </div>
            )}
          </div>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        title={`Delete ${project.name}?`}
        description="This action permanently removes the project and all of its issues, comments, and attachments."
        confirmLabel="Delete Project"
        loading={deleting}
        onConfirm={handleDeleteProject}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}
