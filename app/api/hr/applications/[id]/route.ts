import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireHr } from '@/lib/hr-auth';
import { dbFail, fail, isUuid, readJson } from '@/lib/hr-http';
import { APPLICATION_STATUSES } from '@/lib/hr-validate';


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

  const { data, error } = await supabaseAdmin()
    .from('applications')
    .update({ status })
    .eq('id', id)
    .select('id, status')
    .single();
  if (error) return dbFail(error);
  return NextResponse.json(data);
}
