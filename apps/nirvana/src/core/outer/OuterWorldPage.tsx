'use client';

/**
 * Stránka vnější planety — jedna komponenta pro Uran, Neptun i Pluto.
 *
 * Co tu je: scéna (otočná), dosier s reálnými čísly a text, který říká, proč
 * to místo v Nirvaně existuje. Co tu záměrně **není**: hra. Ne každý svět má
 * být arkáda; po šesti hrách je potřeba mít kam dojít a jen se dívat.
 */

import Link from 'next/link';
import { useI18n } from '@/core/i18n';
import { OuterWorldScene } from './OuterWorldScene';
import { OUTER_WORLDS, type OuterWorldId } from './worlds';

export function OuterWorldPage({ id }: { id: OuterWorldId }) {
  const { lang } = useI18n();
  const cs = lang === 'cs';
  const world = OUTER_WORLDS[id];
  const next = world.next ? OUTER_WORLDS[world.next] : null;

  return (
    <main className={`outer-world is-${id}`}>
      <div className="outer-stage">
        <OuterWorldScene world={world} />
      </div>

      <header className="outer-chrome">
        <div>
          <p className="outer-kicker">{cs ? 'vnější soustava' : 'outer system'}</p>
          <h1>{world.name}</h1>
          <p className="outer-epithet">{world.epithet[lang]}</p>
        </div>
        <Link href="/" className="saturn-back">
          ← {cs ? 'Nirvana' : 'Nirvana'}
        </Link>
      </header>

      <aside className="outer-panel" aria-label={cs ? 'Dosier' : 'Dossier'}>
        <dl className="outer-facts">
          {world.facts.map((fact) => (
            <div key={fact.label.en}>
              <dt>{fact.label[lang]}</dt>
              <dd>{fact.value[lang]}</dd>
            </div>
          ))}
        </dl>

        <p className="outer-lore">{world.lore[lang]}</p>

        <div className="outer-actions">
          {id === 'uranus' && (
            <Link href="/lumi" className="park-btn">
              {cs ? 'Vstoupit k Lumi →' : 'Fly into Wings →'}
            </Link>
          )}
          <Link href="/" className="arena-link">
            ← {cs ? 'zpět do vesmíru' : 'back to the universe'}
          </Link>
          {next && (
            <Link href={`/${next.id}`} className="park-btn">
              {next.name} →
            </Link>
          )}
        </div>

        <p className="outer-note">
          {cs
            ? 'Čísla jsou z fact sheetu NASA/JPL; text o archivu, hlubině a srdci je jazyk Nirvany, ne astronomie.'
            : 'Numbers come from the NASA/JPL fact sheet; the text about the archive, the deep and the heart is Nirvana’s language, not astronomy.'}
        </p>
      </aside>
    </main>
  );
}
