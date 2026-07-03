import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables from .env file FIRST
dotenv.config();

import authRoutes from './routes/auth';
import userRoutes from './routes/users';

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/business-nexus';

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    const allowedOrigins = [process.env.CLIENT_URL || 'http://localhost:5173'];
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// ─── Global 404 handler ───────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found.' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`[Server]: Running on port ${PORT}`);
      console.log(`[Server]: Health check → http://localhost:${PORT}/api/health`);
    });

    try {
      await mongoose.connect(MONGODB_URI);
      console.log('[MongoDB]: Connected successfully');
    } catch (dbError) {
      console.error('[MongoDB]: Connection failed —', (dbError as Error).message);
      console.log('[MongoDB]: Server running without DB. Fix MONGODB_URI in .env to enable persistence.');
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
