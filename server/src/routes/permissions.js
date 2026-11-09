import { Router } from 'express';
import { requireAuth, allowRoles, allowStep } from '../middleware/auth.js';
const router = Router();
router.get('/reception', requireAuth, allowRoles('admin', 'receptionist'), (_req, res) => res.json({ allowed: true, message: 'Reception access confirmed; registration APIs are Step 3.' }));
router.get('/supervisor', requireAuth, allowRoles('admin', 'supervisor'), (_req, res) => res.json({ allowed: true }));
router.get('/steps/:step', requireAuth, allowStep, (req, res) => res.json({ allowed: true, step: Number(req.params.step) }));
export default router;
