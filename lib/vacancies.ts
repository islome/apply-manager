// Shared by the vacancies page and anything else that shows a vacancy.
// Shape = the `vacancies` table + applications_count added by GET /api/vacancies.
import { apiJson } from './api-client';

export type EmploymentType = 'full_time' | 'part_time' | 'remote' | 'internship';
export type Currency = 'UZS' | 'USD';

export type Vacancy = {
  id: string;
  title: string;
  company: string;
  city: string;
  major: string;
  employment_type: EmploymentType;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: Currency;
  description: string;
  requirements: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  applications_count: number;
};

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time: "To'liq kun",
  part_time: 'Yarim kun',
  remote: 'Masofaviy',
  internship: 'Amaliyot',
};

export function employmentLabel(type: EmploymentType): string {
  return EMPLOYMENT_LABELS[type] ?? type;
}

function money(n: number, cur: Currency): string {
  const s = n.toLocaleString('en-US').replace(/,/g, ' ');
  return cur === 'USD' ? `$${s}` : s;
}

/** "5 000 000 – 8 000 000 so'm", "$800 dan", "Kelishiladi" ... */
export function salaryLabel(v: Pick<Vacancy, 'salary_min' | 'salary_max' | 'salary_currency'>): string {
  const { salary_min: min, salary_max: max, salary_currency: cur } = v;
  const unit = cur === 'USD' ? '' : " so'm";
  if (min == null && max == null) return 'Kelishiladi';
  if (min != null && max != null) {
    return (min === max ? money(min, cur) : `${money(min, cur)} – ${money(max, cur)}`) + unit;
  }
  if (min != null) return `${money(min, cur)} dan${unit}`;
  return `${money(max as number, cur)} gacha${unit}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ApiError now lives in api-client.ts; re-exported so existing imports keep working.
export { ApiError } from './api-client';

/** Throws ApiError. Cookies are sent automatically (same origin), so the HR session just works. */
export function fetchVacancies(opts: { active?: boolean; signal?: AbortSignal } = {}): Promise<Vacancy[]> {
  const qs = opts.active === undefined ? '' : `?active=${opts.active}`;
  return apiJson<Vacancy[]>(`/api/vacancies${qs}`, { signal: opts.signal });
}
