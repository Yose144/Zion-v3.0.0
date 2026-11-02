'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LINK_COLOR, LINK_ACTIVE_OPACITY } from './links';

export function LinkTrail({ visible = false }: { visible?: boolean }) {
  const lineRef = useRef<any>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const points = useRef<THREE.Vector3[]>([]);
  const timeRef = useRef(0);

  useFrame((state, delta) => {
    if (!visible || !lineRef.current || !geometryRef.current) return;
    
    timeRef.current += delta;
    const camera = state.camera;
    const target = (state.controls as { target?: THREE.Vector3 })?.target ?? new THREE.Vector3();
    
    // Create a smooth curve from camera to target
    const segments = 12;
    const points: THREE.Vector3[] = [];
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const point = new THREE.Vector3().lerpVectors(camera.position, target, t);
      
      // Add gentle wave
      const wave = Math.sin(t * Math.PI * 3 + timeRef.current * 2) * 0.8;
      point.y += wave * (1 - Math.abs(t - 0.5) * 2);
      
      // Add perpendicular drift
      const drift = Math.cos(t * Math.PI * 2 + timeRef.current * 1.5) * 0.3;
      const perp = new THREE.Vector3(-target.z + camera.position.z, 0, target.x - camera.position.x).normalize();
      point.addScaledVector(perp, drift);
      
      points.push(point);
    }
    
    geometryRef.current.setFromPoints(points);
    
    // Animate opacity
    const mat = lineRef.current.material as THREE.LineBasicMaterial;
    mat.opacity = 0.2 + Math.sin(timeRef.current * 3) * 0.15;
  });

  if (!visible) return null;

  return (
    <line ref={lineRef as any}>
      <bufferGeometry ref={geometryRef} />
      <lineBasicMaterial 
        color={LINK_COLOR} 
        transparent 
        opacity={0.35} 
        linewidth={2}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </line>
  );
}
