import mongoose, { type Document, type Model, type Types } from 'mongoose';

export type ActivityAction =
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'ISSUE_CREATED'
  | 'ISSUE_ASSIGNED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_UPDATED'
  | 'COMMENT_ADDED'
  | 'ISSUE_UPDATED'
  | 'ISSUE_DELETED'
  | 'MEMBER_INVITED'
  | 'MEMBER_ROLE_UPDATED'
  | 'MEMBER_REMOVED'
  | 'INVITATION_CREATED'
  | 'INVITATION_ACCEPTED'
  | 'INVITATION_REJECTED'
  | 'INVITATION_REVOKED';

export interface IActivity extends Document {
  user: Types.ObjectId;
  project: Types.ObjectId | null;
  issue: Types.ObjectId | null;
  issueKey: string | null;
  action: ActivityAction;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const activitySchema = new mongoose.Schema<IActivity>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true,
    },
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      default: null,
      index: true,
    },
    issueKey: {
      type: String,
      default: null,
    },
    action: {
      type: String,
      enum: [
        'PROJECT_CREATED',
        'PROJECT_UPDATED',
        'ISSUE_CREATED',
        'ISSUE_ASSIGNED',
        'STATUS_CHANGED',
        'PRIORITY_UPDATED',
        'COMMENT_ADDED',
        'ISSUE_UPDATED',
        'ISSUE_DELETED',
        'MEMBER_INVITED',
        'MEMBER_ROLE_UPDATED',
        'MEMBER_REMOVED',
        'INVITATION_CREATED',
        'INVITATION_ACCEPTED',
        'INVITATION_REJECTED',
        'INVITATION_REVOKED',
      ],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activitySchema.index({ createdAt: -1 });
activitySchema.index({ project: 1, createdAt: -1 });

export const Activity: Model<IActivity> =
  mongoose.models.Activity || mongoose.model<IActivity>('Activity', activitySchema);
