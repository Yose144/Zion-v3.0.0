'use client';

import { Flame } from 'lucide-react';
import { FIRE_SAFETY } from '@/lib/fire-safety';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';

function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={index} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

export default function FireSafetyBlock() {
  const { lang } = useLang();
  return (
    <section id="bezpecnost" className="scroll-mt-28">
      <div className="rounded-2xl border border-amber-700/25 bg-amber-500/[0.06] p-6 sm:p-8">
        <h2 className="h3 flex items-center gap-2 text-ink">
          <Flame className="h-5 w-5 text-amber-700" /> {pick(FIRE_SAFETY.title, lang)}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{pick(FIRE_SAFETY.lead, lang)}</p>
        <ol className="mt-4 space-y-2.5 text-sm leading-relaxed text-ink-soft">
          {FIRE_SAFETY.points.map((point, index) => (
            <li key={index} className="flex gap-2.5">
              <span className="shrink-0 font-semibold text-amber-700">{index + 1}.</span>
              <span>{renderBold(pick(point, lang))}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 border-t border-amber-700/20 pt-4 text-xs leading-relaxed text-muted">
          {pick(FIRE_SAFETY.disclaimer, lang)}
        </p>
      </div>
    </section>
  );
}
