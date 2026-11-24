import { NextRequest, NextResponse } from 'next/server';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireHr } from '@/lib/hr-auth';
import { dbFail } from '@/lib/hr-http';
import { ownVacancyIds } from '@/lib/hr-scope';
import { isMissingTable } from '@/lib/hr-stages';
import { CURRENCIES, type AnalyticsApplication, type AnalyticsData, type AnalyticsEmployee, type Currency, type TopEarner } from '@/lib/analytics';

const PAGE = 1000; // PostgREST returns at most 1000 rows per request

type PageResult<T> = { data: T[] | null; error: PostgrestError | null };

/** Reads every page of a query (`page(from, to)` builds it with .range()). */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<PageResult<T>>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return { rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return { rows, error: null };
  }
}

// GET -> AnalyticsData: the facts the Analytics page counts, for the signed-in HR only.
// Mostly anonymous: dates, sources, stages and salaries. The only names are the 3 best-paid
// people per currency (salaries the HR already sees on the Employees page). Never phones.
export async function GET(req: NextRequest) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;
  const sb = supabaseAdmin();

  const [profile, employees, own] = await Promise.all([
    auth.hr.profile_id
      ? sb.from('hr_profiles').select('employees').eq('id', auth.hr.profile_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    readAll<AnalyticsEmployee>((from, to) =>
      sb
        .from('hired_employees')
        .select('source, hired_at, status, left_at, salary, salary_currency')
        .eq('hr_user_id', auth.hr.id)
        .order('id')
        .range(from, to),
    ),
    ownVacancyIds(sb, auth.hr.id),
  ]);
  if (profile.error) return dbFail(profile.error);
  if (employees.error) return dbFail(employees.error);
  if (own.error) return dbFail(own.error as PostgrestError);

  type AppRow = { id: string; created_at: string; status: string; cancelled_by: 'candidate' | 'hr' | null };
  type EventRow = { application_id: string; to_status: string; backfilled: boolean; created_at: string };

  // the 3 best-paid active people per currency (salaries in different currencies are never compared)
  const topQuery = (currency: Currency) =>
    sb
      .from('hired_employees')
      .select('id, full_name, position, salary, salary_currency, candidate:candidates(photo_url)')
      .eq('hr_user_id', auth.hr.id)
      .eq('status', 'active')
      .eq('salary_currency', currency)
      .not('salary', 'is', null)
      .order('salary', { ascending: false })
      .order('full_name')
      .limit(3);

  const [apps, events, ...tops] = await Promise.all([
    own.ids.length
      ? readAll<AppRow>((from, to) =>
          sb
            .from('applications')
            .select('id, created_at, status, cancelled_by')
            .in('vacancy_id', own.ids)
            .order('id')
            .range(from, to),
        )
      : Promise.resolve({ rows: [] as AppRow[], error: null }),
    readAll<EventRow>((from, to) =>
      sb
        .from('application_events')
        .select('application_id, to_status, backfilled, created_at')
        .eq('hr_user_id', auth.hr.id)
        .order('id')
        .range(from, to),
    ),
    ...CURRENCIES.map(topQuery),
  ]);
  if (apps.error) return dbFail(apps.error);
  const topEarners = {} as AnalyticsData['topEarners'];
  for (const [i, currency] of CURRENCIES.entries()) {
    const { data, error } = tops[i];
    if (error) return dbFail(error);
    topEarners[currency] = (data ?? []).map(({ candidate, ...e }) => ({
      ...e,
      salary: Number(e.salary),
      photo_url: (Array.isArray(candidate) ? candidate[0] : candidate)?.photo_url ?? null,
    })) as TopEarner[];
  }
  const history = !isMissingTable(events.error);
  if (events.error && history) return dbFail(events.error);

  // per application: stages it has been in, and the first time it was hired
  const byApp = new Map<string, { reached: Set<string>; hired: EventRow | null }>();
  for (const e of history ? events.rows : []) {
    let entry = byApp.get(e.application_id);
    if (!entry) byApp.set(e.application_id, (entry = { reached: new Set(), hired: null }));
    entry.reached.add(e.to_status);
    if (e.to_status === 'hired' && (!entry.hired || e.created_at < entry.hired.created_at)) entry.hired = e;
  }

  const applications: AnalyticsApplication[] = apps.rows.map((a) => {
    const entry = byApp.get(a.id);
    const hired = a.status === 'hired' ? (entry?.hired ?? null) : null; // moved back out = not a hire
    return {
      created_at: a.created_at,
      status: a.status || 'new',
      cancelled_by: a.cancelled_by ?? null,
      reached: entry ? [...entry.reached] : [],
      hired_at: hired?.created_at ?? null,
      hired_approx: hired?.backfilled ?? false,
    };
  });

  const body: AnalyticsData = {
    headcount: typeof profile.data?.employees === 'number' ? profile.data.employees : null,
    employees: employees.rows.map((e) => ({ ...e, salary: e.salary == null ? null : Number(e.salary) })),
    applications,
    topEarners,
    history,
  };
  return NextResponse.json(body);
}
