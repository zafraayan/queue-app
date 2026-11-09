import steps from './routes/steps.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { rateLimit } from 'express-rate-limit';
import health from './routes/health.js';
import auth from './routes/auth.js';
import users from './routes/users.js';
import permissions from './routes/permissions.js';
import queue from './routes/queue.js';
import publicDisplay from './routes/publicDisplay.js';
import { requireSameOriginWrite } from './middleware/csrf.js';
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(helmet());
  const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  app.use(cors({ origin, credentials: true }));
  app.use(express.json({ limit: '32kb' }));
  const sessionMiddleware = session({
    name: 'qms.sid', secret: process.env.SESSION_SECRET,
    resave: false, saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI, ttl: 8 * 60 * 60, autoRemove: 'native' }),
    cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 }
  });
  app.use(sessionMiddleware);
  app.set('sessionMiddleware', sessionMiddleware);
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use('/api', requireSameOriginWrite);
  app.use('/api/health', health);
  app.use('/api/auth', auth);
  app.use('/api/users', users);
  app.use('/api/access', permissions);
  app.use('/api/steps', steps);
  app.use('/api/queue', queue);
  app.use('/api/display', publicDisplay);
  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Internal server error' }); });
  return app;
}
