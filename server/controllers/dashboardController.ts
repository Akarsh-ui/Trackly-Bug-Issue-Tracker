import type { Response, NextFunction } from 'express';
import { ISSUE_TYPES, Issue } from '../models/Issue.ts';
import { Project } from '../models/Project.ts';
import { Activity } from '../models/Activity.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { getAccessibleProjectIds, requireProjectAccess } from '../utils/projectAuth.ts';

export async function getDashboardStats(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const { projectId } = req.query;
    const issueMatch: Record<string, unknown> = {};
    const activityMatch: Record<string, unknown> = {};
    const projectFilter: Record<string, unknown> = {};

    if (projectId && projectId !== 'all') {
      const { project } = await requireProjectAccess(req.user._id, projectId, 'read');
      issueMatch.project = project._id;
      activityMatch.project = project._id;
      projectFilter._id = project._id;
    } else {
      const { projectIds } = await getAccessibleProjectIds(req.user._id);
      if (projectIds.length === 0) {
        res.json({
          stats: {
            totalIssues: 0,
            openIssues: 0,
            inProgressIssues: 0,
            resolvedIssues: 0,
            myAssignedIssues: 0,
            overdueIssues: 0,
          },
          issuesByPriority: ['Urgent', 'High', 'Medium', 'Low'].map((priority) => ({
            priority,
            count: 0,
          })),
          issuesByType: ISSUE_TYPES.map((type) => ({ type, count: 0 })),
          projectProgress: [],
          myAssignedList: [],
          overdueList: [],
          recentActivities: [],
        });
        return;
      }

      issueMatch.project = { $in: projectIds };
      activityMatch.project = { $in: projectIds };
      projectFilter._id = { $in: projectIds };
    }

    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const overdueFilter: Record<string, unknown> = {
      ...issueMatch,
      status: { $ne: 'Done' },
      dueDate: { $ne: null, $lt: startOfToday },
    };

    const [
      totalIssues,
      openIssues,
      inProgressIssues,
      resolvedIssues,
      overdueIssues,
      overdueList,
      myAssignedCount,
      myAssignedIssues,
      priorityCounts,
      typeCounts,
      projects,
      projectIssueBreakdown,
      recentActivities,
    ] = await Promise.all([
      Issue.countDocuments(issueMatch),
      Issue.countDocuments({ ...issueMatch, status: 'To Do' }),
      Issue.countDocuments({ ...issueMatch, status: 'In Progress' }),
      Issue.countDocuments({ ...issueMatch, status: 'Done' }),
      Issue.countDocuments(overdueFilter),
      Issue.find(overdueFilter)
        .populate('project', 'name key')
        .populate('assignee', 'name email avatar avatarColor')
        .sort({ dueDate: 1, priorityWeight: -1 })
        .limit(8)
        .lean(),
      Issue.countDocuments({
        ...issueMatch,
        assignee: req.user._id,
        status: { $ne: 'Done' },
      }),
      Issue.find({
        ...issueMatch,
        assignee: req.user._id,
        status: { $ne: 'Done' },
      })
        .populate('project', 'name key')
        .populate('assignee', 'name email avatar avatarColor')
        .sort({ priorityWeight: -1, updatedAt: -1 })
        .limit(8)
        .lean(),
      Issue.aggregate([
        { $match: issueMatch },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      Issue.aggregate([
        { $match: issueMatch },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      Project.find(projectFilter)
        .populate('lead', 'name avatar avatarColor')
        .sort({ createdAt: 1 })
        .lean(),
      Issue.aggregate([
        { $match: issueMatch },
        {
          $group: {
            _id: '$project',
            total: { $sum: 1 },
            todo: { $sum: { $cond: [{ $eq: ['$status', 'To Do'] }, 1, 0] } },
            inProgress: {
              $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] },
            },
            done: { $sum: { $cond: [{ $eq: ['$status', 'Done'] }, 1, 0] } },
          },
        },
      ]),
      Activity.find(activityMatch)
        .populate('user', 'name email avatar avatarColor role')
        .populate('project', 'name key')
        .populate('issue', 'issueKey title')
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
    ]);

    const priorityMap = new Map<string, number>();
    for (const p of priorityCounts) priorityMap.set(p._id, p.count);

    const issuesByPriority = ['Urgent', 'High', 'Medium', 'Low'].map((priority) => ({
      priority,
      count: priorityMap.get(priority) || 0,
    }));

    const typeMap = new Map<string, number>();
    for (const t of typeCounts) typeMap.set(t._id, t.count);

    const issuesByType = ISSUE_TYPES.map((type) => ({
      type,
      count: typeMap.get(type) || 0,
    }));

    const projectStatsMap = new Map<
      string,
      { total: number; todo: number; inProgress: number; done: number }
    >();
    for (const row of projectIssueBreakdown) {
      projectStatsMap.set(String(row._id), {
        total: row.total,
        todo: row.todo,
        inProgress: row.inProgress,
        done: row.done,
      });
    }

    const projectProgress = projects.map((p) => {
      const counts = projectStatsMap.get(String(p._id)) || {
        total: 0,
        todo: 0,
        inProgress: 0,
        done: 0,
      };
      const percentage =
        counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
      return {
        _id: p._id,
        name: p.name,
        key: p.key,
        lead: p.lead,
        total: counts.total,
        todo: counts.todo,
        inProgress: counts.inProgress,
        done: counts.done,
        percentage,
      };
    });

    res.json({
      stats: {
        totalIssues,
        openIssues,
        inProgressIssues,
        resolvedIssues,
        myAssignedIssues: myAssignedCount,
        overdueIssues,
      },
      issuesByPriority,
      issuesByType,
      projectProgress,
      myAssignedList: myAssignedIssues,
      overdueList,
      recentActivities,
    });
  } catch (err) {
    next(err);
  }
}
