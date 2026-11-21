import type { Response, NextFunction } from 'express';
import { Comment } from '../models/Comment.ts';
import { Issue } from '../models/Issue.ts';
import { Activity } from '../models/Activity.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';
import {
  assertValidObjectId,
  canManageProject,
  requireProjectAccess,
} from '../utils/projectAuth.ts';

export async function getCommentsByIssue(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const issueId = assertValidObjectId(req.params.issueId, 'issue');
    const issue = await Issue.findById(issueId).select('_id project').lean();
    if (!issue) throw new AppError('Issue not found.', 404);

    await requireProjectAccess(req.user._id, issue.project, 'read');

    const comments = await Comment.find({ issue: issue._id })
      .populate('user', 'name email avatar avatarColor role title')
      .sort({ createdAt: 1 })
      .lean();

    res.json({ comments });
  } catch (err) {
    next(err);
  }
}

export async function createComment(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const issueId = assertValidObjectId(req.params.issueId, 'issue');
    const { text } = req.body;

    if (!text || !String(text).trim()) {
      throw new AppError('Comment text cannot be empty.', 400);
    }

    const issue = await Issue.findById(issueId);
    if (!issue) throw new AppError('Issue not found.', 404);

    await requireProjectAccess(req.user._id, issue.project, 'comment');

    const comment = await Comment.create({
      issue: issue._id,
      user: req.user._id,
      text: String(text).trim(),
    });

    await Activity.create({
      user: req.user._id,
      project: issue.project,
      issue: issue._id,
      issueKey: issue.issueKey,
      action: 'COMMENT_ADDED',
      description: `commented on ${issue.issueKey}`,
    });

    const populated = await Comment.findById(comment._id)
      .populate('user', 'name email avatar avatarColor role title')
      .lean();

    res.status(201).json({ comment: populated });
  } catch (err) {
    next(err);
  }
}

export async function updateComment(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);
    const commentId = assertValidObjectId(req.params.commentId, 'comment');
    const { text } = req.body;

    if (!text || !String(text).trim()) {
      throw new AppError('Comment text cannot be empty.', 400);
    }

    const comment = await Comment.findById(commentId);
    if (!comment) throw new AppError('Comment not found.', 404);

    const issue = await Issue.findById(comment.issue).select('project').lean();
    if (!issue) throw new AppError('Parent issue not found.', 404);

    await requireProjectAccess(req.user._id, issue.project, 'comment');

    if (String(comment.user) !== String(req.user._id)) {
      throw new AppError('You can only edit your own comments.', 403);
    }

    comment.text = String(text).trim();
    await comment.save();

    const populated = await Comment.findById(comment._id)
      .populate('user', 'name email avatar avatarColor role title')
      .lean();

    res.json({ comment: populated });
  } catch (err) {
    next(err);
  }
}

export async function deleteComment(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);
    const commentId = assertValidObjectId(req.params.commentId, 'comment');

    const comment = await Comment.findById(commentId);
    if (!comment) throw new AppError('Comment not found.', 404);

    const issue = await Issue.findById(comment.issue).select('project').lean();
    if (!issue) throw new AppError('Parent issue not found.', 404);

    const { role } = await requireProjectAccess(req.user._id, issue.project, 'comment');

    if (
      String(comment.user) !== String(req.user._id) &&
      !canManageProject(role)
    ) {
      throw new AppError('You can only delete your own comments.', 403);
    }

    await Comment.findByIdAndDelete(commentId);
    res.json({ message: 'Comment deleted.' });
  } catch (err) {
    next(err);
  }
}
