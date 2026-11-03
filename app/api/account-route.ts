import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSession, requireHr } from '@/lib/hr-auth';
import { dbFail, fail, readJson } from '@/lib/hr-http';

// GET -> the signed-in HR's login name
export async function GET(req: NextRequest) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;
  return NextResponse.json({ username: auth.hr.username });
}

// PATCH { current_password, username? , new_password? } -> change login name and/or password.
// The current password is always required, so a stolen session cookie alone cannot take the account over.
export async function PATCH(req: NextRequest) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;
  const { hr } = auth;

  const body = (await readJson(req)) as Record<string, unknown> | null;
  if (!body) return fail(400, 'Invalid request body');

  const current = typeof body.current_password === 'string' ? body.current_password : '';
  if (!current || current.length > 200) return fail(400, 'Enter your current password.');

  const update: { username?: string; password_hash?: string } = {};

  if (body.username !== undefined) {
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return fail(400, 'Username must be 3-32 characters: lowercase letters, digits, dot, dash or underscore.');
    }
    if (username !== hr.username) update.username = username;
  }

  let newPassword: string | null = null;
  if (body.new_password !== undefined) {
    newPassword = typeof body.new_password === 'string' ? body.new_password : '';
    if (newPassword.length < 8 || newPassword.length > 200) {
      return fail(400, 'Password must be between 8 and 200 characters.');
    }
    if (newPassword === current) return fail(400, 'New password must differ from the current one.');
  }

  if (!update.username && newPassword === null) return fail(400, 'Nothing to change.');

  const sb = supabaseAdmin();
  const { data: row, error: readError } = await sb
    .from('hr_users')
    .select('password_hash')
    .eq('id', hr.id)
    .maybeSingle();
  if (readError) return dbFail(readError);
  if (!row || !(await bcrypt.compare(current, row.password_hash))) {
    return fail(403, 'Current password is wrong.');
  }

  if (newPassword !== null) update.password_hash = await bcrypt.hash(newPassword, 12);

  const { data, error } = await sb
    .from('hr_users')
    .update(update)
    .eq('id', hr.id)
    .select('username')
    .single();
  if (error?.code === '23505') return fail(409, 'That username is already taken.');
  if (error) return dbFail(error);

  const res = NextResponse.json({ ok: true, username: data.username });
  await createSession(res, hr.id); // fresh 7-day cookie
  return res;
}
