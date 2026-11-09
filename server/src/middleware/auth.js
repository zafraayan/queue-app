import { getSteps } from '../models/StepConfig.js';
import { User } from '../models/User.js';
export async function requireAuth(req, res, next) {
  try {
    if (!req.session?.userId) return res.status(401).json({ error: 'Authentication required' });
    const user = await User.findById(req.session.userId);
    if (!user || !user.active || user.sessionVersion !== req.session.sessionVersion) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Session expired or account disabled' });
    }
    req.user = user;
    next();
  } catch (err) { next(err); }
}
export function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Forbidden' });
}
export async function allowStep(req, res, next) {
  const step = Number(req.params.step);
  if (!Number.isInteger(step) || step < 1) return res.status(400).json({ error: 'Invalid step' });
  try { if (!(await getSteps()).includes(step)) return res.status(400).json({ error: 'Invalid step' }); } catch (error) { return next(error); }
  if (req.user.role === 'admin' || req.user.role === 'supervisor' || (req.user.role === 'staff' && req.user.assignedSteps.includes(step))) return next();
  return res.status(403).json({ error: 'Not assigned to this step' });
}
