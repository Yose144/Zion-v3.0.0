'use client';

import { ProjectLanguageButton } from '@/core/shell/ProjectLanguageButton';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Link from 'next/link';
import { EkamScene, EkamLighting, EKAM_CAMERA, EKAM_CONTROLS } from '../../../../../shared/scenes/Ekam';
import { useI18n } from '@/core/i18n';
import { MISSION_ORIGIN } from '@/lib/freeworld-sites';

export default function EkamPresentPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';

  return (
    <main className="present">
      <header className="present-chrome">
        <Link href="/" className="present-back">
          ← {cs ? 'Nirvana' : 'Nirvana'}
        </Link>
        <div className="present-title">
          <strong>EKAM</strong>
          <span className="present-sub">
            {cs ? 'Oneness Temple · Andhra Pradesh — postaveno 2008' : 'Oneness Temple · Andhra Pradesh — built 2008'}
          </span>
        </div>
        <ProjectLanguageButton />
        <a
          className="present-link"
          href={`${MISSION_ORIGIN}/terranova/ekam`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {cs ? 'komunita ↗' : 'community ↗'}
        </a>
      </header>

      <Canvas
        dpr={[1, 1.5]}
        shadows
        camera={EKAM_CAMERA}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <EkamLighting />

        <EkamScene lang={lang} />

        <OrbitControls makeDefault {...EKAM_CONTROLS} />
      </Canvas>

      <div className="present-hint">
        {cs ? 'Táhni pro otočení · kolečko pro přiblížení' : 'Drag to rotate · scroll to zoom'}
      </div>
    </main>
  );
}
