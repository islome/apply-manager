'use client';

import { useMemo, useState } from 'react';
import { Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { useVacancies } from '@/hooks/useVacancies';
import { employmentLabel, formatDate, salaryLabel, type Vacancy } from '@/lib/vacancies';
import NotFoundAnimation from '../NotFoundAnimation';
import EmptyBoxAnimation from '../EmptyBoxAnimation';
import AddVacancyModal from './AddVacancyModal';
import EditVacancyModal from './EditVacancyModal';

type Filter = 'all' | 'active' | 'inactive';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Hammasi' },
  { id: 'active', label: 'Faol' },
  { id: 'inactive', label: 'Nofaol' },
];

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
  return (
    <article
      className={`flex flex-col gap-3.5 rounded-[22px] border border-slate-200 bg-white p-4.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        v.is_active ? '' : 'opacity-75'
      }`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <h3 className="wrap-break-word text-base font-bold leading-snug text-slate-900">{v.title}</h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            v.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {v.is_active ? 'Faol' : 'Nofaol'}
        </span>
      </div>

      <p className="text-[22px] font-bold tracking-tight text-slate-900">{salaryLabel(v)}</p>
      <p className="-mt-1.5 text-[13px] text-slate-500">
        {v.company} · {v.city}
      </p>

      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800">
          {employmentLabel(v.employment_type)}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800">{v.major}</span>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600">
          {v.applications_count} ta ariza
        </span>
      </div>

      <div className="mt-auto border-t border-slate-200 pt-3 text-xs text-slate-500">
        {formatDate(v.created_at)}
      </div>

      <div className="flex flex-wrap gap-2" aria-label={`${v.title} actions`}>
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          aria-pressed={v.is_active}
          className={`inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold disabled:opacity-50 ${
            v.is_active
              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          <Power size={15} />
          {v.is_active ? '' : ''}
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-50 px-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-50 px-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}

export default function VacanciesPage() {
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
        setActionError(result?.error ?? `Could not ${method === 'DELETE' ? 'delete' : 'update'} vacancy (${response.status})`);
        return false;
      }
      await reload();
      return true;
    } catch {
      setActionError('Network error — check your connection and try again.');
      return false;
    } finally {
      setBusyVacancyId(null);
    }
  }

  async function deleteVacancy(vacancy: Vacancy) {
    const confirmed = window.confirm(
      `Delete "${vacancy.title}"? Its associated applications will also be deleted.`,
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
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vacancies</h1>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus size={18} />
            Add vacancy
          </button>
        </div>
        <p className="text-slate-500">
          {state === 'ok'
            ? vacancies.length
              ? `${vacancies.length} ta vakansiya · ${activeCount} tasi faol`
              : "Hali vakansiya qo'shilmagan"
            : ' '}
        </p>
      </header>

      {state === 'ok' && vacancies.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nomi, shahar yoki yo'nalish bo'yicha qidirish"
            aria-label="Vakansiyalarni qidirish"
            className="h-11 min-w-55 flex-1 rounded-[14px] border border-slate-200 bg-white px-3.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
          <div className="flex gap-1 rounded-[14px] border border-slate-200 bg-white p-1" role="group" aria-label="Holat">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={`rounded-[10px] px-3 py-1.5 text-sm font-semibold ${
                  filter === f.id ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {state === 'loading' && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-3.5" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-[22px] border border-slate-200 bg-white" />
          ))}
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <NotFoundAnimation />
          <h2 className="text-lg font-bold text-slate-900">Vakansiyalarni yuklab bo&apos;lmadi</h2>
          <p className="max-w-sm text-slate-500">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="h-11 rounded-full bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700"
          >
            Qayta urinish
          </button>
        </div>
      )}

      {actionError && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {state === 'ok' && vacancies.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <EmptyBoxAnimation />
          <h2 className="text-lg font-bold text-slate-900">Hali vakansiya yo&apos;q</h2>
          <p className="mt-1 text-slate-500">Birinchi vakansiyangizni qo&apos;shing, u shu yerda chiqadi.</p>
        </div>
      )}

      {state === 'ok' && vacancies.length > 0 && visible.length === 0 && (
        <div className="py-6 text-center text-slate-500">
          <EmptyBoxAnimation />
          <p>Hech narsa topilmadi.</p>
        </div>
      )}

      {state === 'ok' && visible.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-3.5">
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
