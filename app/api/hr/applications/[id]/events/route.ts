import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireHr } from '@/lib/hr-auth';
import { dbFail, fail, isUuid } from '@/lib/hr-http';
import { isMissingTable } from '@/lib/hr-stages';

type Ctx = { params: Promise<{ id: string }> };

// GET -> { events, migrated }: the application's status history, oldest first (supabase/012).
export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const { id } = await ctx.params;
  if (!isUuid(id)) return fail(404, 'Not found');

  const sb = supabaseAdmin();

  // only applications to this HR's own vacancies (someone else's looks like "not found")
  const { data: app, error: appError } = await sb
    .from('applications')
    .select('id, vacancy:vacancies(hr_user_id)')
    .eq('id', id)
    .maybeSingle();
  if (appError) return dbFail(appError);
  const owner = Array.isArray(app?.vacancy) ? app?.vacancy[0] : app?.vacancy;
  if (!app || !owner || owner.hr_user_id !== auth.hr.id) return fail(404, 'Not found');

  const { data, error } = await sb
    .from('application_events')
    .select(
      'id, type, from_status, to_status, to_label, actor, backfilled, created_at, actor_user:hr_users!application_events_actor_id_fkey(username)',
    )
    .eq('application_id', id)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(200);

  if (isMissingTable(error)) return NextResponse.json({ events: [], migrated: false });
  if (error) return dbFail(error);

  const events = (data ?? []).map(({ actor_user, ...e }) => {
    const user = Array.isArray(actor_user) ? actor_user[0] : actor_user;
    return { ...e, actor_name: (user as { username?: string } | null)?.username ?? null };
  });
  return NextResponse.json({ events, migrated: true });
}
