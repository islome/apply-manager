'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useT } from '@/i18n/LanguageProvider';
import type { StageDraft } from '@/hooks/useStages';
import {
  MAX_LABEL,
  MAX_STAGES,
  STAGE_COLORS,
  isCore,
  isFinal,
  isSuccess,
  orderStages,
  stageName,
  type Stage,
} from '@/lib/stages';

type Row = { id: string; key?: string; label: string | null; color: string };

type Props = {
  stages: Stage[];
  /** applications per stage key, to block deleting a stage that is in use */
  counts: Record<string, number>;
  migrated: boolean;
  onSave: (stages: StageDraft[]) => Promise<unknown>;
  onClose: (saved: boolean) => void;
};

let uid = 0;
const nextId = () => `row-${++uid}`;

const iconButton =
  'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-30';

function ColorPicker({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {STAGE_COLORS.map((c, i) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={t('stages.colorName', { n: i + 1 })}
          onClick={() => onChange(c)}
          className={`h-6 w-6 rounded-full transition-[box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 ${
            value === c ? 'scale-110 ring-2 ring-zinc-900 ring-offset-2' : 'hover:scale-110'
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

function Badge({ children, tone = 'neutral' }: { children: string; tone?: 'neutral' | 'success' }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
        tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Modal for the HR's pipeline stages. Edits a local draft; nothing is saved until "Save".
 * Core stages (New / Hired / Cancelled) can be renamed and recoloured but not moved or deleted.
 */
export default function StageManager({ stages, counts, migrated, onSave, onClose }: Props) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const initial = useMemo(() => stages.map((s) => ({ ...s, id: nextId() })), [stages]);
  const [rows, setRows] = useState<Row[]>(initial);
  const [editing, setEditing] = useState<{ id: string; name: string; color: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(
    () => STAGE_COLORS.find((c) => !stages.some((s) => s.color === c)) ?? STAGE_COLORS[STAGE_COLORS.length - 1],
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const strip = (list: Row[]) => list.map(({ key, label, color }) => ({ key, label, color }));
  const dirty = JSON.stringify(strip(rows)) !== JSON.stringify(strip(initial));
  const full = rows.length >= MAX_STAGES;

  function requestClose() {
    if (busy) return;
    if (dirty && !window.confirm(t('stages.discard'))) return;
    ref.current?.close();
    onClose(false);
  }

  /* ---------------------------------------------------------------- editing */
  function startEdit(row: Row) {
    setError('');
    setEditing({ id: row.id, name: stageName({ key: row.key ?? '', label: row.label }, t), color: row.color });
  }

  function commitEdit() {
    if (!editing) return;
    const row = rows.find((r) => r.id === editing.id);
    if (!row) return setEditing(null);
    const name = editing.name.trim().replace(/\s+/g, ' ');
    const known = row.key ? stageName({ key: row.key, label: null }, t) : '';
    const builtIn = !!row.key && known !== row.key; // has a translated default name

    let label: string | null;
    if (!name) {
      if (!builtIn) return setError(t('stages.nameRequired'));
      label = null; // back to the default name
    } else {
      label = builtIn && name === known ? null : name;
    }
    setRows((list) => list.map((r) => (r.id === row.id ? { ...r, label, color: editing.color } : r)));
    setEditing(null);
    setError('');
  }

  function onEditKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    }
  }

  /* ------------------------------------------------------------ list actions */
  function move(id: string, dir: -1 | 1) {
    setRows((list) => {
      const i = list.findIndex((r) => r.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      if (isCore(list[j].key ?? '') || isCore(list[i].key ?? '')) return list;
      const copy = [...list];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  function remove(id: string) {
    setRows((list) => list.filter((r) => r.id !== id));
    if (editing?.id === id) setEditing(null);
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim().replace(/\s+/g, ' ');
    if (!name) return setError(t('stages.nameRequired'));
    if (full) return;
    setRows((list) => {
      // new stages go to the end of the middle part, just before Hired
      const at = list.findIndex((r) => r.key === 'hired');
      const copy = [...list];
      copy.splice(at < 0 ? copy.length : at, 0, { id: nextId(), label: name.slice(0, MAX_LABEL), color: newColor });
      return copy;
    });
    setNewName('');
    setNewColor((c) => STAGE_COLORS[(STAGE_COLORS.indexOf(c as (typeof STAGE_COLORS)[number]) + 1) % STAGE_COLORS.length]);
    setError('');
  }

  async function save() {
    if (busy || !dirty || editing) return;
    setBusy(true);
    setError('');
    try {
      const ordered = orderStages(rows.map((r) => ({ key: r.key ?? `__${r.id}`, label: r.label, color: r.color })));
      await onSave(ordered.map((s) => ({ key: s.key.startsWith('__') ? undefined : s.key, label: s.label, color: s.color })));
      ref.current?.close();
      onClose(true);
    } catch (err) {
      setError((err as Error).message || t('common.networkError'));
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="stages-title"
      onCancel={(e) => {
        e.preventDefault(); // Esc: leave edit mode first, then ask before dropping changes
        if (editing) setEditing(null);
        else requestClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
      className="m-auto max-h-[90dvh] w-[min(560px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-0 text-zinc-900 shadow-overlay backdrop:bg-zinc-950/25 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex max-h-[90dvh] flex-col">
        {/* header */}
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
          <div>
            <h2 id="stages-title" className="text-lg font-semibold tracking-tight">
              {t('stages.title')}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">{t('stages.subtitle')}</p>
          </div>
          <button type="button" onClick={requestClose} aria-label={t('common.close')} className={iconButton}>
            <X size={18} />
          </button>
        </div>

        {/* stages */}
        <ol className="min-h-0 flex-1 divide-y divide-zinc-100 overflow-y-auto px-6">
          {rows.map((row, i) => {
            const key = row.key ?? '';
            const core = isCore(key);
            const count = row.key ? (counts[row.key] ?? 0) : 0;
            const prevCore = i === 0 || isCore(rows[i - 1].key ?? '');
            const nextCore = i === rows.length - 1 || isCore(rows[i + 1].key ?? '');
            const isEditing = editing?.id === row.id;
            const name = stageName({ key, label: row.label }, t);

            return (
              <li key={row.id} className="animate-fade-up py-3.5 motion-reduce:animate-none">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: editing.color }} />
                      <input
                        autoFocus
                        value={editing.name}
                        maxLength={MAX_LABEL}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        onKeyDown={onEditKey}
                        aria-label={t('stages.name')}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/5"
                      />
                      <button
                        type="button"
                        onClick={commitEdit}
                        aria-label={t('stages.done')}
                        title={t('stages.done')}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-zinc-900 text-white transition-colors hover:bg-zinc-800"
                      >
                        <Check size={16} />
                      </button>
                    </div>
                    <div className="pl-[18px]">
                      <ColorPicker
                        value={editing.color}
                        onChange={(color) => setEditing({ ...editing, color })}
                        label={t('stages.name')}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">{name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {key === 'new' && <Badge>{t('stages.core')}</Badge>}
                        {isSuccess(key) && <Badge tone="success">{t('stages.success')}</Badge>}
                        {isFinal(key) && <Badge>{t('stages.final')}</Badge>}
                        <span className="text-xs tabular-nums text-zinc-400">{t('stages.count', { n: count })}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => move(row.id, -1)}
                        disabled={core || prevCore}
                        aria-label={t('stages.up')}
                        title={core ? t('stages.fixedPosition') : t('stages.up')}
                        className={iconButton}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(row.id, 1)}
                        disabled={core || nextCore}
                        aria-label={t('stages.down')}
                        title={core ? t('stages.fixedPosition') : t('stages.down')}
                        className={iconButton}
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        aria-label={t('common.edit')}
                        title={t('common.edit')}
                        className={iconButton}
                      >
                        <Pencil size={15} />
                      </button>
                      <span title={core ? t('stages.cantDeleteCore') : count ? t('stages.cantDeleteBusy', { n: count }) : undefined}>
                        <button
                          type="button"
                          onClick={() => remove(row.id)}
                          disabled={core || count > 0}
                          aria-label={t('common.delete')}
                          className={`${iconButton} hover:bg-rose-50 hover:text-rose-600`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {/* add a stage */}
        <form onSubmit={add} className="border-t border-zinc-100 px-6 py-5">
          <label htmlFor="new-stage" className="text-[13px] font-medium text-zinc-700">
            {t('stages.addTitle')}
          </label>
          <div className="mt-2 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <span
                aria-hidden="true"
                className="absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: newColor }}
              />
              <input
                id="new-stage"
                value={newName}
                maxLength={MAX_LABEL}
                disabled={full}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={full ? t('stages.limit', { n: MAX_STAGES }) : t('stages.addPh')}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/5 disabled:bg-zinc-50"
              />
            </div>
            <button
              type="submit"
              disabled={full || !newName.trim()}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} />
              {t('stages.add')}
            </button>
          </div>
          <div className="mt-3">
            <ColorPicker value={newColor} onChange={setNewColor} label={t('stages.addTitle')} />
          </div>
        </form>

        {/* footer */}
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-6 py-4">
          {!migrated && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t('stages.migrate')}
            </p>
          )}
          {error && (
            <p role="alert" className="mb-3 animate-fade-up rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !dirty || !migrated || !!editing}
              className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? t('common.saving') : t('stages.save')}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
