// One-time codes for HR sign-up / sign-in (supabase/013_hr_phone_otp.sql). Server only.
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import type { PostgrestError } from '@supabase/supabase-js';
import { SignJWT, jwtVerify } from 'jose';
import { supabaseAdmin } from './supabase-admin';
import { CODE_TTL_S, DeliveryError, SmsNotActivatedError, deliverCode, type Channel } from './otp-delivery';
import { maskPhone } from './phone';

export type Purpose = 'register' | 'login' | 'enroll';

const MAX_ATTEMPTS = 5; // wrong codes per sent code
const RESEND_AFTER_S = 60;
const MAX_SENDS = 3; // per challenge (first send + 2 resends)
const CHALLENGE_LIFE_MS = 30 * 60_000; // resend window
const PHONE_SENDS_PER_HOUR = 6;
const IP_CHALLENGES_PER_HOUR = 15;
const HOUR_MS = 3_600_000;

/**
 * HR_PHONE_CODES=on|off turns the phone code step on or off for sign-in and sign-up.
 * Unset: on in development (codes print to the server console), off in production
 * until Eskiz SMS is activated. Off means username + password only, as before.
 */
export function phoneCodesOn(): boolean {
  const v = process.env.HR_PHONE_CODES?.trim().toLowerCase();
  if (v === 'on') return true;
  if (v === 'off') return false;
  return process.env.NODE_ENV !== 'production';
}

export const MIGRATE_MSG ='Sign-in needs a database update first: run supabase/013_hr_phone_otp.sql';

/** What the login form needs to show the code step. */
export type CodeStep = {
  step: 'code';
  challengeId: string;
  channel: Channel;
  phone: string; // masked
  resendIn: number; // seconds
};

export class OtpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Table (013) or hr_users.phone column not there yet. */
export function needsMigration(error: PostgrestError | null): boolean {
  return !!error && ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(error.code);
}

export function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return fwd || req.headers.get('x-real-ip') || null;
}

/* ------------------------------------------------------------------ secrets */

function secret(): string {
  const s = process.env.HR_SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('HR_SESSION_SECRET must be set (32+ random characters)');
  return s;
}

// Separate keys per token kind, so a device or phone ticket can never pass as a session token.
const keyFor = (kind: string) => new TextEncoder().encode(`${secret()}:${kind}`);

function hashCode(challengeId: string, code: string): string {
  return createHmac('sha256', `${secret()}:otp`).update(`${challengeId}:${code}`).digest('hex');
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/* ------------------------------------------------------------ rate limiting */

async function sendsForPhone(phone: string): Promise<number> {
  const { data, error } = await supabaseAdmin()
    .from('hr_otp_challenges')
    .select('sends')
    .eq('phone', phone)
    .gte('created_at', new Date(Date.now() - HOUR_MS).toISOString());
  if (needsMigration(error)) throw new OtpError(503, MIGRATE_MSG);
  if (error) throw error;
  return (data ?? []).reduce((n, r) => n + (r.sends ?? 1), 0);
}

async function checkLimits(phone: string, ip: string | null) {
  if ((await sendsForPhone(phone)) >= PHONE_SENDS_PER_HOUR) {
    throw new OtpError(429, 'Too many codes were sent to this number. Try again in an hour.');
  }
  if (!ip) return;
  const { count, error } = await supabaseAdmin()
    .from('hr_otp_challenges')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', new Date(Date.now() - HOUR_MS).toISOString());
  if (error) throw error;
  if ((count ?? 0) >= IP_CHALLENGES_PER_HOUR) {
    throw new OtpError(429, 'Too many attempts from this network. Try again in an hour.');
  }
}

async function send(phone: string, code: string) {
  try {
    return await deliverCode(phone, code);
  } catch (e) {
    if (e instanceof SmsNotActivatedError) {
      throw new OtpError(503, 'SMS sending is not activated yet. Ask the administrator to finish the Eskiz setup.');
    }
    if (e instanceof DeliveryError) throw new OtpError(502, 'Could not send the code. Try again in a minute.');
    throw e;
  }
}

const view = (id: string, channel: Channel, phone: string): CodeStep => ({
  step: 'code',
  challengeId: id,
  channel,
  phone: maskPhone(phone),
  resendIn: RESEND_AFTER_S,
});

/* --------------------------------------------------------------- challenges */

export async function startChallenge(opts: {
  purpose: Purpose;
  phone: string;
  hrUserId?: string;
  pending?: { username: string; password_hash: string };
  ip: string | null;
}): Promise<CodeStep> {
  const db = supabaseAdmin();
  // housekeeping, best effort: nothing older than a day is useful
  await db.from('hr_otp_challenges').delete().lt('created_at', new Date(Date.now() - 24 * HOUR_MS).toISOString());

  await checkLimits(opts.phone, opts.ip);

  const id = randomUUID();
  const code = newCode();
  const delivery = await send(opts.phone, code);

  const { error } = await db.from('hr_otp_challenges').insert({
    id,
    purpose: opts.purpose,
    phone: opts.phone,
    hr_user_id: opts.hrUserId ?? null,
    pending: opts.pending ?? null,
    code_hash: hashCode(id, code),
    channel: delivery.channel,
    provider_ref: delivery.ref,
    expires_at: new Date(Date.now() + CODE_TTL_S * 1000).toISOString(),
    ip: opts.ip,
  });
  if (needsMigration(error)) throw new OtpError(503, MIGRATE_MSG);
  if (error) throw error;
  return view(id, delivery.channel, opts.phone);
}

type Row = {
  id: string;
  purpose: Purpose;
  phone: string;
  hr_user_id: string | null;
  pending: { username?: string; password_hash?: string } | null;
  code_hash: string;
  attempts: number;
  sends: number;
  last_sent_at: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

const EXPIRED = 'This code request has expired. Start again.';

async function load(id: string): Promise<Row> {
  const { data, error } = await supabaseAdmin()
    .from('hr_otp_challenges')
    .select('id, purpose, phone, hr_user_id, pending, code_hash, attempts, sends, last_sent_at, expires_at, consumed_at, created_at')
    .eq('id', id)
    .maybeSingle();
  if (needsMigration(error)) throw new OtpError(503, MIGRATE_MSG);
  if (error) throw error;
  if (!data || data.consumed_at || Date.now() - Date.parse(data.created_at) > CHALLENGE_LIFE_MS) {
    throw new OtpError(410, EXPIRED);
  }
  return data as Row;
}

export async function resendChallenge(id: string): Promise<CodeStep> {
  const row = await load(id);
  if (row.sends >= MAX_SENDS) throw new OtpError(429, 'No more codes for this request. Start again.');
  const wait = RESEND_AFTER_S - Math.floor((Date.now() - Date.parse(row.last_sent_at)) / 1000);
  if (wait > 0) throw new OtpError(429, `Wait ${wait} s before asking for a new code.`);
  if ((await sendsForPhone(row.phone)) >= PHONE_SENDS_PER_HOUR) {
    throw new OtpError(429, 'Too many codes were sent to this number. Try again in an hour.');
  }

  const code = newCode();
  const delivery = await send(row.phone, code);
  // compare-and-set on `sends`, so two quick clicks cannot both go through
  const { data, error } = await supabaseAdmin()
    .from('hr_otp_challenges')
    .update({
      code_hash: hashCode(id, code),
      channel: delivery.channel,
      provider_ref: delivery.ref,
      sends: row.sends + 1,
      attempts: 0,
      last_sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + CODE_TTL_S * 1000).toISOString(),
    })
    .eq('id', id)
    .eq('sends', row.sends)
    .is('consumed_at', null)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new OtpError(409, 'A new code was just sent. Check your messages.');
  return view(id, delivery.channel, row.phone);
}

/** Checks the code and uses the challenge up. Returns it (with `pending`) on success. */
export async function verifyChallenge(id: string, code: string): Promise<Row> {
  if (!/^\d{6}$/.test(code)) throw new OtpError(400, 'Enter the 6-digit code.');
  const row = await load(id);
  if (row.attempts >= MAX_ATTEMPTS) throw new OtpError(429, 'Too many wrong codes. Send a new code.');
  if (Date.parse(row.expires_at) < Date.now()) throw new OtpError(410, 'The code has expired. Send a new one.');

  const db = supabaseAdmin();
  // count the attempt first (compare-and-set), so parallel guesses cannot exceed the limit
  const { data: counted, error: countErr } = await db
    .from('hr_otp_challenges')
    .update({ attempts: row.attempts + 1 })
    .eq('id', id)
    .eq('attempts', row.attempts)
    .is('consumed_at', null)
    .select('id');
  if (countErr) throw countErr;
  if (!counted?.length) throw new OtpError(409, 'Please try again.');

  if (!sameHash(row.code_hash, hashCode(id, code))) {
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw new OtpError(400, left > 0 ? `Wrong code. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Wrong code. Send a new code.');
  }

  const { data: used, error: useErr } = await db
    .from('hr_otp_challenges')
    .update({ consumed_at: new Date().toISOString(), pending: null })
    .eq('id', id)
    .is('consumed_at', null)
    .select('id');
  if (useErr) throw useErr;
  if (!used?.length) throw new OtpError(410, EXPIRED);
  return row;
}

/* --------------------------------------------------- trusted device, tickets */

export const DEVICE_COOKIE = 'hr_device';
const DEVICE_TTL_S = 60 * 60 * 24 * 30;
const TICKET_TTL_S = 15 * 60;

async function sign(kind: string, userId: string, ttlS: number) {
  return new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime(`${ttlS}s`).sign(keyFor(kind));
}

async function verify(kind: string, token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, keyFor(kind), { algorithms: ['HS256'] });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/** "Trust this device for 30 days": the next sign-ins on this browser skip the code. */
export async function trustDevice(res: NextResponse, userId: string) {
  res.cookies.set(DEVICE_COOKIE, await sign('trusted-device', userId, DEVICE_TTL_S), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DEVICE_TTL_S,
  });
}

export async function isTrustedDevice(req: NextRequest, userId: string): Promise<boolean> {
  return (await verify('trusted-device', req.cookies.get(DEVICE_COOKIE)?.value)) === userId;
}

/** Proof that the password was right, for accounts that still have to add a phone. */
export const signPhoneTicket = (userId: string) => sign('phone-ticket', userId, TICKET_TTL_S);
export const verifyPhoneTicket = (ticket: string) => verify('phone-ticket', ticket);
