import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env.ts';
import { errorHandler } from './middleware/errorHandler.ts';
import authRoutes from './routes/authRoutes.ts';
import userRoutes from './routes/userRoutes.ts';
import projectRoutes from './routes/projectRoutes.ts';
import issueRoutes from './routes/issueRoutes.ts';
import commentRoutes from './routes/commentRoutes.ts';
import activityRoutes from './routes/activityRoutes.ts';
import dashboardRoutes from './routes/dashboardRoutes.ts';
import workspaceRoutes from './routes/workspaceRoutes.ts';
import invitationRoutes from './routes/invitationRoutes.ts';
import localInviteBridge from './routes/localInviteBridge.ts';

export function createApiApp(hasMongoUri: boolean): express.Express {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false,
    })
  );
  app.use(
    cors({
      origin: config.frontendUrl
        ? [config.frontendUrl, 'http://localhost:3000', 'http://127.0.0.1:3000']
        : true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'trackly-api',
      databaseConfigured: hasMongoUri,
    });
  });

  if (hasMongoUri) {
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/projects', projectRoutes);
    app.use('/api/issues', issueRoutes);
    app.use('/api/comments', commentRoutes);
    app.use('/api/activities', activityRoutes);
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/workspace', workspaceRoutes);
    app.use('/api/invitations', invitationRoutes);
  } else {
    app.use('/api/local-invites', localInviteBridge);
    app.use('/api', (_req, res) => {
      res.status(503).json({
        message: 'MongoDB Atlas is not connected yet. Set MONGODB_URI to enable API routes.',
      });
    });
  }

  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'API endpoint not found.' });
  });

  app.use(errorHandler);

  return app;
}
