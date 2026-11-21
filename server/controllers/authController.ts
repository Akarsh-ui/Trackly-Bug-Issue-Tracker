import type { Response, NextFunction } from 'express';
import { User, type IUser } from '../models/User.ts';
import { Invitation } from '../models/Invitation.ts';
import { signToken, type AuthRequest } from '../middleware/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { hashInvitationToken, normalizeRawToken } from './invitationController.ts';
import {
  normalizeEmail,
  normalizeFullName,
  validateEmail,
  validateFullName,
  validatePassword,
} from '../utils/validation.ts';

function sanitizeUser(user: IUser) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    avatar: user.avatar,
    avatarColor: user.avatarColor,
    status: user.status,
    notificationPrefs: user.notificationPrefs,
    appearancePrefs: user.appearancePrefs,
    createdAt: user.createdAt,
  };
}

export async function register(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, email, password, confirmPassword, inviteToken } = req.body;

    const nameError = validateFullName(name);
    if (nameError) {
      throw new AppError(nameError, 400);
    }

    const emailError = validateEmail(email);
    if (emailError) {
      throw new AppError(emailError, 400);
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      throw new AppError(passwordError, 400);
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      throw new AppError('Passwords do not match.', 400);
    }

    const normalizedName = normalizeFullName(name);
    const normalizedEmail = normalizeEmail(email);

    let activeInvitation = null;
    if (inviteToken) {
      const tokenHash = hashInvitationToken(normalizeRawToken(inviteToken));
      activeInvitation = await Invitation.findOne({ tokenHash });
      if (!activeInvitation) {
        throw new AppError('Invalid invitation link.', 404);
      }
      if (activeInvitation.status === 'Revoked') {
        throw new AppError('This invitation has been revoked.', 410);
      }
      if (activeInvitation.status === 'Accepted') {
        throw new AppError('This invitation has already been accepted.', 409);
      }
      if (activeInvitation.status === 'Rejected') {
        throw new AppError('This invitation has been declined.', 409);
      }
      if (
        activeInvitation.status === 'Expired' ||
        activeInvitation.expiresAt <= new Date()
      ) {
        if (activeInvitation.status !== 'Expired') {
          activeInvitation.status = 'Expired';
          await activeInvitation.save();
        }
        throw new AppError('This invitation link has expired.', 410);
      }
      if (activeInvitation.email.toLowerCase() !== normalizedEmail) {
        throw new AppError(
          `This invitation was issued for ${activeInvitation.email}. Please register with that email address.`,
          403
        );
      }
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw new AppError('An account with that email already exists.', 409);
    }

    // Independent accounts never automatically gain access to other users' projects
    // or workspace-wide admin privileges over unrelated accounts.
    const assignedRole = 'Member';

    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password: String(password),
      role: assignedRole,
      title: 'Software Engineer',
      status: 'Active',
    });

    // IMPORTANT: Even when registering via an invitation link, do NOT auto-accept
    // the invitation or add ProjectMembership here. The invitation remains Pending
    // until the authenticated user explicitly accepts or rejects it.

    const token = signToken(String(user._id));
    res.status(201).json({
      token,
      user: sanitizeUser(user),
      pendingInvitationId: activeInvitation ? String(activeInvitation._id) : null,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body;

    const emailError = validateEmail(email);
    if (emailError) {
      throw new AppError(emailError, 400);
    }
    if (!password) {
      throw new AppError('Password is required.', 400);
    }

    const user = await User.findOne({ email: normalizeEmail(email) }).select(
      '+password'
    );
    if (!user) {
      throw new AppError('Invalid email or password.', 401);
    }

    const isMatch = await user.comparePassword(String(password));
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401);
    }

    if (user.status === 'Inactive') {
      throw new AppError('This account is inactive. Contact a workspace admin.', 403);
    }

    if (user.status === 'Invited') {
      user.status = 'Active';
      await user.save();
    }

    const token = signToken(String(user._id));
    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated.', 401);
    }
    res.json({ user: sanitizeUser(req.user) });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Not authenticated.', 401);
    const { name, title, avatar, avatarColor, notificationPrefs, appearancePrefs } =
      req.body;

    const user = await User.findById(req.user._id);
    if (!user) throw new AppError('User not found.', 404);

    if (name !== undefined) {
      const nameError = validateFullName(name);
      if (nameError) {
        throw new AppError(nameError, 400);
      }
      user.name = normalizeFullName(name);
    }
    if (title !== undefined) user.title = String(title).trim().slice(0, 80);
    if (avatar !== undefined) user.avatar = String(avatar).trim();
    if (avatarColor !== undefined && /^#[0-9A-Fa-f]{6}$/.test(String(avatarColor))) {
      user.avatarColor = String(avatarColor);
    }
    if (notificationPrefs) {
      user.notificationPrefs = {
        ...user.notificationPrefs,
        ...notificationPrefs,
      };
    }
    if (appearancePrefs) {
      user.appearancePrefs = {
        ...user.appearancePrefs,
        ...appearancePrefs,
      };
    }

    await user.save();
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Not authenticated.', 401);
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('Current password and new password are required.', 400);
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      throw new AppError(passwordError, 400);
    }
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      throw new AppError('New passwords do not match.', 400);
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) throw new AppError('User not found.', 404);

    const valid = await user.comparePassword(String(currentPassword));
    if (!valid) {
      throw new AppError('Current password is incorrect.', 401);
    }

    user.password = String(newPassword);
    await user.save();

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
}
