import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FolderPlus, Pencil, RotateCcw, Search, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { useWorkspace } from '../context/WorkspaceContext';
import type { Project } from '../types';
import { formatShortDate } from '../utils/formatters';
import { Avatar } from '../components/Avatar';
import { ProjectModal } from '../components/ProjectModal';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function ProjectsPage() {
  const { projects, loadingWorkspace, refreshProjects, notifyDataChanged } =
    useWorkspace();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
    );
  }, [projects, search]);

  const handleConfirmDelete = async () => {
    if (!deletingProject) return;
    try {
      setDeleting(true);
      await api.projects.delete(deletingProject._id);
      toast.success(`Deleted project ${deletingProject.name}`);
      setDeletingProject(null);
      await refreshProjects();
      notifyDataChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#1F1F1E] dark:text-[#F3F0EE]">
            Projects
          </h1>
          <p className="text-[13px] text-[#6B6964] dark:text-[#A8A49B]">
            Repositories, product areas, and issue trackers across your workspace.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingProject(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>New Project</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-[#8C8983] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter projects by name or key..."
            className="w-full h-9 pl-8 pr-3 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#201F1D] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none focus:border-[#C56A45]"
          />
        </div>
        <span className="text-xs font-mono text-[#6B6964] dark:text-[#A8A49B] tabular-nums">
          {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
        </span>
      </div>

      {/* Projects Table */}
      <div className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] overflow-x-auto">
        {loadingWorkspace ? (
          <div className="p-6 space-y-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-[#F4F3EE] dark:bg-[#252422] rounded" />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-[13px] text-[#6B6964] dark:text-[#A8A49B]">
              {search
                ? 'No projects match your search query.'
                : 'No projects created yet. Start by creating your first project.'}
            </p>
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835]"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear Search</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingProject(null);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Create your first project</span>
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b border-[#E4E2DC] dark:border-[#2E2D2A] bg-[#FAFAF8] dark:bg-[#1A1918] text-[11px] font-mono uppercase tracking-wider text-[#6B6964] dark:text-[#A8A49B]">
                <th className="py-2.5 px-4 font-medium">Key</th>
                <th className="py-2.5 px-4 font-medium">Project</th>
                <th className="py-2.5 px-4 font-medium">Lead</th>
                <th className="py-2.5 px-4 font-medium">Members</th>
                <th className="py-2.5 px-4 font-medium">Progress</th>
                <th className="py-2.5 px-4 font-medium">Created</th>
                <th className="py-2.5 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A] text-[13px]">
              {filteredProjects.map((project) => {
                const stats = project.stats || {
                  total: 0,
                  done: 0,
                  open: 0,
                  progress: 0,
                };
                const role = project.myProjectRole || 'Member';
                const canEdit = role === 'Owner' || role === 'Admin';
                const canDelete = role === 'Owner';
                return (
                  <tr
                    key={project._id}
                    className="hover:bg-[#F4F3EE] dark:hover:bg-[#252422] transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs font-medium text-[#6B6964] dark:text-[#A8A49B]">
                      {project.key}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <Link
                        to={`/projects/${project._id}`}
                        className="font-medium text-[#1F1F1E] dark:text-[#F3F0EE] hover:text-[#C56A45] block"
                      >
                        {project.name}
                      </Link>
                      {project.description && (
                        <p className="text-xs text-[#6B6964] dark:text-[#A8A49B] truncate">
                          {project.description}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Avatar
                          name={project.lead?.name}
                          color={project.lead?.avatarColor}
                          size="xs"
                        />
                        <span className="text-xs text-[#1F1F1E] dark:text-[#E5E2DC]">
                          {project.lead?.name || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center -space-x-1">
                        {project.members.slice(0, 4).map((m) => (
                          <Avatar
                            key={m._id}
                            name={m.name}
                            color={m.avatarColor}
                            size="xs"
                            className="ring-1 ring-white dark:ring-[#201F1D]"
                          />
                        ))}
                        {project.members.length > 4 && (
                          <span className="pl-2 font-mono text-[11px] text-[#6B6964] dark:text-[#A8A49B]">
                            +{project.members.length - 4}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 w-44">
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-[#6B6964] dark:text-[#A8A49B] mb-1">
                        <span>
                          {stats.done}/{stats.total} done
                        </span>
                        <span>{stats.progress}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-sm bg-[#EFECE6] dark:bg-[#2A2926] overflow-hidden">
                        <div
                          className="h-full bg-[#557A59]"
                          style={{ width: `${stats.progress}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-[#6B6964] dark:text-[#A8A49B] whitespace-nowrap">
                      {formatShortDate(project.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProject(project);
                              setModalOpen(true);
                            }}
                            title="Edit project"
                            className="p-1.5 rounded text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE] hover:bg-white dark:hover:bg-[#2E2D2A]"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeletingProject(project)}
                            title="Delete project"
                            className="p-1.5 rounded text-[#6B6964] hover:text-[#B3473B] hover:bg-[#FBEAE8] dark:hover:bg-[#361E1C]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!canEdit && !canDelete && (
                          <span className="font-mono text-[11px] text-[#8C8983] px-1.5">
                            {role}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ProjectModal
        open={modalOpen}
        project={editingProject}
        onClose={() => setModalOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deletingProject)}
        title={`Delete ${deletingProject?.name}?`}
        description="Deleting this project will permanently delete all of its issues, comments, and activity records. This cannot be undone."
        confirmLabel="Delete Project"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingProject(null)}
      />
    </div>
  );
}
