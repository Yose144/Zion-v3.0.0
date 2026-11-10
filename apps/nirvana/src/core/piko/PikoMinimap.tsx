'use client';

/**
 * MINIMAPA — malý přehled kurzu a vlny.
 *
 * Kreslí se jako **SVG**, ne canvas a ne three: je to UI, ne svět, a musí
 * zůstat čitelné i na 390px displeji. Data dodává scéna ve `stats`, takže
 * minimapa nikdy nepočítá vlastní fyziku (stejná past jako kompas v Lumi).
 *
 * Kánoe: celá laguna, bóje v pořadí, hráč, duch a vítr.
 * Surf: průběh vlny, laterální pruh s kapsou a flow.
 */

import { useI18n, tx } from '@/core/i18n';
import { LAGOON, PIKO_GATES, type PikoMode } from './world';
import { PIKO_COPY } from './copy';

export interface PikoMinimapStats {
  mode: PikoMode;
  x: number;
  z: number;
  heading: number;
  gates: number;
  nextGate: number;
  distance: number;
  waveProgress: number;
  wave: number;
  totalWaves: number;
  pocketX: number;
  combo: number;
  flow: number;
  windAngle: number;
}

export function PikoMinimap({
  stats,
  ghost,
}: {
  stats: PikoMinimapStats;
  ghost: { x: number; z: number } | null;
}) {
  const { lang } = useI18n();
  const label = (key: keyof typeof PIKO_COPY) => tx(PIKO_COPY[key], lang);
  const canoe = stats.mode === 'canoe';

  // mapování světa na SVG (shore nahoře, útes dole)
  const u = (x: number) => 5 + ((x - LAGOON.minX) / (LAGOON.maxX - LAGOON.minX)) * 158;
  const v = (z: number) => 6 + ((LAGOON.beachZ - z) / (LAGOON.beachZ - LAGOON.reefZ)) * 104;

  return (
    <div className="piko-minimap" aria-hidden>
      <svg viewBox="0 0 168 120" role="img">
        <rect x="2" y="2" width="164" height="116" rx="9" className="piko-map-water" />
        {canoe ? (
          <>
            <rect x="4" y="4" width="160" height="5" rx="2" className="piko-map-sand" />
            <text x="8" y="15" className="piko-map-label">
              {label('minimapShore')}
            </text>
            <line x1="6" y1="112" x2="162" y2="112" className="piko-map-reef" />
            <text x="8" y="110" className="piko-map-label">
              {label('minimapReef')}
            </text>
            <polyline
              points={PIKO_GATES.map((gate) => `${u(gate.x).toFixed(1)},${v(gate.z).toFixed(1)}`).join(' ')}
              className="piko-map-course"
            />
            {PIKO_GATES.map((gate, index) => (
              <g key={index}>
                {index === stats.nextGate && (
                  <circle cx={u(gate.x)} cy={v(gate.z)} r="7" className="piko-map-next-ring" />
                )}
                <circle
                  cx={u(gate.x)}
                  cy={v(gate.z)}
                  r="4.2"
                  className={
                    index < stats.gates
                      ? 'piko-map-gate is-passed'
                      : index === stats.nextGate
                        ? 'piko-map-gate is-next'
                        : 'piko-map-gate'
                  }
                />
              </g>
            ))}
            {ghost && <circle cx={u(ghost.x)} cy={v(ghost.z)} r="3.4" className="piko-map-ghost" />}
            <g transform={`translate(${u(stats.x).toFixed(1)} ${v(stats.z).toFixed(1)}) rotate(${((stats.heading * 180) / Math.PI).toFixed(1)})`}>
              <path d="M0,-6.2 L4.4,4.6 L0,2.2 L-4.4,4.6 Z" className="piko-map-player" />
            </g>
            <g transform={`translate(150 24) rotate(${(90 - (stats.windAngle * 180) / Math.PI).toFixed(1)})`}>
              <path d="M0,-7 L4,3 L0,1 L-4,3 Z" className="piko-map-wind" />
            </g>
            <text x="138" y="34" className="piko-map-label">
              {label('minimapWind')}
            </text>
          </>
        ) : (
          <>
            <text x="8" y="16" className="piko-map-label">
              {label('minimapWave')} {stats.wave}/{stats.totalWaves}
            </text>
            <rect x="8" y="21" width="152" height="6" rx="3" className="piko-map-track" />
            <rect
              x="8"
              y="21"
              width={Math.max(0, Math.min(1, stats.waveProgress)) * 152}
              height="6"
              rx="3"
              className="piko-map-progress"
            />
            <text x="8" y="44" className="piko-map-label">
              {label('minimapPocket')}
            </text>
            <rect x="8" y="48" width="152" height="18" rx="9" className="piko-map-lane" />
            <circle
              cx={8 + ((Math.max(LAGOON.minX, Math.min(LAGOON.maxX, stats.pocketX)) - LAGOON.minX) / (LAGOON.maxX - LAGOON.minX)) * 152}
              cy="57"
              r="5.4"
              className="piko-map-pocket"
            />
            {ghost && (
              <circle
                cx={8 + ((Math.max(LAGOON.minX, Math.min(LAGOON.maxX, ghost.x)) - LAGOON.minX) / (LAGOON.maxX - LAGOON.minX)) * 152}
                cy="57"
                r="3.2"
                className="piko-map-ghost"
              />
            )}
            <g
              transform={`translate(${(
                8 +
                ((Math.max(LAGOON.minX, Math.min(LAGOON.maxX, stats.x)) - LAGOON.minX) /
                  (LAGOON.maxX - LAGOON.minX)) *
                  152
              ).toFixed(1)} 57)`}
            >
              <path d="M0,-5.4 L4,4.2 L0,2 L-4,4.2 Z" className="piko-map-player" />
            </g>
            <text x="8" y="82" className="piko-map-label">
              {label('minimapFlow')} ×{(1 + stats.flow * 2).toFixed(1)}
            </text>
            <rect x="8" y="87" width="152" height="6" rx="3" className="piko-map-track" />
            <rect x="8" y="87" width={Math.max(0, Math.min(1, stats.flow)) * 152} height="6" rx="3" className="piko-map-flow" />
            <text x="8" y="108" className="piko-map-label">
              {Math.round(stats.distance)} m
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
