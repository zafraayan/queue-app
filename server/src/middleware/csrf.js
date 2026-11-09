// Defense-in-depth: same-origin browser writes require a custom header and matching Origin.
// No state-changing GET routes. Cross-origin simple forms cannot set this header.
export function requireSameOriginWrite(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  const allowed = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  if (origin !== allowed || req.get('x-requested-with') !== 'XMLHttpRequest') return res.status(403).json({ error: 'Request origin validation failed' });
  next();
}
