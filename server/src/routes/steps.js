import { Router } from 'express';
import { StepConfig, getSteps, getStepNames, stepNumbers } from '../models/StepConfig.js';
import { z } from 'zod';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { QueueTransaction } from '../models/QueueTransaction.js';
import { User } from '../models/User.js';
import { runTransaction } from '../services/transaction.js';

const router = Router();
router.get('/', async (_req, res, next) => {
  try { res.json({ steps: await getSteps(), names: await getStepNames() }); } catch (error) { next(error); }
});
router.post('/', requireAuth, allowRoles('admin'), async (req, res, next) => {
  const parsed = z.object({ name: z.string().trim().min(1).max(80).optional() }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a step name (1–80 characters).' });
  try {
    // Initialize existing installations without resetting their configuration.
    try {
      await StepConfig.updateOne({ _id: 'main' }, { $setOnInsert: { count: 4 } }, { upsert: true });
    } catch (error) { if (error.code !== 11000) throw error; }
    const config = await runTransaction(async session => {
      const current = await StepConfig.findOneAndUpdate({ _id: 'main' }, { $inc: { count: 1 } }, { new: true, session });
      if (parsed.data.name) await StepConfig.updateOne({ _id: 'main' }, { $set: { [`names.${current.count}`]: parsed.data.name } }, { session });
      return current;
    });
    req.app.get('io')?.to('staff').emit('queue:summary-changed');
    req.app.get('io')?.to('display').emit('display:changed');
    res.status(201).json({ steps: stepNumbers(config.count).filter(step => !config.deleted?.includes(step)), addedStep: config.count, ...(parsed.data.name ? { names: await getStepNames() } : {}) });
  } catch (error) { next(error); }
});
router.patch('/:step', requireAuth, allowRoles('admin'), async (req, res, next) => {
  const step = Number(req.params.step);
  const parsed = z.object({ name: z.string().trim().min(1).max(80) }).strict().safeParse(req.body);
  if (!Number.isSafeInteger(step) || step < 1 || !parsed.success) return res.status(400).json({ error: 'Enter a step name (1–80 characters).' });
  try {
    await runTransaction(async session => {
      if (!(await getSteps(session)).includes(step)) throw Object.assign(new Error('Step not found.'), { status: 404 });
      await StepConfig.updateOne({ _id: 'main' }, { $set: { [`names.${step}`]: parsed.data.name } }, { session });
    });
    req.app.get('io')?.to('staff').emit('queue:summary-changed');
    req.app.get('io')?.to('display').emit('display:changed');
    res.json({ names: await getStepNames() });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});
router.delete('/:step', requireAuth, allowRoles('admin'), async (req, res, next) => {
  const step = Number(req.params.step);
  if (!Number.isSafeInteger(step) || step < 1) return res.status(400).json({ error: 'Invalid step.' });
  try {
    const steps = await runTransaction(async session => {
      const currentSteps = await getSteps(session);
      if (!currentSteps.includes(step)) throw Object.assign(new Error('Step not found.'), { status: 404 });
      if (currentSteps.length === 1) throw Object.assign(new Error('Keep at least one step.'), { status: 409 });
      if (await QueueTransaction.exists({ status: 'ACTIVE', 'steps.step': step }).session(session)) {
        throw Object.assign(new Error('Complete the active tickets that include this step before deleting it.'), { status: 409 });
      }
      await StepConfig.updateOne({ _id: 'main' }, { $addToSet: { deleted: step } }, { session });
      await User.updateMany({ assignedSteps: step }, { $pull: { assignedSteps: step }, $inc: { sessionVersion: 1 } }, { session });
      return currentSteps.filter(number => number !== step);
    });
    req.app.get('io')?.to('staff').emit('queue:summary-changed');
    req.app.get('io')?.to('display').emit('display:changed');
    res.json({ steps });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});
export default router;
