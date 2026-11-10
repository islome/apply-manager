import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireHr } from '@/lib/hr-auth';
import { dbFail, fail } from '@/lib/hr-http';

type Ctx = { params: Promise<{ id: string }> };

// DELETE -> 204: removes one entry from this HR's log (someone else's entry looks like "not found")
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const { id } = await ctx.params;
  if (!/^\d{1,18}$/.test(id)) return fail(404, 'Not found');

  const { data, error } = await supabaseAdmin()
    .from('application_events')
    .delete()
    .eq('id', id)
    .eq('hr_user_id', auth.hr.id)
    .select('id');
  if (error) return dbFail(error);
  if (!data?.length) return fail(404, 'Not found');
  return new NextResponse(null, { status: 204 });
}
