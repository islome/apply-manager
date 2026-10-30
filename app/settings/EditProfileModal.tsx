'use client';

import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { safeHttpUrl } from '@/lib/applications';

export type HrProfile = {
  company_name: string | null;
  logo_url: string | null;
  employees: number | null;
  hr_name: string | null;
  hr_phone: string | null;
  updated_at?: string | null;
};

type Props = {
  profile: HrProfile | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

const fieldClass =
  'mt-1.5 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export default function EditProfileModal({ profile, onClose, onSaved }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [logoUrl, setLogoUrl] = useState(profile?.logo_url ?? '');
  const [logoFailed, setLogoFailed] = useState(false);

  const logoSrc = safeHttpUrl(logoUrl.trim());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const formData = new FormData(event.currentTarget);
    const employeesValue = String(formData.get('employees') ?? '').trim();
    const payload = {
      company_name: String(formData.get('company_name') ?? '').trim(),
      logo_url: String(formData.get('logo_url') ?? '').trim() || null,
      employees: employeesValue ? Number(employeesValue) : null,
      hr_name: String(formData.get('hr_name') ?? '').trim(),
      hr_phone: String(formData.get('hr_phone') ?? '').trim(),
    };

    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/hr/profile', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(result?.error ?? `Profilni saqlab bo'lmadi (${response.status})`);
        return;
      }

      await onSaved();
      onClose();
    } catch {
      setError("Tarmoq xatosi — ulanishni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/30 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-lg sm:p-6"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 id="edit-profile-title" className="text-lg font-semibold text-zinc-900">
              {profile ? 'Profilni tahrirlash' : "Profilni to'ldirish"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">Kompaniya va HR ma&apos;lumotlari.</p>
          </div>
          <button
            type="button"
            aria-label="Yopish"
            disabled={busy}
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </p>
          )}

          <label className="block text-sm font-medium text-zinc-700">
            Kompaniya nomi
            <input
              name="company_name"
              required
              minLength={2}
              maxLength={80}
              defaultValue={profile?.company_name ?? ''}
              className={fieldClass}
            />
          </label>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Logo (havola)
              <input
                name="logo_url"
                type="url"
                maxLength={500}
                value={logoUrl}
                onChange={(e) => {
                  setLogoUrl(e.target.value);
                  setLogoFailed(false);
                }}
                placeholder="https://…"
                className={fieldClass}
              />
            </label>
            {logoSrc && !logoFailed && (
              <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
                {/* eslint-disable-next-line @next/next/no-img-element -- user-provided URL, preview only */}
                <img
                  src={logoSrc}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setLogoFailed(true)}
                  className="h-10 w-10 rounded-lg border border-zinc-200 object-cover"
                />
                Ko&apos;rinishi
              </div>
            )}
            {logoUrl.trim() && (!logoSrc || logoFailed) && (
              <p className="mt-2 text-xs text-amber-700">Rasm ochilmadi. Havolani tekshiring.</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-zinc-700">
              Xodimlar soni
              <input
                name="employees"
                type="number"
                min={1}
                max={1000000}
                step={1}
                defaultValue={profile?.employees ?? ''}
                placeholder="Ixtiyoriy"
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              HR ismi
              <input
                name="hr_name"
                required
                minLength={2}
                maxLength={80}
                defaultValue={profile?.hr_name ?? ''}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
              HR telefoni
              <input
                name="hr_phone"
                type="tel"
                required
                pattern="\+?[0-9\s()\-]{7,20}"
                title="Masalan: +998 90 123 45 67"
                defaultValue={profile?.hr_phone ?? ''}
                placeholder="+998 90 123 45 67"
                className={fieldClass}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="h-10 rounded-lg border border-zinc-200 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={busy}
              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Saqlanmoqda…' : 'Saqlash'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
