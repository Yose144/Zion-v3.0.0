'use client';

/**
 * VR v souboji na Merkuru.
 *
 * Ovladače nedostávají vlastní herní cestu — posílají **syntetické klávesy**,
 * které `useFightKeys` už čte. Kdyby měl VR vlastní vstup, znamenalo by to
 * druhou pravidlovou větev a jiné chování proti serveru.
 *
 * Mapování:
 *   levý stick vlevo/vpravo .... pohyb
 *   pravý spoušť ............... pěst
 *   pravý grip ................. kop
 *   levý grip .................. blok
 *   A (pravý) .................. skok
 */

import { useEffect } from 'react';
import { XROrigin } from '@react-three/xr';
import { VrInputs } from '@/core/xr/inputs';
import { axisKeys, useVrKeys } from '@/core/xr';

export function DuelXr({ active }: { active: boolean }) {
  const keys = useVrKeys();

  useEffect(() => {
    if (!active) keys.clear();
  }, [active, keys]);

  return (
    <>
      {/* hráč stojí kousek od klece, jako divák v první řadě */}
      <XROrigin position={[0, 0, 6.4]} />
      <VrInputs
        onInput={(input) => {
          axisKeys(keys, input.left.stick.x, 'KeyA', 'KeyD');
          keys.set('KeyJ', input.right.trigger);
          keys.set('KeyK', input.right.squeeze);
          keys.set('KeyS', input.left.squeeze);
          keys.set('KeyW', input.right.primary);
        }}
      />
    </>
  );
}
