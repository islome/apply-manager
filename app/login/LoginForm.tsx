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
    'h-11 w-full rounded-lg border border-zinc-200 bg-white px-3.5 text-sm text-zinc-900 outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/5';
  const isRegister = mode === 'register';

  function switchTo(next: 'login' | 'register') {
    setMode(next);
    setError('');
  }

  return (
    <>
      {/* Heading changes with the mode; `key` replays the fade so the switch feels deliberate */}
      <div key={mode} className="mb-8 animate-fade-up motion-reduce:animate-none">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-zinc-900">
          {t(isRegister ? 'login.createTitle' : 'login.welcomeTitle')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          {t(isRegister ? 'login.createSub' : 'login.welcomeSub')}
        </p>
      </div>

      {/* Segmented switch with a sliding thumb */}
      <div className="relative mb-8 grid grid-cols-2 rounded-xl bg-zinc-100 p-1">
        <span
          aria-hidden="true"
          className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-[0_1px_3px_rgb(0_0_0/0.08)] ring-1 ring-zinc-200/60 transition-transform duration-500 ease-smooth motion-reduce:transition-none ${
            isRegister ? 'translate-x-full' : 'translate-x-0'
          }`}
        />
        <button
          type="button"
          disabled={busy}
          aria-pressed={!isRegister}
          onClick={() => switchTo('login')}
          className={`relative z-10 h-9 rounded-lg text-sm font-medium transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
            !isRegister ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          {t('login.signIn')}
        </button>
        <button
          type="button"
          disabled={busy}
          aria-pressed={isRegister}
          onClick={() => switchTo('register')}
          className={`relative z-10 h-9 rounded-lg text-sm font-medium transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
            isRegister ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          {t('login.signUp')}
        </button>
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {error && (
          <div
            role="alert"
            className="animate-fade-up rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700 motion-reduce:animate-none"
          >
            {error}
          </div>
        )}

        <div>
          <label htmlFor="username" className="mb-2 block text-[13px] font-medium text-zinc-700">
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
          <label htmlFor="password" className="mb-2 block text-[13px] font-medium text-zinc-700">
            {t('login.password')}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            minLength={isRegister ? 8 : undefined}
            aria-describedby={isRegister ? 'password-hint' : undefined}
            className={inputClass}
          />
          {/* Hint slides open only for sign-up (height via grid rows, so no layout jump) */}
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-500 ease-smooth motion-reduce:transition-none ${
              isRegister ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <p id="password-hint" className="pt-2 text-xs text-zinc-500">
                {t('login.passwordHint')}
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="group mt-1 flex h-11 items-center justify-center overflow-hidden rounded-lg bg-zinc-900 text-sm font-medium text-white transition-[background-color,transform] duration-200 hover:bg-zinc-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span key={`${mode}-${busy}`} className="animate-fade-up motion-reduce:animate-none">
            {busy
              ? t(isRegister ? 'login.creating' : 'login.signingIn')
              : t(isRegister ? 'login.create' : 'login.signIn')}
          </span>
        </button>
      </form>
    </>
  );
}
