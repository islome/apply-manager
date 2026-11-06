'use client';

import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { CITIES, MAJORS } from '@/lib/vacancy-options';

type Props = {
  onClose: () => void;
  onCreated: () => Promise<void>;
};

const fieldClass =
  'mt-1.5 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export default function AddVacancyModal({ onClose, onCreated }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const formData = new FormData(event.currentTarget);
    const salaryMin = String(formData.get('salary_min') ?? '').trim();
    const salaryMax = String(formData.get('salary_max') ?? '').trim();
    const payload = {
      title: String(formData.get('title') ?? ''),
      city: String(formData.get('city') ?? ''),
      major: String(formData.get('major') ?? ''),
      employment_type: String(formData.get('employment_type') ?? ''),
      salary_min: salaryMin ? Number(salaryMin) : null,
      salary_max: salaryMax ? Number(salaryMax) : null,
      salary_currency: String(formData.get('salary_currency') ?? ''),
      description: String(formData.get('description') ?? ''),
      requirements: String(formData.get('requirements') ?? ''),
      is_active: formData.get('is_active') === 'on',
    };

    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/hr/vacancies', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(result?.error ?? `Vakansiyani yaratib bo'lmadi (${response.status})`);
        return;
      }

      await onCreated();
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
        aria-labelledby="add-vacancy-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-lg sm:p-6"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 id="add-vacancy-title" className="text-lg font-semibold text-zinc-900">
              Vakansiya qo'shish
            </h2>
            <p className="mt-1 text-sm text-zinc-500">Vakansiya ma'lumotlarini kiriting.</p>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-zinc-700">
              Lavozim nomi
              <input name="title" required minLength={2} maxLength={120} className={fieldClass} />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Shahar
              <select name="city" required defaultValue="" className={fieldClass}>
                <option value="" disabled>Tanlang</option>
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Yo'nalish
              <select name="major" required defaultValue="" className={fieldClass}>
                <option value="" disabled>Tanlang</option>
                {MAJORS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Bandlik turi
              <select name="employment_type" defaultValue="full_time" className={fieldClass}>
                <option value="full_time">To'liq kun</option>
                <option value="part_time">Yarim kun</option>
                <option value="remote">Masofaviy</option>
                <option value="internship">Amaliyot</option>
              </select>
            </label>
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
              <label className="text-sm font-medium text-zinc-700">
                Minimal maosh
                <input
                  name="salary_min"
                  type="number"
                  min={0}
                  step={1}
                  className={fieldClass}
                  placeholder="Ixtiyoriy"
                />
              </label>
              <label className="text-sm font-medium text-zinc-700">
                Maksimal maosh
                <input
                  name="salary_max"
                  type="number"
                  min={0}
                  step={1}
                  className={fieldClass}
                  placeholder="Ixtiyoriy"
                />
              </label>
              <label className="text-sm font-medium text-zinc-700">
                Valyuta
                <select name="salary_currency" defaultValue="UZS" className={fieldClass}>
                  <option value="UZS">UZS</option>
                  <option value="USD">USD</option>
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 self-end pb-2.5 text-sm font-medium text-zinc-700">
              <input name="is_active" type="checkbox" defaultChecked className="size-4 accent-blue-600" />
              Faol
            </label>
          </div>

          <label className="block text-sm font-medium text-zinc-700">
            Tavsif
            <textarea
              name="description"
              required
              maxLength={4000}
              rows={4}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-700">
            Talablar
            <textarea
              name="requirements"
              maxLength={4000}
              rows={3}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </label>

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
              {busy ? 'Saqlanmoqda…' : "Qo'shish"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
