import crypto from 'node:crypto';

const PASSCODE = process.env.APP_PASSCODE || '';
export const authConfigured = Boolean(PASSCODE);

// Timing-safe string compare.
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function extractPasscode(req) {
  const h = req.get('authorization') || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return req.get('x-app-passcode') || '';
}

// --- brute-force throttle (in-memory, per IP) ---------------------------------
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;
const fails = new Map(); // ip -> { count, resetAt }

function tooManyAttempts(ip) {
  const rec = fails.get(ip);
  if (!rec) return false;
  if (Date.now() > rec.resetAt) {
    fails.delete(ip);
    return false;
  }
  return rec.count >= MAX_FAILS;
}

function recordFail(ip) {
  const rec = fails.get(ip);
  if (!rec || Date.now() > rec.resetAt) {
    fails.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS });
  } else {
    rec.count += 1;
  }
}

function clearFails(ip) {
  fails.delete(ip);
}

/**
 * Gate for /api/* routes. Requires the shared passcode via
 * `Authorization: Bearer <passcode>` (or `x-app-passcode`).
 * If APP_PASSCODE is unset the gate is open but every request logs a warning.
 */
export function requirePasscode(req, res, next) {
  if (!authConfigured) {
    console.warn('AUTH DISABLED: APP_PASSCODE not set — the API is publicly writable');
    return next();
  }

  const ip = req.ip;
  if (tooManyAttempts(ip)) {
    return res.status(429).json({ error: 'too many attempts, try again later' });
  }

  if (safeEqual(extractPasscode(req), PASSCODE)) {
    clearFails(ip);
    return next();
  }

  recordFail(ip);
  return res.status(401).json({ error: 'invalid or missing passcode' });
}
