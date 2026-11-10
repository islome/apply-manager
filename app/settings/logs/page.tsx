'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Trash2 } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageProvider';
import { useStages } from '@/hooks/useStages';
import { formatDateTime } from '@/lib/applications';
import {
  LOG_PAGE_SIZE,
  clearActivityLog,
  deleteLogEntry,
  fetchActivityLog,
  type LogEntry,
} from '@/lib/application-events';
import { stageColor, stageName, statusName } from '@/lib/stages';
import Avatar from '@/components/applicants/Avatar';
import EmptyBoxAnimation from '../../EmptyBoxAnimation';
import ClearLogDialog from './ClearLogDialog';

type Actor = 'all' | 'hr' | 'candidate' | 'system';
type Period = 'all' | 'today' | '7' | '30';
type LoadState = 'loading' | 'ok' | 'error';

const DAY = 86_400_000;
const ACTORS: Actor[] = ['all', 'hr', 'candidate', 'system'];
const PERIODS: Period[] = ['all', 'today', '7', '30'];

const field =
  'h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-[border-color,box-shadow] hover:border-zinc-300 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5';

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export default function ActivityLogPage() {
  const { lang, t } = useLanguage();
  const { stages } = useStages();

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [migrated, setMigrated] = useState(true);
  const [state, setState] = useState<LoadState>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [q, setQ] = useState('');
  const [actor, setActor] = useState<Actor>('all');
  const [stage, setStage] = useState('all');
  const [period, setPeriod] = useState<Period>('all');

  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // "now" for the period filter and the Today / Yesterday headings, taken when data arrives
  const [nowMs, setNowMs] = useState(0);

  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => {
    const ctrl = new AbortController();
    fetchActivityLog(0, ctrl.signal)
      .then((page) => {
        setEntries(page.events);
        setTotal(page.total);
        setMigrated(page.migrated);
        setNowMs(Date.now());
        setState('ok');
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setState('error');
      });
    return () => ctrl.abort();
  }, [reloadKey]);

  function reload() {
    setState('loading');
    setReloadKey((k) => k + 1);
  }

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchActivityLog(entries.length);
      setEntries((list) => {
        const seen = new Set(list.map((e) => e.id));
        return [...list, ...page.events.filter((e) => !seen.has(e.id))];
      });
      setTotal(page.total);
    } catch (e) {
      notify((e as Error).message || t('logs.loadFailed'));
    } finally {
      setLoadingMore(false);
    }
  }

  async function remove(id: number) {
    setBusyId(id);
    try {
      await deleteLogEntry(id);
      setEntries((list) => list.filter((e) => e.id !== id));
      setTotal((n) => Math.max(0, n - 1));
      setConfirmId(null);
      notify(t('logs.deleted'));
    } catch (e) {
      notify((e as Error).message || t('common.networkError'));
    } finally {
      setBusyId(null);
    }
  }

  async function clearAll() {
    const { deleted } = await clearActivityLog(); // the dialog shows the error if this throws
    setClearing(false);
    setEntries([]);
    setTotal(0);
    notify(t('logs.cleared', { n: deleted }));
  }

  /* -------------------------------------------------------------- filtering */
  const months = useMemo(() => t('dash.trend.months').split(','), [t]);
  const filtersOn = q.trim() !== '' || actor !== 'all' || stage !== 'all' || period !== 'all';

  const visible = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase();
    const today = startOfDay(new Date(nowMs || 0));
    const since =
      period === 'today' ? today : period === '7' ? today - 6 * DAY : period === '30' ? today - 29 * DAY : -Infinity;
    return entries.filter((e) => {
      if (actor !== 'all' && e.actor !== actor) return false;
      if (stage !== 'all' && e.to_status !== stage && e.from_status !== stage) return false;
      if (new Date(e.created_at).getTime() < since) return false;
      if (needle) {
        const hay = `${e.candidate_name ?? ''} ${e.vacancy_title ?? ''} ${e.actor_name ?? ''}`.toLocaleLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [entries, q, actor, stage, period, nowMs]);

  // group by calendar day, newest first (entries already arrive newest first)
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: LogEntry[] }[] = [];
    const today = startOfDay(new Date(nowMs || 0));
    for (const e of visible) {
      const d = new Date(e.created_at);
      const day = startOfDay(d);
      const key = String(day);
      let group = out[out.length - 1];
      if (!group || group.key !== key) {
        const label =
          day === today
            ? t('logs.periodToday')
            : day === today - DAY
              ? t('logs.yesterday')
              : `${d.getDate()} ${months[d.getMonth()] ?? ''}${d.getFullYear() !== new Date(nowMs || 0).getFullYear() ? ` ${d.getFullYear()}` : ''}`;
        group = { key, label, items: [] };
        out.push(group);
      }
      group.items.push(e);
    }
    return out;
  }, [visible, months, nowMs, t]);

  const hhmm = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const who = (e: LogEntry) =>
    e.actor === 'hr' ? (e.actor_name ?? t('history.hr')) : e.actor === 'candidate' ? t('history.candidate') : t('history.system');
  const actorLabel = (a: Actor) =>
    a === 'all' ? t('logs.allActors') : a === 'hr' ? t('history.hr') : a === 'candidate' ? t('history.candidate') : t('history.system');
  const periodLabel = (p: Period) =>
    p === 'all' ? t('logs.periodAll') : p === 'today' ? t('logs.periodToday') : p === '7' ? t('logs.period7') : t('logs.period30');

  const hasMore = entries.length < total;

  return (
    <div className="w-full max-w-4xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/settings"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900"
          >
            <ArrowLeft size={15} /> {t('logs.back')}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t('logs.title')}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t('logs.subtitle')}
            {state === 'ok' && migrated && total > 0 && (
              <span className="text-zinc-400"> · {t('logs.total', { n: total })}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setClearing(true)}
          disabled={state !== 'ok' || !migrated || total === 0}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 text-sm font-medium text-rose-700 transition-colors hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 size={15} />
          {t('logs.clear')}
        </button>
      </header>

      {/* filters: one row above the list */}
      {state === 'ok' && migrated && total > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <label className="relative min-w-55 flex-1">
            <span className="sr-only">{t('logs.searchPh')}</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('logs.searchPh')}
              className={`${field} w-full pl-9 placeholder:text-zinc-400`}
            />
          </label>
          <div className="flex h-10 items-center gap-0.5 rounded-lg bg-zinc-100 p-1" role="group" aria-label={t('logs.actorFilter')}>
            {ACTORS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setActor(a)}
                aria-pressed={actor === a}
                className={`h-8 rounded-md px-3 text-sm font-medium transition-colors ${
                  actor === a ? 'bg-white text-zinc-900 ring-1 ring-zinc-200' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {actorLabel(a)}
              </button>
            ))}
          </div>
          <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label={t('logs.stageFilter')} className={field}>
            <option value="all">{t('logs.allStages')}</option>
            {stages.map((s) => (
              <option key={s.key} value={s.key}>
                {stageName(s, t)}
              </option>
            ))}
          </select>
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label={t('logs.period')} className={field}>
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {periodLabel(p)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* states */}
      {state === 'loading' && (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100" />
          ))}
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-200 bg-white/60 px-6 py-16 text-center">
          <h2 className="text-base font-semibold text-zinc-900">{t('logs.loadFailed')}</h2>
          <button type="button" onClick={reload} className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800">
            {t('common.retry')}
          </button>
        </div>
      )}

      {state === 'ok' && !migrated && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{t('history.migrate')}</p>
      )}

      {state === 'ok' && migrated && total === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white/60 px-6 py-16 text-center">
          <EmptyBoxAnimation />
          <h2 className="text-base font-semibold text-zinc-900">{t('logs.empty')}</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">{t('logs.emptyHint')}</p>
        </div>
      )}

      {state === 'ok' && migrated && total > 0 && visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white/60 px-6 py-12 text-center">
          <p className="text-sm text-zinc-500">{t('logs.noMatch')}</p>
          {filtersOn && (
            <button
              type="button"
              onClick={() => {
                setQ('');
                setActor('all');
                setStage('all');
                setPeriod('all');
              }}
              className="mt-3 text-sm font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900"
            >
              {t('logs.resetFilters')}
            </button>
          )}
        </div>
      )}

      {/* the log, grouped by day */}
      {groups.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.label}>
              <h2 className="border-b border-zinc-100 bg-zinc-50/70 px-5 py-2 text-xs font-medium text-zinc-500">{g.label}</h2>
              <ol className="divide-y divide-zinc-100">
                {g.items.map((e) => {
                  const name = e.candidate_name || t('dash.unknownCandidate');
                  const confirming = confirmId === e.id;
                  return (
                    <li key={e.id} className="group flex items-start gap-4 px-5 py-3.5 transition-colors hover:bg-zinc-50/60">
                      <time
                        dateTime={e.created_at}
                        title={formatDateTime(e.created_at, lang)}
                        className="w-11 shrink-0 pt-1.5 text-xs tabular-nums text-zinc-500"
                      >
                        {hhmm(e.created_at)}
                      </time>
                      <Avatar key={e.candidate_photo ?? name} name={name} url={e.candidate_photo} className="h-8 w-8 text-[11px]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <span className="font-medium text-zinc-900">{name}</span>
                          {e.vacancy_title && <span className="text-zinc-500"> · {e.vacancy_title}</span>}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-zinc-600">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: stageColor(e.to_status, stages) }}
                          />
                          {e.from_status ? (
                            <>
                              <span className="text-zinc-500">{statusName(e.from_status, stages, t)}</span>
                              <span className="text-zinc-400">→</span>
                              <span className="font-medium text-zinc-900">{e.to_label ?? statusName(e.to_status, stages, t)}</span>
                            </>
                          ) : (
                            <span className="font-medium text-zinc-900">{t('history.applied')}</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {who(e)}
                          {e.backfilled && (
                            <>
                              <span className="mx-1.5 text-zinc-300">·</span>
                              <span className="italic">{t('history.approx')}</span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* delete one entry: inline confirmation, no modal */}
                      <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                        {confirming ? (
                          <>
                            <span className="text-xs text-zinc-500 max-sm:hidden">{t('logs.deleteConfirm')}</span>
                            <button
                              type="button"
                              autoFocus
                              onClick={() => void remove(e.id)}
                              disabled={busyId === e.id}
                              className="h-8 rounded-lg bg-rose-600 px-3 text-xs font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
                            >
                              {t('common.delete')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmId(null)}
                              className="h-8 rounded-lg px-2.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                            >
                              {t('common.cancel')}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmId(e.id)}
                            aria-label={t('common.delete')}
                            title={t('common.delete')}
                            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 opacity-0 transition-[opacity,color,background-color] hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      {state === 'ok' && hasMore && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60"
          >
            {loadingMore ? t('common.loading') : `${t('logs.loadMore')} (${Math.min(LOG_PAGE_SIZE, total - entries.length)})`}
          </button>
        </div>
      )}

      {clearing && <ClearLogDialog total={total} onConfirm={clearAll} onClose={() => setClearing(false)} />}

      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm text-white transition ${
          toast ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        {toast}
      </div>
    </div>
  );
}
