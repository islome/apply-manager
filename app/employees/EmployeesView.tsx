'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BadgeCheck, CalendarPlus, ChevronRight, Pencil, Plus, Search, UserMinus, UsersRound } from 'lucide-react';
import { useEmployees } from '@/hooks/useEmployees';
import { getCached } from '@/lib/data-cache';
import { initials } from '@/lib/applications';
import { employeeSalary, tenureLabel, type Employee } from '@/lib/employees';
import { formatDate } from '@/i18n/format';
import { useLanguage } from '@/i18n/LanguageProvider';
import type { MessageKey } from '@/i18n/messages';
import EmptyBoxAnimation from '../EmptyBoxAnimation';
import EmployeeEditModal from './EmployeeEditModal';

type Filter = 'active' | 'left' | 'all';
type Sort = 'newest' | 'name' | 'salary';

const FILTERS: { id: Filter; label: MessageKey }[] = [
  { id: 'active', label: 'emp.fActive' },
  { id: 'left', label: 'emp.fLeft' },
  { id: 'all', label: 'emp.fAll' },
];
const SORTS: { id: Sort; label: MessageKey }[] = [
  { id: 'newest', label: 'emp.sortNewest' },
  { id: 'name', label: 'emp.sortName' },
  { id: 'salary', label: 'emp.sortSalary' },
];

function Avatar({ e, size = 'h-9 w-9' }: { e: Employee; size?: string }) {
  const photo = e.candidate?.photo_url;
  return (
    <span
      className={`${size} grid shrink-0 place-items-center overflow-hidden rounded-full text-xs font-semibold ${
        e.status === 'left' ? 'bg-zinc-100 text-zinc-500' : 'bg-zinc-100 text-zinc-700'
      }`}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initials(e.full_name)
      )}
    </span>
  );
}

function StatusBadge({ status }: { status: Employee['status'] }) {
  const { t } = useLanguage();
  const active = status === 'active';
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${
        active ? "text-zinc-700" : "text-zinc-500"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
      {t(active ? 'emp.statusActive' : 'emp.statusLeft')}
    </span>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  href,
  current,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  /** makes the whole tile a link */
  href?: string;
  /** the tile for the page you are on */
  current?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2">
        <p className="flex-1 text-xs font-medium text-zinc-500">{label}</p>
        {href ? (
          <ChevronRight size={16} className="text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-900" />
        ) : (
          <span className="text-zinc-300" aria-hidden="true">{icon}</span>
        )}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-zinc-900">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>}
    </>
  );
  const base = `px-5 py-5 ${current ? "bg-zinc-50" : "bg-white"}`;
  if (!href) return <div className={base} aria-current={current ? 'page' : undefined}>{body}</div>;
  return (
    <Link
      href={href}
      className={`${base} group block transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-400`}
    >
      {body}
    </Link>
  );
}

export default function EmployeesView({ mode }: { mode: 'hired' | 'company' }) {
  const { t, lang } = useLanguage();
  const { employees: all, state, errorStatus, retry, save, add } = useEmployees();
  const company = mode === 'company';
  // /employees = people hired through the pipeline; /employees/company = everyone, incl. added by hand
  const employees = useMemo(() => (company ? all : all.filter((e) => e.source === 'application')), [all, company]);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<Filter>('active');
  const [sort, setSort] = useState<Sort>('newest');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Employee | null>(null);
  // Date.now() must not run while prerendering: it is read lazily (cache hit) or after the first fetch
  const [nowMs, setNowMs] = useState<number | null>(() => (getCached('employees') ? Date.now() : null));

  // Company headcount lives in the profile (Settings); the DB trigger moves it when someone is hired / leaves.
  const [headcount, setHeadcount] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch('/api/hr/profile', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: { employees?: unknown } | null) => {
        if (!alive) return;
        setHeadcount(typeof p?.employees === 'number' ? p.employees : null);
        setNowMs(Date.now());
      })
      .catch(() => {
        if (!alive) return;
        setHeadcount(null);
        setNowMs(Date.now());
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const stats = useMemo(() => {
    const month = nowMs == null ? '' : new Date(nowMs).toISOString().slice(0, 7);
    return {
      active: employees.filter((e) => e.status === 'active').length,
      left: employees.filter((e) => e.status === 'left').length,
      thisMonth: month ? employees.filter((e) => e.hired_at.startsWith(month)).length : 0,
    };
  }, [employees, nowMs]);

  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    const rows = employees.filter((e) => {
      if (filter !== 'all' && e.status !== filter) return false;
      return !q || [e.full_name, e.position, e.department, e.phone].join(' ').toLocaleLowerCase().includes(q);
    });
    return rows.sort((a, b) => {
      if (sort === 'name') return a.full_name.localeCompare(b.full_name, lang);
      if (sort === 'salary') return (b.salary ?? -1) - (a.salary ?? -1);
      return b.hired_at.localeCompare(a.hired_at) || b.created_at.localeCompare(a.created_at);
    });
  }, [employees, filter, sort, search, lang]);

  const num = (n: number | null) => (n == null ? '—' : String(n));
  const showControls = state === 'ok' && employees.length > 0;

  return (
    <div className="w-full">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          {company && (
            <Link
              href="/employees"
              className="mb-3 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900"
            >
              <ArrowLeft size={15} /> {t('emp.back')}
            </Link>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {t(company ? 'emp.companyTitle' : 'emp.title')}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{t(company ? 'emp.companySubtitle' : 'emp.subtitle')}</p>
        </div>
        {company && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            <Plus size={16} />
            {t('emp.add')}
          </button>
        )}
      </header>

      <section
        aria-label={t("emp.title")}
        className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-200/80 lg:grid-cols-4"
      >
        <Kpi
          icon={<UsersRound size={16} strokeWidth={1.75} />}
          label={t('emp.kpiCompany')}
          value={num(headcount)}
          hint={t(company ? 'emp.kpiCompanyHintHere' : 'emp.kpiCompanyHint')}
          href={company ? undefined : '/employees/company'}
          current={company}
        />
        <Kpi
          icon={<BadgeCheck size={16} strokeWidth={1.75} />}
          label={t('emp.kpiActive')}
          value={state === 'ok' ? String(stats.active) : '—'}
          hint={t('emp.kpiActiveHint')}
        />
        <Kpi
          icon={<CalendarPlus size={16} strokeWidth={1.75} />}
          label={t('emp.kpiMonth')}
          value={state === 'ok' ? String(stats.thisMonth) : '—'}
        />
        <Kpi
          icon={<UserMinus size={16} strokeWidth={1.75} />}
          label={t('emp.kpiLeft')}
          value={state === 'ok' ? String(stats.left) : '—'}
        />
      </section>

      {showControls && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-55 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('emp.searchPh')}
              aria-label={t('emp.searchLabel')}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5"
            />
          </div>
          <div className="flex h-10 items-center gap-0.5 rounded-lg bg-zinc-100 p-1" role="group" aria-label={t('emp.statusGroup')}>
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
                {t(f.label)}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label={t('emp.sortLabel')}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {t(s.label)}
              </option>
            ))}
          </select>
        </div>
      )}

      {state === 'loading' && (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100" />
          ))}
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-200 bg-white/60 px-6 py-16 text-center">
          <h2 className="text-base font-semibold text-zinc-900">{t('emp.loadFailed')}</h2>
          <p className="max-w-sm text-sm text-zinc-600">
            {errorStatus ? t('emp.loadFailedStatus', { status: errorStatus }) : t('common.networkError')}
          </p>
          <button
            type="button"
            onClick={retry}
            className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {state === 'ok' && employees.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white/60 px-6 py-16 text-center">
          <EmptyBoxAnimation />
          <h2 className="text-base font-semibold text-zinc-900">{t('emp.emptyTitle')}</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-600">{t(company ? 'emp.emptyHintCompany' : 'emp.emptyHint')}</p>
        </div>
      )}

      {showControls && visible.length === 0 && (
        <div className="py-6 text-center text-sm text-zinc-500">
          <EmptyBoxAnimation />
          <p>{t('emp.notFound')}</p>
        </div>
      )}

      {showControls && visible.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-zinc-200/80 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/60 text-xs font-medium text-zinc-500">
                <tr>
                  <th scope="col" className="px-4 py-3">{t('emp.colEmployee')}</th>
                  <th scope="col" className="px-4 py-3">{t('emp.colPosition')}</th>
                  <th scope="col" className="px-4 py-3">{t('emp.colHired')}</th>
                  <th scope="col" className="px-4 py-3 text-right">{t('emp.colSalary')}</th>
                  <th scope="col" className="px-4 py-3">{t('emp.colStatus')}</th>
                  <th scope="col" className="w-12 px-2 py-3"><span className="sr-only">{t('common.edit')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {visible.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => setEditing(e)}
                    className={`group cursor-pointer transition-colors hover:bg-zinc-50/70 ${e.status === 'left' ? 'text-zinc-500' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar e={e} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-medium text-zinc-900">
                            <span className="truncate">{e.full_name}</span>
                            {company && e.source === 'manual' && (
                              <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                {t('emp.sourceManual')}
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-zinc-500">
                            {e.phone ?? (e.candidate?.username ? `@${e.candidate.username}` : '—')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate">{e.position || <span className="text-zinc-400">{t('emp.noPosition')}</span>}</p>
                      {e.department && <p className="truncate text-xs text-zinc-500">{e.department}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="whitespace-nowrap">{formatDate(e.hired_at, lang)}</p>
                      <p className="text-xs text-zinc-500">
                        {e.status === 'left' && e.left_at
                          ? t('emp.leftOn', { date: formatDate(e.left_at, lang) })
                          : nowMs == null ? "" : tenureLabel(e, t, nowMs)}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{employeeSalary(e, t)}</td>
                    <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                    <td className="px-2 py-3 text-right">
                      <button
                        type="button"
                        aria-label={t('emp.moreLabel', { name: e.full_name })}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setEditing(e);
                        }}
                        className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-white hover:text-zinc-900 group-hover:text-zinc-600"
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="grid gap-2 md:hidden">
            {visible.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setEditing(e)}
                  className="w-full rounded-xl border border-zinc-200/80 bg-white p-4 text-left transition-colors hover:border-zinc-300"
                >
                  <div className="flex items-start gap-3">
                    <Avatar e={e} size="h-10 w-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-900">{e.full_name}</p>
                      <p className="truncate text-sm text-zinc-500">{e.position || t('emp.noPosition')}</p>
                    </div>
                    <StatusBadge status={e.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 text-xs">
                    <div>
                      <dt className="text-zinc-500">{t('emp.colHired')}</dt>
                      <dd className="mt-0.5 font-medium text-zinc-800">{formatDate(e.hired_at, lang)}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">{t('emp.colSalary')}</dt>
                      <dd className="mt-0.5 font-medium tabular-nums text-zinc-800">{employeeSalary(e, t)}</dd>
                    </div>
                  </dl>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {adding && (
        <EmployeeEditModal
          key="new"
          employee={null}
          headcount={headcount}
          onClose={() => setAdding(false)}
          onSave={save}
          onCreate={add}
          onStatusChanged={() => setReloadKey((k) => k + 1)}
        />
      )}
      {editing && (
        <EmployeeEditModal
          key={editing.id}
          employee={editing}
          headcount={headcount}
          onClose={() => setEditing(null)}
          onSave={save}
          onStatusChanged={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
