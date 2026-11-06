'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  STAGES,
  experienceLabel,
  formatDateTime,
  openResume,
  personName,
  stageById,
  type Application,
  type StageId,
} from '@/lib/applications';
import { useT } from '@/i18n/LanguageProvider';
import { employmentLabel, type EmploymentType } from '@/lib/vacancies';
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
      <dt className="text-zinc-400">{label}</dt>
      <dd className="min-w-0 break-words text-zinc-900">{children}</dd>
    </div>
  );
}

/**
 * Candidate side panel. Uses the native <dialog>, so Esc, focus trapping and the backdrop come for free.
 * Stage buttons here are also the touch/keyboard way to move a card (drag and drop is mouse only).
 */
export default function ApplicantDetails({ a, onClose, onMove, onNotify }: Props) {
  const t = useT();
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
      onNotify((e as Error).message || 'Could not open the resume');
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
      className="my-0 mr-0 ml-auto h-dvh max-h-none w-[min(440px,100vw)] overflow-hidden border-0 border-l border-zinc-200 bg-white p-0 backdrop:bg-zinc-900/30"
    >
      {a && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
            <h2 className="text-sm font-medium text-zinc-500">Candidate</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6">
            <div className="flex items-center gap-4 py-5">
              <Avatar key={c?.photo_url ?? name} name={name} url={c?.photo_url} className="h-14 w-14 text-base" />
              <div className="min-w-0">
                <h3 id="applicant-title" className="break-words text-lg font-semibold tracking-tight text-zinc-900">
                  {name}
                </h3>
                <p className="text-sm text-zinc-500">{c?.major ?? 'No major'}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pb-5" role="group" aria-label="Move to stage">
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
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </button>
                );
              })}
            </div>

            <dl className="divide-y divide-zinc-100 border-t border-zinc-100">
              <Field label="Applied for">
                <span className="font-medium">{a.vacancy?.title ?? 'Deleted vacancy'}</span>
                {a.vacancy && (
                  <span className="block pt-0.5 text-xs text-zinc-500">
                    {[
                      a.vacancy.company,
                      a.vacancy.city,
                      a.vacancy.employment_type ? employmentLabel(a.vacancy.employment_type as EmploymentType, t) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </Field>
              <Field label="Stage">{stageById(a.status).label}</Field>
              <Field label="Age">{c?.age ? `${c.age} years old` : 'Not added'}</Field>
              <Field label="Experience">{experienceLabel(c?.experience_years)}</Field>
              <Field label="Language">{c?.language_code ? c.language_code.toUpperCase() : 'Not added'}</Field>
              <Field label="Phone">
                {c?.phone ? (
                  <a className="text-blue-600 hover:underline" href={`tel:${c.phone}`}>
                    {c.phone}
                  </a>
                ) : (
                  'Not added'
                )}
              </Field>
              <Field label="Telegram">
                {c?.username ? (
                  <a
                    className="text-blue-600 hover:underline"
                    href={`https://t.me/${encodeURIComponent(c.username)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    @{c.username}
                  </a>
                ) : c?.telegram_id ? (
                  <a className="text-blue-600 hover:underline" href={`tg://user?id=${c.telegram_id}`}>
                    Open in Telegram
                  </a>
                ) : (
                  'Not added'
                )}
              </Field>
              <Field label="Applied">{formatDateTime(a.created_at)}</Field>
              <Field label="Last update">{formatDateTime(a.updated_at)}</Field>
              {c?.experience_text && (
                <Field label="About experience">
                  <span className="whitespace-pre-wrap">{c.experience_text}</span>
                </Field>
              )}
            </dl>

            {c?.resume_path && (
              <button
                type="button"
                onClick={onResume}
                disabled={resumeBusy}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
              >
                <DownloadIcon className="h-4 w-4" />
                {resumeBusy ? 'Opening…' : 'Open resume'}
              </button>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
