export const LOGIN_PATH = '/login';
export const DEFAULT_AFTER_LOGIN = '/dashboard'; // where HR lands after signing in (your overview page)

/**
 * `?next=` comes from the URL, so it is untrusted. Only same-site, in-app paths are allowed;
 * anything else (other sites, protocol-relative //evil.com, backslash tricks, /api, the login
 * page itself) falls back to the default.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_AFTER_LOGIN;
  if (!raw.startsWith('/') || raw.startsWith('//')) return DEFAULT_AFTER_LOGIN;
  if (raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) return DEFAULT_AFTER_LOGIN;

  const path = raw.split(/[?#]/)[0];
  if (path === LOGIN_PATH || path.startsWith(`${LOGIN_PATH}/`)) return DEFAULT_AFTER_LOGIN;
  if (path === '/api' || path.startsWith('/api/')) return DEFAULT_AFTER_LOGIN;
  return raw;
}
