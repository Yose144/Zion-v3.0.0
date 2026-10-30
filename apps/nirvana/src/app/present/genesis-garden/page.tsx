'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Link from 'next/link';
import { GenesisGardenScene } from '@/core/scene/projects/GenesisGarden';
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
        shadows
        camera={{ position: [0, 8.5, 19.5], fov: 44 }}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <ambientLight intensity={0.72} color="#fff3dd" />
        <hemisphereLight args={['#ffe9c4', '#24351a', 0.62]} />
        <directionalLight position={[10, 9, -14]} intensity={2.2} color="#ffb76a" castShadow />
        <directionalLight position={[-12, 16, 14]} intensity={0.85} color="#ffd9a8" />
        <pointLight position={[0, 3.5, 0.9]} intensity={2.4} color="#ffd700" distance={18} decay={2} />

        <GenesisGardenScene lang={lang} />

        <OrbitControls
          autoRotate
          autoRotateSpeed={0.4}
          minDistance={9}
          maxDistance={36}
          maxPolarAngle={Math.PI / 2 - 0.04}
          target={[0, 3, 0]}
          enablePan={false}
        />
      </Canvas>

      <div className="present-hint">
        {cs ? 'Táhni pro otočení · kolečko pro přiblížení' : 'Drag to rotate · scroll to zoom'}
      </div>
    </main>
  );
}
