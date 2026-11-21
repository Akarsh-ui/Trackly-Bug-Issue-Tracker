import mongoose, { type Document, type Model, type Types } from 'mongoose';

export const ISSUE_TYPES = [
  'Bug',
  'Feature Request',
  'Task',
  'Improvement',
  'UI/UX',
  'Performance',
  'Security',
  'Documentation',
  'Research / Spike',
  'Maintenance',
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];
export type IssuePriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type IssueStatus = 'To Do' | 'In Progress' | 'Done';

export interface IAttachment {
  _id?: Types.ObjectId;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
}

export interface IBugDetails {
  stepsToReproduce?: string;
  expectedResult?: string;
  actualResult?: string;
  environment?: string;
}

export interface IFeatureDetails {
  featureDescription?: string;
  reasonForRequest?: string;
  expectedOutcome?: string;
}

export interface IIssue extends Document {
  issueKey: string;
  title: string;
  description: string;
  type: IssueType;
  priority: IssuePriority;
  priorityWeight: number;
  status: IssueStatus;
  position: number;
  assignee: Types.ObjectId | null;
  reporter: Types.ObjectId;
  project: Types.ObjectId;
  dueDate: Date | null;
  labels: string[];
  bugDetails?: IBugDetails;
  featureDetails?: IFeatureDetails;
  attachments: IAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

export const PRIORITY_WEIGHT_MAP: Record<IssuePriority, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Urgent: 4,
};

const attachmentSchema = new mongoose.Schema<IAttachment>(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const issueSchema = new mongoose.Schema<IIssue>(
  {
    issueKey: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Issue title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [10000, 'Description cannot exceed 10000 characters'],
    },
    type: {
      type: String,
      enum: [...ISSUE_TYPES],
      default: 'Task',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
    },
    priorityWeight: {
      type: Number,
      default: 2,
    },
    status: {
      type: String,
      enum: ['To Do', 'In Progress', 'Done'],
      default: 'To Do',
    },
    position: {
      type: Number,
      default: 0,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    labels: {
      type: [String],
      default: [],
    },
    bugDetails: {
      stepsToReproduce: { type: String, default: '' },
      expectedResult: { type: String, default: '' },
      actualResult: { type: String, default: '' },
      environment: { type: String, default: '' },
    },
    featureDetails: {
      featureDescription: { type: String, default: '' },
      reasonForRequest: { type: String, default: '' },
      expectedOutcome: { type: String, default: '' },
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
  },
  { timestamps: true }
);

issueSchema.pre('save', function () {
  this.priorityWeight = PRIORITY_WEIGHT_MAP[this.priority] ?? 2;
});

issueSchema.index({ project: 1, status: 1, position: 1 });
issueSchema.index({ assignee: 1, status: 1 });
issueSchema.index({ priorityWeight: -1, createdAt: -1 });
issueSchema.index({ title: 'text', issueKey: 'text' });

export const Issue: Model<IIssue> =
  mongoose.models.Issue || mongoose.model<IIssue>('Issue', issueSchema);
