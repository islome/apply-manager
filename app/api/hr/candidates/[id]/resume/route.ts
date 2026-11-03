import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireHr } from '@/lib/hr-auth';
import { dbFail, fail, isUuid } from '@/lib/hr-http';
import { ownVacancyIds } from '@/lib/hr-scope';


type Ctx = { params: Promise<{ id: string }> };

// :id is the CANDIDATE id (the panel sends application.candidate_id).
// The bucket is private, so we hand out a short-lived signed URL.
export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const { id } = await ctx.params;
  if (!isUuid(id)) return fail(404, 'Not found');

  const sb = supabaseAdmin();

  // Faqat o'z vakansiyasiga ariza topshirgan nomzodning rezyumesi
  const own = await ownVacancyIds(sb, auth.hr.id);
  if (own.error) return dbFail(own.error as Parameters<typeof dbFail>[0]);
  if (own.ids.length === 0) return fail(404, 'Not found');
  const { data: applied, error: appliedError } = await sb
    .from('applications')
    .select('id')
    .eq('candidate_id', id)
    .in('vacancy_id', own.ids)
    .limit(1);
  if (appliedError) return dbFail(appliedError);
  if (!applied?.length) return fail(404, 'Not found');

  const { data: candidate, error } = await sb
    .from('candidates')
    .select('resume_path')
    .eq('id', id)
    .maybeSingle();
  if (error) return dbFail(error);
  if (!candidate?.resume_path) return fail(404, 'No resume uploaded');

  const { data: signed, error: signError } = await sb.storage
    .from('candidate-resumes')
    .createSignedUrl(candidate.resume_path, 60);
  if (signError || !signed) {
    console.error('[hr-api] resume signed url failed', signError);
    return fail(500, 'Could not create the resume link');
  }
  return NextResponse.json({ url: signed.signedUrl });
}
