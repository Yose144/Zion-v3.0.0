'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { World, WorldCategory, WorldLayer } from '../domain/types/world';
import { CATEGORY_COLORS } from '../lib/categoryColors';
import { useGameStore } from '../store/gameStore';
import WorldNode from './World';
import Hyperlanes from './Hyperlanes';

const CATEGORY_SIZES: Record<string, number> = {
  'star-system': 0.34,
  'planet': 0.2,
  'sector': 0.22,
  'world': 0.21,
  'dimension': 0.19,
};

const CORE = new THREE.Vector3(0, 0.4, 0);

interface GalaxyMapProps {
  worlds: World[];
  activeCategories: WorldCategory[];
  activeLayers?: WorldLayer[];
  selectedWorldId?: string | null;
  onWorldSelect?: (world: World) => void;
  isMobile?: boolean;
}

const RING_QUAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
const IDENTITY_QUAT = new THREE.Quaternion();

/**
 * Far-field world nodes as two instanced draws (spheres + orbit rings).
 * 350+ non-star worlds collapse from ~700 draw calls to 2 — raycast still
 * resolves per-instance so hover/select semantics are preserved; the
 * hovered/selected node is rendered as a full World node on top instead.
 */
function InstancedWorldNodes({
  worlds,
  discoveredSet,
  onHover,
  onSelect,
}: {
  worlds: World[];
  discoveredSet: Set<string>;
  onHover: (world: World | null) => void;
  onSelect?: (world: World) => void;
}) {
  const spheresRef = useRef<THREE.InstancedMesh>(null);
  const ringsRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const spheres = spheresRef.current;
    const rings = ringsRef.current;
    if (!spheres || !rings) return;
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();
    worlds.forEach((w, i) => {
      const p = w.galaxyPosition!;
      const size = CATEGORY_SIZES[w.category] || 0.28;
      const dist = Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2);
      const ds = dist > 55 ? size * 1.6 : size;
      pos.set(p.x, p.y, p.z);
      scl.setScalar(ds);
      m.compose(pos, IDENTITY_QUAT, scl);
      spheres.setMatrixAt(i, m);
      m.compose(pos, RING_QUAT, scl);
      rings.setMatrixAt(i, m);
      const discovered = discoveredSet.has(w.id);
      col.set(CATEGORY_COLORS[w.category] || '#ffffff');
      if (!discovered) col.multiplyScalar(0.3);
      spheres.setColorAt(i, col);
      col.multiplyScalar(discovered ? 0.55 : 0.4);
      rings.setColorAt(i, col);
    });
    spheres.instanceMatrix.needsUpdate = true;
    rings.instanceMatrix.needsUpdate = true;
    if (spheres.instanceColor) spheres.instanceColor.needsUpdate = true;
    if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
    spheres.computeBoundingSphere();
    rings.computeBoundingSphere();
  }, [worlds, discoveredSet]);

  const worldAt = (instanceId: number | undefined) =>
    instanceId === undefined ? undefined : worlds[instanceId];

  return (
    <>
      <instancedMesh
        ref={spheresRef}
        args={[undefined, undefined, worlds.length]}
        frustumCulled={false}
        onPointerMove={(e) => {
          e.stopPropagation();
          onHover(worldAt(e.instanceId) ?? null);
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          const w = worldAt(e.instanceId);
          if (w) onSelect?.(w);
        }}
      >
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={ringsRef}
        args={[undefined, undefined, worlds.length]}
        frustumCulled={false}
        raycast={() => null}
      >
        <ringGeometry args={[1.45, 1.55, 20]} />
        <meshBasicMaterial
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </instancedMesh>
    </>
  );
}

export default function GalaxyMap({ worlds, activeCategories, activeLayers, selectedWorldId, onWorldSelect, isMobile = false }: GalaxyMapProps) {
  const groupRef = useRef<THREE.Group>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const discoveredWorlds = useGameStore((s) => s.discoveredWorlds);
  const discoveredSet = useMemo(() => new Set(discoveredWorlds), [discoveredWorlds]);

  const visibleWorlds = useMemo(
    () => worlds.filter((w) => {
      const catOk = activeCategories.includes(w.category as WorldCategory);
      const layerOk = !activeLayers || activeLayers.length === 0 || activeLayers.includes(w.layer);
      return catOk && layerOk && w.galaxyPosition;
    }),
    [worlds, activeCategories, activeLayers]
  );

  // Star systems keep their rays/gate/vortex as full nodes; everything else
  // renders instanced. The selected node mounts as a full World node (stable
  // click target); the hovered node stays instanced and gets a raycast-free
  // overlay — handing the raycast target mid-hover would flicker.
  const instancedWorlds = useMemo(
    () => visibleWorlds.filter((w) => w.category !== 'star-system' && w.id !== selectedWorldId),
    [visibleWorlds, selectedWorldId]
  );
  const detailedWorlds = useMemo(
    () => visibleWorlds.filter((w) => w.category === 'star-system' || w.id === selectedWorldId),
    [visibleWorlds, selectedWorldId]
  );
  const hoveredWorld = useMemo(
    () => visibleWorlds.find((w) => w.id === hoveredId && w.category !== 'star-system' && w.id !== selectedWorldId) ?? null,
    [visibleWorlds, hoveredId, selectedWorldId]
  );

  const { lineGeometry, lineMaterial } = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];

    for (const w of visibleWorlds) {
      if (!w.galaxyPosition) continue;
      const color = new THREE.Color(CATEGORY_COLORS[w.category] || '#ffffff');
      const p = w.galaxyPosition;

      positions.push(p.x, p.y, p.z, CORE.x, CORE.y, CORE.z);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });

    return { lineGeometry: geometry, lineMaterial: material };
  }, [visibleWorlds]);

  return (
    <group ref={groupRef}>
      {/* Constellation lines to galactic core */}
      <lineSegments ref={linesRef} geometry={lineGeometry} material={lineMaterial} />

      {/* Inter-world hyperlane / warp-gate network */}
      <Hyperlanes worlds={worlds} isMobile={isMobile} />

      {/* Bulk far-field nodes — one draw call for spheres, one for rings.
          Star systems and the hovered/selected node stay full World nodes. */}
      <InstancedWorldNodes
        worlds={instancedWorlds}
        discoveredSet={discoveredSet}
        onHover={(w) => setHoveredId(w?.id ?? null)}
        onSelect={onWorldSelect}
      />

      {detailedWorlds.map((w) => {
        const color = CATEGORY_COLORS[w.category] || '#ffffff';
        const size = CATEGORY_SIZES[w.category] || 0.28;
        const isSelected = w.id === selectedWorldId;

        return (
          <WorldNode
            key={w.id}
            id={w.id}
            name={w.name}
            color={color}
            position={[w.galaxyPosition!.x, w.galaxyPosition!.y, w.galaxyPosition!.z]}
            size={size}
            info={w.summary}
            category={w.category}
            showLabel={isSelected}
            isSelected={isSelected}
            isDiscovered={discoveredSet.has(w.id)}
            isMobile={isMobile}
            onSelect={() => onWorldSelect?.(w)}
          />
        );
      })}

      {/* Hover overlay for instanced nodes — aura + label, no raycast */}
      {hoveredWorld && (
        <group position={[hoveredWorld.galaxyPosition!.x, hoveredWorld.galaxyPosition!.y, hoveredWorld.galaxyPosition!.z]}>
          {(() => {
            const size = CATEGORY_SIZES[hoveredWorld.category] || 0.28;
            const p = hoveredWorld.galaxyPosition!;
            const dist = Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2);
            const ds = dist > 55 ? size * 1.6 : size;
            const color = CATEGORY_COLORS[hoveredWorld.category] || '#ffffff';
            return (
              <>
                <mesh raycast={() => null}>
                  <sphereGeometry args={[ds * 1.6, 16, 16]} />
                  <meshBasicMaterial color={color} transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
                </mesh>
                {!isMobile && (
                  <Html distanceFactor={14} center position={[0, ds + 0.65, 0]}>
                    <div className="pointer-events-none select-none rounded border border-white/10 bg-black/70 px-2 py-1 text-center shadow-lg backdrop-blur-sm">
                      <span className="whitespace-nowrap text-[9px] font-semibold tracking-wide text-white/90" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>{hoveredWorld.name}</span>
                    </div>
                  </Html>
                )}
              </>
            );
          })()}
        </group>
      )}
    </group>
  );
}
