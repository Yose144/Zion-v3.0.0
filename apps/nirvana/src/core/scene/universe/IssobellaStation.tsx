'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Issobella — orbitální stanice L6 podle kanonické předlohy
 * (apps/website-v2.9 Issabela1stSkelet.png + L6StationPreview):
 * habitat ring s parklandem + skleněné biodomy + vodní plochy,
 * 8 paprsků do bílo-zlatého hubu se spirem, dokovací truss dolů,
 * tmavomodrá solární křídla. Škáluje se parametrem.
 */

const HULL = '#f0f3f7'; // stříbrná bílá trupka
const GOLD = '#e8c56a';
const GLASS = '#dff2ff';
const PARK = '#2f9e52';
const WATER = '#3fa8d8';
const PANEL = '#1a2a55';
const WARM = '#ffd98f';

/** Procedurální panelová textura trupu — stříbrné panely, švy, nýty. */
function useHullTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#dfe4ea';
    ctx.fillRect(0, 0, S, S);
    // panelová mřížka — každý panel lehce jiný odstín
    const cols = 10;
    const rows = 10;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = 210 + ((x * 31 + y * 17) % 4) * 8 - 8;
        ctx.fillStyle = `rgb(${v},${v + 3},${v + 8})`;
        ctx.fillRect((x * S) / cols + 1, (y * S) / rows + 1, S / cols - 2, S / rows - 2);
        // nýty v rozích panelu
        ctx.fillStyle = '#9aa4b2';
        ctx.beginPath();
        ctx.arc((x * S) / cols + 5, (y * S) / rows + 5, 1.6, 0, 7);
        ctx.arc(((x + 1) * S) / cols - 5, ((y + 1) * S) / rows - 5, 1.6, 0, 7);
        ctx.fill();
      }
    }
    // švy mezi panely
    ctx.strokeStyle = '#8f99a8';
    ctx.lineWidth = 1.4;
    for (let i = 0; i <= cols; i++) {
      ctx.beginPath();
      ctx.moveTo((i * S) / cols, 0);
      ctx.lineTo((i * S) / cols, S);
      ctx.stroke();
    }
    for (let i = 0; i <= rows; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (i * S) / rows);
      ctx.lineTo(S, (i * S) / rows);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
    tex.anisotropy = 4;
    return tex;
  }, []);
}

export function IssobellaStation({
  position = [0, 0, 0],
  scale = 1,
  low = false,
  onClick,
}: {
  position?: [number, number, number];
  scale?: number;
  low?: boolean;
  onClick?: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const seg = low ? 24 : 48;
  const hullTex = useHullTexture();
  // 10 biodomů + 3 vodní plochy kolem prstence
  const domes = useMemo(() => Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2 + 0.31), []);
  const waters = useMemo(() => [0.7, 2.5, 4.6], []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.32;
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        if (!onClick) return;
        e.stopPropagation();
        onClick();
      }}
    >
      <group scale={scale}>
        {/* Habitat ring — stříbrný panelový trup */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.16, 0.026, 12, seg]} />
          <meshStandardMaterial map={hullTex} color={HULL} emissive="#2a3140" emissiveIntensity={0.15} roughness={0.4} metalness={0.75} />
        </mesh>
        {/* světelný pás oken v trupu */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.16, 0.007, 6, seg]} />
          <meshBasicMaterial color={WARM} transparent opacity={0.7} />
        </mesh>
        {/* Parkland pás na prstenci */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.016, 0]}>
          <torusGeometry args={[0.16, 0.016, 8, seg]} />
          <meshStandardMaterial color={PARK} emissive="#1d7a3f" emissiveIntensity={0.45} roughness={0.75} metalness={0.05} />
        </mesh>
        {/* Vodní plochy v parklandu */}
        {waters.map((a, i) => (
          <mesh key={`w${i}`} position={[Math.cos(a) * 0.16, 0.026, Math.sin(a) * 0.16]} rotation={[0, -a, 0]}>
            <sphereGeometry args={[0.018, 10, 6]} />
            <meshStandardMaterial color={WATER} emissive="#1a6a94" emissiveIntensity={0.5} roughness={0.15} metalness={0.4} />
          </mesh>
        ))}
        {/* Skleněné biodomy po obvodu */}
        {domes.map((a, i) => (
          <mesh key={i} position={[Math.cos(a) * 0.16, 0.032, Math.sin(a) * 0.16]}>
            <sphereGeometry args={[0.024, low ? 8 : 14, low ? 6 : 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={GLASS} emissive={GOLD} emissiveIntensity={0.35} transparent opacity={0.5} roughness={0.05} metalness={0.1} />
          </mesh>
        ))}
        {/* 8 paprsků hub → ring */}
        {Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2).map((a, i) => (
          <group key={`s${i}`} rotation={[0, -a, 0]} position={[Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.006, 0.006, 0.16, 6]} />
              <meshStandardMaterial map={hullTex} color={HULL} roughness={0.4} metalness={0.7} />
            </mesh>
          </group>
        ))}
        {/* Hub — bílo-zlatá katedrála: základna + dome + spire */}
        <mesh position={[0, 0.01, 0]}>
          <cylinderGeometry args={[0.05, 0.06, 0.03, 16]} />
          <meshStandardMaterial map={hullTex} color={HULL} emissive="#2a3140" emissiveIntensity={0.15} roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.045, 0]}>
          <sphereGeometry args={[0.04, low ? 10 : 16, low ? 8 : 12]} />
          <meshStandardMaterial color={GLASS} emissive={WARM} emissiveIntensity={0.55} transparent opacity={0.75} roughness={0.1} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <coneGeometry args={[0.008, 0.09, 8]} />
          <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.6} roughness={0.25} metalness={0.85} />
        </mesh>
        {/* Dokovací truss dolů + modul na konci */}
        <mesh position={[0, -0.07, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.12, 6]} />
          <meshStandardMaterial map={hullTex} color={HULL} roughness={0.4} metalness={0.7} />
        </mesh>
        <mesh position={[0, -0.135, 0]}>
          <capsuleGeometry args={[0.012, 0.03, 4, 8]} />
          <meshStandardMaterial map={hullTex} color="#dfe4ea" roughness={0.4} metalness={0.7} />
        </mesh>
        {/* Solární křídla — velké tmavomodré panely dle předlohy */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.3, 0, 0]}>
            <mesh>
              <boxGeometry args={[0.2, 0.003, 0.075]} />
              <meshStandardMaterial color={PANEL} emissive="#2b4a9e" emissiveIntensity={0.35} roughness={0.25} metalness={0.6} />
            </mesh>
            <mesh position={[s * -0.115, 0, 0]}>
              <boxGeometry args={[0.05, 0.005, 0.012]} />
              <meshStandardMaterial color="#9aa3b2" roughness={0.4} metalness={0.8} />
            </mesh>
          </group>
        ))}
        {/* Issobella warm glow */}
        <mesh scale={2.6}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshBasicMaterial color={GOLD} transparent opacity={0.06} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </group>
  );
}
