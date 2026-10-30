'use client';

import { ProjectLanguageButton } from '@/core/shell/ProjectLanguageButton';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Link from 'next/link';
import { GenesisGardenScene, GenesisGardenLighting, GENESIS_CAMERA, GENESIS_CONTROLS } from '../../../../../shared/scenes/GenesisGarden';
import { useI18n } from '@/core/i18n';
import { MISSION_ORIGIN } from '@/lib/freeworld-sites';

export default function GenesisGardenPresentPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';

  return (
    <main className="present">
      <header className="present-chrome">
        <Link href="/" className="present-back">
          ← {cs ? 'Nirvana' : 'Nirvana'}
        </Link>
        <div className="present-title">
          <strong>GENESIS GARDEN</strong>
          <span className="present-sub">
            {cs ? 'Sabacheira · Tomar · Portugalsko — koncept, ne stavba' : 'Sabacheira · Tomar · Portugal — concept, not built'}
          </span>
        </div>
        <ProjectLanguageButton />
        <a
          className="present-link"
          href={`${MISSION_ORIGIN}/terranova/genesis`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {cs ? 'komunita ↗' : 'community ↗'}
        </a>
      </header>

      <Canvas
        dpr={[1, 1.5]}
        shadows
        camera={GENESIS_CAMERA}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <GenesisGardenLighting />

        <GenesisGardenScene lang={lang} />

        <OrbitControls {...GENESIS_CONTROLS} />
      </Canvas>

      <div className="present-hint">
        {cs ? 'Táhni pro otočení · kolečko pro přiblížení' : 'Drag to rotate · scroll to zoom'}
      </div>
    </main>
  );
}
