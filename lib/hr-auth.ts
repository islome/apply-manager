import { after, type NextRequest, type NextResponse } from 'next/server';
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

// "HR is online" for candidates: every authenticated API call refreshes hr_users.last_seen_at, at most
// once a minute per server instance. Best effort: runs after the response, errors (e.g. the column
// from supabase/010 does not exist yet) are ignored.
const lastPing = new Map<string, number>();
const PING_EVERY_MS = 60_000;

function touchPresence(hrId: string) {
  const now = Date.now();
  if (now - (lastPing.get(hrId) ?? 0) < PING_EVERY_MS) return;
  lastPing.set(hrId, now);
  try {
    after(async () => {
      await supabaseAdmin().from('hr_users').update({ last_seen_at: new Date().toISOString() }).eq('id', hrId);
    });
  } catch {
    /* not inside a request scope: skip */
  }
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
  touchPresence(data.id);
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
