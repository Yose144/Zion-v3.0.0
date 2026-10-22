'use client';

import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface CameraFlightProps {
  target: THREE.Vector3;
}

interface OrbitControlsLike {
  target: THREE.Vector3;
  update: () => void;
}

export default function CameraFlight({ target }: CameraFlightProps) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsLike | null>(null);
  const progress = useRef(0);
  const arrivedRef = useRef(false);
  const [arrived, setArrived] = useState(false);
  const startPos = useRef(new THREE.Vector3(0, 9, 20));

  useFrame((state, delta) => {
    if (!arrivedRef.current) {
      progress.current = Math.min(1, progress.current + delta * 0.55);
      const t = 1 - Math.pow(1 - progress.current, 3);
      const endPos = target.clone().add(new THREE.Vector3(0, 3.2, 6.5));
      camera.position.lerpVectors(startPos.current, endPos, t);
      camera.lookAt(target);

      if (controlsRef.current) {
        controlsRef.current.target.copy(target);
        controlsRef.current.update();
      }

      if (progress.current >= 1 && !arrivedRef.current) {
        arrivedRef.current = true;
        setArrived(true);
      }
    }
  });

  return (
    <OrbitControls
      // @ts-expect-error - drei OrbitControls ref is loosely typed in R3F v9
      ref={controlsRef}
      target={[target.x, target.y, target.z]}
      enablePan={arrived}
      enableZoom={arrived}
      enableRotate={arrived}
      autoRotate={arrived}
      autoRotateSpeed={0.2}
      enableDamping
      dampingFactor={0.05}
    />
  );
}
