'use client';

/**
 * Saturn — Kroniky / Archiv kruhů.
 *
 * Vstoupí se sem z planety Saturn (panel) nebo z konzole. Prstence jsou
 * hřbety knih: 15 kapitol = 15 světů z `FREE_WORLD_MISSIONS`. Klik na hřbet
 * nebo na položku v seznamu otevře kapitolu; CTA vede do prezentace.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { useI18n, tx } from '@/core/i18n';
import { SATURN_CAMERA, SaturnArchive, SATURN_CHAPTERS } from '@/core/saturn/SaturnArchive';
import { TanksGame } from '@/core/saturn/TanksGame';
import { MISSION_ORIGIN, MISSION_STATUS_COLOR, type MissionStatus } from '@/lib/freeworld-sites';
import { GameBoard } from '@/core/games/GameBoard';
import { watchRoom } from '@/core/net/watch';
import { canvasDpr } from '@/core/design/dpr';

const STATUS_LABEL: Record<MissionStatus, { cs: string; en: string }> = {
  built: { cs: 'stojí', en: 'built' },
  preparation: { cs: 'v přípravě', en: 'in preparation' },
  vision: { cs: 'vize', en: 'vision' },
};

export default function SaturnPage() {
  const { lang } = useI18n();
  const [selected, setSelected] = useState<number | null>(null);
  /** Tanky jsou celoobrazovková hra nad archivem — archiv zůstává pod ní. */
  const [tanks, setTanks] = useState(false);

  /**
   * `?watch=tanks-2` = hlediště. Tanky jsou celoobrazovková hra nad archivem,
   * takže se musí otevřít samy — jinak by divák zůstal v kronikách.
   */
  useEffect(() => {
    if (watchRoom()) setTanks(true);
  }, []);
  const chapter = selected == null ? null : SATURN_CHAPTERS[selected];

  return (
    <main className="shell saturn">
      <div className="stage">
        <Canvas
          camera={{ position: SATURN_CAMERA.position, fov: SATURN_CAMERA.fov }}
          dpr={canvasDpr(1.75)}
        >
          <SaturnArchive chapters={SATURN_CHAPTERS} selected={selected} onSelect={setSelected} />
        </Canvas>
      </div>

      <header className="saturn-chrome">
        <div>
          <strong>KRONIKY</strong>
          <span>{lang === 'cs' ? 'Archiv kruhů · Saturn' : 'Ring archive · Saturn'}</span>
        </div>
        <div className="saturn-chrome-actions">
          <button type="button" className="saturn-tanks-open" onClick={() => setTanks(true)}>
            {lang === 'cs' ? 'Tanky' : 'Tanks'}
          </button>
          <Link href="/" className="saturn-back">
            ← {lang === 'cs' ? 'Nirvana' : 'Nirvana'}
          </Link>
        </div>
      </header>

      <aside className="saturn-panel" aria-label={lang === 'cs' ? 'Kapitoly' : 'Chapters'}>
        <p className="saturn-hint">
          {lang === 'cs'
            ? 'Prstence jsou hřbety knih. Najdi svět, klikni na kapitolu.'
            : 'The rings are book spines. Find a world, open a chapter.'}
        </p>
        <ol className="saturn-list">
          {SATURN_CHAPTERS.map((m, i) => (
            <li key={m.key}>
              <button
                type="button"
                className={selected === i ? 'is-active' : ''}
                onClick={() => setSelected(i)}
                aria-current={selected === i ? 'true' : undefined}
              >
                <i aria-hidden style={{ background: MISSION_STATUS_COLOR[m.status] }} />
                <span>{m.name}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="saturn-legend">
          {(['built', 'preparation', 'vision'] as MissionStatus[]).map((s) => (
            <span key={s}>
              <i aria-hidden style={{ background: MISSION_STATUS_COLOR[s] }} />
              {tx(STATUS_LABEL[s], lang)}
            </span>
          ))}
        </div>
        <GameBoard game="tanks" className="saturn-board" />
      </aside>

      {tanks && <TanksGame onExit={() => setTanks(false)} />}

      {chapter && (
        <section className="planet-panel saturn-detail" aria-label={chapter.name}>
          <header>
            <strong>{chapter.name}</strong>
            <button
              type="button"
              className="planet-panel-close"
              onClick={() => setSelected(null)}
              aria-label="×"
            >
              ×
            </button>
          </header>
          <p>
            <span style={{ color: MISSION_STATUS_COLOR[chapter.status] }}>
              {tx(STATUS_LABEL[chapter.status], lang)}
            </span>
            {' · L5 Free World'}
          </p>
          <div className="planet-panel-actions">
            {chapter.present ? (
              <Link href={chapter.present} className="park-btn">
                {lang === 'cs' ? 'Otevřít prezentaci' : 'Open presentation'}
              </Link>
            ) : (
              <a
                href={`${MISSION_ORIGIN}${chapter.path}`}
                className="park-btn"
                target="_blank"
                rel="noopener noreferrer"
              >
                {lang === 'cs' ? 'Otevřít stránku' : 'Open page'}
              </a>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
