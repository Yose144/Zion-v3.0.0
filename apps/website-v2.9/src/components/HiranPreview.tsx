'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useState } from 'react';
import { usePreviewVisibility } from './usePreviewVisibility';
import { FREE_WORLD_SITES } from '@/lib/freeworld-sites';
import {
  HIRAN_CAMERA,
  HIRAN_CONTROLS,
  HiranLighting,
  HiranScene,
  type HiranGate,
} from '../../../shared/scenes/Hiran';

type Lang = 'cs' | 'en';

/** Brány jsou dekorace — na veřejném webu se z náhledu nikam neodchází. */
const GATES: HiranGate[] = FREE_WORLD_SITES.map((site) => ({ key: site.key, name: site.name }));

function isWebGLAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

export default function HiranPreview({
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
        camera={HIRAN_CAMERA}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <HiranLighting />
        <HiranScene lang={lang} gates={GATES} state="idle" />
        <OrbitControls makeDefault {...HIRAN_CONTROLS} />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">
          {lang === 'cs' ? 'Hiran · zlaté vejce na lotosu' : 'Hiran · the golden womb on the lotus'}
        </p>
      </div>
    </div>
  );
}
