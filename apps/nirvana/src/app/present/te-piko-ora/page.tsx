'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Link from 'next/link';
import { TePikoOraScene } from '@/core/scene/projects/TePikoOra';
import { useI18n } from '@/core/i18n';
import { MISSION_ORIGIN } from '@/lib/freeworld-sites';

export default function TePikoOraPresentPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';

  return (
    <main className="present">
      <header className="present-chrome">
        <Link href="/" className="present-back">
          ← {cs ? 'Nirvana' : 'Nirvana'}
        </Link>
        <div className="present-title">
          <strong>TE PĪKO ORA</strong>
          <span className="present-sub">
            {cs ? 'Raiatea · Francouzská Polynésie — koncept, ne stavba' : 'Raiatea · French Polynesia — concept, not built'}
          </span>
        </div>
        <a
          className="present-link"
          href={`${MISSION_ORIGIN}/terranova/te-piko-ora`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {cs ? 'komunita ↗' : 'community ↗'}
        </a>
      </header>

      <Canvas
        shadows
        camera={{ position: [0, 5.6, 18.5], fov: 46 }}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <ambientLight intensity={0.55} color="#ffe9c4" />
        <hemisphereLight args={['#ffdfae', '#1c2a14', 0.55]} />
        <directionalLight position={[-16, 7, -14]} intensity={2.2} color="#ffb060" castShadow />
        <directionalLight position={[14, 14, 10]} intensity={0.7} color="#ffd9a8" />

        <TePikoOraScene lang={lang} />

        <OrbitControls
          autoRotate
          autoRotateSpeed={0.4}
          minDistance={8}
          maxDistance={30}
          maxPolarAngle={Math.PI / 2 - 0.04}
          target={[0, 2.2, -0.5]}
          enablePan={false}
        />
      </Canvas>

      <div className="present-hint">
        {cs ? 'Táhni pro otočení · kolečko pro přiblížení' : 'Drag to rotate · scroll to zoom'}
      </div>
    </main>
  );
}
