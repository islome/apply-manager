import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { dbFail, fail, readJson } from '@/lib/hr-http';
import { normalizePhone } from '@/lib/phone';
import { MIGRATE_MSG, clientIp, needsMigration, startChallenge, verifyPhoneTicket } from '@/lib/otp';
import { otpFail } from '@/lib/otp-http';

// POST {ticket, phone} -> { step: 'code', ... }
// For accounts made before phone sign-in: the ticket (from /api/hr/login) proves the password was right.
export async function POST(req: NextRequest) {
  const body = (await readJson(req)) as { ticket?: unknown; phone?: unknown } | null;
  const userId = typeof body?.ticket === 'string' ? await verifyPhoneTicket(body.ticket) : null;
  if (!userId) return fail(401, 'Your sign-in expired. Enter your password again.');
  const phone = typeof body?.phone === 'string' ? normalizePhone(body.phone) : null;
  if (!phone) return fail(400, 'Enter an Uzbek phone number, for example +998 90 123 45 67.');

  const db = supabaseAdmin();
  const { data: user, error } = await db.from('hr_users').select('id, is_active, phone').eq('id', userId).maybeSingle();
  if (needsMigration(error)) return fail(503, MIGRATE_MSG);
  if (error) return dbFail(error);
  if (!user?.is_active) return fail(401, 'Your sign-in expired. Enter your password again.');
  if (user.phone) return fail(409, 'This account already has a phone number. Sign in again.');

  const { data: other, error: otherErr } = await db.from('hr_users').select('id').eq('phone', phone).maybeSingle();
  if (otherErr) return dbFail(otherErr);
  if (other) return fail(409, 'This phone number is already linked to another account.');

  try {
    return NextResponse.json(await startChallenge({ purpose: 'enroll', phone, hrUserId: userId, ip: clientIp(req) }));
  } catch (e) {
    return otpFail(e, 'hr-otp-phone');
  }
}
