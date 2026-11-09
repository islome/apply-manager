'use client';

import { useState, type FormEvent } from 'react';
import { ArrowRight, UserMinus, UserRoundCheck, X } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { initials } from '@/lib/applications';
import { todayISO, type Employee, type EmployeePatch, type NewEmployee } from '@/lib/employees';
import { formatDate } from '@/i18n/format';
import { useLanguage } from '@/i18n/LanguageProvider';

type Props = {
  /** null = add a new employee by hand */
  employee: Employee | null;
  /** Current company headcount (Settings), null while unknown */
  headcount: number | null;
  onClose: () => void;
  onSave: (id: string, patch: EmployeePatch) => Promise<Employee>;
  onCreate?: (data: NewEmployee) => Promise<Employee>;
  /** Called after a status change so the page can refresh the headcount */
  onStatusChanged: () => void;
};

const field =
  'mt-1.5 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';
const label = 'text-sm font-medium text-zinc-700';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</legend>
      {children}
    </fieldset>
  );
}

function CountShift({ from, to }: { from: number | null; to: number | null }) {
  if (from == null || to == null) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-0.5 text-sm font-semibold tabular-nums text-zinc-900 ring-1 ring-zinc-200">
      {from} <ArrowRight size={13} className="text-zinc-400" /> {to}
    </span>
  );
}

export default function EmployeeEditModal({ employee: existing, headcount, onClose, onSave, onCreate, onStatusChanged }: Props) {
  const { t, lang } = useLanguage();
  const isNew = existing === null;
  const [blank] = useState<Employee>(() => ({
    id: '',
    application_id: null,
    source: 'manual',
    candidate_id: null,
    full_name: '',
    phone: null,
    position: null,
    department: null,
    salary: null,
    salary_currency: 'UZS',
    hired_at: todayISO(),
    status: 'active',
    left_at: null,
    notes: null,
    created_at: '',
    updated_at: '',
  }));
  const employee = existing ?? blank;
  const [addToCount, setAddToCount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [leftAt, setLeftAt] = useState(todayISO());
  const isLeft = employee.status === 'left';

  async function run(patch: EmployeePatch, statusChange: boolean) {
    setBusy(true);
    setError('');
    try {
      if (isNew) {
        await onCreate?.({ ...patch, full_name: patch.full_name ?? '', add_to_count: addToCount });
        onStatusChanged(); // the headcount may have changed
      } else {
        await onSave(employee.id, patch);
        if (statusChange) onStatusChanged();
      }
      onClose();
    } catch (e) {
      setError(
        e instanceof ApiError && e.status !== 0 && e.message
          ? e.message
          : e instanceof ApiError && e.status === 0
            ? t('common.networkError')
            : t('emp.saveFailed', { status: '?' }),
      );
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const f = new FormData(event.currentTarget);
    const text = (k: string) => String(f.get(k) ?? '').trim();
    const salaryRaw = text('salary').replace(/\s/g, '');
    void run(
      {
        full_name: text('full_name'),
        phone: text('phone') || null,
        position: text('position') || null,
        department: text('department') || null,
        hired_at: text('hired_at') || employee.hired_at,
        salary: salaryRaw === '' ? null : Number(salaryRaw),
        salary_currency: text('salary_currency') === 'USD' ? 'USD' : 'UZS',
        notes: text('notes') || null,
      },
      false,
    );
  }

  const photo = employee.candidate?.photo_url;
  const afterLeave = headcount == null ? null : Math.max(headcount - 1, 0);
  const afterRejoin = headcount == null ? null : headcount + 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/30 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-employee-title"
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-xl sm:rounded-2xl"
      >
        <header className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6">
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              initials(employee.full_name)
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="edit-employee-title" className="truncate text-base font-semibold text-zinc-900">
              {t(isNew ? 'emp.addTitle' : 'emp.editTitle')}
            </h2>
            <p className="truncate text-sm text-zinc-500">{isNew ? t('emp.addHint') : employee.full_name}</p>
          </div>
          <button
            type="button"
            aria-label={t('common.close')}
            disabled={busy}
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}

            {!isNew && isLeft && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                {t('emp.leftBanner', { date: employee.left_at ? formatDate(employee.left_at, lang) : '—' })}
              </p>
            )}

            <Section title={t('emp.secPerson')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>
                  {t('emp.fullName')}
                  <input name="full_name" required minLength={2} maxLength={120} defaultValue={employee.full_name} className={field} />
                </label>
                <label className={label}>
                  {t('emp.phone')}
                  <input
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    pattern="\+998[0-9]{9}"
                    defaultValue={employee.phone ?? ''}
                    placeholder={t('emp.phonePh')}
                    className={field}
                  />
                </label>
              </div>
            </Section>

            <Section title={t('emp.secJob')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>
                  {t('emp.position')}
                  <input name="position" maxLength={80} defaultValue={employee.position ?? ''} className={field} />
                </label>
                <label className={label}>
                  {t('emp.department')}
                  <input name="department" maxLength={80} defaultValue={employee.department ?? ''} className={field} />
                </label>
                <label className={label}>
                  {t('emp.hiredAt')}
                  <input name="hired_at" type="date" required defaultValue={employee.hired_at} className={field} />
                </label>
                <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                  <label className={label}>
                    {t('emp.salary')}
                    <input
                      name="salary"
                      inputMode="numeric"
                      pattern="[0-9 ]*"
                      defaultValue={employee.salary ?? ''}
                      placeholder="0"
                      className={`${field} tabular-nums`}
                    />
                  </label>
                  <label className={label}>
                    {t('emp.currency')}
                    <select name="salary_currency" defaultValue={employee.salary_currency} className={field}>
                      <option value="UZS">UZS</option>
                      <option value="USD">USD</option>
                    </select>
                  </label>
                </div>
              </div>
              <label className={`${label} block`}>
                {t('emp.notes')} <span className="font-normal text-zinc-400">· {t('emp.optional')}</span>
                <textarea
                  name="notes"
                  rows={3}
                  maxLength={1000}
                  defaultValue={employee.notes ?? ''}
                  placeholder={t('emp.notesPh')}
                  className="mt-1.5 w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </label>
            </Section>

            {/* Status change: leave / re-hire. Changes the company headcount, so it is explicit. */}
            {isNew ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <input
                  type="checkbox"
                  checked={addToCount}
                  onChange={(e) => setAddToCount(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-blue-600"
                />
                <span className="min-w-0 space-y-1">
                  <span className="block text-sm font-medium text-zinc-900">{t('emp.addToCount')}</span>
                  <span className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                    {t(addToCount ? 'emp.addToCountOn' : 'emp.addToCountOff')}
                    {addToCount && <CountShift from={headcount} to={afterRejoin} />}
                  </span>
                </span>
              </label>
            ) : isLeft ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-zinc-900">{t('emp.rejoin')}</p>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                    {t('emp.rejoinHint', { from: headcount ?? '?', to: afterRejoin ?? '?' })}
                    <CountShift from={headcount} to={afterRejoin} />
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run({ status: 'active' }, true)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-60"
                >
                  <UserRoundCheck size={16} /> {t('emp.rejoin')}
                </button>
              </div>
            ) : leaving ? (
              <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/60 p-4">
                <p className="text-sm font-medium text-red-900">{t('emp.leaveTitle')}</p>
                <p className="flex flex-wrap items-center gap-2 text-sm text-red-800/80">
                  {t('emp.leaveHint', { from: headcount ?? '?', to: afterLeave ?? '?' })}
                  <CountShift from={headcount} to={afterLeave} />
                </p>
                <label className={`${label} block max-w-52`}>
                  {t('emp.leftAt')}
                  <input
                    type="date"
                    value={leftAt}
                    min={employee.hired_at}
                    onChange={(e) => setLeftAt(e.target.value)}
                    className={field}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || !leftAt}
                    onClick={() => void run({ status: 'left', left_at: leftAt }, true)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    <UserMinus size={16} /> {t('emp.confirmLeave')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setLeaving(false)}
                    className="h-9 rounded-lg px-3 text-sm font-medium text-zinc-600 hover:bg-white"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setLeaving(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                <UserMinus size={16} /> {t('emp.markLeft')}
              </button>
            )}
          </div>

          <footer className="flex justify-end gap-2 border-t border-zinc-100 bg-white px-5 py-3 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="h-10 rounded-lg px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? t('common.saving') : t(isNew ? 'emp.addSubmit' : 'common.save')}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
