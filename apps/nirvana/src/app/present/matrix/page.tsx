'use client';

import { ProjectLanguageButton } from '@/core/shell/ProjectLanguageButton';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Link from 'next/link';
import { MatrixScene, MatrixLighting, MATRIX_CAMERA, MATRIX_CONTROLS } from '../../../../../shared/scenes/Matrix';
import { useI18n } from '@/core/i18n';

export default function MatrixPresentPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';

  return (
    <main className="present">
      <header className="present-chrome">
        <Link href="/" className="present-back">
          ← Nirvana
        </Link>
        <div className="present-title">
          <strong>MATRIX</strong>
          <span className="present-sub">
            {cs
              ? 'Shackleton · jižní pól Měsíce — vize, ne stavba'
              : 'Shackleton · lunar south pole — vision, not built'}
          </span>
        </div>
        <ProjectLanguageButton />
      </header>

      <Canvas
        dpr={[1, 1.5]}
        shadows
        camera={MATRIX_CAMERA}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <MatrixLighting />
        <MatrixScene lang={lang} />
        <OrbitControls makeDefault {...MATRIX_CONTROLS} />
      </Canvas>

      <div className="present-hint">
        {cs ? 'Táhni pro otočení · kolečko pro přiblížení' : 'Drag to rotate · scroll to zoom'}
      </div>
    </main>
  );
}
