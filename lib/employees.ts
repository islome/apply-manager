// Hired employees: data model + helpers. Source: GET /api/hr/employees (supabase/008).

import { apiJson } from './api-client';
import type { TFunction } from '@/i18n/LanguageProvider';

export type EmployeeStatus = 'active' | 'left';
export type EmployeeCurrency = 'UZS' | 'USD';

export type Employee = {
  id: string;
  application_id: string;
  candidate_id: string | null;
  full_name: string;
  phone: string | null;
  position: string | null;
  department: string | null;
  salary: number | null;
  salary_currency: EmployeeCurrency;
  hired_at: string; // YYYY-MM-DD
  status: EmployeeStatus;
  left_at: string | null; // YYYY-MM-DD
  notes: string | null;
  created_at: string;
  updated_at: string;
  candidate?: { username: string | null; photo_url: string | null } | null;
};

export type EmployeePatch = Partial<
  Pick<Employee, 'full_name' | 'phone' | 'position' | 'department' | 'salary' | 'salary_currency' | 'hired_at' | 'status' | 'left_at' | 'notes'>
>;

export function fetchEmployees(signal?: AbortSignal): Promise<Employee[]> {
  return apiJson<Employee[]>('/api/hr/employees', { signal }).then((rows) => (Array.isArray(rows) ? rows : []));
}

export function updateEmployee(id: string, patch: EmployeePatch): Promise<Employee> {
  return apiJson<Employee>(`/api/hr/employees/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });
}

/** "5 000 000 so'm" / "$800" / "—" */
export function employeeSalary(e: Pick<Employee, 'salary' | 'salary_currency'>, t: TFunction): string {
  if (e.salary == null) return '—';
  const s = Math.round(e.salary).toLocaleString('en-US').replace(/,/g, ' ');
  return e.salary_currency === 'USD' ? `$${s}` : `${s}${t('salary.unit')}`;
}

/** Local YYYY-MM-DD for <input type="date">. */
export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "12 d" / "5 mo" / "1 y 3 mo" from the hire date until the leaving date (or now). */
export function tenureLabel(e: Pick<Employee, 'hired_at' | 'left_at' | 'status'>, t: TFunction, now: number): string {
  const start = new Date(e.hired_at).getTime();
  const end = e.status === 'left' && e.left_at ? new Date(e.left_at).getTime() : now;
  if (Number.isNaN(start) || Number.isNaN(end)) return '';
  const days = Math.max(0, Math.floor((end - start) / 86_400_000));
  if (days < 30) return t('emp.tenureDays', { n: days });
  const months = Math.floor(days / 30.4375);
  if (months < 12) return t('emp.tenureMonths', { n: months });
  return t('emp.tenureYears', { y: Math.floor(months / 12), m: months % 12 });
}
