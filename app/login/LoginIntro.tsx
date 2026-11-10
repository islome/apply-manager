'use client';

import Image from 'next/image';
import LanguageSwitcher from '@/i18n/LanguageSwitcher';

/** Top bar of the form side: brand (only on small screens, the photo panel shows it on laptops) and language. */
export default function LoginIntro() {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-zinc-900 lg:invisible">
        <Image src="/logo.png" alt="" width={22} height={22} />
        JobBor
      </div>
      <LanguageSwitcher />
    </div>
  );
}
