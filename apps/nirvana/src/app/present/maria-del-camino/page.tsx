'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Link from 'next/link';
import { MariaDelCaminoScene, MariaLighting, MARIA_CAMERA, MARIA_CONTROLS } from '../../../../../shared/scenes/MariaDelCamino';
import { useI18n } from '@/core/i18n';
import { MISSION_ORIGIN } from '@/lib/freeworld-sites';

export default function MariaDelCaminoPresentPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';

  return (
    <main className="present">
      <header className="present-chrome">
        <Link href="/" className="present-back">
          ← {cs ? 'Nirvana' : 'Nirvana'}
        </Link>
        <div className="present-title">
          <strong>MARÍA DEL CAMINO</strong>
          <span className="present-sub">
            {cs ? 'Galicie · Tres Marias — tři lodě, tři oceány — plující uzel' : 'Galicia · Tres Marias — three ships, three oceans — sailing node'}
          </span>
        </div>
        <a
          className="present-link"
          href={`${MISSION_ORIGIN}/terranova/maria-del-camino`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {cs ? 'komunita ↗' : 'community ↗'}
        </a>
      </header>

      <Canvas
        shadows
        camera={MARIA_CAMERA}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <MariaLighting />

        <MariaDelCaminoScene lang={lang} />

        <OrbitControls {...MARIA_CONTROLS} />
      </Canvas>

      <div className="present-hint">
        {cs ? 'Táhni pro otočení · kolečko pro přiblížení' : 'Drag to rotate · scroll to zoom'}
      </div>
    </main>
  );
}
