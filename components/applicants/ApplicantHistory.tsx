'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/i18n/LanguageProvider';
import { formatDateTime, timeAgo } from '@/lib/applications';
import { fetchApplicationEvents, type ApplicationEvent } from '@/lib/application-events';
import { stageColor, statusName, type Stage } from '@/lib/stages';

type Loaded = { key: string; events: ApplicationEvent[]; migrated: boolean } | { key: string; error: true };

/**
 * Status history of one application, newest first, from the append-only log (supabase/012).
 * `refreshKey` changes when the status changes, so a move made in this window shows up at once.
 */
export default function ApplicantHistory({
  applicationId,
  refreshKey,
  stages,
}: {
  applicationId: string;
  refreshKey: string;
  stages: Stage[];
}) {
  const { lang, t } = useLanguage();
  const key = `${applicationId}|${refreshKey}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    // give the trigger a moment after a move, so the new row is there when we read
    const timer = setTimeout(() => {
      fetchApplicationEvents(applicationId, ctrl.signal)
        .then((r) => setLoaded({ key, events: r.events ?? [], migrated: r.migrated }))
        .catch((e: Error) => {
          if (e.name !== 'AbortError') setLoaded({ key, error: true });
        });
    }, 150);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [applicationId, key]);

  // keep showing the previous list for the same applicant while it refreshes (no flicker)
  const current = loaded && loaded.key.startsWith(`${applicationId}|`) ? loaded : null;

  // name of a status at a point in time: the label stored with the event, else today's name
  const nameAt = (status: string, label: string | null) => label ?? statusName(status, stages, t);

  return (
    <section className="mt-8">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-zinc-400">{t('history.title')}</p>

      {!current && (
        <div className="space-y-3" aria-hidden="true">
          <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-100" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-100" />
        </div>
      )}

      {current && 'error' in current && <p className="text-sm text-zinc-400">{t('history.failed')}</p>}

      {current && !('error' in current) && !current.migrated && (
        <p className="text-sm text-zinc-400">{t('history.migrate')}</p>
      )}

      {current && !('error' in current) && current.migrated && current.events.length === 0 && (
        <p className="text-sm text-zinc-400">{t('history.empty')}</p>
      )}

      {current && !('error' in current) && current.events.length > 0 && (
        <ol className="relative ml-1 space-y-4 border-l border-zinc-200 pl-5">
          {[...current.events].reverse().map((e, i, list) => {
            // the stage it came from, named as it was then (the label of the previous event)
            const previous = list[i + 1];
            const fromName = e.from_status
              ? nameAt(e.from_status, previous?.to_status === e.from_status ? previous.to_label : null)
              : null;
            const who =
              e.actor === 'hr' ? (e.actor_name ?? t('history.hr')) : e.actor === 'candidate' ? t('history.candidate') : t('history.system');

            return (
              <li key={e.id} className="relative">
                <span
                  aria-hidden="true"
                  className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${i === 0 ? '' : 'opacity-60'}`}
                  style={{ backgroundColor: stageColor(e.to_status, stages) }}
                />
                <p className="text-sm text-zinc-900">
                  {fromName ? (
                    <>
                      <span className="text-zinc-500">{fromName}</span>
                      <span className="mx-1.5 text-zinc-400" aria-hidden="true">→</span>
                      <span className="sr-only">→</span>
                      <span className="font-medium">{nameAt(e.to_status, e.to_label)}</span>
                    </>
                  ) : (
                    <span className="font-medium">{t('history.applied')}</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {who}
                  <span className="mx-1.5 text-zinc-300">·</span>
                  <time dateTime={e.created_at} title={formatDateTime(e.created_at, lang)}>
                    {timeAgo(e.created_at, t, lang)}
                  </time>
                  {e.backfilled && (
                    <>
                      <span className="mx-1.5 text-zinc-300">·</span>
                      <span className="italic">{t('history.approx')}</span>
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
