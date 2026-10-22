'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { CompassData } from './Compass';

interface CameraCompassTrackerProps {
  compassRef: React.RefObject<CompassData | null>;
}

export default function CameraCompassTracker({ compassRef }: CameraCompassTrackerProps) {
  const { camera } = useThree();
  const direction = useRef(new THREE.Vector3());

  useFrame(() => {
    camera.getWorldDirection(direction.current);
    const { x, y, z } = camera.position;
    const fx = direction.current.x;
    const fy = direction.current.y;
    const fz = direction.current.z;
    const yaw = Math.atan2(fx, -fz);
    const pitch = Math.asin(Math.max(-1, Math.min(1, fy)));
    compassRef.current = { position: { x, y, z }, forward: { x: fx, y: fy, z: fz }, yaw, pitch };
  });

  return null;
}
