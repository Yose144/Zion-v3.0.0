'use client';

import { Suspense } from 'react';
import { ProceduralAvatar } from './ProceduralAvatar';
import { RiggedAvatar } from './RiggedAvatar';
import { avatarModelUrl } from './models';
import type { AvatarLook } from './kit';

/**
 * AVATAR — vybere, co se má kreslit.
 *
 * 1. Má avatar schválený GLB (`models.ts`)? → `RiggedAvatar` (kostra + idle).
 * 2. Jinak, nebo dokud se model načítá / když selže → `ProceduralAvatar`.
 *
 * Procedurální cesta je **výchozí**: chybějící soubor nikdy nesmí rozbít výběr
 * avatara ani multiplayer. Obě větve stojí nohama na `y = 0` a škálují se
 * stejným `look.height`, takže se za běhu nedá poznat, která se kreslí
 * (kromě detailů).
 */
export function AvatarModel({
  look,
  animate = false,
  opacity = 1,
}: {
  look: AvatarLook;
  animate?: boolean;
  opacity?: number;
}) {
  const url = avatarModelUrl(look.id);

  if (!url) {
    return <ProceduralAvatar look={look} animate={animate} opacity={opacity} />;
  }

  return (
    <Suspense fallback={<ProceduralAvatar look={look} animate={animate} opacity={opacity} />}>
      <RiggedAvatar look={look} url={url} animate={animate} opacity={opacity} />
    </Suspense>
  );
}
