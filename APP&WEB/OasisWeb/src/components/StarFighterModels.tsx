'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ShipModelId } from '../store/gameStore';

/**
 * Procedural 3D starfighter models built from Three.js primitives.
 * Each model is hand-crafted to resemble its iconic Star Wars counterpart
 * while remaining lightweight (no external STL files needed).
 *
 * Inspired by the wooden laser-cut starfighter project by Graham Smith
 * (https://eigenbloom.com/woodenstarfighter/) — these are the digital
 * counterparts that fly in the OASIS galaxy.
 */

interface ShipModelProps {
  color: string;
  boostLevel?: number;
  speed?: number;
}

const hullMat = (color: string, emissive = 0.12) => (
  <meshStandardMaterial color={color} metalness={0.6} roughness={0.35} emissive={color} emissiveIntensity={emissive} />
);

const cockpitMat = <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} emissive="#06b6d4" emissiveIntensity={0.15} />;

// ── X-Wing ──
export function XWingModel({ color, boostLevel = 1, speed = 0 }: ShipModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const engineRefs = useRef<THREE.Mesh[]>([]);
  const sfoilsRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (sfoilsRef.current) {
      // Open S-foils slightly with speed
      const target = Math.min(0.3 + speed * 0.02, 0.55);
      sfoilsRef.current.rotation.z = THREE.MathUtils.lerp(sfoilsRef.current.rotation.z, target, 0.05);
    }
    engineRefs.current.forEach((m) => {
      if (m) {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.6 + Math.min(speed / 8, 1) * (1 + boostLevel * 0.4);
      }
    });
  });

  return (
    <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Fuselage */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.015, 0.18, 12]} />
        {hullMat(color)}
      </mesh>
      {/* Nose cone */}
      <mesh position={[0, 0, -0.11]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.03, 0.06, 12]} />
        {hullMat(color)}
      </mesh>
      {/* Cockpit */}
      <mesh position={[0, 0.025, 0.02]} scale={[1, 0.6, 1.4]}>
        <sphereGeometry args={[0.022, 16, 16]} />
        {cockpitMat}
      </mesh>
      {/* S-foils (X-wing open position) */}
      <group ref={sfoilsRef}>
        {/* Upper-left wing */}
        <group position={[-0.05, 0.04, 0.02]} rotation={[0, 0, -0.4]}>
          <mesh position={[-0.04, 0, 0]}>
            <boxGeometry args={[0.09, 0.008, 0.03]} />
            {hullMat(color)}
          </mesh>
          {/* Wing tip cannon */}
          <mesh position={[-0.085, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.004, 0.004, 0.04, 6]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Engine */}
          <mesh ref={(m) => { if (m) engineRefs.current[0] = m; }} position={[0.01, 0, 0]}>
            <sphereGeometry args={[0.014, 12, 12]} />
            <meshStandardMaterial color="#ffffff" emissive="#ff4400" emissiveIntensity={0.8} toneMapped={false} />
          </mesh>
        </group>
        {/* Upper-right wing */}
        <group position={[0.05, 0.04, 0.02]} rotation={[0, 0, 0.4]}>
          <mesh position={[0.04, 0, 0]}>
            <boxGeometry args={[0.09, 0.008, 0.03]} />
            {hullMat(color)}
          </mesh>
          <mesh position={[0.085, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.004, 0.004, 0.04, 6]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh ref={(m) => { if (m) engineRefs.current[1] = m; }} position={[-0.01, 0, 0]}>
            <sphereGeometry args={[0.014, 12, 12]} />
            <meshStandardMaterial color="#ffffff" emissive="#ff4400" emissiveIntensity={0.8} toneMapped={false} />
          </mesh>
        </group>
        {/* Lower-left wing */}
        <group position={[-0.05, -0.04, 0.02]} rotation={[0, 0, 0.4]}>
          <mesh position={[-0.04, 0, 0]}>
            <boxGeometry args={[0.09, 0.008, 0.03]} />
            {hullMat(color)}
          </mesh>
          <mesh position={[-0.085, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.004, 0.004, 0.04, 6]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh ref={(m) => { if (m) engineRefs.current[2] = m; }} position={[0.01, 0, 0]}>
            <sphereGeometry args={[0.014, 12, 12]} />
            <meshStandardMaterial color="#ffffff" emissive="#ff4400" emissiveIntensity={0.8} toneMapped={false} />
          </mesh>
        </group>
        {/* Lower-right wing */}
        <group position={[0.05, -0.04, 0.02]} rotation={[0, 0, -0.4]}>
          <mesh position={[0.04, 0, 0]}>
            <boxGeometry args={[0.09, 0.008, 0.03]} />
            {hullMat(color)}
          </mesh>
          <mesh position={[0.085, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.004, 0.004, 0.04, 6]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh ref={(m) => { if (m) engineRefs.current[3] = m; }} position={[-0.01, 0, 0]}>
            <sphereGeometry args={[0.014, 12, 12]} />
            <meshStandardMaterial color="#ffffff" emissive="#ff4400" emissiveIntensity={0.8} toneMapped={false} />
          </mesh>
        </group>
      </group>
      {/* R2 droid dome */}
      <mesh position={[0, 0.028, 0.07]}>
        <sphereGeometry args={[0.014, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.5} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ── Y-Wing ──
export function YWingModel({ color, boostLevel = 1, speed = 0 }: ShipModelProps) {
  const engineRefs = useRef<THREE.Mesh[]>([]);
  useFrame(() => {
    engineRefs.current.forEach((m) => {
      if (m) {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.5 + Math.min(speed / 8, 1) * (1 + boostLevel * 0.4);
      }
    });
  });

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* Long narrow fuselage */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.02, 0.2, 10]} />
        {hullMat(color, 0.08)}
      </mesh>
      {/* Nose */}
      <mesh position={[0, 0, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.025, 0.06, 10]} />
        {hullMat(color, 0.08)}
      </mesh>
      {/* Cockpit */}
      <mesh position={[0, 0.03, 0.03]} scale={[1, 0.7, 1.5]}>
        <sphereGeometry args={[0.02, 14, 14]} />
        {cockpitMat}
      </mesh>
      {/* Twin engine nacelles */}
      <group position={[-0.06, 0, 0.03]}>
        <mesh>
          <cylinderGeometry args={[0.022, 0.022, 0.14, 12]} />
          <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh ref={(m) => { if (m) engineRefs.current[0] = m; }} position={[0, 0, 0.08]}>
          <sphereGeometry args={[0.016, 12, 12]} />
          <meshStandardMaterial color="#ffffff" emissive="#ff6600" emissiveIntensity={0.7} toneMapped={false} />
        </mesh>
      </group>
      <group position={[0.06, 0, 0.03]}>
        <mesh>
          <cylinderGeometry args={[0.022, 0.022, 0.14, 12]} />
          <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh ref={(m) => { if (m) engineRefs.current[1] = m; }} position={[0, 0, 0.08]}>
          <sphereGeometry args={[0.016, 12, 12]} />
          <meshStandardMaterial color="#ffffff" emissive="#ff6600" emissiveIntensity={0.7} toneMapped={false} />
        </mesh>
      </group>
      {/* Connecting struts */}
      <mesh position={[-0.03, 0, 0.03]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.06, 0.006, 0.01]} />
        {hullMat(color, 0.08)}
      </mesh>
      <mesh position={[0.03, 0, 0.03]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.06, 0.006, 0.01]} />
        {hullMat(color, 0.08)}
      </mesh>
      {/* R2 droid */}
      <mesh position={[0, 0.022, 0.08]}>
        <sphereGeometry args={[0.012, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ── Jedi Starfighter (Eta-2) ──
export function JediStarfighterModel({ color, boostLevel = 1, speed = 0 }: ShipModelProps) {
  const engineRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (engineRef.current) {
      const mat = engineRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.6 + Math.min(speed / 8, 1) * (1 + boostLevel * 0.4);
    }
  });

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* Sleek pointed fuselage */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.008, 0.2, 8]} />
        {hullMat(color, 0.15)}
      </mesh>
      <mesh position={[0, 0, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.018, 0.08, 8]} />
        {hullMat(color, 0.15)}
      </mesh>
      {/* Cockpit */}
      <mesh position={[0, 0.015, 0.02]} scale={[1, 0.5, 1.6]}>
        <sphereGeometry args={[0.016, 12, 12]} />
        {cockpitMat}
      </mesh>
      {/* Delta wings — swept back */}
      <mesh position={[-0.05, -0.005, 0.04]} rotation={[0, -0.5, 0.1]}>
        <boxGeometry args={[0.08, 0.006, 0.06]} />
        {hullMat(color, 0.15)}
      </mesh>
      <mesh position={[0.05, -0.005, 0.04]} rotation={[0, 0.5, -0.1]}>
        <boxGeometry args={[0.08, 0.006, 0.06]} />
        {hullMat(color, 0.15)}
      </mesh>
      {/* Tail fins */}
      <mesh position={[-0.03, 0.01, 0.08]} rotation={[0, -0.3, 0]}>
        <boxGeometry args={[0.04, 0.006, 0.03]} />
        {hullMat(color, 0.15)}
      </mesh>
      <mesh position={[0.03, 0.01, 0.08]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.04, 0.006, 0.03]} />
        {hullMat(color, 0.15)}
      </mesh>
      {/* Engine */}
      <mesh ref={engineRef} position={[0, 0, 0.11]}>
        <sphereGeometry args={[0.012, 12, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#22d3ee" emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
      {/* Astromech */}
      <mesh position={[0, 0.018, 0.06]}>
        <sphereGeometry args={[0.01, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.5} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ── Slave I (Boba Fett's ship) ──
export function Slave1Model({ color, boostLevel = 1, speed = 0 }: ShipModelProps) {
  const engineRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (engineRef.current) {
      const mat = engineRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + Math.min(speed / 8, 1) * (1 + boostLevel * 0.4);
    }
  });

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* Main body — asymmetric ovoid */}
      <mesh position={[0, 0, 0]} scale={[1, 0.7, 1.3]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        {hullMat(color, 0.1)}
      </mesh>
      {/* Cockpit — offset to the right */}
      <mesh position={[0.02, 0.02, -0.03]} scale={[0.6, 0.5, 1]} >
        <sphereGeometry args={[0.016, 12, 12]} />
        {cockpitMat}
      </mesh>
      {/* Engine block — bottom */}
      <mesh position={[0, -0.03, 0.04]}>
        <boxGeometry args={[0.06, 0.02, 0.05]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Engine glow */}
      <mesh ref={engineRef} position={[0, -0.03, 0.07]}>
        <sphereGeometry args={[0.014, 12, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#ff6600" emissiveIntensity={0.7} toneMapped={false} />
      </mesh>
      {/* Wing fins */}
      <mesh position={[-0.05, 0, 0.02]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[0.03, 0.006, 0.06]} />
        {hullMat(color, 0.1)}
      </mesh>
      <mesh position={[0.05, 0, 0.02]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[0.03, 0.006, 0.06]} />
        {hullMat(color, 0.1)}
      </mesh>
      {/* Mandible / cargo arm */}
      <mesh position={[0, 0.02, -0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.04, 6]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

// ── Millennium Falcon ──
export function FalconModel({ color, boostLevel = 1, speed = 0 }: ShipModelProps) {
  const engineRefs = useRef<THREE.Mesh[]>([]);
  useFrame(() => {
    engineRefs.current.forEach((m) => {
      if (m) {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.5 + Math.min(speed / 8, 1) * (1 + boostLevel * 0.4);
      }
    });
  });

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* Saucer body — flat disc */}
      <mesh position={[0, 0, 0]} scale={[1, 0.35, 1]}>
        <sphereGeometry args={[0.05, 24, 24]} />
        {hullMat(color, 0.08)}
      </mesh>
      {/* Front mandibles */}
      <mesh position={[-0.03, -0.005, -0.07]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.05, 6]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0.03, -0.005, -0.07]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.05, 6]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Mandible tips */}
      <mesh position={[-0.03, -0.005, -0.095]}>
        <boxGeometry args={[0.012, 0.008, 0.01]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0.03, -0.005, -0.095]}>
        <boxGeometry args={[0.012, 0.008, 0.01]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Cockpit — right side offset tube */}
      <mesh position={[0.04, 0.012, -0.02]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.012, 0.012, 0.05, 12]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh position={[0.055, 0.022, -0.02]} scale={[0.8, 0.7, 1]}>
        <sphereGeometry args={[0.014, 12, 12]} />
        {cockpitMat}
      </mesh>
      {/* Rear engines — twin blocks */}
      <mesh position={[-0.025, 0, 0.045]}>
        <boxGeometry args={[0.025, 0.025, 0.03]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0.025, 0, 0.045]}>
        <boxGeometry args={[0.025, 0.025, 0.03]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Engine glows */}
      <mesh ref={(m) => { if (m) engineRefs.current[0] = m; }} position={[-0.025, 0, 0.062]}>
        <sphereGeometry args={[0.012, 12, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#00aaff" emissiveIntensity={0.7} toneMapped={false} />
      </mesh>
      <mesh ref={(m) => { if (m) engineRefs.current[1] = m; }} position={[0.025, 0, 0.062]}>
        <sphereGeometry args={[0.012, 12, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#00aaff" emissiveIntensity={0.7} toneMapped={false} />
      </mesh>
      {/* Top radar dish */}
      <mesh position={[0, 0.022, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.014, 0.006, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

// ── Star Destroyer ──
export function StarDestroyerModel({ color, boostLevel = 1, speed = 0 }: ShipModelProps) {
  const engineRefs = useRef<THREE.Mesh[]>([]);
  useFrame(() => {
    engineRefs.current.forEach((m) => {
      if (m) {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.4 + Math.min(speed / 8, 1) * (1 + boostLevel * 0.3);
      }
    });
  });

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} scale={1.5}>
      {/* Triangular wedge hull */}
      <mesh position={[0, 0, 0]} scale={[1, 0.25, 1.6]}>
        <coneGeometry args={[0.06, 0.16, 4]} />
        {hullMat(color, 0.06)}
      </mesh>
      {/* Bridge tower */}
      <mesh position={[0, 0.025, 0.04]}>
        <boxGeometry args={[0.015, 0.02, 0.015]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.04, 0.04]}>
        <boxGeometry args={[0.01, 0.008, 0.01]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Engine array — 3 thrusters */}
      <mesh ref={(m) => { if (m) engineRefs.current[0] = m; }} position={[-0.02, 0, 0.085]}>
        <sphereGeometry args={[0.01, 10, 10]} />
        <meshStandardMaterial color="#ffffff" emissive="#00aaff" emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
      <mesh ref={(m) => { if (m) engineRefs.current[1] = m; }} position={[0, 0, 0.085]}>
        <sphereGeometry args={[0.012, 10, 10]} />
        <meshStandardMaterial color="#ffffff" emissive="#00aaff" emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
      <mesh ref={(m) => { if (m) engineRefs.current[2] = m; }} position={[0.02, 0, 0.085]}>
        <sphereGeometry args={[0.01, 10, 10]} />
        <meshStandardMaterial color="#ffffff" emissive="#00aaff" emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
      {/* Hull detailing — surface lights */}
      <mesh position={[0, 0.012, -0.02]}>
        <boxGeometry args={[0.04, 0.001, 0.02]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.3} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── Factory: render the right model by id ──
export function ProceduralShip({
  modelId,
  color,
  boostLevel = 1,
  speed = 0,
}: {
  modelId: ShipModelId;
  color: string;
  boostLevel?: number;
  speed?: number;
}) {
  switch (modelId) {
    case 'xwing':
      return <XWingModel color={color} boostLevel={boostLevel} speed={speed} />;
    case 'ywing':
      return <YWingModel color={color} boostLevel={boostLevel} speed={speed} />;
    case 'jedistarfighter':
      return <JediStarfighterModel color={color} boostLevel={boostLevel} speed={speed} />;
    case 'slave1':
      return <Slave1Model color={color} boostLevel={boostLevel} speed={speed} />;
    case 'falcon':
      return <FalconModel color={color} boostLevel={boostLevel} speed={speed} />;
    case 'stardestroyer':
      return <StarDestroyerModel color={color} boostLevel={boostLevel} speed={speed} />;
    case 'pilgrim':
    default:
      // Pilgrim Scout is handled by PilgrimShip's default procedural model
      return <PilgrimScoutModel color={color} boostLevel={boostLevel} speed={speed} />;
  }
}

// ── Pilgrim Scout (extracted for reuse in gallery) ──
export function PilgrimScoutModel({ color, boostLevel = 1, speed = 0 }: ShipModelProps) {
  const engineRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (engineRef.current) {
      const mat = engineRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.6 + Math.min(speed / 8, 1) * (1 + boostLevel * 0.4);
    }
  });

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* Main hull */}
      <mesh position={[0, 0, 0.05]}>
        <coneGeometry args={[0.04, 0.22, 12]} />
        {hullMat(color)}
      </mesh>
      {/* Cockpit */}
      <mesh position={[0, 0.02, -0.02]}>
        <sphereGeometry args={[0.022, 16, 16]} />
        {cockpitMat}
      </mesh>
      {/* Wings */}
      <mesh position={[-0.06, 0, 0.04]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[0.08, 0.01, 0.04]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0.06, 0, 0.04]} rotation={[0, -0.4, 0]}>
        <boxGeometry args={[0.08, 0.01, 0.04]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Engine glow */}
      <mesh ref={engineRef} position={[0, 0, 0.16]}>
        <sphereGeometry args={[0.018 + boostLevel * 0.004, 16, 16]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
    </group>
  );
}
