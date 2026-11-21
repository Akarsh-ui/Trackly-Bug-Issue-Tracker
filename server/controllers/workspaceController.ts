import type { Response, NextFunction } from 'express';
import { Workspace } from '../models/Workspace.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';

export async function getWorkspace(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let workspace = await Workspace.findOne();
    if (!workspace) {
      workspace = await Workspace.create({
        name: 'Trackly Engineering',
        slug: 'trackly-eng',
        description: 'Product, platform, and release engineering issue tracking workspace.',
      });
    }
    res.json({ workspace });
  } catch (err) {
    next(err);
  }
}

export async function updateWorkspace(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);
    if (req.user.role !== 'Admin') {
      throw new AppError('Only workspace administrators can update workspace settings.', 403);
    }

    const { name, slug, description, defaultIssuePriority } = req.body;
    if (name !== undefined && !String(name).trim()) {
      throw new AppError('Workspace name is required.', 400);
    }
    if (slug !== undefined) {
      const normalizedSlug = String(slug).trim().toLowerCase();
      if (!/^[a-z0-9-]{2,40}$/.test(normalizedSlug)) {
        throw new AppError(
          'Workspace slug must be 2–40 lowercase letters, numbers, or hyphens.',
          400
        );
      }
    }

    let workspace = await Workspace.findOne();
    if (!workspace) {
      workspace = await Workspace.create({
        name: String(name || 'Trackly Engineering').trim(),
        slug: String(slug || 'trackly-eng').trim().toLowerCase(),
        description: description ? String(description).trim() : '',
        defaultIssuePriority: defaultIssuePriority || 'Medium',
      });
    } else {
      if (name !== undefined) workspace.name = String(name).trim();
      if (slug !== undefined) workspace.slug = String(slug).trim().toLowerCase();
      if (description !== undefined) workspace.description = String(description).trim();
      if (defaultIssuePriority !== undefined)
        workspace.defaultIssuePriority = defaultIssuePriority;
      await workspace.save();
    }
    res.json({ workspace });
  } catch (err) {
    next(err);
  }
}
