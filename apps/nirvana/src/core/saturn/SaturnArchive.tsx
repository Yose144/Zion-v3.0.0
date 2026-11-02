'use client';

/**
 * Saturn — Kroniky / Archiv kruhů.
 *
 * Prstence jako hřbety knih: každý segment je jeden svět (kapitola).
 * 15 uzlů z `FREE_WORLD_MISSIONS` stojí na prstenci Saturnu; hover = kruh
 * (stejný `NavHalo` jako ve vesmíru), klik = kapitola v panelu.
 *
 * Žádná jména ve 3D — jméno ukáže panel (stejné pravidlo jako v Nirvaně).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { NavHalo } from '@/core/scene/universe/NavHalo';
import { SpaceBackdrop } from '@/core/scene/universe/SpaceBackdrop';
import {
  FREE_WORLD_MISSIONS,
  MISSION_STATUS_COLOR,
  type FreeWorldMission,
} from '@/lib/freeworld-sites';

const SATURN_R = 3.6;
const RING_INNER = 4.4;
const RING_OUTER = 8.6;
const SPINE_R = 6.6;
const SPINE_Y = 0.05;
const TILT = 0.47; // axiální sklon Saturnu (radiány)

export const SATURN_CAMERA = { position: [0, 9.5, 17] as [number, number, number], fov: 52 };

function useTexture(path: string): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    new THREE.TextureLoader().load(path, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      if (alive) setTex(t);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  return tex;
}

/** UV podél radiální osy — strip textura prstence. */
function useRingGeometry() {
  return useMemo(() => {
    const g = new THREE.RingGeometry(RING_INNER, RING_OUTER, 192);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (r - RING_INNER) / (RING_OUTER - RING_INNER), 0.5);
    }
    return g;
  }, []);
}

function SaturnBody() {
  const tex = useTexture('/textures/2k_saturn.jpg');
  const ringTex = useTexture('/textures/2k_saturn_ring_alpha.png');
  const ringGeo = useRingGeometry();
  const body = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (body.current) body.current.rotation.y += delta * 0.02;
  });

  return (
    <group rotation={[0, 0, TILT]}>
      <mesh ref={body}>
        <sphereGeometry args={[SATURN_R, 64, 48]} />
        <meshStandardMaterial
          key={tex ? 'tex' : 'flat'}
          map={tex ?? undefined}
          color={tex ? '#ffffff' : '#e3cf9f'}
          roughness={0.92}
          metalness={0.02}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} geometry={ringGeo}>
        <meshBasicMaterial
          key={ringTex ? 'tex' : 'flat'}
          map={ringTex ?? undefined}
          color={ringTex ? '#ffffff' : '#c9b98a'}
          transparent
          opacity={0.92}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function spineGeometry() {
  return new THREE.BoxGeometry(0.26, 1.05, 0.62);
}

export function SaturnArchive({
  chapters,
  selected,
  onSelect,
}: {
  chapters: FreeWorldMission[];
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const geo = useMemo(spineGeometry, []);
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = clock.elapsedTime * 0.03;
  });

  const layout = useMemo(() => {
    const n = Math.max(1, chapters.length);
    return chapters.map((m, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      return {
        m,
        a,
        pos: [Math.cos(a) * SPINE_R, SPINE_Y, Math.sin(a) * SPINE_R] as [number, number, number],
        color: MISSION_STATUS_COLOR[m.status],
      };
    });
  }, [chapters]);

  return (
    <>
      <color attach="background" args={['#04050c']} />
      <SpaceBackdrop />
      <ambientLight intensity={0.5} />
      <directionalLight position={[12, 18, 10]} intensity={1.4} color="#fff1d4" />
      <pointLight position={[-10, -4, -8]} intensity={0.5} color="#7ec8ff" />

      <SaturnBody />

      {/* hřbety kapitol na prstenci (rotují s planetou pomalu) */}
      <group ref={group} rotation={[0, 0, TILT]}>
        {layout.map((d, i) => {
          const active = hover === i || selected === i;
          return (
            <mesh
              key={d.m.key}
              geometry={geo}
              position={d.pos}
              rotation={[0, -d.a, 0]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(i);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHover(i);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHover(null);
                document.body.style.cursor = 'auto';
              }}
            >
              <meshStandardMaterial
                color={d.color}
                emissive={d.color}
                emissiveIntensity={active ? 0.9 : 0.18}
                roughness={0.55}
                metalness={0.15}
                transparent
                opacity={active ? 1 : 0.82}
              />
            </mesh>
          );
        })}

        {hover != null && layout[hover] && (
          <NavHalo
            active
            color={layout[hover].color}
            radius={0.62}
            thickness={0.05}
            position={layout[hover].pos}
          />
        )}
        {selected != null && selected !== hover && layout[selected] && (
          <NavHalo
            active
            color={layout[selected].color}
            radius={0.62}
            thickness={0.05}
            position={layout[selected].pos}
          />
        )}
      </group>

      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.06}
        autoRotate
        autoRotateSpeed={0.25}
        minDistance={9}
        maxDistance={30}
        minPolarAngle={0.35}
        maxPolarAngle={2.4}
      />
    </>
  );
}

export const SATURN_CHAPTERS = FREE_WORLD_MISSIONS;
