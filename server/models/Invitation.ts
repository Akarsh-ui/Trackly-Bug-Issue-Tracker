import mongoose, { type Document, type Model, type Types } from 'mongoose';
import type { UserRole } from './User.ts';

export type InvitationStatus =
  | 'Pending'
  | 'Accepted'
  | 'Rejected'
  | 'Expired'
  | 'Revoked';

export interface IInvitation extends Document {
  email: string;
  role: UserRole;
  project: Types.ObjectId | null;
  workspaceName: string;
  message: string;
  tokenHash: string;
  status: InvitationStatus;
  invitedBy: Types.ObjectId;
  expiresAt: Date;
  acceptedBy: Types.ObjectId | null;
  acceptedAt: Date | null;
  rejectedBy: Types.ObjectId | null;
  rejectedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const invitationSchema = new mongoose.Schema<IInvitation>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: [
        'Admin',
        'Engineering Lead',
        'Developer',
        'Designer',
        'QA Engineer',
        'Member',
        'Viewer',
      ],
      default: 'Member',
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    workspaceName: {
      type: String,
      trim: true,
      default: 'Trackly Engineering',
    },
    message: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Accepted', 'Rejected', 'Expired', 'Revoked'],
      default: 'Pending',
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

invitationSchema.index({ email: 1, status: 1 });
invitationSchema.index({ email: 1, project: 1, status: 1 });
invitationSchema.index({ project: 1, status: 1 });
invitationSchema.index({ createdAt: -1 });

export const Invitation: Model<IInvitation> =
  mongoose.models.Invitation ||
  mongoose.model<IInvitation>('Invitation', invitationSchema);
