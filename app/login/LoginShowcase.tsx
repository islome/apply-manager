'use client';

import Image from 'next/image';
import { useT } from '@/i18n/LanguageProvider';

// "An abstract photo of a curved building" by Tim Stief, free under the Unsplash License.
const PHOTO_SRC = 'https://images.unsplash.com/photo-1548248823-ce16a73b6d49?auto=format&fit=crop&w=2000&q=80';
const PHOTO_PAGE =
  'https://unsplash.com/photos/an-abstract-photo-of-a-curved-building-with-a-blue-sky-in-the-background-dH6IjhWHNQQ';

/** Left half of the login page: full-bleed photo with the brand and a short line on top. */
export default function LoginShowcase() {
  const t = useT();
  return (
    <aside className="relative hidden w-1/2 overflow-hidden bg-zinc-950 lg:block">
      <Image
        src={PHOTO_SRC}
        alt=""
        fill
        priority
        sizes="50vw"
        className="animate-image-in object-cover motion-reduce:animate-none"
      />

      {/* keeps the text readable over the bright sky and the dark facade */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-black/70" />

      <div className="relative flex h-full flex-col justify-between p-10 text-white xl:p-12">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/90 backdrop-blur">
            <Image src="/logo.png" alt="" width={20} height={20} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">JobBor</span>
        </div>

        <div className="max-w-md">
          <p className="text-3xl font-semibold leading-tight tracking-tight text-balance xl:text-4xl">
            {t('login.tagline')}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/70">{t('login.taglineSub')}</p>
          <a
            href={PHOTO_PAGE}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-block text-xs text-white/50 transition-colors hover:text-white/80"
          >
            {t('login.photo')}: Tim Stief / Unsplash
          </a>
        </div>
      </div>
    </aside>
  );
}
