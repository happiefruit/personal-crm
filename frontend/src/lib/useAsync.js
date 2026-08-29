import { useCallback, useEffect, useState } from 'react';

/**
 * Run an async function on mount (and on demand via reload()).
 * @param {Function} fn      async producer; receives an AbortSignal
 * @param {Array} deps       re-run when these change
 */
export function useAsync(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    run()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [run]);

  useEffect(reload, [reload]);

  return { data, error, loading, reload, setData };
}
