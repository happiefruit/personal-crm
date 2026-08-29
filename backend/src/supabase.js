// Thin PostgREST client over fetch — no SDK.
//
// @supabase/supabase-js v2.11x hard-requires Node 22 (native WebSocket for its
// realtime module) and crashes on createClient under Node 20. The backend only
// needs plain table reads/writes, so we call Supabase's auto-generated REST API
// directly with the service_role key. Works on any Node 18+ and on every host.

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const restBase = SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1` : null;

/**
 * Query a table via PostgREST.
 * @param {string} table
 * @param {object} [opts]
 * @param {string} [opts.method='GET']
 * @param {Record<string,string>} [opts.query]   querystring params (select, filters, order, limit…)
 * @param {unknown} [opts.body]                   JSON body for POST/PATCH
 * @param {string} [opts.prefer]                  PostgREST Prefer header
 * @returns {Promise<{ data: any, count: number|null }>}
 */
export async function pgrest(table, opts = {}) {
  if (!supabaseConfigured) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');

  const { method = 'GET', query = {}, body, prefer } = opts;
  const url = new URL(`${restBase}/${table}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.message || data?.hint || `PostgREST ${res.status}`;
    throw new Error(msg);
  }

  // count comes back in the Content-Range header when Prefer: count=exact
  const range = res.headers.get('content-range');
  const count = range && range.includes('/') ? Number(range.split('/')[1]) : null;
  return { data, count: Number.isNaN(count) ? null : count };
}

/**
 * Cheap round-trip to confirm the DB is reachable and the schema is applied.
 * @returns {Promise<{ ok: boolean, detail: string }>}
 */
export async function checkDatabase() {
  if (!supabaseConfigured) {
    return { ok: false, detail: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set' };
  }
  try {
    const { count } = await pgrest('people', {
      query: { select: 'id', limit: '1' },
      prefer: 'count=exact',
    });
    return { ok: true, detail: `connected — ${count ?? 0} people` };
  } catch (err) {
    return { ok: false, detail: err.message };
  }
}
