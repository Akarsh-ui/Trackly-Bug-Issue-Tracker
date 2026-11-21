import path from 'path';
import express from 'express';
import { config } from './server/config/env.ts';
import { connectDB } from './server/config/db.ts';
import { createApiApp } from './server/app.ts';

async function startServer(): Promise<void> {
  const hasMongoUri = Boolean(config.mongoUri.trim());

  if (hasMongoUri) {
    await connectDB();
  } else {
    console.log(
      '[Trackly] MONGODB_URI not configured. Serving client with temporary localStorage persistence.'
    );
  }

  const app = createApiApp(hasMongoUri);

  if (config.nodeEnv !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[Trackly] Server running on http://0.0.0.0:${config.port}`);
  });
}

startServer().catch((err) => {
  console.error('[Trackly] Fatal startup error:', err);
  process.exit(1);
});
