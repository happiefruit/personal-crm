import { getPasscode, clearPasscode } from './session.js';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

async function request(path, { method = 'GET', body, passcode } = {}) {
  const code = passcode ?? getPasscode();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(code ? { Authorization: `Bearer ${code}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // Passcode rejected — drop it so the app falls back to the lock screen.
  if (res.status === 401) {
    clearPasscode();
    const err = new Error('Session expired — enter the passcode again');
    err.status = 401;
    throw err;
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  // Verify a passcode without storing it first.
  verifyPasscode: (code) => request('/api/auth/check', { passcode: code }),
};

export { API_URL };
