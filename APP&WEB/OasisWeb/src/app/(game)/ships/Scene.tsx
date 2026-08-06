'use client';

import { useEffect, useMemo, useState, memo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { getZonePosition } from '@/lib/zones';
import { SHIP_MODELS, HIRAN_KEYS, useGameStore, getLevel, type ShipModelId } from '@/store/gameStore';
import { useToastStore } from '@/store/toastStore';
import { ProceduralShip } from '@/components/StarFighterModels';

const zonePos = getZonePosition('ships');

const STL_CACHE: Record<string, THREE.BufferGeometry> = {};

function loadSTL(path: string): Promise<THREE.BufferGeometry> {
  if (STL_CACHE[path]) return Promise.resolve(STL_CACHE[path]);
  return new Promise((resolve, reject) => {
    new STLLoader().load(path, (geo) => {
      geo.computeVertexNormals();
      geo.center();
      STL_CACHE[path] = geo;
      resolve(geo);
    }, undefined, reject);
  });
}

export default function ShipsScene() {
  const [selected, setSelected] = useState<ShipModelId | null>(null);
  const unlockedShips = useGameStore(s => s.unlockedShips);
  const xp = useGameStore(s => s.xp);
  const activeModel = useGameStore(s => s.shipLoadout.model);
  const collectedHiranKeys = useGameStore(s => s.collectedHiranKeys);
  const level = getLevel(xp);

  // Key #1: B-Wing quantum core — only visible when B-Wing is the active ship
  const bwingKeyFound = collectedHiranKeys.includes('bwing-quantum-core');
  const bwingKeyVisible = activeModel === 'bwing' && !bwingKeyFound;

  // Arrange ships in a circle
  const positions = useMemo(() => {
    return SHIP_MODELS.map((_, i) => {
      const angle = (i / SHIP_MODELS.length) * Math.PI * 2;
      const r = 2.5;
      return new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    });
  }, []);

  const selectedPos = useMemo(() => {
    if (!selected) return null;
    const i = SHIP_MODELS.findIndex((s) => s.id === selected);
    return i >= 0 ? positions[i] : null;
  }, [selected, positions]);

  return (
    <group position={zonePos}>
      {/* Hangar platform */}
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 3.5, 32]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} emissive="#078930" emissiveIntensity={0.05} />
      </mesh>

      {/* Central hologram pedestal */}
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.3, 0.4, 0.3, 16]} />
        <meshStandardMaterial color="#3d3d3d" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 0.15, 16]} />
        <meshStandardMaterial color="#078930" emissive="#078930" emissiveIntensity={0.3} transparent opacity={0.6} />
      </mesh>

      {SHIP_MODELS.map((ship, i) => {
        const pos = positions[i] ?? new THREE.Vector3();
        const isUnlocked = unlockedShips.includes(ship.id);
        const canUnlock = level >= ship.unlockLevel;
        return (
          <ShipDisplay
            key={ship.id}
            ship={ship}
            position={pos}
            isUnlocked={isUnlocked}
            canUnlock={canUnlock}
            isSelected={selected === ship.id}
            onSelect={() => setSelected(ship.id)}
          />
        );
      })}

      {selected && selectedPos && (
        <Html
          transform
          center
          distanceFactor={8}
          position={[selectedPos.x, selectedPos.y + 0.8, selectedPos.z]}
          className="pointer-events-auto"
          style={{ width: 'min(90vw, 300px)' }}
        >
          <div className="rounded-2xl border border-white/10 bg-black/80 p-4 backdrop-blur-xl">
            <ShipDetail shipId={selected} onClose={() => setSelected(null)} />
          </div>
        </Html>
      )}

      {/* ── Hiranyagarbha Key #1: B-Wing Quantum Core ── */}
      {/* Only visible when B-Wing is the active ship and key not yet found */}
      {bwingKeyVisible && (() => {
        const bwingIdx = SHIP_MODELS.findIndex((s) => s.id === 'bwing');
        const bwingPos = positions[bwingIdx] ?? new THREE.Vector3();
        return <QuantumCoreKey position={bwingPos} />;
      })()}

      {/* Show found key indicator on B-Wing pedestal */}
      {bwingKeyFound && (() => {
        const bwingIdx = SHIP_MODELS.findIndex((s) => s.id === 'bwing');
        const bwingPos = positions[bwingIdx] ?? new THREE.Vector3();
        return (
          <mesh position={[bwingPos.x, bwingPos.y + 0.45, bwingPos.z]}>
            <octahedronGeometry args={[0.04, 0]} />
            <meshStandardMaterial color="#fcd116" emissive="#fcd116" emissiveIntensity={0.8} toneMapped={false} />
          </mesh>
        );
      })()}
    </group>
  );
}

// ── Quantum Core Key: hidden easter egg in B-Wing ──
function QuantumCoreKey({ position }: { position: THREE.Vector3 }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const [discovered, setDiscovered] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const collectHiranKey = useGameStore(s => s.collectHiranKey);
  const addToast = useToastStore(s => s.add);
  const keyDef = HIRAN_KEYS[0];

  useFrame((state, delta) => {
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 2;
      coreRef.current.rotation.x += delta * 0.8;
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.3;
    }
  });

  if (discovered) return null;

  return (
    <group position={[position.x, position.y + 0.35, position.z]}>
      {/* Pulsing quantum core — clickable */}
      <mesh
        ref={coreRef}
        onClick={(e) => {
          e.stopPropagation();
          const ok = collectHiranKey(keyDef.id);
          if (ok) {
            setDiscovered(true);
            addToast(`🔑 ${keyDef.name} — Key #1 of 108 found! +${keyDef.reward} XP`, 'success', 6000);
          }
        }}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; setShowHint(true); }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; setShowHint(false); }}
      >
        <octahedronGeometry args={[0.05, 0]} />
        <meshStandardMaterial
          color="#fcd116"
          emissive="#fcd116"
          emissiveIntensity={0.8}
          toneMapped={false}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Inner glow */}
      <mesh>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color="#fcd116" transparent opacity={0.15} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Light */}
      <pointLight color="#fcd116" intensity={0.8} distance={1.5} />

      {/* Hint label on hover */}
      {showHint && (
        <Html position={[0, 0.2, 0]} center distanceFactor={6} occlude={false}>
          <div className="whitespace-nowrap rounded-full bg-black/80 px-3 py-1 text-[10px] font-bold text-oasis-gold border border-oasis-gold/40">
            ⚡ Quantum Core — click to reveal
          </div>
        </Html>
      )}
    </group>
  );
}

const ShipDisplay = memo(function ShipDisplay({
  ship,
  position,
  isUnlocked,
  canUnlock,
  isSelected,
  onSelect,
}: {
  ship: typeof SHIP_MODELS[number];
  position: THREE.Vector3;
  isUnlocked: boolean;
  canUnlock: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [stlGeo, setStlGeo] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    if (!ship.stlPath || ship.procedural) { setStlGeo(null); return; }
    let cancelled = false;
    loadSTL(ship.stlPath).then((geo) => { if (!cancelled) setStlGeo(geo); }).catch(() => {});
    return () => { cancelled = true; };
  }, [ship.stlPath, ship.procedural]);

  const normalizedGeo = useMemo(() => {
    if (!stlGeo) return null;
    const geo = stlGeo.clone();
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 0.35 / maxDim;
    geo.scale(scale, scale, scale);
    geo.center();
    return geo;
  }, [stlGeo]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  const color = isUnlocked ? ship.color : '#4a4a4a';
  const opacity = isUnlocked ? 1 : 0.5;

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Pedestal */}
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.2, 0.25, 0.1, 12]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Hologram ring */}
      <mesh position={[0, -0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.22, 24]} />
        <meshBasicMaterial color={isSelected ? '#078930' : isUnlocked ? ship.color : '#6b6b6b'} transparent opacity={0.4} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>

      {/* Ship model */}
      <group ref={groupRef} onClick={onSelect} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = 'auto')}>
        {ship.procedural ? (
          <group scale={1.4}>
            <ProceduralShip modelId={ship.id} color={color} boostLevel={1} speed={0} />
          </group>
        ) : normalizedGeo ? (
          <mesh geometry={normalizedGeo} rotation={[-Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} emissive={color} emissiveIntensity={0.1} transparent opacity={opacity} />
          </mesh>
        ) : (
          <mesh>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} transparent opacity={opacity} />
          </mesh>
        )}
      </group>

      {/* Label */}
      <Html position={[0, 0.5, 0]} center distanceFactor={10} occlude={false}>
        <div
          onClick={onSelect}
          className="cursor-pointer select-none whitespace-nowrap rounded-full px-3 py-1 text-[10px] font-bold transition"
          style={{
            background: isSelected ? 'rgba(7,137,48,0.3)' : isUnlocked ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.5)',
            color: isSelected ? '#078930' : isUnlocked ? '#ffffff' : '#6b6b6b',
            border: `1px solid ${isSelected ? '#078930' : isUnlocked ? ship.color : '#3d3d3d'}`,
          }}
        >
          {ship.label}
          {!isUnlocked && canUnlock && <span className="ml-1 text-oasis-gold">★</span>}
          {!isUnlocked && !canUnlock && <span className="ml-1">🔒</span>}
        </div>
      </Html>
    </group>
  );
});

function ShipDetail({ shipId, onClose }: { shipId: ShipModelId; onClose: () => void }) {
  const ship = SHIP_MODELS.find((s) => s.id === shipId)!;
  const unlockedShips = useGameStore(s => s.unlockedShips);
  const credits = useGameStore(s => s.credits);
  const xp = useGameStore(s => s.xp);
  const unlockShip = useGameStore(s => s.unlockShip);
  const setShipModel = useGameStore(s => s.setShipModel);
  const addToast = useToastStore(s => s.add);
  const level = getLevel(xp);
  const isUnlocked = unlockedShips.includes(shipId);
  const canUnlock = level >= ship.unlockLevel && credits >= ship.unlockCost;
  const isActive = useGameStore(s => s.shipLoadout.model) === shipId;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold" style={{ color: ship.color }}>{ship.label}</h3>
        <button onClick={onClose} className="text-white/70 hover:text-white">✕</button>
      </div>
      <p className="text-xs text-white/70">{ship.description}</p>
      <div className="flex gap-2 text-[10px]">
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-oasis-cyan">{ship.class}</span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-white/80">Lv {ship.unlockLevel}+</span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-oasis-gold">{ship.unlockCost} Z</span>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <StatBar label="Boost" value={ship.stats.boost} max={5} color="#e41e2b" />
        <StatBar label="Cargo" value={ship.stats.cargo} max={5} color="#fcd116" />
        <StatBar label="Scan" value={ship.stats.scanner} max={5} color="#078930" />
        <StatBar label="Hull" value={ship.stats.hp} max={500} color="#078930" />
      </div>
      {/* Actions */}
      <div className="flex gap-2">
        {isActive && (
          <div className="flex-1 rounded-lg bg-oasis-emerald/20 py-2 text-center text-xs font-bold text-oasis-emerald">
            Active Ship
          </div>
        )}
        {!isActive && isUnlocked && (
          <button
            onClick={() => { setShipModel(shipId); addToast(`${ship.label} selected`, 'success', 2000); onClose(); }}
            className="flex-1 rounded-lg bg-oasis-cyan/20 py-2 text-xs font-bold text-oasis-cyan transition hover:bg-oasis-cyan/30"
          >
            Select Ship
          </button>
        )}
        {!isUnlocked && canUnlock && (
          <button
            onClick={() => {
              if (unlockShip(shipId)) { addToast(`${ship.label} unlocked!`, 'success', 3000); }
              else { addToast('Cannot unlock yet', 'error', 2000); }
            }}
            className="flex-1 rounded-lg bg-oasis-gold/20 py-2 text-xs font-bold text-oasis-gold transition hover:bg-oasis-gold/30"
          >
            Unlock ({ship.unlockCost} Z)
          </button>
        )}
        {!isUnlocked && !canUnlock && (
          <div className="flex-1 rounded-lg bg-white/5 py-2 text-center text-xs text-white/60">
            {level < ship.unlockLevel ? `Requires Level ${ship.unlockLevel}` : `Need ${ship.unlockCost} Z`}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(1, value / max);
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[8px] text-white/60">{label}</span>
      <div className="h-12 w-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="w-full rounded-full" style={{ height: `${pct * 100}%`, backgroundColor: color, marginTop: `${(1 - pct) * 100}%` }} />
      </div>
      <span className="text-[8px] font-bold" style={{ color }}>{value}</span>
    </div>
  );
}
