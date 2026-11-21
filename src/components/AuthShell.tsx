import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, CheckCircle2, Layers, Target } from 'lucide-react';

interface AuthShellProps {
  mode: 'login' | 'register';
  children: React.ReactNode;
}

type StageId = 'todo' | 'in_progress' | 'done';

interface MiniCard {
  id: string;
  title: string;
  priority: 'Urgent' | 'High' | 'Medium';
  owner: string;
  progress?: string;
}

const STAGE_COLUMNS: {
  id: StageId;
  label: string;
  count: number;
  summary: string;
  dotColor: string;
  cards: MiniCard[];
}[] = [
  {
    id: 'todo',
    label: 'To Do',
    count: 2,
    summary: 'Triage incoming reports with clear priority before sprint pickup.',
    dotColor: 'bg-[#8C8983]',
    cards: [
      {
        id: 'TRK-104',
        title: 'Validate webhook signature header',
        priority: 'High',
        owner: 'AK',
      },
      {
        id: 'TRK-109',
        title: 'Audit CSV export UTF-8 encoding',
        priority: 'Medium',
        owner: 'ML',
      },
    ],
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    count: 2,
    summary: 'Active work stays visible with explicit owners and scope.',
    dotColor: 'bg-[#C56A45]',
    cards: [
      {
        id: 'TRK-102',
        title: 'Fix session token refresh race',
        priority: 'Urgent',
        owner: 'SR',
        progress: '2 / 3 checks',
      },
      {
        id: 'TRK-106',
        title: 'Keyboard navigation in drawer',
        priority: 'Medium',
        owner: 'JT',
      },
    ],
  },
  {
    id: 'done',
    label: 'Done',
    count: 2,
    summary: 'Verified fixes close the loop for engineering and product.',
    dotColor: 'bg-[#557A59]',
    cards: [
      {
        id: 'TRK-098',
        title: 'Save project filter presets',
        priority: 'Medium',
        owner: 'ML',
      },
      {
        id: 'TRK-101',
        title: 'Preserve board column sort',
        priority: 'High',
        owner: 'AK',
      },
    ],
  },
];

function priorityDotColor(priority: MiniCard['priority']): string {
  if (priority === 'Urgent') return 'bg-[#B3473B]';
  if (priority === 'High') return 'bg-[#C47D2B]';
  return 'bg-[#8C8983]';
}

export function AuthShell({ mode, children }: AuthShellProps) {
  const prefersReducedMotion = useReducedMotion();
  const [focusedStage, setFocusedStage] = useState<StageId>('in_progress');

  const activeStage =
    STAGE_COLUMNS.find((col) => col.id === focusedStage) ?? STAGE_COLUMNS[1];

  const headline =
    mode === 'login'
      ? "Keep your team's work moving."
      : 'Bring clarity to every issue.';

  const subtitle =
    mode === 'login'
      ? 'Trackly helps software teams capture bugs, assign clear ownership, and guide every release from triage to done.'
      : 'Set up your Trackly workspace to organize projects, track bugs across stages, and keep engineering aligned.';

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F7F6F2] dark:bg-[#181817] text-[#1F1F1E] dark:text-[#F3F0EE] overflow-x-hidden">
      {/* Left Brand & Workflow Experience Column */}
      <aside className="lg:w-[54%] xl:w-[55%] bg-[#F0EEE8] dark:bg-[#141413] border-b lg:border-b-0 lg:border-r border-[#E4E2DC] dark:border-[#2E2D2A] flex flex-col justify-between">
        {/* Compact mobile/tablet brand header */}
        <div className="flex lg:hidden items-center justify-between px-5 sm:px-8 py-4">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded bg-[#C56A45] text-white font-display font-bold text-sm inline-flex items-center justify-center">
              T
            </span>
            <span className="text-[17px] font-display font-semibold tracking-tight text-[#1F1F1E] dark:text-[#F3F0EE]">
              Trackly
            </span>
          </div>
          <span className="text-xs text-[#6B6964] dark:text-[#A8A49B]">
            Bug &amp; Issue Tracker
          </span>
        </div>

        {/* Full desktop brand & workflow showcase */}
        <div className="hidden lg:flex flex-col justify-between flex-1 px-11 xl:px-14 py-10 max-w-[780px]">
          {/* Top Brand Lockup */}
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded bg-[#C56A45] text-white font-display font-bold text-sm inline-flex items-center justify-center">
              T
            </span>
            <span className="text-[17px] font-display font-semibold tracking-tight text-[#1F1F1E] dark:text-[#F3F0EE]">
              Trackly
            </span>
          </div>

          {/* Editorial Headline + Miniature Kanban Workflow Illustration */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="my-8"
          >
            <h1 className="font-display text-[32px] xl:text-[36px] font-semibold tracking-tight leading-[1.14] text-[#1F1F1E] dark:text-[#F3F0EE] text-balance max-w-[18ch]">
              {headline}
            </h1>
            <p className="mt-3.5 text-[14px] leading-[1.6] text-[#6B6964] dark:text-[#A8A49B] max-w-[48ch]">
              {subtitle}
            </p>

            {/* Miniature Interactive Kanban Illustration */}
            <div
              className="mt-8 rounded-lg border border-[#DCD9D0] dark:border-[#2E2D2A] bg-[#F7F6F2] dark:bg-[#1B1A18] p-4"
              aria-label="Trackly workflow board preview"
            >
              {/* Miniature Board Header */}
              <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-[#E4E2DC] dark:border-[#2E2D2A]">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                    Core Platform
                  </span>
                  <span className="text-[#B8B4AA] dark:text-[#5B5852]">·</span>
                  <span className="font-mono text-[11px] text-[#6B6964] dark:text-[#A8A49B]">
                    Release Board
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#6B6964] dark:text-[#A8A49B]">
                  <span>Stage:</span>
                  <span className="font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                    {activeStage.label}
                  </span>
                </div>
              </div>

              {/* Three Connected Kanban Stage Columns */}
              <div className="grid grid-cols-3 gap-2.5">
                {STAGE_COLUMNS.map((col, idx) => {
                  const isFocused = col.id === focusedStage;
                  return (
                    <div
                      key={col.id}
                      className={`rounded-md border p-2.5 transition-colors duration-200 ${
                        isFocused
                          ? 'border-[#C56A45]/45 bg-white dark:bg-[#22201E]'
                          : 'border-[#E4E2DC] dark:border-[#2A2825] bg-[#F3F1EB] dark:bg-[#171614]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setFocusedStage(col.id)}
                        className="w-full flex items-center justify-between mb-2.5 text-left group cursor-pointer focus:outline-none"
                      >
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${col.dotColor}`}
                          />
                          <span
                            className={`text-[11px] font-semibold tracking-tight truncate transition-colors ${
                              isFocused
                                ? 'text-[#1F1F1E] dark:text-[#F3F0EE]'
                                : 'text-[#6B6964] dark:text-[#A8A49B] group-hover:text-[#1F1F1E] dark:group-hover:text-[#F3F0EE]'
                            }`}
                          >
                            {col.label}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1 shrink-0">
                          <span className="font-mono text-[10px] text-[#8C8983] tabular-nums">
                            {col.count}
                          </span>
                          {idx < STAGE_COLUMNS.length - 1 && (
                            <ArrowRight
                              className="w-2.5 h-2.5 text-[#B8B4AA] dark:text-[#5B5852]"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                      </button>

                      <div className="space-y-2">
                        {col.cards.map((card) => {
                          const isDone = col.id === 'done';
                          return (
                            <button
                              key={card.id}
                              type="button"
                              onClick={() => setFocusedStage(col.id)}
                              className={`w-full text-left rounded border p-2 transition-transform duration-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#C56A45]/40 ${
                                prefersReducedMotion ? '' : 'hover:-translate-y-0.5'
                              } ${
                                isFocused
                                  ? 'border-[#E4E2DC] dark:border-[#34322E] bg-[#FAFAF8] dark:bg-[#1A1917]'
                                  : 'border-[#E4E2DC]/80 dark:border-[#2C2A27] bg-white/80 dark:bg-[#1E1D1B]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5 mb-1">
                                <span className="font-mono text-[10px] text-[#8C8983] tabular-nums">
                                  {card.id}
                                </span>
                                {isDone ? (
                                  <Check
                                    className="w-3 h-3 text-[#557A59]"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-[#6B6964] dark:text-[#A8A49B]">
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${priorityDotColor(
                                        card.priority
                                      )}`}
                                    />
                                    <span>{card.priority}</span>
                                  </span>
                                )}
                              </div>

                              <p
                                className={`text-[11px] leading-[1.35] font-medium line-clamp-2 ${
                                  isDone
                                    ? 'text-[#6B6964] dark:text-[#8C8983] line-through decoration-[#B8B4AA]'
                                    : 'text-[#1F1F1E] dark:text-[#F3F0EE]'
                                }`}
                              >
                                {card.title}
                              </p>

                              <div className="mt-2 flex items-center justify-between">
                                {card.progress ? (
                                  <span className="font-mono text-[10px] text-[#C56A45] tabular-nums">
                                    {card.progress}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-[#8C8983]">
                                    {isDone ? 'Verified' : 'Assigned'}
                                  </span>
                                )}
                                <span className="w-4 h-4 rounded bg-[#ECE9E1] dark:bg-[#2C2A27] text-[9px] font-semibold text-[#605E59] dark:text-[#C5C0B6] inline-flex items-center justify-center">
                                  {card.owner}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stage Caption */}
              <div className="mt-3 pt-2.5 border-t border-[#E4E2DC] dark:border-[#2E2D2A] flex items-center justify-between gap-4 text-[11px] text-[#6B6964] dark:text-[#A8A49B]">
                <span>{activeStage.summary}</span>
                <span className="shrink-0 font-mono text-[10px] text-[#8C8983]">
                  Select a stage
                </span>
              </div>
            </div>
          </motion.div>

          {/* Bottom Supporting Details */}
          <div className="grid grid-cols-3 gap-5 pt-6 border-t border-[#E4E2DC] dark:border-[#2E2D2A]">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                <Layers className="w-3.5 h-3.5 text-[#C56A45]" aria-hidden="true" />
                <span>Organized team workflows</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#6B6964] dark:text-[#A8A49B]">
                Structured stages from intake to release.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                <Target className="w-3.5 h-3.5 text-[#C56A45]" aria-hidden="true" />
                <span>Clear issue ownership</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#6B6964] dark:text-[#A8A49B]">
                Every bug and task tracks an accountable owner.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C56A45]" aria-hidden="true" />
                <span>Progress at a glance</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#6B6964] dark:text-[#A8A49B]">
                Spot priorities and blockers across projects.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Right Integrated Authentication Section */}
      <main className="flex-1 lg:w-[46%] xl:w-[45%] flex flex-col justify-center px-5 sm:px-8 lg:px-12 py-8 sm:py-12">
        <motion.div
          key={mode}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[410px] mx-auto"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
