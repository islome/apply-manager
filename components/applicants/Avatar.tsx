'use client';

import { useState } from 'react';
import { initials, safeHttpUrl } from '@/lib/applications';

const TINTS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

function tint(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

/** Telegram photo when we have one, coloured initials otherwise (or if the photo fails to load). */
export default function Avatar({
  name,
  url,
  className = 'h-12 w-12 text-sm',
}: {
  name: string;
  url?: string | null;
  className?: string;
}) {
  const src = safeHttpUrl(url);
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold ${tint(name)} ${className}`}
    >
      {initials(name)}
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element -- Telegram CDN urls, not worth a remotePatterns entry
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
}
