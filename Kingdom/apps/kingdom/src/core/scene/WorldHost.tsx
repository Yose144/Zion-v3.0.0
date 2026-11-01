'use client';

/**
 * Host světa — lazy, mimo SSR.
 *
 * Cesta `/world/<id>` je místo, ne portál: scéna je plátno Místnosti, ne okno.
 * three.js i 13 světů se stahují až tady, takže Brána i Místnost zůstávají lehké.
 */
import dynamic from 'next/dynamic';
import type { Lang } from '@zion/scenes';

const WorldStage = dynamic(() => import('@zion/scenes').then((mod) => mod.WorldStage), {
  ssr: false,
  loading: () => <div className="k-world-wait" />,
});

export function WorldHost({ worldId, locale }: { worldId: string; locale: Lang }) {
  return <WorldStage worldId={worldId} locale={locale} />;
}
