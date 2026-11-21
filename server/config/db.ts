import mongoose from 'mongoose';
import { config } from './env.ts';

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  const uri = config.mongoUri.trim();
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not configured. Set MONGODB_URI in your environment to connect MongoDB Atlas.'
    );
  }

  console.log('[Trackly DB] Connecting to MongoDB Atlas...');
  await mongoose.connect(uri);
  console.log('[Trackly DB] Connected to MongoDB Atlas.');
}

export async function closeDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
