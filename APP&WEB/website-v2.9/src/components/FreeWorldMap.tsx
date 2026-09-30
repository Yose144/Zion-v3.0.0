'use client';

/**
 * FreeWorldMap — planetary map of the L5 Free World communities.
 *
 * Leaflet is lazy-loaded client-side (`await import('leaflet')`) and init
 * is gated behind an IntersectionObserver — initializing inside the
 * `content-visibility:auto` / `whileInView` page sections before they are
 * on-screen leaves Leaflet with a zero-sized viewport and blank tiles.
 * Styled with the Esri Dark Gray Canvas basemap and glowing div-icon
 * markers coloured by community status. The six founding communities are
 * in preparation until 2028 — construction starts no earlier than 2029;
 * vision-stage sites (Uluru) carry no allocation yet.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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
  legendPrep: {
    cs: 'Financované komunity — příprava do 2028 · stavba od 2029',
    en: 'Funded communities — preparation until 2028 · construction from 2029',
  },
  detail: { cs: 'Otevřít stránku komunity →', en: 'Open community page →' },
  communityCount: {
    cs: `${FREE_WORLD_SITES.length} komunit`,
    en: `${FREE_WORLD_SITES.length} communities`,
  },
};

const LOCATION_LABEL: Record<string, { cs: string; en: string }> = {
  'genesis-garden': { cs: 'Algarve, Portugalsko', en: 'Algarve, Portugal' },
  'dharma-temple': { cs: 'La Palma — Terra Nova Sanctuary', en: 'La Palma — Terra Nova Sanctuary' },
  'te-piko-ora': { cs: 'Raiatea, Francouzská Polynésie', en: 'Raiatea, French Polynesia' },
  'golden-republic-bohemia': { cs: 'Čechy, Česká republika', en: 'Bohemia, Czech Republic' },
  'bodhi-lanka': { cs: 'Srí Lanka', en: 'Sri Lanka' },
  lumi: { cs: 'Kostarika · Nová Amerika', en: 'Costa Rica · Nová Amerika' },
  uluru: { cs: 'Uluru, Northern Territory, Austrálie', en: 'Uluru, Northern Territory, Australia' },
  'maria-del-camino': { cs: 'Světové oceány · domovský přístav Pontevedra, Galicie', en: 'World oceans · home port Pontevedra, Galicia' },
  'boa-esperanca': { cs: 'Mys dobré naděje, Jihoafrická republika', en: 'Cape of Good Hope, South Africa' },
  ekam: { cs: 'Varadaiahpalem, Andhra Pradesh, Indie', en: 'Varadaiahpalem, Andhra Pradesh, India' },
};

export default function FreeWorldMap() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  // Observe the container — only init Leaflet once it is on-screen, so the
  // element has real layout dimensions (content-visibility / whileInView
  // animations otherwise hand Leaflet a 0×0 box).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const buildMarkers = useCallback(
    (map: Leaflet.Map, L: typeof Leaflet) => {
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
    },
    [cs],
  );

  useEffect(() => {
    if (!visible) return;
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

        // Esri World Dark Gray Canvas — dark basemap, no API key required
        // (CARTO basemaps moved behind an API key and watermark tiles).
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 12, attribution: 'Tiles &copy; Esri — Esri, DeLorme, NAVTEQ' },
        ).addTo(map);
        // Reference overlay: country/place labels on top of the dark canvas.
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 12, attribution: '&copy; OpenStreetMap contributors' },
        ).addTo(map);

        mapRef.current = map;
        buildMarkers(map, L);

        const bounds = L.latLngBounds(FREE_WORLD_SITES.map((s) => [s.lat, s.lon] as [number, number]));
        map.fitBounds(bounds.pad(0.35));

        // Size can still settle after the entrance animation — re-measure.
        requestAnimationFrame(() => map.invalidateSize());
        setTimeout(() => map.invalidateSize(), 400);

        setState('ready');
      } catch (err) {
        console.warn('FreeWorldMap unavailable:', err);
        setState('error');
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [visible, buildMarkers]);

  // Language toggle → rebuild markers/popups with the new labels.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || state !== 'ready') return;
    let cancelled = false;
    (async () => {
      const L = await import('leaflet');
      if (cancelled || !mapRef.current) return;
      mapRef.current.eachLayer((layer) => {
        if (layer instanceof L.Marker) mapRef.current!.removeLayer(layer);
      });
      buildMarkers(mapRef.current, L);
    })();
    return () => {
      cancelled = true;
    };
  }, [cs, state, buildMarkers]);

  // Full teardown on unmount.
  useEffect(
    () => () => {
      try {
        mapRef.current?.remove();
      } finally {
        mapRef.current = null;
      }
    },
    [],
  );

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
        aria-label={cs ? 'Mapa komunit L5' : 'Map of the L5 communities'}
      />
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-400">
        <span className="uppercase tracking-widest text-gray-500">{copy.legendTitle[cs ? 'cs' : 'en']}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SITE_STATUS_COLOR.preparation }} />
          {copy.legendPrep[cs ? 'cs' : 'en']}
        </span>
        <span className="ml-auto text-gray-500">{copy.communityCount[cs ? 'cs' : 'en']}</span>
      </div>
    </div>
  );
}
