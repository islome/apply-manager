'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api-client';
import { LOGIN_PATH } from '@/lib/hr-redirect';
import { getCached, setCached } from '@/lib/data-cache';
import { fetchEmployees, updateEmployee, type Employee, type EmployeePatch } from '@/lib/employees';

const CACHE_KEY = 'employees';
type LoadState = 'loading' | 'ok' | 'error';

/**
 * Hired employees. Shows the cached list instantly, refreshes quietly in the background.
 * `save()` returns the updated row (or throws ApiError for the modal to display).
 * `error` holds the HTTP status (0 = network) so the page can render a translated message.
 */
export function useEmployees() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>(() => getCached<Employee[]>(CACHE_KEY) ?? []);
  const [state, setState] = useState<LoadState>(() => (getCached(CACHE_KEY) ? 'ok' : 'loading'));
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // setState only runs in the promise callbacks, never synchronously in the effect body
  useEffect(() => {
    const ctrl = new AbortController();
    fetchEmployees(ctrl.signal)
      .then((rows) => {
        setCached(CACHE_KEY, rows);
        setEmployees(rows);
        setErrorStatus(null);
        setState('ok');
      })
      .catch((e: unknown) => {
        if ((e as Error).name === 'AbortError') return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace(`${LOGIN_PATH}?next=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        setErrorStatus(e instanceof ApiError ? e.status : 0);
        // a failed background refresh keeps the cached list on screen
        if (getCached(CACHE_KEY) === undefined) setState('error');
      });
    return () => ctrl.abort();
  }, [router, reloadKey]);

  const retry = useCallback(() => {
    setState('loading');
    setReloadKey((k) => k + 1);
  }, []);

  const save = useCallback(async (id: string, patch: EmployeePatch): Promise<Employee> => {
    const saved = await updateEmployee(id, patch);
    setEmployees((list) => {
      const next = list.map((e) => (e.id === id ? { ...e, ...saved } : e));
      setCached(CACHE_KEY, next);
      return next;
    });
    return saved;
  }, []);

  return { employees, state, errorStatus, retry, save };
}
