'use client';

import { useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Environment } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, HueSaturation, BrightnessContrast, ChromaticAberration, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import type { World, WorldCategory, WorldLayer } from '../domain/types/world';
import TreeOfLife from './TreeOfLife';
import Galaxy from './Galaxy';
import DistantGalaxies from './DistantGalaxies';
import GalaxyCore from './GalaxyCore';
import MatrixCore from './MatrixCore';
import GalaxyMap from './GalaxyMap';
import WorldEnvironment from './WorldEnvironment';
import SelectionBeacon from './SelectionBeacon';
import FlightControls from './FlightControls';
import PilgrimShip from './PilgrimShip';
import Nebula from './Nebula';
import TwinkleStars from './TwinkleStars';
import ShootingStars from './ShootingStars';
import CameraCompassTracker from './CameraCompassTracker';
import R3FErrorBoundary from './R3FErrorBoundary';
import MobileTouchControls from './MobileTouchControls';
import NovaZeme from './NovaZeme';
import type { CompassData } from './Compass';

interface CameraRigProps {
  started: boolean;
  onArrived?: () => void;
  view: 'galaxy' | 'world';
  focusTarget?: { x: number; y: number; z: number } | null;
  disabled?: boolean;
}

const GALAXY_HOME = { position: new THREE.Vector3(0, 2.4, 15), lookAt: new THREE.Vector3(0, 0.5, 0), fov: 50 };
const WORLD_VIEW = { position: new THREE.Vector3(0, 0.35, 4.5), lookAt: new THREE.Vector3(0, 0, 0), fov: 38 };
const FOCUS_FOV = 42;

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

  // Run after drei's OrbitControls so our camera/target update takes precedence.
  useFrame((_, delta) => {
    if (disabled) return;

    if (isFlying.current) {
      flightProgress.current = Math.min(1, flightProgress.current + delta * 0.55);
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
  }, 1);

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
      maxDistance={120}
    />
  );
}

function UniverseRotator({
  groupRef,
  flightMode,
  view,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  flightMode: boolean;
  view: 'galaxy' | 'world';
}) {
  useFrame((_, delta) => {
    if (groupRef.current && view === 'galaxy' && !flightMode) {
      groupRef.current.rotation.y += delta * 0.002;
    }
  });
  return null;
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
  activeLayers?: WorldLayer[];
  selectedWorld: World | null;
  onWorldSelect: (world: World) => void;
  view: 'galaxy' | 'world';
  flightMode: boolean;
  onExitFlight: () => void;
  flightControlsRef: React.RefObject<import('./FlightControls').FlightControlsHandle | null>;
  onFlightSpeedChange: (speed: number) => void;
  onCanLand: (world: World | null) => void;
  onApproach: (world: World) => void;
  onBoost: () => void;
  flightSpeed?: number;
  baseSpeed?: number;
  mobileInputRef?: React.RefObject<import('./MobileControls').MobileInput | null>;
  isMobile?: boolean;
  compassRef?: React.RefObject<CompassData | null>;
}

export default function OasisScene({
  started = true,
  onArrived,
  activeCategories,
  activeLayers,
  selectedWorld,
  onWorldSelect,
  view,
  flightMode,
  onExitFlight,
  flightControlsRef,
  onFlightSpeedChange,
  onCanLand,
  onApproach,
  onBoost,
  flightSpeed = 0,
  baseSpeed = 3.5,
  mobileInputRef,
  isMobile = false,
  compassRef,
}: OasisSceneProps) {
  const universeRef = useRef<THREE.Group>(null);

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
      <Canvas
        camera={{ position: isMobile ? [0, 4, 22] : [0, 3.5, 34], fov: isMobile ? 60 : 55 }}
        dpr={[1, isMobile ? 1 : 1.75]}
        style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', inset: 0 }}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
          failIfMajorPerformanceCaveat: false,
        }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(isMobile ? '#001a33' : '#02030a');
          if (isMobile) {
            camera.lookAt(0, 0.5, 0);
          }
        }}
      >
        <color attach="background" args={[isMobile ? '#001a33' : '#02030a']} />
        {!isMobile && <fog attach="fog" args={['#02030a', 80, 200]} />}

        {/* Lighting */}
        <ambientLight intensity={isMobile ? 0.8 : 0.15} />
        <pointLight position={[10, 8, 10]} intensity={1.0} color="#ffffff" />
        <pointLight position={[-12, -6, -12]} intensity={0.65} color="#a855f7" />
        <pointLight position={[0, 10, 0]} intensity={0.5} color="#22d3ee" />

        {/* HDRI environment — desktop only */}
        {!isMobile && (
          <Suspense fallback={null}>
            <Environment preset="night" background={false} environmentIntensity={0.6} />
          </Suspense>
        )}

        {/* On mobile, skip CameraRig/OrbitControls — they break mobile rendering.
            Use custom MobileTouchControls instead (pinch + drag). */}
        {!isMobile && (
          <UniverseRotator groupRef={universeRef} flightMode={flightMode} view={view} />
        )}

        {view === 'galaxy' && (
          <group ref={universeRef}>
            <R3FErrorBoundary label="Stars">
              <Stars radius={250} depth={160} count={isMobile ? 1500 : 5200} factor={4.5} saturation={0} fade speed={0.4} />
            </R3FErrorBoundary>

            <R3FErrorBoundary label="TwinkleStars">
              <TwinkleStars count={isMobile ? 600 : 2200} radius={150} />
            </R3FErrorBoundary>

            <R3FErrorBoundary label="ShootingStars">
              <ShootingStars count={isMobile ? 2 : 4} isMobile={isMobile} />
            </R3FErrorBoundary>

            <R3FErrorBoundary label="DistantGalaxies">
              <DistantGalaxies />
            </R3FErrorBoundary>

            <R3FErrorBoundary label="Galaxy">
              <Galaxy isMobile={isMobile} />
            </R3FErrorBoundary>

            <R3FErrorBoundary label="GalaxyCore">
              <GalaxyCore />
            </R3FErrorBoundary>

            {!isMobile && (
              <R3FErrorBoundary label="MatrixCore">
                <MatrixCore />
              </R3FErrorBoundary>
            )}

            <R3FErrorBoundary label="Nebula">
              <Nebula isMobile={isMobile} />
            </R3FErrorBoundary>

            <R3FErrorBoundary label="TreeOfLife">
              <group scale={1.1}>
                <TreeOfLife isMobile={isMobile} />
              </group>
            </R3FErrorBoundary>

            {selectedWorld?.galaxyPosition && (
              <R3FErrorBoundary label="SelectionBeacon">
                <SelectionBeacon
                  position={selectedWorld.galaxyPosition}
                  color={CATEGORY_COLORS[selectedWorld.category]}
                />
              </R3FErrorBoundary>
            )}

            <R3FErrorBoundary label="GalaxyMap">
              <GalaxyMap
                activeCategories={activeCategories}
                activeLayers={activeLayers}
                selectedWorldId={selectedWorld?.id}
                onWorldSelect={onWorldSelect}
                isMobile={isMobile}
              />
            </R3FErrorBoundary>

            {/* Nova Zeme — centrální planeta s Issobelou na oběžné dráze */}
            <R3FErrorBoundary label="NovaZeme">
              <NovaZeme position={[0, -1, 8]} isMobile={isMobile} />
            </R3FErrorBoundary>
          </group>
        )}

        {view === 'world' && selectedWorld && (
          <R3FErrorBoundary label="WorldEnvironment">
            <WorldEnvironment world={selectedWorld} isMobile={isMobile} />
          </R3FErrorBoundary>
        )}

        {/* CameraRig only on desktop — on mobile camera is fixed */}
        {!isMobile && (
          <CameraRig
            started={started}
            onArrived={onArrived}
            view={view}
            focusTarget={selectedWorld?.galaxyPosition ?? null}
            disabled={flightMode}
          />
        )}

        {/* On mobile, call onArrived immediately after mount */}
        {isMobile && started && (
          <MobileArrivalTrigger onArrived={onArrived} />
        )}

        {/* Mobile touch camera controls — replaces drei OrbitControls */}
        {isMobile && !flightMode && (
          <MobileTouchControls
            target={new THREE.Vector3(0, 0.5, 0)}
            minDistance={6}
            maxDistance={60}
          />
        )}

        {flightMode && (
          <FlightControls
            ref={flightControlsRef}
            enabled={flightMode}
            onExit={onExitFlight}
            onSpeedChange={onFlightSpeedChange}
            onCanLand={onCanLand}
            onApproach={onApproach}
            onBoost={onBoost}
            baseSpeed={baseSpeed}
            mobileInputRef={mobileInputRef}
          />
        )}

        {flightMode && <PilgrimShip speed={flightSpeed} />}

        {!isMobile && (
          <EffectComposer multisampling={4}>
            <Bloom intensity={0.68} luminanceThreshold={0.34} luminanceSmoothing={0.6} mipmapBlur radius={0.6} />
            <HueSaturation saturation={0.16} />
            <BrightnessContrast brightness={-0.03} contrast={0.08} />
            <ChromaticAberration offset={[0.0005, 0.0005]} radialModulation modulationOffset={0.4} />
            <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.03} />
            <Vignette eskil={false} offset={0.18} darkness={0.7} />
          </EffectComposer>
        )}

        {compassRef && <CameraCompassTracker compassRef={compassRef} />}
      </Canvas>
    </div>
  );
}

/** Calls onArrived once on mount — replaces CameraRig flight on mobile */
function MobileArrivalTrigger({ onArrived }: { onArrived?: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => onArrived?.(), 100);
    return () => clearTimeout(t);
  }, [onArrived]);
  return null;
}
