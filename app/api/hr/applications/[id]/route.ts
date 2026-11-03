import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireHr } from '@/lib/hr-auth';
import { dbFail, fail, isUuid, readJson } from '@/lib/hr-http';
import { APPLICATION_STATUSES } from '@/lib/hr-validate';
import { notifyStatusChange } from '@/lib/telegram-notify';


type Ctx = { params: Promise<{ id: string }> };

// Moves an application between pipeline stages. Body: { status }
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const { id } = await ctx.params;
  if (!isUuid(id)) return fail(404, 'Not found');

  const body = (await readJson(req)) as { status?: unknown } | null;
  const status = body?.status;
  if (typeof status !== 'string' || !(APPLICATION_STATUSES as readonly string[]).includes(status)) {
    return fail(400, 'Invalid status');
  }

  const db = supabaseAdmin();

  // Oldingi status va nomzod (xabar faqat status haqiqatan o'zgarsa yuboriladi)
  const { data: before, error: beforeError } = await db
    .from('applications')
    .select('status, candidate:candidates(telegram_id, full_name), vacancy:vacancies(title)')
    .eq('id', id)
    .single();
  if (beforeError) return dbFail(beforeError);

  const { data, error } = await db
    .from('applications')
    .update({ status })
    .eq('id', id)
    .select('id, status')
    .single();
  if (error) return dbFail(error);

  if (before.status !== status) {
    const candidate = Array.isArray(before.candidate) ? before.candidate[0] : before.candidate;
    const vacancy = Array.isArray(before.vacancy) ? before.vacancy[0] : before.vacancy;
    if (candidate?.telegram_id) {
      await notifyStatusChange(candidate.telegram_id, status, {
        vacancyTitle: vacancy?.title,
        fullName: candidate.full_name,
      });
    }
  }
  return NextResponse.json(data);
}
