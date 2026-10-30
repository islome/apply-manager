'use client';

import type { DragEvent, KeyboardEvent } from 'react';
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
      aria-label={`Open ${name}`}
      draggable
      onClick={() => onOpen(a.id)}
      onKeyDown={onKeyDown}
      onDragStart={(e) => onDragStart(e, a.id)}
      onDragEnd={onDragEnd}
      className={`group relative flex cursor-grab select-none flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm outline-none transition hover:border-slate-300 hover:shadow-md focus-visible:ring-4 focus-visible:ring-blue-100 active:cursor-grabbing ${
        dragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <Avatar key={c?.photo_url ?? name} name={name} url={c?.photo_url} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-slate-900">{name}</h3>
          <p className="truncate text-xs text-slate-500">
            {[c?.major, c?.age ? `${c.age} y.o.` : null].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-2.5 py-2 text-[13px]">
        <BriefcaseIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="min-w-0 text-slate-500">
          Applied for <strong className="font-semibold text-slate-900">{a.vacancy?.title ?? 'Deleted vacancy'}</strong>
        </span>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-slate-400">Experience</dt>
        <dd className="truncate font-medium text-slate-700">{experienceLabel(c?.experience_years)}</dd>
        <dt className="text-slate-400">Phone</dt>
        <dd className="truncate font-medium text-slate-700">{c?.phone ?? '—'}</dd>
      </dl>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1" title={a.created_at}>
          <ClockIcon className="h-3.5 w-3.5" />
          {timeAgo(a.updated_at)}
        </span>
        <span className="flex items-center gap-1.5">
          {c?.resume_path && (
            <span className="inline-flex items-center rounded-full bg-slate-100 p-1.5 text-slate-500" title="Resume attached">
              <PaperclipIcon className="h-3 w-3" />
              <span className="sr-only">Resume attached</span>
            </span>
          )}
          {c?.username && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 font-medium text-blue-600">
              <SendIcon className="h-3 w-3" />@{c.username}
            </span>
          )}
        </span>
      </div>
    </article>
  );
}
