'use client';

/**
 * VR v závodě na Venuši.
 *
 * Hráč **sedí ve vozítku**: `XROrigin` jede s ním, takže pohled z kokpitu
 * drží stejný směr jako trup. Kdyby origin zůstal na startu, člověk by se
 * díval, jak mu loď ujíždí.
 *
 * Ovládání jde přes syntetické klávesy (`KeyW`/`KeyS`/`KeyA`/`KeyD`), takže
 * fyzika i server vidí úplně stejný vstup jako z klávesnice.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { XROrigin } from '@react-three/xr';
import type { Group } from 'three';
import { VrInputs } from '@/core/xr/inputs';
import { VR_DEADZONE, useVrKeys } from '@/core/xr';
import type { Craft } from './physics';

export function RaceXr({ craft, active }: { craft: React.MutableRefObject<Craft>; active: boolean }) {
  const origin = useRef<Group>(null);
  const keys = useVrKeys();

  useFrame(() => {
    const car = craft.current;
    if (origin.current) {
      origin.current.position.set(car.x, 0.35, car.z);
      origin.current.rotation.y = car.heading;
    }
  });

  return (
    <>
      <XROrigin ref={origin} />
      <VrInputs
        onInput={(input) => {
          const stick = input.left.stick;
          keys.set('KeyW', active && stick.y > VR_DEADZONE);
          keys.set('KeyS', active && stick.y < -VR_DEADZONE);
          keys.set('KeyA', active && stick.x < -VR_DEADZONE);
          keys.set('KeyD', active && stick.x > VR_DEADZONE);
        }}
      />
    </>
  );
}
