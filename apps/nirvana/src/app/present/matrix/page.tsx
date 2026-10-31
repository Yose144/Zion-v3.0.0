'use client';

import { useState } from 'react';
import { ProjectLanguageButton } from '@/core/shell/ProjectLanguageButton';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Link from 'next/link';
import { MatrixScene, MatrixLighting, MATRIX_CAMERA, MATRIX_CONTROLS } from '../../../../../shared/scenes/Matrix';
import { MatrixHallScene, MatrixHallLighting, HALL_CAMERA, HALL_CONTROLS } from '../../../../../shared/scenes/MatrixHall';
import { useI18n } from '@/core/i18n';

export default function MatrixPresentPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';
  const [mode, setMode] = useState<'base' | 'hall'>('base');
  const [beat, setBeat] = useState(0);
  const hall = mode === 'hall';
  const advance = () => setBeat((current) => Math.min(2, current + 1));

  return (
    <main className="present">
      <header className="present-chrome">
        <Link href="/" className="present-back">
          ← Nirvana
        </Link>
        <div className="present-title">
          <strong>MATRIX</strong>
          <span className="present-sub">
            {hall
              ? (cs ? 'Skleněná hala — vlastní scéna základny' : 'Glass hall — the base’s own scene')
              : (cs
                ? 'Shackleton · jižní pól Měsíce — vize, ne stavba'
                : 'Shackleton · lunar south pole — vision, not built')}
          </span>
        </div>
        <ProjectLanguageButton />
        {hall && (
          <button
            type="button"
            className="present-link"
            style={{ font: 'inherit', cursor: 'pointer' }}
            onClick={() => {
              setMode('base');
              setBeat(0);
            }}
          >
            {cs ? 'základna' : 'base'}
          </button>
        )}
      </header>

      <Canvas
        key={mode}
        dpr={[1, 1.5]}
        shadows
        camera={hall ? HALL_CAMERA : MATRIX_CAMERA}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        {hall ? (
          <>
            <MatrixHallLighting />
            <MatrixHallScene lang={lang} beat={beat} onAdvance={advance} />
            <OrbitControls makeDefault {...HALL_CONTROLS} />
          </>
        ) : (
          <>
            <MatrixLighting />
            <MatrixScene lang={lang} onEnterHall={() => { setBeat(0); setMode('hall'); }} />
            <OrbitControls makeDefault {...MATRIX_CONTROLS} />
          </>
        )}
      </Canvas>

      <div className="present-hint">
        {hall
          ? (cs ? 'Klikni do sálu pro další takt' : 'Click the hall for the next beat')
          : (cs ? 'Klikni na střední modul · táhni pro otočení' : 'Click the central module · drag to rotate')}
        {hall && beat < 2 && (
          <button
            type="button"
            className="present-link"
            style={{ pointerEvents: 'auto', marginLeft: '0.7rem', font: 'inherit', cursor: 'pointer' }}
            onClick={advance}
          >
            {cs ? 'dál' : 'next'}
          </button>
        )}
      </div>
    </main>
  );
}
