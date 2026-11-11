'use client';

import { useLangT } from '@/lib/useTranslation';

/**
 * Časová osa ZION TerraNova (2008 → 2040).
 *
 * Devět milníků je vypálených přímo v ilustraci, proto se nad obrázkem nic
 * neduplikuje — jen se doplní přístupný textový ekvivalent (`.sr-only`
 * seznam navázaný na obrázek přes `aria-describedby`), aby obsah dostali
 * i čtečky obrazovky.
 *
 * Ilustrace má poměr 3 : 1 a devět popisků. Na telefonu by při zmenšení na
 * šířku displeje nebyla čitelná, proto se posouvá vodorovně **uvnitř své
 * sekce** (`overflow-x` na `.zion-timeline-scroll`); stránka jako celek
 * vodorovně nescrolluje. Posuvná oblast je fokusovatelná (`tabIndex={0}`),
 * takže ji lze ovládat i klávesnicí (šipky / PageDown).
 */
export default function TimelineSection() {
  const { t } = useLangT();

  // Pořadí = pořadí milníků na ilustraci.
  const milestones = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9'];

  return (
    <section aria-labelledby="zion-timeline-heading" className="space-y-3">
      <h2 id="zion-timeline-heading" className="zion-kicker">
        {t('timeline.heading')}
      </h2>

      <div
        className="zion-timeline-scroll"
        role="region"
        aria-label={t('timeline.region')}
        tabIndex={0}
      >
        <img
          src="/zion-timeline-2008-2040.webp"
          alt={t('timeline.alt')}
          width={2172}
          height={724}
          loading="lazy"
          decoding="async"
          aria-describedby="zion-timeline-milestones"
        />
      </div>

      {/* Na telefonu je vidět jen část osy — bez nápovědy by nebylo jasné,
          že se dá posouvat. Na desktopu se celá vejde, proto se skrývá. */}
      <p className="text-[11px] text-gray-500 md:hidden">{t('timeline.scrollHint')}</p>

      <ol id="zion-timeline-milestones" className="sr-only">
        {milestones.map((key) => (
          <li key={key}>{t(`timeline.${key}`)}</li>
        ))}
      </ol>
    </section>
  );
}
