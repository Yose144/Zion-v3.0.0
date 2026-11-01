/**
 * RENDER PORTÉTŮ OASIS — vstup pro headless prohlížeč.
 *
 * Kreslí **stejný model, jaký má hráč ve hře** (`core/avatars/AvatarModel.tsx`
 * → `body.ts`). Kdyby web kreslil vlastní postavy, roster by ukazoval něco
 * jiného, než co pak člověk dostane v Nirvaně.
 *
 * Kameru **počítáme z bounding boxu** konkrétní postavy: někdo má hůl nebo
 * kopí 2,2 m vysoko, někdo je holohlavý mnich. Pevná kamera by část postav
 * uřízla (přesně to se stalo při prvním pokusu).
 *
 * Kontrakt pro `render.mjs`:
 *   window.__render(id) → Promise<true>   (po 3 framech je plátno hotové)
 *   window.__look(id)   → AvatarLook      (pro kontrolu a manifest)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AvatarModel } from '../../../apps/nirvana/src/core/avatars/AvatarModel';
import { avatarLook, type AvatarLook } from '../../../apps/nirvana/src/core/avatars/kit';

/** Kolik framů se čeká, než je postava opravdu vykreslená (materiály se kompilují lazy). */
const SETTLE_FRAMES = 3;

let resolveNext: ((value: boolean) => void) | null = null;

function Settler({ nonce }: { nonce: number }) {
  const frames = useRef(0);
  useEffect(() => {
    frames.current = 0;
  }, [nonce]);
  useFrame(() => {
    if (!resolveNext) return;
    frames.current += 1;
    if (frames.current >= SETTLE_FRAMES) {
      const done = resolveNext;
      resolveNext = null;
      done(true);
    }
  });
  return null;
}

/** Světlo jako v portrétním studiu: klíč zleva, rim zezadu, jemné doplnění. */
function Studio({ glow }: { glow: string }) {
  return (
    <>
      <ambientLight intensity={0.8} color="#dfe7ff" />
      <hemisphereLight args={['#cfe0ff', '#241a33', 1.0]} />
      <directionalLight position={[2.6, 3.4, 3.2]} intensity={2.4} color="#fff6e8" />
      <directionalLight position={[-2.8, 2.2, -2.4]} intensity={1.7} color={glow} />
      <pointLight position={[0, 1.2, 3.2]} intensity={5} color="#ffffff" distance={9} decay={2} />
    </>
  );
}

function Stage() {
  const [look, setLook] = useState<AvatarLook | null>(null);
  const [nonce, setNonce] = useState(0);
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useEffect(() => {
    const api = window as unknown as Record<string, unknown>;
    api.__render = (id: number | null) =>
      new Promise<boolean>((resolve) => {
        resolveNext = resolve;
        setLook(avatarLook(id));
        setNonce((value) => value + 1);
      });
    api.__look = (id: number | null) => avatarLook(id);
    api.__ready = true;
  }, []);

  useEffect(() => {
    if (!look || !group.current) return;
    const box = new THREE.Box3().setFromObject(group.current);
    if (box.isEmpty()) return;
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const perspective = camera as THREE.PerspectiveCamera;
    const fov = (perspective.fov * Math.PI) / 180;
    const aspect = perspective.aspect;
    // vertikální i horizontální fit + 12 % rezerva
    const distanceV = (size.y / 2) / Math.tan(fov / 2);
    const distanceH = (size.x / 2) / (Math.tan(fov / 2) * aspect);
    const distance = Math.max(distanceV, distanceH) * 1.12 + size.z / 2;
    perspective.position.set(center.x + 0.34, center.y + 0.06, center.z + distance);
    perspective.lookAt(center.x, center.y, center.z);
    perspective.updateProjectionMatrix();
  }, [look, camera, nonce]);

  return (
    <>
      {look && <Studio glow={look.palette.glow} />}
      <group ref={group} rotation={[0, 0.2, 0]}>
        {look && <AvatarModel look={look} />}
      </group>
      <Settler nonce={nonce} />
    </>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('chybí #root');
createRoot(root).render(
  <Canvas
    dpr={2}
    gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }}
    camera={{ position: [0.42, 1.08, 5.6], fov: 30, near: 0.1, far: 60 }}
    onCreated={({ camera }) => {
      camera.lookAt(new THREE.Vector3(0, 1.02, 0));
    }}
  >
    <Stage />
  </Canvas>,
);
