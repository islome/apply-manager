'use client';

import { useMemo, useRef, useState, type DragEvent } from 'react';
import { useApplications } from '@/hooks/useApplications';
import {
  STAGES,
  applicationsToCsv,
  matchesSearch,
  personName,
  stageById,
  type Application,
  type StageId,
} from '@/lib/applications';
import ApplicantCard from './ApplicantCard';
import ApplicantDetails from './ApplicantDetails';
import ApplicantList from './ApplicantList';
import { DownloadIcon, SearchIcon } from './icons';

const PAGE = 20; // cards shown per column before "Show more"

type StageFilter = 'all' | StageId;
type View = 'board' | 'list';

export default function ApplicantsBoard() {
  const { applications, state, error, move, retry } = useApplications();

  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<StageFilter>('all');
  const [vacancyId, setVacancyId] = useState('all');
  const [view, setView] = useState<View>('board');
  const [openId, setOpenId] = useState<string | null>(null);
  const [limits, setLimits] = useState<Partial<Record<StageId, number>>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<StageId | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }

  /* ---------------------------------------------------------- derived data */
  const vacancies = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of applications) if (a.vacancy) map.set(a.vacancy.id, a.vacancy.title);
    return Array.from(map, ([id, title]) => ({ id, title })).sort((x, y) => x.title.localeCompare(y.title));
  }, [applications]);

  // search + vacancy applied; the stage chips show counts for exactly this set
  const base = useMemo(
    () =>
      applications.filter(
        (a) => (vacancyId === 'all' || a.vacancy_id === vacancyId) && matchesSearch(a, search)
      ),
    [applications, vacancyId, search]
  );

  const byStage = useMemo(() => {
    const groups: Record<StageId, Application[]> = { new: [], confirmed: [], interview: [], hired: [], cancel: [] };
    for (const a of base) groups[a.status].push(a);
    for (const id of Object.keys(groups) as StageId[]) {
      groups[id].sort((x, y) => new Date(y.updated_at).getTime() - new Date(x.updated_at).getTime());
    }
    return groups;
  }, [base]);

  const listRows = useMemo(
    () => (stage === 'all' ? base : byStage[stage]),
    [base, byStage, stage]
  );

  const opened = openId ? applications.find((a) => a.id === openId) ?? null : null;

  /* --------------------------------------------------------------- actions */
  async function moveTo(id: string, target: StageId) {
    const a = applications.find((x) => x.id === id);
    if (!a) return;
    const res = await move(id, target);
    if (res.ok) notify(`${personName(a)} moved to ${stageById(target).label}`);
    else if (res.message) notify(res.message);
  }

  function onDragStart(e: DragEvent<HTMLElement>, id: string) {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDragId(id);
  }
  function onDragEnd() {
    setDragId(null);
    setOverStage(null);
  }
  function onDrop(e: DragEvent<HTMLElement>, target: StageId) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragId;
    setDragId(null);
    setOverStage(null);
    if (id) void moveTo(id, target);
  }

  function exportCsv() {
    const blob = new Blob([applicationsToCsv(listRows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `job-appliers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Downloaded ${listRows.length} applicants as CSV`);
  }

  /* ---------------------------------------------------------------- render */
  const shownStages = stage === 'all' ? STAGES : STAGES.filter((s) => s.id === stage);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Job Appliers</h1>
          <p className="text-slate-500">Search, filter, and move candidates between hiring stages.</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={state !== 'ok' || listRows.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-900 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <DownloadIcon className="h-[17px] w-[17px]" />
          CSV
        </button>
      </header>

      {state === 'ok' && error && (
        <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          <span>Couldn&apos;t refresh ({error}). Showing the last loaded data.</span>
          <button type="button" onClick={retry} className="rounded-lg px-2.5 py-1 font-semibold hover:bg-amber-100">
            Retry
          </button>
        </div>
      )}

      {/* toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Search applicants</span>
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, vacancy, major, phone or @username"
            className="h-11 w-full rounded-[14px] text-black border border-slate-200 bg-white pl-10 pr-3.5 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <select
          value={vacancyId}
          onChange={(e) => setVacancyId(e.target.value)}
          aria-label="Filter by vacancy"
          className="h-11 max-w-[260px] text-black rounded-[14px] border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        >
          <option value="all">All vacancies</option>
          {vacancies.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title}
            </option>
          ))}
        </select>

        <div className="flex gap-1 rounded-[14px] border border-slate-200 bg-white p-1" role="group" aria-label="View">
          {(['board', 'list'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`h-9 min-w-16 rounded-[10px] px-3 text-sm font-semibold capitalize ${
                view === v ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* stage filter chips with counts */}
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by stage">
        <button
          type="button"
          onClick={() => setStage('all')}
          aria-pressed={stage === 'all'}
          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
            stage === 'all'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'
          }`}
        >
          All
          <span className={`rounded-full px-2 py-0.5 text-xs ${stage === 'all' ? 'bg-white/20' : 'bg-slate-100'}`}>
            {base.length}
          </span>
        </button>
        {STAGES.map((s) => {
          const active = stage === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStage(active ? 'all' : s.id)}
              aria-pressed={active}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                active
                  ? `${s.soft} ${s.text} border-transparent ring-1 ${s.ring}`
                  : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
              {s.label}
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs ring-1 ring-black/5">{byStage[s.id].length}</span>
            </button>
          );
        })}
      </div>

      {/* body */}
      {state === 'loading' && (
        <div className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-4 overflow-x-auto" aria-busy="true">
          {STAGES.map((s) => (
            <div key={s.id} className="h-[420px] animate-pulse rounded-3xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <h2 className="text-lg font-bold text-slate-900">Couldn&apos;t load applicants</h2>
          <p className="max-w-sm text-slate-500">{error}</p>
          <button type="button" onClick={retry} className="h-11 rounded-full bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700">
            Try again
          </button>
        </div>
      )}

      {state === 'ok' && applications.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <h2 className="text-lg font-bold text-slate-900">No applications yet</h2>
          <p className="mt-1 text-slate-500">When candidates apply through the bot, they show up here.</p>
        </div>
      )}

      {state === 'ok' && applications.length > 0 && view === 'list' && (
        <ApplicantList rows={listRows} onOpen={setOpenId} onMove={(id, s) => void moveTo(id, s)} />
      )}

      {state === 'ok' && applications.length > 0 && view === 'board' && (
        <div
          className={
            stage === 'all'
              ? 'grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-4 overflow-x-auto pb-3'
              : 'grid max-w-md grid-cols-1 gap-4 pb-3'
          }
        >
          {shownStages.map((s) => {
            const items = byStage[s.id];
            const limit = limits[s.id] ?? PAGE;
            const over = overStage === s.id;
            return (
              <section
                key={s.id}
                aria-labelledby={`stage-${s.id}`}
                className={`flex h-[calc(100vh-22rem)] min-h-[380px] flex-col rounded-3xl border border-t-4 border-slate-200 bg-slate-100/70 p-3 transition ${s.bar} ${
                  over ? 'bg-blue-50 ring-2 ring-blue-400 ring-offset-2' : ''
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (overStage !== s.id) setOverStage(s.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverStage(null);
                }}
                onDrop={(e) => onDrop(e, s.id)}
              >
                <div className="flex items-center justify-between px-1 pb-3 pt-1">
                  <h2 id={`stage-${s.id}`} className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </h2>
                  <span className="min-w-7 rounded-full bg-white px-2 py-0.5 text-center text-xs font-semibold text-slate-500 shadow-sm">
                    {items.length}
                  </span>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain pr-0.5">
                  {items.slice(0, limit).map((a) => (
                    <ApplicantCard
                      key={a.id}
                      a={a}
                      dragging={dragId === a.id}
                      onOpen={setOpenId}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                    />
                  ))}

                  {items.length === 0 && (
                    <p className="grid flex-1 place-items-center rounded-2xl border border-dashed border-slate-300 px-3 py-8 text-center text-sm text-slate-400">
                      {base.length === applications.length ? 'Drop candidates here' : 'No matches'}
                    </p>
                  )}

                  {items.length > limit && (
                    <button
                      type="button"
                      onClick={() => setLimits((l) => ({ ...l, [s.id]: limit + PAGE }))}
                      className="shrink-0 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                    >
                      Show more ({items.length - limit})
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <ApplicantDetails
        a={opened}
        onClose={() => setOpenId(null)}
        onMove={(id, s) => void moveTo(id, s)}
        onNotify={notify}
      />

      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-lg transition ${
          toast ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        {toast}
      </div>
    </div>
  );
}
