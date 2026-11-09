'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api-client';
import { LOGIN_PATH } from '@/lib/hr-redirect';
import { getCached, setCached } from '@/lib/data-cache';
import {
  fetchApplications,
  updateApplicationStatus,
  type Application,
  type StageId,
} from '@/lib/applications';

const REFRESH_MS = 60_000;
const CACHE_KEY = 'applications';

type LoadState = 'loading' | 'ok' | 'error';
export type MoveResult = { ok: boolean; message?: string };

/**
 * Applications for the board.
 *  - move(): the card jumps immediately; if the server refuses, it jumps back and the
 *    caller gets a message to show
 *  - refreshes every minute and when the tab becomes visible again, but never while a move
 *    is in flight (a stale snapshot must not overwrite the card you just dropped)
 *  - 401 sends the HR to /login
 */
export function useApplications() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>(() => getCached<Application[]>(CACHE_KEY) ?? []);
  const [state, setState] = useState<LoadState>(() => (getCached(CACHE_KEY) ? 'ok' : 'loading'));
  const [error, setError] = useState('');

  const listRef = useRef<Application[]>(getCached<Application[]>(CACHE_KEY) ?? []); // source of truth, mirrored into state
  const abortRef = useRef<AbortController | null>(null);
  const inflightRef = useRef(0); // moves being saved
  const seqRef = useRef(0); // bumped on every move; invalidates refreshes that started earlier

  const commit = useCallback((update: (prev: Application[]) => Application[]) => {
    listRef.current = update(listRef.current);
    setCached(CACHE_KEY, listRef.current);
    setApplications(listRef.current);
  }, []);

  const goToLogin = useCallback(() => {
    router.replace(`${LOGIN_PATH}?next=${encodeURIComponent(window.location.pathname)}`);
  }, [router]);

  const load = useCallback(
    async (background: boolean) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const seq = seqRef.current;
      try {
        const rows = await fetchApplications(ctrl.signal);
        if (seq !== seqRef.current || inflightRef.current > 0) return; // stale snapshot
        commit(() => rows);
        setError('');
        setState('ok');
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        if (e instanceof ApiError && e.status === 401) {
          goToLogin();
          return;
        }
        setError((e as Error).message || 'Could not load applications');
        if (!background || getCached(CACHE_KEY) === undefined) setState('error'); // a failed background refresh keeps the last good data
      }
    },
    [commit, goToLogin]
  );

  useEffect(() => {
    void load(true); // initial state is already 'loading' when nothing is cached
    const tick = () => {
      if (!document.hidden && inflightRef.current === 0) void load(true);
    };
    const timer = setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      abortRef.current?.abort();
    };
  }, [load]);

  const move = useCallback(
    async (id: string, next: StageId): Promise<MoveResult> => {
      const current = listRef.current.find((a) => a.id === id);
      if (!current || current.status === next) return { ok: false };

      const before = { status: current.status, updated_at: current.updated_at };
      seqRef.current += 1;
      inflightRef.current += 1;
      abortRef.current?.abort(); // drop a refresh that is still in the air

      commit((list) =>
        list.map((a) => (a.id === id ? { ...a, status: next, updated_at: new Date().toISOString() } : a))
      );
      try {
        const saved = await updateApplicationStatus(id, next);
        commit((list) =>
          list.map((a) => (a.id === id ? { ...a, status: next, updated_at: saved?.updated_at ?? a.updated_at } : a))
        );
        return { ok: true };
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          goToLogin();
          return { ok: false };
        }
        commit((list) => list.map((a) => (a.id === id ? { ...a, ...before } : a)));
        return { ok: false, message: (e as Error).message || 'Could not save the change' };
      } finally {
        inflightRef.current -= 1;
      }
    },
    [commit, goToLogin]
  );

  const retry = useCallback(() => {
    setState('loading');
    return load(false);
  }, [load]);

  return { applications, state, error, move, retry };
}
