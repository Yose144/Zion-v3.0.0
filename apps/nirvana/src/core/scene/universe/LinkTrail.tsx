'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LINK_COLOR } from './links';

export function LinkTrail({ visible = false }: { visible?: boolean }) {
  const lineRef = useRef<THREE.Line>(null);
  const points = useRef<THREE.Vector3[]>([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
  ]);
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  useFrame((state) => {
    if (!visible || !lineRef.current || !geometryRef.current) return;
    
    // Create a simple curved trail
    const camera = state.camera;
    const time = state.clock.elapsedTime;
    
    points.current[0].copy(camera.position).add(new THREE.Vector3(
      Math.sin(time * 2) * 2,
      Math.cos(time * 1.5) * 1,
      Math.sin(time * 0.8) * 2
    ));
    
    points.current[1].copy(camera.position).add(new THREE.Vector3(
      Math.cos(time * 1.2) * 4,
      Math.sin(time * 0.9) * 2,
      Math.cos(time * 1.7) * 4
    ));
    
    // End point would be target - simplified
    points.current[2].copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(10));
    
    geometryRef.current.setFromPoints(points.current);
  });

  if (!visible) return null;

  return (
    <line ref={lineRef}>
      <bufferGeometry ref={geometryRef} />
      <lineBasicMaterial 
        color={LINK_COLOR} 
        transparent 
        opacity={0.3} 
        linewidth={2}
        blending={THREE.AdditiveBlending}
      />
    </line>
  );
}
