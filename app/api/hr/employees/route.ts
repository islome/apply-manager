import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireHr } from '@/lib/hr-auth';
import { dbFail, fail, readJson } from '@/lib/hr-http';
import { parseNewEmployee } from '@/lib/hr-validate';

// Everyone hired through this HR's vacancies (active and left), newest hire first.
export async function GET(req: NextRequest) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const { data, error } = await supabaseAdmin()
    .from('hired_employees')
    .select('*, candidate:candidates(username, photo_url)')
    .eq('hr_user_id', auth.hr.id)
    .order('hired_at', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return dbFail(error);
  return NextResponse.json(data ?? []);
}

// Adds someone who already works at the company (not hired through the pipeline).
// The headcount in Settings already includes them, so it is raised only if `add_to_count` is true.
export async function POST(req: NextRequest) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const parsed = parseNewEmployee(await readJson(req));
  if (!parsed.ok) return fail(400, parsed.error);
  const { add_to_count, ...row } = parsed.data;

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('hired_employees')
    .insert({ ...row, hr_user_id: auth.hr.id, source: 'manual' })
    .select('*, candidate:candidates(username, photo_url)')
    .single();
  if (error) return dbFail(error);

  if (add_to_count && auth.hr.profile_id) {
    const { data: p } = await sb.from('hr_profiles').select('employees').eq('id', auth.hr.profile_id).maybeSingle();
    const { error: bumpError } = await sb
      .from('hr_profiles')
      .update({ employees: (p?.employees ?? 0) + 1 })
      .eq('id', auth.hr.profile_id);
    if (bumpError) console.error('[employees] headcount bump failed', bumpError);
  }
  return NextResponse.json(data, { status: 201 });
}
