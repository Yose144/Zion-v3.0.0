'use client';

/**
 * FreeWorldMap — planetary map of the six L5 founding communities.
 *
 * Leaflet is lazy-loaded client-side (`await import('leaflet')`), styled
 * with the dark CARTO basemap and glowing div-icon markers coloured by
 * community status (gold = active development, cyan = preparation,
 * purple = planned). Clicking a marker opens a popup with a link to the
 * community page.
 */

import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { useLang } from '@/contexts/LanguageContext';
import { FREE_WORLD_SITES, SITE_STATUS_COLOR, type FreeWorldSite } from '@/lib/freeworld-sites';

const copy = {
  loading: { cs: 'Načítám planetární mapu…', en: 'Loading planetary map…' },
  offline: { cs: 'Mapu se nepodařilo načíst.', en: 'The map could not be loaded.' },
  status: {
    development: { cs: 'Aktivní rozvoj', en: 'Active development' },
    preparation: { cs: 'V přípravě', en: 'In preparation' },
    vision: { cs: 'Plánováno', en: 'Planned' },
  },
  legendTitle: { cs: 'Stav komunit', en: 'Community status' },
  detail: { cs: 'Otevřít stránku komunity →', en: 'Open community page →' },
  sixCommunities: { cs: '6 zakládajících komunit', en: '6 founding communities' },
};

const LOCATION_LABEL: Record<string, { cs: string; en: string }> = {
  'genesis-garden': { cs: 'Algarve, Portugalsko', en: 'Algarve, Portugal' },
  'dharma-temple': { cs: 'La Palma — Terra Nova Sanctuary', en: 'La Palma — Terra Nova Sanctuary' },
  'te-piko-ora': { cs: 'Raiatea, Francouzská Polynésie', en: 'Raiatea, French Polynesia' },
  'golden-republic-bohemia': { cs: 'Čechy, Česká republika', en: 'Bohemia, Czech Republic' },
  'bodhi-lanka': { cs: 'Srí Lanka', en: 'Sri Lanka' },
  lumi: { cs: 'Kostarika · Nová Amerika', en: 'Costa Rica · Nová Amerika' },
};

export default function FreeWorldMap() {
  const { lang } = useLang();
  const cs = lang === 'cs';
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
          worldCopyJump: true,
          minZoom: 2,
          maxZoom: 8,
        });
        map.setView([22, -20], 2);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 12,
          subdomains: 'abcd',
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        }).addTo(map);

        for (const site of FREE_WORLD_SITES) {
          const color = SITE_STATUS_COLOR[site.status];
          const icon = L.divIcon({
            className: 'fw-map-marker',
            html: `<span class="fw-dot" style="--dot:${color}"></span>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            popupAnchor: [0, -12],
          });
          const loc = LOCATION_LABEL[site.key]?.[cs ? 'cs' : 'en'] ?? '';
          const statusLabel = copy.status[site.status][cs ? 'cs' : 'en'];
          L.marker([site.lat, site.lon], { icon, title: site.name })
            .addTo(map)
            .bindPopup(
              `<div class="fw-popup">` +
                `<strong>${site.name}</strong>` +
                `<span class="fw-popup-loc">${loc}</span>` +
                `<span class="fw-popup-status" style="color:${color}">● ${statusLabel}</span>` +
                `<a href="${site.href}">${copy.detail[cs ? 'cs' : 'en']}</a>` +
                `</div>`,
              { closeButton: false },
            );
        }

        const bounds = L.latLngBounds(FREE_WORLD_SITES.map((s) => [s.lat, s.lon] as [number, number]));
        map.fitBounds(bounds.pad(0.35));

        mapRef.current = map;
        setState('ready');
      } catch (err) {
        console.warn('FreeWorldMap unavailable:', err);
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
  }, [cs]);

  return (
    <div className="relative">
      {state === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/40 text-sm text-gray-400">
          {copy.loading[cs ? 'cs' : 'en']}
        </div>
      )}
      {state === 'error' && (
        <div className="flex h-96 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-sm text-gray-400">
          {copy.offline[cs ? 'cs' : 'en']}
        </div>
      )}
      <div
        ref={containerRef}
        className="fw-map h-96 w-full rounded-2xl border border-white/10 md:h-[28rem]"
        role="application"
        aria-label={cs ? 'Mapa šesti zakládajících komunit L5' : 'Map of the six founding L5 communities'}
      />
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-400">
        <span className="uppercase tracking-widest text-gray-500">{copy.legendTitle[cs ? 'cs' : 'en']}</span>
        {(Object.keys(copy.status) as FreeWorldSite['status'][]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SITE_STATUS_COLOR[s] }} />
            {copy.status[s][cs ? 'cs' : 'en']}
          </span>
        ))}
        <span className="ml-auto text-gray-500">{copy.sixCommunities[cs ? 'cs' : 'en']}</span>
      </div>
    </div>
  );
}
