'use client';

import { LANGS } from './types';
import { useLanguage } from './LanguageProvider';

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useLanguage();
  return (
    <div role="group" aria-label={t('common.language')} className={`inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 ${className}`}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={l === lang}
          onClick={() => setLang(l)}
          className={`h-7 rounded-md px-2.5 text-xs font-semibold uppercase transition-colors ${
            l === lang ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
