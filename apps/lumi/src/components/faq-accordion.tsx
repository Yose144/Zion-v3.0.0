'use client';

import { ChevronDown } from 'lucide-react';
import type { Localized } from '@/lib/i18n';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';

export interface FaqItem {
  q: Localized;
  a: Localized;
  category?: Localized;
}

export default function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  const { lang } = useLang();
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
      {items.map((item, index) => (
        <details key={index} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-[0.95rem] font-semibold text-ink marker:hidden hover:bg-ink/[0.03]">
            <span>{pick(item.q, lang)}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform duration-300 group-open:rotate-180" />
          </summary>
          <div className="px-5 pb-5 text-sm leading-relaxed text-ink-soft">{pick(item.a, lang)}</div>
        </details>
      ))}
    </div>
  );
}
