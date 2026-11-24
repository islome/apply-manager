import { supabaseAdmin } from './supabase-admin';
import { notifyVacancyStatus } from './telegram-notify';

type Db = ReturnType<typeof supabaseAdmin>;

type CandidateRow = {
  id: string;
  telegram_id: number | string | null;
  full_name: string | null;
  notify_status?: boolean | null;
};
type ApplicationRow = { candidate: CandidateRow | CandidateRow[] | null };

const PAGE = 1000; // PostgREST's default max rows per request
// Telegram allows ~30 messages/s per bot; a few parallel sends stay well under it
const CONCURRENCY = 4;

async function loadApplicants(db: Db, vacancyId: string): Promise<CandidateRow[] | null> {
  // notify_status may not exist yet (older schema): fall back to the select without it
  const selects = [
    'candidate:candidates(id, telegram_id, full_name, notify_status)',
    'candidate:candidates(id, telegram_id, full_name)',
  ];
  for (const select of selects) {
    const rows: CandidateRow[] = [];
    let failed = false;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from('applications')
        .select(select)
        .eq('vacancy_id', vacancyId)
        .order('id')
        .range(from, from + PAGE - 1);
      if (error) {
        failed = true;
        if (select === selects[selects.length - 1]) {
          console.error('[telegram] vacancy applicants lookup failed:', error.message);
        }
        break;
      }
      for (const app of (data ?? []) as unknown as ApplicationRow[]) {
        const c = Array.isArray(app.candidate) ? app.candidate[0] : app.candidate;
        if (c) rows.push(c);
      }
      if (!data || data.length < PAGE) break;
    }
    if (!failed) return rows;
  }
  return null;
}

/**
 * Tells every candidate who applied to the vacancy that it was closed (active=false) or reopened
 * (active=true). One message per Telegram chat, skipping candidates who turned notifications off.
 * Never throws: meant to run in `after()` so the HR's update is never blocked or failed by it.
 */
export async function notifyVacancyApplicants(
  vacancyId: string,
  active: boolean,
  vacancyTitle: string | null | undefined,
): Promise<void> {
  try {
    const applicants = await loadApplicants(supabaseAdmin(), vacancyId);
    if (!applicants) return;

    const byChat = new Map<string, CandidateRow>();
    for (const c of applicants) {
      if (!c.telegram_id || c.notify_status === false) continue;
      const chat = String(c.telegram_id);
      if (!byChat.has(chat)) byChat.set(chat, c);
    }
    const queue = [...byChat.entries()];
    if (queue.length === 0) return;

    let sent = 0;
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const [chat, c] = next;
        if (await notifyVacancyStatus(chat, active, { vacancyTitle, fullName: c.full_name })) sent++;
      }
    };
    const total = queue.length;
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
    console.info(`[telegram] vacancy ${active ? 'reopened' : 'closed'}: notified ${sent}/${total} applicants`);
  } catch (e) {
    console.error('[telegram] vacancy notification failed:', e instanceof Error ? e.message : e);
  }
}
