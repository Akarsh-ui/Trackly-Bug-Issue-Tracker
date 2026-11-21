import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  ArrowRight,
  Check,
  FolderPlus,
  MailCheck,
  Plus,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import type { DashboardData, Invitation, IssuePriority } from '../types';
import { formatDate, formatRelativeTime, formatShortDate } from '../utils/formatters';
import { Avatar } from '../components/Avatar';
import { PriorityBadge, StatusBadge } from '../components/IssueBadges';
import { ProjectModal } from '../components/ProjectModal';

const PRIORITY_CHART_COLORS: Record<IssuePriority, string> = {
  Urgent: '#B3473B',
  High: '#C47D2B',
  Medium: '#C56A45',
  Low: '#78756F',
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, updateUserLocal } = useAuth();
  const {
    projects,
    pendingInvitations,
    pendingInvitationsError,
    refreshPendingInvitations,
    refreshProjects,
    refreshMembers,
    openIssue,
    openCreateIssue,
    dataVersion,
    notifyDataChanged,
  } = useWorkspace();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    setSelectedProjectId('all');
    setData(null);
    setError('');
    hasLoadedRef.current = false;
  }, [user?._id]);

  useEffect(() => {
    if (
      selectedProjectId !== 'all' &&
      !projects.some((p) => p._id === selectedProjectId)
    ) {
      setSelectedProjectId('all');
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (!user?._id) return;
    let cancelled = false;
    if (!hasLoadedRef.current) {
      setLoading(true);
    }
    setError('');
    api.dashboard
      .get(selectedProjectId)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          hasLoadedRef.current = true;
        }
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, dataVersion, user?._id]);

  const handleDashboardAcceptInvite = async (inv: Invitation) => {
    if (inviteBusyId) return;
    try {
      setInviteBusyId(inv._id);
      const res = await api.invitations.acceptById(inv._id);
      if (res.user) updateUserLocal(res.user);
      await Promise.all([
        refreshPendingInvitations(),
        refreshProjects(),
        refreshMembers(),
      ]);
      notifyDataChanged();
      toast.success(
        inv.project ? `Joined ${inv.project.name}` : 'Invitation accepted'
      );
      if (res.projectId) {
        navigate(`/projects/${res.projectId}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to accept invitation');
    } finally {
      setInviteBusyId(null);
    }
  };

  const handleDashboardRejectInvite = async (inv: Invitation) => {
    if (inviteBusyId) return;
    try {
      setInviteBusyId(inv._id);
      await api.invitations.rejectById(inv._id);
      await refreshPendingInvitations();
      notifyDataChanged();
      toast.success('Invitation declined');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to decline invitation');
    } finally {
      setInviteBusyId(null);
    }
  };

  const metrics = data
    ? [
        { label: 'Total Issues', value: data.stats.totalIssues, alert: false },
        { label: 'Open (To Do)', value: data.stats.openIssues, alert: false },
        { label: 'In Progress', value: data.stats.inProgressIssues, alert: false },
        { label: 'Resolved', value: data.stats.resolvedIssues, alert: false },
        { label: 'My Assigned', value: data.stats.myAssignedIssues, alert: false },
        {
          label: 'Overdue',
          value: data.stats.overdueIssues ?? 0,
          alert: (data.stats.overdueIssues ?? 0) > 0,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#1F1F1E] dark:text-[#F3F0EE]">
            Welcome, {user?.name.split(' ')[0]}
          </h1>
          <p className="text-[13px] text-[#6B6964] dark:text-[#A8A49B]">
            Workspace issue distribution, active progress, and recent team updates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <select
            aria-label="Filter dashboard by project"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="h-8 px-2.5 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#201F1D] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none focus:border-[#C56A45]"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.key} — {p.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() =>
              projects.length === 0
                ? setProjectModalOpen(true)
                : openCreateIssue(
                    selectedProjectId !== 'all'
                      ? { projectId: selectedProjectId }
                      : {}
                  )
            }
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#201F1D] text-[#1F1F1E] dark:text-[#F3F0EE] hover:bg-[#F4F3EE] dark:hover:bg-[#2A2926] whitespace-nowrap shrink-0"
          >
            {projects.length === 0 ? (
              <>
                <FolderPlus className="w-3.5 h-3.5 text-[#C56A45]" />
                <span>Create Project</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 text-[#C56A45]" />
                <span>Create Issue</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded border border-[#B3473B]/30 bg-[#FBEAE8] text-xs text-[#B3473B]">
          {error}
        </div>
      )}

      {pendingInvitationsError && (
        <div className="p-3 rounded border border-[#B3473B]/30 bg-[#FBEAE8] dark:bg-[#361E1C] text-xs text-[#B3473B] dark:text-[#EB8B80] flex items-center justify-between gap-2">
          <span>{pendingInvitationsError}</span>
          <button
            type="button"
            onClick={() => refreshPendingInvitations()}
            className="underline font-medium cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {pendingInvitations.length > 0 && (
        <section className="rounded-lg border border-[#C56A45]/40 bg-[#FDF7F4] dark:bg-[#261E1A] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#E4E2DC] dark:border-[#3A302B] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MailCheck className="w-4 h-4 text-[#C56A45]" />
              <h2 className="text-[13px] font-semibold text-[#1F1F1E] dark:text-[#F3F0EE]">
                Pending Project {pendingInvitations.length === 1 ? 'Invitation' : 'Invitations'} ({pendingInvitations.length})
              </h2>
            </div>
            <Link
              to="/invitations"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#C56A45] hover:underline"
            >
              <span>Review all</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-[#E4E2DC] dark:divide-[#3A302B]">
            {pendingInvitations.slice(0, 3).map((inv) => (
              <div
                key={inv._id}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {inv.project && (
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-white dark:bg-[#201F1D] border border-[#E4E2DC] dark:border-[#3A3835]">
                        {inv.project.key}
                      </span>
                    )}
                    <span className="font-semibold text-[#1F1F1E] dark:text-[#F3F0EE]">
                      {inv.project?.name || inv.workspaceName}
                    </span>
                    <span className="text-[#C56A45] font-medium">
                      as {inv.role}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-[#6B6964] dark:text-[#A8A49B]">
                    Invited by {inv.invitedBy?.name} · Expires {formatDate(inv.expiresAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={Boolean(inviteBusyId)}
                    onClick={() => handleDashboardRejectInvite(inv)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-[#DCD9D0] dark:border-[#3A3835] bg-white dark:bg-[#201F1D] text-[#6B6964] hover:text-[#B3473B] hover:border-[#B3473B] disabled:opacity-50 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(inviteBusyId)}
                    onClick={() => handleDashboardAcceptInvite(inv)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6-Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-[#E4E2DC] dark:border-[#2E2D2A] rounded-lg bg-white dark:bg-[#201F1D] divide-y sm:divide-y-0 sm:divide-x divide-[#E4E2DC] dark:divide-[#2E2D2A] overflow-hidden">
        {loading
          ? Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="p-4 animate-pulse space-y-2">
                <div className="h-3 w-20 bg-[#E4E2DC] dark:bg-[#2E2D2A] rounded" />
                <div className="h-7 w-12 bg-[#F0EFEA] dark:bg-[#252422] rounded" />
              </div>
            ))
          : metrics.map((m) => (
              <div key={m.label} className="p-4">
                <div
                  className={`text-xs ${
                    m.alert
                      ? 'text-[#B3473B] dark:text-[#EB8B80] font-medium'
                      : 'text-[#6B6964] dark:text-[#A8A49B]'
                  }`}
                >
                  {m.label}
                </div>
                <div
                  className={`mt-1 text-2xl font-semibold font-mono tabular-nums ${
                    m.alert
                      ? 'text-[#B3473B] dark:text-[#EB8B80]'
                      : 'text-[#1F1F1E] dark:text-[#F3F0EE]'
                  }`}
                >
                  {m.value}
                </div>
              </div>
            ))}
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 cols: My Assigned Issues + Project Progress */}
        <div className="lg:col-span-7 space-y-5">
          {/* My Assigned Issues */}
          <section className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E2DC] dark:border-[#2E2D2A]">
              <h2 className="text-[14px] font-semibold text-[#1F1F1E] dark:text-[#F3F0EE]">
                My Assigned Issues
              </h2>
              <Link
                to="/issues?assignee=me"
                className="inline-flex items-center gap-1 text-xs text-[#6B6964] hover:text-[#C56A45]"
              >
                <span>View all</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {loading ? (
              <div className="p-4 space-y-2.5 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-8 bg-[#F4F3EE] dark:bg-[#252422] rounded"
                  />
                ))}
              </div>
            ) : !data || data.myAssignedList.length === 0 ? (
              <div className="p-8 text-center space-y-2.5">
                <p className="text-xs text-[#6B6964] dark:text-[#A8A49B]">
                  No open issues are currently assigned to you.
                </p>
                {projects.length > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      openCreateIssue(
                        selectedProjectId !== 'all'
                          ? { projectId: selectedProjectId }
                          : {}
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-[#FAFAF8] dark:bg-[#252422] text-[#1F1F1E] dark:text-[#F3F0EE] hover:border-[#C56A45]"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#C56A45]" />
                    <span>Create your first issue</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setProjectModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Create your first project</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A]">
                {data.myAssignedList.map((issue) => (
                  <button
                    key={issue._id}
                    type="button"
                    onClick={() => openIssue(issue._id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-[#F4F3EE] dark:hover:bg-[#252422] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-[11px] text-[#6B6964] dark:text-[#A8A49B] shrink-0 w-20">
                        {issue.issueKey}
                      </span>
                      <span className="text-[13px] font-medium text-[#1F1F1E] dark:text-[#F3F0EE] truncate">
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
          </section>

          {/* Overdue Issues (shown when overdue issues exist) */}
          {data && data.overdueList && data.overdueList.length > 0 && (
            <section className="rounded-lg border border-[#B3473B]/35 bg-white dark:bg-[#201F1D] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#B3473B]/20 bg-[#FBEAE8]/50 dark:bg-[#361E1C]/40">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#B3473B] dark:text-[#EB8B80]" />
                  <h2 className="text-[14px] font-semibold text-[#B3473B] dark:text-[#EB8B80]">
                    Overdue Issues ({data.stats.overdueIssues})
                  </h2>
                </div>
                <Link
                  to="/issues?sortBy=dueDate&sortOrder=asc"
                  className="inline-flex items-center gap-1 text-xs text-[#B3473B] dark:text-[#EB8B80] hover:underline"
                >
                  <span>Sort by due date</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A]">
                {data.overdueList.map((issue) => (
                  <button
                    key={issue._id}
                    type="button"
                    onClick={() => openIssue(issue._id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-[#F4F3EE] dark:hover:bg-[#252422] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-[11px] text-[#6B6964] dark:text-[#A8A49B] shrink-0 w-20">
                        {issue.issueKey}
                      </span>
                      <span className="text-[13px] font-medium text-[#1F1F1E] dark:text-[#F3F0EE] truncate">
                        {issue.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {issue.dueDate && (
                        <span className="font-mono text-[11px] text-[#B3473B] dark:text-[#EB8B80]">
                          Due {formatShortDate(issue.dueDate)}
                        </span>
                      )}
                      <PriorityBadge priority={issue.priority} />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Project Progress */}
          <section className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E2DC] dark:border-[#2E2D2A]">
              <h2 className="text-[14px] font-semibold text-[#1F1F1E] dark:text-[#F3F0EE]">
                Project Progress
              </h2>
              <Link
                to="/projects"
                className="inline-flex items-center gap-1 text-xs text-[#6B6964] hover:text-[#C56A45]"
              >
                <span>All projects</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {loading ? (
              <div className="p-4 space-y-3 animate-pulse">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 bg-[#F4F3EE] dark:bg-[#252422] rounded"
                  />
                ))}
              </div>
            ) : !data || data.projectProgress.length === 0 ? (
              <div className="p-8 text-center space-y-2.5">
                <p className="text-xs text-[#6B6964] dark:text-[#A8A49B]">
                  No projects created in this workspace yet.
                </p>
                <button
                  type="button"
                  onClick={() => setProjectModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Create your first project</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A]">
                {data.projectProgress.map((proj) => (
                  <Link
                    key={proj._id}
                    to={`/projects/${proj._id}`}
                    className="block px-4 py-3 hover:bg-[#F4F3EE] dark:hover:bg-[#252422] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[11px] font-medium px-1.5 py-0.5 rounded bg-[#F0EFEA] dark:bg-[#2A2926] text-[#6B6964] dark:text-[#A8A49B]">
                          {proj.key}
                        </span>
                        <span className="text-[13px] font-medium text-[#1F1F1E] dark:text-[#F3F0EE] truncate">
                          {proj.name}
                        </span>
                      </div>
                      <span className="font-mono text-xs tabular-nums text-[#6B6964] dark:text-[#A8A49B] shrink-0">
                        {proj.done}/{proj.total} resolved · {proj.percentage}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-sm bg-[#EFECE6] dark:bg-[#2A2926] overflow-hidden">
                      <div
                        className="h-full bg-[#557A59] transition-all duration-300"
                        style={{ width: `${proj.percentage}%` }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right 5 cols: Issues by Priority Chart + Recent Team Activity */}
        <div className="lg:col-span-5 space-y-5">
          {/* Issues by Priority */}
          <section className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-semibold text-[#1F1F1E] dark:text-[#F3F0EE]">
                Issues by Priority
              </h2>
              <span className="text-xs font-mono text-[#8C8983] tabular-nums">
                {data?.stats.totalIssues ?? 0} total
              </span>
            </div>

            {!data || data.stats.totalIssues === 0 ? (
              <div className="h-[190px] flex items-center justify-center text-center px-4">
                <p className="text-xs text-[#8C8983]">
                  Priority distribution appears automatically once issues are logged.
                </p>
              </div>
            ) : (
              <div className="h-[190px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.issuesByPriority}
                    margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="priority"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6B6964', fontSize: 12 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#8C8983', fontSize: 11 }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(197, 106, 69, 0.08)' }}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#DCD9D0',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#1F1F1E',
                      }}
                    />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={42}>
                      {data.issuesByPriority.map((entry) => (
                        <Cell
                          key={entry.priority}
                          fill={PRIORITY_CHART_COLORS[entry.priority]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Recent Team Activity */}
          <section className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E2DC] dark:border-[#2E2D2A]">
              <h2 className="text-[14px] font-semibold text-[#1F1F1E] dark:text-[#F3F0EE]">
                Recent Team Activity
              </h2>
              <Link
                to="/activity"
                className="inline-flex items-center gap-1 text-xs text-[#6B6964] hover:text-[#C56A45]"
              >
                <span>Timeline</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {loading ? (
              <div className="p-4 space-y-3 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-8 bg-[#F4F3EE] dark:bg-[#252422] rounded"
                  />
                ))}
              </div>
            ) : !data || data.recentActivities.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#8C8983]">
                No recent activity yet. Updates will appear here as your team works.
              </div>
            ) : (
              <div className="divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A]">
                {data.recentActivities.slice(0, 8).map((act) => (
                  <div
                    key={act._id}
                    className="px-4 py-2.5 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Avatar
                        name={act.user?.name}
                        color={act.user?.avatarColor}
                        size="xs"
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <p className="text-[#1F1F1E] dark:text-[#E5E2DC] leading-snug">
                          <span className="font-medium">{act.user?.name}</span>{' '}
                          <span className="text-[#6B6964] dark:text-[#A8A49B]">
                            {act.description}
                          </span>
                        </p>
                        {act.issue?._id && (
                          <button
                            type="button"
                            onClick={() => openIssue(act.issue!._id)}
                            className="mt-0.5 font-mono text-[11px] text-[#C56A45] hover:underline"
                          >
                            Open {act.issue.issueKey}
                          </button>
                        )}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-[#8C8983] shrink-0">
                      {formatRelativeTime(act.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <ProjectModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
      />
    </div>
  );
}
