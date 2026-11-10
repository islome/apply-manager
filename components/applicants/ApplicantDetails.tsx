'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  STAGES,
  experienceLabel,
  formatDateTime,
  openResume,
  personName,
  stageLabel,
  type Application,
  type StageId,
} from '@/lib/applications';
import { employmentLabel, type EmploymentType } from '@/lib/vacancies';
import { cityLabel, majorLabel } from '@/lib/vacancy-options';
import { useLanguage } from '@/i18n/LanguageProvider';
import Avatar from './Avatar';
import { CloseIcon, DownloadIcon } from './icons';

type Props = {
  a: Application | null;
  onClose: () => void;
  onMove: (id: string, stage: StageId) => void;
  onNotify: (message: string) => void;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-2.5 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="min-w-0 wrap-break-word text-zinc-900">{children}</dd>
    </div>
  );
}

/**
 * Candidate side panel. Uses the native <dialog>, so Esc, focus trapping and the backdrop come for free.
 * Stage buttons here are also the touch/keyboard way to move a card (drag and drop is mouse only).
 */
export default function ApplicantDetails({ a, onClose, onMove, onNotify }: Props) {
  const { lang, t } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  const [resumeBusy, setResumeBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (a && !d.open) d.showModal();
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

  const c = a?.candidate;
  const name = a ? personName(a) : '';

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // click on the backdrop
      }}
      aria-labelledby="applicant-title"
      className="my-0 mr-0 ml-auto h-dvh max-h-none w-[min(460px,100vw)] overflow-hidden border-0 border-l border-zinc-200 bg-white p-0 shadow-overlay backdrop:bg-zinc-950/25 backdrop:backdrop-blur-[2px]"
    >
      {a && (
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-between border-b border-zinc-100 px-6">
            <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-400">{t('app.candidate')}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-8">
            <div className="flex items-center gap-4 py-6">
              <Avatar key={c?.photo_url ?? name} name={name} url={c?.photo_url} className="h-14 w-14 text-base" />
              <div className="min-w-0">
                <h3 id="applicant-title" className="wrap-break-word text-xl font-semibold tracking-tight text-zinc-900">
                  {name}
                </h3>
                <p className="text-sm text-zinc-500">{c?.major ? majorLabel(c.major, t) : t('app.noMajor')}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pb-5" role="group" aria-label={t('app.moveToStage')}>
              {STAGES.map((s) => {
                const active = s.id === a.status;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={active}
                    disabled={active}
                    onClick={() => onMove(a.id, s.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-900"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                    {stageLabel(s.id, t)}
                  </button>
                );
              })}
            </div>

            <dl className="divide-y divide-zinc-100 border-t border-zinc-100">
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
                {stageLabel(a.status, t)}
                {a.status === 'cancel' && a.cancelled_by === 'candidate' ? t('app.cancelledByCandidateDash') : ''}
              </Field>
              <Field label={t('app.age')}>{c?.age ? t('app.yearsOld', { n: c.age }) : t('app.notAdded')}</Field>
              <Field label={t('app.experience')}>{experienceLabel(c?.experience_years, t)}</Field>
              <Field label={t('app.language')}>{c?.language_code ? c.language_code.toUpperCase() : t('app.notAdded')}</Field>
              <Field label={t('app.phone')}>
                {c?.phone ? (
                  <a className="text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900" href={`tel:${c.phone}`}>
                    {c.phone}
                  </a>
                ) : (
                  t('app.notAdded')
                )}
              </Field>
              <Field label="Telegram">
                {c?.username ? (
                  <a
                    className="text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900"
                    href={`https://t.me/${encodeURIComponent(c.username)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    @{c.username}
                  </a>
                ) : c?.telegram_id ? (
                  <a className="text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900" href={`tg://user?id=${c.telegram_id}`}>
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

            {c?.resume_path && (
              <button
                type="button"
                onClick={onResume}
                disabled={resumeBusy}
                className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
              >
                <DownloadIcon className="h-4 w-4" />
                {resumeBusy ? t('app.opening') : t('app.openResume')}
              </button>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
