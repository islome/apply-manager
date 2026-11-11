import { NextRequest, NextResponse } from 'next/server';
import { fail, isUuid, readJson } from '@/lib/hr-http';
import { resendChallenge } from '@/lib/otp';
import { otpFail } from '@/lib/otp-http';

// POST {challengeId} -> { step: 'code', ... } with a fresh code (60 s apart, 2 resends max)
export async function POST(req: NextRequest) {
  const body = (await readJson(req)) as { challengeId?: unknown } | null;
  const id = typeof body?.challengeId === 'string' ? body.challengeId : '';
  if (!isUuid(id)) return fail(400, 'Start again.');
  try {
    return NextResponse.json(await resendChallenge(id));
  } catch (e) {
    return otpFail(e, 'hr-otp-resend');
  }
}
