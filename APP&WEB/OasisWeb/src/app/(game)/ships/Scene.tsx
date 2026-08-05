'use client';

import { useEffect, useMemo, useState, memo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { getZonePosition } from '@/lib/zones';
import { SHIP_MODELS, useGameStore, getLevel, type ShipModelId } from '@/store/gameStore';
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
  const level = getLevel(xp);

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
        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} emissive="#06b6d4" emissiveIntensity={0.05} />
      </mesh>

      {/* Central hologram pedestal */}
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.3, 0.4, 0.3, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 0.15, 16]} />
        <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.3} transparent opacity={0.6} />
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

  const color = isUnlocked ? ship.color : '#475569';
  const opacity = isUnlocked ? 1 : 0.5;

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Pedestal */}
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.2, 0.25, 0.1, 12]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Hologram ring */}
      <mesh position={[0, -0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.22, 24]} />
        <meshBasicMaterial color={isSelected ? '#06b6d4' : isUnlocked ? ship.color : '#64748b'} transparent opacity={0.4} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
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
            background: isSelected ? 'rgba(6,182,212,0.3)' : isUnlocked ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.5)',
            color: isSelected ? '#06b6d4' : isUnlocked ? '#ffffff' : '#64748b',
            border: `1px solid ${isSelected ? '#06b6d4' : isUnlocked ? ship.color : '#334155'}`,
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
        <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
      </div>
      <p className="text-xs text-gray-400">{ship.description}</p>
      <div className="flex gap-2 text-[10px]">
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-oasis-cyan">{ship.class}</span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-gray-300">Lv {ship.unlockLevel}+</span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-oasis-gold">{ship.unlockCost} Z</span>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <StatBar label="Boost" value={ship.stats.boost} max={5} color="#ef4444" />
        <StatBar label="Cargo" value={ship.stats.cargo} max={5} color="#f59e0b" />
        <StatBar label="Scan" value={ship.stats.scanner} max={5} color="#22d3ee" />
        <StatBar label="Hull" value={ship.stats.hp} max={500} color="#10b981" />
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
          <div className="flex-1 rounded-lg bg-white/5 py-2 text-center text-xs text-gray-500">
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
      <span className="text-[8px] text-gray-500">{label}</span>
      <div className="h-12 w-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="w-full rounded-full" style={{ height: `${pct * 100}%`, backgroundColor: color, marginTop: `${(1 - pct) * 100}%` }} />
      </div>
      <span className="text-[8px] font-bold" style={{ color }}>{value}</span>
    </div>
  );
}
