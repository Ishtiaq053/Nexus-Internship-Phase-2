import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Meeting, MeetingStatus } from '../models/Meeting';
import { requireAuth } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Check whether a given user already has an ACCEPTED meeting that overlaps
 * [start, end). A meeting overlaps if:
 *   existing.startTime < newEnd  AND  existing.endTime > newStart
 *
 * Excludes a specific meetingId (useful when editing, not needed yet).
 */
async function hasConflict(
  userId: string,
  start: Date,
  end: Date,
  excludeId?: string
): Promise<boolean> {
  const query: any = {
    status: 'accepted',
    startTime: { $lt: end },
    endTime: { $gt: start },
    $or: [{ organizer: userId }, { invitee: userId }],
  };
  if (excludeId) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
  }
  const conflict = await Meeting.findOne(query).lean();
  return !!conflict;
}

/** Populate organizer + invitee (name, email, avatarUrl) and return plain object */
async function populatedMeeting(id: string) {
  return Meeting.findById(id)
    .populate('organizer', 'name email avatarUrl role')
    .populate('invitee', 'name email avatarUrl role')
    .lean();
}

// ─── POST /api/meetings ───────────────────────────────────────────────────────
// Create a new meeting request.

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { inviteeId, title, startTime, endTime, notes } = req.body;
    const organizerId = req.user!.id;

    // ── Basic validation ──────────────────────────────────────────────────
    if (!inviteeId || !title || !startTime || !endTime) {
      res.status(400).json({ message: 'inviteeId, title, startTime, and endTime are required.' });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(inviteeId)) {
      res.status(400).json({ message: 'inviteeId is not a valid user ID.' });
      return;
    }
    if (inviteeId === organizerId) {
      res.status(400).json({ message: 'You cannot schedule a meeting with yourself.' });
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ message: 'startTime and endTime must be valid ISO date strings.' });
      return;
    }
    if (end <= start) {
      res.status(400).json({ message: 'endTime must be after startTime.' });
      return;
    }
    if (start < new Date()) {
      res.status(400).json({ message: 'Cannot schedule a meeting in the past.' });
      return;
    }

    // ── Conflict detection ────────────────────────────────────────────────
    const [organizerConflict, inviteeConflict] = await Promise.all([
      hasConflict(organizerId, start, end),
      hasConflict(inviteeId, start, end),
    ]);

    if (organizerConflict) {
      res.status(409).json({
        message: 'You already have an accepted meeting that overlaps the requested time slot.',
      });
      return;
    }
    if (inviteeConflict) {
      res.status(409).json({
        message: 'The invitee already has an accepted meeting that overlaps the requested time slot.',
      });
      return;
    }

    // ── Create ────────────────────────────────────────────────────────────
    const meeting = await Meeting.create({
      organizer: organizerId,
      invitee: inviteeId,
      title: title.trim(),
      startTime: start,
      endTime: end,
      notes: notes?.trim() || '',
      status: 'pending',
    });

    const populated = await populatedMeeting(meeting._id.toString());
    res.status(201).json({ meeting: populated });
  } catch (err: any) {
    if (err.name === 'ValidationError') {
      const msgs = Object.values(err.errors).map((e: any) => e.message);
      res.status(400).json({ message: msgs.join('. ') });
      return;
    }
    console.error('[POST /api/meetings]', err);
    res.status(500).json({ message: 'Failed to create meeting. Please try again.' });
  }
});

// ─── GET /api/meetings ────────────────────────────────────────────────────────
// List all meetings for the current user (as organizer OR invitee).
// Supports ?status=pending|accepted|rejected|cancelled filter.

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { status } = req.query;

    const query: any = {
      $or: [{ organizer: userId }, { invitee: userId }],
    };

    if (status && ['pending', 'accepted', 'rejected', 'cancelled'].includes(status as string)) {
      query.status = status;
    }

    const meetings = await Meeting.find(query)
      .populate('organizer', 'name email avatarUrl role')
      .populate('invitee', 'name email avatarUrl role')
      .sort({ startTime: 1 })
      .lean();

    res.status(200).json({ meetings });
  } catch (err) {
    console.error('[GET /api/meetings]', err);
    res.status(500).json({ message: 'Failed to fetch meetings.' });
  }
});

// ─── PUT /api/meetings/:id/respond ───────────────────────────────────────────
// Accept or reject a pending meeting. Only the INVITEE may respond.
// When accepting, re-checks for conflicts (in case another meeting was accepted
// in the window between creation and response).

router.put('/:id/respond', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { response } = req.body; // 'accepted' | 'rejected'
    const userId = req.user!.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid meeting ID.' });
      return;
    }
    if (!response || !['accepted', 'rejected'].includes(response)) {
      res.status(400).json({ message: 'response must be "accepted" or "rejected".' });
      return;
    }

    const meeting = await Meeting.findById(id);
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found.' });
      return;
    }
    if (meeting.invitee.toString() !== userId) {
      res.status(403).json({ message: 'Only the invited participant can respond to this meeting.' });
      return;
    }
    if (meeting.status !== 'pending') {
      res.status(409).json({
        message: `This meeting has already been ${meeting.status}. You can only respond to pending meetings.`,
      });
      return;
    }

    // Re-check conflicts on acceptance
    if (response === 'accepted') {
      const [organizerConflict, inviteeConflict] = await Promise.all([
        hasConflict(meeting.organizer.toString(), meeting.startTime, meeting.endTime, id),
        hasConflict(meeting.invitee.toString(), meeting.startTime, meeting.endTime, id),
      ]);

      if (organizerConflict || inviteeConflict) {
        res.status(409).json({
          message: 'A scheduling conflict has been detected. The organizer or invitee now has another accepted meeting at this time.',
        });
        return;
      }
    }

    meeting.status = response as MeetingStatus;
    await meeting.save();

    const populated = await populatedMeeting(id);
    res.status(200).json({ meeting: populated });
  } catch (err) {
    console.error('[PUT /api/meetings/:id/respond]', err);
    res.status(500).json({ message: 'Failed to respond to meeting.' });
  }
});

// ─── DELETE /api/meetings/:id ─────────────────────────────────────────────────
// Cancel a meeting. Only the ORGANIZER can cancel.
// Uses a soft status update ("cancelled") rather than hard deletion so history is preserved.

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid meeting ID.' });
      return;
    }

    const meeting = await Meeting.findById(id);
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found.' });
      return;
    }
    if (meeting.organizer.toString() !== userId) {
      res.status(403).json({ message: 'Only the organizer can cancel this meeting.' });
      return;
    }
    if (meeting.status === 'cancelled') {
      res.status(409).json({ message: 'This meeting is already cancelled.' });
      return;
    }

    meeting.status = 'cancelled';
    await meeting.save();

    res.status(200).json({ message: 'Meeting cancelled successfully.', meetingId: id });
  } catch (err) {
    console.error('[DELETE /api/meetings/:id]', err);
    res.status(500).json({ message: 'Failed to cancel meeting.' });
  }
});

export default router;
