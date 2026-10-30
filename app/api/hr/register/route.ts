import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSession } from '@/lib/hr-auth';
import { fail, readJson } from '@/lib/hr-http';

export async function POST(req: NextRequest) {
  const body = (await readJson(req)) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return fail(400, 'Username must be 3-32 characters: lowercase letters, digits, dot, dash or underscore.');
  }
  if (password.length < 8 || password.length > 200) {
    return fail(400, 'Password must be between 8 and 200 characters.');
  }

  const password_hash = await bcrypt.hash(password, 12);
  const { data, error } = await supabaseAdmin()
    .from('hr_users')
    .insert({ username, password_hash, is_active: true })
    .select('id')
    .single();

  if (error?.code === '23505') {
    return fail(409, 'That username is already registered.');
  }
  if (error) {
    console.error('[hr-register] user creation failed', error);
    return fail(500, 'Could not create account.');
  }
  if (!data) {
    console.error('[hr-register] user creation returned no user');
    return fail(500, 'Could not create account.');
  }

  const res = NextResponse.json({ ok: true }, { status: 201 });
  await createSession(res, data.id);
  return res;
}
