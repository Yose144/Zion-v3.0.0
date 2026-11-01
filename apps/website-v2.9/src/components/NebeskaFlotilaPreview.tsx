'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { usePreviewVisibility } from './usePreviewVisibility';
import { useEffect, useState } from 'react';
import {
  NebeskaFlotilaLighting,
  NebeskaFlotilaScene,
  NEBESKA_CAMERA,
  NEBESKA_CONTROLS,
} from '../../../shared/scenes/NebeskaFlotila';

type Lang = 'cs' | 'en';

function isWebGLAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

/** 3D náhled nebeské flotily — tatáž scéna jako v Nirvaně (`/present/nebeska-flotila`). */
export default function NebeskaFlotilaPreview({
  lang = 'cs',
  className = '',
}: {
  lang?: Lang;
  className?: string;
}) {
  const [available, setAvailable] = useState(true);
  const { ref: shell, visible } = usePreviewVisibility<HTMLDivElement>();

  useEffect(() => {
    setAvailable(isWebGLAvailable());
    // Next/React někdy nechá canvas v defaultu 300×150, dokud nedorazí resize.
    const kick = () => window.dispatchEvent(new Event('resize'));
    const t1 = window.setTimeout(kick, 120);
    const t2 = window.setTimeout(kick, 600);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (!available) {
    return (
      <div
        className={`relative flex h-[420px] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black/40 ${className}`}
      >
        <p className="text-sm text-white/60">
          3D náhled není v tomto prohlížeči dostupný. / 3D preview is not available in this browser.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={shell}
      className={`relative block w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40 ${className}`}
      style={{ height: 'inherit', minHeight: 320 }}
    >
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, 1.5]}
        shadows
        camera={NEBESKA_CAMERA}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <NebeskaFlotilaLighting />
        <NebeskaFlotilaScene lang={lang} />
        <OrbitControls
          makeDefault
          enablePan={false}
          autoRotate={NEBESKA_CONTROLS.autoRotate}
          autoRotateSpeed={NEBESKA_CONTROLS.autoRotateSpeed}
          minDistance={NEBESKA_CONTROLS.minDistance}
          maxDistance={NEBESKA_CONTROLS.maxDistance}
          maxPolarAngle={NEBESKA_CONTROLS.maxPolarAngle}
          target={NEBESKA_CONTROLS.target}
        />
      </Canvas>
    </div>
  );
}
