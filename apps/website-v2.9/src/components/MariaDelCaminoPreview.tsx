'use client';

import { Canvas } from '@react-three/fiber';
import { t5 } from '@/lib/i18n-tx';
import { OrbitControls } from '@react-three/drei';
import { usePreviewVisibility } from './usePreviewVisibility';
import { useEffect, useState } from 'react';
import { MariaDelCaminoScene, MariaLighting, MARIA_CAMERA, MARIA_CONTROLS } from '../../../shared/scenes/MariaDelCamino';

type Lang = 'cs' | 'en' | 'es' | 'pt' | 'fr';

function isWebGLAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

export default function MariaDelCaminoPreview({
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
        <p className="text-sm text-white/60">3D preview není dostupný v tomto prohlížeči. / 3D preview is not available in this browser.</p>
      </div>
    );
  }

  return (
    <div ref={shell} className={`relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 ${className}`}>
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, 1.5]}
        shadows
        camera={MARIA_CAMERA}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <MariaLighting />

        <MariaDelCaminoScene lang={lang} />

        <OrbitControls makeDefault {...MARIA_CONTROLS} />
      </Canvas>
      <div className="pointer-events-none absolute bottom-3 left-4 rounded border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] text-white/60">
        {lang === 'cs' ? 'Táhni pro otočení · kolečko pro přiblížení' : t5('Drag to rotate · scroll to zoom', lang)}
      </div>
    </div>
  );
}
