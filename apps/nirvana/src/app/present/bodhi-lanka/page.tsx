'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Link from 'next/link';
import { BodhiLankaScene, LankaLighting, LANKA_CAMERA, LANKA_CONTROLS } from '../../../../../shared/scenes/BodhiLanka';
import { useI18n } from '@/core/i18n';
import { MISSION_ORIGIN } from '@/lib/freeworld-sites';

export default function BodhiLankaPresentPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';

  return (
    <main className="present">
      <header className="present-chrome">
        <Link href="/" className="present-back">
          ← {cs ? 'Nirvana' : 'Nirvana'}
        </Link>
        <div className="present-title">
          <strong>BODHI LANKA</strong>
          <span className="present-sub">
            {cs ? 'Akáša · Srí Lanka — živý strom, ne stavba' : 'Akasha · Sri Lanka — a living tree, not a building'}
          </span>
        </div>
        <a
          className="present-link"
          href={`${MISSION_ORIGIN}/terranova/bodhi-lanka`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {cs ? 'komunita ↗' : 'community ↗'}
        </a>
      </header>

      <Canvas
        shadows
        camera={LANKA_CAMERA}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <LankaLighting />

        <BodhiLankaScene lang={lang} />

        <OrbitControls {...LANKA_CONTROLS} />
      </Canvas>

      <div className="present-hint">
        {cs ? 'Táhni pro otočení · kolečko pro přiblížení' : 'Drag to rotate · scroll to zoom'}
      </div>
    </main>
  );
}
