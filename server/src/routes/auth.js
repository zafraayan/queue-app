import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) }).strict();
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many attempts. Try again later.' } });
const dummyHash = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO6VwT4Q.wqLU8.KMfwUDnpx2F7kL4V5G';
router.post('/login', loginLimit, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid login input' });
    const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select('+passwordHash');
    const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash || dummyHash);
    if (!user || !user.active || !valid) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.regenerate(async err => {
      if (err) return next(err);
      try {
        req.session.userId = String(user._id);
        req.session.sessionVersion = user.sessionVersion;
        await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });
        req.session.save(saveErr => saveErr ? next(saveErr) : res.json({ user: user.toJSON() }));
      } catch (error) { next(error); }
    });
  } catch (err) { next(err); }
});
router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toJSON() }));
router.post('/logout', (req, res, next) => {
  if (!req.session) return res.status(204).end();
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('qms.sid', { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production', httpOnly: true });
    res.status(204).end();
  });
});
export default router;
