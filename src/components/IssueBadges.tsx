import React from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Bug,
  CheckSquare,
  FileText,
  FlaskConical,
  Gauge,
  Lightbulb,
  Palette,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import type { IssuePriority, IssueStatus, IssueType } from '../types';
import { PRIORITY_META, STATUS_META, TYPE_META } from '../utils/formatters';

export function StatusBadge({
  status,
  compact = false,
}: {
  status: IssueStatus;
  compact?: boolean;
}) {
  const meta = STATUS_META[status] || STATUS_META['To Do'];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${meta.bgWash} ${meta.textColor}`}
    >
      <span className={`w-1.5 h-1.5 rounded-sm ${meta.dotColor}`} aria-hidden="true" />
      {!compact && <span>{status}</span>}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: IssuePriority }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.Medium;
  const Icon =
    priority === 'Urgent'
      ? AlertCircle
      : priority === 'High'
      ? ArrowUp
      : priority === 'Medium'
      ? ArrowRight
      : ArrowDown;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium border whitespace-nowrap shrink-0 ${meta.bgWash} ${meta.textColor} ${meta.borderColor}`}
    >
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>{priority}</span>
    </span>
  );
}

export function TypeIndicator({ type }: { type: IssueType }) {
  const meta = TYPE_META[type] || TYPE_META.Task;
  const Icon =
    type === 'Bug'
      ? Bug
      : type === 'Feature Request'
        ? Lightbulb
        : type === 'Improvement'
          ? ArrowUpRight
          : type === 'UI/UX'
            ? Palette
            : type === 'Performance'
              ? Gauge
              : type === 'Security'
                ? ShieldAlert
                : type === 'Documentation'
                  ? FileText
                  : type === 'Research / Spike'
                    ? FlaskConical
                    : type === 'Maintenance'
                      ? Wrench
                      : CheckSquare;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[#6B6964] dark:text-[#A8A49B] whitespace-nowrap shrink-0">
      <Icon className={`w-3.5 h-3.5 shrink-0 ${meta.color}`} aria-hidden="true" />
      <span>{type}</span>
    </span>
  );
}

