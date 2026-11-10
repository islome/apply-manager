// Server-only: the signed-in HR's pipeline stages (supabase/011_pipeline_stages.sql).
import type { PostgrestError } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase-admin';
import { DEFAULT_STAGES, orderStages, type Stage } from './stages';

type Sb = ReturnType<typeof supabaseAdmin>;

/** Postgres "undefined table" / PostgREST "table not in schema cache": the migration has not run yet. */
export function isMissingTable(error: PostgrestError | null): boolean {
  return !!error && (error.code === '42P01' || error.code === 'PGRST205');
}

export type LoadedStages =
  | { ok: true; stages: Stage[]; /** false until 011 has been run */ migrated: boolean }
  | { ok: false; error: PostgrestError };

/** Saved stages in board order, or the defaults when this HR never customised them (or 011 is missing). */
export async function loadStages(sb: Sb, hrId: string): Promise<LoadedStages> {
  const { data, error } = await sb
    .from('pipeline_stages')
    .select('key, label, color, position')
    .eq('hr_user_id', hrId)
    .order('position', { ascending: true });

  if (isMissingTable(error)) return { ok: true, stages: DEFAULT_STAGES, migrated: false };
  if (error) return { ok: false, error };
  if (!data?.length) return { ok: true, stages: DEFAULT_STAGES, migrated: true };

  const stages = orderStages(
    data.map((r) => ({ key: r.key as string, label: (r.label as string | null) ?? null, color: r.color as string })),
  );
  return { ok: true, stages, migrated: true };
}
