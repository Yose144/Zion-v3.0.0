'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import { WORLDS } from '../domain/config/worlds';
import type { World } from '../domain/types/world';
import type { MobileInput } from './MobileControls';

interface FlightControlsProps {
  enabled: boolean;
  onExit: () => void;
  onSpeedChange?: (speed: number) => void;
  onCanLand?: (world: World | null) => void;
  onApproach?: (world: World) => void;
  onBoost?: () => void;
  mobileInputRef?: React.RefObject<MobileInput | null>;
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

export interface FlightControlsHandle {
  lock: () => void;
  unlock: () => void;
}

const FlightControls = forwardRef<FlightControlsHandle, FlightControlsProps>(
  function FlightControls({ enabled, onExit, onSpeedChange, onCanLand, onApproach, onBoost, mobileInputRef, baseSpeed = 3.5 }, ref) {
    const { camera } = useThree();
    const controlsRef = useRef<any>(null);
    const keys = useRef({ ...keysInitial });
    const speedRef = useRef(0);
    const canLandWorld = useRef<World | null>(null);

    useImperativeHandle(ref, () => ({
      lock: () => controlsRef.current?.lock(),
      unlock: () => controlsRef.current?.unlock(),
    }));

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
        if (k === 'l' && canLandWorld.current) {
          onApproach?.(canLandWorld.current);
          return;
        }
        if (k === ' ') {
          if (!keys.current.boost) onBoost?.();
          keys.current.boost = true;
        }
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

      // Landing detection
      let best: World | null = null;
      let bestScore = 0;
      for (const w of WORLDS) {
        if (!w.galaxyPosition) continue;
        const size = w.category === 'star-system' ? 0.28 : w.category === 'planet' ? 0.22 : w.category === 'world' ? 0.24 : 0.2;
        const pos = new THREE.Vector3(w.galaxyPosition.x, w.galaxyPosition.y, w.galaxyPosition.z);
        const dist = pos.distanceTo(camera.position);
        const dir = pos.clone().sub(camera.position).normalize();
        const dot = forward.dot(dir);
        const maxDist = size * 7;
        if (dist < maxDist && dot > 0.82) {
          const score = dot * (1 - dist / maxDist);
          if (score > bestScore) {
            bestScore = score;
            best = w;
          }
        }
      }

      if (best?.id !== canLandWorld.current?.id) {
        canLandWorld.current = best;
        onCanLand?.(best);
      }

      const mobile = mobileInputRef?.current;

      // Mobile look
      if (mobile && (Math.abs(mobile.look.x) > 0.05 || Math.abs(mobile.look.y) > 0.05)) {
        const yaw = -mobile.look.x * 2.2 * delta;
        const pitch = -mobile.look.y * 1.8 * delta;
        camera.rotateY(yaw);
        camera.rotateX(pitch);
      }

      const move = new THREE.Vector3();
      if (mobile) {
        if (Math.abs(mobile.move.y) > 0.05) move.add(forward.clone().multiplyScalar(mobile.move.y));
        if (Math.abs(mobile.move.x) > 0.05) move.add(right.clone().multiplyScalar(mobile.move.x));
        if (mobile.up) move.add(up);
        if (mobile.down) move.sub(up);
      } else {
        if (keys.current.forward) move.add(forward);
        if (keys.current.backward) move.sub(forward);
        if (keys.current.right) move.add(right);
        if (keys.current.left) move.sub(right);
        if (keys.current.up) move.add(up);
        if (keys.current.down) move.sub(up);
      }

      const boost = (keys.current.boost || mobile?.boost) ? 3.5 : keys.current.slow ? 0.35 : 1;
      const targetSpeed = move.length() > 0.05 ? baseSpeed * boost : 0;
      speedRef.current += (targetSpeed - speedRef.current) * 5 * delta;
      onSpeedChange?.(speedRef.current);

      if (move.length() > 0) {
        move.normalize().multiplyScalar(speedRef.current * delta);
        camera.position.add(move);
      }
    });

    if (mobileInputRef?.current) return null;

    return (
      <PointerLockControls
        ref={controlsRef}
        onUnlock={() => {
          if (enabled) onExit();
        }}
      />
    );
  }
);

export default FlightControls;
export { keysInitial };
