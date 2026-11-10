'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useT } from '@/i18n/LanguageProvider';
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
  const t = useT();
  const src = safeHttpUrl(url);
  const [failed, setFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = previewRef.current;
    if (!dialog) return;
    if (previewOpen && !dialog.open) dialog.showModal();
    if (!previewOpen && dialog.open) dialog.close();
  }, [previewOpen]);

  return (
    <>
      <span
        className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-zinc-100 font-medium text-zinc-600 ${className}`}
      >
        {initials(name)}
        {src && !failed && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- Telegram CDN urls, not worth a remotePatterns entry */}
            <img
              src={src}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <button
              type="button"
              aria-label={t('app.viewPhoto', { name })}
              onClick={(event) => {
                event.stopPropagation();
                setPreviewOpen(true);
              }}
              onDragStart={(event) => event.preventDefault()}
              className="absolute inset-0 cursor-zoom-in rounded-full"
            />
          </>
        )}
      </span>
      {src && (
        <dialog
          ref={previewRef}
          aria-label={t('app.viewPhoto', { name })}
          onClose={() => setPreviewOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) previewRef.current?.close();
          }}
          className="m-auto max-h-none max-w-none overflow-visible border-0 bg-transparent p-0 text-white backdrop:bg-zinc-950/60 backdrop:backdrop-blur-md"
        >
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- Telegram CDN urls, not worth a remotePatterns entry */}
            <img
              src={src}
              alt={name}
              referrerPolicy="no-referrer"
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-overlay"
            />
            <button
              type="button"
              onClick={() => previewRef.current?.close()}
              aria-label={t('common.close')}
              className="absolute -right-3 -top-3 grid h-9 w-9 place-items-center rounded-full bg-white text-zinc-800 shadow-overlay transition-colors hover:bg-zinc-100"
            >
              <X size={18} />
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
