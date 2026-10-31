import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCompanyName, requireHr } from '@/lib/hr-auth';
import { dbFail, fail, isUuid, readJson } from '@/lib/hr-http';
import { parseVacancy } from '@/lib/hr-validate';

type Ctx = { params: Promise<{ id: string }> };

// PATCH accepts partial bodies: the panel sends only { is_active } for the on/off toggle
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const { id } = await ctx.params;
  if (!isUuid(id)) return fail(404, 'Not found');

  const parsed = parseVacancy(await readJson(req), false);
  if (!parsed.ok) return fail(400, parsed.error);

  const update: Record<string, unknown> = { ...parsed.data };
  if (!parsed.data.company) {
    const company = await getCompanyName(auth.hr);
    if (company) update.company = company; // keeps the name in sync if the profile was renamed
  }
  delete update.hr_user_id; // egasi o'zgartirilmaydi

  const { data, error } = await supabaseAdmin()
    .from('vacancies')
    .update(update)
    .eq('id', id)
    .eq('hr_user_id', auth.hr.id) // faqat o'zining vakansiyasi
    .select()
    .maybeSingle();
  if (error) return dbFail(error);
  if (!data) return fail(404, 'Not found');
  return NextResponse.json(data);
}

// Applications for this vacancy are removed too (on delete cascade)
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const { id } = await ctx.params;
  if (!isUuid(id)) return fail(404, 'Not found');

  const { data, error } = await supabaseAdmin()
    .from('vacancies')
    .delete()
    .eq('id', id)
    .eq('hr_user_id', auth.hr.id)
    .select('id');
  if (error) return dbFail(error);
  if (!data || data.length === 0) return fail(404, 'Not found');
  return new NextResponse(null, { status: 204 });
}
