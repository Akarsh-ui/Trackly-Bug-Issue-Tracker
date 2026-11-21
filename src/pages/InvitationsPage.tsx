import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  ArrowRight,
  Check,
  FolderKanban,
  Loader2,
  MailCheck,
  RefreshCw,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import type { Invitation } from '../types';
import { formatDate } from '../utils/formatters';

export function InvitationsPage() {
  const navigate = useNavigate();
  const { updateUserLocal } = useAuth();
  const {
    pendingInvitations,
    loadingPendingInvitations,
    pendingInvitationsError,
    refreshPendingInvitations,
    refreshProjects,
    refreshMembers,
    notifyDataChanged,
  } = useWorkspace();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const handleAccept = async (inv: Invitation) => {
    if (busyId) return;
    try {
      setBusyId(inv._id);
      setActionError('');
      const res = await api.invitations.acceptById(inv._id);
      if (res.user) {
        updateUserLocal(res.user);
      }
      await Promise.all([
        refreshPendingInvitations(),
        refreshProjects(),
        refreshMembers(),
      ]);
      notifyDataChanged();
      toast.success(
        inv.project
          ? `Joined ${inv.project.name} as ${inv.role}`
          : 'Invitation accepted'
      );
      if (res.projectId) {
        navigate(`/projects/${res.projectId}`);
      } else {
        navigate('/');
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to accept invitation.';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (inv: Invitation) => {
    if (busyId) return;
    try {
      setBusyId(inv._id);
      setActionError('');
      await api.invitations.rejectById(inv._id);
      await refreshPendingInvitations();
      notifyDataChanged();
      toast.success('Invitation declined');
      if (pendingInvitations.length <= 1) {
        navigate('/');
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to decline invitation.';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#1F1F1E] dark:text-[#F3F0EE]">
            Pending Invitations
          </h1>
          <p className="text-[13px] text-[#6B6964] dark:text-[#A8A49B]">
            Review project collaboration invitations issued to your account email before joining.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refreshPendingInvitations()}
          disabled={loadingPendingInvitations}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#201F1D] hover:border-[#C56A45] self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loadingPendingInvitations ? 'animate-spin' : ''}`}
          />
          <span>Refresh</span>
        </button>
      </div>

      {(pendingInvitationsError || actionError) && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 p-3.5 rounded-lg border border-[#B3473B]/35 bg-[#FBEAE8] dark:bg-[#361E1C] text-xs text-[#B3473B] dark:text-[#EB8B80]"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{actionError || pendingInvitationsError}</span>
          </div>
          {pendingInvitationsError && (
            <button
              type="button"
              onClick={() => refreshPendingInvitations()}
              className="underline font-medium shrink-0 cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {loadingPendingInvitations && pendingInvitations.length === 0 ? (
        <div className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] p-8 space-y-3 animate-pulse">
          <div className="h-5 w-48 bg-[#E4E2DC] dark:bg-[#2E2D2A] rounded" />
          <div className="h-16 w-full bg-[#F4F3EE] dark:bg-[#252422] rounded" />
        </div>
      ) : pendingInvitations.length === 0 ? (
        <div className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] p-10 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-[#FAFAF8] dark:bg-[#252422] border border-[#E4E2DC] dark:border-[#34322E] flex items-center justify-center mx-auto">
            <MailCheck className="w-5 h-5 text-[#6B6964]" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-[#1F1F1E] dark:text-[#F3F0EE]">
              No pending invitations
            </h2>
            <p className="mt-1 text-xs text-[#6B6964] dark:text-[#A8A49B]">
              When someone invites you to collaborate on a Trackly project, it will appear here for your approval.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white"
          >
            <span>Return to Overview</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingInvitations.map((inv) => {
            const isBusy = busyId === inv._id;
            return (
              <div
                key={inv._id}
                className="rounded-lg border border-[#DCD9D0] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] overflow-hidden"
              >
                <div className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {inv.project && (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-[#F0EFEA] dark:bg-[#2A2926] text-[#1F1F1E] dark:text-[#F3F0EE] border border-[#E4E2DC] dark:border-[#3A3835]">
                          <FolderKanban className="w-3 h-3 text-[#C56A45]" />
                          <span>{inv.project.key}</span>
                        </span>
                      )}
                      <h2 className="text-[15px] font-semibold text-[#1F1F1E] dark:text-[#F3F0EE]">
                        {inv.project?.name || inv.workspaceName}
                      </h2>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#FDF3EE] dark:bg-[#33221A] text-[#C56A45]">
                        Role: {inv.role}
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#FCF3E6] dark:bg-[#332719] text-[#9A5E19] dark:text-[#E5A95E]">
                        {inv.status}
                      </span>
                    </div>

                    {inv.project?.description && (
                      <p className="text-[13px] text-[#4A4844] dark:text-[#C5C0B6]">
                        {inv.project.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B6964] dark:text-[#A8A49B]">
                      <span>
                        Invited by{' '}
                        <strong className="font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                          {inv.invitedBy?.name}
                        </strong>
                      </span>
                      <span className="font-mono text-[11px]">
                        Invited {formatDate(inv.createdAt)}
                      </span>
                      <span className="font-mono text-[11px]">
                        Expires {formatDate(inv.expiresAt)}
                      </span>
                    </div>

                    {inv.message && (
                      <blockquote className="pl-3 border-l-2 border-[#C56A45]/60 text-xs italic text-[#4A4844] dark:text-[#C5C0B6]">
                        "{inv.message}"
                      </blockquote>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => handleReject(inv)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#252422] text-[#6B6964] dark:text-[#C5C0B6] hover:text-[#B3473B] hover:border-[#B3473B] disabled:opacity-50 cursor-pointer"
                    >
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => handleAccept(inv)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white disabled:opacity-50 cursor-pointer"
                    >
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Accept Invitation</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
