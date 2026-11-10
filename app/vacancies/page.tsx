'use client';

import { useMemo, useState } from 'react';
import { Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { useVacancies } from '@/hooks/useVacancies';
import { useLanguage } from '@/i18n/LanguageProvider';
import { employmentLabel, formatDate, salaryLabel, type Vacancy } from '@/lib/vacancies';
import { cityLabel, majorLabel } from '@/lib/vacancy-options';
import EmptyBoxAnimation from '../EmptyBoxAnimation';
import AddVacancyModal from './AddVacancyModal';
import EditVacancyModal from './EditVacancyModal';

type Filter = 'all' | 'active' | 'inactive';

const FILTERS: Filter[] = ['all', 'active', 'inactive'];

const iconButton =
  'grid h-8 w-8 place-items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50';
const iconNeutral = 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900';
const iconDanger = 'text-zinc-500 hover:bg-red-50 hover:text-red-600';
const iconOn = 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700';

function VacancyCard({
  v,
  busy,
  onToggle,
  onEdit,
  onDelete,
}: {
  v: Vacancy;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { lang, t } = useLanguage();

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-zinc-200/80 bg-white p-5 transition-[border-color,box-shadow] hover:border-zinc-300 hover:shadow-[0_1px_3px_rgb(0_0_0/0.05)]">
      <div className="flex items-start justify-between gap-3">
        <h3
          className={`wrap-break-word text-[15px] font-semibold leading-snug tracking-tight ${
            v.is_active ? "text-zinc-900" : "text-zinc-500"
          }`}
        >
          {v.title}
        </h3>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 pt-0.5 text-xs font-medium ${
            v.is_active ? "text-zinc-700" : "text-zinc-500"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${v.is_active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
          {v.is_active ? t('vac.active') : t('vac.inactive')}
        </span>
      </div>

      <div className="space-y-0.5">
        <p className="text-sm font-medium tabular-nums text-zinc-900">{salaryLabel(v, t)}</p>
        <p className="text-sm text-zinc-500">
          {v.company} · {cityLabel(v.city, t)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-md px-2 py-0.5 text-xs text-zinc-600 ring-1 ring-inset ring-zinc-200">{employmentLabel(v.employment_type, t)}</span>
        <span className="rounded-md px-2 py-0.5 text-xs text-zinc-600 ring-1 ring-inset ring-zinc-200">{majorLabel(v.major, t)}</span>
        <span className="ml-auto text-xs tabular-nums text-zinc-500">{t('vac.applications', { n: v.applications_count })}</span>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-3.5">
        <span className="text-xs text-zinc-500">{formatDate(v.created_at, lang)}</span>
        <div className="-mr-1.5 flex items-center gap-0.5" role="group" aria-label={t('vac.actionsAria', { title: v.title })}>
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            aria-pressed={v.is_active}
            aria-label={v.is_active ? t('vac.deactivate') : t('vac.activate')}
            title={v.is_active ? t('vac.deactivate') : t('vac.activate')}
            className={`${iconButton} ${v.is_active ? iconOn : iconNeutral}`}
          >
            <Power size={16} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            aria-label={t('common.edit')}
            title={t('common.edit')}
            className={`${iconButton} ${iconNeutral}`}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            aria-label={t('common.delete')}
            title={t('common.delete')}
            className={`${iconButton} ${iconDanger}`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function VacanciesPage() {
  const { t } = useLanguage();
  const { vacancies, state, error, retry, reload } = useVacancies();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingVacancy, setEditingVacancy] = useState<Vacancy | null>(null);
  const [busyVacancyId, setBusyVacancyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  async function updateVacancy(vacancy: Vacancy, method: 'PATCH' | 'DELETE', body?: object) {
    setBusyVacancyId(vacancy.id);
    setActionError('');
    try {
      const response = await fetch(`/api/hr/vacancies/${vacancy.id}`, {
        method,
        credentials: 'same-origin',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setActionError(
          result?.error ??
            t(method === 'DELETE' ? 'vac.deleteFailed' : 'vac.updateFailed', { status: response.status }),
        );
        return false;
      }
      await reload();
      return true;
    } catch {
      setActionError(t('common.networkError'));
      return false;
    } finally {
      setBusyVacancyId(null);
    }
  }

  async function deleteVacancy(vacancy: Vacancy) {
    const confirmed = window.confirm(
      t('vac.confirmDelete', { title: vacancy.title }),
    );
    if (!confirmed) return;
    await updateVacancy(vacancy, 'DELETE');
  }

  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return vacancies.filter((v) => {
      if (filter === 'active' && !v.is_active) return false;
      if (filter === 'inactive' && v.is_active) return false;
      return !q || [v.title, v.city, v.major, v.company].join(' ').toLocaleLowerCase().includes(q);
    });
  }, [vacancies, filter, search]);

  const activeCount = vacancies.filter((v) => v.is_active).length;

  return (
    <div className="w-full">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t('vac.title')}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {state === 'ok'
              ? vacancies.length
                ? t('vac.summary', { total: vacancies.length, active: activeCount })
                : t('vac.none')
              : ' '}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          <Plus size={16} />
          {t('vac.add')}
        </button>
      </header>

      {state === 'ok' && vacancies.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('vac.searchPlaceholder')}
            aria-label={t('vac.searchLabel')}
            className="h-10 min-w-55 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5"
          />
          <div className="flex h-10 items-center gap-0.5 rounded-lg bg-zinc-100 p-1" role="group" aria-label={t('vac.statusGroup')}>
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`h-8 rounded-md px-3 text-sm font-medium transition-colors ${
                  filter === f ? 'bg-white text-zinc-900 ring-1 ring-zinc-200' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {f === 'all' ? t('common.all') : f === 'active' ? t('vac.active') : t('vac.inactive')}
              </button>
            ))}
          </div>
        </div>
      )}

      {state === 'loading' && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-zinc-100" />
          ))}
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-200 bg-white/60 px-6 py-16 text-center">
          <h2 className="text-base font-semibold text-zinc-900">{t('vac.loadFailed')}</h2>
          <p className="max-w-sm text-sm text-zinc-600">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {actionError && (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {state === 'ok' && vacancies.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white/60 px-6 py-16 text-center">
          <EmptyBoxAnimation />
          <h2 className="text-base font-semibold text-zinc-900">{t('vac.emptyTitle')}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t('vac.emptyHint')}</p>
        </div>
      )}

      {state === 'ok' && vacancies.length > 0 && visible.length === 0 && (
        <div className="py-6 text-center text-sm text-zinc-500">
          <EmptyBoxAnimation />
          <p>{t('vac.notFound')}</p>
        </div>
      )}

      {state === 'ok' && visible.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4">
          {visible.map((v) => (
            <VacancyCard
              key={v.id}
              v={v}
              busy={busyVacancyId === v.id}
              onToggle={() => void updateVacancy(v, 'PATCH', { is_active: !v.is_active })}
              onEdit={() => setEditingVacancy(v)}
              onDelete={() => void deleteVacancy(v)}
            />
          ))}
        </div>
      )}

      {addModalOpen && (
        <AddVacancyModal onClose={() => setAddModalOpen(false)} onCreated={reload} />
      )}
      {editingVacancy && (
        <EditVacancyModal
          vacancy={editingVacancy}
          onClose={() => setEditingVacancy(null)}
          onUpdated={reload}
        />
      )}
    </div>
  );
}
