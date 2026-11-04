'use client';

/**
 * VR v tancích na Saturnu.
 *
 * Hra je tahová: mířidlo se ovládá po malých krocích. Ovladač proto **drží
 * šipku** (úhel vlevo/vpravo, síla nahoru/dolů) a spoušť pálí — stejné
 * syntetické klávesy, jaké posílá dotykový pad, takže se pravidla nemění.
 *
 * Kamera: hráč stojí nad bojištěm a headset si rozhlížení řeší sám. Cinematic
 * `CameraRig` (let za střelou) se ve VR vypíná — jinak by „letěla hlava".
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { XROrigin } from '@react-three/xr';
import type { Group } from 'three';
import { VrInputs } from '@/core/xr/inputs';
import { VR_DEADZONE, useVrKeys } from '@/core/xr';
import { WORLD_W, type TanksState } from './tanks';

export function TanksXr({ state, active }: { state: React.MutableRefObject<TanksState>; active: boolean }) {
  const origin = useRef<Group>(null);
  const keys = useVrKeys();

  useFrame(() => {
    // vantage sleduje stranu, na které stojí tvůj tank — hřiště je široké
    if (!origin.current) return;
    const tank = state.current.player;
    origin.current.position.set(tank.x, 92, 250);
  });

  return (
    <>
      <XROrigin ref={origin} />
      <VrInputs
        onInput={(input) => {
          const stick = input.left.stick;
          keys.set('ArrowLeft', active && stick.x < -VR_DEADZONE);
          keys.set('ArrowRight', active && stick.x > VR_DEADZONE);
          keys.set('ArrowUp', active && stick.y > VR_DEADZONE);
          keys.set('ArrowDown', active && stick.y < -VR_DEADZONE);
          keys.set('Space', active && input.right.trigger);
        }}
      />
    </>
  );
}

/** Startovní pohled ve VR — nad prostředkem hřiště. */
export const TANKS_XR_ORIGIN: [number, number, number] = [WORLD_W / 2, 92, 250];
