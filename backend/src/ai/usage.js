import { pgrest } from '../supabase.js';
import { estimateCost } from './pricing.js';

/**
 * Persist one AI call's token usage + estimated cost. Never throws.
 * @returns {{ cost: number, input: number, output: number, cache_read: number, cache_write: number }}
 */
export async function recordUsage({ model, operation = 'parse_note', usage, noteId = null }) {
  const c = estimateCost(model, usage);
  try {
    await pgrest('ai_usage', {
      method: 'POST',
      body: {
        model,
        operation,
        input_tokens: c.input,
        output_tokens: c.output,
        cache_read_tokens: c.cache_read,
        cache_write_tokens: c.cache_write,
        cost_usd: Number(c.cost.toFixed(6)),
        note_id: noteId,
      },
    });
  } catch (err) {
    console.error('ai_usage record failed:', err.message);
  }
  return c;
}

function aggregate(rows) {
  return rows.reduce(
    (a, r) => ({
      calls: a.calls + 1,
      input_tokens: a.input_tokens + (r.input_tokens || 0),
      output_tokens: a.output_tokens + (r.output_tokens || 0),
      cost_usd: a.cost_usd + Number(r.cost_usd || 0),
    }),
    { calls: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 },
  );
}

/** This-calendar-month and all-time totals. */
export async function getUsageSummary() {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data } = await pgrest('ai_usage', {
    query: { select: 'created_at,input_tokens,output_tokens,cost_usd' },
  });
  const rows = data || [];
  const thisMonth = rows.filter((r) => new Date(r.created_at) >= monthStart);

  return {
    this_month: aggregate(thisMonth),
    all_time: aggregate(rows),
    month_started: monthStart.toISOString(),
    estimate: true,
  };
}
