import { SignJWT, jwtVerify } from 'jose';

// Pure token helpers (no database): safe to import from proxy.ts as well as from route handlers.

export const SESSION_COOKIE = 'hr_session';
export const SESSION_TTL_S = 60 * 60 * 24 * 7; // 7 days

function sessionKey(): Uint8Array {
  const s = process.env.HR_SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('HR_SESSION_SECRET must be set (32+ random characters)');
  return new TextEncoder().encode(s);
}

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_S}s`)
    .sign(sessionKey());
}

/**
 * Returns the user id if the token is genuine and not expired, otherwise null.
 * A missing/short secret throws on purpose: a misconfigured server should fail loudly (500),
 * not quietly treat everybody as logged out.
 */
export async function verifySession(token: string): Promise<string | null> {
  const key = sessionKey();
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
