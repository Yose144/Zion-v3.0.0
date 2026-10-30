'use client';

import { ProjectLanguageButton } from '@/core/shell/ProjectLanguageButton';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Link from 'next/link';
import { UluruScene, UluruLighting, ULURU_CAMERA, ULURU_CONTROLS } from '../../../../../shared/scenes/Uluru';
import { useI18n } from '@/core/i18n';
import { MISSION_ORIGIN } from '@/lib/freeworld-sites';

export default function UluruPresentPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';

  return (
    <main className="present">
      <header className="present-chrome">
        <Link href="/" className="present-back">
          ← {cs ? 'Nirvana' : 'Nirvana'}
        </Link>
        <div className="present-title">
          <strong>ULURU</strong>
          <span className="present-sub">
            {cs ? 'Tjukurpa · Songlines · Austrálie' : 'Tjukurpa · Songlines · Australia'}
          </span>
        </div>
        <ProjectLanguageButton />
        <a
          className="present-link"
          href={`${MISSION_ORIGIN}/terranova/uluru`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {cs ? 'komunita ↗' : 'community ↗'}
        </a>
      </header>

      <Canvas
        dpr={[1, 1.5]}
        shadows
        camera={ULURU_CAMERA}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <UluruLighting />

        <UluruScene lang={lang} />

        <OrbitControls {...ULURU_CONTROLS} />
      </Canvas>

      <div className="present-hint">
        {cs ? 'Táhni pro otočení · kolečko pro přiblížení' : 'Drag to rotate · scroll to zoom'}
      </div>
    </main>
  );
}
