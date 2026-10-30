// Server-side validation. Mirrors the DB check constraints, so the panel gets a clear message
// instead of a generic "check constraint" error. Unknown keys in the body are ignored.

export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'remote', 'internship'] as const;
export const CURRENCIES = ['UZS', 'USD'] as const;
export const APPLICATION_STATUSES = ['new', 'confirmed', 'interview', 'hired', 'cancel'] as const;

const MAX_INT = 2147483647; // Postgres integer

type Ok<T> = { ok: true; data: T };
type Bad = { ok: false; error: string };
const bad = (error: string): Bad => ({ ok: false, error });

function str(v: unknown): string | null {
  return typeof v === 'string' ? v.trim() : null;
}
function oneOf<T extends readonly string[]>(list: T, v: unknown): v is T[number] {
  return typeof v === 'string' && (list as readonly string[]).includes(v);
}

export type VacancyInput = {
  title?: string;
  city?: string;
  major?: string;
  employment_type?: (typeof EMPLOYMENT_TYPES)[number];
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: (typeof CURRENCIES)[number];
  description?: string;
  requirements?: string | null;
  is_active?: boolean;
};

/** full = true for POST (all required fields must be present), false for PATCH (partial). */
export function parseVacancy(body: unknown, full: boolean): Ok<VacancyInput> | Bad {
  if (!body || typeof body !== 'object') return bad('Invalid request body');
  const b = body as Record<string, unknown>;
  const out: VacancyInput = {};
  const need = (k: string) => full || k in b;

  if (need('title')) {
    const t = str(b.title);
    if (!t || t.length < 2 || t.length > 120) return bad('Title must be 2–120 characters');
    out.title = t;
  }
  if (need('city')) {
    const c = str(b.city);
    if (!c || c.length > 80) return bad('City is required');
    out.city = c;
  }
  if (need('major')) {
    const m = str(b.major);
    if (!m || m.length > 100) return bad('Major is required');
    out.major = m;
  }
  if (need('description')) {
    const d = str(b.description);
    if (!d || d.length > 4000) return bad('Description is required (max 4000 characters)');
    out.description = d;
  }

  if ('employment_type' in b) {
    if (!oneOf(EMPLOYMENT_TYPES, b.employment_type)) return bad('Invalid employment type');
    out.employment_type = b.employment_type;
  } else if (full) out.employment_type = 'full_time';

  if ('salary_currency' in b) {
    if (!oneOf(CURRENCIES, b.salary_currency)) return bad('Invalid currency');
    out.salary_currency = b.salary_currency;
  } else if (full) out.salary_currency = 'UZS';

  for (const k of ['salary_min', 'salary_max'] as const) {
    if (k in b) {
      const v = b[k];
      if (v === null) out[k] = null;
      else if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_INT) out[k] = v;
      else return bad('Salary must be a whole number');
    } else if (full) out[k] = null;
  }
  if (out.salary_min != null && out.salary_max != null && out.salary_max < out.salary_min) {
    return bad('Maximum salary cannot be lower than minimum');
  }

  if ('requirements' in b) {
    if (b.requirements === null) out.requirements = null;
    else {
      const r = str(b.requirements);
      if (r === null || r.length > 4000) return bad('Requirements are too long (max 4000 characters)');
      out.requirements = r || null;
    }
  } else if (full) out.requirements = null;

  if ('is_active' in b) {
    if (typeof b.is_active !== 'boolean') return bad('is_active must be true or false');
    out.is_active = b.is_active;
  } else if (full) out.is_active = true;

  if (!full && Object.keys(out).length === 0) return bad('Nothing to update');
  return { ok: true, data: out };
}

export type ProfileInput = {
  company_name: string;
  logo_url: string | null;
  employees: number;
  hr_name: string | null;
  hr_phone: string | null;
};

export function parseProfile(body: unknown): Ok<ProfileInput> | Bad {
  if (!body || typeof body !== 'object') return bad('Invalid request body');
  const b = body as Record<string, unknown>;

  const company_name = str(b.company_name);
  if (!company_name || company_name.length < 2 || company_name.length > 80) {
    return bad('Company name must be 2–80 characters');
  }

  let logo_url: string | null = null;
  if (b.logo_url != null && b.logo_url !== '') {
    const u = str(b.logo_url);
    if (!u) return bad('Invalid logo URL');
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return bad('Logo URL must start with http:// or https://');
    } catch {
      return bad('Invalid logo URL');
    }
    logo_url = u;
  }

  const employees = b.employees;
  if (typeof employees !== 'number' || !Number.isInteger(employees) || employees < 0 || employees > MAX_INT) {
    return bad('Employees must be a whole number');
  }

  let hr_name: string | null = null;
  if (b.hr_name != null && b.hr_name !== '') {
    const n = str(b.hr_name);
    if (!n || n.length > 80) return bad('HR name is too long (max 80 characters)');
    hr_name = n;
  }

  let hr_phone: string | null = null;
  if (b.hr_phone != null && b.hr_phone !== '') {
    const p = str(b.hr_phone);
    if (!p || !/^\+998[0-9]{9}$/.test(p)) return bad('Phone must look like +998901234567');
    hr_phone = p;
  }

  return { ok: true, data: { company_name, logo_url, employees, hr_name, hr_phone } };
}
