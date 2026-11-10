'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pencil, Settings } from 'lucide-react';
import { safeHttpUrl } from '@/lib/applications';
import { formatDate } from '@/lib/vacancies';
import { useLanguage } from '@/i18n/LanguageProvider';
import EditProfileModal, { type HrProfile } from './EditProfileModal';
import AccountSection from './AccountSection';

type Status = 'loading' | 'ok' | 'empty' | 'error';

function Logo({ name, url }: { name: string; url: string | null }) {
  const src = safeHttpUrl(url);
  const [failed, setFailed] = useState(false);

  return (
    <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 text-xl font-semibold text-zinc-600">
      {name.charAt(0).toUpperCase() || '·'}
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element -- user-provided URL
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full bg-white object-cover"
        />
      )}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-3 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="min-w-0 wrap-break-word text-zinc-900">{children}</dd>
    </div>
  );
}

// +998901234567 -> +998 90 123 45 67 (display only)
const formatPhone = (p: string) => p.replace(/^(\+998)(\d{2})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5');

export default function SettingsPage() {
  const { lang, t } = useLanguage();
  const empty = <span className="text-zinc-500">{t('common.notSet')}</span>;
  const [profile, setProfile] = useState<HrProfile | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorStatus, setErrorStatus] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  // setState only runs inside promise callbacks, never synchronously in the effect body.
  // The error is kept as a status code (0 = network) and turned into text at render time.
  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/hr/profile', { credentials: 'same-origin', cache: 'no-store', signal: ctrl.signal })
      .then(async (response) => {
        if (!response.ok) {
          setErrorStatus(response.status);
          setStatus('error');
          return;
        }
        // the API answers 200 with null while this HR has not saved a profile yet
        const data = (await response.json()) as HrProfile | null;
        setProfile(data);
        setStatus(data ? 'ok' : 'empty');
      })
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        setErrorStatus(0);
        setStatus('error');
      });
    return () => ctrl.abort();
  }, [reloadKey]);

  useEffect(() => {
    fetch('/api/hr/account', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { username?: string } | null) => {
        if (d?.username) setUsername(d.username);
      })
      .catch(() => {});
  }, []);

  // Reload, then tell the header (DashboardShell) to refresh the company name and logo.
  const onSaved = useCallback(async () => {
    setReloadKey((k) => k + 1);
    window.dispatchEvent(new Event('company:updated'));
  }, []);

  const retry = () => {
    setStatus('loading');
    setReloadKey((k) => k + 1);
  };

  const showAccountSection = accountOpen && Boolean(username);

  const accountSettingsButton = (
    <button
      type="button"
      onClick={() => setAccountOpen((open) => !open)}
      aria-label={t('set.accountSettings')}
      aria-expanded={accountOpen}
      aria-controls="account-section"
      title={t('set.accountSettings')}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
    >
      <Settings size={18} strokeWidth={1.5} />
    </button>
  );

  return (
    <div className="w-full">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t('set.title')}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t('set.subtitle')}</p>
        </div>
        {status !== 'ok' && accountSettingsButton}
      </header>

      <div
        className={`grid max-w-6xl grid-cols-1 gap-6 transition-[grid-template-columns] duration-300 ease-in-out motion-reduce:transition-none ${
          showAccountSection
            ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
            : 'xl:grid-cols-[minmax(0,672px)_minmax(0,0fr)]'
        }`}
      >
        {status === 'loading' && (
          <div className="h-72 animate-pulse rounded-xl bg-zinc-100" aria-busy="true" />
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-200 bg-white/60 px-6 py-16 text-center">
            <h2 className="text-base font-semibold text-zinc-900">{t('set.loadFailed')}</h2>
            <p className="max-w-sm text-sm text-zinc-600">{errorStatus ? t('set.loadFailedStatus', { status: errorStatus }) : t('common.networkError')}</p>
            <button
              type="button"
              onClick={retry}
              className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        {status === 'empty' && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-200 bg-white/60 px-6 py-16 text-center">
            <h2 className="text-base font-semibold text-zinc-900">{t('set.emptyTitle')}</h2>
            <p className="max-w-sm text-sm text-zinc-600">
              {t('set.emptyText')}
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              {t('set.fillProfile')}
            </button>
          </div>
        )}

        {status === 'ok' && profile && (
          <div className="w-full max-w-2xl">
            <section className="rounded-xl border border-zinc-200/80 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <Logo key={profile.logo_url ?? profile.company_name ?? ''} name={profile.company_name ?? ''} url={profile.logo_url} />
                  <div className="min-w-0">
                    <h2 className="wrap-break-word text-lg font-semibold tracking-tight text-zinc-900">
                      {profile.company_name || t('set.unnamed')}
                    </h2>
                    <p className="text-sm text-zinc-500">{t('set.companyProfile')}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                  >
                    <Pencil size={16} />
                    {t('common.edit')}
                  </button>
                  {accountSettingsButton}
                </div>
              </div>

              <dl className="mt-5 divide-y divide-zinc-100 border-t border-zinc-100">
                <Row label={t('set.companyName')}>{profile.company_name || empty}</Row>
                <Row label={t('set.employees')}>{profile.employees ?? empty}</Row>
                <Row label={t('set.hrName')}>{profile.hr_name || empty}</Row>
                <Row label={t('set.hrPhone')}>
                  {profile.hr_phone ? (
                    <a className="text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900" href={`tel:${profile.hr_phone.replace(/\s/g, '')}`}>
                      {formatPhone(profile.hr_phone)}
                    </a>
                  ) : (
                    empty
                  )}
                </Row>
                <Row label={t('set.updated')}>{profile.updated_at ? formatDate(profile.updated_at, lang) : empty}</Row>
              </dl>
            </section>
          </div>
        )}
        <div
          id="account-section"
          aria-hidden={!showAccountSection}
          inert={!showAccountSection}
          className={`grid overflow-hidden transition-[grid-template-rows,opacity,transform] duration-300 ease-in-out motion-reduce:transition-none ${
            showAccountSection
              ? 'grid-rows-[1fr] translate-y-0 opacity-100'
              : 'grid-rows-[0fr] -translate-y-2 opacity-0'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            {username && <AccountSection username={username} onRenamed={setUsername} />}
          </div>
        </div>
      </div>

      {modalOpen && (
        <EditProfileModal profile={profile} onClose={() => setModalOpen(false)} onSaved={onSaved} />
      )}
    </div>
  );
}
