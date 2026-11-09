import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { displaySnapshot } from '../services/display.js';
const router = Router();
router.use(rateLimit({windowMs: 60_000, limit: 90, standardHeaders:'draft-8', legacyHeaders:false}));
router.get('/', async (_req,res,next) => {
  try { res.set('Cache-Control','no-store'); res.json(await displaySnapshot()); }
  catch(err) { next(err); }
});
export default router;
