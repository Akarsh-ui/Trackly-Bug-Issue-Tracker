import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, MessageSquare, Paperclip, Plus } from 'lucide-react';
import type { Issue, IssueStatus } from '../types';
import { formatShortDate, STATUS_META } from '../utils/formatters';
import { Avatar } from './Avatar';
import { PriorityBadge, TypeIndicator } from './IssueBadges';

const COLUMNS: IssueStatus[] = ['To Do', 'In Progress', 'Done'];

const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return closestCorners(args);
};

interface KanbanBoardProps {
  issues: Issue[];
  onMoveIssue: (
    issueId: string,
    nextStatus: IssueStatus,
    targetPosition?: number
  ) => Promise<void>;
  onOpenIssue: (issueId: string) => void;
  onCreateInColumn: (status: IssueStatus) => void;
  readOnly?: boolean;
}

export function KanbanBoard({
  issues,
  onMoveIssue,
  onOpenIssue,
  onCreateInColumn,
  readOnly = false,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const grouped = useMemo(() => {
    const map: Record<IssueStatus, Issue[]> = {
      'To Do': [],
      'In Progress': [],
      Done: [],
    };
    for (const issue of issues) {
      if (map[issue.status]) {
        map[issue.status].push(issue);
      }
    }
    return map;
  }, [issues]);

  const activeIssue = useMemo(
    () => issues.find((i) => i._id === activeId) || null,
    [issues, activeId]
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (readOnly) return;
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    if (readOnly) return;
    const { active, over } = event;
    if (!over) return;

    const draggedIssueId = String(active.id);
    const overId = String(over.id);

    const draggedIssue = issues.find((i) => i._id === draggedIssueId);
    if (!draggedIssue) return;

    let targetStatus: IssueStatus | null = null;
    if (COLUMNS.includes(overId as IssueStatus)) {
      targetStatus = overId as IssueStatus;
    } else {
      const targetIssue = issues.find((i) => i._id === overId);
      if (targetIssue) {
        targetStatus = targetIssue.status;
      }
    }

    if (targetStatus && targetStatus !== draggedIssue.status) {
      await onMoveIssue(
        draggedIssueId,
        targetStatus,
        grouped[targetStatus].length
      );
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {COLUMNS.map((columnStatus) => (
          <KanbanColumn
            key={columnStatus}
            status={columnStatus}
            issues={grouped[columnStatus]}
            onOpenIssue={onOpenIssue}
            onCreateInColumn={() => onCreateInColumn(columnStatus)}
            readOnly={readOnly}
          />
        ))}
      </div>

      <DragOverlay>
        {activeIssue ? (
          <div className="w-[280px] sm:w-[300px] opacity-95 rotate-[1deg]">
            <IssueCardView issue={activeIssue} onClick={() => {}} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  issues,
  onOpenIssue,
  onCreateInColumn,
  readOnly = false,
}: {
  status: IssueStatus;
  issues: Issue[];
  onOpenIssue: (id: string) => void;
  onCreateInColumn: () => void;
  readOnly?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: readOnly });
  const meta = STATUS_META[status];

  return (
    <div
      ref={setNodeRef}
      data-column-status={status}
      className={`rounded-lg border transition-colors min-h-[380px] flex flex-col ${
        isOver
          ? 'border-[#C56A45] bg-[#FAF4F0] dark:bg-[#2A221E]'
          : 'border-[#E4E2DC] dark:border-[#2E2D2A] bg-[#F4F3EE] dark:bg-[#1C1B1A]'
      }`}
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#E4E2DC] dark:border-[#2E2D2A]">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-sm ${meta.dotColor}`} />
          <h3 className="text-[13px] font-semibold text-[#1F1F1E] dark:text-[#F3F0EE]">
            {status}
          </h3>
          <span className="font-mono text-xs text-[#6B6964] dark:text-[#A8A49B] tabular-nums">
            {issues.length}
          </span>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={onCreateInColumn}
            title={`Add issue to ${status}`}
            className="p-1 rounded text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE] hover:bg-white/80 dark:hover:bg-[#2A2926]"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <SortableContext
        items={issues.map((i) => i._id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="p-2.5 space-y-2.5 flex-1">
          {issues.length === 0 ? (
            <div className="py-12 px-4 text-center text-xs text-[#8C8983] border border-dashed border-[#DCD9D0] dark:border-[#3A3835] rounded">
              {readOnly
                ? `No issues in ${status}`
                : `Drop an issue here to mark as ${status}`}
            </div>
          ) : (
            issues.map((issue) => (
              <SortableIssueCard
                key={issue._id}
                issue={issue}
                onOpen={() => onOpenIssue(issue._id)}
                readOnly={readOnly}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableIssueCard({
  issue,
  onOpen,
  readOnly = false,
}: {
  issue: Issue;
  onOpen: () => void;
  readOnly?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue._id, disabled: readOnly });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(readOnly ? {} : listeners)}
    >
      <IssueCardView issue={issue} onClick={onOpen} readOnly={readOnly} />
    </div>
  );
}

function IssueCardView({
  issue,
  onClick,
  isOverlay = false,
  readOnly = false,
}: {
  issue: Issue;
  onClick: () => void;
  isOverlay?: boolean;
  readOnly?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`p-3 rounded border bg-white dark:bg-[#201F1D] ${
        readOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } transition-colors select-none ${
        isOverlay
          ? 'border-[#C56A45] shadow-[0_12px_32px_rgba(31,31,30,0.12)]'
          : 'border-[#E4E2DC] dark:border-[#2E2D2A] hover:border-[#DCD9D0] dark:hover:border-[#45423D] hover:bg-[#FAFAF8] dark:hover:bg-[#252422]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="font-mono text-[11px] font-medium text-[#6B6964] dark:text-[#A8A49B]">
          {issue.issueKey}
        </span>
        <PriorityBadge priority={issue.priority} />
      </div>

      <h4 className="text-[13px] font-medium leading-snug text-[#1F1F1E] dark:text-[#F3F0EE] line-clamp-2 mb-3">
        {issue.title}
      </h4>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F0EFEA] dark:border-[#2A2926]">
        <div className="flex items-center gap-2 min-w-0">
          <TypeIndicator type={issue.type} />
          {issue.dueDate && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#8C8983]">
              <Calendar className="w-3 h-3" />
              {formatShortDate(issue.dueDate).replace(/,\s\d{4}$/, '')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {(issue.commentCount || 0) > 0 && (
            <span className="inline-flex items-center gap-0.5 font-mono text-[11px] text-[#8C8983]">
              <MessageSquare className="w-3 h-3" />
              {issue.commentCount}
            </span>
          )}
          {issue.attachments?.length > 0 && (
            <span className="inline-flex items-center gap-0.5 font-mono text-[11px] text-[#8C8983]">
              <Paperclip className="w-3 h-3" />
              {issue.attachments.length}
            </span>
          )}
          <Avatar
            name={issue.assignee?.name}
            color={issue.assignee?.avatarColor || '#8C8983'}
            size="xs"
          />
        </div>
      </div>
    </div>
  );
}
