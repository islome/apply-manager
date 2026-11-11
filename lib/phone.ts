// Phone numbers in E.164 (+998901234567). Shared by the login form and the API.

const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Accepts what people type: "+998 90 123-45-67", "998901234567", "90 123 45 67" (9 digits = Uzbekistan).
 * Returns E.164 for an Uzbek number, otherwise null.
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  let e164: string;
  if (trimmed.startsWith('+')) e164 = `+${digits}`;
  else if (digits.length === 9) e164 = `+998${digits}`;
  else if (digits.startsWith('00')) e164 = `+${digits.slice(2)}`;
  else e164 = `+${digits}`;
  if (!E164.test(e164)) return null;
  // codes go out through Eskiz SMS, which only reaches Uzbek numbers: +998 and 9 more digits
  return isUzbekPhone(e164) ? e164 : null;
}

export function isUzbekPhone(e164: string): boolean {
  return /^\+998\d{9}$/.test(e164);
}

/** "+998 90 *** ** 67": enough for the HR to recognise the number, not enough to leak it. */
export function maskPhone(e164: string): string {
  if (isUzbekPhone(e164)) return `+998 ${e164.slice(4, 6)} *** ** ${e164.slice(-2)}`;
  return `${e164.slice(0, 4)} *** ${e164.slice(-2)}`;
}
