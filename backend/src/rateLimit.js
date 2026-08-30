// Tiny in-memory rate limiter. Single Railway instance + single user, so a Map
// is enough; swap for Redis/Postgres if this ever runs multi-instance.

/**
 * @param {object} opts
 * @param {number} opts.windowMs
 * @param {number} opts.max      requests allowed per window per key
 * @param {string} [opts.name]   shown in the 429 message
 * @returns {import('express').RequestHandler}
 */
export function rateLimit({ windowMs, max, name = 'requests' }) {
  const hits = new Map(); // key -> { count, resetAt }

  // opportunistic cleanup so the Map can't grow unbounded
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
  }, windowMs).unref?.();

  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    let rec = hits.get(key);
    if (!rec || now > rec.resetAt) {
      rec = { count: 0, resetAt: now + windowMs };
      hits.set(key, rec);
    }
    rec.count += 1;

    const remaining = Math.max(0, max - rec.count);
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(remaining));

    if (rec.count > max) {
      const retryAfter = Math.ceil((rec.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: `Too many ${name}, retry in ${retryAfter}s` });
    }
    next();
  };
}
