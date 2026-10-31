'use client';

/**
 * Host světa.
 *
 * Graf se načítá **lazy a mimo SSR** (`ssr: false`) — Místnost a okna jsou
 * interaktivní dřív, než se stáhne three.js. Když prohlížeč scénu nenačte,
 * zůstane místo ní klidná plocha a portály níž fungují dál.
 */
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type { SceneMarker } from '@zion/world';

const OrbitScene = dynamic(() => import('@zion/scenes').then((mod) => mod.OrbitScene), {
  ssr: false,
  loading: () => <div className="k-scene-wait" />,
});

export function SceneHost({
  markers,
  label,
}: {
  markers: SceneMarker[];
  label: string;
}) {
  const router = useRouter();

  return (
    <div className="k-scene k-scene-live">
      <OrbitScene
        markers={markers}
        onSelect={(id) => router.push(`/portal/${id}`)}
        onGate={() => router.push('/')}
      />
      <div className="k-scene-label">{label}</div>
    </div>
  );
}
