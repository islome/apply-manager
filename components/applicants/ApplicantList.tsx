'use client';

import { STAGES, experienceLabel, stageLabel, isStageId, personName, timeAgo, type Application, type StageId } from '@/lib/applications';
import { useLanguage } from '@/i18n/LanguageProvider';
import { majorLabel } from '@/lib/vacancy-options';
import Avatar from './Avatar';

type Props = {
  rows: Application[];
  onOpen: (id: string) => void;
  onMove: (id: string, stage: StageId) => void;
};

const COLS = 'grid-cols-[minmax(200px,1.3fr)_minmax(140px,1fr)_minmax(120px,.9fr)_minmax(100px,.7fr)_minmax(130px,.9fr)_minmax(100px,.7fr)_minmax(130px,.8fr)]';

export default function ApplicantList({ rows, onOpen, onMove }: Props) {
  const { lang, t } = useLanguage();
  if (!rows.length) {
    return <p className="rounded-xl border border-dashed border-zinc-300 py-14 text-center text-sm text-zinc-500">{t('app.listEmpty')}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <div className="min-w-[1000px] divide-y divide-zinc-100">
        <div className={`grid ${COLS} gap-4 px-4 py-2.5 text-xs font-medium text-zinc-500`} aria-hidden="true">
          <span>{t('app.colCandidate')}</span>
          <span>{t('app.colVacancy')}</span>
          <span>{t('app.colMajor')}</span>
          <span>{t('app.colExperience')}</span>
          <span>{t('app.colPhone')}</span>
          <span>{t('app.colUpdated')}</span>
          <span>{t('app.colStage')}</span>
        </div>

        {rows.map((a) => {
          const name = personName(a);
          return (
            <div
              key={a.id}
              className={`grid ${COLS} items-center gap-4 px-4 py-2.5 text-sm transition-colors hover:bg-zinc-50`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar key={a.candidate?.photo_url ?? name} name={name} url={a.candidate?.photo_url} className="h-8 w-8 text-xs" />
                <button
                  type="button"
                  onClick={() => onOpen(a.id)}
                  className="truncate text-left font-medium text-zinc-900 hover:text-blue-600"
                >
                  {name}
                </button>
              </div>
              <span className="truncate text-zinc-700">{a.vacancy?.title ?? t('app.deletedVacancy')}</span>
              <span className="truncate text-zinc-500">{a.candidate?.major ? majorLabel(a.candidate.major, t) : '—'}</span>
              <span className="truncate text-zinc-500">{experienceLabel(a.candidate?.experience_years, t)}</span>
              <span className="truncate text-zinc-500">{a.candidate?.phone ?? '—'}</span>
              <span className="truncate text-zinc-500">{timeAgo(a.updated_at, t, lang)}</span>
              <select
                value={a.status}
                onChange={(e) => isStageId(e.target.value) && onMove(a.id, e.target.value)}
                aria-label={t('app.stageFor', { name })}
                className="h-8 w-full rounded-lg border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none focus:border-blue-500"
              >
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {stageLabel(s.id, t)}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
