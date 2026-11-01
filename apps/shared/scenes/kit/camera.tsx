/** @jsxRuntime classic */
'use client';

/**
 * Cinematic entrance for the project scenes.
 *
 * The scene renders its final framing immediately (so screenshots and reduced-motion
 * users see the composed shot). On a normal visit the camera starts on a slightly
 * wider, higher orbit and eases to that framing over a few seconds, then hands control
 * to OrbitControls. Deep links and audits skip the move: `?beat=N` or `?intro=0`.
 */

import { React, useFrame, useThree, THREE } from '@genesis/runtime';

import { quality } from './quality';

let mediaReduced = false;
let mediaBound = false;

function bindReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (!mediaBound) {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaReduced = query.matches;
    query.addEventListener('change', (event) => {
      mediaReduced = event.matches;
    });
    mediaBound = true;
  }
  return mediaReduced;
}

/** Current reduced-motion preference (single media query for every canvas on the page). */
export function reducedMotion(): boolean {
  return bindReducedMotion();
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(() => bindReducedMotion());
  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function params(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export interface CinematicIntroProps {
  target: [number, number, number];
  /** How much farther out the move starts, as a multiple of the final distance. */
  distance?: number;
  /** Extra height at the start, as a fraction of the final distance. */
  rise?: number;
  /** Yaw offset in radians at the start. */
  yaw?: number;
  duration?: number;
  enabled?: boolean;
}

export function CinematicIntro({ target, distance = 1.34, rise = 0.22, yaw = 0.34, duration = 3.4, enabled = true }: CinematicIntroProps) {
  const { camera, controls } = useThree();
  const state = React.useRef<{ from: THREE.Vector3; to: THREE.Vector3; elapsed: number; active: boolean } | null>(null);
  const orbit = controls as unknown as { enabled?: boolean; autoRotate?: boolean; target?: THREE.Vector3 } | null;

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = params();
    const skip = !enabled || reducedMotion() || query.has('beat') || query.get('intro') === '0' || quality().tier === 'C';
    const to = camera.position.clone();
    if (skip) {
      if (orbit) orbit.enabled = true;
      return;
    }
    const focus = new THREE.Vector3(...target);
    const offset = to.clone().sub(focus);
    const direction = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const start = focus
      .clone()
      .add(offset.clone().multiplyScalar(distance))
      .add(new THREE.Vector3(0, offset.length() * rise, 0))
      .add(new THREE.Vector3(direction.x, 0, direction.z).multiplyScalar(offset.length() * 0.12));
    camera.position.copy(start);
    // A fixed vertical FOV across the move keeps the framing stable as we approach.
    camera.lookAt(focus);
    state.current = { from: start, to, elapsed: 0, active: true };
    if (orbit) {
      orbit.enabled = false;
      if (orbit.autoRotate !== undefined) orbit.autoRotate = false;
    }
    return () => {
      if (orbit) orbit.enabled = true;
    };
    // The intro is a one-shot on mount; target/camera identity is stable per canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    const current = state.current;
    if (!current?.active) return;
    current.elapsed = Math.min(duration, current.elapsed + delta);
    const t = current.elapsed / duration;
    // easeInOutCubic: slow reveal, no snap at either end.
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    camera.position.lerpVectors(current.from, current.to, eased);
    camera.lookAt(new THREE.Vector3(...target));
    if (t >= 1) {
      current.active = false;
      if (orbit) {
        orbit.enabled = true;
        if (orbit.autoRotate !== undefined) orbit.autoRotate = true;
      }
    }
  }, -2);

  return null;
}
