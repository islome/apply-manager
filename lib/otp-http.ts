import { NextResponse } from 'next/server';
import { fail } from './hr-http';
import { OtpError } from './otp';

/** Turns OtpError into its response; anything else is logged as a 500. */
export function otpFail(e: unknown, where: string): NextResponse {
  if (e instanceof OtpError) return fail(e.status, e.message);
  console.error(`[${where}]`, e);
  return fail(500, 'Something went wrong. Try again.');
}
