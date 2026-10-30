'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Link from 'next/link';
import { DharmaTempleScene } from '@/core/scene/projects/DharmaTemple';
import { useI18n } from '@/core/i18n';
import { MISSION_ORIGIN } from '@/lib/freeworld-sites';

export default function DharmaTemplePresentPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';

  return (
    <main className="present">
      <header className="present-chrome">
        <Link href="/" className="present-back">
          ← {cs ? 'Nirvana' : 'Nirvana'}
        </Link>
        <div className="present-title">
          <strong>DHARMA TEMPLE</strong>
          <span className="present-sub">
            {cs ? 'La Palma · Kanárské ostrovy — koncept, ne stavba' : 'La Palma · Canary Islands — concept, not built'}
          </span>
        </div>
        <a
          className="present-link"
          href={`${MISSION_ORIGIN}/terranova/dharma-temple`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {cs ? 'komunita ↗' : 'community ↗'}
        </a>
      </header>

      <Canvas
        shadows
        camera={{ position: [0, 8.0, 19.5], fov: 44 }}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <ambientLight intensity={0.6} color="#fff3dd" />
        <hemisphereLight args={['#ffe9c4', '#1c2a18', 0.5]} />
        <directionalLight position={[-14, 8, -10]} intensity={2.0} color="#ffb76a" castShadow />
        <directionalLight position={[12, 15, 12]} intensity={0.7} color="#ffd9a8" />
        <pointLight position={[0, 4.5, 0]} intensity={2.6} color="#ffd700" distance={20} decay={2} />

        <DharmaTempleScene lang={lang} />

        <OrbitControls
          autoRotate
          autoRotateSpeed={0.4}
          minDistance={9}
          maxDistance={32}
          maxPolarAngle={Math.PI / 2 - 0.04}
          target={[0, 2.4, 1.6]}
          enablePan={false}
        />
      </Canvas>

      <div className="present-hint">
        {cs ? 'Táhni pro otočení · kolečko pro přiblížení' : 'Drag to rotate · scroll to zoom'}
      </div>
    </main>
  );
}
