import { pick, type Localized } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Nadpis sekce. Server i klient — jazyk se předává explicitně, aby šel použít
 * i v serverových stránkách (metadata, statické sekce).
 */
export default function SectionHeading({
  kicker,
  title,
  lead,
  lang,
  align = 'left',
  className,
}: {
  kicker?: Localized;
  title: Localized;
  lead?: Localized;
  lang: Lang;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      {kicker ? <p className="eyebrow">{pick(kicker, lang)}</p> : null}
      <h2 className={cn('h2 mt-3 text-balance', align === 'center' && 'mx-auto')}>{pick(title, lang)}</h2>
      {lead ? <p className="lead mt-4 text-pretty text-ink-soft">{pick(lead, lang)}</p> : null}
    </div>
  );
}
