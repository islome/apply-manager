// Data model + helpers for the Job Applicants board.
// Source: GET /api/hr/applications = `applications` rows with the candidate and vacancy embedded.

import { ApiError, apiJson } from './api-client';
import type { TFunction } from '@/i18n/LanguageProvider';
import type { MessageKey } from '@/i18n/messages';

/* ------------------------------------------------------------------ stages */

// Tailwind needs complete class names in the source, so each stage spells out its own.
export const STAGES = [
  { id: 'new', dot: 'bg-blue-500', bar: 'border-t-blue-500', soft: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' },
  { id: 'confirmed', dot: 'bg-violet-500', bar: 'border-t-violet-500', soft: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-200' },
  { id: 'interview', dot: 'bg-amber-500', bar: 'border-t-amber-500', soft: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  { id: 'hired', dot: 'bg-emerald-500', bar: 'border-t-emerald-500', soft: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  { id: 'cancel', dot: 'bg-rose-500', bar: 'border-t-rose-500', soft: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200' },
] as const;

export type Stage = (typeof STAGES)[number];
export type StageId = Stage['id'];

const STAGE_IDS: readonly string[] = STAGES.map((s) => s.id);

export function isStageId(v: unknown): v is StageId {
  return typeof v === 'string' && STAGE_IDS.includes(v);
}
export function stageById(id: StageId): Stage {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

/* ------------------------------------------------------------------- types */

export type Candidate = {
  id: string;
  telegram_id: number | null;
  username: string | null;
  language_code: string | null;
  photo_url: string | null;
  resume_path: string | null;
  full_name: string;
  phone: string | null;
  age: number | null;
  major: string | null;
  experience_years: number | null;
  experience_text: string | null;
};

export type VacancyRef = {
  id: string;
  title: string;
  major: string | null;
  city: string | null;
  company: string | null;
  employment_type: string | null;
};

type ApplicationRow = {
  id: string;
  candidate_id: string;
  vacancy_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  /** 'candidate' when the candidate cancelled it from the Mini App (needs supabase/007) */
  cancelled_by?: 'candidate' | 'hr' | null;
  candidate: Candidate | null;
  vacancy: VacancyRef | null;
};

export type Application = Omit<ApplicationRow, 'status'> & { status: StageId };

let warnedUnknownStatus = false;
function normalize(row: ApplicationRow): Application {
  let status: StageId = 'new';
  if (isStageId(row.status)) {
    status = row.status;
  } else if (!warnedUnknownStatus) {
    warnedUnknownStatus = true;
    console.warn(
      `[applicants] unknown status "${row.status}" shown as New. Did you run 006_application_stages.sql?`
    );
  }
  return { ...row, status, updated_at: row.updated_at ?? row.created_at };
}

/* --------------------------------------------------------------------- API */

export async function fetchApplications(signal?: AbortSignal): Promise<Application[]> {
  const rows = await apiJson<ApplicationRow[]>('/api/hr/applications', { signal });
  return (Array.isArray(rows) ? rows : []).map(normalize);
}

export function updateApplicationStatus(id: string, status: StageId) {
  return apiJson<{ id: string; status: string; updated_at: string }>(
    `/api/hr/applications/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: { status } }
  );
}

/**
 * Opens the candidate's resume (private bucket -> short-lived signed URL).
 * The tab is opened synchronously, inside the click, so popup blockers allow it.
 */
export async function openResume(candidateId: string): Promise<void> {
  const tab = window.open('about:blank', '_blank');
  try {
    const r = await apiJson<{ url?: string }>(`/api/hr/candidates/${encodeURIComponent(candidateId)}/resume`);
    const url = safeHttpUrl(r?.url);
    if (!url) throw new ApiError('Resume link is not available', 404);
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else if (!window.open(url, '_blank', 'noopener')) {
      throw new ApiError('Pop-up blocked — allow pop-ups to open the resume', 0);
    }
  } catch (e) {
    tab?.close();
    throw e;
  }
}

/* ----------------------------------------------------------------- helpers */

export function safeHttpUrl(value: string | null | undefined): string {
  if (!value) return '';
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch {
    return '';
  }
}

export function personName(a: Application): string {
  return a.candidate?.full_name?.trim() || 'Unknown candidate';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function experienceLabel(years: number | null | undefined, t: TFunction): string {
  if (!years) return t('experience.none');
  return years === 1 ? t('experience.one') : t('experience.many', { n: years });
}

/** Localised stage name ("Yangi" / "New" / "Новые"). */
export function stageLabel(id: StageId, t: TFunction): string {
  return t(`stage.${id}` as MessageKey);
}

// date helpers live in i18n/format.ts (they need the active language)
export { formatDate, formatDateTime, timeAgo } from '@/i18n/format';

/** Search box matcher: name, vacancy, major, phone, @username. */
export function matchesSearch(a: Application, raw: string): boolean {
  const q = raw.trim().toLocaleLowerCase().replace(/^@/, '');
  if (!q) return true;
  const hay = [a.candidate?.full_name, a.vacancy?.title, a.candidate?.major, a.candidate?.phone, a.candidate?.username]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
  return hay.includes(q);
}

/* --------------------------------------------------------------------- CSV */

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`; // stop spreadsheet formula injection
  return `"${text.replace(/"/g, '""')}"`;
}

export function applicationsToCsv(list: Application[]): string {
  const cols: [string, (a: Application) => unknown][] = [
    ['Full name', (a) => a.candidate?.full_name],
    ['Vacancy', (a) => a.vacancy?.title],
    ['Stage', (a) => a.status],
    ['Major', (a) => a.candidate?.major],
    ['Age', (a) => a.candidate?.age],
    ['Experience (years)', (a) => a.candidate?.experience_years],
    ['Experience', (a) => a.candidate?.experience_text],
    ['Phone', (a) => a.candidate?.phone],
    ['Telegram', (a) => (a.candidate?.username ? `@${a.candidate.username}` : '')],
    ['Applied', (a) => a.created_at],
    ['Last update', (a) => a.updated_at],
    ['Has resume', (a) => (a.candidate?.resume_path ? 'yes' : 'no')],
  ];
  const lines = [cols.map(([h]) => csvCell(h)).join(',')];
  for (const a of list) lines.push(cols.map(([, get]) => csvCell(get(a))).join(','));
  return `﻿${lines.join('\r\n')}`; // BOM so Excel reads UTF-8
}
