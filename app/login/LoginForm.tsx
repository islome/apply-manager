'use client';

import { useState, type FormEvent } from 'react';
import { safeNext } from '@/lib/hr-redirect';
import { useT } from '@/i18n/LanguageProvider';

export default function LoginForm() {
  const t = useT();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!username.trim() || !password) {
      setError(t('login.enterBoth'));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/hr/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (res.ok) {
        // Full navigation (not router.push) so the proxy and layouts see the fresh cookie.
        // window.location is read here, in the handler, so the page stays statically renderable.
        const next = new URLSearchParams(window.location.search).get('next');
        window.location.assign(safeNext(next));
        return; // keep the button disabled while the browser navigates
      }
      let msg = t(mode === 'login' ? 'login.failed' : 'login.registerFailed', { status: res.status });
      try {
        const j = (await res.json()) as { error?: string };
        if (j?.error) msg = j.error;
      } catch {
        /* keep the generic message */
      }
      setError(msg);
    } catch {
      setError(t('common.networkError'));
    }
    setBusy(false);
  }

  const inputClass =
    'h-[46px] w-full rounded-[14px] border border-slate-200 bg-white px-3.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

  return (
    <>
      <div className="mb-5 grid grid-cols-2 rounded-full bg-slate-100 p-1">
        <button
          type="button"
          disabled={busy}
          aria-pressed={mode === 'login'}
          onClick={() => {
            setMode('login');
            setError('');
          }}
          className={`h-10 rounded-full text-sm font-semibold transition-colors ${
            mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          {t('login.signIn')}
        </button>
        <button
          type="button"
          disabled={busy}
          aria-pressed={mode === 'register'}
          onClick={() => {
            setMode('register');
            setError('');
          }}
          className={`h-10 rounded-full text-sm font-semibold transition-colors ${
            mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          {t('login.signUp')}
        </button>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error && (
          <div role="alert" className="rounded-[14px] bg-red-50 px-3.5 py-2.5 font-medium text-red-600">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="username" className="mb-2 block text-[13px] font-semibold text-slate-900">
            {t('login.username')}
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-2 block text-[13px] font-semibold text-slate-900">
            {t('login.password')}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={mode === 'register' ? 8 : undefined}
            className={inputClass}
          />
          {mode === 'register' && (
            <p className="mt-1.5 text-xs text-slate-500">{t('login.passwordHint')}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="mt-1 h-[46px] rounded-full bg-blue-600 font-semibold text-white shadow-md hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy
            ? t(mode === 'login' ? 'login.signingIn' : 'login.creating')
            : t(mode === 'login' ? 'login.signIn' : 'login.create')}
        </button>
      </form>
    </>
  );
}
