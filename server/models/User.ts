import mongoose, { type Document, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole =
  | 'Owner'
  | 'Admin'
  | 'Engineering Lead'
  | 'Developer'
  | 'Designer'
  | 'QA Engineer'
  | 'Member'
  | 'Viewer';

export type UserStatus = 'Active' | 'Invited' | 'Inactive';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  title: string;
  avatar: string;
  avatarColor: string;
  status: UserStatus;
  notificationPrefs: {
    issueAssigned: boolean;
    statusChanged: boolean;
    comments: boolean;
    weeklyDigest: boolean;
  };
  appearancePrefs: {
    theme: 'light' | 'dark';
    density: 'compact' | 'comfortable';
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const AVATAR_PALETTE = [
  '#C56A45',
  '#557A59',
  '#75553C',
  '#C47D2B',
  '#605E59',
  '#944523',
];

const userSchema = new mongoose.Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: [
        'Owner',
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
    title: {
      type: String,
      trim: true,
      default: 'Software Engineer',
    },
    avatar: {
      type: String,
      default: '',
    },
    avatarColor: {
      type: String,
      default: () => AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)],
    },
    status: {
      type: String,
      enum: ['Active', 'Invited', 'Inactive'],
      default: 'Active',
    },
    notificationPrefs: {
      issueAssigned: { type: Boolean, default: true },
      statusChanged: { type: Boolean, default: true },
      comments: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: false },
    },
    appearancePrefs: {
      theme: { type: String, enum: ['light', 'dark'], default: 'light' },
      density: { type: String, enum: ['compact', 'comfortable'], default: 'compact' },
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', userSchema);
