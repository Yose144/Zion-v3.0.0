'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Loader2 } from 'lucide-react';

/**
 * Herní 3D model avatara z Nirvany (GLB s kostrou a klipem `idle`).
 *
 * Soubory leží v `public/models/avatars/<id>.glb` a do buildu je přidává
 * `deploy-web2.9.sh` z `apps/nirvana/public/models/avatars/` (jediný zdroj
 * pravdy v gitu). Když model pro ID není, stránka tenhle blok vůbec nekreslí.
 *
 * Model se klonuje (`SkeletonUtils.clone`), protože každá animovaná instance
 * potřebuje vlastní skelet. Geometrii ani texturu neuvolňujeme — drží je
 * drei cache a sdílí je s ostatními instancemi.
 */

function isWebGLAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

function RiggedModel({ url }: { url: string }) {
  const { scene, animations } = useGLTF(url);
  const model = useMemo(() => cloneSkeleton(scene), [scene]);
  const { actions } = useAnimations(animations, model);
  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    const action = actions.idle ?? Object.values(actions)[0];
    if (!action) return;
    action.reset().play();
    return () => {
      action.stop();
    };
  }, [actions]);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.35;
  });

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}

export default function AvatarModel3D({
  id,
  className = '',
}: {
  id: number;
  className?: string;
}) {
  const [available, setAvailable] = useState(true);
  const url = `/models/avatars/${id}.glb`;

  useEffect(() => {
    setAvailable(isWebGLAvailable());
  }, []);

  if (!available) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-white/10 bg-black/40 ${className}`}
      >
        <p className="px-4 text-center text-xs text-white/60">
          3D náhled není v tomto prohlížeči dostupný. / 3D preview is not available in this browser.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-black/50 to-black/70 ${className}`}
    >
      <Canvas
        dpr={[1, 1.6]}
        camera={{ position: [0.9, 1.5, 3.1], fov: 32, near: 0.01, far: 100 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <hemisphereLight args={[0xdfe8ff, 0x2a2438, 1.6]} />
        <directionalLight position={[3, 5, 4]} intensity={2.2} />
        <directionalLight position={[-4, 2, -5]} intensity={0.9} color={0x9db8ff} />

        <Suspense fallback={null}>
          <RiggedModel url={url} />
          <OrbitControls
            makeDefault
            target={[0, 0.95, 0]}
            enablePan={false}
            minDistance={1.8}
            maxDistance={5}
            maxPolarAngle={Math.PI / 1.9}
          />
        </Suspense>
      </Canvas>

      <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] uppercase tracking-wider text-gray-300 backdrop-blur">
        <Loader2 className="h-3 w-3 animate-spin text-zion-gold/70" />
        3D · herní model
      </div>
    </div>
  );
}
