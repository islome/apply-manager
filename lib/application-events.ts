// Status history of one application (supabase/012_application_events.sql).
import { apiJson } from './api-client';

export type ApplicationEvent = {
  id: number;
  type: 'status_change' | string;
  from_status: string | null;
  to_status: string;
  /** stage name when it happened; null = built-in name */
  to_label: string | null;
  actor: 'hr' | 'candidate' | 'system';
  /** HR username when actor = 'hr' */
  actor_name: string | null;
  /** reconstructed from data that existed before the log; the time is approximate */
  backfilled: boolean;
  created_at: string;
};

export type EventsResponse = { events: ApplicationEvent[]; migrated: boolean };

export function fetchApplicationEvents(applicationId: string, signal?: AbortSignal): Promise<EventsResponse> {
  return apiJson<EventsResponse>(`/api/hr/applications/${encodeURIComponent(applicationId)}/events`, { signal });
}

/* ---------------------------------------------------------- the HR's whole log */

export type LogEntry = ApplicationEvent & {
  application_id: string;
  candidate_name: string | null;
  candidate_photo: string | null;
  vacancy_title: string | null;
};

export type LogPage = { events: LogEntry[]; total: number; migrated: boolean };

export const LOG_PAGE_SIZE = 100;

/** Newest first. */
export function fetchActivityLog(offset = 0, signal?: AbortSignal): Promise<LogPage> {
  return apiJson<LogPage>(`/api/hr/events?offset=${offset}&limit=${LOG_PAGE_SIZE}`, { signal });
}

export function deleteLogEntry(id: number): Promise<null> {
  return apiJson<null>(`/api/hr/events/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
}

/** Permanently removes every entry of the signed-in HR's log. */
export function clearActivityLog(): Promise<{ deleted: number }> {
  return apiJson<{ deleted: number }>('/api/hr/events', { method: 'DELETE' });
}
