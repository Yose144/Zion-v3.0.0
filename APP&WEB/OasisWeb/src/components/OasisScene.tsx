'use client';

import { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { World, WorldCategory } from '../domain/types/world';
import TreeOfLife from './TreeOfLife';
import Galaxy from './Galaxy';
import GalaxyCore from './GalaxyCore';
import GalaxyMap from './GalaxyMap';
import WorldEnvironment from './WorldEnvironment';
import SelectionBeacon from './SelectionBeacon';
import FlightControls from './FlightControls';
import Nebula from './Nebula';

interface CameraRigProps {
  started: boolean;
  onArrived?: () => void;
  view: 'galaxy' | 'world';
  focusTarget?: { x: number; y: number; z: number } | null;
  disabled?: boolean;
}

const GALAXY_HOME = { position: new THREE.Vector3(0, 0.9, 7.5), lookAt: new THREE.Vector3(0, 0.6, 0), fov: 55 };
const WORLD_VIEW = { position: new THREE.Vector3(0, 0.35, 4.5), lookAt: new THREE.Vector3(0, 0, 0), fov: 38 };
const FOCUS_FOV = 45;

function planKey(view: 'galaxy' | 'world', focusTarget?: { x: number; y: number; z: number } | null) {
  if (view === 'world') return 'world';
  return `galaxy:${focusTarget ? `${focusTarget.x.toFixed(3)},${focusTarget.y.toFixed(3)},${focusTarget.z.toFixed(3)}` : 'home'}`;
}

function computeFocusPlan(focusTarget: { x: number; y: number; z: number }) {
  const core = new THREE.Vector3(0, 0.4, 0);
  const target = new THREE.Vector3(focusTarget.x, focusTarget.y, focusTarget.z);
  const toTarget = new THREE.Vector3().subVectors(target, core);
  const distance = toTarget.length();
  const dir = toTarget.normalize();
  const dist = Math.max(1.8, distance - 3.2);
  const position = new THREE.Vector3().copy(core).add(dir.multiplyScalar(dist));
  return { position, lookAt: target };
}

function CameraRig({ started, onArrived, view, focusTarget, disabled = false }: CameraRigProps) {
  const { camera } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const controlsRef = useRef<ReturnType<typeof OrbitControls> | null>(null);

  const introDone = useRef(false);
  const isFlying = useRef(false);
  const flightProgress = useRef(0);
  const flightStart = useRef(new THREE.Vector3());
  const flightTargetPos = useRef(new THREE.Vector3());
  const flightLookAt = useRef(new THREE.Vector3());
  const flightStartFov = useRef(cam.fov);
  const flightTargetFov = useRef(cam.fov);
  const currentPlan = useRef('');

  const startFlight = (targetPos: THREE.Vector3, lookAt: THREE.Vector3, fov: number) => {
    flightStart.current.copy(cam.position);
    flightStartFov.current = cam.fov;
    flightTargetPos.current.copy(targetPos);
    flightLookAt.current.copy(lookAt);
    flightTargetFov.current = fov;
    flightProgress.current = 0;
    isFlying.current = true;
  };

  useEffect(() => {
    if (!started || disabled) return;
    const key = planKey(view, focusTarget);
    if (key === currentPlan.current) return;
    currentPlan.current = key;

    if (view === 'world') {
      startFlight(WORLD_VIEW.position, WORLD_VIEW.lookAt, WORLD_VIEW.fov);
    } else if (focusTarget) {
      const plan = computeFocusPlan(focusTarget);
      startFlight(plan.position, plan.lookAt, FOCUS_FOV);
    } else {
      startFlight(GALAXY_HOME.position, GALAXY_HOME.lookAt, GALAXY_HOME.fov);
    }
  }, [started, view, focusTarget, disabled]);

  useFrame((_, delta) => {
    if (disabled) return;

    if (isFlying.current) {
      flightProgress.current = Math.min(1, flightProgress.current + delta * 0.32);
      const t = 1 - Math.pow(1 - flightProgress.current, 3);

      cam.position.lerpVectors(flightStart.current, flightTargetPos.current, t);
      cam.fov = THREE.MathUtils.lerp(flightStartFov.current, flightTargetFov.current, t);
      cam.updateProjectionMatrix();
      cam.lookAt(flightLookAt.current);

      if (controlsRef.current) {
        // @ts-expect-error - drei OrbitControls ref is untyped
        controlsRef.current.target.copy(flightLookAt.current);
        // @ts-expect-error
        controlsRef.current.update();
      }

      if (flightProgress.current >= 1) {
        isFlying.current = false;
        if (!introDone.current) {
          introDone.current = true;
          onArrived?.();
        }
      }
    } else if (controlsRef.current) {
      // @ts-expect-error
      controlsRef.current.target.copy(flightLookAt.current);
      // @ts-expect-error
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef as any}
      enablePan={!isFlying.current}
      enableZoom={!isFlying.current}
      enableRotate={!isFlying.current}
      autoRotate={false}
      enableDamping
      dampingFactor={0.05}
      minDistance={0.8}
      maxDistance={50}
    />
  );
}

const CATEGORY_COLORS: Record<WorldCategory, string> = {
  'star-system': '#f59e0b',
  'planet': '#22d3ee',
  'sector': '#a855f7',
  'world': '#10b981',
  'dimension': '#ec4899',
};

interface OasisSceneProps {
  started?: boolean;
  onArrived?: () => void;
  activeCategories: WorldCategory[];
  selectedWorld: World | null;
  onWorldSelect: (world: World) => void;
  view: 'galaxy' | 'world';
  flightMode: boolean;
  onExitFlight: () => void;
}

export default function OasisScene({
  started = true,
  onArrived,
  activeCategories,
  selectedWorld,
  onWorldSelect,
  view,
  flightMode,
  onExitFlight,
}: OasisSceneProps) {
  return (
    <Canvas camera={{ position: [0, 3.5, 34], fov: 55 }} dpr={[1, 2]}>
      <color attach="background" args={['#02030a']} />
      <fog attach="fog" args={['#02030a', 22, 55]} />
      <ambientLight intensity={0.15} />
      <pointLight position={[10, 8, 10]} intensity={0.8} color="#ffffff" />
      <pointLight position={[-12, -6, -12]} intensity={0.6} color="#a855f7" />
      <pointLight position={[0, 10, 0]} intensity={0.5} color="#22d3ee" />

      {view === 'galaxy' && (
        <>
          {/* Distant star backdrop */}
          <Stars radius={180} depth={120} count={8000} factor={4} saturation={0} fade speed={0.4} />

          {/* Galaxy disk + core + nebula */}
          <Galaxy />
          <GalaxyCore />
          <Nebula />

          {/* Oasis center */}
          <TreeOfLife />

          {/* Selection beacon for the focused world */}
          {selectedWorld?.galaxyPosition && (
            <SelectionBeacon
              position={selectedWorld.galaxyPosition}
              color={CATEGORY_COLORS[selectedWorld.category]}
            />
          )}

          {/* 55 OASIS worlds as a holographic galaxy map */}
          <GalaxyMap
            activeCategories={activeCategories}
            selectedWorldId={selectedWorld?.id}
            onWorldSelect={onWorldSelect}
          />
        </>
      )}

      {view === 'world' && selectedWorld && <WorldEnvironment world={selectedWorld} />}

      {/* Arrival flight and controls */}
      <CameraRig
        started={started}
        onArrived={onArrived}
        view={view}
        focusTarget={selectedWorld?.galaxyPosition ?? null}
        disabled={flightMode}
      />

      {/* First-person flight controls */}
      {flightMode && <FlightControls enabled={flightMode} onExit={onExitFlight} />}

      {/* Bloom for glow */}
      <EffectComposer>
        <Bloom
          intensity={0.75}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.5}
          mipmapBlur
          radius={0.6}
        />
      </EffectComposer>
    </Canvas>
  );
}
