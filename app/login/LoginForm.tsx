'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import { safeNext } from '@/lib/hr-redirect';
import { normalizePhone } from '@/lib/phone';
import { useT } from '@/i18n/LanguageProvider';

type Mode = 'login' | 'register';
type Step = 'form' | 'phone' | 'code';
type CodeStep = { step: 'code'; challengeId: string; channel: 'sms' | 'dev'; phone: string; resendIn: number };
type Reply = { ok?: true; step?: 'code' | 'phone'; ticket?: string; error?: string } & Partial<Omit<CodeStep, 'step'>>;

/** phoneCodes: false while codes are paused (HR_PHONE_CODES), so sign-up has no phone field. */
export default function LoginForm({ phoneCodes }: { phoneCodes: boolean }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<Step>('form');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [ticket, setTicket] = useState('');
  const [challenge, setChallenge] = useState<CodeStep | null>(null);
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(false);
  const [wait, setWait] = useState(0); // seconds until "send again"
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  // resend countdown
  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function call(path: string, payload: unknown, fallback: Parameters<typeof t>[0]): Promise<Reply | null> {
    try {
      const res = await fetch(path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = ((await res.json().catch(() => null)) ?? {}) as Reply;
      if (res.ok) return json;
      setError(json.error || t(fallback, { status: res.status }));
    } catch {
      setError(t('common.networkError'));
    }
    return null;
  }

  function signedIn() {
    // Full navigation (not router.push) so the proxy and layouts see the fresh cookie.
    // window.location is read here, in the handler, so the page stays statically renderable.
    const next = new URLSearchParams(window.location.search).get('next');
    const target = safeNext(next);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.location.assign(target);
      return;
    }
    // Hand-off (globals.css): the photo blurs away here, then the next page comes into focus
    // (the inline script in app/layout.tsx reads the flag).
    startHandoff();
    window.setTimeout(() => window.location.assign(target), 380);
  }

  /** Blurs the photo here and leaves the exact photo file for the next page to carry over. */
  function startHandoff() {
    const src = document.querySelector<HTMLImageElement>('[data-login-photo] img')?.currentSrc;
    const url = src ? new URL(src) : null;
    // site-relative (/_next/image?...): the only kind the next page accepts, besides the Unsplash CDN
    const photo = url ? (url.origin === window.location.origin ? url.pathname + url.search : url.href) : '1';
    try {
      sessionStorage.setItem('hr-handoff', photo);
    } catch {
      // storage blocked: the next page simply appears without the carry-over
    }
    document.documentElement.dataset.handoff = 'out';
  }

  // Coming back to this page from the browser cache (Back button) must not show the faded photo.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) delete document.documentElement.dataset.handoff;
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  /** Moves on according to what the server answered. Returns true when the page navigates away. */
  function follow(reply: Reply): boolean {
    if (reply.ok) {
      signedIn();
      return true;
    }
    if (reply.step === 'phone' && reply.ticket) {
      setTicket(reply.ticket);
      setStep('phone');
    } else if (reply.step === 'code' && reply.challengeId) {
      setChallenge(reply as CodeStep);
      setCode('');
      setWait(reply.resendIn ?? 60);
      setStep('code');
    }
    return false;
  }

  async function onSubmitForm(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!username.trim() || !password) {
      setError(t('login.enterBoth'));
      return;
    }
    if (mode === 'register' && phoneCodes && !normalizePhone(phone)) {
      setError(t('login.phoneInvalid'));
      return;
    }
    setBusy(true);
    const reply =
      mode === 'login'
        ? await call('/api/hr/login', { username: username.trim(), password }, 'login.failed')
        : await call(
            '/api/hr/register',
            { username: username.trim(), password, ...(phoneCodes ? { phone } : {}) },
            'login.registerFailed',
          );
    if (reply && follow(reply)) return; // keep the button disabled while the browser navigates
    setBusy(false);
  }

  async function onSubmitPhone(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!normalizePhone(phone)) {
      setError(t('login.phoneInvalid'));
      return;
    }
    setBusy(true);
    const reply = await call('/api/hr/otp/phone', { ticket, phone }, 'login.failed');
    if (reply) follow(reply);
    setBusy(false);
  }

  async function verify(value: string) {
    if (busy || !challenge) return;
    setError('');
    setNotice('');
    if (!/^\d{6}$/.test(value)) {
      setError(t('login.enterCode'));
      return;
    }
    setBusy(true);
    const reply = await call('/api/hr/otp/verify', { challengeId: challenge.challengeId, code: value, remember }, 'login.failed');
    if (reply && follow(reply)) return;
    setBusy(false);
    setCode('');
    codeRef.current?.focus();
  }

  async function resend() {
    if (busy || !challenge || wait > 0) return;
    setError('');
    setNotice('');
    setBusy(true);
    const reply = await call('/api/hr/otp/resend', { challengeId: challenge.challengeId }, 'login.failed');
    if (reply) {
      follow(reply);
      setNotice(t('login.resent'));
    }
    setBusy(false);
    codeRef.current?.focus();
  }

  function backToForm() {
    setStep('form');
    setChallenge(null);
    setTicket('');
    setCode('');
    setError('');
    setNotice('');
  }

  function switchTo(next: Mode) {
    setMode(next);
    setError('');
  }

  const inputClass =
    'h-11 w-full rounded-lg border border-zinc-200 bg-white px-3.5 text-sm text-zinc-900 outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/5';
  const primaryClass =
    'group mt-1 flex h-11 items-center justify-center overflow-hidden rounded-lg bg-zinc-900 text-sm font-medium text-white transition-[background-color,transform] duration-200 hover:bg-zinc-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60';
  const isRegister = mode === 'register';
  const showPhone = isRegister && phoneCodes;

  const errorBox = error && (
    <div role="alert" className="animate-fade-up rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700 motion-reduce:animate-none">
      {error}
    </div>
  );

  const backButton = (
    <button
      type="button"
      onClick={backToForm}
      disabled={busy}
      className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 disabled:opacity-50"
    >
      <ArrowLeft size={15} /> {t('login.back')}
    </button>
  );

  /* ------------------------------------------------------------ code step */
  if (step === 'code' && challenge) {
    const sentText =
      challenge.channel === 'sms' ? t('login.codeSentSms', { phone: challenge.phone }) : t('login.codeSentDev');
    const mm = `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}`;
    return (
      <div key="code" className="animate-fade-up motion-reduce:animate-none">
        {backButton}
        <div className="mb-8">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-zinc-900">{t('login.codeTitle')}</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">{sentText}</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify(code);
          }}
          noValidate
          className="flex flex-col gap-5"
        >
          {errorBox}
          {notice && !error && (
            <p role="status" className="animate-fade-up rounded-lg bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-700 motion-reduce:animate-none">
              {notice}
            </p>
          )}
          <div>
            <label htmlFor="otp" className="mb-2 block text-[13px] font-medium text-zinc-700">
              {t('login.code')}
            </label>
            <input
              ref={codeRef}
              id="otp"
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(v);
                if (v.length === 6) void verify(v); // paste or autofill confirms at once
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              autoFocus
              placeholder="••••••"
              className={`${inputClass} h-14 text-center font-mono text-2xl tracking-[0.5em] placeholder:tracking-[0.5em] placeholder:text-zinc-300`}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 accent-zinc-900"
            />
            {t('login.remember')}
          </label>

          <button type="submit" disabled={busy} className={primaryClass}>
            <span key={String(busy)} className="animate-fade-up motion-reduce:animate-none">
              {busy ? t('login.confirming') : t('login.confirm')}
            </span>
          </button>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
            {wait > 0 ? (
              <span className="tabular-nums text-zinc-400">{t('login.resendIn', { s: mm })}</span>
            ) : (
              <button
                type="button"
                onClick={() => void resend()}
                disabled={busy}
                className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 disabled:opacity-50"
              >
                {t('login.resend')}
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  /* -------------------------------------------- add a phone (older accounts) */
  if (step === 'phone') {
    return (
      <div key="phone" className="animate-fade-up motion-reduce:animate-none">
        {backButton}
        <div className="mb-8">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-zinc-900">{t('login.enrollTitle')}</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">{t('login.enrollSub')}</p>
        </div>
        <form onSubmit={onSubmitPhone} noValidate className="flex flex-col gap-5">
          {errorBox}
          <div>
            <label htmlFor="enroll-phone" className="mb-2 block text-[13px] font-medium text-zinc-700">
              {t('login.phone')}
            </label>
            <input
              id="enroll-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              autoFocus
              placeholder="+998 90 123 45 67"
              className={inputClass}
            />
          </div>
          <button type="submit" disabled={busy} className={primaryClass}>
            <span key={String(busy)} className="animate-fade-up motion-reduce:animate-none">
              {busy ? t('login.sending') : t('login.sendCode')}
            </span>
          </button>
        </form>
      </div>
    );
  }

  /* ------------------------------------------------- username + password */
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

      <form onSubmit={onSubmitForm} noValidate className="flex flex-col gap-5">
        {errorBox}

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

        {/* Phone: sign-up only, slides open the same way */}
        <div
          className={`-mt-5 grid transition-[grid-template-rows,opacity] duration-500 ease-smooth motion-reduce:transition-none ${
            showPhone ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
          inert={!showPhone}
        >
          <div className="overflow-hidden">
            <div className="pt-5">
              <label htmlFor="phone" className="mb-2 block text-[13px] font-medium text-zinc-700">
                {t('login.phone')}
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="+998 90 123 45 67"
                aria-describedby="phone-hint"
                className={inputClass}
              />
              <p id="phone-hint" className="pt-2 text-xs text-zinc-500">
                {t('login.phoneHint')}
              </p>
            </div>
          </div>
        </div>

        <button type="submit" disabled={busy} className={primaryClass}>
          <span key={`${mode}-${busy}`} className="animate-fade-up motion-reduce:animate-none">
            {busy
              ? t(isRegister ? (phoneCodes ? 'login.sending' : 'login.creating') : 'login.signingIn')
              : t(isRegister ? 'login.create' : 'login.signIn')}
          </span>
        </button>
      </form>
    </>
  );
}
