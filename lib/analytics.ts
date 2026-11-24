// Analytics page: data model + pure calculations.
// Source: GET /api/hr/analytics — anonymous facts only (dates, sources, stages; no names or phones).
// Everything is counted here, in the browser, so switching the period is instant and
// months/weeks follow the HR's own time zone.

import { apiJson } from './api-client';
import type { Stage } from './stages';

/* ------------------------------------------------------------------- types */

export type AnalyticsEmployee = {
  /** 'application' = hired through the bot pipeline, 'manual' = added by the HR */
  source: 'application' | 'manual';
  hired_at: string; // YYYY-MM-DD
  status: 'active' | 'left';
  left_at: string | null; // YYYY-MM-DD
  /** monthly salary; null = not entered */
  salary: number | null;
  salary_currency: Currency;
};

export type Currency = 'UZS' | 'USD';
export const CURRENCIES: Currency[] = ['UZS', 'USD'];

/** One of the best-paid active employees (the only named rows the API sends). */
export type TopEarner = {
  id: string;
  full_name: string;
  position: string | null;
  photo_url: string | null;
  salary: number;
  salary_currency: Currency;
};

export type AnalyticsApplication = {
  created_at: string;
  status: string;
  cancelled_by: 'candidate' | 'hr' | null;
  /** every stage key the application has been moved to (from the status history) */
  reached: string[];
  /** when it was first moved to 'hired' (status history); null = never, or no history */
  hired_at: string | null;
  /** the hired time was reconstructed from older data, not logged live */
  hired_approx: boolean;
};

export type AnalyticsData = {
  /** company headcount from Settings (hr_profiles.employees); null = not set */
  headcount: number | null;
  employees: AnalyticsEmployee[];
  applications: AnalyticsApplication[];
  /** top 3 active earners per currency, best paid first */
  topEarners: Record<Currency, TopEarner[]>;
  /** false until supabase/012 (status history) has been run */
  history: boolean;
};

export function fetchAnalytics(signal?: AbortSignal): Promise<AnalyticsData> {
  return apiJson<AnalyticsData>('/api/hr/analytics', { signal });
}

export const PERIODS = [30, 90, 365] as const;
export type Period = (typeof PERIODS)[number];

/* ------------------------------------------------------------------- dates */

const DAY = 86_400_000;

/** Local YYYY-MM-DD. */
export function isoDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Days between two YYYY-MM-DD dates (b - a). */
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

/** Timestamp -> local YYYY-MM-DD ('' when invalid). */
function localDay(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : isoDay(d);
}

/** A window of days: after `from`, up to and including `to` (both YYYY-MM-DD). */
type Window = { from: string; to: string };
const inWindow = (day: string | null | undefined, w: Window) => !!day && day > w.from && day <= w.to;

/* --------------------------------------------------------------- workforce */

export type WorkforceStats = {
  /** company headcount now (Settings), or the panel's active people when it is not set */
  headcount: number;
  headcountFromSettings: boolean;
  activeBot: number;
  activeManual: number;
  /** headcount minus the people the panel knows about */
  notInPanel: number;
  /** pipeline hires in the period, and in the period before it */
  hires: number;
  hiresPrev: number;
  leavers: number;
  leaversPrev: number;
  /** leavers / average headcount × 100; null when the average is 0 */
  turnover: number | null;
  /** hires of the last 12 months that are at least 90 days old */
  earlyCohort: number;
  /** ...and of those, who left within 90 days */
  earlyLeft: number;
  earlyTurnover: number | null;
};

const isHire = (e: AnalyticsEmployee) => e.source === 'application';
const isLeaver = (e: AnalyticsEmployee) => e.status === 'left' && !!e.left_at;

export function workforceStats(data: AnalyticsData, period: Period, now: Date): WorkforceStats {
  const today = isoDay(now);
  const cur: Window = { from: isoDay(addDays(now, -period)), to: today };
  const prev: Window = { from: isoDay(addDays(now, -2 * period)), to: cur.from };
  const list = data.employees;

  const active = list.filter((e) => e.status === 'active');
  const activeBot = active.filter(isHire).length;
  const activeManual = active.length - activeBot;

  const fromSettings = typeof data.headcount === 'number' && data.headcount >= 0;
  const headcount = fromSettings ? (data.headcount as number) : active.length;

  const hires = list.filter((e) => isHire(e) && inWindow(e.hired_at, cur)).length;
  const hiresPrev = list.filter((e) => isHire(e) && inWindow(e.hired_at, prev)).length;
  const leavers = list.filter((e) => isLeaver(e) && inWindow(e.left_at, cur)).length;
  const leaversPrev = list.filter((e) => isLeaver(e) && inWindow(e.left_at, prev)).length;

  // Headcount at the start of the period: undo what happened since. Only changes the panel
  // recorded are known (hand edits in Settings are not), so this is an estimate.
  const start = Math.max(0, headcount - hires + leavers);
  const average = (start + headcount) / 2;
  const turnover = average > 0 ? (leavers / average) * 100 : null;

  // Early turnover: a fixed 12-month cohort, whatever the period, so it has enough people.
  const cohortWindow: Window = { from: isoDay(addDays(now, -365)), to: isoDay(addDays(now, -90)) };
  const cohort = list.filter((e) => isHire(e) && inWindow(e.hired_at, cohortWindow));
  const earlyLeft = cohort.filter((e) => isLeaver(e) && dayDiff(e.hired_at, e.left_at as string) <= 90).length;

  return {
    headcount,
    headcountFromSettings: fromSettings,
    activeBot,
    activeManual,
    notInPanel: Math.max(0, headcount - active.length),
    hires,
    hiresPrev,
    leavers,
    leaversPrev,
    turnover,
    earlyCohort: cohort.length,
    earlyLeft,
    earlyTurnover: cohort.length ? (earlyLeft / cohort.length) * 100 : null,
  };
}

/* ------------------------------------------------------ hires vs. leavers */

export type FlowBucket = {
  /** first day of the bucket (local) */
  start: Date;
  kind: 'week' | 'month';
  hires: number;
  leavers: number;
};

/** 12 calendar months for the 12-month period, Monday weeks otherwise (5 or 13 of them). */
export function flowSeries(data: AnalyticsData, period: Period, now: Date): FlowBucket[] {
  const starts: Date[] = [];
  let kind: FlowBucket['kind'];
  if (period === 365) {
    kind = 'month';
    for (let i = 11; i >= 0; i--) starts.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  } else {
    kind = 'week';
    const monday = addDays(now, -((now.getDay() + 6) % 7));
    const count = period === 30 ? 5 : 13;
    for (let i = count - 1; i >= 0; i--) starts.push(addDays(monday, -7 * i));
  }

  const edges = starts.map(isoDay);
  const next = kind === 'month' ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : addDays(starts[starts.length - 1], 7);
  edges.push(isoDay(next));

  const bucketOf = (day: string | null) => {
    if (!day || day < edges[0] || day >= edges[edges.length - 1]) return -1;
    for (let i = 0; i < edges.length - 1; i++) if (day < edges[i + 1]) return i;
    return -1;
  };

  const buckets: FlowBucket[] = starts.map((start) => ({ start, kind, hires: 0, leavers: 0 }));
  for (const e of data.employees) {
    if (isHire(e)) {
      const i = bucketOf(e.hired_at);
      if (i >= 0) buckets[i].hires++;
    }
    if (isLeaver(e)) {
      const i = bucketOf(e.left_at);
      if (i >= 0) buckets[i].leavers++;
    }
  }
  return buckets;
}

/* ------------------------------------------------------------ hiring funnel */

export type FunnelStep = {
  stage: Stage;
  /** applications of the period that got to this stage or any later one */
  reached: number;
  /** share of everyone who applied */
  ofApplied: number;
  /** share of the previous step; null for the first step */
  ofPrevious: number | null;
};

export type FunnelStats = {
  applied: number;
  steps: FunnelStep[];
  /** index of the step with the biggest relative drop from the step before it */
  biggestDrop: number | null;
  rejected: number;
  withdrawn: number;
  inProgress: number;
  /** median days from applying to 'hired', for hires made in the period */
  timeToHire: number | null;
  timeToHireSample: number;
  /** some of those hire times were reconstructed from older data */
  timeToHireApprox: boolean;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function funnelStats(data: AnalyticsData, stages: Stage[], period: Period, now: Date): FunnelStats {
  const cur: Window = { from: isoDay(addDays(now, -period)), to: isoDay(now) };
  const path = stages.filter((s) => s.key !== 'cancel'); // board order: new, custom..., hired
  const index = new Map(path.map((s, i) => [s.key, i]));

  const apps = data.applications.filter((a) => inWindow(localDay(a.created_at), cur));
  const furthest = apps.map((a) => {
    let best = 0; // everyone has applied
    for (const key of [...a.reached, a.status]) best = Math.max(best, index.get(key) ?? 0);
    return best;
  });

  const steps: FunnelStep[] = path.map((stage, i) => {
    const reached = furthest.filter((f) => f >= i).length;
    return { stage, reached, ofApplied: apps.length ? reached / apps.length : 0, ofPrevious: null };
  });
  let biggestDrop: number | null = null;
  let worst = 0;
  for (let i = 1; i < steps.length; i++) {
    const before = steps[i - 1].reached;
    if (!before) continue;
    steps[i].ofPrevious = steps[i].reached / before;
    const drop = 1 - steps[i].ofPrevious!;
    if (drop > worst) {
      worst = drop;
      biggestDrop = i;
    }
  }

  const cancelled = apps.filter((a) => a.status === 'cancel');
  const withdrawn = cancelled.filter((a) => a.cancelled_by === 'candidate').length;

  const hiredInPeriod = data.applications.filter((a) => a.hired_at && inWindow(localDay(a.hired_at), cur));
  const days = hiredInPeriod.map((a) =>
    Math.max(0, (new Date(a.hired_at as string).getTime() - new Date(a.created_at).getTime()) / DAY),
  );

  return {
    applied: apps.length,
    steps,
    biggestDrop,
    rejected: cancelled.length - withdrawn,
    withdrawn,
    inProgress: apps.filter((a) => a.status !== 'cancel' && a.status !== 'hired').length,
    timeToHire: median(days),
    timeToHireSample: days.length,
    timeToHireApprox: hiredInPeriod.some((a) => a.hired_approx),
  };
}

/* -------------------------------------------------------- payroll forecast */

/** Hiring pace is measured over the last 3 months (90 days). */
export const PACE_DAYS = 90;

export type CurrencyPayroll = {
  currency: Currency;
  /** active people with a salary in this currency */
  people: number;
  /** what next month costs if everyone stays on today's salary */
  committed: number;
  /** average monthly salary added by pipeline hires over the last 3 months */
  addedPerMonth: number;
  /** average monthly salary that left with leavers over the last 3 months */
  removedPerMonth: number;
  /** committed + added − removed: next month if the recent pace continues */
  projected: number;
  top: TopEarner[];
};

export type PayrollStats = {
  /** first day of next month (local) */
  month: Date;
  /** only currencies anyone is paid in, UZS first */
  byCurrency: CurrencyPayroll[];
  /** active people in the panel */
  active: number;
  /** active people without a salary entered (not in any total) */
  noSalary: number;
};

export function payrollStats(data: AnalyticsData, now: Date): PayrollStats {
  const pace: Window = { from: isoDay(addDays(now, -PACE_DAYS)), to: isoDay(now) };
  const months = PACE_DAYS / 30;
  const active = data.employees.filter((e) => e.status === 'active');
  const paid = (e: AnalyticsEmployee) => typeof e.salary === 'number' && e.salary > 0;
  const sum = (list: AnalyticsEmployee[]) => list.reduce((s, e) => s + (e.salary as number), 0);

  const byCurrency = CURRENCIES.map((currency): CurrencyPayroll => {
    const mine = data.employees.filter((e) => paid(e) && e.salary_currency === currency);
    const working = mine.filter((e) => e.status === 'active');
    const committed = sum(working);
    // same rule as "New hires": only people hired through the pipeline are new spend
    const addedPerMonth = sum(mine.filter((e) => isHire(e) && inWindow(e.hired_at, pace))) / months;
    const removedPerMonth = sum(mine.filter((e) => isLeaver(e) && inWindow(e.left_at, pace))) / months;
    return {
      currency,
      people: working.length,
      committed,
      addedPerMonth,
      removedPerMonth,
      projected: Math.max(0, committed + addedPerMonth - removedPerMonth),
      top: data.topEarners?.[currency] ?? [],
    };
  }).filter((c) => c.people > 0 || c.addedPerMonth > 0 || c.removedPerMonth > 0);

  return {
    month: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    byCurrency,
    active: active.length,
    noSalary: active.filter((e) => !paid(e)).length,
  };
}
