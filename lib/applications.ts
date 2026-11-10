// Data model + helpers for the Job Applicants board.
// Source: GET /api/hr/applications = `applications` rows with the candidate and vacancy embedded.

import { ApiError, apiJson } from './api-client';
import type { TFunction } from '@/i18n/LanguageProvider';

/* ------------------------------------------------------------------ stages */

// Stages are per HR now (lib/stages.ts, GET /api/hr/stages). A status is just a stage key.
export type StageId = string;

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

export type Application = ApplicationRow;

// Unknown or legacy statuses are kept as they are; the board puts them in the first column (boardKey).
function normalize(row: ApplicationRow): Application {
  return { ...row, status: typeof row.status === 'string' && row.status ? row.status : 'new', updated_at: row.updated_at ?? row.created_at };
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

/** `stageName` turns a status key into the HR's stage name (custom stages have generated keys). */
export function applicationsToCsv(list: Application[], stageName: (status: string) => string = (s) => s): string {
  const cols: [string, (a: Application) => unknown][] = [
    ['Full name', (a) => a.candidate?.full_name],
    ['Vacancy', (a) => a.vacancy?.title],
    ['Stage', (a) => stageName(a.status)],
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
