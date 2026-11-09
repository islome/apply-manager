'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, fetchVacancies, type Vacancy } from '@/lib/vacancies';
import { LOGIN_PATH } from '@/lib/hr-redirect';
import { getCached, setCached } from '@/lib/data-cache';

type State = 'loading' | 'ok' | 'error';

/**
 * Loads vacancies from GET /api/vacancies.
 *  - a 401 sends the HR to the login page
 *  - `reload()` refetches without flashing the loading state (keeps the old list visible)
 *  - the in-flight request is aborted on unmount, so no setState on a dead component
 */
export function useVacancies(opts: { active?: boolean } = {}) {
  const router = useRouter();
  const cacheKey = `vacancies:${String(opts.active)}`;
  const [vacancies, setVacancies] = useState<Vacancy[]>(() => getCached<Vacancy[]>(cacheKey) ?? []);
  const [state, setState] = useState<State>(() => (getCached(cacheKey) ? 'ok' : 'loading'));
  const [error, setError] = useState<string>('');
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (background: boolean) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const rows = await fetchVacancies({ active: opts.active, signal: ctrl.signal });
        setCached(cacheKey, rows);
        setVacancies(rows);
        setError('');
        setState('ok');
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        if (e instanceof ApiError && e.status === 401) {
          // the 401 response already cleared the cookie, so the proxy lets /login through
          router.replace(`${LOGIN_PATH}?next=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        setError((e as Error).message || 'Could not load vacancies');
        // keep showing the last good list on a failed background refresh
        if (!background || getCached(cacheKey) === undefined) setState('error');
      }
    },
    [opts.active, router, cacheKey]
  );

  useEffect(() => {
    void load(true); // initial state is already 'loading' when nothing is cached
    return () => abortRef.current?.abort();
  }, [load]);

  const reload = useCallback(() => load(true), [load]);
  const retry = useCallback(() => {
    setState('loading');
    return load(false);
  }, [load]);

  return { vacancies, state, error, reload, retry };
}
