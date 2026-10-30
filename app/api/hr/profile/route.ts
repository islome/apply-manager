import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireHr } from '@/lib/hr-auth';
import { dbFail, fail, readJson } from '@/lib/hr-http';
import { parseProfile } from '@/lib/hr-validate';


// GET -> the HR's company profile, or null if they have not saved one yet
export async function GET(req: NextRequest) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;
  const { hr } = auth;

  if (!hr.profile_id) return NextResponse.json(null);

  const { data, error } = await supabaseAdmin()
    .from('hr_profiles')
    .select('*')
    .eq('id', hr.profile_id)
    .maybeSingle();
  if (error) return dbFail(error);
  return NextResponse.json(data ?? null);
}

// PUT -> upsert: updates the linked profile, or creates one and links it to this HR user
export async function PUT(req: NextRequest) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;
  const { hr } = auth;

  const parsed = parseProfile(await readJson(req));
  if (!parsed.ok) return fail(400, parsed.error);

  const sb = supabaseAdmin();

  if (hr.profile_id) {
    const { data, error } = await sb
      .from('hr_profiles')
      .update(parsed.data)
      .eq('id', hr.profile_id)
      .select()
      .single();
    if (error) return dbFail(error);
    return NextResponse.json(data);
  }

  const { data: created, error: insertError } = await sb
    .from('hr_profiles')
    .insert(parsed.data)
    .select()
    .single();
  if (insertError) return dbFail(insertError);

  const { error: linkError } = await sb
    .from('hr_users')
    .update({ profile_id: created.id })
    .eq('id', hr.id);
  if (linkError) {
    await sb.from('hr_profiles').delete().eq('id', created.id); // don't leave an orphan behind
    return dbFail(linkError);
  }
  return NextResponse.json(created);
}
