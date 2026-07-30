'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseApiOptions {
  refetchMs?: number;
  enableRefetch?: boolean;
  treatNullAsError?: boolean;
  maxRetries?: number;
}

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retryCount: number;
  retry: () => void;
  refetch: () => void;
}

export function useApi<T>(
  fetcher: () => Promise<T | null>,
  deps: unknown[] = [],
  options: UseApiOptions = {}
): UseApiResult<T> {
  const {
    refetchMs = 30000,
    enableRefetch = true,
    treatNullAsError = true,
    maxRetries = 3,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  fetcherRef.current = fetcher;

  const run = useCallback(
    async (isManual = false) => {
      if (isManual) setLoading(true);
      try {
        const res = await fetcherRef.current();
        if (!mounted.current) return;
        if (treatNullAsError && res === null) {
          throw new Error('No data');
        }
        setData(res);
        setError(null);
        setRetryCount(0);
      } catch (e) {
        if (!mounted.current) return;
        setError(String(e));
        setRetryCount((c) => {
          if (c < maxRetries) {
            const delay = 1000 * 2 ** c;
            retryTimer.current = setTimeout(() => {
              if (mounted.current) run(true);
            }, delay);
            return c + 1;
          }
          return c;
        });
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [treatNullAsError, maxRetries]
  );

  const retry = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    setRetryCount(0);
    setError(null);
    run(true);
  }, [run]);

  const refetch = useCallback(() => {
    run(true);
  }, [run]);

  useEffect(() => {
    mounted.current = true;
    run();
    return () => {
      mounted.current = false;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [...deps, run]);

  useEffect(() => {
    if (!enableRefetch || refetchMs <= 0) return;
    intervalRef.current = setInterval(() => run(true), refetchMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refetchMs, enableRefetch, run]);

  return { data, loading, error, retryCount, retry, refetch };
}
