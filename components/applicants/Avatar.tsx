'use client';

import { useState } from 'react';
import { initials, safeHttpUrl } from '@/lib/applications';

/** Telegram photo when we have one, neutral initials otherwise (or if the photo fails to load). */
export default function Avatar({
  name,
  url,
  className = 'h-9 w-9 text-xs',
}: {
  name: string;
  url?: string | null;
  className?: string;
}) {
  const src = safeHttpUrl(url);
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-zinc-100 font-medium text-zinc-600 ${className}`}
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
