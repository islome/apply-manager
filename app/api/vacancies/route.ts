import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireHr } from '@/lib/hr-auth';
import { dbFail, fail } from '@/lib/hr-http';


/**
 * GET /api/vacancies            -> all vacancies, newest first
 * GET /api/vacancies?active=true  / ?active=false -> only active / only inactive
 *
 * Every vacancy comes with `applications_count` (how many candidates applied).
 * Vacancies have no owner column, so every signed-in HR sees all of them.
 */
export async function GET(req: NextRequest) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const active = req.nextUrl.searchParams.get('active');
  if (active !== null && active !== 'true' && active !== 'false') {
    return fail(400, 'active must be true or false');
  }

  let query = supabaseAdmin()
    .from('vacancies')
    .select('*, applications(count)')
    .order('created_at', { ascending: false });
  if (active !== null) query = query.eq('is_active', active === 'true');

  const { data, error } = await query;
  if (error) return dbFail(error);

  // PostgREST returns the count as applications: [{ count: n }]; flatten it for the UI
  const rows = (data ?? []).map((row) => {
    const { applications, ...vacancy } = row as Record<string, unknown> & {
      applications?: { count: number }[];
    };
    return { ...vacancy, applications_count: applications?.[0]?.count ?? 0 };
  });

  return NextResponse.json(rows);
}
