import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSession } from '@/lib/hr-auth';
import { dbFail, fail, readJson } from '@/lib/hr-http';


// Compared against when the username does not exist, so "no such user" and "wrong password"
// take about the same time.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export async function POST(req: NextRequest) {
  const body = (await readJson(req)) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!username || !password || password.length > 200) {
    return fail(400, 'Enter username and password');
  }

  const { data, error } = await supabaseAdmin()
    .from('hr_users')
    .select('id, password_hash, is_active')
    .eq('username', username)
    .maybeSingle();
  if (error) return dbFail(error);

  const ok = await bcrypt.compare(password, data?.password_hash ?? DUMMY_HASH);
  if (!data || !data.is_active || !ok) return fail(401, 'Wrong username or password');

  const res = NextResponse.json({ ok: true });
  await createSession(res, data.id);
  return res;
}
