import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireHr } from '@/lib/hr-auth';
import { dbFail, fail, isUuid } from '@/lib/hr-http';


type Ctx = { params: Promise<{ id: string }> };

// :id is the CANDIDATE id (the panel sends application.candidate_id).
// The bucket is private, so we hand out a short-lived signed URL.
export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const { id } = await ctx.params;
  if (!isUuid(id)) return fail(404, 'Not found');

  const sb = supabaseAdmin();
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
