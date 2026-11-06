'use client';

import { useT } from '@/i18n/LanguageProvider';
import LanguageSwitcher from '@/i18n/LanguageSwitcher';

export default function LoginIntro() {
  const t = useT();
  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="text-lg font-bold tracking-tight text-slate-900">JobBor</div>
        <LanguageSwitcher />
      </div>
      <h1 className="text-[22px] font-bold tracking-tight text-slate-900">{t('login.title')}</h1>
      <p className="mb-6 mt-1 text-slate-500">{t('login.subtitle')}</p>
    </>
  );
}
