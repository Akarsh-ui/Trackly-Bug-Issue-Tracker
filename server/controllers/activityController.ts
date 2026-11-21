import type { Response, NextFunction } from 'express';
import { Activity } from '../models/Activity.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';
import {
  assertValidObjectId,
  getAccessibleProjectIds,
  requireProjectAccess,
} from '../utils/projectAuth.ts';

export async function getActivities(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const { project, issue, user, action, limit = '50' } = req.query;

    const filter: Record<string, unknown> = {};
    if (project && project !== 'all') {
      const { project: accessibleProject } = await requireProjectAccess(
        req.user._id,
        project,
        'read'
      );
      filter.project = accessibleProject._id;
    } else {
      const { projectIds } = await getAccessibleProjectIds(req.user._id);
      if (projectIds.length === 0) {
        res.json({ activities: [] });
        return;
      }
      filter.project = { $in: projectIds };
    }

    if (issue) {
      filter.issue = assertValidObjectId(issue, 'issue');
    }
    if (user && user !== 'all') {
      filter.user = assertValidObjectId(user, 'user');
    }
    if (action && action !== 'all') {
      filter.action = String(action);
    }

    const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

    const activities = await Activity.find(filter)
      .populate('user', 'name email avatar avatarColor role')
      .populate('project', 'name key')
      .populate('issue', 'issueKey title status priority')
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .lean();

    res.json({ activities });
  } catch (err) {
    next(err);
  }
}
