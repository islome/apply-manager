// Language-aware formatting helpers (dates, money, "x min ago").
import { LOCALES, type Lang } from './types';
import type { TFunction } from './LanguageProvider';

export function formatDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(LOCALES[lang], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** "Just now", "12 min ago", "3 h ago", "2 d ago", then a plain date. */
export function timeAgo(iso: string, t: TFunction, lang: Lang, now: number = Date.now()): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '—';
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 60) return t('time.justNow');
  const m = Math.floor(s / 60);
  if (m < 60) return t('time.minAgo', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('time.hourAgo', { n: h });
  const d = Math.floor(h / 24);
  if (d < 7) return t('time.dayAgo', { n: d });
  return formatDate(iso, lang);
}
