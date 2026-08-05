'use client';

import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import WarpGateVortex from './WarpGateVortex';
import GlowSprite from './GlowSprite';
import { createRandom } from '../domain/ports/random';

/** Small procedural surface texture so planet/world/sector nodes on the
 *  galaxy map read as tiny textured worlds instead of flat-shaded balls. */
function createMiniSurfaceTexture(baseColor: string, seed: number): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rng = createRandom(seed);
  const base = new THREE.Color(baseColor);
  const light = base.clone().offsetHSL(0, -0.1, 0.18);
  const dark = base.clone().offsetHSL(0, 0.05, -0.12);

  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 14; i++) {
    const useLight = rng.next() > 0.5;
    ctx.fillStyle = `#${(useLight ? light : dark).getHexString()}`;
    ctx.globalAlpha = 0.35 + rng.next() * 0.25;
    const cx = rng.next() * size;
    const cy = rng.next() * size;
    const r = 10 + rng.next() * 26;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * (0.5 + rng.next() * 0.5), rng.next() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const shade = ctx.createRadialGradient(size * 0.38, size * 0.38, size * 0.2, size / 2, size / 2, size * 0.75);
  shade.addColorStop(0, 'rgba(255,255,255,0.15)');
  shade.addColorStop(0.6, 'rgba(0,0,0,0.05)');
  shade.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/** Radiating sun-ray sprite so star-system nodes visibly radiate light,
 *  matching their role as suns anchoring the galaxy map. */
function createSunRayTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;

  ctx.save();
  ctx.translate(c, c);
  const rays = 12;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const grad = ctx.createLinearGradient(0, 0, Math.cos(angle) * c, Math.sin(angle) * c);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 5 + (i % 2) * 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * c, Math.sin(angle) * c);
    ctx.stroke();
  }
  ctx.restore();

  const core = ctx.createRadialGradient(c, c, 0, c, c, size * 0.22);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export interface WorldNodeProps {
  id: string;
  name: string;
  color: string;
  position: [number, number, number];
  size: number;
  info: string;
  category: string;
  showLabel?: boolean;
  isSelected?: boolean;
  isMobile?: boolean;
  onSelect?: (id: string) => void;
}

export default function World({
  id,
  name,
  color,
  position,
  size,
  info,
  category,
  showLabel = false,
  isSelected = false,
  isMobile = false,
  onSelect,
}: WorldNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const gateRef = useRef<THREE.Mesh>(null);
  const rayRef = useRef<THREE.Sprite>(null);
  const [hovered, setHovered] = useState(false);

  const isStarSystem = category === 'star-system';
  const distance = Math.sqrt(position[0] ** 2 + position[1] ** 2 + position[2] ** 2);
  const isDistant = distance > 55;
  const displaySize = isDistant ? size * 1.6 : size;

  const seed = useMemo(() => id.split('').reduce((a, c) => a + c.charCodeAt(0), 0), [id]);
  const surfaceTexture = useMemo(
    () => (isStarSystem ? null : createMiniSurfaceTexture(color, seed)),
    [isStarSystem, color, seed]
  );
  const rayTexture = useMemo(() => (isStarSystem ? createSunRayTexture() : null), [isStarSystem]);

  useLayoutEffect(() => {
    if (gateRef.current) {
      gateRef.current.lookAt(0, 0.4, 0);
    }
  }, []);

  const selected = isSelected;

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.003;
      if (hovered || selected) {
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 6) * 0.03;
        groupRef.current.scale.setScalar(pulse);
      } else {
        groupRef.current.scale.setScalar(1);
      }
    }
    if (rayRef.current) {
      rayRef.current.material.rotation = state.clock.elapsedTime * 0.15;
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.4) * 0.08;
      rayRef.current.scale.set(displaySize * 5 * pulse, displaySize * 5 * pulse, 1);
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Core sphere — physical material picks up HDRI reflections for a
          polished look. Non-star worlds get a tiny procedural surface
          texture so they read as little textured planets, not flat balls. */}
      <mesh>
        <sphereGeometry args={[displaySize * (hovered ? 1.12 : 1), 16, 16]} />
        <meshStandardMaterial
          map={surfaceTexture ?? undefined}
          color={surfaceTexture ? '#ffffff' : color}
          emissive={color}
          emissiveIntensity={surfaceTexture ? (hovered || selected ? 0.55 : 0.3) : hovered || selected ? 0.9 : 0.55}
          roughness={0.4}
          metalness={0.1}
          toneMapped={false}
        />
      </mesh>

      {/* Radiating sun rays — star systems are the anchors of the galaxy
          map, so they should visibly shine rather than just glow. */}
      {isStarSystem && rayTexture && (
        <sprite ref={rayRef} scale={[displaySize * 5, displaySize * 5, 1]}>
          <spriteMaterial
            map={rayTexture}
            color={color}
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      )}

      {/* Soft glow aura — only when hovered or selected to reduce overdraw */}
      {(hovered || selected) && (
        <mesh>
          <sphereGeometry args={[displaySize * 1.6, 16, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={hovered ? 0.16 : 0.13}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Rotating ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[displaySize * 1.45, displaySize * 1.5, 24]} />
        <meshBasicMaterial color={color} transparent opacity={hovered || selected ? 0.55 : 0.22} side={THREE.DoubleSide} />
      </mesh>

      {/* Warp gate ring (star systems + selected) */}
      {(isStarSystem || selected) && (!isMobile || hovered || selected) && (
        <group ref={gateRef}>
          <mesh>
            <torusGeometry args={[displaySize * (isStarSystem ? 2.4 : 2.0), displaySize * 0.07, 8, 32]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={hovered || selected ? 0.55 : 0.25}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <WarpGateVortex color={color} size={displaySize} active={hovered || selected} />
          {(hovered || selected) && <GlowSprite color={color} size={displaySize * 3} opacity={0.45} fog={!isDistant} />}
        </group>
      )}

      {/* Permanent small label for selected / star systems */}
      {((showLabel || selected) && (!isMobile || selected)) && (
        <Html distanceFactor={isDistant ? undefined : 14} center position={[0, displaySize + 0.65, 0]}>
          <div className="pointer-events-none select-none rounded border border-white/10 bg-black/70 px-2 py-1 text-center shadow-lg backdrop-blur-sm">
            <span className="text-[9px] font-semibold tracking-wide text-white/90" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>{name}</span>
          </div>
        </Html>
      )}

      {/* Selected detail card only (no hover popup to reduce clutter) */}
      {selected && !showLabel && (
        <Html distanceFactor={isDistant ? undefined : 12} center position={[0, displaySize + 0.85, 0]}>
          <div className="min-w-[200px] max-w-[280px] pointer-events-none select-none rounded-xl border border-white/15 bg-black/85 p-3 shadow-2xl backdrop-blur-md text-center">
            <div
              className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: `${color}30`, color }}
            >
              {category}
            </div>
            <h3 className="text-sm font-bold text-white" style={{ textShadow: '0 1px 12px rgba(0,0,0,0.8)' }}>{name}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-300">{info}</p>
          </div>
        </Html>
      )}
    </group>
  );
}
