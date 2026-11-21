import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { FolderPlus, Lock, Paperclip, Plus, Tag, X } from 'lucide-react';
import { api, USE_REMOTE_API } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  ISSUE_TYPES,
  type IssuePriority,
  type IssueStatus,
  type IssueType,
} from '../types';
import { validateOptionalDueDate } from '../utils/authValidation';
import { Avatar } from './Avatar';

interface FormValues {
  project: string;
  title: string;
  description: string;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  assignee: string;
  dueDate: string;
  stepsToReproduce: string;
  expectedResult: string;
  actualResult: string;
  environment: string;
  featureDescription: string;
  reasonForRequest: string;
  expectedOutcome: string;
}

export function CreateIssueModal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    workspace,
    createIssueOpen,
    createIssueDefaults,
    closeCreateIssue,
    projects,
    members,
    refreshProjects,
    notifyDataChanged,
  } = useWorkspace();

  const [attachment, setAttachment] = useState<File | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      project: '',
      title: '',
      description: '',
      type: 'Bug',
      priority: 'Medium',
      status: 'To Do',
      assignee: '',
      dueDate: '',
      stepsToReproduce: '',
      expectedResult: '',
      actualResult: '',
      environment: '',
      featureDescription: '',
      reasonForRequest: '',
      expectedOutcome: '',
    },
  });

  const selectedProjectId = watch('project');
  const currentAssignee = watch('assignee');
  const selectedType = watch('type');

  const writableProjects = useMemo(
    () => projects.filter((p) => p.myProjectRole !== 'Viewer'),
    [projects]
  );

  const assignableMembers = useMemo(() => {
    const selectedProj = projects.find((p) => p._id === selectedProjectId);
    if (selectedProj && selectedProj.members && selectedProj.members.length > 0) {
      return selectedProj.members;
    }
    return members;
  }, [projects, selectedProjectId, members]);

  useEffect(() => {
    if (!currentAssignee) return;
    if (!assignableMembers.some((m) => m._id === currentAssignee)) {
      setValue('assignee', '');
    }
  }, [assignableMembers, currentAssignee, setValue]);

  useEffect(() => {
    if (!createIssueOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) closeCreateIssue();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [createIssueOpen, submitting, closeCreateIssue]);

  useEffect(() => {
    if (createIssueOpen) {
      const preferredId =
        createIssueDefaults.projectId &&
        writableProjects.some((p) => p._id === createIssueDefaults.projectId)
          ? createIssueDefaults.projectId
          : writableProjects[0]?._id || '';
      reset({
        project: preferredId,
        title: '',
        description: '',
        type: 'Bug',
        priority: workspace?.defaultIssuePriority || 'Medium',
        status: createIssueDefaults.status || 'To Do',
        assignee: '',
        dueDate: '',
        stepsToReproduce: '',
        expectedResult: '',
        actualResult: '',
        environment: '',
        featureDescription: '',
        reasonForRequest: '',
        expectedOutcome: '',
      });
      setAttachment(null);
      setLabels([]);
      setLabelInput('');
    }
  }, [createIssueOpen, createIssueDefaults, writableProjects, workspace, reset]);

  if (!createIssueOpen) return null;

  const addLabel = (raw: string) => {
    const cleaned = raw.trim().replace(/,$/, '').slice(0, 32);
    if (!cleaned) return;
    if (labels.some((l) => l.toLowerCase() === cleaned.toLowerCase())) {
      setLabelInput('');
      return;
    }
    if (labels.length >= 10) {
      toast.error('Maximum of 10 labels per issue');
      return;
    }
    setLabels((prev) => [...prev, cleaned]);
    setLabelInput('');
  };

  const removeLabel = (target: string) => {
    setLabels((prev) => prev.filter((l) => l !== target));
  };

  const onSubmit = async (values: FormValues) => {
    if (submitting) return;
    try {
      setSubmitting(true);

      const finalLabels = [...labels];
      const pendingLabel = labelInput.trim().slice(0, 32);
      if (
        pendingLabel &&
        finalLabels.length < 10 &&
        !finalLabels.some((l) => l.toLowerCase() === pendingLabel.toLowerCase())
      ) {
        finalLabels.push(pendingLabel);
      }

      const bugDetails =
        values.type === 'Bug' &&
        (values.stepsToReproduce.trim() ||
          values.expectedResult.trim() ||
          values.actualResult.trim() ||
          values.environment.trim())
          ? {
              stepsToReproduce: values.stepsToReproduce.trim(),
              expectedResult: values.expectedResult.trim(),
              actualResult: values.actualResult.trim(),
              environment: values.environment.trim(),
            }
          : undefined;

      const featureDetails =
        values.type === 'Feature Request' &&
        (values.featureDescription.trim() ||
          values.reasonForRequest.trim() ||
          values.expectedOutcome.trim())
          ? {
              featureDescription: values.featureDescription.trim(),
              reasonForRequest: values.reasonForRequest.trim(),
              expectedOutcome: values.expectedOutcome.trim(),
            }
          : undefined;

      const { issue } = await api.issues.create({
        title: values.title,
        description: values.description,
        type: values.type,
        priority: values.priority,
        status: values.status,
        project: values.project,
        assignee: values.assignee || null,
        dueDate: values.dueDate || null,
        labels: finalLabels,
        bugDetails,
        featureDetails,
        attachmentFile: attachment,
      });
      toast.success(`Created ${issue.issueKey}`);
      await refreshProjects();
      notifyDataChanged();
      closeCreateIssue();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create issue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1F1E]/30 dark:bg-black/60 p-4"
      onClick={() => {
        if (!submitting) closeCreateIssue();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-issue-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-lg bg-white dark:bg-[#201F1D] border border-[#DCD9D0] dark:border-[#3A3835] shadow-[0_12px_32px_rgba(31,31,30,0.08)] overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E4E2DC] dark:border-[#2E2D2A] shrink-0">
          <div>
            <h2
              id="create-issue-title"
              className="text-[15px] font-semibold text-[#1F1F1E] dark:text-[#F3F0EE]"
            >
              Create Issue
            </h2>
            <p className="text-[11.5px] text-[#6B6964] dark:text-[#A8A49B]">
              Log a bug, feature request, task, or engineering work item.
            </p>
          </div>
          <button
            type="button"
            onClick={closeCreateIssue}
            className="p-1 rounded text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE] hover:bg-[#F4F3EE] dark:hover:bg-[#2A2926]"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="p-5 space-y-5 overflow-y-auto flex-1"
          noValidate
        >
          {writableProjects.length === 0 ? (
            <div className="p-6 rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-[#FAFAF8] dark:bg-[#252422] text-center space-y-3">
              <p className="text-[13px] font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                {projects.length === 0
                  ? 'No projects exist yet'
                  : 'Read-only access on current projects'}
              </p>
              <p className="text-xs text-[#6B6964] dark:text-[#A8A49B]">
                {projects.length === 0
                  ? 'Create your first project to organize bugs, tasks, and issue keys.'
                  : 'You currently have Viewer-only permissions. Create a new project or ask a project Admin for Member access to file issues.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  closeCreateIssue();
                  navigate('/projects');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Go to Projects</span>
              </button>
            </div>
          ) : (
            <>
              {/* Section 1: Basic Information */}
              <section className="space-y-3">
                <h3 className="font-mono text-[10.5px] uppercase tracking-wider text-[#8C8983] font-medium">
                  Basic Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                      Project <span className="text-[#B3473B]">*</span>
                    </label>
                    <select
                      {...register('project', { required: 'Please select a project' })}
                      className="w-full h-9 px-2.5 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none focus:border-[#C56A45]"
                    >
                      {writableProjects.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.key} — {p.name}
                        </option>
                      ))}
                    </select>
                    {errors.project && (
                      <p className="mt-1 text-xs text-[#B3473B]">{errors.project.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                      Issue Type
                    </label>
                    <select
                      {...register('type')}
                      className="w-full h-9 px-2.5 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none focus:border-[#C56A45]"
                    >
                      {ISSUE_TYPES.map((issueType) => (
                        <option key={issueType} value={issueType}>
                          {issueType}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                    Title <span className="text-[#B3473B]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Short, descriptive summary of the issue"
                    {...register('title', {
                      required: 'Issue title is required',
                      minLength: { value: 2, message: 'Title must be at least 2 characters' },
                    })}
                    className="w-full h-9 px-3 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] placeholder:text-[#8C8983] focus:outline-none focus:border-[#C56A45]"
                  />
                  {errors.title && (
                    <p className="mt-1 text-xs text-[#B3473B]">{errors.title.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide context, acceptance criteria, or background details..."
                    {...register('description')}
                    className="w-full p-2.5 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] placeholder:text-[#8C8983] focus:outline-none focus:border-[#C56A45] resize-y"
                  />
                </div>
              </section>

              {/* Conditional Bug Details */}
              {selectedType === 'Bug' && (
                <section className="rounded-md border border-[#E4E2DC] dark:border-[#34322E] bg-[#FAFAF8] dark:bg-[#191816] p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-[10.5px] uppercase tracking-wider text-[#B3473B] dark:text-[#EB8B80] font-medium">
                      Bug Details (Optional)
                    </h3>
                    <span className="text-[11px] text-[#8C8983]">
                      Helps engineers reproduce faster
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                      Steps to Reproduce
                    </label>
                    <textarea
                      rows={2}
                      placeholder="1. Open project settings&#10;2. Click Save..."
                      {...register('stepsToReproduce')}
                      className="w-full p-2 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] placeholder:text-[#8C8983] focus:outline-none focus:border-[#C56A45] resize-y"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                        Expected Result
                      </label>
                      <input
                        type="text"
                        placeholder="What should happen"
                        {...register('expectedResult')}
                        className="w-full h-8 px-2.5 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] placeholder:text-[#8C8983] focus:outline-none focus:border-[#C56A45]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                        Actual Result
                      </label>
                      <input
                        type="text"
                        placeholder="What happened instead"
                        {...register('actualResult')}
                        className="w-full h-8 px-2.5 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] placeholder:text-[#8C8983] focus:outline-none focus:border-[#C56A45]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                      Browser / Environment
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Chrome 131 on macOS 15, Production"
                      {...register('environment')}
                      className="w-full h-8 px-2.5 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] placeholder:text-[#8C8983] focus:outline-none focus:border-[#C56A45]"
                    />
                  </div>
                </section>
              )}

              {/* Conditional Feature Request Details */}
              {selectedType === 'Feature Request' && (
                <section className="rounded-md border border-[#E4E2DC] dark:border-[#34322E] bg-[#FAFAF8] dark:bg-[#191816] p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-[10.5px] uppercase tracking-wider text-[#C56A45] font-medium">
                      Feature Request Details (Optional)
                    </h3>
                    <span className="text-[11px] text-[#8C8983]">
                      Clarifies product impact
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                      Feature Description
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Describe the proposed capability or workflow..."
                      {...register('featureDescription')}
                      className="w-full p-2 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] placeholder:text-[#8C8983] focus:outline-none focus:border-[#C56A45] resize-y"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                        Reason for Request
                      </label>
                      <input
                        type="text"
                        placeholder="Why is this needed?"
                        {...register('reasonForRequest')}
                        className="w-full h-8 px-2.5 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] placeholder:text-[#8C8983] focus:outline-none focus:border-[#C56A45]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                        Expected Outcome
                      </label>
                      <input
                        type="text"
                        placeholder="Desired user or team impact"
                        {...register('expectedOutcome')}
                        className="w-full h-8 px-2.5 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] placeholder:text-[#8C8983] focus:outline-none focus:border-[#C56A45]"
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* Section 2: Classification */}
              <section className="space-y-3 pt-1 border-t border-[#E4E2DC] dark:border-[#2E2D2A]">
                <h3 className="font-mono text-[10.5px] uppercase tracking-wider text-[#8C8983] font-medium pt-2">
                  Classification
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                      Priority
                    </label>
                    <select
                      {...register('priority')}
                      className="w-full h-9 px-2.5 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none focus:border-[#C56A45]"
                    >
                      <option value="Urgent">Urgent</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                      Status
                    </label>
                    <select
                      {...register('status')}
                      className="w-full h-9 px-2.5 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none focus:border-[#C56A45]"
                    >
                      <option value="To Do">To Do</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Done">Done</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                    Labels (Optional)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Tag className="w-3.5 h-3.5 text-[#8C8983] absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={labelInput}
                        onChange={(e) => setLabelInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            addLabel(labelInput);
                          }
                        }}
                        placeholder="Type a label (e.g. auth, frontend) and press Enter"
                        className="w-full h-8 pl-8 pr-3 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] placeholder:text-[#8C8983] focus:outline-none focus:border-[#C56A45]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => addLabel(labelInput)}
                      disabled={!labelInput.trim()}
                      className="h-8 px-2.5 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-[#FAFAF8] dark:bg-[#252422] text-[#1F1F1E] dark:text-[#F3F0EE] hover:border-[#C56A45] disabled:opacity-40 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                  {labels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {labels.map((lbl) => (
                        <span
                          key={lbl}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono rounded border border-[#DCD9D0] dark:border-[#3A3835] bg-[#F4F3EE] dark:bg-[#252422] text-[#4A4844] dark:text-[#C5C0B6]"
                        >
                          <span>{lbl}</span>
                          <button
                            type="button"
                            onClick={() => removeLabel(lbl)}
                            aria-label={`Remove label ${lbl}`}
                            className="text-[#8C8983] hover:text-[#B3473B]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Section 3: Assignment */}
              <section className="space-y-3 pt-1 border-t border-[#E4E2DC] dark:border-[#2E2D2A]">
                <h3 className="font-mono text-[10.5px] uppercase tracking-wider text-[#8C8983] font-medium pt-2">
                  Assignment
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                      Assignee
                    </label>
                    <select
                      {...register('assignee')}
                      className="w-full h-9 px-2.5 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none focus:border-[#C56A45]"
                    >
                      <option value="">Unassigned</option>
                      {assignableMembers.map((m) => (
                        <option key={m._id} value={m._id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                      Reporter
                    </label>
                    <div className="h-9 px-2.5 rounded border border-[#E4E2DC] dark:border-[#34322E] bg-[#F4F3EE] dark:bg-[#191816] flex items-center justify-between gap-2 text-xs text-[#4A4844] dark:text-[#C5C0B6]">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          name={user?.name}
                          color={user?.avatarColor}
                          size="xs"
                        />
                        <span className="truncate font-medium">
                          {user?.name || 'Current User'}
                        </span>
                      </div>
                      <Lock className="w-3 h-3 text-[#8C8983] shrink-0" />
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: Additional Information */}
              <section className="space-y-3 pt-1 border-t border-[#E4E2DC] dark:border-[#2E2D2A]">
                <h3 className="font-mono text-[10.5px] uppercase tracking-wider text-[#8C8983] font-medium pt-2">
                  Additional Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                      Due Date (Optional)
                    </label>
                    <input
                      type="date"
                      {...register('dueDate', {
                        validate: (val) => validateOptionalDueDate(val) || true,
                      })}
                      className="w-full h-9 px-2.5 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none focus:border-[#C56A45]"
                    />
                    {errors.dueDate && (
                      <p className="mt-1 text-xs text-[#B3473B]">{errors.dueDate.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                      Attachment (Optional)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <label className="flex-1 flex items-center gap-2 h-9 px-2.5 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-[#FAFAF8] dark:bg-[#181817] text-[#6B6964] dark:text-[#A8A49B] hover:border-[#DCD9D0] cursor-pointer truncate">
                        <Paperclip className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {attachment ? attachment.name : 'Attach screenshot or log...'}
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            if (file) {
                              const maxBytes = USE_REMOTE_API
                                ? 10 * 1024 * 1024
                                : 1.5 * 1024 * 1024;
                              if (file.size > maxBytes) {
                                toast.error(
                                  USE_REMOTE_API
                                    ? 'File exceeds 10 MB upload limit'
                                    : 'Local browser storage supports attachments up to 1.5 MB'
                                );
                                e.target.value = '';
                                return;
                              }
                            }
                            setAttachment(file);
                          }}
                        />
                      </label>
                      {attachment && (
                        <button
                          type="button"
                          onClick={() => setAttachment(null)}
                          className="h-9 px-2 rounded border border-[#E4E2DC] dark:border-[#3A3835] text-[#6B6964] hover:text-[#B3473B]"
                          aria-label="Remove attachment"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E2DC] dark:border-[#2E2D2A]">
            <button
              type="button"
              onClick={closeCreateIssue}
              className="px-3.5 py-2 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#252422] text-[#1F1F1E] dark:text-[#F3F0EE] hover:bg-[#F7F6F2] dark:hover:bg-[#2E2D2A] transition-colors whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            {writableProjects.length > 0 && (
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                {submitting ? 'Creating...' : 'Create Issue'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
