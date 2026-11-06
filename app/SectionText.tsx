'use client';

import { useT } from '@/i18n/LanguageProvider';
import type { MessageKey } from '@/i18n/messages';

/** Renders one translated string; lets server components stay server components. */
export default function SectionText({ k }: { k: MessageKey }) {
  const t = useT();
  return <>{t(k)}</>;
}
