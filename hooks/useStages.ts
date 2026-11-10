'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '@/lib/api-client';
import { getCached, setCached } from '@/lib/data-cache';
import { DEFAULT_STAGES, type Stage } from '@/lib/stages';

const CACHE_KEY = 'stages';
const EVENT = 'stages:updated';

type Payload = { stages: Stage[]; migrated: boolean };

/** What the modal sends: existing stages keep their key, new ones have none yet. */
export type StageDraft = { key?: string; label: string | null; color: string };

/**
 * The HR's pipeline stages. Shows the cached copy (or the defaults) at once and refreshes in the
 * background, so the board never waits on it. Every mounted instance updates after a save.
 */
export function useStages() {
  const [data, setData] = useState<Payload>(
    () => getCached<Payload>(CACHE_KEY) ?? { stages: DEFAULT_STAGES, migrated: true },
  );

  useEffect(() => {
    let alive = true;
    apiJson<Payload>('/api/hr/stages')
      .then((fresh) => {
        if (!alive || !Array.isArray(fresh?.stages) || !fresh.stages.length) return;
        setCached(CACHE_KEY, fresh);
        setData(fresh);
      })
      .catch(() => {
        /* keep the defaults / cached copy; the board still works */
      });

    const onUpdate = () => {
      const cached = getCached<Payload>(CACHE_KEY);
      if (cached) setData(cached);
    };
    window.addEventListener(EVENT, onUpdate);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, onUpdate);
    };
  }, []);

  /** Throws ApiError with the server's message (e.g. a stage that still has applications). */
  const save = useCallback(async (stages: StageDraft[]) => {
    const saved = await apiJson<Payload>('/api/hr/stages', { method: 'PUT', body: { stages } });
    setCached(CACHE_KEY, saved);
    setData(saved);
    window.dispatchEvent(new Event(EVENT));
    return saved;
  }, []);

  return { stages: data.stages, migrated: data.migrated, save };
}
