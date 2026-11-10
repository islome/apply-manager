import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireHr } from '@/lib/hr-auth';
import { dbFail, fail, isUuid, readJson } from '@/lib/hr-http';
import { loadStages } from '@/lib/hr-stages';
import { notifyStatusChange } from '@/lib/telegram-notify';


type Db = ReturnType<typeof supabaseAdmin>;

/**
 * Keeps the "Employees" list in step with the pipeline: reaching `hired` adds the person (or
 * re-activates someone who had left), leaving `hired` removes the record. The DB trigger
 * (supabase/008) adjusts the company headcount. A failure here never blocks the status change.
 */
async function syncEmployee(
  db: Db,
  applicationId: string,
  from: string,
  to: string,
  info: { hrId: string; candidate: { id?: string; full_name?: string; phone?: string | null } | null; vacancyTitle?: string },
) {
  try {
    if (to === 'hired') {
      const { data: existing } = await db
        .from('hired_employees')
        .select('id, status')
        .eq('application_id', applicationId)
        .maybeSingle();
      if (!existing) {
        const { error } = await db.from('hired_employees').insert({
          application_id: applicationId,
          candidate_id: info.candidate?.id ?? null,
          hr_user_id: info.hrId,
          full_name: info.candidate?.full_name?.trim() || 'Unknown',
          phone: info.candidate?.phone ?? null,
          position: info.vacancyTitle ?? null,
        });
        if (error) console.error('[employees] insert failed', error);
      } else if (existing.status === 'left') {
        const { error } = await db
          .from('hired_employees')
          .update({ status: 'active', left_at: null })
          .eq('id', existing.id);
        if (error) console.error('[employees] reactivate failed', error);
      }
    } else if (from === 'hired') {
      const { error } = await db.from('hired_employees').delete().eq('application_id', applicationId);
      if (error) console.error('[employees] delete failed', error);
    }
  } catch (e) {
    console.error('[employees] sync failed', e);
  }
}

type Ctx = { params: Promise<{ id: string }> };

// Moves an application between pipeline stages. Body: { status }
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const { id } = await ctx.params;
  if (!isUuid(id)) return fail(404, 'Not found');

  const body = (await readJson(req)) as { status?: unknown } | null;
  const status = body?.status;
  if (typeof status !== 'string') return fail(400, 'Invalid status');

  const db = supabaseAdmin();

  // The target must be one of this HR's pipeline stages (the 5 defaults until they customise them)
  const pipeline = await loadStages(db, auth.hr.id);
  if (!pipeline.ok) return dbFail(pipeline.error);
  const stage = pipeline.stages.find((s) => s.key === status);
  if (!stage) return fail(400, 'Invalid status');

  // Oldingi status va nomzod (xabar faqat status haqiqatan o'zgarsa yuboriladi)
  const { data: before, error: beforeError } = await db
    .from('applications')
    .select('*, candidate:candidates(id, telegram_id, full_name, phone), vacancy:vacancies(title, hr_user_id)')
    .eq('id', id)
    .single();
  if (beforeError) return dbFail(beforeError);

  // Faqat o'z vakansiyasiga kelgan arizani o'zgartirish mumkin (boshqa HR niki — 404)
  const owner = Array.isArray(before.vacancy) ? before.vacancy[0] : before.vacancy;
  if (!owner || owner.hr_user_id !== auth.hr.id) return fail(404, 'Not found');

  // cancelled_by exists only after supabase/007 was run; skip it until then
  const patch: Record<string, unknown> = { status };
  if ('cancelled_by' in before) patch.cancelled_by = status === 'cancel' ? 'hr' : null;

  const { data, error } = await db
    .from('applications')
    .update(patch)
    .eq('id', id)
    .select('id, status')
    .single()
    // tells the status-log trigger (supabase/012) which HR made this change
    .setHeader('x-hr-actor', auth.hr.id);
  if (error) return dbFail(error);

  if (before.status !== status) {
    await syncEmployee(db, id, before.status, status, {
      hrId: auth.hr.id,
      candidate: Array.isArray(before.candidate) ? before.candidate[0] : before.candidate,
      vacancyTitle: owner.title,
    });
    const candidate = Array.isArray(before.candidate) ? before.candidate[0] : before.candidate;
    const vacancy = Array.isArray(before.vacancy) ? before.vacancy[0] : before.vacancy;
    // Nomzod sozlamalarda bildirishnomani o'chirgan bo'lsa yubormaymiz (ustun yo'q bo'lsa: yuboramiz)
    let wantsNotify = true;
    if (candidate?.id) {
      const { data: pref } = await db
        .from('candidates')
        .select('notify_status')
        .eq('id', candidate.id)
        .maybeSingle();
      if (pref && pref.notify_status === false) wantsNotify = false;
    }
    if (candidate?.telegram_id && wantsNotify) {
      await notifyStatusChange(candidate.telegram_id, status, {
        vacancyTitle: vacancy?.title,
        fullName: candidate.full_name,
        stageLabel: stage.label,
      });
    }
  }
  return NextResponse.json(data);
}
