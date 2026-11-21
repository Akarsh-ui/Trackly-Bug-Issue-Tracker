import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ChevronUp,
  FolderKanban,
  Kanban,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MailCheck,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { Avatar } from '../components/Avatar';
import { CommandPalette } from '../components/CommandPalette';
import { CreateIssueModal } from '../components/CreateIssueModal';
import { IssueDetailView } from '../components/IssueDetailView';

export function AppLayout() {
  const { user, theme, setAppearance, logout } = useAuth();
  const {
    workspace,
    projects,
    pendingInvitations,
    activeIssueId,
    closeIssue,
    openCreateIssue,
    setCommandPaletteOpen,
  } = useWorkspace();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const breadcrumb = getBreadcrumb(location.pathname, location.search, projects);

  // Close drawers/menus with Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (profileMenuOpen) {
        setProfileMenuOpen(false);
      } else if (activeIssueId) {
        closeIssue();
      } else if (mobileNavOpen) {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [profileMenuOpen, activeIssueId, mobileNavOpen, closeIssue]);

  // Close profile menu when clicking outside
  useEffect(() => {
    if (!profileMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [profileMenuOpen]);

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/issues?assignee=me', label: 'My Issues', icon: UserCheck, isQueryMatch: true },
    { to: '/issues', label: 'All Issues', icon: ListTodo, end: true },
    { to: '/board', label: 'Kanban Board', icon: Kanban },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    { to: '/activity', label: 'Activity', icon: Activity },
    { to: '/team', label: 'Team', icon: Users },
    {
      to: '/invitations',
      label: 'Invitations',
      icon: MailCheck,
      badge: pendingInvitations.length,
    },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const handleLogout = () => {
    setProfileMenuOpen(false);
    setMobileNavOpen(false);
    logout();
    navigate('/login');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#F7F6F2] dark:bg-[#181817] border-r border-[#E4E2DC] dark:border-[#2E2D2A]">
      {/* Brand Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-[#E4E2DC] dark:border-[#2E2D2A] shrink-0">
        <Link
          to="/"
          onClick={() => setMobileNavOpen(false)}
          className="flex items-center gap-2.5 min-w-0"
        >
          <span className="w-6 h-6 rounded bg-[#C56A45] text-white font-display font-bold text-xs inline-flex items-center justify-center shrink-0">
            T
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold tracking-tight text-[#1F1F1E] dark:text-[#F3F0EE] truncate leading-tight">
              Trackly
            </div>
            <div className="text-[11px] text-[#6B6964] dark:text-[#8C8983] truncate leading-tight">
              {workspace?.name || 'Workspace'}
            </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="lg:hidden p-1 rounded text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE]"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Find Button */}
      <div className="p-3 shrink-0">
        <button
          type="button"
          onClick={() => {
            setMobileNavOpen(false);
            setCommandPaletteOpen(true);
          }}
          className="w-full flex items-center justify-between gap-2 h-8 px-2.5 rounded border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] text-xs text-[#8C8983] hover:border-[#DCD9D0] dark:hover:border-[#3A3835] transition-colors"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span>Quick find...</span>
          </span>
          <kbd className="font-mono text-[10px] px-1 py-0.5 rounded bg-[#F4F3EE] dark:bg-[#2A2926] text-[#6B6964] dark:text-[#A8A49B]">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 overflow-y-auto px-2.5 space-y-0.5" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isMyIssues =
            item.isQueryMatch &&
            location.pathname === '/issues' &&
            location.search.includes('assignee=me');
          const isAllIssues =
            item.to === '/issues' &&
            location.pathname === '/issues' &&
            !location.search.includes('assignee=me');

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) => {
                const active = item.isQueryMatch
                  ? isMyIssues
                  : item.to === '/issues'
                  ? isAllIssues
                  : isActive;

                return `flex items-center gap-2.5 px-2.5 py-1.5 rounded text-[13px] font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white dark:bg-[#252422] text-[#1F1F1E] dark:text-[#F3F0EE] border border-[#E4E2DC] dark:border-[#3A3835]'
                    : 'text-[#6B6964] dark:text-[#A8A49B] hover:bg-[#F0EFEA] dark:hover:bg-[#22211F] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE] border border-transparent'
                }`;
              }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {'badge' in item && item.badge ? (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#FDF3EE] dark:bg-[#33221A] text-[#C56A45]">
                  {item.badge}
                </span>
              ) : null}
            </NavLink>
          );
        })}

        {/* Projects Section */}
        <div className="pt-5 pb-1 px-2.5 flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#8C8983]">
            Projects
          </span>
          <Link
            to="/projects"
            onClick={() => setMobileNavOpen(false)}
            className="text-[11px] text-[#6B6964] hover:text-[#C56A45]"
          >
            View all
          </Link>
        </div>

        <div className="space-y-0.5">
          {projects.length === 0 ? (
            <Link
              to="/projects"
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-[#8C8983] hover:text-[#C56A45] hover:bg-[#F0EFEA] dark:hover:bg-[#22211F] transition-colors"
            >
              <span>No projects yet</span>
              <span className="font-mono text-[10px]">+ New</span>
            </Link>
          ) : (
            projects.slice(0, 6).map((p) => (
              <NavLink
                key={p._id}
                to={`/projects/${p._id}`}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-[13px] transition-colors ${
                    isActive
                      ? 'bg-white dark:bg-[#252422] text-[#1F1F1E] dark:text-[#F3F0EE] border border-[#E4E2DC] dark:border-[#3A3835] font-medium'
                      : 'text-[#6B6964] dark:text-[#A8A49B] hover:bg-[#F0EFEA] dark:hover:bg-[#22211F] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE] border border-transparent'
                  }`
                }
              >
                <span className="truncate">{p.name}</span>
                <span className="font-mono text-[10px] text-[#8C8983] shrink-0">
                  {p.key}
                </span>
              </NavLink>
            ))
          )}
        </div>
      </nav>

      {/* Bottom User Profile Menu */}
      <div
        ref={profileMenuRef}
        className="relative p-2.5 border-t border-[#E4E2DC] dark:border-[#2E2D2A] shrink-0"
      >
        {profileMenuOpen && (
          <div
            role="menu"
            className="absolute bottom-full left-2.5 right-2.5 mb-2 rounded-md border border-[#DCD9D0] dark:border-[#3A3835] bg-white dark:bg-[#201F1D] shadow-[0_12px_32px_rgba(31,31,30,0.08)] py-1.5 z-30"
          >
            <div className="px-3 py-2 border-b border-[#E4E2DC] dark:border-[#2E2D2A]">
              <div className="text-xs font-medium text-[#1F1F1E] dark:text-[#F3F0EE] truncate">
                {user?.name}
              </div>
              <div className="text-[11px] text-[#6B6964] dark:text-[#8C8983] truncate">
                {user?.email}
              </div>
            </div>

            <Link
              to="/settings"
              role="menuitem"
              onClick={() => {
                setProfileMenuOpen(false);
                setMobileNavOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-2 text-xs text-[#1F1F1E] dark:text-[#E5E2DC] hover:bg-[#F4F3EE] dark:hover:bg-[#2A2926]"
            >
              <Settings className="w-3.5 h-3.5 text-[#6B6964]" />
              <span>Profile &amp; Workspace Settings</span>
            </Link>

            <button
              type="button"
              role="menuitem"
              onClick={() =>
                setAppearance({ theme: theme === 'dark' ? 'light' : 'dark' })
              }
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-[#1F1F1E] dark:text-[#E5E2DC] hover:bg-[#F4F3EE] dark:hover:bg-[#2A2926]"
            >
              <span className="flex items-center gap-2">
                {theme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 text-[#C47D2B]" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-[#6B6964]" />
                )}
                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </span>
            </button>

            <div className="my-1 border-t border-[#E4E2DC] dark:border-[#2E2D2A]" />

            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#B3473B] dark:text-[#EB8B80] hover:bg-[#FBEAE8] dark:hover:bg-[#361E1C]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setProfileMenuOpen((v) => !v)}
          aria-expanded={profileMenuOpen}
          aria-haspopup="menu"
          className="w-full flex items-center justify-between gap-2 p-1.5 rounded hover:bg-[#F0EFEA] dark:hover:bg-[#22211F] transition-colors text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar
              name={user?.name}
              color={user?.avatarColor}
              size="sm"
            />
            <div className="min-w-0">
              <div className="text-xs font-medium text-[#1F1F1E] dark:text-[#F3F0EE] truncate">
                {user?.name}
              </div>
              <div className="text-[11px] text-[#6B6964] dark:text-[#8C8983] truncate">
                {user?.role}
              </div>
            </div>
          </div>
          <ChevronUp
            className={`w-3.5 h-3.5 text-[#8C8983] shrink-0 transition-transform ${
              profileMenuOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F7F6F2] dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE]">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#1F1F1E]/30 dark:bg-black/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] h-full z-10">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract */}
        <header className="sticky top-0 z-20 h-14 px-4 sm:px-6 bg-[#F7F6F2]/95 dark:bg-[#181817]/95 backdrop-blur-sm border-b border-[#E4E2DC] dark:border-[#2E2D2A] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 rounded border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] text-[#1F1F1E] dark:text-[#F3F0EE]"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-[#6B6964] dark:text-[#A8A49B] truncate">
              <span className="font-medium text-[#1F1F1E] dark:text-[#F3F0EE] whitespace-nowrap truncate">
                {breadcrumb}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => openCreateIssue()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded bg-[#C56A45] hover:bg-[#B05B38] text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Issue</span>
            </button>
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 px-4 sm:px-6 py-5 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Persistent Slide-over Issue Inspector Drawer */}
      {activeIssueId && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div
            className="fixed inset-0 bg-[#1F1F1E]/25 dark:bg-black/55"
            onClick={closeIssue}
          />
          <div className="relative w-full max-w-[520px] h-full bg-white dark:bg-[#201F1D] border-l border-[#DCD9D0] dark:border-[#3A3835] shadow-[0_12px_32px_rgba(31,31,30,0.08)] z-10 overflow-hidden">
            <IssueDetailView issueId={activeIssueId} isDrawer onClose={closeIssue} />
          </div>
        </div>
      )}

      <CreateIssueModal />
      <CommandPalette />
    </div>
  );
}

function getBreadcrumb(
  pathname: string,
  search: string,
  projects: Array<{ _id: string; name: string; key: string }>
): string {
  if (pathname === '/') return 'Overview';
  if (pathname === '/issues') {
    return search.includes('assignee=me') ? 'My Assigned Issues' : 'All Issues';
  }
  if (pathname.startsWith('/issues/')) return 'Issue Details';
  if (pathname === '/board') return 'Kanban Board';
  if (pathname === '/projects') return 'Projects';
  if (pathname.startsWith('/projects/')) {
    const id = pathname.split('/')[2];
    const match = projects.find((p) => p._id === id);
    return match ? `Projects / ${match.name}` : 'Project Workspace';
  }
  if (pathname === '/activity') return 'Activity Timeline';
  if (pathname === '/team') return 'Team Members';
  if (pathname === '/invitations') return 'Pending Invitations';
  if (pathname === '/settings') return 'Settings';
  return 'Trackly';
}
