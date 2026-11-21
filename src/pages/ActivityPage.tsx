import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { api } from '../services/api';
import { useWorkspace } from '../context/WorkspaceContext';
import type { Activity } from '../types';
import { formatRelativeTime } from '../utils/formatters';
import { Avatar } from '../components/Avatar';

export function ActivityPage() {
  const { projects, members, openIssue, dataVersion } = useWorkspace();
  const [project, setProject] = useState('all');
  const [action, setAction] = useState('all');
  const [userId, setUserId] = useState('all');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (project !== 'all' && !projects.some((p) => p._id === project)) {
      setProject('all');
    }
  }, [projects, project]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.activities
      .list({ project, action, user: userId, limit: 80 })
      .then((res) => {
        if (!cancelled) setActivities(res.activities);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load activity timeline');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [project, action, userId, dataVersion]);

  const hasFilters = project !== 'all' || action !== 'all' || userId !== 'all';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[#1F1F1E] dark:text-[#F3F0EE]">
          Activity Timeline
        </h1>
        <p className="text-[13px] text-[#6B6964] dark:text-[#A8A49B]">
          Chronological audit stream of project updates, assignments, status changes, and comments.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D]">
        <select
          aria-label="Filter by project"
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="h-8 px-2.5 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
        >
          <option value="all">All Projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.key} — {p.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by event type"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="h-8 px-2.5 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
        >
          <option value="all">All Events</option>
          <option value="ISSUE_CREATED">Issue Created</option>
          <option value="STATUS_CHANGED">Status Changed</option>
          <option value="ISSUE_ASSIGNED">Issue Assigned</option>
          <option value="PRIORITY_UPDATED">Priority Updated</option>
          <option value="ISSUE_UPDATED">Issue Updated</option>
          <option value="COMMENT_ADDED">Comment Added</option>
          <option value="ISSUE_DELETED">Issue Deleted</option>
          <option value="PROJECT_CREATED">Project Created</option>
          <option value="PROJECT_UPDATED">Project Updated</option>
          <option value="MEMBER_INVITED">Member Invited</option>
          <option value="INVITATION_CREATED">Invitation Created</option>
          <option value="INVITATION_ACCEPTED">Invitation Accepted</option>
          <option value="INVITATION_REVOKED">Invitation Revoked</option>
        </select>

        <select
          aria-label="Filter by team member"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="h-8 px-2.5 text-xs rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#181817]"
        >
          <option value="all">All Team Members</option>
          {members.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setProject('all');
              setAction('all');
              setUserId('all');
            }}
            className="inline-flex items-center gap-1 h-8 px-2.5 text-xs text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE] rounded border border-[#E4E2DC] dark:border-[#3A3835]"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded border border-[#B3473B]/30 bg-[#FBEAE8] text-xs text-[#B3473B]">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-[#E4E2DC] dark:border-[#2E2D2A] bg-white dark:bg-[#201F1D] divide-y divide-[#E4E2DC] dark:divide-[#2E2D2A]">
        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-9 bg-[#F4F3EE] dark:bg-[#252422] rounded" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="p-12 text-center space-y-2.5">
            <p className="text-[13px] text-[#6B6964] dark:text-[#A8A49B]">
              {hasFilters
                ? 'No activity matches the selected filters.'
                : 'No recent activity yet.'}
            </p>
            {!hasFilters && (
              <p className="text-xs text-[#8C8983]">
                Events are recorded automatically when your team creates projects, updates issues, or posts comments.
              </p>
            )}
          </div>
        ) : (
          activities.map((act) => (
            <div
              key={act._id}
              className="px-4 py-3 flex items-start justify-between gap-4 text-[13px]"
            >
              <div className="flex items-start gap-3 min-w-0">
                <Avatar
                  name={act.user?.name}
                  color={act.user?.avatarColor}
                  size="sm"
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <p className="leading-snug">
                    <span className="font-medium text-[#1F1F1E] dark:text-[#F3F0EE]">
                      {act.user?.name}
                    </span>{' '}
                    <span className="text-[#6B6964] dark:text-[#A8A49B]">
                      {act.description}
                    </span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#8C8983]">
                    {act.project && (
                      <Link
                        to={`/projects/${act.project._id}`}
                        className="font-mono hover:text-[#C56A45]"
                      >
                        {act.project.key}
                      </Link>
                    )}
                    {act.project && act.issue?._id && <span aria-hidden="true">·</span>}
                    {act.issue?._id && (
                      <button
                        type="button"
                        onClick={() => openIssue(act.issue!._id)}
                        className="font-mono text-[#C56A45] hover:underline"
                      >
                        View {act.issue.issueKey}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <span className="font-mono text-xs text-[#8C8983] whitespace-nowrap shrink-0">
                {formatRelativeTime(act.createdAt)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
