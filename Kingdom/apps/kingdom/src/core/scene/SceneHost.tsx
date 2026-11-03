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
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { SceneMarker } from '@zion/world';
import type { SceneHover } from '@zion/scenes';

const OrbitScene = dynamic(() => import('@zion/scenes').then((mod) => mod.OrbitScene), {
  ssr: false,
  loading: () => <div className="k-scene-wait" />,
});

export function SceneHost({
  markers,
  label,
  gateLabel,
}: {
  markers: SceneMarker[];
  label: string;
  gateLabel: string;
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<SceneHover | null>(null);
  const [tip, setTip] = useState({ x: 0, y: 0 });

  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({
      x: Math.min(Math.max(event.clientX - rect.left, 64), rect.width - 64),
      y: event.clientY - rect.top,
    });
  };

  return (
    <div
      ref={box}
      className="k-scene k-scene-live"
      onPointerMove={onMove}
      onPointerLeave={() => setHovered(null)}
    >
      <OrbitScene
        markers={markers}
        onSelect={(id) => router.push(`/portal/${id}`)}
        onGate={() => router.push('/')}
        onHover={setHovered}
        gateLabel={gateLabel}
      />
      <div className="k-scene-label">{label}</div>
      {hovered ? (
        <div className="k-scene-tip" style={{ left: tip.x, top: tip.y }}>
          {hovered.title}
        </div>
      ) : null}
    </div>
  );
}
