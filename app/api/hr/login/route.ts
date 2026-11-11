import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSession } from '@/lib/hr-auth';
import { dbFail, fail, readJson } from '@/lib/hr-http';
import {
  MIGRATE_MSG,
  clientIp,
  isTrustedDevice,
  needsMigration,
  phoneCodesOn,
  signPhoneTicket,
  startChallenge,
} from '@/lib/otp';
import { otpFail } from '@/lib/otp-http';

// Compared against when the username does not exist, so "no such user" and "wrong password"
// take about the same time.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// POST {username, password} -> the password is step one. Then:
//   { ok: true }                    trusted device: signed in
//   { step: 'code', ... }           a code went to the saved phone -> /api/hr/otp/verify
//   { step: 'phone', ticket }       account has no phone yet -> /api/hr/otp/phone
export async function POST(req: NextRequest) {
  const body = (await readJson(req)) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!username || !password || password.length > 200) {
    return fail(400, 'Enter username and password');
  }

  const { data, error } = await supabaseAdmin()
    .from('hr_users')
    .select('id, password_hash, is_active, phone')
    .eq('username', username)
    .maybeSingle();
  if (needsMigration(error)) return fail(503, MIGRATE_MSG);
  if (error) return dbFail(error);

  const ok = await bcrypt.compare(password, data?.password_hash ?? DUMMY_HASH);
  if (!data || !data.is_active || !ok) return fail(401, 'Wrong username or password');

  // codes paused (HR_PHONE_CODES): the password is enough
  if (!phoneCodesOn() || (data.phone && (await isTrustedDevice(req, data.id)))) {
    const res = NextResponse.json({ ok: true });
    await createSession(res, data.id);
    return res;
  }

  if (!data.phone) {
    return NextResponse.json({ step: 'phone', ticket: await signPhoneTicket(data.id) });
  }

  try {
    return NextResponse.json(
      await startChallenge({ purpose: 'login', phone: data.phone, hrUserId: data.id, ip: clientIp(req) }),
    );
  } catch (e) {
    return otpFail(e, 'hr-login');
  }
}
