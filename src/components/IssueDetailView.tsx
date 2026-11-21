import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Calendar,
  Download,
  ExternalLink,
  FileText,
  MessageSquare,
  Paperclip,
  Pencil,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api, USE_REMOTE_API } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { validateOptionalDueDate } from '../utils/authValidation';
import {
  ISSUE_TYPES,
  type Activity,
  type BugDetails,
  type Comment,
  type FeatureDetails,
  type Issue,
  type IssuePriority,
  type IssueStatus,
  type IssueType,
} from '../types';
import {
  formatFileSize,
  formatRelativeTime,
  formatShortDate,
} from '../utils/formatters';
import { Avatar } from './Avatar';
import { PriorityBadge, StatusBadge, TypeIndicator } from './IssueBadges';
import { ConfirmDialog } from './ConfirmDialog';

interface IssueDetailViewProps {
  issueId: string;
  isDrawer?: boolean;
  onClose?: () => void;
}

export function IssueDetailView({
  issueId,
  isDrawer = false,
  onClose,
}: IssueDetailViewProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects, members, refreshProjects, notifyDataChanged } = useWorkspace();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingContent, setEditingContent] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftLabels, setDraftLabels] = useState<string[]>([]);
  const [draftLabelInput, setDraftLabelInput] = useState('');
  const [draftBugDetails, setDraftBugDetails] = useState<BugDetails>({});
  const [draftFeatureDetails, setDraftFeatureDetails] = useState<FeatureDetails>({});
  const [savingContent, setSavingContent] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingIssue, setDeletingIssue] = useState(false);

  const loadIssue = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.issues.get(issueId);
      setIssue(data.issue);
      setComments(data.comments);
      setActivities(data.activities);
      setDraftTitle(data.issue.title);
      setDraftDescription(data.issue.description || '');
      setDraftLabels(data.issue.labels || []);
      setDraftLabelInput('');
      setDraftBugDetails(data.issue.bugDetails || {});
      setDraftFeatureDetails(data.issue.featureDetails || {});
      setEditingContent(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load issue');
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    loadIssue();
  }, [loadIssue]);

  const handleFieldUpdate = async (
    patch: Partial<{
      status: IssueStatus;
      priority: IssuePriority;
      type: IssueType;
      assignee: string | null;
      dueDate: string | null;
    }>
  ) => {
    if (!issue) return;
    if ('dueDate' in patch && patch.dueDate) {
      const dateErr = validateOptionalDueDate(patch.dueDate);
      if (dateErr) {
        toast.error(dateErr);
        return;
      }
    }
    try {
      const { issue: updated } = await api.issues.update(issue._id, patch);
      setIssue(updated);
      const refreshed = await api.issues.get(issue._id);
      setActivities(refreshed.activities);
      await refreshProjects();
      notifyDataChanged();
      toast.success(`Updated ${updated.issueKey}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update issue');
    }
  };

  const handleSaveTitleDescription = async () => {
    if (!issue || draftTitle.trim().length < 2) {
      toast.error('Issue title must be at least 2 characters');
      return;
    }
    try {
      setSavingContent(true);
      const nextLabels = [...draftLabels];
      const pending = draftLabelInput.trim().slice(0, 32);
      if (
        pending &&
        nextLabels.length < 10 &&
        !nextLabels.some((l) => l.toLowerCase() === pending.toLowerCase())
      ) {
        nextLabels.push(pending);
      }

      const { issue: updated } = await api.issues.update(issue._id, {
        title: draftTitle.trim(),
        description: draftDescription,
        labels: nextLabels,
        ...(issue.type === 'Bug' ? { bugDetails: draftBugDetails } : {}),
        ...(issue.type === 'Feature Request'
          ? { featureDetails: draftFeatureDetails }
          : {}),
      });
      setIssue(updated);
      setDraftLabels(updated.labels || []);
      setDraftLabelInput('');
      setEditingContent(false);
      const refreshed = await api.issues.get(issue._id);
      setActivities(refreshed.activities);
      notifyDataChanged();
      toast.success('Issue details saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSavingContent(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue || !commentText.trim()) return;
    try {
      setPostingComment(true);
      const { comment } = await api.comments.create(issue._id, commentText.trim());
      setComments((prev) => [...prev, comment]);
      setCommentText('');
      const refreshed = await api.issues.get(issue._id);
      setActivities(refreshed.activities);
      notifyDataChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  };

  const handleSaveCommentEdit = async (commentId: string) => {
    const trimmed = editingCommentText.trim();
    if (!trimmed) {
      toast.error('Comment cannot be empty');
      return;
    }
    try {
      setSavingComment(true);
      const { comment } = await api.comments.update(commentId, trimmed);
      setComments((prev) =>
        prev.map((c) => (c._id === commentId ? comment : c))
      );
      setEditingCommentId(null);
      setEditingCommentText('');
      notifyDataChanged();
      toast.success('Comment updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update comment');
    } finally {
      setSavingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await api.comments.delete(commentId);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingCommentText('');
      }
      notifyDataChanged();
      toast.success('Comment deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete comment');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !issue) return;
    const maxBytes = USE_REMOTE_API ? 10 * 1024 * 1024 : 1.5 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(
        USE_REMOTE_API
          ? 'File exceeds 10 MB upload limit'
          : 'Local browser storage supports attachments up to 1.5 MB'
      );
      e.target.value = '';
      return;
    }
    try {
      setUploadingFile(true);
      const { issue: updated } = await api.issues.uploadAttachment(issue._id, file);
      setIssue(updated);
      const refreshed = await api.issues.get(issue._id);
      setActivities(refreshed.activities);
      toast.success(`Attached ${file.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload attachment');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!issue) return;
    try {
      const { issue: updated } = await api.issues.deleteAttachment(
        issue._id,
        attachmentId
      );
      setIssue(updated);
      toast.success('Attachment removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove attachment');
    }
  };

  const handleDeleteIssue = async () => {
    if (!issue) return;
    try {
      setDeletingIssue(true);
      await api.issues.delete(issue._id);
      toast.success(`Deleted ${issue.issueKey}`);
      setDeleteDialogOpen(false);
      await refreshProjects();
      notifyDataChanged();
      if (isDrawer && onClose) {
        onClose();
      } else {
        navigate('/issues');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete issue');
    } finally {
      setDeletingIssue(false);
    }
  };

  const projectAssignableMembers = useMemo(() => {
    if (!issue) return members;
    const matchedProject = projects.find((p) => p._id === issue.project._id);
    const base =
      matchedProject && matchedProject.members && matchedProject.members.length > 0
        ? matchedProject.members
        : members;
    if (issue.assignee && !base.some((m) => m._id === issue.assignee!._id)) {
      return [...base, issue.assignee];
    }
    return base;
  }, [issue, projects, members]);

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-5 w-28 bg-[#E4E2DC] dark:bg-[#2E2D2A] rounded" />
        <div className="h-7 w-3/4 bg-[#E4E2DC] dark:bg-[#2E2D2A] rounded" />
        <div className="h-24 w-full bg-[#F0EFEA] dark:bg-[#252422] rounded" />
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-[13px] text-[#B3473B]">{error || 'Issue not found'}</p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded border border-[#E4E2DC] bg-white text-[#1F1F1E]"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  const matchedProject = projects.find((p) => p._id === issue.project._id);
  const projectRole =
    matchedProject?.myProjectRole ||
    (matchedProject?.owner?._id === user?._id
      ? 'Owner'
      : matchedProject?.lead?._id === user?._id
      ? 'Admin'
      : 'Member');
  const isViewer = projectRole === 'Viewer';
  const canDeleteIssue =
    projectRole === 'Owner' ||
    projectRole === 'Admin' ||
    (projectRole === 'Member' && user?._id === issue.reporter?._id);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#201F1D]">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[#E4E2DC] dark:border-[#2E2D2A] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to={`/projects/${issue.project._id}`}
            onClick={() => isDrawer && onClose?.()}
            className="text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE] truncate"
          >
            {issue.project.name}
          </Link>
          <span className="text-[#DCD9D0] dark:text-[#3A3835]">/</span>
          <span className="font-mono text-xs font-medium text-[#1F1F1E] dark:text-[#F3F0EE] shrink-0">
            {issue.issueKey}
          </span>
          {isViewer && (
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#F0EFEA] dark:bg-[#2A2926] text-[#6B6964] dark:text-[#A8A49B]">
              Read-only
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isDrawer && (
            <Link
              to={`/issues/${issue._id}`}
              onClick={onClose}
              title="Open full issue page"
              className="p-1.5 rounded text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE] hover:bg-[#F4F3EE] dark:hover:bg-[#2A2926]"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
          )}
          {canDeleteIssue && (
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              title="Delete issue"
              className="p-1.5 rounded text-[#6B6964] hover:text-[#B3473B] hover:bg-[#FBEAE8] dark:hover:bg-[#361E1C] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {isDrawer && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close inspector"
              className="p-1.5 rounded text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE] hover:bg-[#F4F3EE] dark:hover:bg-[#2A2926]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div
        className={`flex-1 overflow-y-auto ${
          isDrawer
            ? 'divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A]'
            : 'grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[#E4E2DC] dark:divide-[#2E2D2A]'
        }`}
      >
        {/* Left / Primary Content */}
        <div className={`${isDrawer ? '' : 'lg:col-span-2'} p-5 space-y-6`}>
          {/* Title & Description */}
          <div>
            {editingContent ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="w-full px-3 py-2 text-[16px] font-semibold rounded border border-[#C56A45] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none"
                />
                <textarea
                  rows={4}
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  placeholder="Add detailed context or notes..."
                  className="w-full p-3 text-[13px] leading-relaxed rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none focus:border-[#C56A45]"
                />

                <div>
                  <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                    Labels
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={draftLabelInput}
                      onChange={(e) => setDraftLabelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          const val = draftLabelInput.trim().replace(/,$/, '').slice(0, 32);
                          if (
                            val &&
                            draftLabels.length < 10 &&
                            !draftLabels.some((l) => l.toLowerCase() === val.toLowerCase())
                          ) {
                            setDraftLabels((prev) => [...prev, val]);
                            setDraftLabelInput('');
                          }
                        }
                      }}
                      placeholder="Add label and press Enter..."
                      className="flex-1 h-8 px-2.5 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
                    />
                  </div>
                  {draftLabels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {draftLabels.map((lbl) => (
                        <span
                          key={lbl}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono rounded border border-[#DCD9D0] dark:border-[#3A3835] bg-[#F4F3EE] dark:bg-[#252422]"
                        >
                          <span>{lbl}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setDraftLabels((prev) => prev.filter((l) => l !== lbl))
                            }
                            className="text-[#8C8983] hover:text-[#B3473B]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {issue.type === 'Bug' && (
                  <div className="rounded border border-[#E4E2DC] dark:border-[#34322E] bg-[#FAFAF8] dark:bg-[#191816] p-3 space-y-2.5 text-xs">
                    <p className="font-mono text-[10.5px] uppercase tracking-wider text-[#B3473B] dark:text-[#EB8B80]">
                      Bug Details (Optional)
                    </p>
                    <textarea
                      rows={2}
                      placeholder="Steps to reproduce..."
                      value={draftBugDetails.stepsToReproduce || ''}
                      onChange={(e) =>
                        setDraftBugDetails((prev) => ({
                          ...prev,
                          stepsToReproduce: e.target.value,
                        }))
                      }
                      className="w-full p-2 rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Expected result"
                        value={draftBugDetails.expectedResult || ''}
                        onChange={(e) =>
                          setDraftBugDetails((prev) => ({
                            ...prev,
                            expectedResult: e.target.value,
                          }))
                        }
                        className="h-8 px-2.5 rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
                      />
                      <input
                        type="text"
                        placeholder="Actual result"
                        value={draftBugDetails.actualResult || ''}
                        onChange={(e) =>
                          setDraftBugDetails((prev) => ({
                            ...prev,
                            actualResult: e.target.value,
                          }))
                        }
                        className="h-8 px-2.5 rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Browser / environment"
                      value={draftBugDetails.environment || ''}
                      onChange={(e) =>
                        setDraftBugDetails((prev) => ({
                          ...prev,
                          environment: e.target.value,
                        }))
                      }
                      className="w-full h-8 px-2.5 rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
                    />
                  </div>
                )}

                {issue.type === 'Feature Request' && (
                  <div className="rounded border border-[#E4E2DC] dark:border-[#34322E] bg-[#FAFAF8] dark:bg-[#191816] p-3 space-y-2.5 text-xs">
                    <p className="font-mono text-[10.5px] uppercase tracking-wider text-[#C56A45]">
                      Feature Request Details (Optional)
                    </p>
                    <textarea
                      rows={2}
                      placeholder="Feature description..."
                      value={draftFeatureDetails.featureDescription || ''}
                      onChange={(e) =>
                        setDraftFeatureDetails((prev) => ({
                          ...prev,
                          featureDescription: e.target.value,
                        }))
                      }
                      className="w-full p-2 rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Reason for request"
                        value={draftFeatureDetails.reasonForRequest || ''}
                        onChange={(e) =>
                          setDraftFeatureDetails((prev) => ({
                            ...prev,
                            reasonForRequest: e.target.value,
                          }))
                        }
                        className="h-8 px-2.5 rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
                      />
                      <input
                        type="text"
                        placeholder="Expected outcome"
                        value={draftFeatureDetails.expectedOutcome || ''}
                        onChange={(e) =>
                          setDraftFeatureDetails((prev) => ({
                            ...prev,
                            expectedOutcome: e.target.value,
                          }))
                        }
                        className="h-8 px-2.5 rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveTitleDescription}
                    disabled={savingContent}
                    className="px-3.5 py-1.5 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white whitespace-nowrap shrink-0"
                  >
                    {savingContent ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftTitle(issue.title);
                      setDraftDescription(issue.description || '');
                      setDraftLabels(issue.labels || []);
                      setDraftLabelInput('');
                      setDraftBugDetails(issue.bugDetails || {});
                      setDraftFeatureDetails(issue.featureDetails || {});
                      setEditingContent(false);
                    }}
                    className="px-3.5 py-1.5 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#252422] text-[#1F1F1E] dark:text-[#F3F0EE]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="group">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-[18px] font-semibold leading-snug tracking-tight text-[#1F1F1E] dark:text-[#F3F0EE]">
                    {issue.title}
                  </h1>
                  {!isViewer && (
                    <button
                      type="button"
                      onClick={() => setEditingContent(true)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE] hover:bg-[#F4F3EE] dark:hover:bg-[#2A2926] rounded shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#6B6964] dark:text-[#A8A49B]">
                  <StatusBadge status={issue.status} />
                  <span aria-hidden="true">·</span>
                  <PriorityBadge priority={issue.priority} />
                  <span aria-hidden="true">·</span>
                  <TypeIndicator type={issue.type} />
                </div>

                {issue.labels && issue.labels.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {issue.labels.map((lbl) => (
                      <span
                        key={lbl}
                        className="inline-block px-2 py-0.5 text-[11px] font-mono rounded border border-[#E4E2DC] dark:border-[#34322E] bg-[#FAFAF8] dark:bg-[#191816] text-[#6B6964] dark:text-[#A8A49B]"
                      >
                        {lbl}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 text-[14px] leading-relaxed text-[#1F1F1E]/90 dark:text-[#E5E2DC] whitespace-pre-wrap">
                  {issue.description ? (
                    issue.description
                  ) : (
                    <span className="italic text-[#8C8983]">
                      {isViewer
                        ? 'No description provided.'
                        : 'No description provided yet. Click Edit to add context.'}
                    </span>
                  )}
                </div>

                {issue.type === 'Bug' &&
                  issue.bugDetails &&
                  (issue.bugDetails.stepsToReproduce ||
                    issue.bugDetails.expectedResult ||
                    issue.bugDetails.actualResult ||
                    issue.bugDetails.environment) && (
                    <div className="mt-4 rounded-md border border-[#E4E2DC] dark:border-[#2E2D2A] bg-[#FAFAF8] dark:bg-[#191816] p-3.5 space-y-2.5 text-xs">
                      <div className="font-mono text-[10.5px] uppercase tracking-wider text-[#B3473B] dark:text-[#EB8B80]">
                        Bug Report Details
                      </div>
                      {issue.bugDetails.stepsToReproduce && (
                        <div>
                          <div className="font-medium text-[#6B6964] dark:text-[#A8A49B]">
                            Steps to Reproduce
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap text-[#1F1F1E] dark:text-[#E5E2DC]">
                            {issue.bugDetails.stepsToReproduce}
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {issue.bugDetails.expectedResult && (
                          <div>
                            <div className="font-medium text-[#6B6964] dark:text-[#A8A49B]">
                              Expected Result
                            </div>
                            <p className="mt-0.5 text-[#1F1F1E] dark:text-[#E5E2DC]">
                              {issue.bugDetails.expectedResult}
                            </p>
                          </div>
                        )}
                        {issue.bugDetails.actualResult && (
                          <div>
                            <div className="font-medium text-[#6B6964] dark:text-[#A8A49B]">
                              Actual Result
                            </div>
                            <p className="mt-0.5 text-[#1F1F1E] dark:text-[#E5E2DC]">
                              {issue.bugDetails.actualResult}
                            </p>
                          </div>
                        )}
                      </div>
                      {issue.bugDetails.environment && (
                        <div>
                          <div className="font-medium text-[#6B6964] dark:text-[#A8A49B]">
                            Browser / Environment
                          </div>
                          <p className="mt-0.5 font-mono text-[11.5px] text-[#1F1F1E] dark:text-[#E5E2DC]">
                            {issue.bugDetails.environment}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                {issue.type === 'Feature Request' &&
                  issue.featureDetails &&
                  (issue.featureDetails.featureDescription ||
                    issue.featureDetails.reasonForRequest ||
                    issue.featureDetails.expectedOutcome) && (
                    <div className="mt-4 rounded-md border border-[#E4E2DC] dark:border-[#2E2D2A] bg-[#FAFAF8] dark:bg-[#191816] p-3.5 space-y-2.5 text-xs">
                      <div className="font-mono text-[10.5px] uppercase tracking-wider text-[#C56A45]">
                        Feature Request Details
                      </div>
                      {issue.featureDetails.featureDescription && (
                        <div>
                          <div className="font-medium text-[#6B6964] dark:text-[#A8A49B]">
                            Feature Description
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap text-[#1F1F1E] dark:text-[#E5E2DC]">
                            {issue.featureDetails.featureDescription}
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {issue.featureDetails.reasonForRequest && (
                          <div>
                            <div className="font-medium text-[#6B6964] dark:text-[#A8A49B]">
                              Reason for Request
                            </div>
                            <p className="mt-0.5 text-[#1F1F1E] dark:text-[#E5E2DC]">
                              {issue.featureDetails.reasonForRequest}
                            </p>
                          </div>
                        )}
                        {issue.featureDetails.expectedOutcome && (
                          <div>
                            <div className="font-medium text-[#6B6964] dark:text-[#A8A49B]">
                              Expected Outcome
                            </div>
                            <p className="mt-0.5 text-[#1F1F1E] dark:text-[#E5E2DC]">
                              {issue.featureDetails.expectedOutcome}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* Drawer inline metadata grid (shown in drawer mode; full-page uses right column) */}
          {isDrawer && (
            <div className="pt-4 border-t border-[#E4E2DC] dark:border-[#2E2D2A]">
              <MetadataPanel
                issue={issue}
                members={projectAssignableMembers}
                onUpdate={handleFieldUpdate}
                readOnly={isViewer}
              />
            </div>
          )}

          {/* Attachments */}
          <div className="pt-4 border-t border-[#E4E2DC] dark:border-[#2E2D2A] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                <Paperclip className="w-3.5 h-3.5 text-[#6B6964]" />
                <span>Attachments ({issue.attachments.length})</span>
              </div>
              {!isViewer && (
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#252422] text-[#1F1F1E] dark:text-[#F3F0EE] hover:bg-[#F7F6F2] dark:hover:bg-[#2E2D2A] cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingFile ? 'Uploading...' : 'Attach File'}</span>
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploadingFile}
                    onChange={handleFileUpload}
                  />
                </label>
              )}
            </div>

            {issue.attachments.length === 0 ? (
              <p className="text-xs text-[#8C8983]">No files attached to this issue.</p>
            ) : (
              <div className="divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A] border border-[#E4E2DC] dark:border-[#2E2D2A] rounded">
                {issue.attachments.map((att) => (
                  <div
                    key={att._id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-xs bg-[#FAFAF8] dark:bg-[#1A1918]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-[#6B6964] shrink-0" />
                      <div className="min-w-0">
                        <a
                          href={att.url}
                          download={att.originalName}
                          className="font-medium text-[#1F1F1E] dark:text-[#F3F0EE] hover:underline truncate block"
                        >
                          {att.originalName}
                        </a>
                        <span className="font-mono text-[11px] text-[#8C8983]">
                          {formatFileSize(att.size)} · {formatRelativeTime(att.uploadedAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={att.url}
                        download={att.originalName}
                        className="p-1 text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE]"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      {!isViewer && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(att._id)}
                          className="p-1 text-[#6B6964] hover:text-[#B3473B]"
                          title="Remove attachment"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comments & Activity Tabs */}
          <div className="pt-4 border-t border-[#E4E2DC] dark:border-[#2E2D2A] space-y-4">
            <div className="flex items-center gap-4 border-b border-[#E4E2DC] dark:border-[#2E2D2A]">
              <button
                type="button"
                onClick={() => setActiveTab('comments')}
                className={`pb-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'comments'
                    ? 'border-[#C56A45] text-[#1F1F1E] dark:text-[#F3F0EE]'
                    : 'border-transparent text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE]'
                }`}
              >
                Comments ({comments.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className={`pb-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'activity'
                    ? 'border-[#C56A45] text-[#1F1F1E] dark:text-[#F3F0EE]'
                    : 'border-transparent text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE]'
                }`}
              >
                Activity History ({activities.length})
              </button>
            </div>

            {activeTab === 'comments' ? (
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <div className="py-4 text-center text-xs text-[#8C8983]">
                    <MessageSquare className="w-4 h-4 mx-auto mb-1 opacity-60" />
                    No comments yet. Start the discussion below.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comments.map((comment) => {
                      const isAuthor = user?._id === comment.user._id;
                      const canEditComment = isAuthor && !isViewer;
                      const canDeleteComment =
                        (!isViewer && isAuthor) ||
                        projectRole === 'Owner' ||
                        projectRole === 'Admin';
                      const isEditing = editingCommentId === comment._id;
                      const wasEdited =
                        comment.updatedAt &&
                        comment.createdAt &&
                        new Date(comment.updatedAt).getTime() -
                          new Date(comment.createdAt).getTime() >
                          1000;
                      return (
                        <div
                          key={comment._id}
                          className="p-3 rounded border border-[#E4E2DC] dark:border-[#2E2D2A] bg-[#FAFAF8] dark:bg-[#1A1918] space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar
                                name={comment.user.name}
                                color={comment.user.avatarColor}
                                size="xs"
                              />
                              <span className="text-xs font-medium text-[#1F1F1E] dark:text-[#F3F0EE] truncate">
                                {comment.user.name}
                              </span>
                              <span className="text-[11px] font-mono text-[#8C8983] shrink-0">
                                {formatRelativeTime(comment.createdAt)}
                                {wasEdited ? ' · edited' : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {canEditComment && !isEditing && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCommentId(comment._id);
                                    setEditingCommentText(comment.text);
                                  }}
                                  className="text-[11px] text-[#8C8983] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE]"
                                >
                                  Edit
                                </button>
                              )}
                              {canDeleteComment && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(comment._id)}
                                  className="text-[11px] text-[#8C8983] hover:text-[#B3473B]"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                          {isEditing ? (
                            <div className="pl-7 space-y-2 pt-1">
                              <textarea
                                rows={3}
                                value={editingCommentText}
                                onChange={(e) => setEditingCommentText(e.target.value)}
                                className="w-full p-2 text-[13px] rounded border border-[#C56A45] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none resize-y"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSaveCommentEdit(comment._id)}
                                  disabled={savingComment || !editingCommentText.trim()}
                                  className="px-2.5 py-1 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white disabled:opacity-50"
                                >
                                  {savingComment ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCommentId(null);
                                    setEditingCommentText('');
                                  }}
                                  disabled={savingComment}
                                  className="px-2.5 py-1 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[13px] leading-relaxed text-[#1F1F1E] dark:text-[#E5E2DC] whitespace-pre-wrap pl-7">
                              {comment.text}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {isViewer ? (
                  <div className="rounded border border-[#E4E2DC] dark:border-[#34322E] bg-[#FAFAF8] dark:bg-[#191816] px-3 py-2.5 text-xs text-[#6B6964] dark:text-[#A8A49B]">
                    Viewers have read-only access and cannot post comments.
                  </div>
                ) : (
                  <form onSubmit={handlePostComment} className="space-y-2">
                    <textarea
                      rows={3}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write a comment or update..."
                      className="w-full p-2.5 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] placeholder:text-[#8C8983] focus:outline-none focus:border-[#C56A45] resize-none"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={postingComment || !commentText.trim()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{postingComment ? 'Posting...' : 'Post Comment'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A]">
                {activities.length === 0 ? (
                  <p className="py-4 text-xs text-[#8C8983] text-center">
                    No activity recorded yet.
                  </p>
                ) : (
                  activities.map((act) => (
                    <div
                      key={act._id}
                      className="py-2.5 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <Avatar
                          name={act.user?.name}
                          color={act.user?.avatarColor}
                          size="xs"
                          className="mt-0.5"
                        />
                        <p className="text-[#1F1F1E] dark:text-[#E5E2DC] leading-relaxed">
                          <span className="font-medium">{act.user?.name}</span>{' '}
                          <span className="text-[#6B6964] dark:text-[#A8A49B]">
                            {act.description}
                          </span>
                        </p>
                      </div>
                      <span className="font-mono text-[11px] text-[#8C8983] shrink-0">
                        {formatRelativeTime(act.createdAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Full-page Right Metadata Sidebar */}
        {!isDrawer && (
          <div className="p-5 bg-[#FAFAF8] dark:bg-[#1A1918]">
            <MetadataPanel
              issue={issue}
              members={projectAssignableMembers}
              onUpdate={handleFieldUpdate}
              readOnly={isViewer}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        title={`Delete ${issue.issueKey}?`}
        description="This permanently removes the issue, its comments, and attachments from the project. Activity logs will preserve the issue key record."
        confirmLabel="Delete Issue"
        loading={deletingIssue}
        onConfirm={handleDeleteIssue}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}

function MetadataPanel({
  issue,
  members,
  onUpdate,
  readOnly = false,
}: {
  issue: Issue;
  members: Array<{ _id: string; name: string }>;
  onUpdate: (
    patch: Partial<{
      status: IssueStatus;
      priority: IssuePriority;
      type: IssueType;
      assignee: string | null;
      dueDate: string | null;
    }>
  ) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
            Status
          </label>
          <select
            disabled={readOnly}
            value={issue.status}
            onChange={(e) => onUpdate({ status: e.target.value as IssueStatus })}
            className="w-full h-8 px-2 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#201F1D] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none focus:border-[#C56A45] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">Done</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
            Priority
          </label>
          <select
            disabled={readOnly}
            value={issue.priority}
            onChange={(e) => onUpdate({ priority: e.target.value as IssuePriority })}
            className="w-full h-8 px-2 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#201F1D] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none focus:border-[#C56A45] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
            Type
          </label>
          <select
            disabled={readOnly}
            value={issue.type}
            onChange={(e) => onUpdate({ type: e.target.value as IssueType })}
            className="w-full h-8 px-2 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#201F1D] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none focus:border-[#C56A45] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {ISSUE_TYPES.map((issueType) => (
              <option key={issueType} value={issueType}>
                {issueType}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
            Assignee
          </label>
          <select
            disabled={readOnly}
            value={issue.assignee?._id || ''}
            onChange={(e) => onUpdate({ assignee: e.target.value || null })}
            className="w-full h-8 px-2 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#201F1D] text-[#1F1F1E] dark:text-[#F3F0EE] focus:outline-none focus:border-[#C56A45] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="pt-2 border-t border-[#E4E2DC] dark:border-[#2E2D2A] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#6B6964] dark:text-[#A8A49B] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Due Date
          </span>
          <div className="flex items-center gap-1">
            <input
              type="date"
              disabled={readOnly}
              value={issue.dueDate ? issue.dueDate.slice(0, 10) : ''}
              onChange={(e) => onUpdate({ dueDate: e.target.value || null })}
              className="h-7 px-2 text-xs font-mono rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#201F1D] text-[#1F1F1E] dark:text-[#F3F0EE] disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {issue.dueDate && !readOnly && (
              <button
                type="button"
                onClick={() => onUpdate({ dueDate: null })}
                title="Clear due date"
                className="p-1 rounded text-[#8C8983] hover:text-[#B3473B]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#6B6964] dark:text-[#A8A49B]">Reporter</span>
          <div className="flex items-center gap-1.5">
            <Avatar
              name={issue.reporter?.name}
              color={issue.reporter?.avatarColor}
              size="xs"
            />
            <span className="text-[#1F1F1E] dark:text-[#F3F0EE]">
              {issue.reporter?.name}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#6B6964] dark:text-[#A8A49B]">Created</span>
          <span className="font-mono text-[#1F1F1E] dark:text-[#F3F0EE]">
            {formatShortDate(issue.createdAt)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#6B6964] dark:text-[#A8A49B]">Updated</span>
          <span className="font-mono text-[#1F1F1E] dark:text-[#F3F0EE]">
            {formatRelativeTime(issue.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
