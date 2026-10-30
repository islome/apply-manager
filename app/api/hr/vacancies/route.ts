import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCompanyName, requireHr } from '@/lib/hr-auth';
import { dbFail, fail, readJson } from '@/lib/hr-http';
import { parseVacancy } from '@/lib/hr-validate';


// Note: vacancies have no owner column, so every HR user sees every vacancy.
// If you later run several companies, add vacancies.hr_profile_id and filter on it here.

export async function GET(req: NextRequest) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const { data, error } = await supabaseAdmin()
    .from('vacancies')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return dbFail(error);
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const parsed = parseVacancy(await readJson(req), true);
  if (!parsed.ok) return fail(400, parsed.error);

  // Use the submitted company for this vacancy, falling back to the saved profile for legacy clients.
  const company = parsed.data.company ?? await getCompanyName(auth.hr);
  if (!company) return fail(400, 'Set up your company profile first (Settings)');

  const { data, error } = await supabaseAdmin()
    .from('vacancies')
    .insert({ ...parsed.data, company })
    .select()
    .single();
  if (error) return dbFail(error);
  return NextResponse.json(data, { status: 201 });
}
