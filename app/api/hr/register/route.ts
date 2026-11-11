import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { dbFail, fail, readJson } from '@/lib/hr-http';
import { normalizePhone } from '@/lib/phone';
import { createSession } from '@/lib/hr-auth';
import { MIGRATE_MSG, clientIp, needsMigration, phoneCodesOn, startChallenge } from '@/lib/otp';
import { otpFail } from '@/lib/otp-http';

// POST {username, password, phone} -> { step: 'code', ... }
// Nothing is created yet: the account appears only after the code is confirmed (/api/hr/otp/verify).
// With codes paused (HR_PHONE_CODES) -> { ok: true }, signed in, phone ignored.
export async function POST(req: NextRequest) {
  const body = (await readJson(req)) as { username?: unknown; password?: unknown; phone?: unknown } | null;
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const phone = typeof body?.phone === 'string' ? normalizePhone(body.phone) : null;

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return fail(400, 'Username must be 3-32 characters: lowercase letters, digits, dot, dash or underscore.');
  }
  if (password.length < 8 || password.length > 200) {
    return fail(400, 'Password must be between 8 and 200 characters.');
  }
  if (!phoneCodesOn()) return createWithoutPhone(username, password);
  if (!phone) return fail(400, 'Enter an Uzbek phone number, for example +998 90 123 45 67.');

  const { data: taken, error } = await supabaseAdmin()
    .from('hr_users')
    .select('username, phone')
    .or(`username.eq.${username},phone.eq.${phone}`)
    .limit(2);
  if (needsMigration(error)) return fail(503, MIGRATE_MSG);
  if (error) return dbFail(error);
  if (taken?.some((u) => u.username === username)) return fail(409, 'That username is already registered.');
  if (taken?.some((u) => u.phone === phone)) return fail(409, 'This phone number is already linked to another account.');

  try {
    const password_hash = await bcrypt.hash(password, 12);
    return NextResponse.json(
      await startChallenge({ purpose: 'register', phone, pending: { username, password_hash }, ip: clientIp(req) }),
    );
  } catch (e) {
    return otpFail(e, 'hr-register');
  }
}

// Codes paused: the account is created straight away, with no phone. When codes are switched
// on later, its next sign-in asks for a phone number once (/api/hr/otp/phone).
async function createWithoutPhone(username: string, password: string) {
  const password_hash = await bcrypt.hash(password, 12);
  const { data, error } = await supabaseAdmin()
    .from('hr_users')
    .insert({ username, password_hash, is_active: true })
    .select('id')
    .single();
  if (error?.code === '23505') return fail(409, 'That username is already registered.');
  if (error || !data) {
    console.error('[hr-register] user creation failed', error);
    return fail(500, 'Could not create account.');
  }
  const res = NextResponse.json({ ok: true }, { status: 201 });
  await createSession(res, data.id);
  return res;
}
