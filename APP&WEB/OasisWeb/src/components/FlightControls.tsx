'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';

interface FlightControlsProps {
  enabled: boolean;
  onExit: () => void;
  baseSpeed?: number;
}

const MOVEMENT: Record<string, keyof typeof keysInitial> = {
  w: 'forward',
  s: 'backward',
  a: 'left',
  d: 'right',
  q: 'down',
  e: 'up',
  arrowup: 'forward',
  arrowdown: 'backward',
  arrowleft: 'left',
  arrowright: 'right',
};

const keysInitial = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  up: false,
  down: false,
  boost: false,
  slow: false,
};

export default function FlightControls({ enabled, onExit, baseSpeed = 3.5 }: FlightControlsProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const keys = useRef({ ...keysInitial });
  const speedRef = useRef(0);

  useEffect(() => {
    if (enabled) {
      controlsRef.current?.lock();
    } else {
      controlsRef.current?.unlock();
    }
  }, [enabled]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'f') {
        onExit();
        return;
      }
      if (k === ' ') keys.current.boost = true;
      if (k === 'shift') keys.current.slow = true;
      const dir = MOVEMENT[k];
      if (dir) keys.current[dir] = true;
    };

    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === ' ') keys.current.boost = false;
      if (k === 'shift') keys.current.slow = false;
      const dir = MOVEMENT[k];
      if (dir) keys.current[dir] = false;
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [onExit]);

  useFrame((_, delta) => {
    if (!enabled) return;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0);

    const move = new THREE.Vector3();
    if (keys.current.forward) move.add(forward);
    if (keys.current.backward) move.sub(forward);
    if (keys.current.right) move.add(right);
    if (keys.current.left) move.sub(right);
    if (keys.current.up) move.add(up);
    if (keys.current.down) move.sub(up);

    const boost = keys.current.boost ? 3.5 : keys.current.slow ? 0.35 : 1;
    const targetSpeed = move.length() > 0 ? baseSpeed * boost : 0;
    speedRef.current += (targetSpeed - speedRef.current) * 5 * delta;

    if (move.length() > 0) {
      move.normalize().multiplyScalar(speedRef.current * delta);
      camera.position.add(move);
    }
  });

  return (
    <PointerLockControls
      ref={controlsRef}
      onUnlock={() => {
        if (enabled) onExit();
      }}
    />
  );
}

export { keysInitial };
