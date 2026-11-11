import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSession } from '@/lib/hr-auth';
import { fail, isUuid, readJson } from '@/lib/hr-http';
import { trustDevice, verifyChallenge } from '@/lib/otp';
import { otpFail } from '@/lib/otp-http';

const RESTART = 'Your sign-in expired. Start again.';

// POST {challengeId, code, remember?} -> { ok: true } + session cookie.
// register: creates the account; login: signs in; enroll: saves the phone, then signs in.
export async function POST(req: NextRequest) {
  const body = (await readJson(req)) as { challengeId?: unknown; code?: unknown; remember?: unknown } | null;
  const id = typeof body?.challengeId === 'string' ? body.challengeId : '';
  const code = typeof body?.code === 'string' ? body.code.replace(/\s/g, '') : '';
  if (!isUuid(id)) return fail(400, RESTART);

  let ch: Awaited<ReturnType<typeof verifyChallenge>>;
  try {
    ch = await verifyChallenge(id, code);
  } catch (e) {
    return otpFail(e, 'hr-otp-verify');
  }

  const db = supabaseAdmin();
  let userId: string;
  let status = 200;

  if (ch.purpose === 'register') {
    const { username, password_hash } = ch.pending ?? {};
    if (!username || !password_hash) return fail(400, RESTART);
    const { data, error } = await db
      .from('hr_users')
      .insert({ username, password_hash, phone: ch.phone, is_active: true })
      .select('id')
      .single();
    if (error?.code === '23505') return fail(409, 'That username or phone number was registered meanwhile. Start again.');
    if (error || !data) {
      console.error('[hr-otp-verify] user creation failed', error);
      return fail(500, 'Could not create account.');
    }
    userId = data.id;
    status = 201;
  } else {
    if (!ch.hr_user_id) return fail(400, RESTART);
    const { data: user, error } = await db.from('hr_users').select('id, is_active, phone').eq('id', ch.hr_user_id).maybeSingle();
    if (error) {
      console.error('[hr-otp-verify] user lookup failed', error);
      return fail(500, 'Something went wrong. Try again.');
    }
    if (!user?.is_active) return fail(401, RESTART);

    if (ch.purpose === 'login') {
      // the phone was changed after the code went out
      if (user.phone !== ch.phone) return fail(401, RESTART);
    } else {
      const { data: saved, error: saveErr } = await db
        .from('hr_users')
        .update({ phone: ch.phone })
        .eq('id', user.id)
        .is('phone', null)
        .select('id');
      if (saveErr?.code === '23505') return fail(409, 'This phone number is already linked to another account.');
      if (saveErr) {
        console.error('[hr-otp-verify] saving phone failed', saveErr);
        return fail(500, 'Something went wrong. Try again.');
      }
      if (!saved?.length && user.phone !== ch.phone) return fail(409, RESTART);
    }
    userId = user.id;
  }

  const res = NextResponse.json({ ok: true }, { status });
  await createSession(res, userId);
  if (body?.remember === true) await trustDevice(res, userId);
  return res;
}
