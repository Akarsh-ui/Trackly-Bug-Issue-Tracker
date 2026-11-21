import mongoose, { type Document, type Model, type Types } from 'mongoose';

export interface IProject extends Document {
  name: string;
  key: string;
  description: string;
  owner: Types.ObjectId;
  lead: Types.ObjectId;
  members: Types.ObjectId[];
  issueCounter: number;
  status: 'Active' | 'Archived';
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new mongoose.Schema<IProject>(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      minlength: [2, 'Project name must be at least 2 characters'],
      maxlength: [80, 'Project name cannot exceed 80 characters'],
    },
    key: {
      type: String,
      required: [true, 'Project key is required'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9]{2,10}$/, 'Project key must be 2-10 uppercase letters or numbers'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    issueCounter: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Active', 'Archived'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

projectSchema.index({ members: 1 });
projectSchema.index({ owner: 1 });

export const Project: Model<IProject> =
  mongoose.models.Project || mongoose.model<IProject>('Project', projectSchema);
