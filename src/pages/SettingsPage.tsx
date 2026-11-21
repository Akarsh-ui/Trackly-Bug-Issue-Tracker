import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, Eye, EyeOff } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import type { IssuePriority } from '../types';
import { Avatar } from '../components/Avatar';
import {
  normalizeFullName,
  validateFullName,
  validatePassword,
} from '../utils/authValidation';
import { evaluatePasswordStrength } from '../utils/passwordStrength';

type SettingsTab =
  | 'profile'
  | 'workspace'
  | 'team'
  | 'notifications'
  | 'security'
  | 'appearance';

const PROFILE_COLORS = [
  '#C56A45',
  '#557A59',
  '#75553C',
  '#C47D2B',
  '#605E59',
  '#3F5F43',
];

export function SettingsPage() {
  const { user, theme, density, updateUserLocal, setAppearance } = useAuth();
  const { workspace, members, refreshWorkspace, refreshMembers } = useWorkspace();

  const [tab, setTab] = useState<SettingsTab>('profile');

  // Profile
  const [name, setName] = useState(user?.name || '');
  const [title, setTitle] = useState(user?.title || '');
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor || '#C56A45');
  const [savingProfile, setSavingProfile] = useState(false);

  // Workspace
  const [wsName, setWsName] = useState(workspace?.name || '');
  const [wsSlug, setWsSlug] = useState(workspace?.slug || '');
  const [wsDesc, setWsDesc] = useState(workspace?.description || '');
  const [wsPriority, setWsPriority] = useState<IssuePriority>(
    workspace?.defaultIssuePriority || 'Medium'
  );
  const [savingWs, setSavingWs] = useState(false);

  // Notifications
  const [notifPrefs, setNotifPrefs] = useState({
    issueAssigned: user?.notificationPrefs?.issueAssigned ?? true,
    statusChanged: user?.notificationPrefs?.statusChanged ?? true,
    comments: user?.notificationPrefs?.comments ?? true,
    weeklyDigest: user?.notificationPrefs?.weeklyDigest ?? false,
  });
  const [savingNotif, setSavingNotif] = useState(false);

  // Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const isAdmin = user?.role === 'Admin';
  const strength = evaluatePasswordStrength(newPassword);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setTitle(user.title || '');
      setAvatarColor(user.avatarColor || '#C56A45');
      setNotifPrefs({
        issueAssigned: user.notificationPrefs?.issueAssigned ?? true,
        statusChanged: user.notificationPrefs?.statusChanged ?? true,
        comments: user.notificationPrefs?.comments ?? true,
        weeklyDigest: user.notificationPrefs?.weeklyDigest ?? false,
      });
    }
  }, [user]);

  useEffect(() => {
    if (workspace) {
      setWsName(workspace.name);
      setWsSlug(workspace.slug);
      setWsDesc(workspace.description);
      setWsPriority(workspace.defaultIssuePriority);
    }
  }, [workspace]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameErr = validateFullName(name);
    if (nameErr) {
      toast.error(nameErr);
      return;
    }
    try {
      setSavingProfile(true);
      const normalized = normalizeFullName(name);
      const { user: updated } = await api.auth.updateProfile({
        name: normalized,
        title: title.trim(),
        avatarColor,
      });
      setName(updated.name);
      updateUserLocal(updated);
      await refreshMembers();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Only workspace administrators can update workspace settings');
      return;
    }
    if (wsName.trim().length < 2) {
      toast.error('Workspace name must be at least 2 characters');
      return;
    }
    const cleanSlug = wsSlug.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(cleanSlug)) {
      toast.error('Workspace slug must be 3–50 lowercase letters, numbers, or hyphens');
      return;
    }
    try {
      setSavingWs(true);
      await api.workspace.update({
        name: wsName.trim(),
        slug: cleanSlug,
        description: wsDesc.trim(),
        defaultIssuePriority: wsPriority,
      });
      await refreshWorkspace();
      toast.success('Workspace settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save workspace');
    } finally {
      setSavingWs(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setSavingNotif(true);
      const { user: updated } = await api.auth.updateProfile({
        notificationPrefs: notifPrefs,
      });
      updateUserLocal(updated);
      toast.success('Notification preferences saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSavingNotif(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (!currentPassword) {
      setPasswordError('Current password is required.');
      return;
    }
    const pwdErr = validatePassword(newPassword);
    if (pwdErr) {
      setPasswordError(pwdErr);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    try {
      setSavingPassword(true);
      await api.auth.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to change password';
      setPasswordError(msg);
      toast.error(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: 'profile', label: 'Profile' },
    { id: 'workspace', label: 'Workspace' },
    { id: 'team', label: 'Team' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'security', label: 'Security' },
    { id: 'appearance', label: 'Appearance' },
  ];

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[#1F1F1E] dark:text-[#F3F0EE]">
          Settings
        </h1>
        <p className="text-[13px] text-[#6B6964] dark:text-[#A8A49B]">
          Manage your account, workspace configuration, notifications, and visual density.
        </p>
      </div>

      <div className="flex items-center gap-5 border-b border-[#E4E2DC] dark:border-[#2E2D2A] overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`pb-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              tab === t.id
                ? 'border-[#C56A45] text-[#1F1F1E] dark:text-[#F3F0EE]'
                : 'border-transparent text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <form
          onSubmit={handleSaveProfile}
          className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] p-5 space-y-4 max-w-xl"
        >
          <div className="flex items-center gap-3 pb-3 border-b border-[#E4E2DC] dark:border-[#2E2D2A]">
            <Avatar name={name || user?.name} color={avatarColor} size="lg" />
            <div>
              <h2 className="text-[15px] font-semibold">Profile Information</h2>
              <p className="text-xs text-[#6B6964] dark:text-[#A8A49B]">
                {user?.role} · {user?.email}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
              Full Name <span className="text-[#B3473B]">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-3 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
              Email Address
            </label>
            <input
              type="email"
              disabled
              value={user?.email || ''}
              className="w-full h-9 px-3 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-[#F4F3EE] dark:bg-[#181817] text-[#6B6964]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
              Job Title
            </label>
            <input
              type="text"
              placeholder="e.g. Senior Backend Engineer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-9 px-3 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1.5">
              Monogram Color
            </label>
            <div className="flex items-center gap-2">
              {PROFILE_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setAvatarColor(hex)}
                  aria-label={`Select color ${hex}`}
                  style={{ backgroundColor: hex }}
                  className={`w-6 h-6 rounded transition-transform ${
                    avatarColor === hex
                      ? 'ring-2 ring-offset-2 ring-[#1F1F1E] dark:ring-[#F3F0EE] scale-105'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-4 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white disabled:opacity-60"
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      )}

      {tab === 'workspace' && (
        <form
          onSubmit={handleSaveWorkspace}
          className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] p-5 space-y-4 max-w-xl"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold">Workspace Details</h2>
            {!isAdmin && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#F0EFEA] dark:bg-[#2A2926] text-[#6B6964] dark:text-[#A8A49B]">
                Read-only
              </span>
            )}
          </div>
          {!isAdmin && (
            <div className="rounded border border-[#E4E2DC] dark:border-[#34322E] bg-[#FAFAF8] dark:bg-[#191816] px-3 py-2 text-xs text-[#6B6964] dark:text-[#A8A49B]">
              Only workspace administrators can modify workspace settings.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                Workspace Name <span className="text-[#B3473B]">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                className="w-full h-9 px-3 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
                Workspace Slug <span className="text-[#B3473B]">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={wsSlug}
                onChange={(e) => setWsSlug(e.target.value.toLowerCase())}
                className="w-full h-9 px-3 text-[13px] font-mono rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] disabled:opacity-60"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
              Description
            </label>
            <textarea
              rows={3}
              disabled={!isAdmin}
              value={wsDesc}
              onChange={(e) => setWsDesc(e.target.value)}
              className="w-full p-2.5 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
              Default Issue Priority
            </label>
            <select
              disabled={!isAdmin}
              value={wsPriority}
              onChange={(e) => setWsPriority(e.target.value as IssuePriority)}
              className="w-full h-9 px-2.5 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817] disabled:opacity-60"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
          {isAdmin && (
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingWs}
                className="px-4 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white disabled:opacity-60"
              >
                {savingWs ? 'Saving...' : 'Save Workspace'}
              </button>
            </div>
          )}
        </form>
      )}

      {tab === 'team' && (
        <div className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] p-5 space-y-4 max-w-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Team Directory</h2>
              <p className="text-xs text-[#6B6964] dark:text-[#A8A49B] mt-0.5">
                {members.length} {members.length === 1 ? 'member' : 'members'} in this workspace.
              </p>
            </div>
            <Link
              to="/team"
              className="px-3.5 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              Manage Team
            </Link>
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] p-5 space-y-4 max-w-xl">
          <h2 className="text-[15px] font-semibold">Notification Preferences</h2>
          <div className="divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A]">
            {[
              {
                key: 'issueAssigned' as const,
                label: 'Issue assigned to me',
                desc: 'Receive an alert when someone assigns a bug or task to you.',
              },
              {
                key: 'statusChanged' as const,
                label: 'Workflow status changes',
                desc: 'Notify when issues you follow move across To Do, In Progress, or Done.',
              },
              {
                key: 'comments' as const,
                label: 'New comments & replies',
                desc: 'Notify when teammates comment on your reported or assigned issues.',
              },
              {
                key: 'weeklyDigest' as const,
                label: 'Weekly engineering digest',
                desc: 'Monday summary of resolved issues and open urgent blockers.',
              },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between gap-4 py-3 cursor-pointer"
              >
                <div>
                  <div className="text-[13px] font-medium">{item.label}</div>
                  <div className="text-xs text-[#6B6964] dark:text-[#A8A49B]">
                    {item.desc}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifPrefs[item.key]}
                  onChange={(e) =>
                    setNotifPrefs((prev) => ({
                      ...prev,
                      [item.key]: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 accent-[#C56A45]"
                />
              </label>
            ))}
          </div>
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleSaveNotifications}
              disabled={savingNotif}
              className="px-4 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white disabled:opacity-60"
            >
              {savingNotif ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <form
          onSubmit={handleChangePassword}
          noValidate
          className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] p-5 space-y-4 max-w-xl"
        >
          <h2 className="text-[15px] font-semibold">Change Password</h2>
          {passwordError && (
            <div className="p-3 rounded border border-[#B3473B]/30 bg-[#FBEAE8] dark:bg-[#361E1C] text-xs text-[#B3473B] dark:text-[#EB8B80]">
              {passwordError}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full h-9 pl-3 pr-9 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((v) => !v)}
                aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE]"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-9 pl-3 pr-9 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE]"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPassword && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#6B6964] dark:text-[#A8A49B]">Password strength</span>
                  <span className="font-mono font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                    {strength.label}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[1, 2, 3, 4].map((step) => {
                    const active = strength.score >= step;
                    const barColor =
                      strength.score <= 1
                        ? 'bg-[#B3473B]'
                        : strength.score === 2
                          ? 'bg-[#C47D2B]'
                          : 'bg-[#557A59]';
                    return (
                      <div
                        key={step}
                        className={`h-1 rounded-full ${
                          active ? barColor : 'bg-[#E4E2DC] dark:bg-[#2E2D2A]'
                        }`}
                      />
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[#6B6964] dark:text-[#A8A49B]">
                  {[
                    { ok: strength.checks.minLength, text: '8+ characters' },
                    { ok: strength.checks.hasUppercase, text: 'Uppercase letter' },
                    { ok: strength.checks.hasLowercase, text: 'Lowercase letter' },
                    { ok: strength.checks.hasNumber, text: 'At least one number' },
                    { ok: strength.checks.hasSpecialChar, text: '1 special character' },
                  ].map((item) => (
                    <div
                      key={item.text}
                      className={`flex items-center gap-1.5 ${
                        item.ok ? 'text-[#3F5F43] dark:text-[#86B38B]' : ''
                      }`}
                    >
                      <Check className={`w-3 h-3 ${item.ok ? 'opacity-100' : 'opacity-30'}`} />
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B6964] dark:text-[#A8A49B] mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-9 pl-3 pr-9 text-[13px] rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE]"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={savingPassword}
              className="px-4 py-2 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white disabled:opacity-60"
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      )}

      {tab === 'appearance' && (
        <div className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] p-5 space-y-5 max-w-xl">
          <div>
            <h2 className="text-[15px] font-semibold">Theme</h2>
            <p className="text-xs text-[#6B6964] dark:text-[#A8A49B] mt-0.5">
              Choose between Warm Paper light mode and Studio Charcoal dark mode.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAppearance({ theme: 'light' })}
                className={`p-3 rounded border text-left transition-colors ${
                  theme === 'light'
                    ? 'border-[#C56A45] bg-[#FAF4F0] dark:bg-[#2A221E]'
                    : 'border-[#E4E2DC] dark:border-[#3A3835]'
                }`}
              >
                <div className="text-xs font-semibold">Warm Paper (Light)</div>
                <div className="text-[11px] text-[#6B6964] mt-0.5">
                  Bone #F7F6F2 &amp; Charcoal ink
                </div>
              </button>
              <button
                type="button"
                onClick={() => setAppearance({ theme: 'dark' })}
                className={`p-3 rounded border text-left transition-colors ${
                  theme === 'dark'
                    ? 'border-[#C56A45] bg-[#FAF4F0] dark:bg-[#2A221E]'
                    : 'border-[#E4E2DC] dark:border-[#3A3835]'
                }`}
              >
                <div className="text-xs font-semibold">Studio Charcoal (Dark)</div>
                <div className="text-[11px] text-[#6B6964] dark:text-[#A8A49B] mt-0.5">
                  Deep iron #181817 &amp; Warm ivory ink
                </div>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E4E2DC] dark:border-[#2E2D2A]">
            <h2 className="text-[15px] font-semibold">Issue Table Density</h2>
            <p className="text-xs text-[#6B6964] dark:text-[#A8A49B] mt-0.5">
              Adjust row spacing in issue tables.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAppearance({ density: 'compact' })}
                className={`p-3 rounded border text-left transition-colors ${
                  density === 'compact'
                    ? 'border-[#C56A45] bg-[#FAF4F0] dark:bg-[#2A221E]'
                    : 'border-[#E4E2DC] dark:border-[#3A3835]'
                }`}
              >
                <div className="text-xs font-semibold">Compact</div>
                <div className="text-[11px] text-[#6B6964] dark:text-[#A8A49B] mt-0.5">
                  High-density 38px rows
                </div>
              </button>
              <button
                type="button"
                onClick={() => setAppearance({ density: 'comfortable' })}
                className={`p-3 rounded border text-left transition-colors ${
                  density === 'comfortable'
                    ? 'border-[#C56A45] bg-[#FAF4F0] dark:bg-[#2A221E]'
                    : 'border-[#E4E2DC] dark:border-[#3A3835]'
                }`}
              >
                <div className="text-xs font-semibold">Comfortable</div>
                <div className="text-[11px] text-[#6B6964] dark:text-[#A8A49B] mt-0.5">
                  Relaxed row breathing room
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
