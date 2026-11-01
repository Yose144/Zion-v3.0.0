'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * STŘELNICE — jediná hra v parku, která není na obrazovce.
 *
 * Pět terčů poletuje před pultem, klik (myš) nebo paprsek (VR) je srazí.
 * Dvacet pět sekund, deset bodů za zásah. Protože je to čistý raycast,
 * je to ve VR nejpřirozenější věc v celém parku.
 */

export const GALLERY_SECONDS = 25;
export const GALLERY_HIT = 10;
const TARGETS = 5;
const RESPAWN = 0.55;

interface TargetState {
  x: number;
  y: number;
  z: number;
  phase: number;
  speed: number;
  alive: boolean;
  respawn: number;
  flash: number;
}

function makeTargets(): TargetState[] {
  return Array.from({ length: TARGETS }, (_, i) => ({
    x: (i - (TARGETS - 1) / 2) * 1.5,
    y: 1.2 + (i % 3) * 0.55,
    z: 1.6,
    phase: i * 1.7,
    speed: 0.6 + (i % 4) * 0.18,
    alive: true,
    respawn: 0,
    flash: 0,
  }));
}

export function ShootingGallery({
  active,
  onScore,
  onTime,
  onEnd,
}: {
  active: boolean;
  onScore: (score: number) => void;
  onTime: (secondsLeft: number) => void;
  onEnd: (score: number) => void;
}) {
  const targets = useRef<TargetState[]>(makeTargets());
  const nodes = useRef<(THREE.Group | null)[]>([]);
  const score = useRef(0);
  const left = useRef(GALLERY_SECONDS);
  const running = useRef(false);
  const [hover, setHover] = useState(false);

  const geometry = useMemo(() => new THREE.TorusGeometry(0.42, 0.07, 8, 32), []);
  const coreGeometry = useMemo(() => new THREE.CircleGeometry(0.34, 24), []);
  const lastTick = useRef(GALLERY_SECONDS);

  useFrame((_, delta) => {
    const step = Math.min(0.05, delta);

    if (active && !running.current) {
      // nový běh
      running.current = true;
      score.current = 0;
      left.current = GALLERY_SECONDS;
      lastTick.current = GALLERY_SECONDS;
      targets.current = makeTargets();
      onScore(0);
      onTime(GALLERY_SECONDS);
    }
    if (!active && running.current) {
      running.current = false;
    }

    if (running.current) {
      left.current -= step;
      const whole = Math.max(0, Math.ceil(left.current));
      if (whole !== lastTick.current) {
        lastTick.current = whole;
        onTime(whole);
      }
      if (left.current <= 0) {
        running.current = false;
        onEnd(score.current);
      }
    }

    for (let i = 0; i < targets.current.length; i++) {
      const target = targets.current[i];
      const node = nodes.current[i];
      if (!node) continue;

      if (!target.alive) {
        target.respawn -= step;
        if (target.respawn <= 0) {
          target.alive = true;
          target.x = (Math.random() - 0.5) * 5.4;
          target.y = 0.9 + Math.random() * 1.9;
          target.phase = Math.random() * Math.PI * 2;
        }
      }

      if (target.flash > 0) target.flash = Math.max(0, target.flash - step * 3);

      const t = performance.now() / 1000;
      const drift = running.current ? 1 : 0.25;
      node.visible = target.alive;
      node.position.set(
        target.x + Math.sin(t * target.speed + target.phase) * 0.55 * drift,
        target.y + Math.cos(t * target.speed * 0.8 + target.phase) * 0.28 * drift,
        target.z,
      );
      const pulse = 1 + Math.sin(t * 2.4 + target.phase) * 0.05 + target.flash * 0.35;
      node.scale.setScalar(pulse);
    }
  });

  return (
    <group position={[10.2, 0, 2.4]} rotation={[0, -1.15, 0]}>
      {/* pult */}
      <mesh position={[0, 0.55, 1.1]} castShadow>
        <boxGeometry args={[6.4, 1.1, 0.9]} />
        <meshStandardMaterial color="#4a3c5e" metalness={0.25} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.14, 1.1]}>
        <boxGeometry args={[6.6, 0.12, 1.0]} />
        <meshStandardMaterial color="#ffd166" metalness={0.7} roughness={0.3} emissive="#4a3208" emissiveIntensity={0.5} />
      </mesh>
      {/* zadní stěna */}
      <mesh position={[0, 2.2, -0.5]}>
        <boxGeometry args={[6.8, 4.4, 0.22]} />
        <meshStandardMaterial color="#1c1626" metalness={0.2} roughness={0.8} />
      </mesh>
      <mesh position={[0, 4.42, -0.4]}>
        <planeGeometry args={[6.4, 0.5]} />
        <meshBasicMaterial color="#7fe3d4" transparent opacity={0.25} />
      </mesh>

      {targets.current.map((target, index) => (
        <group
          key={index}
          ref={(node) => {
            nodes.current[index] = node;
          }}
          position={[target.x, target.y, target.z]}
          onClick={(event) => {
            event.stopPropagation();
            const current = targets.current[index];
            if (!active || !running.current || !current?.alive) return;
            current.alive = false;
            current.respawn = RESPAWN;
            current.flash = 1;
            score.current += GALLERY_HIT;
            onScore(score.current);
          }}
          onPointerOver={(event) => {
            event.stopPropagation();
            setHover(true);
            document.body.style.cursor = 'crosshair';
          }}
          onPointerOut={() => {
            setHover(false);
            document.body.style.cursor = 'auto';
          }}
        >
          <mesh geometry={geometry}>
            <meshBasicMaterial color={running.current ? '#ffd166' : '#8a7a52'} toneMapped={false} />
          </mesh>
          <mesh geometry={coreGeometry} position={[0, 0, 0.01]}>
            <meshBasicMaterial color="#7fe3d4" transparent opacity={0.55} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0, 0.02]}>
            <circleGeometry args={[0.09, 12]} />
            <meshBasicMaterial color="#fff3d0" toneMapped={false} />
          </mesh>
          <pointLight position={[0, 0, 0.4]} intensity={hover ? 3 : 1.6} color="#ffd166" distance={3} decay={2} />
        </group>
      ))}
    </group>
  );
}
