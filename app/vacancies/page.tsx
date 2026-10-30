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

const iconButton =
  'grid h-8 w-8 place-items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50';
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
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300">
      <div className="flex items-start justify-between gap-3">
        <h3
          className={`wrap-break-word text-base font-semibold leading-snug ${
            v.is_active ? 'text-zinc-900' : 'text-zinc-600'
          }`}
        >
          {v.title}
        </h3>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 pt-0.5 text-xs font-medium ${
            v.is_active ? 'text-emerald-700' : 'text-zinc-500'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${v.is_active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
          {v.is_active ? 'Faol' : 'Nofaol'}
        </span>
      </div>

      <div className="space-y-0.5">
        <p className="text-sm font-medium text-zinc-900">{salaryLabel(v)}</p>
        <p className="text-sm text-zinc-500">
          {v.company} · {v.city}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">{employmentLabel(v.employment_type)}</span>
        <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">{v.major}</span>
        <span className="px-1 text-xs font-medium text-blue-600">{v.applications_count} ta ariza</span>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-3">
        <span className="text-xs text-zinc-500">{formatDate(v.created_at)}</span>
        <div className="-mr-1.5 flex items-center gap-0.5" role="group" aria-label={`${v.title}: amallar`}>
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            aria-pressed={v.is_active}
            aria-label={v.is_active ? 'Nofaol qilish' : 'Faollashtirish'}
            title={v.is_active ? 'Nofaol qilish' : 'Faollashtirish'}
            className={`${iconButton} ${v.is_active ? iconOn : iconNeutral}`}
          >
            <Power size={16} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            aria-label="Tahrirlash"
            title="Tahrirlash"
            className={`${iconButton} ${iconNeutral}`}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            aria-label="O'chirish"
            title="O'chirish"
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
            `Vakansiyani ${method === 'DELETE' ? "o'chirib" : 'yangilab'} bo'lmadi (${response.status})`,
        );
        return false;
      }
      await reload();
      return true;
    } catch {
      setActionError("Tarmoq xatosi — ulanishni tekshirib, qayta urinib ko'ring.");
      return false;
    } finally {
      setBusyVacancyId(null);
    }
  }

  async function deleteVacancy(vacancy: Vacancy) {
    const confirmed = window.confirm(
      `"${vacancy.title}" o'chirilsinmi? Unga tegishli arizalar ham o'chiriladi.`,
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
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Vakansiyalar</h1>
          <p className="text-sm text-zinc-500">
            {state === 'ok'
              ? vacancies.length
                ? `${vacancies.length} ta vakansiya · ${activeCount} tasi faol`
                : "Hali vakansiya qo'shilmagan"
              : ' '}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={16} />
          Vakansiya qo&apos;shish
        </button>
      </header>

      {state === 'ok' && vacancies.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nomi, shahar yoki yo'nalish bo'yicha qidirish"
            aria-label="Vakansiyalarni qidirish"
            className="h-10 min-w-55 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <div className="flex h-10 items-center gap-0.5 rounded-lg bg-black/5 p-1" role="group" aria-label="Holat">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={`h-8 rounded-md px-3 text-sm font-medium transition-colors ${
                  filter === f.id ? 'bg-white text-zinc-900 ring-1 ring-zinc-200' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {state === 'loading' && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-black/5" />
          ))}
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 px-6 py-14 text-center">
          <NotFoundAnimation />
          <h2 className="text-base font-semibold text-zinc-900">Vakansiyalarni yuklab bo&apos;lmadi</h2>
          <p className="max-w-sm text-sm text-zinc-600">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            Qayta urinish
          </button>
        </div>
      )}

      {actionError && (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {state === 'ok' && vacancies.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-14 text-center">
          <EmptyBoxAnimation />
          <h2 className="text-base font-semibold text-zinc-900">Hali vakansiya yo&apos;q</h2>
          <p className="mt-1 text-sm text-zinc-600">Birinchi vakansiyangizni qo&apos;shing, u shu yerda chiqadi.</p>
        </div>
      )}

      {state === 'ok' && vacancies.length > 0 && visible.length === 0 && (
        <div className="py-6 text-center text-sm text-zinc-500">
          <EmptyBoxAnimation />
          <p>Hech narsa topilmadi.</p>
        </div>
      )}

      {state === 'ok' && visible.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-3">
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
