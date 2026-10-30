'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { GATE_POS } from './positions';
import type { Portal } from '@/core/portals/manifest';

const TUNNEL_LAYERS = 12;
const TUNNEL_DEPTH = 2.6;
const CHEVRONS = 39;

/**
 * Glyph textury z IntroPage jsou white-on-dark PNG bez alpha.
 * Luminance → alpha přes canvas → čistá hologram maska (white glow, alpha z jasu).
 */
function glyphMask(src: THREE.Texture): THREE.CanvasTexture | null {
  const img = src.image as HTMLImageElement | undefined;
  if (!img || !img.width) return null;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const l = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
    // práh ~0.30 seřízne šedé pozadí vadžry; exponent zjemní hrany
    const a = Math.pow(Math.max(0, (l - 0.3) / 0.7), 1.35);
    px[i] = 255;
    px[i + 1] = 255;
    px[i + 2] = 255;
    px[i + 3] = Math.min(255, a * 255);
  }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Jedna vrstva glyfu v tunelu — rotuje vlastním směrem a rychlostí. */
function TunnelLayer({
  tex,
  index,
  total,
}: {
  tex: THREE.Texture;
  index: number;
  total: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const f = index / Math.max(total - 1, 1);
  // hloubka -0.12 … -TUNNEL_DEPTH, mírný flare ven
  const z = -0.12 - f * TUNNEL_DEPTH;
  const scale = 1.5 + f * 0.55;
  const opacity = 0.9 * (1 - f) + 0.06;
  const speed = (index % 2 === 0 ? 1 : -1) * (0.5 - f * 0.32); // střídavé CW/CCW, hlubší pomalejší

  useFrame((_, delta) => {
    if (mesh.current) mesh.current.rotation.z += delta * speed;
  });

  return (
    <mesh ref={mesh} position={[0, 0, z]} scale={scale}>
      <planeGeometry args={[2.1, 2.1]} />
      <meshBasicMaterial
        map={tex}
        color="#7ec8ff"
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/** Šrí Jantra — několik plochých vrstev v popředí, pomalá protiroace. */
function Yantra({ tex }: { tex: THREE.Texture }) {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (a.current) a.current.rotation.z = t * 0.045;
    if (b.current) b.current.rotation.z = -t * 0.03;
  });
  return (
    <>
      <mesh ref={a} position={[0, 0, 0.02]}>
        <planeGeometry args={[2.6, 2.6]} />
        <meshBasicMaterial
          map={tex}
          color="#fcd116"
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={b} position={[0, 0, -0.04]} scale={1.12}>
        <planeGeometry args={[2.6, 2.6]} />
        <meshBasicMaterial
          map={tex}
          color="#f5f5f5"
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
}

/** Chevron ring — 39 značek kolem rámu, hover → roztočí se. */
function ChevronRing({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const speed = useRef(0.06);
  useFrame((_, delta) => {
    const target = active ? 0.9 : 0.06;
    speed.current += (target - speed.current) * 0.08;
    if (group.current) group.current.rotation.z += delta * speed.current;
  });
  const marks = useMemo(
    () =>
      Array.from({ length: CHEVRONS }, (_, i) => {
        const a = (i / CHEVRONS) * Math.PI * 2;
        return {
          key: i,
          pos: [Math.cos(a) * 1.72, Math.sin(a) * 1.72, 0] as [number, number, number],
          rot: a,
        };
      }),
    [],
  );
  return (
    <group ref={group}>
      {marks.map((m) => (
        <mesh key={m.key} position={m.pos} rotation={[0, 0, m.rot]}>
          <boxGeometry args={[0.045, 0.17, 0.045]} />
          <meshBasicMaterial color={active ? '#fcd116' : '#7ec8ff'} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * StarGate — Brána IntroPage přenesená do 3D.
 * Kaleidoskopický tunel vadžr (hloubka místo CSS scale-tricku), Šrí Jantra
 * v popředí, 39 chevronů na rámu, event horizon uprostřed, nebula v pozadí.
 */
export function StarGate({ portal, onOpen }: { portal: Portal; onOpen: (id: string) => void }) {
  const gate = useRef<THREE.Group>(null);
  const horizon = useRef<THREE.MeshBasicMaterial>(null);
  const [hover, setHover] = useState(false);

  const [vajraSrc, yantraSrc, nebulaSrc] = useTexture([
    '/stargate/2.png',
    '/stargate/1.png',
    '/stargate/nebula.jpg',
  ]);

  const masks = useMemo(
    () => ({ vajra: glyphMask(vajraSrc), yantra: glyphMask(yantraSrc) }),
    [vajraSrc, yantraSrc],
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (gate.current) {
      gate.current.position.y = GATE_POS[1] + Math.sin(t * 0.6) * 0.16;
      gate.current.rotation.y = -0.42 + Math.sin(t * 0.22) * 0.05;
    }
    if (horizon.current) {
      horizon.current.opacity = (hover ? 0.55 : 0.3) + Math.sin(t * 2.4) * 0.1;
    }
  });

  return (
    <group ref={gate} position={GATE_POS} rotation={[0.12, -0.42, 0]}>
      {/* rám brány */}
      <mesh
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
        <torusGeometry args={[1.7, 0.08, 12, 72]} />
        <meshStandardMaterial color="#8a6d1f" metalness={0.85} roughness={0.3} emissive="#fcd116" emissiveIntensity={hover ? 0.35 : 0.12} />
      </mesh>
      {/* neviditelný hit-disk — klik/kolize na celou plochu brány */}
      <mesh
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
        <circleGeometry args={[1.7, 32]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <ChevronRing active={hover} />
      {/* event horizon — energetická hladina */}
      <mesh position={[0, 0, -0.01]}>
        <circleGeometry args={[1.18, 48]} />
        <meshBasicMaterial
          ref={horizon}
          color="#c084fc"
          transparent
          opacity={0.32}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* nebula v hloubce tunelu */}
      <mesh position={[0, 0, -TUNNEL_DEPTH - 0.8]} scale={3.2}>
        <circleGeometry args={[1.7, 32]} />
        <meshBasicMaterial
          map={nebulaSrc}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* volumetrický tunel vadžr */}
      {masks.vajra &&
        Array.from({ length: TUNNEL_LAYERS }, (_, i) => (
          <TunnelLayer key={i} tex={masks.vajra!} index={i} total={TUNNEL_LAYERS} />
        ))}
      {masks.yantra && <Yantra tex={masks.yantra} />}
      <Html position={[0, -2.05, 0]} center distanceFactor={20} style={{ pointerEvents: 'none' }}>
        <span className="scene-label scene-label-gate">{portal.title.cs}</span>
      </Html>
    </group>
  );
}
