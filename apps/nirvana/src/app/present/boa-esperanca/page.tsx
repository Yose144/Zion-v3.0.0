'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Link from 'next/link';
import { BoaEsperancaScene, BoaEsperancaLighting, BOA_CAMERA, BOA_CONTROLS } from '../../../../../shared/scenes/BoaEsperanca';
import { useI18n } from '@/core/i18n';
import { MISSION_ORIGIN } from '@/lib/freeworld-sites';

export default function BoaEsperancaPresentPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';

  return (
    <main className="present">
      <header className="present-chrome">
        <Link href="/" className="present-back">
          ← {cs ? 'Nirvana' : 'Nirvana'}
        </Link>
        <div className="present-title">
          <strong>BOA ESPERANÇA</strong>
          <span className="present-sub">
            {cs ? 'Mys Dobré naděje · šev dvou oceánů' : 'Cape of Good Hope · seam of two oceans'}
          </span>
        </div>
        <a
          className="present-link"
          href={`${MISSION_ORIGIN}/terranova/boa-esperanca`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {cs ? 'komunita ↗' : 'community ↗'}
        </a>
      </header>

      <Canvas
        shadows
        camera={BOA_CAMERA}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <BoaEsperancaLighting />

        <BoaEsperancaScene lang={lang} />

        <OrbitControls {...BOA_CONTROLS} />
      </Canvas>

      <div className="present-hint">
        {cs ? 'Táhni pro otočení · kolečko pro přiblížení' : 'Drag to rotate · scroll to zoom'}
      </div>
    </main>
  );
}
