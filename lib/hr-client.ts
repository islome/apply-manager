import { LOGIN_PATH } from './hr-redirect';

/**
 * Wire this to the Logout button in DashboardShell:
 *   <button onClick={hrLogout}>Logout</button>
 * It clears the session cookie on the server, then does a full navigation to /login.
 */
export async function hrLogout(): Promise<void> {
  try {
    await fetch('/api/hr/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    /* even if the request failed, still leave; the proxy sends them back if the cookie survived */
  }
  window.location.assign(LOGIN_PATH);
}
