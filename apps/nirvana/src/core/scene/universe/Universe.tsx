'use client';

import { useMemo } from 'react';
import { OrbitControls } from '@react-three/drei';
import type { Portal } from '@/core/portals/manifest';
import type { WorldPoint } from '@/lib/worlds';
import type { Lang } from '@/core/i18n';
import { worldSlot } from './positions';
import { NewEarth } from './NewEarth';
import { IssobellaRing } from './IssobellaRing';
import { StarGate } from './StarGate';
import { OrbitalWorlds } from './OrbitalWorlds';
import { HoloConsole } from './HoloConsole';
import { SpaceBackdrop } from './SpaceBackdrop';

/**
 * Vesmír Království srdce — orbitální pohled z lodi.
 * Nová Země (L5 povrch + L1 jádro/maják) · prstenec Issobelly (L6)
 * · OASIS světy na vnitřní dráze (L4) · Brána ve volném prostoru (apex)
 * · HoloConsole — holografická tabulka se všemi ovládacími prvky.
 */
export function Universe({
  worlds,
  portals,
  onOpen,
  onSelectWorld,
  lang,
  onToggleLang,
  vrSupported,
  onEnterVr,
}: {
  worlds: WorldPoint[];
  portals: Portal[];
  onOpen: (id: string) => void;
  onSelectWorld: (id: string) => void;
  lang: Lang;
  onToggleLang: () => void;
  vrSupported: boolean;
  onEnterVr: () => void;
}) {
  const split = useMemo(() => {
    const surface: WorldPoint[] = [];
    const ring: WorldPoint[] = [];
    const orbit: WorldPoint[] = [];
    for (const w of worlds) {
      const slot = worldSlot(w);
      if (slot === 'surface') surface.push(w);
      else if (slot === 'ring') ring.push(w);
      else orbit.push(w);
    }
    return { surface, ring, orbit };
  }, [worlds]);

  const surfacePortals = portals.filter((p) => p.scene.slot === 'surface' || p.scene.slot === 'core');
  const ringPortal = portals.find((p) => p.scene.slot === 'ring');
  const gatePortal = portals.find((p) => p.scene.slot === 'gate');

  return (
    <>
      <color attach="background" args={['#02030a']} />
      <ambientLight intensity={0.32} />
      <directionalLight position={[34, 14, -26]} intensity={1.05} />
      <SpaceBackdrop />

      <NewEarth
        worlds={split.surface}
        surfacePortals={surfacePortals}
        onOpen={onOpen}
        onSelectWorld={onSelectWorld}
      />
      <IssobellaRing
        worlds={split.ring}
        portal={ringPortal}
        onOpen={onOpen}
        onSelectWorld={onSelectWorld}
      />
      <OrbitalWorlds worlds={split.orbit} onSelectWorld={onSelectWorld} />
      {gatePortal && <StarGate portal={gatePortal} onOpen={onOpen} />}

      <HoloConsole
        portals={portals}
        onOpen={onOpen}
        lang={lang}
        onToggleLang={onToggleLang}
        vrSupported={vrSupported}
        onEnterVr={onEnterVr}
      />

      <OrbitControls
        makeDefault
        autoRotate
        autoRotateSpeed={0.25}
        enableDamping
        dampingFactor={0.06}
        enablePan={false}
        minDistance={7}
        maxDistance={42}
        minPolarAngle={0.5}
        maxPolarAngle={2.5}
      />
    </>
  );
}
