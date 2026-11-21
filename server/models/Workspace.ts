import mongoose, { type Document, type Model } from 'mongoose';

export interface IWorkspace extends Document {
  name: string;
  slug: string;
  description: string;
  defaultIssuePriority: 'Low' | 'Medium' | 'High' | 'Urgent';
  createdAt: Date;
  updatedAt: Date;
}

const workspaceSchema = new mongoose.Schema<IWorkspace>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'Trackly Engineering',
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: 'trackly-eng',
    },
    description: {
      type: String,
      trim: true,
      default: 'Product, platform, and release engineering issue tracking workspace.',
    },
    defaultIssuePriority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
    },
  },
  { timestamps: true }
);

export const Workspace: Model<IWorkspace> =
  mongoose.models.Workspace || mongoose.model<IWorkspace>('Workspace', workspaceSchema);
