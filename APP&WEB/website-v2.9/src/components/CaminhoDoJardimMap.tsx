'use client';

/**
 * CaminhoDoJardimMap — interactive Leaflet map of the proposed pilgrim route
 * Fátima → Seiça → Sabacheira (Genesis Garden) → Agroal → river Nabão → Tomar.
 *
 * Leaflet is lazy-loaded client-side (same pattern as FreeWorldMap).
 * Route geometry is schematic (concept alignment, not surveyed GPX).
 */
import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';

type Lang = 'cs' | 'en';

/* ── verified waypoints (Nominatim / user-provided parcel) ── */
const P = {
  fatima: [39.6324, -8.6766] as [number, number],
  seica: [39.6749, -8.5242] as [number, number],
  sabacheira: [39.6774, -8.4825] as [number, number],
  garden: [39.678848, -8.477842] as [number, number], // Genesis Garden parcel
  agroal: [39.6792837, -8.4357935] as [number, number],
  sobreirinho: [39.6538, -8.4102] as [number, number],
  station: [39.6543345, -8.4937059] as [number, number], // Chão de Maçãs–Fátima
  tomar: [39.6035941, -8.4199276] as [number, number], // Convento de Cristo
};

/* ── schematic legs ── */
const LEG_RED: [number, number][] = [
  P.fatima,
  [39.6415, -8.652],
  [39.651, -8.612],
  [39.6625, -8.566],
  [39.6705, -8.54],
  P.seica,
];

const LEG_WALK_1: [number, number][] = [P.seica, [39.6768, -8.502], P.sabacheira, P.garden];

const LEG_WALK_2: [number, number][] = [
  P.garden,
  [39.6801, -8.466],
  [39.6798, -8.451],
  P.agroal,
];

const LEG_RIVER: [number, number][] = [
  P.agroal,
  [39.673, -8.431],
  [39.6655, -8.422],
  [39.659, -8.414],
  P.sobreirinho,
  [39.646, -8.4125],
  [39.636, -8.4155],
  [39.625, -8.419],
  [39.614, -8.418],
  [39.6075, -8.416],
  P.tomar,
];

const C = {
  red: '#ef4444',
  gold: '#f0c75e',
  river: '#38bdf8',
  stone: '#c9b896',
};

export default function CaminhoDoJardimMap({
  lang = 'cs',
  className = '',
}: {
  lang?: Lang;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current || mapRef.current) return;
      try {
        const L = await import('leaflet');
        if (cancelled || !containerRef.current) return;

        const map = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: false,
          minZoom: 8,
          maxZoom: 16,
        });
        map.setView([39.648, -8.545], 11);

        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 16, attribution: 'Tiles &copy; Esri — Esri, DeLorme, NAVTEQ' },
        ).addTo(map);
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 16, attribution: '&copy; OpenStreetMap contributors' },
        ).addTo(map);

        /* routes */
        L.polyline(LEG_RED, { color: C.red, weight: 3.5, opacity: 0.85, dashArray: '1 7', lineCap: 'round' }).addTo(map);
        L.polyline(LEG_WALK_1, { color: C.gold, weight: 3.5, opacity: 0.9 }).addTo(map);
        L.polyline(LEG_WALK_2, { color: C.gold, weight: 3.5, opacity: 0.9 }).addTo(map);
        L.polyline(LEG_RIVER, { color: C.river, weight: 3.5, opacity: 0.9, dashArray: '8 6' }).addTo(map);

        /* markers */
        const dot = (color: string, big = false) =>
          L.divIcon({
            className: '',
            html: `<div style="width:${big ? 18 : 12}px;height:${big ? 18 : 12}px;border-radius:50%;background:${color};border:2px solid ${big ? '#fff7d6' : 'rgba(255,255,255,.75)'};box-shadow:0 0 14px ${color}"></div>`,
            iconSize: [big ? 18 : 12, big ? 18 : 12],
            iconAnchor: [big ? 9 : 6, big ? 9 : 6],
            popupAnchor: [0, -12],
          });

        const cs = lang === 'cs';
        const marks: { at: [number, number]; color: string; big?: boolean; name: string; sub: string }[] = [
          {
            at: P.fatima,
            color: '#a5c4e8',
            name: 'Fátima',
            sub: cs ? 'Santuário — start pouti' : 'Sanctuary — pilgrimage start',
          },
          {
            at: P.seica,
            color: C.red,
            name: 'Seiça',
            sub: cs ? 'červená značka z Fátimy' : 'red-marked trail from Fátima',
          },
          {
            at: P.garden,
            color: C.gold,
            big: true,
            name: 'Genesis Garden · Albergue do Jardim',
            sub: cs ? 'parcel 39.6788, −8.4778 · carimbo Zahrady' : 'parcel 39.6788, −8.4778 · Garden stamp',
          },
          {
            at: P.agroal,
            color: C.river,
            name: 'Agroal',
            sub: cs ? 'praia fluvial · pramen Nabão · nástup na vodní leg' : 'river beach · Nabão spring · boarding the water leg',
          },
          {
            at: P.sobreirinho,
            color: C.river,
            name: 'Sobreirinho',
            sub: cs ? 'půlcestí na řece · most PR1' : 'river midpoint · PR1 bridge',
          },
          {
            at: P.station,
            color: C.stone,
            name: cs ? 'Nádraží Chão de Maçãs–Fátima' : 'Chão de Maçãs–Fátima station',
            sub: cs ? 'Linha do Norte — vlak Lisabon/Porto' : 'Linha do Norte — Lisbon/Porto rail',
          },
          {
            at: P.tomar,
            color: C.stone,
            name: 'Tomar',
            sub: cs ? 'Convento de Cristo · návrat na Caminho Central' : 'Convento de Cristo · rejoins the Caminho Central',
          },
        ];

        for (const m of marks) {
          L.marker(m.at, { icon: dot(m.color, m.big), title: m.name })
            .addTo(map)
            .bindPopup(
              `<div class="fw-popup"><strong>${m.name}</strong><span class="fw-popup-loc">${m.sub}</span></div>`,
              { closeButton: false },
            );
        }

        const bounds = L.latLngBounds([P.fatima, P.agroal, P.tomar, [39.69, -8.40]]);
        map.fitBounds(bounds.pad(0.12));

        mapRef.current = map;
        requestAnimationFrame(() => map.invalidateSize());
        setTimeout(() => map.invalidateSize(), 400);
        setState('ready');
      } catch (err) {
        console.warn('CaminhoDoJardimMap unavailable:', err);
        setState('error');
      }
    }

    init();
    return () => {
      cancelled = true;
      try {
        mapRef.current?.remove();
      } finally {
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return (
    <div className={`relative ${className}`}>
      {state === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/40 text-sm text-gray-400">
          Loading map…
        </div>
      )}
      <div ref={containerRef} className="h-[380px] md:h-[460px] w-full rounded-2xl overflow-hidden border border-white/10" />

      {/* legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-white/10 bg-black/75 px-3 py-2 backdrop-blur">
        <div className="flex flex-col gap-1 text-[10px] text-white/80">
          <span className="flex items-center gap-2">
            <i className="inline-block h-[3px] w-5 rounded" style={{ background: C.red }} />
            {lang === 'cs' ? 'pěšky · červená značka (Fátima → Seiça)' : 'on foot · red waymark (Fátima → Seiça)'}
          </span>
          <span className="flex items-center gap-2">
            <i className="inline-block h-[3px] w-5 rounded" style={{ background: C.gold }} />
            {lang === 'cs' ? 'pěšky · Zahrada (Seiça → Agroal)' : 'on foot · the Garden (Seiça → Agroal)'}
          </span>
          <span className="flex items-center gap-2">
            <i className="inline-block h-[3px] w-5 rounded border-t border-dashed" style={{ background: `repeating-linear-gradient(90deg, ${C.river} 0 6px, transparent 6px 10px)` }} />
            {lang === 'cs' ? 'po vodě po proudu (Agroal → Tomar)' : 'by water downstream (Agroal → Tomar)'}
          </span>
        </div>
      </div>
    </div>
  );
}
