'use client';

/**
 * Scéna vnější planety — jedna pro Uran, Neptun i Pluto.
 *
 * Záměrně jednoduchá: koule s texturou, prstence (Uran), hvězdné pozadí
 * a pomalá rotace. Nic z toho nerozhoduje o hře, protože tady žádná hra
 * není — je to **místo**. Kdo sem dojde, má se zastavit a přečíst si, co
 * to místo je.
 *
 * Sklon osy se nastavuje ve stupních z dat světa, takže Uran opravdu leží
 * na boku (97,8°) a Pluto naopak visí hlavou dolů (122,5°).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { proceduralTexture } from '@/core/scene/universe/proceduralTexture';
import type { OuterWorld } from './worlds';
import { canvasDpr } from '@/core/design/dpr';

function useTexture(path: string | null, id: string, tint: string): THREE.Texture | null {
  const [loaded, setLoaded] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    new THREE.TextureLoader().load(path, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      if (alive) setLoaded(texture);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  return path ? loaded : proceduralTexture(id, tint);
}

function Body({ world }: { world: OuterWorld }) {
  const mesh = useRef<THREE.Mesh>(null);
  const texture = useTexture(world.texture, world.id, world.tint);

  useFrame((_, delta) => {
    if (mesh.current) mesh.current.rotation.y += delta * 0.06;
  });

  const ringGeometry = useMemo(() => {
    if (!world.rings) return null;
    const inner = world.radius * 1.28;
    const outer = world.radius * 1.82;
    const geometry = new THREE.RingGeometry(inner, outer, 96);
    // Prstenec je placka. Bez vlastního náklonu ho kamera vidí přesně z hrany
    // a zůstanou z něj dvě čáry sbíhající se v „V" (vypadá jako chyba).
    geometry.rotateX(-Math.PI / 2 + 0.22);
    return geometry;
  }, [world.rings, world.radius]);

  return (
    <group rotation={[0, 0, THREE.MathUtils.degToRad(world.tilt)]}>
      <mesh ref={mesh}>
        <sphereGeometry args={[world.radius, 64, 48]} />
        {/* `key` je nutný: materiál zkompilovaný bez mapy se později nepřepne */}
        <meshStandardMaterial
          key={texture ? 'tex' : 'flat'}
          map={texture ?? undefined}
          color={texture ? '#ffffff' : world.tint}
          roughness={0.86}
          metalness={0.05}
        />
      </mesh>
      {ringGeometry && (
        <mesh geometry={ringGeometry}>
          {/* sčítací blending: prstenec má svítit, ne kreslit tmavé pruhy */}
          <meshBasicMaterial
            color="#9fe4ea"
            transparent
            opacity={0.22}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
      <ambientLight intensity={0.32} color="#cfd8ff" />
      <directionalLight position={[6, 3, 5]} intensity={2.6} color="#fff2d8" />
      <directionalLight position={[-5, -2, -4]} intensity={0.35} color="#6f86ff" />
    </group>
  );
}

export function OuterWorldScene({ world }: { world: OuterWorld }) {
  return (
    <Canvas
      camera={{ position: [0, 1.1, 9.6], fov: 42 }}
      dpr={canvasDpr(1.75)}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#03040c']} />
      <Body world={world} />
      <Stars />
      <OrbitControls
        enablePan={false}
        minDistance={2.6}
        maxDistance={14}
        enableDamping
        dampingFactor={0.08}
        autoRotate={false}
      />
    </Canvas>
  );
}

/** Hvězdy jsou body, ne 2 000 meshů — jeden draw call. */
function Stars() {
  const geometry = useMemo(() => {
    const count = 1400;
    const positions = new Float32Array(count * 3);
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    for (let i = 0; i < count; i += 1) {
      // kulová slupka daleko od kamery
      const radius = 26 + rand() * 14;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.09} color="#cfe2ff" sizeAttenuation transparent opacity={0.85} />
    </points>
  );
}
