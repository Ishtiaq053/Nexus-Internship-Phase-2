import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { signToken } from '../middleware/auth';

const router = Router();

// ─── Validation helpers ───────────────────────────────────────────────────────

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

function validateRegisterInput(body: any): string | null {
  const { name, email, password, role } = body;
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return 'Name must be at least 2 characters.';
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    return 'A valid email address is required.';
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!role || !['investor', 'entrepreneur'].includes(role)) {
    return 'Role must be "investor" or "entrepreneur".';
  }
  return null;
}

function validateLoginInput(body: any): string | null {
  const { email, password } = body;
  if (!email || !EMAIL_REGEX.test(email)) return 'A valid email address is required.';
  if (!password || typeof password !== 'string') return 'Password is required.';
  return null;
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const validationError = validateRegisterInput(req.body);
    if (validationError) {
      res.status(400).json({ message: validationError });
      return;
    }

    const { name, email, password, role } = req.body;

    // Duplicate email check
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ message: 'An account with this email already exists.' });
      return;
    }

    // avatarUrl fallback using UI Avatars
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=200`;

    // passwordHash will be hashed by the pre-save hook
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      passwordHash: password,
      role,
      avatarUrl,
    });

    const token = signToken(user._id.toString(), user.email, user.role);

    res.status(201).json({
      token,
      user: user.toSafeObject(),
    });
  } catch (err: any) {
    // Mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e: any) => e.message);
      res.status(400).json({ message: messages.join('. ') });
      return;
    }
    console.error('[POST /api/auth/register]', err);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const validationError = validateLoginInput(req.body);
    if (validationError) {
      res.status(400).json({ message: validationError });
      return;
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Return same message for security (don't reveal whether email exists)
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const token = signToken(user._id.toString(), user.email, user.role);

    res.status(200).json({
      token,
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error('[POST /api/auth/login]', err);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

export default router;
