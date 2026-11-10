'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useT } from '@/i18n/LanguageProvider';

/**
 * "Clear the whole history" confirmation. Deleting is permanent, so the button only unlocks
 * after the HR types the confirmation word (TOZALASH / CLEAR / ОЧИСТИТЬ).
 */
export default function ClearLogDialog({
  total,
  onConfirm,
  onClose,
}: {
  total: number;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const word = t('logs.clearWord');
  const ok = typed.trim().toLocaleUpperCase() === word.toLocaleUpperCase();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  function close() {
    if (busy) return;
    ref.current?.close();
    onClose();
  }

  async function confirm() {
    if (!ok || busy) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      ref.current?.close();
    } catch (e) {
      setError((e as Error).message || t('common.networkError'));
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="clear-log-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="m-auto w-[min(440px,calc(100vw-2rem))] rounded-2xl border border-zinc-200/80 bg-white p-0 text-zinc-900 shadow-overlay backdrop:bg-zinc-950/25 backdrop:backdrop-blur-[2px] open:animate-peek-in motion-reduce:open:animate-none"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void confirm();
        }}
        className="p-6"
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-rose-50 text-rose-600">
          <AlertTriangle size={18} />
        </span>
        <h2 id="clear-log-title" className="mt-4 text-lg font-semibold tracking-tight">
          {t('logs.clearTitle')}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{t('logs.clearText', { n: total })}</p>

        <label htmlFor="clear-word" className="mt-5 block text-[13px] font-medium text-zinc-700">
          {t('logs.clearTypeLabel', { word })}
        </label>
        <input
          id="clear-word"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={word}
          className="mt-2 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm uppercase tracking-wide outline-none transition-[border-color,box-shadow] placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-300 focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10"
        />

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={!ok || busy}
            className="h-10 rounded-lg bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? t('common.saving') : t('logs.clearButton')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
