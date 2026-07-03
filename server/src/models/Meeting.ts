import mongoose, { Document, Schema, Types } from 'mongoose';

// ─── Status enum ─────────────────────────────────────────────────────────────

export type MeetingStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

// ─── Document interface ───────────────────────────────────────────────────────
// Structured so that recurrence fields (rrule, recurrenceId, etc.) can be
// added to the schema later without touching routes or business logic.

export interface IMeeting extends Document {
  organizer: Types.ObjectId;
  invitee: Types.ObjectId;
  title: string;
  startTime: Date;
  endTime: Date;
  status: MeetingStatus;
  notes: string;
  // Extension point for recurring meetings (not implemented yet)
  // rrule?: string;
  // recurrenceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const MeetingSchema = new Schema<IMeeting>(
  {
    organizer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Organizer is required'],
      index: true,
    },
    invitee: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Invitee is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Meeting title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'rejected', 'cancelled'],
        message: 'Status must be pending, accepted, rejected, or cancelled',
      },
      default: 'pending',
    },
    notes: {
      type: String,
      default: '',
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

// ─── Compound index for conflict detection queries ────────────────────────────
// Queries like "find accepted meetings where (organizer=X or invitee=X)
// and startTime < endTime AND endTime > startTime" benefit from this.
MeetingSchema.index({ status: 1, startTime: 1, endTime: 1 });
MeetingSchema.index({ organizer: 1, status: 1, startTime: 1 });
MeetingSchema.index({ invitee: 1, status: 1, startTime: 1 });

// ─── Model validation ─────────────────────────────────────────────────────────
MeetingSchema.pre('validate', function (next) {
  if (this.startTime && this.endTime && this.endTime <= this.startTime) {
    this.invalidate('endTime', 'End time must be after start time');
  }
  if (this.startTime && this.startTime < new Date()) {
    // Only block creation of meetings in the past, not updates
    if (this.isNew) {
      this.invalidate('startTime', 'Cannot schedule a meeting in the past');
    }
  }
  next();
});

export const Meeting = mongoose.model<IMeeting>('Meeting', MeetingSchema);
