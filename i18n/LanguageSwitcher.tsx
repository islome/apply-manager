'use client';

import { LANGS } from './types';
import { useLanguage } from './LanguageProvider';

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useLanguage();
  return (
    <div role="group" aria-label={t('common.language')} className={`inline-flex rounded-lg bg-zinc-200/50 p-0.5 ${className}`}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={l === lang}
          onClick={() => setLang(l)}
          className={`h-7 rounded-md px-2.5 text-[11px] font-medium uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
            l === lang
              ? 'bg-white text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-zinc-200/70'
              : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
