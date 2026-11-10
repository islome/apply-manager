'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Phone, Send } from 'lucide-react';
import {
  experienceLabel,
  formatDateTime,
  openResume,
  personName,
  type Application,
  type StageId,
} from '@/lib/applications';
import { boardKey, stageName, statusName, type Stage } from '@/lib/stages';
import { employmentLabel, type EmploymentType } from '@/lib/vacancies';
import { cityLabel, majorLabel } from '@/lib/vacancy-options';
import { useLanguage } from '@/i18n/LanguageProvider';
import Avatar from './Avatar';
import ApplicantHistory from './ApplicantHistory';
import { CloseIcon, DownloadIcon } from './icons';

type Props = {
  a: Application | null;
  stages: Stage[];
  /** where the open applicant sits in what the HR is looking at (board columns or list rows) */
  position?: { index: number; total: number } | null;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onMove: (id: string, stage: StageId) => void;
  onNotify: (message: string) => void;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4 py-3 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="min-w-0 wrap-break-word text-zinc-900">{children}</dd>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid h-5 min-w-5 place-items-center rounded border border-zinc-200 bg-white px-1 font-sans text-[10px] font-medium text-zinc-500">
      {children}
    </kbd>
  );
}

const iconButton =
  'grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-30';

const linkClass = 'text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900';

/**
 * Applicant "peek": a centred window (bottom sheet on phones) instead of a drawer pinned to the
 * far right edge, so it is never more than half a screen away from the card that opened it.
 * Clicking anywhere on the backdrop closes it; ← → walk through applicants; 1-9 set the stage.
 * Native <dialog>: Esc, focus trapping and the backdrop come for free.
 */
export default function ApplicantDetails({ a, stages, position, onPrev, onNext, onClose, onMove, onNotify }: Props) {
  const { lang, t } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [resumeBusy, setResumeBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (a && !d.open) {
      d.showModal();
      panelRef.current?.focus(); // keys work at once, without a focus ring jumping onto the first button
    }
    if (!a && d.open) d.close();
  }, [a]);

  async function onResume() {
    if (!a || resumeBusy) return;
    setResumeBusy(true);
    try {
      await openResume(a.candidate_id);
    } catch (e) {
      onNotify((e as Error).message || t('app.resumeFailed'));
    } finally {
      setResumeBusy(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDialogElement>) {
    if (!a || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === 'ArrowLeft' && onPrev) {
      e.preventDefault();
      onPrev();
    } else if (e.key === 'ArrowRight' && onNext) {
      e.preventDefault();
      onNext();
    } else if (/^[1-9]$/.test(e.key)) {
      const target = stages[Number(e.key) - 1];
      if (target && target.key !== boardKey(a.status, stages)) {
        e.preventDefault();
        onMove(a.id, target.key);
      }
    }
  }

  const c = a?.candidate;
  const name = a ? personName(a) : '';
  const current = a ? boardKey(a.status, stages) : '';
  // the parent passes onPrev / onNext only when there is somewhere to go
  const hasPrev = !!onPrev;
  const hasNext = !!onNext;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // click on the backdrop
      }}
      aria-labelledby="applicant-title"
      className="m-auto w-[min(860px,calc(100vw-2rem))] max-w-none overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-0 text-zinc-900 shadow-overlay backdrop:bg-zinc-950/25 backdrop:backdrop-blur-[2px] open:animate-peek-in motion-reduce:open:animate-none max-sm:mb-0 max-sm:w-full max-sm:rounded-b-none"
    >
      {a && (
        <div
          ref={panelRef}
          tabIndex={-1}
          className="flex max-h-[min(720px,calc(100dvh-2rem))] flex-col outline-none max-sm:max-h-[92dvh]"
        >
          {/* header: navigation left (next to the board), close right */}
          <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-4 sm:px-5">
            <div className="flex items-center gap-1">
              <button type="button" onClick={onPrev} disabled={!hasPrev} aria-label={t('app.prevApplicant')} title={t('app.prevApplicant')} className={iconButton}>
                <ChevronLeft size={18} />
              </button>
              <button type="button" onClick={onNext} disabled={!hasNext} aria-label={t('app.nextApplicant')} title={t('app.nextApplicant')} className={iconButton}>
                <ChevronRight size={18} />
              </button>
              {position && position.total > 0 && (
                <span className="ml-1.5 text-xs tabular-nums text-zinc-400">
                  {t('app.position', { i: position.index + 1, n: position.total })}
                </span>
              )}
            </div>
            <button type="button" onClick={onClose} aria-label={t('common.close')} className={iconButton}>
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          {/* body: actions on the left, facts on the right; `key` replays the fade when you step to another applicant */}
          <div key={a.id} className="grid min-h-0 flex-1 animate-fade-up overflow-y-auto motion-reduce:animate-none md:grid-cols-[280px_1fr] md:overflow-hidden">
            <aside className="border-zinc-100 bg-zinc-50/60 p-5 sm:p-6 md:overflow-y-auto md:border-r">
              <div className="flex items-center gap-3.5">
                <Avatar key={c?.photo_url ?? name} name={name} url={c?.photo_url} className="h-14 w-14 text-base" />
                <div className="min-w-0">
                  <h2 id="applicant-title" className="wrap-break-word text-lg font-semibold leading-snug tracking-tight">
                    {name}
                  </h2>
                  <p className="truncate text-sm text-zinc-500">{c?.major ? majorLabel(c.major, t) : t('app.noMajor')}</p>
                </div>
              </div>

              {/* stage: big vertical targets, numbered for the keyboard */}
              <p className="mb-2 mt-6 text-[11px] font-medium uppercase tracking-wider text-zinc-400">{t('app.stage')}</p>
              <div className="space-y-0.5" role="group" aria-label={t('app.moveToStage')}>
                {stages.map((s, i) => {
                  const active = s.key === current;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      aria-pressed={active}
                      disabled={active}
                      onClick={() => onMove(a.id, s.key)}
                      className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                        active
                          ? 'bg-white font-medium text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.05)] ring-1 ring-zinc-200'
                          : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900'
                      }`}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="min-w-0 flex-1 truncate">{stageName(s, t)}</span>
                      {active ? (
                        <Check size={15} className="shrink-0 text-zinc-900" />
                      ) : (
                        i < 9 && <span className="shrink-0 text-[11px] tabular-nums text-zinc-400 max-sm:hidden">{i + 1}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {a.status === 'cancel' && a.cancelled_by === 'candidate' && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-rose-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  {t('app.cancelledByCandidate')}
                </p>
              )}

              {/* contact actions */}
              <div className="mt-6 space-y-2">
                {c?.resume_path && (
                  <button
                    type="button"
                    onClick={onResume}
                    disabled={resumeBusy}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
                  >
                    <DownloadIcon className="h-4 w-4" />
                    {resumeBusy ? t('app.opening') : t('app.openResume')}
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {(c?.username || c?.telegram_id) && (
                    <a
                      href={c?.username ? `https://t.me/${encodeURIComponent(c.username)}` : `tg://user?id=${c?.telegram_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                    >
                      <Send size={14} />
                      Telegram
                    </a>
                  )}
                  {c?.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                    >
                      <Phone size={14} />
                      {t('app.phone')}
                    </a>
                  )}
                </div>
              </div>
            </aside>

            <section className="p-5 sm:p-6 md:overflow-y-auto">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">{t('app.details')}</p>
              <dl className="divide-y divide-zinc-100">
                <Field label={t('app.appliedForField')}>
                  <span className="font-medium">{a.vacancy?.title ?? t('app.deletedVacancy')}</span>
                  {a.vacancy && (
                    <span className="block pt-0.5 text-xs text-zinc-500">
                      {[
                        a.vacancy.company,
                        a.vacancy.city ? cityLabel(a.vacancy.city, t) : null,
                        a.vacancy.employment_type ? employmentLabel(a.vacancy.employment_type as EmploymentType, t) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </Field>
                <Field label={t('app.stage')}>
                  {statusName(a.status, stages, t)}
                  {a.status === 'cancel' && a.cancelled_by === 'candidate' ? t('app.cancelledByCandidateDash') : ''}
                </Field>
                <Field label={t('app.age')}>{c?.age ? t('app.yearsOld', { n: c.age }) : t('app.notAdded')}</Field>
                <Field label={t('app.experience')}>{experienceLabel(c?.experience_years, t)}</Field>
                <Field label={t('app.language')}>{c?.language_code ? c.language_code.toUpperCase() : t('app.notAdded')}</Field>
                <Field label={t('app.phone')}>
                  {c?.phone ? (
                    <a className={linkClass} href={`tel:${c.phone}`}>
                      {c.phone}
                    </a>
                  ) : (
                    t('app.notAdded')
                  )}
                </Field>
                <Field label="Telegram">
                  {c?.username ? (
                    <a className={linkClass} href={`https://t.me/${encodeURIComponent(c.username)}`} target="_blank" rel="noopener noreferrer">
                      @{c.username}
                    </a>
                  ) : c?.telegram_id ? (
                    <a className={linkClass} href={`tg://user?id=${c.telegram_id}`}>
                      {t('app.openInTelegram')}
                    </a>
                  ) : (
                    t('app.notAdded')
                  )}
                </Field>
                <Field label={t('app.applied')}>{formatDateTime(a.created_at, lang)}</Field>
                <Field label={t('app.lastUpdate')}>{formatDateTime(a.updated_at, lang)}</Field>
                {c?.experience_text && (
                  <Field label={t('app.aboutExperience')}>
                    <span className="whitespace-pre-wrap">{c.experience_text}</span>
                  </Field>
                )}
              </dl>

              <ApplicantHistory applicationId={a.id} refreshKey={`${a.status}|${a.updated_at}`} stages={stages} />
            </section>
          </div>

          {/* shortcut hints (hidden on touch screens) */}
          <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-t border-zinc-100 bg-zinc-50/60 px-5 py-2.5 text-xs text-zinc-500 max-sm:hidden [@media(pointer:coarse)]:hidden">
            <span className="inline-flex items-center gap-1.5">
              <Kbd>←</Kbd>
              <Kbd>→</Kbd>
              {t('app.kbdNavigate')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>1</Kbd>–<Kbd>{Math.min(9, stages.length)}</Kbd>
              {t('app.kbdMove')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>Esc</Kbd>
              {t('app.kbdClose')}
            </span>
          </div>
        </div>
      )}
    </dialog>
  );
}
