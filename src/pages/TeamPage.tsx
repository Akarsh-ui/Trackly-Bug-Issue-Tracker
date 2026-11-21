import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Ban,
  Check,
  Copy,
  ExternalLink,
  Link2,
  MailCheck,
  RefreshCw,
  RotateCcw,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
import { api, USE_REMOTE_API } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import type {
  Invitation,
  InvitationCreateResult,
  InvitationStatus,
  User,
  UserRole,
  UserStatus,
} from '../types';
import { Avatar } from '../components/Avatar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDate } from '../utils/formatters';
import { validateEmail } from '../utils/authValidation';
import { buildInvitationUrl } from '../utils/appUrl';

interface InviteForm {
  email: string;
  role: UserRole;
  projectId: string;
  message: string;
}

const INVITE_STATUS_BADGE: Record<InvitationStatus, string> = {
  Pending:
    'bg-[#FCF3E6] dark:bg-[#332719] text-[#9A5E19] dark:text-[#E5A95E] border-[#E7CFA6] dark:border-[#4F3B20]',
  Accepted:
    'bg-[#EEF3EE] dark:bg-[#1E2B20] text-[#3F5F43] dark:text-[#86B38B] border-[#CFE0D0] dark:border-[#2E4631]',
  Rejected:
    'bg-[#FBEAE8] dark:bg-[#361E1C] text-[#B3473B] dark:text-[#EB8B80] border-[#EDC8C3] dark:border-[#592E29]',
  Expired:
    'bg-[#F0EFEA] dark:bg-[#2A2926] text-[#6B6964] dark:text-[#A8A49B] border-[#DCD9D0] dark:border-[#3A3835]',
  Revoked:
    'bg-[#FBEAE8] dark:bg-[#361E1C] text-[#B3473B] dark:text-[#EB8B80] border-[#EDC8C3] dark:border-[#592E29]',
};

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function TeamPage() {
  const { user: currentUser } = useAuth();
  const { members, projects, dataVersion, notifyDataChanged } = useWorkspace();

  const manageableProjects = useMemo(
    () =>
      projects.filter(
        (p) =>
          p.myProjectRole === 'Owner' ||
          p.myProjectRole === 'Admin' ||
          p.owner?._id === currentUser?._id ||
          p.lead?._id === currentUser?._id
      ),
    [projects, currentUser?._id]
  );

  const canManageInvites = manageableProjects.length > 0;

  const [activeTab, setActiveTab] = useState<'directory' | 'invitations'>('directory');
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<InvitationCreateResult | null>(
    null
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteFilter, setInviteFilter] = useState<'all' | InvitationStatus>('all');
  const [resendTargetResult, setResendTargetResult] =
    useState<InvitationCreateResult | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Invitation | null>(null);
  const [revoking, setRevoking] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<InviteForm>({
    mode: 'onBlur',
    defaultValues: {
      email: '',
      role: 'Member',
      projectId: manageableProjects[0]?._id || '',
      message: '',
    },
  });

  const selectedInviteProjectId = watch('projectId');
  const selectedInviteProject = manageableProjects.find(
    (p) => p._id === selectedInviteProjectId
  );
  const isOwnerOfSelectedProject =
    selectedInviteProject?.myProjectRole === 'Owner' ||
    selectedInviteProject?.owner?._id === currentUser?._id;

  const loadInvitations = useCallback(async () => {
    if (!canManageInvites || !currentUser?._id) {
      setInvitations([]);
      return;
    }
    try {
      setInvitesLoading(true);
      const { invitations: list } = await api.invitations.list();
      setInvitations(list);
    } catch {
      setInvitations([]);
    } finally {
      setInvitesLoading(false);
    }
  }, [canManageInvites, currentUser?._id]);

  useEffect(() => {
    setInvitations([]);
    setResendTargetResult(null);
    setCreatedInvite(null);
  }, [currentUser?._id]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations, dataVersion]);

  useEffect(() => {
    if (!inviteOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInviteOpen(false);
        setCreatedInvite(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inviteOpen]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
    );
  }, [members, search]);

  const filteredInvitations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invitations.filter((inv) => {
      if (inviteFilter !== 'all' && inv.status !== inviteFilter) return false;
      if (!q) return true;
      return (
        inv.email.toLowerCase().includes(q) ||
        inv.role.toLowerCase().includes(q) ||
        (inv.project?.name || '').toLowerCase().includes(q)
      );
    });
  }, [invitations, inviteFilter, search]);

  const pendingCount = invitations.filter((inv) => inv.status === 'Pending').length;

  const openInviteModal = () => {
    setCreatedInvite(null);
    reset({
      email: '',
      role: 'Member',
      projectId: manageableProjects[0]?._id || '',
      message: '',
    });
    setInviteOpen(true);
  };

  const onCreateInvitation = async (values: InviteForm) => {
    if (inviting) return;
    if (!values.projectId) {
      toast.error('Please select a project for this invitation');
      return;
    }
    try {
      setInviting(true);
      const result = await api.invitations.create({
        email: values.email.trim(),
        role: values.role,
        projectId: values.projectId,
        message: values.message.trim(),
      });
      setCreatedInvite(result);
      toast.success(`Invitation link generated for ${result.invitation.email}`);
      await loadInvitations();
      notifyDataChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleCopyInviteUrl = async (invitePath: string, key: string) => {
    const fullUrl = buildInvitationUrl(invitePath);
    const ok = await copyTextToClipboard(fullUrl);
    if (ok) {
      setCopiedId(key);
      toast.success('Invitation link copied to clipboard');
      setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 2200);
    } else {
      toast.error('Unable to copy automatically. Select and copy the link manually.');
    }
  };

  const handleResendInvitation = async (inv: Invitation) => {
    try {
      const result = await api.invitations.resend(inv._id);
      setResendTargetResult(result);
      await loadInvitations();
      toast.success(`Generated fresh link for ${inv.email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend invitation');
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    try {
      setRevoking(true);
      await api.invitations.revoke(revokeTarget._id);
      toast.success(`Revoked invitation for ${revokeTarget.email}`);
      setRevokeTarget(null);
      await loadInvitations();
      notifyDataChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke invitation');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#1F1F1E] dark:text-[#F3F0EE]">
            Team & Invitations
          </h1>
          <p className="text-[13px] text-[#6B6964] dark:text-[#A8A49B]">
            Manage contributors, project access, roles, and shareable invitation links.
          </p>
        </div>

        {canManageInvites && (
          <button
            type="button"
            onClick={openInviteModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Invitation Link</span>
          </button>
        )}
      </div>

      {canManageInvites && members.length <= 1 && invitations.length === 0 && (
        <div className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-[#FAFAF8] dark:bg-[#201F1D] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
              Collaborate with your team
            </p>
            <p className="text-xs text-[#6B6964] dark:text-[#A8A49B]">
              Generate a 7-day invitation link with a pre-assigned role and project scope for teammates.
            </p>
          </div>
          <button
            type="button"
            onClick={openInviteModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#252422] hover:border-[#C56A45] whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <Link2 className="w-3.5 h-3.5 text-[#C56A45]" />
            <span>Invite Teammate</span>
          </button>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 border-b sm:border-b-0 border-[#E4E2DC] dark:border-[#2E2D2A]">
          <button
            type="button"
            onClick={() => setActiveTab('directory')}
            className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-white dark:bg-[#201F1D] border-[#DCD9D0] dark:border-[#3A3835] text-[#1F1F1E] dark:text-[#F3F0EE]'
                : 'border-transparent text-[#6B6964] dark:text-[#A8A49B] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE]'
            }`}
          >
            Members ({members.length})
          </button>
          {canManageInvites && (
            <button
              type="button"
              onClick={() => setActiveTab('invitations')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
                activeTab === 'invitations'
                  ? 'bg-white dark:bg-[#201F1D] border-[#DCD9D0] dark:border-[#3A3835] text-[#1F1F1E] dark:text-[#F3F0EE]'
                  : 'border-transparent text-[#6B6964] dark:text-[#A8A49B] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE]'
              }`}
            >
              <span>Invitations ({invitations.length})</span>
              {pendingCount > 0 && (
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-[#FDF3EE] dark:bg-[#33221A] text-[#C56A45]">
                  {pendingCount} pending
                </span>
              )}
            </button>
          )}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-[#8C8983] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === 'directory'
                ? 'Filter by name, email, or role...'
                : 'Filter invitations by email or project...'
            }
            className="w-full h-9 pl-8 pr-3 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#201F1D]"
          />
        </div>
      </div>

      {activeTab === 'directory' ? (
        <div className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] overflow-x-auto">
          {filteredMembers.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-[13px] text-[#6B6964] dark:text-[#A8A49B]">
                No team members match your search.
              </p>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835]"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear Search</span>
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[780px]">
              <thead>
                <tr className="border-b border-[#E4E2DC] dark:border-[#2E2D2A] bg-[#FAFAF8] dark:bg-[#1A1918] text-[11px] font-mono uppercase tracking-wider text-[#6B6964] dark:text-[#A8A49B]">
                  <th className="py-2.5 px-4 font-medium">Member</th>
                  <th className="py-2.5 px-4 font-medium">Role</th>
                  <th className="py-2.5 px-4 font-medium">Projects</th>
                  <th className="py-2.5 px-4 font-medium text-right">Assigned</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A] text-[13px]">
                {filteredMembers.map((member) => {
                  const isSelf = currentUser?._id === member._id;
                  return (
                    <tr
                      key={member._id}
                      className="hover:bg-[#F4F3EE] dark:hover:bg-[#252422] transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={member.name}
                            color={member.avatarColor}
                            size="md"
                          />
                          <div>
                            <div className="font-medium text-[#1F1F1E] dark:text-[#F3F0EE] flex items-center gap-1.5">
                              <span>{member.name}</span>
                              {isSelf && (
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#F0EFEA] dark:bg-[#2A2926] text-[#6B6964] dark:text-[#A8A49B]">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#6B6964] dark:text-[#A8A49B]">
                              {member.email} · {member.title || member.role}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-xs font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                          {member.role}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {member.projects && member.projects.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {member.projects.map((p) => (
                              <Link
                                key={p._id}
                                to={`/projects/${p._id}`}
                                className="inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#F0EFEA] dark:bg-[#2A2926] text-[#6B6964] dark:text-[#A8A49B] hover:text-[#C56A45]"
                              >
                                <span>{p.key}</span>
                                {p.projectRole && (
                                  <span className="text-[10px] text-[#8C8983]">
                                    · {p.projectRole}
                                  </span>
                                )}
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-[#8C8983]">No shared projects</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                        <span className="font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                          {member.openAssignedCount ?? 0} open
                        </span>
                        <span className="text-[#8C8983]">
                          {' '}
                          / {member.assignedCount ?? 0} total
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                            member.status === 'Active'
                              ? 'bg-[#EEF3EE] dark:bg-[#1E2B20] text-[#3F5F43] dark:text-[#86B38B]'
                              : member.status === 'Invited'
                                ? 'bg-[#FCF3E6] dark:bg-[#332719] text-[#9A5E19] dark:text-[#E5A95E]'
                                : 'bg-[#F0EFEA] dark:bg-[#2A2926] text-[#6B6964]'
                          }`}
                        >
                          {member.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {!USE_REMOTE_API && (
            <div className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-[#FAFAF8] dark:bg-[#201F1D] px-4 py-2.5 text-xs text-[#6B6964] dark:text-[#A8A49B]">
              In temporary local storage mode, invitation links are stored in this browser only and no email is sent. Use{' '}
              <span className="font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                Generate New Link
              </span>{' '}
              to copy an active URL for testing in this browser.
            </div>
          )}

          {resendTargetResult && (
            <div className="rounded-lg border border-[#557A59]/40 bg-[#EEF3EE] dark:bg-[#1E2B20] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-semibold text-[#3F5F43] dark:text-[#86B38B]">
                  Fresh invitation link generated for {resendTargetResult.invitation.email}
                </p>
                <p className="font-mono text-[11px] text-[#1F1F1E] dark:text-[#F3F0EE] truncate">
                  {buildInvitationUrl(resendTargetResult.invitePath)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to={resendTargetResult.invitePath}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-[#3F5F43]/30 text-[#3F5F43] dark:text-[#86B38B] hover:bg-white/60 dark:hover:bg-black/20"
                >
                  <span>Preview</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyInviteUrl(resendTargetResult.invitePath, 'resend-banner')
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#3F5F43] text-white cursor-pointer"
                >
                  {copiedId === 'resend-banner' ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedId === 'resend-banner' ? 'Copied' : 'Copy Link'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setResendTargetResult(null)}
                  className="p-1.5 text-[#3F5F43] dark:text-[#86B38B]"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'Pending', 'Accepted', 'Rejected', 'Expired', 'Revoked'] as const).map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setInviteFilter(st)}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer ${
                    inviteFilter === st
                      ? 'bg-[#1F1F1E] dark:bg-[#C56A45] text-white border-transparent'
                      : 'bg-white dark:bg-[#201F1D] border-[#E4E2DC] dark:border-[#3A3835] text-[#6B6964] dark:text-[#A8A49B]'
                  }`}
                >
                  {st === 'all' ? 'All' : st}
                </button>
              )
            )}
          </div>

          <div className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] overflow-x-auto">
            {invitesLoading ? (
              <div className="p-8 text-center text-xs font-mono text-[#6B6964]">
                Loading invitations...
              </div>
            ) : filteredInvitations.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <p className="text-[13px] text-[#6B6964] dark:text-[#A8A49B]">
                  {invitations.length === 0
                    ? 'No team invitations have been created yet.'
                    : 'No invitations match the active filter.'}
                </p>
                {invitations.length === 0 && (
                  <button
                    type="button"
                    onClick={openInviteModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded bg-[#C56A45] text-white cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Create First Invitation</span>
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[820px]">
                <thead>
                  <tr className="border-b border-[#E4E2DC] dark:border-[#2E2D2A] bg-[#FAFAF8] dark:bg-[#1A1918] text-[11px] font-mono uppercase tracking-wider text-[#6B6964] dark:text-[#A8A49B]">
                    <th className="py-2.5 px-4 font-medium">Invitee</th>
                    <th className="py-2.5 px-4 font-medium">Role & Scope</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium">Created / Expires</th>
                    <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A] text-[13px]">
                  {filteredInvitations.map((inv) => (
                    <tr
                      key={inv._id}
                      className="hover:bg-[#F4F3EE] dark:hover:bg-[#252422] transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                          {inv.email}
                        </div>
                        <div className="text-xs text-[#6B6964] dark:text-[#A8A49B]">
                          Invited by {inv.invitedBy?.name || 'Admin'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                            {inv.role}
                          </span>
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#F0EFEA] dark:bg-[#2A2926] text-[#6B6964] dark:text-[#A8A49B]">
                            {inv.project ? inv.project.key : 'Workspace'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${
                            INVITE_STATUS_BADGE[inv.status]
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs font-mono text-[#6B6964] dark:text-[#A8A49B]">
                        <div>Created {formatDate(inv.createdAt)}</div>
                        <div>
                          {inv.status === 'Accepted' && inv.acceptedAt
                            ? `Accepted ${formatDate(inv.acceptedAt)}`
                            : inv.status === 'Rejected' && inv.rejectedAt
                              ? `Declined ${formatDate(inv.rejectedAt)}`
                              : inv.status === 'Revoked' && inv.revokedAt
                                ? `Revoked ${formatDate(inv.revokedAt)}`
                                : `Expires ${formatDate(inv.expiresAt)}`}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {(inv.status === 'Pending' || inv.status === 'Expired') && (
                            <button
                              type="button"
                              onClick={() => handleResendInvitation(inv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835] hover:border-[#C56A45] cursor-pointer"
                              title="Rotate token, extend expiry by 7 days, and copy a new link"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Generate New Link</span>
                            </button>
                          )}
                          {inv.status === 'Pending' && (
                            <button
                              type="button"
                              onClick={() => setRevokeTarget(inv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835] text-[#B3473B] hover:border-[#B3473B] cursor-pointer"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Revoke</span>
                            </button>
                          )}
                          {(inv.status === 'Accepted' ||
                            inv.status === 'Rejected' ||
                            inv.status === 'Revoked') && (
                            <span className="text-xs text-[#8C8983]">Closed</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Create Invitation Modal */}
      {inviteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1F1E]/30 dark:bg-black/60 p-4"
          onClick={() => {
            setInviteOpen(false);
            setCreatedInvite(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-member-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90vh] flex flex-col rounded-lg bg-white dark:bg-[#201F1D] border border-[#DCD9D0] dark:border-[#3A3835] shadow-[0_12px_32px_rgba(31,31,30,0.08)] overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E4E2DC] dark:border-[#2E2D2A] shrink-0">
              <h2 id="invite-member-title" className="text-[15px] font-semibold">
                {createdInvite ? 'Invitation Link Ready' : 'Invite Team Member'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setInviteOpen(false);
                  setCreatedInvite(null);
                }}
                className="p-1 rounded text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE]"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdInvite ? (
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="rounded-lg border border-[#557A59]/35 bg-[#EEF3EE] dark:bg-[#1E2B20] p-3.5 flex items-start gap-2.5">
                  <MailCheck className="w-4 h-4 text-[#3F5F43] dark:text-[#86B38B] shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-[#3F5F43] dark:text-[#86B38B]">
                      Invitation created (Pending)
                    </p>
                    <p className="text-[#4A4844] dark:text-[#C5C0B6]">
                      Share this private link with{' '}
                      <span className="font-mono font-medium">
                        {createdInvite.invitation.email}
                      </span>
                      . It expires on {formatDate(createdInvite.invitation.expiresAt)}.
                    </p>
                  </div>
                </div>

                {!USE_REMOTE_API && (
                  <p className="text-[11.5px] text-[#6B6964] dark:text-[#A8A49B] rounded border border-[#E4E2DC] dark:border-[#34322E] bg-[#FAFAF8] dark:bg-[#191816] px-3 py-2">
                    Temporary localStorage mode: no email was sent. Copy the link below to open or test it in this browser.
                  </p>
                )}

                <div>
                  <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1.5">
                    Shareable Invitation URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={buildInvitationUrl(createdInvite.invitePath)}
                      onFocus={(e) => e.target.select()}
                      className="flex-1 h-9 px-2.5 font-mono text-[11.5px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-[#FAFAF8] dark:bg-[#181817]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyInviteUrl(createdInvite.invitePath, 'modal-copy')
                      }
                      className="h-9 px-3 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      {copiedId === 'modal-copy' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedId === 'modal-copy' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#E4E2DC] dark:border-[#2E2D2A]">
                  <Link
                    to={createdInvite.invitePath}
                    onClick={() => setInviteOpen(false)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#C56A45] hover:underline"
                  >
                    <span>Preview Invite Page</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCreatedInvite(null);
                        reset({
                          email: '',
                          role: 'Member',
                          projectId: manageableProjects[0]?._id || '',
                          message: '',
                        });
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835]"
                    >
                      Invite Another
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInviteOpen(false);
                        setCreatedInvite(null);
                      }}
                      className="px-3.5 py-1.5 text-xs font-medium rounded bg-[#1F1F1E] dark:bg-[#C56A45] text-white"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit(onCreateInvitation)}
                className="p-5 space-y-4 overflow-y-auto flex-1"
                noValidate
              >
                {!USE_REMOTE_API && (
                  <div className="rounded border border-[#E4E2DC] dark:border-[#34322E] bg-[#FAFAF8] dark:bg-[#191816] px-3 py-2 text-[11.5px] text-[#6B6964] dark:text-[#A8A49B]">
                    Local storage mode generates a working invitation link in this browser without sending an email.
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                    Email Address <span className="text-[#B3473B]">*</span>
                  </label>
                  <input
                    type="email"
                    autoFocus
                    placeholder="teammate@company.com"
                    {...register('email', {
                      validate: (val) => validateEmail(val) || true,
                    })}
                    className="w-full h-9 px-3 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-[#B3473B]">{errors.email.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                      Assigned Role
                    </label>
                    <select
                      {...register('role')}
                      className="w-full h-9 px-2.5 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
                    >
                      <option value="Member">Member</option>
                      <option value="Viewer">Viewer (Read-only)</option>
                      <option value="Developer">Developer</option>
                      <option value="Engineering Lead">Engineering Lead</option>
                      <option value="QA Engineer">QA Engineer</option>
                      <option value="Designer">Designer</option>
                      {isOwnerOfSelectedProject && <option value="Admin">Admin</option>}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                      Project Scope <span className="text-[#B3473B]">*</span>
                    </label>
                    <select
                      {...register('projectId', { required: 'Select a project' })}
                      className="w-full h-9 px-2.5 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
                    >
                      {manageableProjects.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.key} · {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                    Personal Note (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Welcome to the engineering workspace..."
                    {...register('message')}
                    className="w-full px-3 py-2 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E2DC] dark:border-[#2E2D2A]">
                  <button
                    type="button"
                    onClick={() => setInviteOpen(false)}
                    className="px-3.5 py-2 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-4 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white disabled:opacity-60 cursor-pointer"
                  >
                    {inviting ? 'Generating...' : 'Generate Invitation Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="Revoke Invitation"
        description={
          revokeTarget
            ? `Revoke the pending invitation for ${revokeTarget.email}? The link will immediately stop working.`
            : ''
        }
        confirmLabel="Revoke Invitation"
        destructive
        loading={revoking}
        onConfirm={handleConfirmRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
}
