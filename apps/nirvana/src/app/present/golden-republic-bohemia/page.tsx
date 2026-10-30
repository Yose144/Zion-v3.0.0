'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Link from 'next/link';
import { GoldenRepublicBohemiaScene, BohemiaLighting, BOHEMIA_CAMERA, BOHEMIA_CONTROLS } from '../../../../../shared/scenes/GoldenRepublicBohemia';
import { useI18n } from '@/core/i18n';
import { MISSION_ORIGIN } from '@/lib/freeworld-sites';

export default function GoldenRepublicBohemiaPresentPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';

  return (
    <main className="present">
      <header className="present-chrome">
        <Link href="/" className="present-back">
          ← {cs ? 'Nirvana' : 'Nirvana'}
        </Link>
        <div className="present-title">
          <strong>GOLDEN REPUBLIC BOHEMIA</strong>
          <span className="present-sub">
            {cs ? 'Čechy · osa Říp — živý střed, ne stavba' : 'Bohemia · Říp axis — living center, not built'}
          </span>
        </div>
        <a
          className="present-link"
          href={`${MISSION_ORIGIN}/terranova/golden-republic-bohemia`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {cs ? 'komunita ↗' : 'community ↗'}
        </a>
      </header>

      <Canvas
        shadows
        camera={BOHEMIA_CAMERA}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <BohemiaLighting />

        <GoldenRepublicBohemiaScene lang={lang} />

        <OrbitControls {...BOHEMIA_CONTROLS} />
      </Canvas>

      <div className="present-hint">
        {cs ? 'Táhni pro otočení · kolečko pro přiblížení' : 'Drag to rotate · scroll to zoom'}
      </div>
    </main>
  );
}
