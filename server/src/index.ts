import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/business-nexus';

// Middleware: CORS setup to allow Vite dev server and local development
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin) return callback(null, true);
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    const allowedOrigins = [process.env.CLIENT_URL || 'http://localhost:5173'];
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());

// Health Check Route
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Start Server and Connect to MongoDB
const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`[Server]: Running on port ${PORT}`);
      console.log(`[Server]: Health check available at http://localhost:${PORT}/api/health`);
    });

    try {
      await mongoose.connect(MONGODB_URI);
      console.log('[MongoDB]: Connected successfully to MongoDB');
    } catch (dbError) {
      console.error('[MongoDB]: Connection error:', (dbError as Error).message);
      console.log('[MongoDB]: Server is running, but MongoDB connection failed. Please check your MONGODB_URI.');
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
