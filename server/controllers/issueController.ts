import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import {
  ISSUE_TYPES,
  Issue,
  type IBugDetails,
  type IFeatureDetails,
  type IssueType,
} from '../models/Issue.ts';
import { Project } from '../models/Project.ts';
import { Comment } from '../models/Comment.ts';
import { Activity } from '../models/Activity.ts';
import { User } from '../models/User.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { validateOptionalDueDate } from '../utils/validation.ts';
import {
  assertValidObjectId,
  canDeleteIssue,
  getAccessibleProjectIds,
  isActiveProjectMember,
  requireProjectAccess,
} from '../utils/projectAuth.ts';

function parseLabelsInput(raw: unknown): string[] {
  if (!raw) return [];
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      list = Array.isArray(parsed) ? parsed : trimmed.split(',');
    } catch {
      list = trimmed.split(',');
    }
  }
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const item of list) {
    const val = String(item || '').trim().slice(0, 32);
    if (val && !seen.has(val.toLowerCase())) {
      seen.add(val.toLowerCase());
      cleaned.push(val);
    }
    if (cleaned.length >= 10) break;
  }
  return cleaned;
}

function parseJsonObject<T extends Record<string, unknown>>(raw: unknown): T | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as T;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as T;
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function sanitizeBugDetails(raw: unknown): IBugDetails | undefined {
  const obj = parseJsonObject<Record<string, unknown>>(raw);
  if (!obj) return undefined;
  return {
    stepsToReproduce: String(obj.stepsToReproduce || '').trim().slice(0, 4000),
    expectedResult: String(obj.expectedResult || '').trim().slice(0, 2000),
    actualResult: String(obj.actualResult || '').trim().slice(0, 2000),
    environment: String(obj.environment || '').trim().slice(0, 500),
  };
}

function sanitizeFeatureDetails(raw: unknown): IFeatureDetails | undefined {
  const obj = parseJsonObject<Record<string, unknown>>(raw);
  if (!obj) return undefined;
  return {
    featureDescription: String(obj.featureDescription || '').trim().slice(0, 4000),
    reasonForRequest: String(obj.reasonForRequest || '').trim().slice(0, 2000),
    expectedOutcome: String(obj.expectedOutcome || '').trim().slice(0, 2000),
  };
}

function populateIssueQuery(query: ReturnType<typeof Issue.find>) {
  return query
    .populate('assignee', 'name email avatar avatarColor role title')
    .populate('reporter', 'name email avatar avatarColor role title')
    .populate('project', 'name key');
}

export async function getIssues(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const {
      search,
      status,
      priority,
      type,
      assignee,
      project,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const filter: Record<string, unknown> = {};

    if (project && project !== 'all') {
      const { project: targetProject } = await requireProjectAccess(
        req.user._id,
        String(project),
        'read'
      );
      filter.project = targetProject._id;
    } else {
      const { projectIds } = await getAccessibleProjectIds(req.user._id);
      if (projectIds.length === 0) {
        res.json({ issues: [] });
        return;
      }
      filter.project = { $in: projectIds };
    }

    if (status && status !== 'all') {
      filter.status = String(status);
    }
    if (priority && priority !== 'all') {
      filter.priority = String(priority);
    }
    if (type && type !== 'all') {
      filter.type = String(type);
    }
    if (assignee && assignee !== 'all') {
      if (assignee === 'unassigned') {
        filter.assignee = null;
      } else if (assignee === 'me') {
        filter.assignee = req.user._id;
      } else {
        filter.assignee = assertValidObjectId(assignee, 'assignee');
      }
    }

    if (search && String(search).trim()) {
      const q = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { issueKey: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { labels: { $regex: q, $options: 'i' } },
      ];
    }

    const direction = sortOrder === 'asc' ? 1 : -1;
    let sortSpec: Record<string, 1 | -1> = { createdAt: direction };
    if (sortBy === 'priority') {
      sortSpec = { priorityWeight: direction, createdAt: -1 };
    } else if (sortBy === 'updatedAt') {
      sortSpec = { updatedAt: direction };
    } else if (sortBy === 'dueDate') {
      sortSpec = { dueDate: direction, createdAt: -1 };
    } else if (sortBy === 'position') {
      sortSpec = { position: 1, createdAt: -1 };
    }

    const issues = await populateIssueQuery(Issue.find(filter).sort(sortSpec)).lean();

    const issueIds = issues.map((i) => i._id);
    const commentCounts =
      issueIds.length > 0
        ? await Comment.aggregate([
            { $match: { issue: { $in: issueIds } } },
            { $group: { _id: '$issue', count: { $sum: 1 } } },
          ])
        : [];
    const commentCountMap = new Map<string, number>();
    for (const row of commentCounts) {
      commentCountMap.set(String(row._id), row.count);
    }

    const enriched = issues.map((issue) => ({
      ...issue,
      commentCount: commentCountMap.get(String(issue._id)) || 0,
    }));

    res.json({ issues: enriched });
  } catch (err) {
    next(err);
  }
}

export async function getIssueById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const rawId = String(req.params.id || '').trim();
    const isObjectId = mongoose.isValidObjectId(rawId);
    const query = isObjectId
      ? Issue.findById(rawId)
      : Issue.findOne({ issueKey: rawId.toUpperCase() });

    const issue = await query
      .populate('assignee', 'name email avatar avatarColor role title')
      .populate('reporter', 'name email avatar avatarColor role title')
      .populate('project', 'name key members lead owner')
      .lean();

    if (!issue) {
      throw new AppError('Issue not found.', 404);
    }

    const projectId =
      (issue.project as unknown as { _id?: unknown })?._id || issue.project;
    await requireProjectAccess(req.user._id, projectId, 'read');

    const [comments, activities] = await Promise.all([
      Comment.find({ issue: issue._id })
        .populate('user', 'name email avatar avatarColor role title')
        .sort({ createdAt: 1 })
        .lean(),
      Activity.find({ issue: issue._id })
        .populate('user', 'name email avatar avatarColor role')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    res.json({ issue, comments, activities });
  } catch (err) {
    next(err);
  }
}

export async function createIssue(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const {
      title,
      description,
      type,
      priority,
      status,
      assignee,
      project,
      dueDate,
      labels,
      bugDetails,
      featureDetails,
    } = req.body;

    if (!title || !String(title).trim() || !project) {
      throw new AppError('Issue title and project are required.', 400);
    }

    const { project: targetProject } = await requireProjectAccess(
      req.user._id,
      project,
      'writeIssues'
    );

    if (type !== undefined && !ISSUE_TYPES.includes(type as IssueType)) {
      throw new AppError('Invalid issue type selected.', 400);
    }

    const dueErr = validateOptionalDueDate(dueDate);
    if (dueErr) throw new AppError(dueErr, 400);

    if (assignee) {
      const assigneeId = assertValidObjectId(assignee, 'assignee');
      const isProjectMember = await isActiveProjectMember(assigneeId, targetProject._id);
      if (!isProjectMember) {
        throw new AppError(
          'Issues can only be assigned to members of the selected project.',
          400
        );
      }
    }

    const updatedProject = await Project.findByIdAndUpdate(
      targetProject._id,
      { $inc: { issueCounter: 1 } },
      { new: true }
    );
    if (!updatedProject) {
      throw new AppError('Selected project does not exist.', 404);
    }

    const issueNumber = String(updatedProject.issueCounter).padStart(3, '0');
    const issueKey = `${updatedProject.key}-${issueNumber}`;

    const attachments = [];
    if (req.file) {
      attachments.push({
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`,
        uploadedBy: req.user._id,
        uploadedAt: new Date(),
      });
    }

    const normalizedType: IssueType = (type as IssueType) || 'Task';
    const issue = await Issue.create({
      issueKey,
      title: String(title).trim(),
      description: description ? String(description).trim() : '',
      type: normalizedType,
      priority: priority || 'Medium',
      status: status || 'To Do',
      assignee: assignee ? assertValidObjectId(assignee, 'assignee') : null,
      reporter: req.user._id,
      project: updatedProject._id,
      dueDate: dueDate ? new Date(dueDate) : null,
      labels: parseLabelsInput(labels),
      bugDetails:
        normalizedType === 'Bug' ? sanitizeBugDetails(bugDetails) : undefined,
      featureDetails:
        normalizedType === 'Feature Request'
          ? sanitizeFeatureDetails(featureDetails)
          : undefined,
      attachments,
    });

    await Activity.create({
      user: req.user._id,
      project: updatedProject._id,
      issue: issue._id,
      issueKey: issue.issueKey,
      action: 'ISSUE_CREATED',
      description: `created ${issue.issueKey}: ${issue.title}`,
    });

    if (assignee) {
      const assigneeUser = await User.findById(assignee).select('name').lean();
      if (assigneeUser) {
        await Activity.create({
          user: req.user._id,
          project: updatedProject._id,
          issue: issue._id,
          issueKey: issue.issueKey,
          action: 'ISSUE_ASSIGNED',
          description: `assigned ${issue.issueKey} to ${assigneeUser.name}`,
        });
      }
    }

    const populated = await Issue.findById(issue._id)
      .populate('assignee', 'name email avatar avatarColor role title')
      .populate('reporter', 'name email avatar avatarColor role title')
      .populate('project', 'name key')
      .lean();

    res.status(201).json({ issue: { ...populated, commentCount: 0 } });
  } catch (err) {
    next(err);
  }
}

export async function updateIssue(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const id = assertValidObjectId(req.params.id, 'issue');
    const issue = await Issue.findById(id);
    if (!issue) throw new AppError('Issue not found.', 404);

    await requireProjectAccess(req.user._id, issue.project, 'writeIssues');

    const {
      title,
      description,
      type,
      priority,
      status,
      assignee,
      dueDate,
      labels,
      bugDetails,
      featureDetails,
    } = req.body;

    if (type !== undefined && !ISSUE_TYPES.includes(type as IssueType)) {
      throw new AppError('Invalid issue type selected.', 400);
    }

    if (dueDate !== undefined) {
      const dueErr = validateOptionalDueDate(dueDate);
      if (dueErr) throw new AppError(dueErr, 400);
    }

    if (assignee) {
      const assigneeId = assertValidObjectId(assignee, 'assignee');
      const isProjectMember = await isActiveProjectMember(assigneeId, issue.project);
      if (!isProjectMember) {
        throw new AppError(
          'Issues can only be assigned to members of this project.',
          400
        );
      }
    }

    const prevStatus = issue.status;
    const prevPriority = issue.priority;
    const prevAssignee = issue.assignee ? String(issue.assignee) : null;

    if (title !== undefined) {
      if (!String(title).trim()) throw new AppError('Issue title cannot be empty.', 400);
      issue.title = String(title).trim();
    }
    if (description !== undefined) issue.description = String(description).trim();
    if (type !== undefined) issue.type = type;
    if (priority !== undefined) issue.priority = priority;
    if (status !== undefined) issue.status = status;
    if (assignee !== undefined) {
      issue.assignee = assignee ? assertValidObjectId(assignee, 'assignee') : null;
    }
    if (dueDate !== undefined) issue.dueDate = dueDate ? new Date(dueDate) : null;
    if (labels !== undefined) issue.labels = parseLabelsInput(labels);
    if (bugDetails !== undefined) issue.bugDetails = sanitizeBugDetails(bugDetails);
    if (featureDetails !== undefined) {
      issue.featureDetails = sanitizeFeatureDetails(featureDetails);
    }

    await issue.save();

    const activitiesToCreate: Array<Record<string, unknown>> = [];

    if (status !== undefined && status !== prevStatus) {
      activitiesToCreate.push({
        user: req.user._id,
        project: issue.project,
        issue: issue._id,
        issueKey: issue.issueKey,
        action: 'STATUS_CHANGED',
        description: `moved ${issue.issueKey} from ${prevStatus} to ${status}`,
        metadata: { from: prevStatus, to: status },
      });
    }

    if (priority !== undefined && priority !== prevPriority) {
      activitiesToCreate.push({
        user: req.user._id,
        project: issue.project,
        issue: issue._id,
        issueKey: issue.issueKey,
        action: 'PRIORITY_UPDATED',
        description: `changed ${issue.issueKey} priority from ${prevPriority} to ${priority}`,
        metadata: { from: prevPriority, to: priority },
      });
    }

    const nextAssignee = issue.assignee ? String(issue.assignee) : null;
    if (assignee !== undefined && nextAssignee !== prevAssignee) {
      let assigneeName = 'Unassigned';
      if (nextAssignee) {
        const assigneeUser = await User.findById(nextAssignee).select('name').lean();
        assigneeName = assigneeUser?.name || 'a team member';
      }
      activitiesToCreate.push({
        user: req.user._id,
        project: issue.project,
        issue: issue._id,
        issueKey: issue.issueKey,
        action: 'ISSUE_ASSIGNED',
        description: nextAssignee
          ? `assigned ${issue.issueKey} to ${assigneeName}`
          : `unassigned ${issue.issueKey}`,
      });
    }

    if (
      activitiesToCreate.length === 0 &&
      (title !== undefined ||
        description !== undefined ||
        type !== undefined ||
        dueDate !== undefined ||
        labels !== undefined ||
        bugDetails !== undefined ||
        featureDetails !== undefined)
    ) {
      activitiesToCreate.push({
        user: req.user._id,
        project: issue.project,
        issue: issue._id,
        issueKey: issue.issueKey,
        action: 'ISSUE_UPDATED',
        description: `updated details on ${issue.issueKey}`,
      });
    }

    if (activitiesToCreate.length > 0) {
      await Activity.insertMany(activitiesToCreate);
    }

    const populated = await Issue.findById(issue._id)
      .populate('assignee', 'name email avatar avatarColor role title')
      .populate('reporter', 'name email avatar avatarColor role title')
      .populate('project', 'name key')
      .lean();

    const commentCount = await Comment.countDocuments({ issue: issue._id });
    res.json({ issue: { ...populated, commentCount } });
  } catch (err) {
    next(err);
  }
}

export async function updateIssueStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const id = assertValidObjectId(req.params.id, 'issue');
    const { status, position } = req.body;

    if (!['To Do', 'In Progress', 'Done'].includes(status)) {
      throw new AppError('Invalid status column.', 400);
    }

    const issue = await Issue.findById(id);
    if (!issue) throw new AppError('Issue not found.', 404);

    await requireProjectAccess(req.user._id, issue.project, 'writeIssues');

    const prevStatus = issue.status;
    issue.status = status;
    if (typeof position === 'number') {
      issue.position = position;
    }
    await issue.save();

    if (prevStatus !== status) {
      await Activity.create({
        user: req.user._id,
        project: issue.project,
        issue: issue._id,
        issueKey: issue.issueKey,
        action: 'STATUS_CHANGED',
        description: `moved ${issue.issueKey} from ${prevStatus} to ${status}`,
        metadata: { from: prevStatus, to: status },
      });
    }

    const populated = await Issue.findById(issue._id)
      .populate('assignee', 'name email avatar avatarColor role title')
      .populate('reporter', 'name email avatar avatarColor role title')
      .populate('project', 'name key')
      .lean();

    res.json({ issue: populated });
  } catch (err) {
    next(err);
  }
}

export async function deleteIssue(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const id = assertValidObjectId(req.params.id, 'issue');
    const issue = await Issue.findById(id);
    if (!issue) throw new AppError('Issue not found.', 404);

    const { role } = await requireProjectAccess(req.user._id, issue.project, 'read');
    const isReporter = String(issue.reporter) === String(req.user._id);
    if (!canDeleteIssue(role, isReporter)) {
      throw new AppError(
        'Only project owners, admins, or the issue reporter can delete an issue.',
        403
      );
    }

    await Activity.create({
      user: req.user._id,
      project: issue.project,
      issue: null,
      issueKey: issue.issueKey,
      action: 'ISSUE_DELETED',
      description: `deleted ${issue.issueKey}: ${issue.title}`,
    });

    await Promise.all([
      Comment.deleteMany({ issue: issue._id }),
      Issue.findByIdAndDelete(issue._id),
    ]);

    res.json({ message: `Issue ${issue.issueKey} deleted.` });
  } catch (err) {
    next(err);
  }
}

export async function uploadAttachment(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);
    if (!req.file) throw new AppError('No file provided.', 400);

    const id = assertValidObjectId(req.params.id, 'issue');
    const issue = await Issue.findById(id);
    if (!issue) throw new AppError('Issue not found.', 404);

    await requireProjectAccess(req.user._id, issue.project, 'writeIssues');

    const attachment = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`,
      uploadedBy: req.user._id,
      uploadedAt: new Date(),
    };

    issue.attachments.push(attachment);
    await issue.save();

    await Activity.create({
      user: req.user._id,
      project: issue.project,
      issue: issue._id,
      issueKey: issue.issueKey,
      action: 'ISSUE_UPDATED',
      description: `attached "${req.file.originalname}" to ${issue.issueKey}`,
    });

    const populated = await Issue.findById(issue._id)
      .populate('assignee', 'name email avatar avatarColor role title')
      .populate('reporter', 'name email avatar avatarColor role title')
      .populate('project', 'name key')
      .lean();

    res.status(201).json({ issue: populated });
  } catch (err) {
    next(err);
  }
}

export async function deleteAttachment(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const id = assertValidObjectId(req.params.id, 'issue');
    const { attachmentId } = req.params;
    const issue = await Issue.findById(id);
    if (!issue) throw new AppError('Issue not found.', 404);

    await requireProjectAccess(req.user._id, issue.project, 'writeIssues');

    issue.attachments = issue.attachments.filter(
      (att) => String(att._id) !== attachmentId
    );
    await issue.save();

    const populated = await Issue.findById(issue._id)
      .populate('assignee', 'name email avatar avatarColor role title')
      .populate('reporter', 'name email avatar avatarColor role title')
      .populate('project', 'name key')
      .lean();

    res.json({ issue: populated });
  } catch (err) {
    next(err);
  }
}
