'use client';

import { useEffect, useRef, useState } from 'react';
import { usePolling } from '@/hooks/usePolling';

type NodeStatus = {
  id: string;
  name: string;
  host: string;
  region: string;
  lat: number;
  lon: number;
  online: boolean;
};

type NetworkStatus = {
  nodes: NodeStatus[];
};

function getZionGoldRgb(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-zion-gold')
    .trim();
  if (!raw) return null;
  return `rgb(${raw})`;
}

export default function InteractiveEarthBackground({
  className,
}: {
  className?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setIsVisible(true);
        }
      },
      { root: null, rootMargin: '200px', threshold: 0.01 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  usePolling(
    async () => {
      if (!isVisible) return;
      try {
        const res = await fetch('/api/network', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as NetworkStatus;
        setStatus(data);
      } catch {
        // ignore
      }
    },
    30000,
    { enabled: isVisible }
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!isVisible) return;
      if (!containerRef.current) return;
      if (mapRef.current) return;

      try {
        const L = await import('leaflet');
        if (cancelled) return;

        const map = L.map(containerRef.current!, {
          zoomControl: false,
          attributionControl: true,
          dragging: true,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false,
          worldCopyJump: true,
        });

        map.setView([20, 0], 2);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 6,
          minZoom: 1,
          subdomains: ['a', 'b', 'c'],
          updateWhenIdle: true,
          keepBuffer: 2,
          attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        const layer = L.layerGroup().addTo(map);
        mapRef.current = map;
        layerRef.current = layer;
      } catch (err) {
        console.warn('Leaflet map unavailable:', err);
      }
    }

    init();

    return () => {
      cancelled = true;
      try {
        if (mapRef.current) {
          mapRef.current.remove();
        }
      } finally {
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, [isVisible]);

  useEffect(() => {
    async function syncMarkers() {
      if (!status?.nodes) return;
      if (!mapRef.current || !layerRef.current) return;

      try {
        const L = await import('leaflet');
        const layer = layerRef.current as any;
        layer.clearLayers();

        const gold = getZionGoldRgb();

        for (const node of status.nodes) {
          if (!Number.isFinite(node.lat) || !Number.isFinite(node.lon)) continue;

          const color = node.online ? (gold ?? '#D4AF37') : '#EF4444';
          const circle = L.circleMarker([node.lat, node.lon], {
            radius: node.online ? 6 : 5,
            color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.45,
          });

          circle.bindTooltip(
            `${node.name} · ${node.online ? 'online' : 'offline'}`,
            { direction: 'top', opacity: 0.9 }
          );

          circle.addTo(layer);
        }
      } catch (err) {
        console.warn('Leaflet markers unavailable:', err);
      }
    }

    syncMarkers();
  }, [status]);

  return (
    <div
      ref={wrapperRef}
      className={[
        'pointer-events-auto',
        'absolute inset-0',
        'opacity-40',
        'mix-blend-screen',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div ref={containerRef} className="w-full h-full" />
      <div className="pointer-events-none absolute inset-0 bg-black/60" />
    </div>
  );
}
