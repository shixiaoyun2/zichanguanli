import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './src/server/routes/auth.ts';
import assetRoutes from './src/server/routes/assets.ts';
import logRoutes from './src/server/routes/logs.ts';
import excelRoutes from './src/server/routes/excel.ts';
import aiRoutes from './src/server/routes/ai.ts';
import userRoutes from './src/server/routes/users.ts';
import transferRoutes from './src/server/routes/transfers.ts';
import departmentRoutes from './src/server/routes/departments.ts';

dotenv.config();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ limit: '20mb', extended: true }));
  
  // Serve uploads
  app.use('/uploads', express.static(uploadsDir));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/assets', assetRoutes);
  app.use('/api/logs', logRoutes);
  app.use('/api/excel', excelRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/transfers', transferRoutes);
  app.use('/api/departments', departmentRoutes);

  // TODO: Add Auth, Assets, Log routes here in subsequent tasks

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
