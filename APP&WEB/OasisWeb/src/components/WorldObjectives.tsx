'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { createRandom } from '../domain/ports/random';
import { useGameStore } from '../store/gameStore';
import { useToastStore } from '../store/toastStore';
import type { World } from '../domain/types/world';

type NodeKind = 'scan' | 'harvest' | 'relic';

const NODE_STYLE: Record<NodeKind, { color: string; label: string }> = {
  scan:    { color: '#22d3ee', label: 'Scan node' },
  harvest: { color: '#f59e0b', label: 'Harvest cache' },
  relic:   { color: '#a78bfa', label: 'Relic echo' },
};

const NODE_GEOMETRY: Record<NodeKind, (r: number) => THREE.BufferGeometry> = {
  scan:    (r) => new THREE.OctahedronGeometry(r),
  harvest: (r) => new THREE.IcosahedronGeometry(r * 0.94),
  relic:   (r) => new THREE.TetrahedronGeometry(r * 1.1),
};

interface ObjectiveNode {
  key: string;
  kind: NodeKind;
  position: [number, number, number];
  phase: number;
  speed: number;
}

interface WorldObjectivesProps {
  world: World;
  /** central body radius — nodes orbit just outside it */
  size: number;
  isMobile?: boolean;
}

/**
 * In-world objectives — small clickable interactives orbiting the world so
 * entering a world is gameplay, not just a view. Scan/harvest/relic nodes
 * award XP/credits once each (persisted), relic echoes surface world lore.
 */
export default function WorldObjectives({ world, size, isMobile }: WorldObjectivesProps) {
  const count = isMobile ? 3 : 5;
  const seed = useMemo(() => world.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 7331, [world.id]);

  const nodes = useMemo<ObjectiveNode[]>(() => {
    const rng = createRandom(seed);
    const kinds: NodeKind[] = ['scan', 'harvest', 'relic', 'scan', 'harvest'];
    const out: ObjectiveNode[] = [];
    for (let i = 0; i < count; i++) {
      // Spherical shell just outside the body, biased above the horizon so
      // nodes aren't hidden behind the planet on the default camera angle.
      const theta = rng.next() * Math.PI * 2;
      const phi = rng.next() * Math.PI * 0.42 + 0.15;
      const r = size * (2.7 + rng.next() * 0.9);
      out.push({
        key: `${world.id}:${i}`,
        kind: kinds[i % kinds.length],
        position: [
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta),
        ],
        phase: rng.next() * Math.PI * 2,
        speed: 0.6 + rng.next() * 0.8,
      });
    }
    return out;
  }, [seed, count, size, world.id]);

  return (
    <group>
      {nodes.map((n) => (
        <ObjectiveNodeMesh key={n.key} node={n} world={world} size={size} />
      ))}
    </group>
  );
}

function ObjectiveNodeMesh({ node, world, size }: { node: ObjectiveNode; world: World; size: number }) {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const collected = useGameStore((s) => s.collectedNodes.includes(node.key));
  const collectNode = useGameStore((s) => s.collectNode);
  const addXp = useGameStore((s) => s.addXp);
  const addCredits = useGameStore((s) => s.addCredits);
  const scanWorld = useGameStore((s) => s.scanWorld);
  const scannedWorlds = useGameStore((s) => s.scannedWorlds);
  const shipLoadout = useGameStore((s) => s.shipLoadout);
  const addToast = useToastStore((s) => s.add);
  const style = NODE_STYLE[node.kind];
  // Node radius scales with the world so markers stay visible against large
  // environments (Issobella station spans ~10 units at size 2.4).
  const nodeRadius = 0.075 * size;
  const geometry = useMemo(() => NODE_GEOMETRY[node.kind](nodeRadius), [node.kind, nodeRadius]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y += 0.02 * node.speed;
    ref.current.rotation.x = Math.sin(t * node.speed + node.phase) * 0.3;
    ref.current.position.set(
      node.position[0],
      node.position[1] + Math.sin(t * node.speed + node.phase) * 0.12,
      node.position[2],
    );
    const pulse = 1 + Math.sin(t * 3 + node.phase) * 0.12;
    ref.current.scale.setScalar((hovered ? 1.5 : 1) * pulse);
  });

  if (collected) return null;

  const collect = () => {
    if (!collectNode(node.key)) return;
    const first = (ms: string) => ms.split(/(?<=[.!?])\s/)[0] ?? ms;
    if (node.kind === 'scan') {
      const xp = 15 + shipLoadout.scanner * 10;
      addXp(xp);
      const isNew = !scannedWorlds.includes(world.id);
      scanWorld(world.id);
      addToast(`Signal logged — ${world.name}${isNew ? ' scanned' : ''}: +${xp} XP`, 'success', 3000);
    } else if (node.kind === 'harvest') {
      const credits = 15 + shipLoadout.cargo * 10;
      addCredits(credits);
      addXp(10);
      addToast(`Harvest cache secured: +${credits} Z · +10 XP`, 'success', 3000);
    } else {
      addXp(35);
      addToast(`Relic echo — ${first(world.summary)}`, 'info', 4500);
    }
  };

  return (
    <group
      ref={ref}
      position={node.position}
      onClick={(e) => {
        e.stopPropagation();
        collect();
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
      <mesh geometry={geometry}>
        <meshBasicMaterial color={style.color} toneMapped={false} />
      </mesh>
      <mesh geometry={geometry} scale={1.9}>
        <meshBasicMaterial
          color={style.color}
          transparent
          opacity={hovered ? 0.35 : 0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          wireframe
        />
      </mesh>
      {hovered && (
        <Html center distanceFactor={9} position={[0, nodeRadius * 3.2, 0]}>
          <div className="pointer-events-none select-none whitespace-nowrap rounded border border-white/15 bg-black/80 px-2 py-0.5 text-[9px] font-bold tracking-wide" style={{ color: style.color }}>
            {style.label}
          </div>
        </Html>
      )}
    </group>
  );
}
