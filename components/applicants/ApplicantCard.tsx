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
      className={`group relative flex cursor-grab select-none flex-col gap-3 rounded-lg border border-zinc-200/80 bg-white p-3 outline-none transition-[border-color,box-shadow] hover:border-zinc-300 hover:shadow-[0_1px_3px_rgb(0_0_0/0.05)] focus-visible:ring-2 focus-visible:ring-zinc-400 active:cursor-grabbing ${
        dragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Avatar key={c?.photo_url ?? name} name={name} url={c?.photo_url} className="h-8 w-8 text-[11px]" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-zinc-900">{name}</h3>
          <p className="truncate text-xs text-zinc-500">
            {[
              c?.major ? majorLabel(c.major, t) : null,
              c?.age ? t('app.yearsOld', { n: c.age }) : null,
              c?.experience_years ? experienceLabel(c.experience_years, t) : null,
            ]
              .filter(Boolean)
              .join(' · ') || '—'}
          </p>
        </div>
      </div>

      {a.status === 'cancel' && a.cancelled_by === 'candidate' && (
        <p className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-rose-700">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          {t('app.cancelledByCandidate')}
        </p>
      )}

      <p className="flex items-start gap-2 text-[13px] leading-snug text-zinc-500">
        <BriefcaseIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <span className="min-w-0">
          {t('app.appliedFor')} <span className="text-zinc-900">{a.vacancy?.title ?? t('app.deletedVacancy')}</span>
        </span>
      </p>

      <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
        <span className="inline-flex items-center gap-1" title={a.created_at}>
          <ClockIcon className="h-3.5 w-3.5" />
          {timeAgo(a.updated_at, t, lang)}
        </span>
        <span className="flex items-center gap-2">
          {c?.resume_path && (
            <span className="inline-flex items-center" title={t('app.resumeAttached')}>
              <PaperclipIcon className="h-3.5 w-3.5" />
              <span className="sr-only">{t('app.resumeAttached')}</span>
            </span>
          )}
          {c?.username && (
            <span className="inline-flex max-w-32 items-center gap-1 truncate text-zinc-500">
              <SendIcon className="h-3 w-3" />@{c.username}
            </span>
          )}
        </span>
      </div>
    </article>
  );
}
