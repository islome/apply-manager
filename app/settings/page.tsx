'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { safeHttpUrl } from '@/lib/applications';
import { formatDate } from '@/lib/vacancies';
import EditProfileModal, { type HrProfile } from './EditProfileModal';

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
      <dd className="min-w-0 break-words text-zinc-900">{children}</dd>
    </div>
  );
}

const empty = <span className="text-zinc-500">Kiritilmagan</span>;

// +998901234567 -> +998 90 123 45 67 (display only)
const formatPhone = (p: string) => p.replace(/^(\+998)(\d{2})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5');

export default function SettingsPage() {
  const [profile, setProfile] = useState<HrProfile | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/hr/profile', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error(`Profilni yuklab bo'lmadi (${response.status})`);
      // the API answers 200 with null while this HR has not saved a profile yet
      const data = (await response.json()) as HrProfile | null;
      setProfile(data);
      setStatus(data ? 'ok' : 'empty');
    } catch (e) {
      setError((e as Error).message || "Tarmoq xatosi — ulanishni tekshirib, qayta urinib ko'ring.");
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Reload, then tell the header (DashboardShell) to refresh the company name and logo.
  const onSaved = useCallback(async () => {
    await load();
    window.dispatchEvent(new Event('company:updated'));
  }, [load]);

  const retry = () => {
    setStatus('loading');
    void load();
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Sozlamalar</h1>
        <p className="text-sm text-zinc-500">Kompaniya profili va HR ma&apos;lumotlari.</p>
      </header>

      <div className="max-w-2xl">
        {status === 'loading' && (
          <div className="h-72 animate-pulse rounded-xl bg-black/5" aria-busy="true" />
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 px-6 py-14 text-center">
            <h2 className="text-base font-semibold text-zinc-900">Profilni yuklab bo&apos;lmadi</h2>
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

        {status === 'empty' && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 px-6 py-14 text-center">
            <h2 className="text-base font-semibold text-zinc-900">Profil to&apos;ldirilmagan</h2>
            <p className="max-w-sm text-sm text-zinc-600">
              Kompaniya nomi va HR ma&apos;lumotlarini kiriting, ular sarlavhada ko&apos;rinadi.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
            >
              Profilni to&apos;ldirish
            </button>
          </div>
        )}

        {status === 'ok' && profile && (
          <section className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <Logo key={profile.logo_url ?? profile.company_name ?? ''} name={profile.company_name ?? ''} url={profile.logo_url} />
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-semibold tracking-tight text-zinc-900">
                    {profile.company_name || 'Nomsiz kompaniya'}
                  </h2>
                  <p className="text-sm text-zinc-500">Kompaniya profili</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
              >
                <Pencil size={16} />
                Tahrirlash
              </button>
            </div>

            <dl className="mt-5 divide-y divide-zinc-100 border-t border-zinc-100">
              <Row label="Kompaniya nomi">{profile.company_name || empty}</Row>
              <Row label="Xodimlar soni">{profile.employees ?? empty}</Row>
              <Row label="HR ismi">{profile.hr_name || empty}</Row>
              <Row label="HR telefoni">
                {profile.hr_phone ? (
                  <a className="text-blue-600 hover:underline" href={`tel:${profile.hr_phone.replace(/\s/g, '')}`}>
                    {formatPhone(profile.hr_phone)}
                  </a>
                ) : (
                  empty
                )}
              </Row>
              <Row label="Yangilangan">{profile.updated_at ? formatDate(profile.updated_at) : empty}</Row>
            </dl>
          </section>
        )}
      </div>

      {modalOpen && (
        <EditProfileModal profile={profile} onClose={() => setModalOpen(false)} onSaved={onSaved} />
      )}
    </div>
  );
}
