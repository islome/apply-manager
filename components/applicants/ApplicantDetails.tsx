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
import { employmentLabel, type EmploymentType } from '@/lib/vacancies';
import Avatar from './Avatar';
import { CloseIcon, DownloadIcon } from './icons';

type Props = {
  a: Application | null;
  onClose: () => void;
  onMove: (id: string, stage: StageId) => void;
  onNotify: (message: string) => void;
};

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 ${wide ? 'col-span-2' : ''}`}>
      <dt className="mb-0.5 text-xs text-slate-400">{label}</dt>
      <dd className="break-words text-[13px] font-semibold text-slate-900">{children}</dd>
    </div>
  );
}

/**
 * Candidate card. Uses the native <dialog>, so Esc, focus trapping and the backdrop come for free.
 * Stage buttons here are also the touch/keyboard way to move a card (drag and drop is mouse only).
 */
export default function ApplicantDetails({ a, onClose, onMove, onNotify }: Props) {
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
      className="m-auto w-[min(560px,calc(100vw-24px))] max-h-[calc(100vh-24px)] overflow-hidden rounded-[28px] border-0 bg-white p-0 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm"
    >
      {a && (
        <div className="flex max-h-[calc(100vh-24px)] flex-col">
          <div className="flex items-center justify-between px-6 pb-2 pt-5">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Candidate</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-10 w-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto px-6 pb-6">
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4" role="group" aria-label="Move to stage">
              {STAGES.map((s) => {
                const active = s.id === a.status;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={active}
                    disabled={active}
                    onClick={() => onMove(a.id, s.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? `${s.soft} ${s.text} border-transparent ring-1 ${s.ring}`
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                    {s.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-4 py-5">
              <Avatar key={c?.photo_url ?? name} name={name} url={c?.photo_url} className="h-20 w-20 text-lg" />
              <div className="min-w-0">
                <h3 id="applicant-title" className="break-words text-xl font-bold tracking-tight text-slate-900">
                  {name}
                </h3>
                <p className="text-slate-500">{c?.major ?? 'No major'}</p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-2.5">
              <Field label="Applied for" wide>
                {a.vacancy?.title ?? 'Deleted vacancy'}
                {a.vacancy && (
                  <span className="block pt-0.5 text-xs font-normal text-slate-500">
                    {[
                      a.vacancy.company,
                      a.vacancy.city,
                      a.vacancy.employment_type ? employmentLabel(a.vacancy.employment_type as EmploymentType) : null,
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
                <Field label="About experience" wide>
                  <span className="whitespace-pre-wrap font-normal">{c.experience_text}</span>
                </Field>
              )}
            </dl>

            {c?.resume_path && (
              <button
                type="button"
                onClick={onResume}
                disabled={resumeBusy}
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
              >
                <DownloadIcon className="h-[18px] w-[18px]" />
                {resumeBusy ? 'Opening…' : 'Open resume'}
              </button>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
