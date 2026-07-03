import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'investor' | 'entrepreneur';

// ─── Role-specific sub-schemas ──────────────────────────────────────────────

const InvestmentHistorySchema = new Schema({
  companyName: { type: String, required: true },
  amount: { type: String },
  stage: { type: String },
  year: { type: Number },
  status: { type: String, enum: ['active', 'exited', 'written-off'], default: 'active' },
}, { _id: false });

const StartupHistorySchema = new Schema({
  startupName: { type: String, required: true },
  role: { type: String },
  fundingRaised: { type: String },
  year: { type: Number },
  status: { type: String, enum: ['active', 'acquired', 'closed'], default: 'active' },
}, { _id: false });

// ─── Main User Document interface ───────────────────────────────────────────

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  avatarUrl: string;
  bio: string;
  isOnline: boolean;
  // Investor-specific
  investmentInterests?: string[];
  investmentStage?: string[];
  portfolioCompanies?: string[];
  totalInvestments?: number;
  minimumInvestment?: string;
  maximumInvestment?: string;
  investmentHistory?: Array<{
    companyName: string;
    amount?: string;
    stage?: string;
    year?: number;
    status?: string;
  }>;
  // Entrepreneur-specific
  startupName?: string;
  pitchSummary?: string;
  fundingNeeded?: string;
  industry?: string;
  location?: string;
  foundedYear?: number;
  teamSize?: number;
  startupHistory?: Array<{
    startupName: string;
    role?: string;
    fundingRaised?: string;
    year?: number;
    status?: string;
  }>;
  createdAt: Date;
  // Methods
  comparePassword(candidate: string): Promise<boolean>;
  toSafeObject(): object;
}

// ─── Schema ─────────────────────────────────────────────────────────────────

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
    },
    role: {
      type: String,
      enum: { values: ['investor', 'entrepreneur'], message: 'Role must be investor or entrepreneur' },
      required: [true, 'Role is required'],
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      default: '',
      maxlength: [1000, 'Bio cannot exceed 1000 characters'],
    },
    isOnline: { type: Boolean, default: false },

    // ── Investor fields ──
    investmentInterests: [String],
    investmentStage: [String],
    portfolioCompanies: [String],
    totalInvestments: { type: Number, default: 0 },
    minimumInvestment: { type: String },
    maximumInvestment: { type: String },
    investmentHistory: [InvestmentHistorySchema],

    // ── Entrepreneur fields ──
    startupName: { type: String },
    pitchSummary: { type: String },
    fundingNeeded: { type: String },
    industry: { type: String },
    location: { type: String },
    foundedYear: { type: Number },
    teamSize: { type: Number },
    startupHistory: [StartupHistorySchema],
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// ─── Pre-save hook: hash password ────────────────────────────────────────────

UserSchema.pre('save', async function (next) {
  // Only hash if passwordHash field was changed (i.e. it's a plain-text password)
  if (!this.isModified('passwordHash')) return next();
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// ─── Instance methods ────────────────────────────────────────────────────────

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

/** Returns a plain object with passwordHash stripped out. */
UserSchema.methods.toSafeObject = function (): object {
  const obj = this.toObject({ virtuals: true });
  delete obj.passwordHash;
  delete obj.__v;
  // map _id to id for consistency with frontend
  obj.id = obj._id.toString();
  delete obj._id;
  return obj;
};

export const User = mongoose.model<IUser>('User', UserSchema);
