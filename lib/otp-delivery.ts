// Delivers a one-time login code by SMS through Eskiz.uz. Server only (reads secrets from the environment).
//
//   ESKIZ_EMAIL / ESKIZ_PASSWORD   cabinet login at https://my.eskiz.uz (password = the secret key there)
//   ESKIZ_FROM                     sender name, default "4546" (Eskiz's shared number)
//   ESKIZ_SMS_TEXT                 message text with {code}; must match a template approved by Eskiz
//
// Without ESKIZ_EMAIL / ESKIZ_PASSWORD, development builds print the code to the server console.

import { isUzbekPhone } from './phone';

export type Channel = 'sms' | 'dev';
export type Delivery = { channel: Channel; ref: string | null };

export class DeliveryError extends Error {}
/** Eskiz account still in test status: only its fixed test texts go out until a template is approved. */
export class SmsNotActivatedError extends DeliveryError {}

export const CODE_TTL_S = 300;
const TIMEOUT_MS = 8000;
const DEFAULT_SMS_TEXT = 'Apply Manager: kirish kodi {code}. Kodni hech kimga bermang.';

export function smsConfigured(): boolean {
  return !!(process.env.ESKIZ_EMAIL && process.env.ESKIZ_PASSWORD);
}

const ESKIZ = 'https://notify.eskiz.uz/api';
let eskizToken: { value: string; until: number } | null = null; // the token lives 30 days

async function eskizLogin(): Promise<string> {
  const form = new FormData();
  form.set('email', process.env.ESKIZ_EMAIL ?? '');
  form.set('password', process.env.ESKIZ_PASSWORD ?? '');
  const res = await fetch(`${ESKIZ}/auth/login`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as { data?: { token?: string }; message?: string } | null;
  const token = json?.data?.token;
  if (!res.ok || !token) throw new DeliveryError(`eskiz login failed (HTTP ${res.status}): ${json?.message ?? 'no token'}`);
  eskizToken = { value: token, until: Date.now() + 25 * 86_400_000 };
  return token;
}

async function sendSms(phone: string, code: string): Promise<string | null> {
  if (!isUzbekPhone(phone)) throw new DeliveryError('eskiz: only +998 numbers');
  const text = (process.env.ESKIZ_SMS_TEXT || DEFAULT_SMS_TEXT).replaceAll('{code}', code);

  const post = async (token: string) => {
    const form = new FormData();
    form.set('mobile_phone', phone.slice(1)); // 998901234567, no plus
    form.set('message', text);
    form.set('from', process.env.ESKIZ_FROM || '4546');
    return fetch(`${ESKIZ}/message/sms/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
  };

  let token = eskizToken && eskizToken.until > Date.now() ? eskizToken.value : await eskizLogin();
  let res = await post(token);
  if (res.status === 401) {
    token = await eskizLogin(); // expired or revoked token: log in once more
    res = await post(token);
  }
  const json = (await res.json().catch(() => null)) as { id?: string; status?: string; message?: unknown } | null;
  if (!res.ok || !json || json.status === 'error') {
    const msg = JSON.stringify(json?.message ?? json);
    // "Для теста можно использовать только один из этих текстов: ..." (test status, or text not approved)
    if (res.status === 400 && /Для теста|for test/i.test(msg)) {
      throw new SmsNotActivatedError(`eskiz account is in test status, the SMS text is not approved yet: ${msg}`);
    }
    throw new DeliveryError(`eskiz send failed (HTTP ${res.status}): ${JSON.stringify(json?.message ?? json)}`);
  }
  return json.id ?? null;
}

/** Sends the code. Throws DeliveryError when it could not go out. */
export async function deliverCode(phone: string, code: string): Promise<Delivery> {
  if (smsConfigured()) {
    try {
      return { channel: 'sms', ref: await sendSms(phone, code) };
    } catch (e) {
      console.error('[otp] delivery failed', (e as Error).message);
      if (e instanceof SmsNotActivatedError && process.env.NODE_ENV !== 'production') {
        // keep local sign-up usable until Eskiz approves the template
        console.warn(`[otp] dev fallback until the Eskiz template is approved; code for ${phone}: ${code}`);
        return { channel: 'dev', ref: null };
      }
      throw e instanceof DeliveryError ? e : new DeliveryError((e as Error).message);
    }
  }
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[otp] ESKIZ_EMAIL / ESKIZ_PASSWORD not set; dev code for ${phone}: ${code}`);
    return { channel: 'dev', ref: null };
  }
  console.error('[otp] delivery failed: ESKIZ_EMAIL / ESKIZ_PASSWORD not set');
  throw new DeliveryError('no SMS provider configured');
}
