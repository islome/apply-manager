import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireHr } from '@/lib/hr-auth';
import { dbFail, fail, isUuid, readJson } from '@/lib/hr-http';
import { parseEmployee } from '@/lib/hr-validate';

type Ctx = { params: Promise<{ id: string }> };

// Edits an employee. Switching status to 'left' / back to 'active' changes the company
// headcount through the DB trigger (supabase/008), so nothing is counted twice.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const { id } = await ctx.params;
  if (!isUuid(id)) return fail(404, 'Not found');

  const parsed = parseEmployee(await readJson(req));
  if (!parsed.ok) return fail(400, parsed.error);

  const { data, error } = await supabaseAdmin()
    .from('hired_employees')
    .update(parsed.data)
    .eq('id', id)
    .eq('hr_user_id', auth.hr.id) // someone else's employee looks like "not found"
    .select('*, candidate:candidates(username, photo_url)')
    .single();
  if (error) return dbFail(error);
  return NextResponse.json(data);
}

// Removes a record added by mistake (an active one lowers the headcount again).
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const { id } = await ctx.params;
  if (!isUuid(id)) return fail(404, 'Not found');

  const { data, error } = await supabaseAdmin()
    .from('hired_employees')
    .delete()
    .eq('id', id)
    .eq('hr_user_id', auth.hr.id)
    .select('id');
  if (error) return dbFail(error);
  if (!data?.length) return fail(404, 'Not found');
  return new NextResponse(null, { status: 204 });
}
