import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { connectDB } from '../config/db.js';
const [,,name,email,password] = process.argv;
if (!name || !email || !password || password.length < 12 || password.length > 128) {
  console.error('Usage: npm run seed:admin -- "Admin Name" admin@example.com "StrongPasswordAtLeast12"');
  process.exit(1);
}
if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is required'); process.exit(1); }
try {
  await connectDB(process.env.MONGODB_URI);
  if (await User.exists({ role: 'admin' })) throw new Error('An administrator already exists; bootstrap is disabled.');
  await User.create({ name, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12), role: 'admin' });
  console.log('Initial administrator created.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
