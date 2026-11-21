import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FolderPlus,
  LayoutList,
  MessageSquare,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Table2,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { ISSUE_TYPES, type Issue, type IssueStatus } from '../types';
import { formatRelativeTime, formatShortDate } from '../utils/formatters';
import { Avatar } from '../components/Avatar';
import { PriorityBadge, StatusBadge, TypeIndicator } from '../components/IssueBadges';

export function IssuesPage() {
  const { density } = useAuth();
  const {
    projects,
    members,
    openIssue,
    openCreateIssue,
    refreshProjects,
    notifyDataChanged,
    dataVersion,
  } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [priority, setPriority] = useState(searchParams.get('priority') || 'all');
  const [type, setType] = useState(searchParams.get('type') || 'all');
  const [assignee, setAssignee] = useState(searchParams.get('assignee') || 'all');
  const [project, setProject] = useState(searchParams.get('project') || 'all');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');
  const [viewMode, setViewMode] = useState<'table' | 'list'>('table');

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);

  // Sync URL ?assignee=me when navigating via sidebar links
  useEffect(() => {
    const paramAssignee = searchParams.get('assignee');
    if (paramAssignee && paramAssignee !== assignee) {
      setAssignee(paramAssignee);
    } else if (!paramAssignee && assignee === 'me') {
      setAssignee('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Reset stale project filter if that project was deleted
  useEffect(() => {
    if (project !== 'all' && !projects.some((p) => p._id === project)) {
      setProject('all');
    }
  }, [projects, project]);

  const handleAssigneeChange = (nextVal: string) => {
    setAssignee(nextVal);
    const nextParams = new URLSearchParams(searchParams);
    if (nextVal === 'me') {
      nextParams.set('assignee', 'me');
    } else {
      nextParams.delete('assignee');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const fetchIssues = useCallback(async () => {
    try {
      if (!hasLoadedRef.current) {
        setLoading(true);
      }
      setError('');
      const { issues: list } = await api.issues.list({
        search: search.trim() || undefined,
        status,
        priority,
        type,
        assignee,
        project,
        sortBy,
        sortOrder,
      });
      setIssues(list);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load issues');
    } finally {
      setLoading(false);
    }
  }, [search, status, priority, type, assignee, project, sortBy, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchIssues();
    }, 150);
    return () => clearTimeout(timer);
  }, [fetchIssues, dataVersion]);

  const handleQuickStatus = async (
    e: React.ChangeEvent<HTMLSelectElement>,
    issueId: string
  ) => {
    e.stopPropagation();
    const nextStatus = e.target.value as IssueStatus;
    try {
      await api.issues.updateStatus(issueId, nextStatus);
      setIssues((prev) =>
        prev.map((i) => (i._id === issueId ? { ...i, status: nextStatus } : i))
      );
      await refreshProjects();
      notifyDataChanged();
      toast.success(`Status updated to ${nextStatus}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setPriority('all');
    setType('all');
    setAssignee('all');
    setProject('all');
    setSortBy('createdAt');
    setSortOrder('desc');
    setSearchParams({});
  };

  const hasActiveFilters =
    search !== '' ||
    status !== 'all' ||
    priority !== 'all' ||
    type !== 'all' ||
    assignee !== 'all' ||
    project !== 'all';

  const rowPy = density === 'compact' ? 'py-2' : 'py-3';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#1F1F1E] dark:text-[#F3F0EE]">
            {assignee === 'me' ? 'My Assigned Issues' : 'All Issues'}
          </h1>
          <p className="text-[13px] text-[#6B6964] dark:text-[#A8A49B]">
            Search, filter, sort, and triage bugs and tasks across projects.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center p-0.5 rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#201F1D]">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-[#F4F3EE] dark:bg-[#2A2926] text-[#1F1F1E] dark:text-[#F3F0EE]'
                  : 'text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE]'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-[#F4F3EE] dark:bg-[#2A2926] text-[#1F1F1E] dark:text-[#F3F0EE]'
                  : 'text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE]'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              openCreateIssue(project !== 'all' ? { projectId: project } : {})
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Issue</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D]">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-[#8C8983] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by issue title or key..."
            className="w-full h-8 pl-8 pr-3 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-[#FAFAF8] dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none focus:border-[#C56A45]"
          />
        </div>

        <select
          aria-label="Filter by project"
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="h-8 px-2.5 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
        >
          <option value="all">All Projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.key} — {p.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-8 px-2.5 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
        >
          <option value="all">All Types</option>
          {ISSUE_TYPES.map((issueType) => (
            <option key={issueType} value={issueType}>
              {issueType}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-8 px-2.5 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
        >
          <option value="all">All Statuses</option>
          <option value="To Do">To Do</option>
          <option value="In Progress">In Progress</option>
          <option value="Done">Done</option>
        </select>

        <select
          aria-label="Filter by priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="h-8 px-2.5 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
        >
          <option value="all">All Priorities</option>
          <option value="Urgent">Urgent</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <select
          aria-label="Filter by assignee"
          value={assignee}
          onChange={(e) => handleAssigneeChange(e.target.value)}
          className="h-8 px-2.5 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
        >
          <option value="all">All Assignees</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Sort issues"
          value={`${sortBy}:${sortOrder}`}
          onChange={(e) => {
            const [sb, so] = e.target.value.split(':');
            setSortBy(sb);
            setSortOrder(so);
          }}
          className="h-8 px-2.5 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
        >
          <option value="createdAt:desc">Newest first</option>
          <option value="createdAt:asc">Oldest first</option>
          <option value="priority:desc">Priority: High to Low</option>
          <option value="priority:asc">Priority: Low to High</option>
          <option value="dueDate:asc">Due date: Earliest first</option>
          <option value="updatedAt:desc">Recently updated</option>
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 h-8 px-2.5 text-xs text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE] rounded border border-[#E4E2DC] dark:border-[#3A3835]"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded border border-[#B3473B]/30 bg-[#FBEAE8] text-xs text-[#B3473B]">
          {error}
        </div>
      )}

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-[#6B6964] dark:text-[#A8A49B]">
        <span className="font-mono tabular-nums">
          {loading
            ? 'Loading issues...'
            : `${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}`}
        </span>
      </div>

      {/* Table or List View */}
      <div className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-2.5 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-9 bg-[#F4F3EE] dark:bg-[#252422] rounded"
              />
            ))}
          </div>
        ) : issues.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-[13px] text-[#6B6964] dark:text-[#A8A49B]">
              {projects.length === 0
                ? 'Create a project before filing your first issue.'
                : hasActiveFilters
                ? 'No issues match the current filters.'
                : 'No issues have been reported yet.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-3 py-1.5 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835]"
                >
                  Clear Filters
                </button>
              )}
              {projects.length === 0 ? (
                <Link
                  to="/projects"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Create your first project</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    openCreateIssue(project !== 'all' ? { projectId: project } : {})
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create your first issue</span>
                </button>
              )}
            </div>
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="border-b border-[#E4E2DC] dark:border-[#2E2D2A] bg-[#FAFAF8] dark:bg-[#1A1918] text-[11px] font-mono uppercase tracking-wider text-[#6B6964] dark:text-[#A8A49B]">
                  <th className="py-2.5 px-4 font-medium w-24">Key</th>
                  <th className="py-2.5 px-4 font-medium">Title</th>
                  <th className="py-2.5 px-4 font-medium w-32">Type</th>
                  <th className="py-2.5 px-4 font-medium w-28">Priority</th>
                  <th className="py-2.5 px-4 font-medium w-32">Status</th>
                  <th className="py-2.5 px-4 font-medium w-40">Assignee</th>
                  <th className="py-2.5 px-4 font-medium w-28 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A] text-[13px]">
                {issues.map((issue) => (
                  <tr
                    key={issue._id}
                    onClick={() => openIssue(issue._id)}
                    className="hover:bg-[#F4F3EE] dark:hover:bg-[#252422] cursor-pointer transition-colors"
                  >
                    <td className={`${rowPy} px-4 font-mono text-xs text-[#6B6964] dark:text-[#A8A49B] whitespace-nowrap`}>
                      {issue.issueKey}
                    </td>
                    <td className={`${rowPy} px-4 max-w-md`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-[#1F1F1E] dark:text-[#F3F0EE] truncate">
                          {issue.title}
                        </span>
                        {issue.labels && issue.labels.length > 0 && (
                          <span className="hidden xl:inline-flex items-center gap-1 shrink-0">
                            {issue.labels.slice(0, 2).map((lbl) => (
                              <span
                                key={lbl}
                                className="px-1.5 py-0.5 text-[10px] font-mono rounded border border-[#E4E2DC] dark:border-[#34322E] bg-[#FAFAF8] dark:bg-[#191816] text-[#6B6964] dark:text-[#A8A49B]"
                              >
                                {lbl}
                              </span>
                            ))}
                            {issue.labels.length > 2 && (
                              <span className="text-[10px] font-mono text-[#8C8983]">
                                +{issue.labels.length - 2}
                              </span>
                            )}
                          </span>
                        )}
                        {(issue.commentCount || 0) > 0 && (
                          <span className="inline-flex items-center gap-0.5 font-mono text-[11px] text-[#8C8983] shrink-0">
                            <MessageSquare className="w-3 h-3" />
                            {issue.commentCount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`${rowPy} px-4`}>
                      <TypeIndicator type={issue.type} />
                    </td>
                    <td className={`${rowPy} px-4`}>
                      <PriorityBadge priority={issue.priority} />
                    </td>
                    <td
                      className={`${rowPy} px-4`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(() => {
                        const issueProj = projects.find(
                          (p) => p._id === issue.project?._id
                        );
                        const isReadOnly = issueProj?.myProjectRole === 'Viewer';
                        return (
                          <select
                            aria-label={`Change status for ${issue.issueKey}`}
                            value={issue.status}
                            disabled={isReadOnly}
                            onChange={(e) => handleQuickStatus(e, issue._id)}
                            className="h-7 px-2 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <option value="To Do">To Do</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Done">Done</option>
                          </select>
                        );
                      })()}
                    </td>
                    <td className={`${rowPy} px-4`}>
                      {issue.assignee ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar
                            name={issue.assignee.name}
                            color={issue.assignee.avatarColor}
                            size="xs"
                          />
                          <span className="text-xs truncate">{issue.assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#8C8983]">Unassigned</span>
                      )}
                    </td>
                    <td className={`${rowPy} px-4 text-right font-mono text-xs text-[#6B6964] dark:text-[#A8A49B] whitespace-nowrap`}>
                      {formatShortDate(issue.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A]">
            {issues.map((issue) => (
              <div
                key={issue._id}
                onClick={() => openIssue(issue._id)}
                className="px-4 py-3 hover:bg-[#F4F3EE] dark:hover:bg-[#252422] cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs text-[#6B6964] dark:text-[#A8A49B] shrink-0">
                      {issue.issueKey}
                    </span>
                    <StatusBadge status={issue.status} />
                    <span className="text-[14px] font-medium text-[#1F1F1E] dark:text-[#F3F0EE] truncate">
                      {issue.title}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6964] dark:text-[#A8A49B]">
                    <span>{issue.project?.name}</span>
                    <span aria-hidden="true">·</span>
                    <TypeIndicator type={issue.type} />
                    <span aria-hidden="true">·</span>
                    <span>Updated {formatRelativeTime(issue.updatedAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {(issue.commentCount || 0) > 0 && (
                    <span className="inline-flex items-center gap-1 font-mono text-xs text-[#8C8983]">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {issue.commentCount}
                    </span>
                  )}
                  {issue.attachments?.length > 0 && (
                    <span className="inline-flex items-center gap-1 font-mono text-xs text-[#8C8983]">
                      <Paperclip className="w-3.5 h-3.5" />
                      {issue.attachments.length}
                    </span>
                  )}
                  <PriorityBadge priority={issue.priority} />
                  <Avatar
                    name={issue.assignee?.name}
                    color={issue.assignee?.avatarColor || '#8C8983'}
                    size="xs"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
