import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  FolderKanban,
  Kanban,
  LayoutDashboard,
  ListTodo,
  Plus,
  Search,
  Settings,
  Users,
} from 'lucide-react';
import { api } from '../services/api';
import { useWorkspace } from '../context/WorkspaceContext';
import type { Issue } from '../types';
import { StatusBadge } from './IssueBadges';

interface PaletteItem {
  id: string;
  group: 'Actions' | 'Navigation' | 'Projects' | 'Issues';
  label: string;
  hint?: string;
  icon: React.ReactNode;
  issueKey?: string;
  issue?: Issue;
  onSelect: () => void;
}

export function CommandPalette() {
  const navigate = useNavigate();
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    projects,
    openCreateIssue,
    openIssue,
  } = useWorkspace();

  const [query, setQuery] = useState('');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!commandPaletteOpen) {
      setQuery('');
      setActiveIndex(0);
      return;
    }

    let cancelled = false;
    api.issues
      .list({ search: query.trim() || undefined })
      .then(({ issues: list }) => {
        if (!cancelled) setIssues(list.slice(0, 8));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [commandPaletteOpen, query]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const list: PaletteItem[] = [];

    const actions: PaletteItem[] = [
      {
        id: 'act-create-issue',
        group: 'Actions',
        label: 'Create New Issue',
        hint: 'N',
        icon: <Plus className="w-4 h-4 text-[#C56A45]" />,
        onSelect: () => {
          setCommandPaletteOpen(false);
          openCreateIssue();
        },
      },
    ];

    const nav: PaletteItem[] = [
      {
        id: 'nav-overview',
        group: 'Navigation',
        label: 'Overview Dashboard',
        hint: 'G D',
        icon: <LayoutDashboard className="w-4 h-4 text-[#6B6964]" />,
        onSelect: () => {
          setCommandPaletteOpen(false);
          navigate('/');
        },
      },
      {
        id: 'nav-issues',
        group: 'Navigation',
        label: 'All Issues',
        hint: 'G I',
        icon: <ListTodo className="w-4 h-4 text-[#6B6964]" />,
        onSelect: () => {
          setCommandPaletteOpen(false);
          navigate('/issues');
        },
      },
      {
        id: 'nav-board',
        group: 'Navigation',
        label: 'Kanban Board',
        hint: 'G B',
        icon: <Kanban className="w-4 h-4 text-[#6B6964]" />,
        onSelect: () => {
          setCommandPaletteOpen(false);
          navigate('/board');
        },
      },
      {
        id: 'nav-projects',
        group: 'Navigation',
        label: 'Projects Directory',
        hint: 'G P',
        icon: <FolderKanban className="w-4 h-4 text-[#6B6964]" />,
        onSelect: () => {
          setCommandPaletteOpen(false);
          navigate('/projects');
        },
      },
      {
        id: 'nav-activity',
        group: 'Navigation',
        label: 'Activity Timeline',
        icon: <Activity className="w-4 h-4 text-[#6B6964]" />,
        onSelect: () => {
          setCommandPaletteOpen(false);
          navigate('/activity');
        },
      },
      {
        id: 'nav-team',
        group: 'Navigation',
        label: 'Team Members',
        icon: <Users className="w-4 h-4 text-[#6B6964]" />,
        onSelect: () => {
          setCommandPaletteOpen(false);
          navigate('/team');
        },
      },
      {
        id: 'nav-settings',
        group: 'Navigation',
        label: 'Workspace & Profile Settings',
        icon: <Settings className="w-4 h-4 text-[#6B6964]" />,
        onSelect: () => {
          setCommandPaletteOpen(false);
          navigate('/settings');
        },
      },
    ];

    for (const item of [...actions, ...nav]) {
      if (!q || item.label.toLowerCase().includes(q)) {
        list.push(item);
      }
    }

    for (const p of projects) {
      if (
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q)
      ) {
        list.push({
          id: `proj-${p._id}`,
          group: 'Projects',
          label: p.name,
          hint: p.key,
          icon: <FolderKanban className="w-4 h-4 text-[#6B6964]" />,
          onSelect: () => {
            setCommandPaletteOpen(false);
            navigate(`/projects/${p._id}`);
          },
        });
      }
    }

    for (const issue of issues) {
      list.push({
        id: `iss-${issue._id}`,
        group: 'Issues',
        label: issue.title,
        issueKey: issue.issueKey,
        issue,
        icon: <StatusBadge status={issue.status} compact />,
        onSelect: () => {
          setCommandPaletteOpen(false);
          openIssue(issue._id);
        },
      });
    }

    return list;
  }, [query, projects, issues, navigate, openCreateIssue, openIssue, setCommandPaletteOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length]);

  if (!commandPaletteOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setCommandPaletteOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (items.length ? (prev + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        items.length ? (prev - 1 + items.length) % items.length : 0
      );
    } else if (e.key === 'Enter' && items[activeIndex]) {
      e.preventDefault();
      items[activeIndex].onSelect();
    }
  };

  const groups: Array<PaletteItem['group']> = ['Actions', 'Issues', 'Projects', 'Navigation'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] bg-[#1F1F1E]/25 dark:bg-black/60 px-4"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-[640px] rounded-md bg-white dark:bg-[#201F1D] border border-[#DCD9D0] dark:border-[#3A3835] shadow-[0_12px_32px_rgba(31,31,30,0.08)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Quick command search"
      >
        <div className="flex items-center gap-3 h-12 px-4 border-b border-[#E4E2DC] dark:border-[#2E2D2A]">
          <Search className="w-4 h-4 text-[#8C8983] shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues by key or title, jump to projects or views..."
            className="w-full bg-transparent text-[15px] text-[#1F1F1E] dark:text-[#F3F0EE] placeholder:text-[#8C8983] focus:outline-none"
          />
          <kbd className="text-[11px] font-mono text-[#6B6964] px-1.5 py-0.5 rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-[#FAFAF8] dark:bg-[#181817]">
            ESC
          </kbd>
        </div>

        <div className="max-h-[380px] overflow-y-auto py-2">
          {items.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-[#8C8983]">
              No matching issues, projects, or views.
            </div>
          ) : (
            groups.map((group) => {
              const groupItems = items.filter((item) => item.group === group);
              if (groupItems.length === 0) return null;

              return (
                <div key={group} className="mb-2 last:mb-0">
                  <div className="px-4 py-1.5 text-[11px] font-mono uppercase tracking-wider text-[#8C8983]">
                    {group}
                  </div>
                  {groupItems.map((item) => {
                    const globalIdx = items.indexOf(item);
                    const isActive = globalIdx === activeIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                        onClick={item.onSelect}
                        className={`w-full flex items-center justify-between gap-3 h-9 px-4 text-left text-[13px] transition-colors ${
                          isActive
                            ? 'bg-[#F4F3EE] dark:bg-[#2A2926] text-[#1F1F1E] dark:text-[#F3F0EE]'
                            : 'text-[#1F1F1E] dark:text-[#D5D1C8]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.icon}
                          {item.issueKey && (
                            <span className="font-mono text-[11px] text-[#6B6964] dark:text-[#A8A49B] shrink-0">
                              {item.issueKey}
                            </span>
                          )}
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.hint && (
                          <span className="font-mono text-[11px] text-[#6B6964] dark:text-[#A8A49B] shrink-0">
                            {item.hint}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
