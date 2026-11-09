import 'dotenv/config';
import http from 'node:http';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { attachSockets } from './socket.js';
const port = Number(process.env.PORT || 5000);
if (!process.env.MONGODB_URI || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error('MONGODB_URI and SESSION_SECRET (at least 32 characters) are required'); process.exit(1);
}
try {
  await connectDB(process.env.MONGODB_URI);
  const app = createApp();
  const server = http.createServer(app);
  attachSockets(server, app);
  server.listen(port, () => console.log(`API running on http://localhost:${port}`));
} catch (error) { console.error('Startup failed:', error.message); process.exit(1); }
