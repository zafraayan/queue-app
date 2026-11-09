import { getSteps } from '../models/StepConfig.js';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.js';
import { QueueTransaction } from '../models/QueueTransaction.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
const router = Router();
router.use(requireAuth, allowRoles('admin'));
const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  role: z.enum(['admin','receptionist','staff','supervisor']),
  assignedSteps: z.array(z.number().int().min(1)).default([])
}).strict().refine(v => new Set(v.assignedSteps).size === v.assignedSteps.length, 'Duplicate steps').refine(v => v.role === 'staff' ? v.assignedSteps.length > 0 : v.assignedSteps.length === 0, 'Step assignments must be for staff only');
router.get('/', async (_req, res, next) => { try { res.json({ users: await User.find().sort({ createdAt: -1 }) }); } catch (err) { next(err); } });
router.post('/', async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid user data', details: parsed.error.flatten() });
    const configuredSteps = await getSteps();
    if (parsed.data.assignedSteps.some(n => !configuredSteps.includes(n))) return res.status(400).json({ error: 'Invalid step assignments' });
    const { password, ...data } = parsed.data;
    const user = await User.create({ ...data, email: data.email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12) });
    res.status(201).json({ user });
  } catch (err) { if (err.code === 11000) return res.status(409).json({ error: 'Email already exists' }); next(err); }
});
const idSchema = z.string().regex(/^[a-f0-9]{24}$/i);
router.patch('/:id', async (req, res, next) => {
  try {
    if (!idSchema.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid user ID' });
    const updateSchema = z.object({ name: z.string().trim().min(2).max(100).optional(), email: z.string().trim().email().max(254).optional(), active: z.boolean().optional(), role: z.enum(['admin','receptionist','staff','supervisor']).optional(), assignedSteps: z.array(z.number().int().min(1)).optional() }).strict();
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success || !Object.keys(parsed.data).length) return res.status(400).json({ error: 'Invalid update' });
    if (String(req.user._id) === req.params.id) return res.status(400).json({ error: 'Cannot modify own account here' });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'admin' && target.active && (parsed.data.active === false || (parsed.data.role && parsed.data.role !== 'admin'))) {
      const remaining = await User.countDocuments({ role: 'admin', active: true });
      if (remaining <= 1) return res.status(409).json({ error: 'Cannot remove the last active administrator' });
    }
    const role = parsed.data.role ?? target.role;
    const steps = parsed.data.assignedSteps ?? target.assignedSteps;
    if (new Set(steps).size !== steps.length || (role !== 'staff' && steps.length !== 0)) return res.status(400).json({ error: 'Invalid role and step assignments' });
    const configuredSteps = await getSteps();
    if (steps.some(n => !configuredSteps.includes(n))) return res.status(400).json({ error: 'Invalid step assignments' });
    if (parsed.data.active === false || role !== target.role || target.assignedSteps.some(step => !steps.includes(step))) {
      if (await QueueTransaction.exists({ status: 'ACTIVE', steps: { $elemMatch: { assignedTo: target._id, status: { $in: ['CALLED', 'PROCESSING'] } } } })) return res.status(409).json({ error: 'Complete this account’s active clients before changing its access.' });
    }
    Object.assign(target, parsed.data);
    target.sessionVersion += 1; // revoke existing sessions on any privilege/status change
    await target.save();
    res.json({ user: target });
  } catch (err) { if (err.code === 11000) return res.status(409).json({ error: 'Email already exists' }); next(err); }
});
router.delete('/:id', async (req, res, next) => {
  try {
    if (!idSchema.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid user ID' });
    if (String(req.user._id) === req.params.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'admin' && target.active && await User.countDocuments({ role: 'admin', active: true }) <= 1) return res.status(409).json({ error: 'Cannot delete the last active administrator' });
    if (await QueueTransaction.exists({ status: 'ACTIVE', steps: { $elemMatch: { assignedTo: target._id, status: { $in: ['CALLED', 'PROCESSING'] } } } })) return res.status(409).json({ error: 'Complete this account’s active clients before deleting it.' });
    await User.deleteOne({ _id: target._id });
    res.json({ message: 'Account deleted' });
  } catch (err) { next(err); }
});
router.post('/:id/reset-password', async (req, res, next) => {
  try {
    if (!idSchema.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid user ID' });
    const parsed = z.object({ password: z.string().min(12).max(128) }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Password must contain 12–128 characters' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.passwordHash = await bcrypt.hash(parsed.data.password, 12);
    user.sessionVersion += 1;
    await user.save();
    res.json({ message: 'Password reset; previous sessions revoked' });
  } catch (err) { next(err); }
});
export default router;
