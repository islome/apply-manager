import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireHr } from '@/lib/hr-auth';
import { dbFail, fail } from '@/lib/hr-http';
import { isMissingTable } from '@/lib/hr-stages';

const MAX_PAGE = 200;

type Joined = { full_name?: string | null; photo_url?: string | null; title?: string | null };
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

// GET ?offset=0&limit=100 -> { events, total, migrated }: this HR's status log, newest first (supabase/012)
export async function GET(req: NextRequest) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const params = req.nextUrl.searchParams;
  const offset = Math.max(0, Number.parseInt(params.get('offset') ?? '0', 10) || 0);
  const limit = Math.min(MAX_PAGE, Math.max(1, Number.parseInt(params.get('limit') ?? '100', 10) || 100));

  const { data, error, count } = await supabaseAdmin()
    .from('application_events')
    .select(
      `id, type, from_status, to_status, to_label, actor, backfilled, created_at, application_id,
       actor_user:hr_users!application_events_actor_id_fkey(username),
       application:applications(candidate:candidates(full_name, photo_url), vacancy:vacancies(title))`,
      { count: 'exact' },
    )
    .eq('hr_user_id', auth.hr.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);

  if (isMissingTable(error)) return NextResponse.json({ events: [], total: 0, migrated: false });
  if (error) return dbFail(error);

  const events = (data ?? []).map(({ actor_user, application, ...e }) => {
    const app = one(application as { candidate?: Joined | Joined[]; vacancy?: Joined | Joined[] } | null);
    const candidate = one(app?.candidate);
    const vacancy = one(app?.vacancy);
    return {
      ...e,
      actor_name: one(actor_user as { username?: string } | null)?.username ?? null,
      candidate_name: candidate?.full_name?.trim() || null,
      candidate_photo: candidate?.photo_url ?? null,
      vacancy_title: vacancy?.title ?? null,
    };
  });
  return NextResponse.json({ events, total: count ?? events.length, migrated: true });
}

// DELETE -> { deleted }: clears this HR's whole log (the page asks for a typed confirmation first).
// New status changes keep being logged afterwards.
export async function DELETE(req: NextRequest) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const { error, count } = await supabaseAdmin()
    .from('application_events')
    .delete({ count: 'exact' })
    .eq('hr_user_id', auth.hr.id);

  if (isMissingTable(error)) return fail(503, 'The activity log needs a database update first: run supabase/012_application_events.sql');
  if (error) return dbFail(error);
  return NextResponse.json({ deleted: count ?? 0 });
}
