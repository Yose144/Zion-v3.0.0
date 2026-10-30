'use client';

import { useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Portal, SceneSlot } from '@/core/portals/manifest';
import type { Lang } from '@/core/i18n';

const SLOT_COLOR: Record<SceneSlot, string> = {
  core: '#7ec8ff',
  surface: '#066928',
  ring: '#f5f5f5',
  orbit: '#c084fc',
  gate: '#fcd116',
  ship: '#e41e2b',
};

const HOME_POS: [number, number, number] = [-7.6, -3.6, 4.8];
const W = 5.6;
const H = 2.0;
const TILE_W = 0.98;
const TILE_H = 0.52;
const COLS = 5;

function HoloTile({
  portal,
  index,
  onOpen,
  lang,
}: {
  portal: Portal;
  index: number;
  onOpen: (id: string) => void;
  lang: Lang;
}) {
  const [hover, setHover] = useState(false);
  const mesh = useRef<THREE.Mesh>(null);
  const color = SLOT_COLOR[portal.scene.slot];
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const x = (col - (COLS - 1) / 2) * (TILE_W + 0.12);
  const y = -0.28 - row * (TILE_H + 0.14);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.getElapsedTime();
    const target = hover ? 1.1 : 1;
    const s = mesh.current.scale.x + (target - mesh.current.scale.x) * 0.2;
    mesh.current.scale.setScalar(s);
    const mat = mesh.current.material as THREE.MeshBasicMaterial;
    mat.opacity = (hover ? 0.34 : 0.18) + Math.sin(t * 2.1 + index) * 0.02;
  });

  return (
    <group position={[x, y, 0.02]}>
      <mesh
        ref={mesh}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(portal.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <planeGeometry args={[TILE_W, TILE_H]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineLoop>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([-TILE_W / 2, -TILE_H / 2, 0, TILE_W / 2, -TILE_H / 2, 0, TILE_W / 2, TILE_H / 2, 0, -TILE_W / 2, TILE_H / 2, 0]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={hover ? 0.95 : 0.45} />
      </lineLoop>
      <Html center transform={false} distanceFactor={11} style={{ pointerEvents: 'none' }} position={[0, 0, 0.01]}>
        <span className="holo-tile-label" style={{ borderColor: color, color }}>
          {portal.title[lang]}
          {portal.status === 'stub' && <em> ·</em>}
        </span>
      </Html>
    </group>
  );
}

/**
 * Holografická konzole — všechna tlačítka žijí tady, ne v DOM liště.
 * Interaktivní (tiles → portály, lang, VR) a pohyblivá (táhni za horní lištu).
 */
export function HoloConsole({
  portals,
  onOpen,
  lang,
  onToggleLang,
  vrSupported,
  onEnterVr,
}: {
  portals: Portal[];
  onOpen: (id: string) => void;
  lang: Lang;
  onToggleLang: () => void;
  vrSupported: boolean;
  onEnterVr: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const dragging = useRef<{ plane: THREE.Plane; offset: THREE.Vector3 } | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const { camera } = useThree();

  useFrame(({ clock, camera: cam }) => {
    if (!group.current) return;
    group.current.lookAt(cam.position);
    const t = clock.getElapsedTime();
    group.current.position.y += Math.sin(t * 0.8) * 0.0006;
    if (glow.current) glow.current.opacity = 0.1 + Math.sin(t * 1.7) * 0.04;
  });

  function beginDrag(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    if (!group.current) return;
    const normal = new THREE.Vector3();
    camera.getWorldDirection(normal).negate();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, group.current.position);
    const hit = new THREE.Vector3();
    if (e.ray.intersectPlane(plane, hit)) {
      dragging.current = { plane, offset: group.current.position.clone().sub(hit) };
      (e.target as Element).setPointerCapture(e.pointerId);
    }
  }

  function moveDrag(e: ThreeEvent<PointerEvent>) {
    if (!dragging.current || !group.current) return;
    const hit = new THREE.Vector3();
    if (e.ray.intersectPlane(dragging.current.plane, hit)) {
      group.current.position.copy(hit.add(dragging.current.offset));
    }
  }

  function endDrag(e: ThreeEvent<PointerEvent>) {
    dragging.current = null;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      // pointer already released
    }
  }

  if (collapsed) {
    return (
      <group ref={group} position={HOME_POS}>
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed(false);
          }}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'auto')}
        >
          <octahedronGeometry args={[0.2, 0]} />
          <meshBasicMaterial color="#7ec8ff" transparent opacity={0.85} />
        </mesh>
        <mesh scale={1.7}>
          <octahedronGeometry args={[0.2, 0]} />
          <meshBasicMaterial color="#7ec8ff" transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        <Html position={[0, -0.42, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
          <span className="holo-title">☰</span>
        </Html>
      </group>
    );
  }

  const rows = Math.ceil(portals.length / COLS);
  const tableH = H + (rows - 1) * (TILE_H + 0.14);

  return (
    <group ref={group} position={HOME_POS}>
      {/* deska konzole */}
      <mesh>
        <planeGeometry args={[W, tableH]} />
        <meshBasicMaterial color="#04122a" transparent opacity={0.62} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[W, tableH]} />
        <meshBasicMaterial ref={glow} color="#7ec8ff" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* horní lišta — za ni se konzole táhne */}
      <mesh
        position={[0, tableH / 2 - 0.13, 0.01]}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerOver={() => (document.body.style.cursor = 'grab')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}
      >
        <planeGeometry args={[W, 0.26]} />
        <meshBasicMaterial color="#0a2b52" transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Html position={[0, tableH / 2 - 0.13, 0.02]} center distanceFactor={11} style={{ pointerEvents: 'none' }}>
        <span className="holo-title">◈ KINGDOM CONSOLE</span>
      </Html>
      {/* minimize + lang + vr */}
      <Html
        position={[W / 2 - 0.5, tableH / 2 - 0.13, 0.02]}
        center
        distanceFactor={11}
        style={{ pointerEvents: 'auto' }}
      >
        <span className="holo-actions">
          <button type="button" className="holo-btn" onClick={() => onToggleLang()}>
            {lang === 'cs' ? 'EN' : 'CS'}
          </button>
          {vrSupported && (
            <button type="button" className="holo-btn holo-btn-vr" onClick={onEnterVr}>
              VR
            </button>
          )}
          <button type="button" className="holo-btn" onClick={() => setCollapsed(true)}>
            —
          </button>
        </span>
      </Html>
      {/* portálové dlaždice */}
      {portals.map((p, i) => (
        <HoloTile key={p.id} portal={p} index={i} onOpen={onOpen} lang={lang} />
      ))}
    </group>
  );
}
