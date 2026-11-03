'use client';

import { useState, type FormEvent } from 'react';
import { KeyRound, UserRound } from 'lucide-react';

const fieldClass =
  'mt-1.5 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';
const buttonClass =
  'h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60';

type Msg = { kind: 'ok' | 'err'; text: string } | null;

function Notice({ msg }: { msg: Msg }) {
  if (!msg) return null;
  const tone =
    msg.kind === 'ok'
      ? 'border-green-200 bg-green-50 text-green-800'
      : 'border-red-200 bg-red-50 text-red-700';
  return (
    <p role={msg.kind === 'err' ? 'alert' : 'status'} className={`rounded-lg border px-3.5 py-2.5 text-sm ${tone}`}>
      {msg.text}
    </p>
  );
}

async function patchAccount(body: Record<string, string>): Promise<{ username?: string }> {
  let res: Response;
  try {
    res = await fetch('/api/hr/account', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Tarmoq xatosi — ulanishni tekshirib, qayta urinib ko'ring.");
  }
  const data = (await res.json().catch(() => null)) as { error?: string; username?: string } | null;
  if (!res.ok) throw new Error(data?.error ?? `Saqlab bo'lmadi (${res.status})`);
  return data ?? {};
}

export default function AccountSection({ username, onRenamed }: { username: string; onRenamed: (u: string) => void }) {
  const [busy, setBusy] = useState<'user' | 'pass' | null>(null);
  const [userMsg, setUserMsg] = useState<Msg>(null);
  const [passMsg, setPassMsg] = useState<Msg>(null);

  async function saveUsername(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy('user');
    setUserMsg(null);
    try {
      const r = await patchAccount({
        username: String(fd.get('username') ?? ''),
        current_password: String(fd.get('current_password') ?? ''),
      });
      onRenamed(r.username ?? username);
      form.reset();
      setUserMsg({ kind: 'ok', text: 'Username yangilandi.' });
    } catch (err) {
      setUserMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function savePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const next = String(fd.get('new_password') ?? '');
    if (next !== String(fd.get('confirm_password') ?? '')) {
      setPassMsg({ kind: 'err', text: 'Yangi parollar bir xil emas.' });
      return;
    }
    setBusy('pass');
    setPassMsg(null);
    try {
      await patchAccount({ new_password: next, current_password: String(fd.get('current_password') ?? '') });
      form.reset();
      setPassMsg({ kind: 'ok', text: 'Parol yangilandi.' });
    } catch (err) {
      setPassMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
          <UserRound size={18} /> Username
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Hozirgi: <span className="font-medium text-zinc-900">{username}</span>
        </p>
        <form onSubmit={saveUsername} className="mt-4 space-y-4">
          <Notice msg={userMsg} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-zinc-700">
              Yangi username
              <input
                name="username"
                required
                minLength={3}
                maxLength={32}
                pattern="[A-Za-z0-9._\-]{3,32}"
                autoComplete="username"
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Joriy parol
              <input name="current_password" type="password" required autoComplete="current-password" className={fieldClass} />
            </label>
          </div>
          <button type="submit" disabled={busy !== null} className={buttonClass}>
            {busy === 'user' ? 'Saqlanmoqda…' : 'Usernameni saqlash'}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
          <KeyRound size={18} /> Parolni almashtirish
        </h2>
        <p className="mt-1 text-sm text-zinc-500">Kamida 8 ta belgi.</p>
        <form onSubmit={savePassword} className="mt-4 space-y-4">
          <Notice msg={passMsg} />
          <label className="block text-sm font-medium text-zinc-700">
            Joriy parol
            <input name="current_password" type="password" required autoComplete="current-password" className={fieldClass} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-zinc-700">
              Yangi parol
              <input name="new_password" type="password" required minLength={8} maxLength={200} autoComplete="new-password" className={fieldClass} />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Yangi parolni takrorlang
              <input name="confirm_password" type="password" required minLength={8} maxLength={200} autoComplete="new-password" className={fieldClass} />
            </label>
          </div>
          <button type="submit" disabled={busy !== null} className={buttonClass}>
            {busy === 'pass' ? 'Saqlanmoqda…' : 'Parolni saqlash'}
          </button>
        </form>
      </section>
    </div>
  );
}
