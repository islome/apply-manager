'use client';

import type { DragEvent, KeyboardEvent } from 'react';
import { useLanguage } from '@/i18n/LanguageProvider';
import { majorLabel } from '@/lib/vacancy-options';
import { experienceLabel, personName, timeAgo, type Application } from '@/lib/applications';
import Avatar from './Avatar';
import { BriefcaseIcon, ClockIcon, PaperclipIcon, SendIcon } from './icons';

type Props = {
  a: Application;
  dragging: boolean;
  onOpen: (id: string) => void;
  onDragStart: (e: DragEvent<HTMLElement>, id: string) => void;
  onDragEnd: () => void;
};

export default function ApplicantCard({ a, dragging, onOpen, onDragStart, onDragEnd }: Props) {
  const { lang, t } = useLanguage();
  const c = a.candidate;
  const name = personName(a);

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(a.id);
    }
  }

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={t('app.openName', { name })}
      draggable
      onClick={() => onOpen(a.id)}
      onKeyDown={onKeyDown}
      onDragStart={(e) => onDragStart(e, a.id)}
      onDragEnd={onDragEnd}
      className={`group relative flex cursor-grab select-none flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3.5 outline-none transition-colors hover:border-zinc-300 focus-visible:ring-2 focus-visible:ring-blue-500/40 active:cursor-grabbing ${
        dragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <Avatar key={c?.photo_url ?? name} name={name} url={c?.photo_url} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-zinc-900">{name}</h3>
          <p className="truncate text-xs text-zinc-500">
            {[c?.major ? majorLabel(c.major, t) : null, c?.age ? t('app.yearsOld', { n: c.age }) : null].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      </div>

      {a.status === 'cancel' && a.cancelled_by === 'candidate' && (
        <p className="rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
          {t('app.cancelledByCandidate')}
        </p>
      )}

      <p className="flex items-start gap-2 text-sm text-zinc-600">
        <BriefcaseIcon className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-500" />
        <span className="min-w-0">
          {t('app.appliedFor')} <span className="font-medium text-zinc-900">{a.vacancy?.title ?? t('app.deletedVacancy')}</span>
        </span>
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-zinc-500">{t('app.experience')}</dt>
        <dd className="truncate text-zinc-800">{experienceLabel(c?.experience_years, t)}</dd>
        <dt className="text-zinc-500">{t('app.phone')}</dt>
        <dd className="truncate text-zinc-800">{c?.phone ?? '—'}</dd>
      </dl>

      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-2.5 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1" title={a.created_at}>
          <ClockIcon className="h-3.5 w-3.5" />
          {timeAgo(a.updated_at, t, lang)}
        </span>
        <span className="flex items-center gap-2">
          {c?.resume_path && (
            <span className="inline-flex items-center text-zinc-500" title={t('app.resumeAttached')}>
              <PaperclipIcon className="h-3.5 w-3.5" />
              <span className="sr-only">{t('app.resumeAttached')}</span>
            </span>
          )}
          {c?.username && (
            <span className="inline-flex items-center gap-1 font-medium text-blue-600">
              <SendIcon className="h-3 w-3" />@{c.username}
            </span>
          )}
        </span>
      </div>
    </article>
  );
}
