import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret:
    process.env.JWT_SECRET ||
    'trackly-local-dev-jwt-secret-please-set-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  frontendUrl: String(process.env.FRONTEND_URL || '')
    .trim()
    .replace(/\/+$/, ''),
};

