import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, UserRole } from '../models/User';

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_dev_secret_do_not_use_in_production';

// ─── requireAuth ─────────────────────────────────────────────────────────────
// Verifies the Bearer JWT from the Authorization header.
// On success, attaches `req.user` with { id, email, role }.
// Returns 401 on missing/invalid/expired token.

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentication required. Provide a Bearer token.' });
      return;
    }

    const token = authHeader.slice(7); // strip "Bearer "

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err: any) {
      const message = err.name === 'TokenExpiredError'
        ? 'Session expired. Please log in again.'
        : 'Invalid token. Please log in again.';
      res.status(401).json({ message });
      return;
    }

    // Lightweight DB check: ensure user still exists (handles deleted accounts)
    const user = await User.findById(decoded.id).select('_id email role');
    if (!user) {
      res.status(401).json({ message: 'User no longer exists. Please register or contact support.' });
      return;
    }

    req.user = { id: user._id.toString(), email: user.email, role: user.role };
    next();
  } catch (err) {
    res.status(500).json({ message: 'Internal server error during authentication.' });
  }
};

// ─── requireRole ─────────────────────────────────────────────────────────────
// Factory middleware. Call as requireRole('investor') or requireRole('entrepreneur').
// Must be placed AFTER requireAuth in the middleware chain.

export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        message: `Access denied. This route requires role: ${roles.join(' or ')}.`,
      });
      return;
    }
    next();
  };
};

// ─── signToken helper ─────────────────────────────────────────────────────────
export const signToken = (id: string, email: string, role: UserRole): string => {
  return jwt.sign(
    { id, email, role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );
};
