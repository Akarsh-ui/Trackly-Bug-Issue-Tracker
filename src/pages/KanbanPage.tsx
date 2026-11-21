import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FolderPlus, Plus, RotateCcw, Search } from 'lucide-react';
import { api } from '../services/api';
import { useWorkspace } from '../context/WorkspaceContext';
import type { Issue, IssueStatus } from '../types';
import { KanbanBoard } from '../components/KanbanBoard';

export function KanbanPage() {
  const {
    projects,
    openIssue,
    openCreateIssue,
    refreshProjects,
    notifyDataChanged,
    dataVersion,
  } = useWorkspace();

  const [projectId, setProjectId] = useState('all');
  const [priority, setPriority] = useState('all');
  const [search, setSearch] = useState('');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (projectId !== 'all' && !projects.some((p) => p._id === projectId)) {
      setProjectId('all');
    }
  }, [projects, projectId]);

  const loadBoard = useCallback(async () => {
    try {
      if (!hasLoadedRef.current) {
        setLoading(true);
      }
      const { issues: list } = await api.issues.list({
        project: projectId,
        priority,
        search: search.trim() || undefined,
        sortBy: 'position',
      });
      setIssues(list);
      hasLoadedRef.current = true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load Kanban board');
    } finally {
      setLoading(false);
    }
  }, [projectId, priority, search]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadBoard();
    }, 150);
    return () => clearTimeout(t);
  }, [loadBoard, dataVersion]);

  const selectedProject =
    projectId !== 'all' ? projects.find((p) => p._id === projectId) : undefined;
  const hasAnyWritableProject = projects.some((p) => p.myProjectRole !== 'Viewer');
  const isBoardReadOnly =
    projectId !== 'all'
      ? selectedProject?.myProjectRole === 'Viewer'
      : projects.length > 0 && !hasAnyWritableProject;

  const handleMoveIssue = async (
    issueId: string,
    nextStatus: IssueStatus,
    targetPosition?: number
  ) => {
    const moved = issues.find((item) => item._id === issueId);
    const issueProj = projects.find((p) => p._id === moved?.project?._id);
    if (issueProj?.myProjectRole === 'Viewer') {
      toast.error('Viewers have read-only access and cannot move issues');
      return;
    }
    const prev = issues;
    setIssues((curr) =>
      curr.map((item) =>
        item._id === issueId
          ? {
              ...item,
              status: nextStatus,
              position: targetPosition ?? item.position,
            }
          : item
      )
    );
    try {
      await api.issues.updateStatus(issueId, nextStatus, targetPosition);
      toast.success(`Moved to ${nextStatus}`);
      await refreshProjects();
      notifyDataChanged();
    } catch (err) {
      setIssues(prev);
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const hasFilters = projectId !== 'all' || priority !== 'all' || search.trim() !== '';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#1F1F1E] dark:text-[#F3F0EE]">
            Kanban Board
          </h1>
          <p className="text-[13px] text-[#6B6964] dark:text-[#A8A49B]">
            Drag and drop issues between To Do, In Progress, and Done to update status.
          </p>
        </div>

        {!isBoardReadOnly && (
          <button
            type="button"
            onClick={() =>
              openCreateIssue(projectId !== 'all' ? { projectId } : {})
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Issue</span>
          </button>
        )}
      </div>

      {/* Board Filter Controls */}
      <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D]">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-[#8C8983] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter cards by title or key..."
            className="w-full h-8 pl-8 pr-3 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-[#FAFAF8] dark:bg-[#181817] focus:outline-none focus:border-[#C56A45]"
          />
        </div>

        <select
          aria-label="Filter board by project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
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
          aria-label="Filter board by priority"
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

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setProjectId('all');
              setPriority('all');
              setSearch('');
            }}
            className="inline-flex items-center gap-1 h-8 px-2.5 text-xs text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE] rounded border border-[#E4E2DC] dark:border-[#3A3835]"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {projects.length === 0 && !loading ? (
        <div className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] p-12 text-center space-y-3">
          <p className="text-[13px] font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
            No projects on the board yet
          </p>
          <p className="text-xs text-[#6B6964] dark:text-[#A8A49B]">
            Create your first project to track issues across workflow stages.
          </p>
          <Link
            to="/projects"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Create your first project</span>
          </Link>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="h-[420px] rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-[#F4F3EE] dark:bg-[#1C1B1A]"
            />
          ))}
        </div>
      ) : (
        <KanbanBoard
          issues={issues}
          onMoveIssue={handleMoveIssue}
          onOpenIssue={openIssue}
          readOnly={isBoardReadOnly}
          onCreateInColumn={(status) =>
            openCreateIssue({
              projectId: projectId !== 'all' ? projectId : undefined,
              status,
            })
          }
        />
      )}
    </div>
  );
}
