import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  ArrowRight,
  Ban,
  CalendarClock,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  FolderKanban,
  Loader2,
  Lock,
  LogOut,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { api, USE_REMOTE_API } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import type { InvitationValidation } from '../types';
import { formatDate } from '../utils/formatters';
import { evaluatePasswordStrength } from '../utils/passwordStrength';
import {
  normalizeFullName,
  validateFullName,
  validatePassword,
} from '../utils/authValidation';

interface InviteRegisterForm {
  name: string;
  password: string;
  confirmPassword: string;
}

interface InviteLoginForm {
  password: string;
}

const STRENGTH_BAR_COLORS: Record<number, string> = {
  1: 'bg-[#B3473B]',
  2: 'bg-[#C47D2B]',
  3: 'bg-[#C56A45]',
  4: 'bg-[#557A59]',
};

export function AcceptInvitePage() {
  const { token: rawParamToken } = useParams<{ token: string }>();
  const token = (() => {
    const trimmed = String(rawParamToken || '').trim();
    if (!trimmed) return '';
    try {
      return decodeURIComponent(trimmed).trim();
    } catch {
      return trimmed;
    }
  })();
  const navigate = useNavigate();
  const {
    user,
    isAuthenticated,
    login,
    register: registerAccount,
    logout,
    updateUserLocal,
  } = useAuth();
  const {
    refreshMembers,
    refreshProjects,
    refreshPendingInvitations,
    notifyDataChanged,
  } = useWorkspace();

  const [checking, setChecking] = useState(true);
  const [validation, setValidation] = useState<InvitationValidation | null>(null);
  const [authTab, setAuthTab] = useState<'register' | 'login'>('register');
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const {
    register: regField,
    handleSubmit: handleRegisterSubmit,
    watch,
    trigger,
    formState: { errors: regErrors },
  } = useForm<InviteRegisterForm>({
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { name: '', password: '', confirmPassword: '' },
  });

  const {
    register: loginField,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors },
  } = useForm<InviteLoginForm>({
    mode: 'onBlur',
    defaultValues: { password: '' },
  });

  useEffect(() => {
    if (!token) {
      setValidation({
        valid: false,
        status: 'Invalid',
        reason: 'No invitation token was provided in the link.',
      });
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);
    api.invitations
      .validate(token)
      .then((res) => {
        if (!cancelled) {
          setValidation(res);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setValidation({
            valid: false,
            status: 'Invalid',
            reason:
              err instanceof Error
                ? err.message
                : 'Unable to verify invitation link.',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const passwordValue = watch('password') || '';
  const confirmPasswordValue = watch('confirmPassword') || '';
  const strength = evaluatePasswordStrength(passwordValue);
  const passwordsMatch =
    strength.isValid &&
    confirmPasswordValue.length > 0 &&
    passwordValue === confirmPasswordValue;

  const invitation = validation?.invitation;
  const emailMatchesCurrent =
    Boolean(user && invitation) &&
    user!.email.toLowerCase() === invitation!.email.toLowerCase();

  const navigateAfterAccept = async (projectId: string | null) => {
    await Promise.all([
      refreshMembers(),
      refreshProjects(),
      refreshPendingInvitations(),
    ]);
    notifyDataChanged();
    if (projectId) {
      navigate(`/projects/${projectId}`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  const handleSignedInAccept = async () => {
    if (!token || submitting || rejecting) return;
    try {
      setSubmitting(true);
      setServerError('');
      const res = await api.invitations.accept(token);
      updateUserLocal(res.user);
      toast.success('Invitation accepted. Welcome to the project.');
      await navigateAfterAccept(res.projectId);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Unable to accept invitation.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignedInReject = async () => {
    if (!token || submitting || rejecting) return;
    try {
      setRejecting(true);
      setServerError('');
      await api.invitations.reject(token);
      await refreshPendingInvitations();
      notifyDataChanged();
      toast.success('Invitation declined.');
      navigate('/', { replace: true });
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Unable to decline invitation.'
      );
    } finally {
      setRejecting(false);
    }
  };

  const onRegisterOnly = async (values: InviteRegisterForm) => {
    if (!token || !invitation || submitting) return;
    try {
      setSubmitting(true);
      setServerError('');
      await registerAccount(
        normalizeFullName(values.name),
        invitation.email,
        values.password,
        values.confirmPassword,
        token
      );
      await refreshPendingInvitations();
      toast.success('Account created. Review and accept or reject your invitation.');
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Unable to complete registration.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onSignInOnly = async (values: InviteLoginForm) => {
    if (!token || !invitation || submitting) return;
    try {
      setSubmitting(true);
      setServerError('');
      await login(invitation.email, values.password, true);
      await refreshPendingInvitations();
      toast.success('Signed in. Review your pending invitation below.');
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Unable to sign in.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const statusIcon = () => {
    switch (validation?.status) {
      case 'Expired':
        return <CalendarClock className="w-7 h-7 text-[#C47D2B]" />;
      case 'Revoked':
      case 'Rejected':
        return <Ban className="w-7 h-7 text-[#B3473B]" />;
      case 'Accepted':
        return <CheckCircle2 className="w-7 h-7 text-[#557A59]" />;
      default:
        return <XCircle className="w-7 h-7 text-[#B3473B]" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] dark:bg-[#181817] flex flex-col justify-between px-4 py-8 sm:px-6">
      {/* Header Brand Bar */}
      <div className="w-full max-w-lg mx-auto flex items-center justify-between mb-6">
        <Link to="/" className="inline-flex items-center gap-2.5 group">
          <span className="w-8 h-8 rounded bg-[#1F1F1E] dark:bg-[#C56A45] text-white flex items-center justify-center font-mono text-xs font-semibold tracking-tight">
            TR
          </span>
          <span className="font-display text-[17px] font-semibold tracking-tight text-[#1F1F1E] dark:text-[#F3F0EE]">
            Trackly
          </span>
        </Link>
        {isAuthenticated && user && (
          <div className="flex items-center gap-2 text-xs text-[#6B6964] dark:text-[#A8A49B]">
            <span className="truncate max-w-[160px]">{user.email}</span>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#E4E2DC] dark:border-[#3A3835] hover:border-[#C56A45] text-[#1F1F1E] dark:text-[#F3F0EE] cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Card */}
      <main className="w-full max-w-lg mx-auto">
        {checking ? (
          <div className="rounded-xl border border-[#DCD9D0] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] p-8 text-center space-y-3 shadow-sm">
            <Loader2 className="w-6 h-6 animate-spin text-[#C56A45] mx-auto" />
            <p className="text-[13px] font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
              Verifying invitation link...
            </p>
            <p className="text-xs text-[#6B6964] dark:text-[#A8A49B]">
              Checking workspace permissions and token expiration.
            </p>
          </div>
        ) : !validation?.valid || !invitation ? (
          <div className="rounded-xl border border-[#DCD9D0] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] p-8 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-[#FAFAF8] dark:bg-[#252422] border border-[#E4E2DC] dark:border-[#34322E] flex items-center justify-center mx-auto">
              {statusIcon()}
            </div>
            <div>
              <span className="inline-block font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#F0EFEA] dark:bg-[#2A2926] text-[#6B6964] dark:text-[#A8A49B] mb-2">
                Invitation {validation?.status || 'Invalid'}
              </span>
              <h1 className="font-display text-xl font-semibold text-[#1F1F1E] dark:text-[#F3F0EE]">
                {validation?.status === 'Expired'
                  ? 'Invitation Link Expired'
                  : validation?.status === 'Revoked'
                    ? 'Invitation Revoked'
                    : validation?.status === 'Rejected'
                      ? 'Invitation Declined'
                      : validation?.status === 'Accepted'
                        ? 'Already Accepted'
                        : 'Invalid Invitation Link'}
              </h1>
              <p className="mt-2 text-[13px] text-[#6B6964] dark:text-[#A8A49B] leading-relaxed">
                {validation?.reason ||
                  'This invitation link cannot be used. Contact your workspace administrator for a new invite.'}
              </p>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
              {isAuthenticated ? (
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white"
                  >
                    <span>Sign In</span>
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835] hover:border-[#C56A45]"
                  >
                    <span>Create New Account</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[#DCD9D0] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] overflow-hidden shadow-sm">
            {/* Invitation Summary Banner */}
            <div className="px-6 py-5 border-b border-[#E4E2DC] dark:border-[#2E2D2A] bg-[#FAFAF8] dark:bg-[#1C1B19]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-[#C56A45] font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Team Invitation
                </span>
                <span className="font-mono text-[11px] text-[#6B6964] dark:text-[#A8A49B]">
                  Expires {formatDate(invitation.expiresAt)}
                </span>
              </div>

              <h1 className="font-display text-xl font-semibold text-[#1F1F1E] dark:text-[#F3F0EE]">
                Join {invitation.workspaceName}
              </h1>
              <p className="mt-1 text-[13px] text-[#6B6964] dark:text-[#A8A49B]">
                <strong className="font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                  {invitation.invitedByName}
                </strong>{' '}
                invited{' '}
                <span className="font-mono text-[12px] text-[#1F1F1E] dark:text-[#F3F0EE]">
                  {invitation.email}
                </span>{' '}
                as{' '}
                <span className="inline-block font-medium px-1.5 py-0.5 rounded bg-[#FDF3EE] dark:bg-[#33221A] text-[#C56A45] text-xs">
                  {invitation.role}
                </span>
                .
              </p>

              {invitation.project && (
                <div className="mt-3 rounded border border-[#E4E2DC] dark:border-[#34322E] bg-white dark:bg-[#201F1D] px-3 py-2.5 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="w-3.5 h-3.5 text-[#C56A45] shrink-0" />
                    <span className="font-mono text-[#6B6964] dark:text-[#A8A49B]">
                      {invitation.project.key}
                    </span>
                    <span className="font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                      {invitation.project.name}
                    </span>
                    <span className="ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#FCF3E6] dark:bg-[#332719] text-[#9A5E19] dark:text-[#E5A95E]">
                      Pending
                    </span>
                  </div>
                  {invitation.project.description && (
                    <p className="text-[11.5px] text-[#6B6964] dark:text-[#A8A49B] pl-5">
                      {invitation.project.description}
                    </p>
                  )}
                  <div className="text-[11px] font-mono text-[#8C8983] pl-5">
                    Invited {formatDate(invitation.createdAt)} · Expires {formatDate(invitation.expiresAt)}
                  </div>
                </div>
              )}

              {invitation.message && (
                <blockquote className="mt-3 pl-3 border-l-2 border-[#C56A45]/60 text-[12.5px] italic text-[#4A4844] dark:text-[#C5C0B6]">
                  "{invitation.message}"
                </blockquote>
              )}
            </div>

            <div className="p-6 space-y-4">
              {!USE_REMOTE_API && (
                <div className="rounded-md border border-[#E4E2DC] dark:border-[#34322E] bg-[#FAFAF8] dark:bg-[#191816] px-3 py-2 text-[11.5px] text-[#6B6964] dark:text-[#A8A49B]">
                  Temporary local browser storage mode is active. Invitation links work within this same browser environment without an email server.
                </div>
              )}

              {serverError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-md border border-[#B3473B]/35 bg-[#FBEAE8] dark:bg-[#361E1C] text-[12.5px] text-[#B3473B] dark:text-[#EB8B80]"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{serverError}</span>
                </div>
              )}

              {isAuthenticated && user ? (
                emailMatchesCurrent ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-[#E4E2DC] dark:border-[#34322E] bg-[#FAFAF8] dark:bg-[#191816] p-4 flex items-center gap-3">
                      <UserCheck className="w-5 h-5 text-[#557A59] shrink-0" />
                      <div className="text-xs">
                        <p className="font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                          Signed in as {user.name}
                        </p>
                        <p className="text-[#6B6964] dark:text-[#A8A49B]">
                          Your email ({user.email}) matches this pending invitation. Choose whether to accept or decline.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        disabled={submitting || rejecting}
                        onClick={handleSignedInReject}
                        className="h-10 text-[13px] font-medium rounded-md border border-[#DCD9D0] dark:border-[#3A3835] bg-white dark:bg-[#252422] text-[#6B6964] dark:text-[#C5C0B6] hover:text-[#B3473B] hover:border-[#B3473B] inline-flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                      >
                        {rejecting && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>{rejecting ? 'Declining...' : 'Reject Invitation'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={submitting || rejecting}
                        onClick={handleSignedInAccept}
                        className="h-10 text-[13.5px] font-medium rounded-md bg-[#C56A45] hover:bg-[#B05B38] text-white inline-flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                      >
                        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>{submitting ? 'Joining...' : 'Accept Invitation'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-[#C47D2B]/40 bg-[#FCF3E6] dark:bg-[#2E2417] p-4 text-xs space-y-1.5">
                      <p className="font-semibold text-[#9A5E19] dark:text-[#E5A95E]">
                        Account email mismatch
                      </p>
                      <p className="text-[#6B6964] dark:text-[#C5C0B6]">
                        You are currently signed in as{' '}
                        <span className="font-mono font-medium">{user.email}</span>, but this
                        invitation was issued for{' '}
                        <span className="font-mono font-medium">{invitation.email}</span>.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={logout}
                      className="w-full h-10 text-[13px] font-medium rounded-md bg-[#1F1F1E] dark:bg-[#C56A45] text-white hover:opacity-90 inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out to Accept as {invitation.email}</span>
                    </button>
                  </div>
                )
              ) : (
                <div>
                  <div className="grid grid-cols-2 rounded-md border border-[#E4E2DC] dark:border-[#34322E] bg-[#FAFAF8] dark:bg-[#191816] p-1 mb-5">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthTab('register');
                        setServerError('');
                      }}
                      className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                        authTab === 'register'
                          ? 'bg-white dark:bg-[#252422] text-[#1F1F1E] dark:text-[#F3F0EE] shadow-xs'
                          : 'text-[#6B6964] dark:text-[#A8A49B]'
                      }`}
                    >
                      Create Account
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthTab('login');
                        setServerError('');
                      }}
                      className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                        authTab === 'login'
                          ? 'bg-white dark:bg-[#252422] text-[#1F1F1E] dark:text-[#F3F0EE] shadow-xs'
                          : 'text-[#6B6964] dark:text-[#A8A49B]'
                      }`}
                    >
                      Existing User Sign In
                    </button>
                  </div>

                  {/* Locked Email Banner */}
                  <div className="mb-4">
                    <label className="block text-[12px] font-medium text-[#4A4844] dark:text-[#C5C0B6] mb-1.5">
                      Invited email (locked to invitation)
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={invitation.email}
                        readOnly
                        disabled
                        className="w-full h-10 pl-3 pr-9 text-[13px] rounded-md border border-[#E4E2DC] dark:border-[#34322E] bg-[#F4F3EE] dark:bg-[#191816] text-[#6B6964] dark:text-[#A8A49B] cursor-not-allowed"
                      />
                      <Lock className="w-3.5 h-3.5 text-[#8C8983] absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  {authTab === 'register' ? (
                    <form
                      onSubmit={handleRegisterSubmit(onRegisterOnly)}
                      className="space-y-4"
                      noValidate
                    >
                      <div>
                        <label
                          htmlFor="inv-name"
                          className="block text-[12px] font-medium text-[#4A4844] dark:text-[#C5C0B6] mb-1.5"
                        >
                          Full name
                        </label>
                        <input
                          id="inv-name"
                          type="text"
                          autoFocus
                          placeholder="Jordan Taylor"
                          {...regField('name', {
                            validate: (val) => validateFullName(val) || true,
                          })}
                          className="w-full h-10 px-3 text-[13.5px] rounded-md border border-[#DCD9D0] dark:border-[#34322E] bg-white dark:bg-[#181817] focus:outline-none focus:border-[#C56A45]"
                        />
                        {regErrors.name && (
                          <p className="mt-1 text-xs text-[#B3473B]">
                            {regErrors.name.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            htmlFor="inv-password"
                            className="block text-[12px] font-medium text-[#4A4844] dark:text-[#C5C0B6]"
                          >
                            Password
                          </label>
                          {passwordValue.length > 0 && (
                            <span className="text-[11px] font-medium text-[#6B6964]">
                              {strength.label}
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            id="inv-password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="At least 8 characters"
                            {...regField('password', {
                              validate: (val) => validatePassword(val) || true,
                              onChange: () => {
                                if (confirmPasswordValue.length > 0) {
                                  void trigger('confirmPassword');
                                }
                              },
                            })}
                            className="w-full h-10 pl-3 pr-10 text-[13.5px] rounded-md border border-[#DCD9D0] dark:border-[#34322E] bg-white dark:bg-[#181817] focus:outline-none focus:border-[#C56A45]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#8C8983]"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {regErrors.password && (
                          <p className="mt-1 text-xs text-[#B3473B]">
                            {regErrors.password.message}
                          </p>
                        )}

                        <div className="mt-2 grid grid-cols-4 gap-1.5">
                          {[1, 2, 3, 4].map((seg) => (
                            <div
                              key={seg}
                              className="h-1 rounded-full bg-[#E4E2DC] dark:bg-[#2E2D2A] overflow-hidden"
                            >
                              <div
                                className={`h-full rounded-full ${
                                  strength.score >= seg
                                    ? STRENGTH_BAR_COLORS[strength.score]
                                    : 'w-0'
                                }`}
                                style={{ width: strength.score >= seg ? '100%' : '0%' }}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                          {[
                            { label: '8+ characters', met: strength.checks.minLength },
                            { label: '1 uppercase', met: strength.checks.hasUppercase },
                            { label: '1 lowercase', met: strength.checks.hasLowercase },
                            { label: '1 number', met: strength.checks.hasNumber },
                            { label: '1 special character', met: strength.checks.hasSpecialChar },
                            { label: 'Passwords match', met: passwordsMatch },
                          ].map((req) => (
                            <div
                              key={req.label}
                              className={`flex items-center gap-1.5 ${
                                req.met ? 'text-[#557A59]' : 'text-[#8C8983]'
                              }`}
                            >
                              <Check className="w-3 h-3 shrink-0" />
                              <span>{req.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="inv-confirm"
                          className="block text-[12px] font-medium text-[#4A4844] dark:text-[#C5C0B6] mb-1.5"
                        >
                          Confirm password
                        </label>
                        <div className="relative">
                          <input
                            id="inv-confirm"
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="Re-enter your password"
                            {...regField('confirmPassword', {
                              required: 'Please confirm your password.',
                              validate: (val) =>
                                val === passwordValue || 'Passwords do not match.',
                            })}
                            className="w-full h-10 pl-3 pr-10 text-[13.5px] rounded-md border border-[#DCD9D0] dark:border-[#34322E] bg-white dark:bg-[#181817] focus:outline-none focus:border-[#C56A45]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#8C8983]"
                            aria-label="Toggle confirmation password"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {regErrors.confirmPassword && (
                          <p className="mt-1 text-xs text-[#B3473B]">
                            {regErrors.confirmPassword.message}
                          </p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full h-10 text-[13.5px] font-medium rounded-md bg-[#C56A45] hover:bg-[#B05B38] text-white inline-flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                      >
                        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>
                          {submitting
                            ? 'Creating Account...'
                            : 'Create Account & Review Invitation'}
                        </span>
                      </button>
                    </form>
                  ) : (
                    <form
                      onSubmit={handleLoginSubmit(onSignInOnly)}
                      className="space-y-4"
                      noValidate
                    >
                      <div>
                        <label
                          htmlFor="inv-login-password"
                          className="block text-[12px] font-medium text-[#4A4844] dark:text-[#C5C0B6] mb-1.5"
                        >
                          Password for {invitation.email}
                        </label>
                        <div className="relative">
                          <input
                            id="inv-login-password"
                            type={showLoginPassword ? 'text' : 'password'}
                            autoFocus
                            placeholder="Enter your password"
                            {...loginField('password', {
                              required: 'Password is required.',
                            })}
                            className="w-full h-10 pl-3 pr-10 text-[13.5px] rounded-md border border-[#DCD9D0] dark:border-[#34322E] bg-white dark:bg-[#181817] focus:outline-none focus:border-[#C56A45]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowLoginPassword((v) => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#8C8983]"
                            aria-label="Toggle password visibility"
                          >
                            {showLoginPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {loginErrors.password && (
                          <p className="mt-1 text-xs text-[#B3473B]">
                            {loginErrors.password.message}
                          </p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full h-10 text-[13.5px] font-medium rounded-md bg-[#C56A45] hover:bg-[#B05B38] text-white inline-flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                      >
                        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>
                          {submitting
                            ? 'Signing In...'
                            : 'Sign In & Review Invitation'}
                        </span>
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="text-center text-[11.5px] text-[#8C8983] mt-8">
        Trackly — Bug & Issue Tracking Workspace
      </footer>
    </div>
  );
}
