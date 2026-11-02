'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useState } from 'react';
import { usePreviewVisibility } from './usePreviewVisibility';
import {
  OASIS_CAMERA,
  OASIS_CONTROLS,
  OasisLighting,
  OasisScene,
} from '../../../shared/scenes/Oasis';

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

export default function OasisPreview({
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
  }, []);

  if (!available) {
    return (
      <div
        className={`relative flex h-[420px] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black/40 ${className}`}
      >
        <p className="text-sm text-white/60">
          3D preview není dostupný v tomto prohlížeči. / 3D preview is not available in this browser.
        </p>
      </div>
    );
  }

  return (
    <div ref={shell} className={`relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 ${className}`}>
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, 1.5]}
        shadows
        camera={OASIS_CAMERA}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <OasisLighting />
        <OasisScene lang={lang} />
        <OrbitControls makeDefault {...OASIS_CONTROLS} />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">
          {lang === 'cs' ? 'OASIS · Zlaté vejce ve spirální galaxii' : 'OASIS · the Golden Egg in the spiral galaxy'}
        </p>
      </div>
    </div>
  );
}
