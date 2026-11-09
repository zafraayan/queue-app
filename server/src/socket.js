import { Server } from 'socket.io';
import { User } from './models/User.js';

export function attachSockets(server, app) {
  const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const io = new Server(server, { cors: { origin, credentials: true }, transports: ['websocket','polling'] });
  const sessionMiddleware = app.get('sessionMiddleware');
  io.engine.use(sessionMiddleware);
  io.use(async (socket,next) => {
    try {
      const requestOrigin = socket.handshake.headers.origin;
      if (requestOrigin !== origin) return next(new Error('Origin not allowed'));
      const isPublic = socket.handshake.auth?.mode === 'public';
      if (isPublic) { socket.data.publicOnly = true; return next(); }
      const sess = socket.request.session;
      if (!sess?.userId) return next(new Error('Authentication required'));
      const user = await User.findById(sess.userId).lean();
      if (!user?.active || user.sessionVersion !== sess.sessionVersion) return next(new Error('Session expired'));
      socket.data.userId = String(user._id);
      socket.data.sessionVersion = user.sessionVersion;
      socket.data.role = user.role;
      socket.data.assignedSteps = user.assignedSteps;
      next();
    } catch(err) { next(err); }
  });
  io.on('connection', socket => {
    if (socket.data.publicOnly) { socket.join('display'); return; }
    socket.join('staff');
    if (socket.data.role === 'staff') socket.data.assignedSteps.forEach(step=>socket.join(`step:${step}`));
    // Periodically revalidate session/account status; permissions may change after connection.
    const timer = setInterval(async () => {
      try {
        const u = await User.findById(socket.data.userId).lean();
        if (!u?.active || u.sessionVersion !== socket.data.sessionVersion || u.role !== socket.data.role ||
          JSON.stringify([...u.assignedSteps].sort()) !== JSON.stringify([...socket.data.assignedSteps].sort())) socket.disconnect(true);
      } catch { socket.disconnect(true); }
    }, 30_000);
    socket.on('disconnect', () => clearInterval(timer));
  });
  app.set('io', io);
  return io;
}
