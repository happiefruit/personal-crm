const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Accept: 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export { API_URL };
