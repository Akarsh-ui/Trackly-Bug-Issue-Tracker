import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import type { Project } from '../types';

interface ProjectModalProps {
  open: boolean;
  project?: Project | null;
  onClose: () => void;
  onSaved?: (project: Project) => void;
}

interface FormValues {
  name: string;
  key: string;
  description: string;
  lead: string;
}

export function ProjectModal({ open, project, onClose, onSaved }: ProjectModalProps) {
  const { user } = useAuth();
  const { members, refreshProjects, notifyDataChanged } = useWorkspace();
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = Boolean(project);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      key: '',
      description: '',
      lead: '',
    },
  });

  const watchedName = watch('name');

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setKeyManuallyEdited(false);
      if (project) {
        reset({
          name: project.name,
          key: project.key,
          description: project.description || '',
          lead: project.lead?._id || user?._id || '',
        });
        setSelectedMembers(project.members.map((m) => m._id));
      } else {
        reset({
          name: '',
          key: '',
          description: '',
          lead: user?._id || '',
        });
        setSelectedMembers(user?._id ? [user._id] : []);
      }
    }
  }, [open, project, user, reset]);

  // Suggest uppercase project key from name when creating unless user customized key
  useEffect(() => {
    if (!isEdit && open && watchedName && !keyManuallyEdited) {
      const words = watchedName.trim().split(/\s+/).filter(Boolean);
      const suggested =
        words.length > 1
          ? words
              .slice(0, 4)
              .map((w) => w.replace(/[^a-zA-Z0-9]/g, '')[0] || '')
              .join('')
              .toUpperCase()
          : watchedName
              .replace(/[^a-zA-Z0-9]/g, '')
              .slice(0, 4)
              .toUpperCase();
      if (suggested.length >= 2) {
        setValue('key', suggested, { shouldValidate: true });
      }
    }
  }, [watchedName, isEdit, open, keyManuallyEdited, setValue]);

  if (!open) return null;

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setSubmitting(true);
      let saved: Project;
      if (isEdit && project) {
        const res = await api.projects.update(project._id, {
          name: values.name,
          key: values.key.toUpperCase(),
          description: values.description,
          lead: values.lead,
          members: selectedMembers,
        });
        saved = res.project;
        toast.success(`Updated project ${saved.name}`);
      } else {
        const res = await api.projects.create({
          name: values.name,
          key: values.key.toUpperCase(),
          description: values.description,
          lead: values.lead,
          members: selectedMembers,
        });
        saved = res.project;
        toast.success(`Created project ${saved.name} (${saved.key})`);
      }

      await refreshProjects();
      notifyDataChanged();
      onSaved?.(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setSubmitting(false);
    }
  };

  const keyField = register('key', {
    required: 'Key is required',
    pattern: {
      value: /^[A-Za-z0-9]{2,10}$/,
      message: '2-10 letters/numbers',
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1F1E]/30 dark:bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-lg bg-white dark:bg-[#201F1D] border border-[#DCD9D0] dark:border-[#3A3835] shadow-[0_12px_32px_rgba(31,31,30,0.08)] overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E4E2DC] dark:border-[#2E2D2A] shrink-0">
          <h2
            id="project-modal-title"
            className="text-[15px] font-semibold text-[#1F1F1E] dark:text-[#F3F0EE]"
          >
            {isEdit ? 'Edit Project' : 'New Project'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE] hover:bg-[#F4F3EE] dark:hover:bg-[#2A2926]"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="p-5 space-y-4 overflow-y-auto flex-1"
          noValidate
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                Project Name <span className="text-[#B3473B]">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Payment Gateway"
                {...register('name', {
                  required: 'Project name is required',
                  minLength: { value: 2, message: 'At least 2 characters' },
                })}
                className="w-full h-9 px-3 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none focus:border-[#C56A45]"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-[#B3473B]">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                Project Key <span className="text-[#B3473B]">*</span>
              </label>
              <input
                type="text"
                placeholder="PAY"
                maxLength={10}
                {...keyField}
                onChange={(e) => {
                  setKeyManuallyEdited(true);
                  e.target.value = e.target.value.toUpperCase();
                  keyField.onChange(e);
                }}
                className="w-full h-9 px-3 text-[13px] font-mono uppercase rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none focus:border-[#C56A45]"
              />
              {errors.key && (
                <p className="mt-1 text-xs text-[#B3473B]">{errors.key.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Scope, goals, and key deliverables for this project..."
              {...register('description')}
              className="w-full p-2.5 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none focus:border-[#C56A45] resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
              Project Lead <span className="text-[#B3473B]">*</span>
            </label>
            <select
              {...register('lead', { required: 'Select a project lead' })}
              className="w-full h-9 px-2.5 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none focus:border-[#C56A45]"
            >
              {members.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1.5">
              Team Members ({selectedMembers.length})
            </label>
            <div className="max-h-36 overflow-y-auto border border-[#E4E2DC] dark:border-[#3A3835] rounded divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A] bg-[#FAFAF8] dark:bg-[#181817]">
              {members.map((member) => {
                const checked = selectedMembers.includes(member._id);
                return (
                  <label
                    key={member._id}
                    className="flex items-center justify-between px-3 py-2 text-[13px] cursor-pointer hover:bg-[#F4F3EE] dark:hover:bg-[#252422]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMember(member._id)}
                        className="w-3.5 h-3.5 rounded-[3px] accent-[#C56A45]"
                      />
                      <span className="truncate font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                        {member.name}
                      </span>
                    </div>
                    <span className="text-xs text-[#6B6964] dark:text-[#A8A49B] shrink-0">
                      {member.role}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E2DC] dark:border-[#2E2D2A]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#252422] text-[#1F1F1E] dark:text-[#F3F0EE] hover:bg-[#F7F6F2] dark:hover:bg-[#2E2D2A] transition-colors whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
