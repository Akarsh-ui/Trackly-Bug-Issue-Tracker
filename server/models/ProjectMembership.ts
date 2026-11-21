import mongoose, { type Document, type Model, type Types } from 'mongoose';

export type ProjectRole = 'Owner' | 'Admin' | 'Member' | 'Viewer';
export type MembershipStatus = 'Active' | 'Removed';

export interface IProjectMembership extends Document {
  project: Types.ObjectId;
  user: Types.ObjectId;
  role: ProjectRole;
  membershipStatus: MembershipStatus;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const projectMembershipSchema = new mongoose.Schema<IProjectMembership>(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['Owner', 'Admin', 'Member', 'Viewer'],
      default: 'Member',
      required: true,
    },
    membershipStatus: {
      type: String,
      enum: ['Active', 'Removed'],
      default: 'Active',
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

projectMembershipSchema.index({ project: 1, user: 1 }, { unique: true });
projectMembershipSchema.index({ user: 1, membershipStatus: 1 });
projectMembershipSchema.index({ project: 1, membershipStatus: 1 });

export const ProjectMembership: Model<IProjectMembership> =
  mongoose.models.ProjectMembership ||
  mongoose.model<IProjectMembership>('ProjectMembership', projectMembershipSchema);
