import type { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase-admin';
import { fail, isUuid } from './hr-http';
import { SESSION_COOKIE, SESSION_TTL_S, signSession, verifySession } from './hr-session';

export { SESSION_COOKIE };

export type HrUser = { id: string; username: string; profile_id: string | null };

export async function createSession(res: NextResponse, userId: string): Promise<void> {
  res.cookies.set(SESSION_COOKIE, await signSession(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_S,
  });
}

export function clearSession(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

/** Verifies the cookie AND re-checks the user in the DB, so disabling a user logs them out. */
export async function getHr(req: NextRequest): Promise<HrUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sub = await verifySession(token);
  if (!sub || !isUuid(sub)) return null;

  const { data } = await supabaseAdmin()
    .from('hr_users')
    .select('id, username, profile_id, is_active')
    .eq('id', sub)
    .maybeSingle();
  if (!data || !data.is_active) return null;
  return { id: data.id, username: data.username, profile_id: data.profile_id };
}

/**
 * Usage:
 *   const auth = await requireHr(req);
 *   if ('res' in auth) return auth.res;
 *   const { hr } = auth;
 *
 * When a cookie was sent but is no longer valid (user disabled/deleted, bad token), the 401
 * also clears it. Without that, proxy.ts (which only checks the token signature) would keep
 * bouncing the browser between /login and /dashboard.
 */
export async function requireHr(req: NextRequest): Promise<{ hr: HrUser } | { res: NextResponse }> {
  const hr = await getHr(req);
  if (hr) return { hr };

  const res = fail(401, 'Not authorized');
  if (req.cookies.has(SESSION_COOKIE)) clearSession(res);
  return { res };
}

export async function getCompanyName(hr: HrUser): Promise<string | null> {
  if (!hr.profile_id) return null;
  const { data } = await supabaseAdmin()
    .from('hr_profiles')
    .select('company_name')
    .eq('id', hr.profile_id)
    .maybeSingle();
  return data?.company_name ?? null;
}
