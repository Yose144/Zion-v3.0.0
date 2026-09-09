'use client';

import { useEffect, useRef } from 'react';

type RGBColor = [number, number, number];

interface StarfieldBackgroundProps {
  starColor?: RGBColor | RGBColor[];
  density?: number;
  speed?: number;
  trailOpacity?: number;
  backgroundGradient?: string;
  flowDirection?: 'outward' | 'inward';
  /** When true, clears canvas each frame (clearRect) so CSS background
   *  gradient shows through. Stars have no trails. */
  clearPerFrame?: boolean;
  /** Draw line trails from previous to current star position (desktop-agent style). */
  lineTrails?: boolean;
  /** Radial gradient drawn ON the canvas each frame at canvasGradientAlpha.
   *  Matches desktop-agent's cachedGradient approach. */
  canvasGradient?: { x: number; y: number; inner: string; outer: string };
  /** Alpha for the canvas gradient overlay (0-1). Default 0.22. */
  canvasGradientAlpha?: number;
  /** FPS cap (0 = unlimited). Desktop-agent uses 24. */
  fpsLimit?: number;
}

const DEFAULT_COLORS: RGBColor[] = [
  [252, 209, 22],  // rasta gold
  [228, 30, 43],   // rasta red
  [6, 105, 40],    // rasta green
];
const DEFAULT_GRADIENT = 'radial-gradient(ellipse at bottom, #1B2735 0%, #090A0F 100%)';

export default function StarfieldBackground({
  starColor = DEFAULT_COLORS,
  density = 350,
  speed = 2,
  trailOpacity = 0.08,
  backgroundGradient = DEFAULT_GRADIENT,
  flowDirection = 'outward',
  clearPerFrame = false,
  lineTrails = false,
  canvasGradient,
  canvasGradientAlpha = 0.22,
  fpsLimit = 0,
}: StarfieldBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colorList = Array.isArray(starColor[0]) ? (starColor as RGBColor[]) : [starColor as RGBColor];
    const pickColor = () => colorList[Math.floor(Math.random() * colorList.length)];
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const effectiveDensity = () => window.innerWidth < 640 ? Math.min(density, 120) : density;
    let frameInterval = 0;
    const updateFrameInterval = () => {
      const targetFps = window.innerWidth < 640 ? Math.min(fpsLimit || 18, 18) : fpsLimit;
      frameInterval = targetFps > 0 ? 1000 / targetFps : 0;
    };

    const stars: { x: number; y: number; z: number; size: number; px: number; py: number; color: RGBColor }[] = [];

    let cachedGradient: CanvasGradient | null = null;
    const rebuildGradient = () => {
      if (!canvasGradient) return;
      const g = ctx.createRadialGradient(
        canvasGradient.x * canvas.width,
        canvasGradient.y * canvas.height,
        0,
        canvasGradient.x * canvas.width,
        canvasGradient.y * canvas.height,
        Math.max(canvas.width, canvas.height)
      );
      g.addColorStop(0, canvasGradient.inner);
      g.addColorStop(1, canvasGradient.outer);
      cachedGradient = g;
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      updateFrameInterval();
      rebuildGradient();
    };

    const seedStars = () => {
      stars.splice(0, stars.length);
      for (let i = 0; i < effectiveDensity(); i++) {
        stars.push({
          x: Math.random() * canvas.width - canvas.width / 2,
          y: Math.random() * canvas.height - canvas.height / 2,
          z: Math.random() * canvas.width,
          size: Math.random() * 2 + 0.5,
          px: 0,
          py: 0,
          color: pickColor(),
        });
      }
    };

    resize();
    seedStars();
    // Force clear canvas on mount/re-mount to avoid stale visuals from previous mode
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let animationFrameId = 0;
    let lastFrameTime = 0;

    const animate = (timestamp: number) => {
      animationFrameId = 0;
      if (!ctx || !canvas || document.visibilityState === 'hidden') return;
      if (!reduceMotion) animationFrameId = requestAnimationFrame(animate);

      if (frameInterval > 0) {
        const delta = timestamp - lastFrameTime;
        if (delta < frameInterval) return;
        lastFrameTime = timestamp - (delta % frameInterval);
      }

      if (clearPerFrame) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(Math.max(trailOpacity * 0.5, 0.01), 0.15)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Canvas gradient overlay (desktop-agent style)
      if (cachedGradient) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = cachedGradient;
        ctx.globalAlpha = canvasGradientAlpha;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      }

      const hw = canvas.width / 2;
      const hh = canvas.height / 2;

      stars.forEach((star) => {
        const prevX = (star.x / star.z) * canvas.width + hw;
        const prevY = (star.y / star.z) * canvas.height + hh;

        if (flowDirection === 'inward') {
          star.z += speed;
          if (star.z >= canvas.width) {
            star.z = Math.random() * 18 + 2;
            star.x = Math.random() * canvas.width - hw;
            star.y = Math.random() * canvas.height - hh;
            star.px = prevX;
            star.py = prevY;
            star.color = pickColor();
            return;
          }
        } else {
          star.z -= speed;
          if (star.z <= 0) {
            star.z = canvas.width;
            star.x = Math.random() * canvas.width - hw;
            star.y = Math.random() * canvas.height - hh;
            star.px = prevX;
            star.py = prevY;
            star.color = pickColor();
            return;
          }
        }

        const x = (star.x / star.z) * canvas.width + hw;
        const y = (star.y / star.z) * canvas.height + hh;
        const size = (1 - star.z / canvas.width) * star.size * (lineTrails ? 2 : 4);

        const brightness = 1 - star.z / canvas.width;
        const alpha = Math.min(1, lineTrails ? 0.08 + brightness * 0.92 : 0.55 + brightness * 0.45);

        const [r, g, b] = star.color;
        if (lineTrails) {
          // Line trail from previous to current position (desktop-agent style)
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.lineWidth = Math.max(0.5, size * 0.5);
          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(x, y);
          ctx.stroke();

          // Bright head
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1, alpha + 0.15)})`;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(size * 0.65, 0.55), 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(size, 1.0), 0, Math.PI * 2);
          ctx.fill();
        }

        star.px = x;
        star.py = y;
      });
    };

    const startAnimation = () => {
      if (!animationFrameId && document.visibilityState !== 'hidden') {
        animationFrameId = requestAnimationFrame(animate);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      } else {
        startAnimation();
      }
    };
    let resizeFrame = 0;
    const handleResize = () => {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resize();
        seedStars();
      });
    };

    startAnimation();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('resize', handleResize);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('resize', handleResize);
    };
  }, [density, speed, starColor, trailOpacity, flowDirection, clearPerFrame, lineTrails, canvasGradient, canvasGradientAlpha, fpsLimit]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full z-[1]"
      style={{ background: backgroundGradient }}
    />
  );
}
