'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { useGameStore, SHIP_MODELS, type ShipModelId } from '../store/gameStore';

interface PilgrimShipProps {
  speed?: number;
}

const STL_CACHE: Record<string, THREE.BufferGeometry> = {};

function loadSTL(path: string): Promise<THREE.BufferGeometry> {
  if (STL_CACHE[path]) return Promise.resolve(STL_CACHE[path]);
  return new Promise((resolve, reject) => {
    new STLLoader().load(
      path,
      (geo) => {
        geo.computeVertexNormals();
        geo.center();
        STL_CACHE[path] = geo;
        resolve(geo);
      },
      undefined,
      reject
    );
  });
}

export default function PilgrimShip({ speed = 0 }: PilgrimShipProps) {
  const { shipLoadout } = useGameStore();
  const color = shipLoadout.color;
  const boostLevel = shipLoadout.boost;
  const modelId: ShipModelId = shipLoadout.model || 'pilgrim';
  const groupRef = useRef<THREE.Group>(null);
  const engineRef = useRef<THREE.Mesh>(null);
  const stlMeshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const [stlGeometry, setStlGeometry] = useState<THREE.BufferGeometry | null>(null);

  const modelInfo = SHIP_MODELS.find((m) => m.id === modelId) || SHIP_MODELS[0];

  useEffect(() => {
    if (!modelInfo.stlPath) {
      setStlGeometry(null);
      return;
    }
    let cancelled = false;
    loadSTL(modelInfo.stlPath).then((geo) => {
      if (!cancelled) setStlGeometry(geo);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [modelInfo.stlPath]);

  // Normalize STL to fit in a small bounding box
  const normalizedGeometry = useMemo(() => {
    if (!stlGeometry) return null;
    const geo = stlGeometry.clone();
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetSize = 0.25;
    const scale = targetSize / maxDim;
    geo.scale(scale, scale, scale);
    geo.center();
    return geo;
  }, [stlGeometry]);

  useFrame(() => {
    if (!groupRef.current) return;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const offset = forward.clone().multiplyScalar(-0.18).add(up.clone().multiplyScalar(-0.12));

    groupRef.current.position.copy(camera.position).add(offset);
    groupRef.current.quaternion.copy(camera.quaternion);

    if (engineRef.current) {
      const engineColor = new THREE.Color(color);
      const intensity = 0.8 + Math.min(speed / 8, 1) * (1 + boostLevel * 0.6);
      const material = engineRef.current.material as THREE.MeshStandardMaterial;
      material.emissive.copy(engineColor);
      material.emissiveIntensity = intensity;
    }
  });

  // If we have an STL model, render it
  if (normalizedGeometry) {
    return (
      <group ref={groupRef}>
        <mesh ref={stlMeshRef} geometry={normalizedGeometry} rotation={[-Math.PI / 2, 0, 0]}>
          <meshStandardMaterial
            color={color}
            metalness={0.6}
            roughness={0.3}
            emissive={color}
            emissiveIntensity={0.12}
            flatShading={false}
          />
        </mesh>

        {/* Engine glow behind the ship */}
        <mesh ref={engineRef} position={[0, 0, 0.14]}>
          <sphereGeometry args={[0.02 + boostLevel * 0.005, 16, 16]} />
          <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={0.8} toneMapped={false} />
        </mesh>

        {/* Engine ring */}
        <mesh position={[0, 0, 0.13]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.018 + boostLevel * 0.003, 0.028 + boostLevel * 0.005, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  }

  // Default procedural Pilgrim Scout
  return (
    <group ref={groupRef}>
      {/* Main hull */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.05]}>
        <coneGeometry args={[0.04, 0.22, 12]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.6} roughness={0.3} emissive={color} emissiveIntensity={0.15} />
      </mesh>

      {/* Cockpit */}
      <mesh position={[0, 0.02, -0.02]}>
        <sphereGeometry args={[0.022, 16, 16]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.1} />
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

      {/* Engine ring */}
      <mesh position={[0, 0, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.015 + boostLevel * 0.002, 0.025 + boostLevel * 0.004, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
