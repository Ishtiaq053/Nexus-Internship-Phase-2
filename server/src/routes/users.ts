import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { requireAuth } from '../middleware/auth';

const router = Router();

// All routes below require a valid JWT ─────────────────────────────────────────

// ─── GET /api/users/me ────────────────────────────────────────────────────────
// Returns the authenticated user's full profile (no passwordHash).

router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }
    res.status(200).json({ user: user.toSafeObject() });
  } catch (err) {
    console.error('[GET /api/users/me]', err);
    res.status(500).json({ message: 'Failed to fetch profile.' });
  }
});

// ─── PUT /api/users/me ────────────────────────────────────────────────────────
// Updates allowed profile fields. Password changes are NOT handled here.

// Fields that can NEVER be updated through this endpoint
const FORBIDDEN_FIELDS = new Set([
  'passwordHash', 'email', 'role', '_id', 'id', '__v', 'createdAt', 'updatedAt',
]);

router.put('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const updates = req.body;

    if (typeof updates !== 'object' || Array.isArray(updates) || !updates) {
      res.status(400).json({ message: 'Request body must be a JSON object.' });
      return;
    }

    // Strip any forbidden keys from the update payload
    const safeUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (!FORBIDDEN_FIELDS.has(key)) {
        safeUpdates[key] = value;
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      res.status(400).json({ message: 'No valid fields provided to update.' });
      return;
    }

    // Validate bio length if provided
    if (safeUpdates.bio && typeof safeUpdates.bio === 'string' && safeUpdates.bio.length > 1000) {
      res.status(400).json({ message: 'Bio cannot exceed 1000 characters.' });
      return;
    }

    const updated = await User.findByIdAndUpdate(
      req.user!.id,
      { $set: safeUpdates },
      { new: true, runValidators: true }
    );

    if (!updated) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    res.status(200).json({ user: updated.toSafeObject() });
  } catch (err: any) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e: any) => e.message);
      res.status(400).json({ message: messages.join('. ') });
      return;
    }
    console.error('[PUT /api/users/me]', err);
    res.status(500).json({ message: 'Failed to update profile.' });
  }
});

export default router;
