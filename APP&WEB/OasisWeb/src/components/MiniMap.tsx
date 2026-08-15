'use client';

import { useEffect, useMemo, useRef, useCallback, memo } from 'react';
import type { World, WorldCategory } from '../domain/types/world';

const CATEGORY_COLORS: Record<WorldCategory, string> = {
  'star-system': '#fcd116',
  planet: '#078930',
  sector: '#e41e2b',
  world: '#078930',
  dimension: '#e41e2b',
};

const PADDING = 18;

interface MiniMapProps {
  worlds: World[];
  activeCategories: WorldCategory[];
  selectedWorldId?: string | null;
  onWorldSelect?: (world: World) => void;
  cameraPosition?: { x: number; y: number; z: number };
}

function MiniMap({ worlds: allWorlds, activeCategories, selectedWorldId, onWorldSelect, cameraPosition }: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const worlds = useMemo(
    () => allWorlds.filter((w) => w.galaxyPosition && activeCategories.includes(w.category as WorldCategory)),
    [allWorlds, activeCategories]
  );

  const bounds = useMemo(() => {
    const xs = worlds.map((w) => w.galaxyPosition!.x);
    const zs = worlds.map((w) => w.galaxyPosition!.z);
    return {
      minX: Math.min(...xs, -1),
      maxX: Math.max(...xs, 1),
      minZ: Math.min(...zs, -1),
      maxZ: Math.max(...zs, 1),
    };
  }, [worlds]);

  const mapWorldToCanvas = useCallback(
    (x: number, z: number, width: number, height: number) => {
      const scaleX = (width - PADDING * 2) / (bounds.maxX - bounds.minX || 1);
      const scaleY = (height - PADDING * 2) / (bounds.maxZ - bounds.minZ || 1);
      const cx = PADDING + (x - bounds.minX) * scaleX;
      const cy = height - PADDING - (z - bounds.minZ) * scaleY;
      return { x: cx, y: cy };
    },
    [bounds]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Subtle galaxy backdrop
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.min(width, height) / 2 - 4;
    const radial = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    radial.addColorStop(0, 'rgba(255, 240, 200, 0.08)');
    radial.addColorStop(0.4, 'rgba(120, 80, 200, 0.04)');
    radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.fill();

    // Faint outer ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.92, 0, Math.PI * 2);
    ctx.stroke();

    // World dots
    for (const w of worlds) {
      const p = w.galaxyPosition!;
      const c = mapWorldToCanvas(p.x, p.z, width, height);
      const color = CATEGORY_COLORS[w.category as WorldCategory] || '#ffffff';
      const isSelected = w.id === selectedWorldId;
      const r = isSelected ? 5 : 2.5;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Camera / pilgrim position
    if (cameraPosition) {
      const c = mapWorldToCanvas(cameraPosition.x, cameraPosition.z, width, height);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fcd116';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [worlds, selectedWorldId, cameraPosition, mapWorldToCanvas]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onWorldSelect) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let closest: World | null = null;
    let best = 12;
    for (const w of worlds) {
      const p = w.galaxyPosition!;
      const c = mapWorldToCanvas(p.x, p.z, canvas.width, canvas.height);
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < best) {
        best = d;
        closest = w;
      }
    }
    if (closest) onWorldSelect(closest);
  };

  return (
    <div
      ref={wrapperRef}
      className="pointer-events-auto relative w-full rounded-xl border border-white/10 bg-oasis-black/60 p-2 shadow-lg backdrop-blur-sm"
      style={{ aspectRatio: '1 / 1' }}
    >
      <canvas
        ref={canvasRef}
        width={256}
        height={256}
        onClick={handleClick}
        className="h-full w-full cursor-crosshair"
      />
    </div>
  );
}

export default memo(MiniMap);
