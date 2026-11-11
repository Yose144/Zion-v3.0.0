'use client';

/**
 * Minimapa Srdce — jediné místo, kde je vidět **celý** tvar planě i to,
 * které lampy ještě nesvítí. Kamera visí 42 m nad hráčem, takže z ní srdce
 * nepřečteš; bez minimapy by hra byla jen o kompasu k nejbližší lampě.
 *
 * Kreslí se z jednoho snapshotu (`stats`) — žádný vlastní stav. Srdce je
 * stejná parametrická křivka jako textura pláně (`PlutoScene`), jen
 * v souřadnicích SVG.
 */

import { useMemo } from 'react';
import { LAMPS, SHUTTLE, WORLD } from './world';

const SIZE = 132;
/** Svět (−WORLD..WORLD) → plátno (0..SIZE). */
const scale = SIZE / (WORLD * 2 + 12);
const toX = (x: number) => SIZE / 2 + x * scale;
const toY = (z: number) => SIZE / 2 + z * scale;

/** Srdce v metrech — stejný tvar jako textura, jen zmenšený na pláň. */
const HEART = Array.from({ length: 96 }, (_, index) => {
  const t = (index / 96) * Math.PI * 2;
  const x = 16 * Math.sin(t) ** 3;
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  // textura má měřítko 7,6 px na jednotku a plátno 512 px ≈ 220 m
  const metres = (7.6 * 220) / 512;
  return { x: x * metres, z: -y * metres };
});

const HEART_PATH = HEART.map((point, index) => `${index === 0 ? 'M' : 'L'}${toX(point.x).toFixed(1)},${toY(point.z).toFixed(1)}`).join(' ') + ' Z';

export interface PlutoMinimapProps {
  x: number;
  z: number;
  vx: number;
  vz: number;
  lamps: number;
  litMask: boolean[];
  nextId: number | null;
}

export function PlutoMinimap({ x, z, vx, vz, lamps, litMask, nextId }: PlutoMinimapProps) {
  const heading = useMemo(() => (Math.hypot(vx, vz) > 0.4 ? (Math.atan2(vx, vz) * 180) / Math.PI : 0), [vx, vz]);

  return (
    <div className="pluto-map" aria-hidden>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="presentation">
        <path d={HEART_PATH} className="pluto-map-heart" />
        <rect
          x={toX(SHUTTLE.x) - 3}
          y={toY(SHUTTLE.z) - 3}
          width={6}
          height={6}
          className="pluto-map-shuttle"
        />
        {LAMPS.map((lamp, index) => {
          const isNext = lamp.id === nextId;
          return (
            <circle
              key={lamp.id}
              cx={toX(lamp.x)}
              cy={toY(lamp.z)}
              r={isNext ? 3.4 : 2.6}
              className={`pluto-map-lamp${litMask[index] ? ' is-lit' : ''}${isNext ? ' is-next' : ''}`}
            />
          );
        })}
        <g transform={`translate(${toX(x).toFixed(1)} ${toY(z).toFixed(1)}) rotate(${heading.toFixed(0)})`}>
          <path d="M0,-5 L3.4,3.6 L0,2 L-3.4,3.6 Z" className="pluto-map-you" />
        </g>
        <text x={8} y={SIZE - 8} className="pluto-map-count">
          {lamps}/{LAMPS.length}
        </text>
      </svg>
    </div>
  );
}
