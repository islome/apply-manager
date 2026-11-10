import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireHr } from '@/lib/hr-auth';
import { dbFail, fail, readJson } from '@/lib/hr-http';
import { ownVacancyIds } from '@/lib/hr-scope';
import { isMissingTable, loadStages } from '@/lib/hr-stages';
import { CORE_KEYS, MAX_LABEL, MAX_STAGES, STAGE_COLORS, orderStages, type Stage } from '@/lib/stages';

const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
const KNOWN_KEYS = ['new', 'confirmed', 'interview', 'hired', 'cancel'];

// GET -> { stages, migrated }: the board's columns in order (defaults until the HR saves their own)
export async function GET(req: NextRequest) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const loaded = await loadStages(supabaseAdmin(), auth.hr.id);
  if (!loaded.ok) return dbFail(loaded.error);
  return NextResponse.json({ stages: loaded.stages, migrated: loaded.migrated });
}

type Parsed = { ok: true; stages: Stage[] } | { ok: false; error: string };

/** Body: { stages: [{ key?, label, color }] } in board order. A stage without a key is new. */
function parse(body: unknown): Parsed {
  const list = (body as { stages?: unknown } | null)?.stages;
  if (!Array.isArray(list) || list.length === 0) return { ok: false, error: 'stages must be a non-empty array' };
  if (list.length > MAX_STAGES) return { ok: false, error: `At most ${MAX_STAGES} stages` };

  const out: Stage[] = [];
  for (const raw of list) {
    const item = raw as { key?: unknown; label?: unknown; color?: unknown } | null;
    if (!item || typeof item !== 'object') return { ok: false, error: 'Invalid stage' };

    let key: string;
    if (item.key == null || item.key === '') key = `s_${randomBytes(4).toString('hex')}`;
    else if (typeof item.key === 'string' && KEY_RE.test(item.key)) key = item.key;
    else return { ok: false, error: 'Invalid stage key' };

    let label: string | null = null;
    if (item.label != null) {
      if (typeof item.label !== 'string') return { ok: false, error: 'Invalid stage name' };
      const trimmed = item.label.trim().replace(/\s+/g, ' ');
      if (trimmed.length > MAX_LABEL) return { ok: false, error: `Stage names are at most ${MAX_LABEL} characters` };
      label = trimmed || null;
    }
    if (!label && !KNOWN_KEYS.includes(key)) return { ok: false, error: 'Every new stage needs a name' };

    if (typeof item.color !== 'string' || !(STAGE_COLORS as readonly string[]).includes(item.color)) {
      return { ok: false, error: 'Invalid stage colour' };
    }
    if (out.some((s) => s.key === key)) return { ok: false, error: 'Duplicate stage' };
    out.push({ key, label, color: item.color });
  }

  for (const core of CORE_KEYS) {
    if (!out.some((s) => s.key === core)) return { ok: false, error: 'The New, Hired and Cancelled stages cannot be removed' };
  }
  return { ok: true, stages: orderStages(out) };
}

// PUT -> replaces the HR's stages. Refuses to drop a stage that still has applications in it.
export async function PUT(req: NextRequest) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;
  const hrId = auth.hr.id;

  const parsed = parse(await readJson(req));
  if (!parsed.ok) return fail(400, parsed.error);
  const next = parsed.stages;

  const sb = supabaseAdmin();
  const current = await loadStages(sb, hrId);
  if (!current.ok) return dbFail(current.error);
  if (!current.migrated) {
    return fail(503, 'Custom stages need a database update first: run supabase/011_pipeline_stages.sql');
  }

  // stages being removed must be empty
  const removed = current.stages.filter((s) => !next.some((n) => n.key === s.key));
  if (removed.length) {
    const own = await ownVacancyIds(sb, hrId);
    if (own.error) return dbFail(own.error as Parameters<typeof dbFail>[0]);
    if (own.ids.length) {
      const { data, error } = await sb
        .from('applications')
        .select('status')
        .in('vacancy_id', own.ids)
        .in('status', removed.map((s) => s.key));
      if (error) return dbFail(error);
      const busy = removed.find((s) => data?.some((a) => a.status === s.key));
      if (busy) {
        return fail(409, `"${busy.label ?? busy.key}" still has applications. Move them to another stage first.`);
      }
    }
  }

  const rows = next.map((s, position) => ({ hr_user_id: hrId, key: s.key, label: s.label, color: s.color, position }));
  const { error: upsertError } = await sb.from('pipeline_stages').upsert(rows, { onConflict: 'hr_user_id,key' });
  if (isMissingTable(upsertError)) {
    return fail(503, 'Custom stages need a database update first: run supabase/011_pipeline_stages.sql');
  }
  if (upsertError) return dbFail(upsertError);

  // keys are validated against KEY_RE above, so they are safe inside the PostgREST list
  const { error: deleteError } = await sb
    .from('pipeline_stages')
    .delete()
    .eq('hr_user_id', hrId)
    .not('key', 'in', `(${next.map((s) => s.key).join(',')})`);
  if (deleteError) return dbFail(deleteError);

  return NextResponse.json({ stages: next, migrated: true });
}
