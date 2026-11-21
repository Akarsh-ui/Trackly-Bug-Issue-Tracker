import type { IssuePriority, IssueStatus, IssueType } from '../types';

export function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatRelativeTime(dateInput: string | Date): string {
  const date = new Date(dateInput);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 14) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';
  return new Date(dateInput).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const formatDate = formatShortDate;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const STATUS_META: Record<
  IssueStatus,
  { dotColor: string; textColor: string; bgWash: string }
> = {
  'To Do': {
    dotColor: 'bg-[#78756F]',
    textColor: 'text-[#6B6964] dark:text-[#A8A49B]',
    bgWash: 'bg-[#F0EFEA] dark:bg-[#2A2926]',
  },
  'In Progress': {
    dotColor: 'bg-[#C47D2B]',
    textColor: 'text-[#9A5E19] dark:text-[#E5A95E]',
    bgWash: 'bg-[#FCF3E6] dark:bg-[#332719]',
  },
  Done: {
    dotColor: 'bg-[#557A59]',
    textColor: 'text-[#3F5F43] dark:text-[#86B38B]',
    bgWash: 'bg-[#EEF3EE] dark:bg-[#1E2B20]',
  },
};

export const PRIORITY_META: Record<
  IssuePriority,
  { textColor: string; bgWash: string; borderColor: string }
> = {
  Urgent: {
    textColor: 'text-[#B3473B] dark:text-[#EB8B80]',
    bgWash: 'bg-[#FBEAE8] dark:bg-[#361E1C]',
    borderColor: 'border-[#B3473B]/20',
  },
  High: {
    textColor: 'text-[#B8681C] dark:text-[#E5A95E]',
    bgWash: 'bg-[#FCF3E6] dark:bg-[#332719]',
    borderColor: 'border-[#C47D2B]/20',
  },
  Medium: {
    textColor: 'text-[#6B6964] dark:text-[#B8B4AA]',
    bgWash: 'bg-[#F0EFEA] dark:bg-[#2A2926]',
    borderColor: 'border-[#DCD9D0] dark:border-[#3A3835]',
  },
  Low: {
    textColor: 'text-[#8C8983] dark:text-[#8C8983]',
    bgWash: 'bg-[#F6F5F0] dark:bg-[#242321]',
    borderColor: 'border-[#E4E2DC] dark:border-[#33312E]',
  },
};

export const TYPE_META: Record<IssueType, { color: string }> = {
  Bug: { color: 'text-[#B3473B] dark:text-[#EB8B80]' },
  'Feature Request': { color: 'text-[#C56A45] dark:text-[#E28A65]' },
  Task: { color: 'text-[#6B6964] dark:text-[#A8A49B]' },
  Improvement: { color: 'text-[#557A59] dark:text-[#86B38B]' },
  'UI/UX': { color: 'text-[#9A5E19] dark:text-[#E5A95E]' },
  Performance: { color: 'text-[#C47D2B] dark:text-[#E5A95E]' },
  Security: { color: 'text-[#9E352B] dark:text-[#F09A90]' },
  Documentation: { color: 'text-[#576B7C] dark:text-[#96B0C6]' },
  'Research / Spike': { color: 'text-[#7A5980] dark:text-[#C4A5CA]' },
  Maintenance: { color: 'text-[#6D6552] dark:text-[#B4AB97]' },
};

