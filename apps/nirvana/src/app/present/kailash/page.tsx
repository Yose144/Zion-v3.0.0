'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Link from 'next/link';
import { KailashScene, KailashLighting, KAILASH_CAMERA, KAILASH_CONTROLS } from '../../../../../shared/scenes/Kailash';
import { useI18n } from '@/core/i18n';
import { MISSION_ORIGIN } from '@/lib/freeworld-sites';

export default function KailashPresentPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';

  return (
    <main className="present">
      <header className="present-chrome">
        <Link href="/" className="present-back">
          ← {cs ? 'Nirvana' : 'Nirvana'}
        </Link>
        <div className="present-title">
          <strong>KAILASH</strong>
          <span className="present-sub">
            {cs ? 'Posvátná hora · L5 spiritual center · Himálaje' : 'Sacred mountain · L5 spiritual center · Himalaya'}
          </span>
        </div>
        <a
          className="present-link"
          href={`${MISSION_ORIGIN}/terranova/kailash`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {cs ? 'komunita ↗' : 'community ↗'}
        </a>
      </header>

      <Canvas
        shadows
        camera={KAILASH_CAMERA}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <KailashLighting />

        <KailashScene lang={lang} />

        <OrbitControls {...KAILASH_CONTROLS} />
      </Canvas>

      <div className="present-hint">
        {cs ? 'Táhni pro otočení · kolečko pro přiblížení' : 'Drag to rotate · scroll to zoom'}
      </div>
    </main>
  );
}
