'use client';

import { useEffect, useRef } from 'react';

type RGBColor = [number, number, number];

interface WarpSpeedBackgroundProps {
  starColor?: RGBColor;
  density?: number;
  speed?: number;
  backgroundGradient?: string;
}

const DEFAULT_COLOR: RGBColor = [255, 215, 0];
const DEFAULT_GRADIENT = 'radial-gradient(ellipse at bottom, #1a1f3e 0%, #050810 100%)';

export default function WarpSpeedBackground({
  starColor = DEFAULT_COLOR,
  density = 500,
  speed = 20,
  backgroundGradient = DEFAULT_GRADIENT,
}: WarpSpeedBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;

    const stars: { x: number; y: number; z: number; prevZ: number }[] = [];

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      cx = w / 2;
      cy = h / 2;
    };

    const seedStars = () => {
      stars.splice(0, stars.length);
      for (let i = 0; i < density; i++) {
        stars.push({
          x: Math.random() * w - cx,
          y: Math.random() * h - cy,
          z: Math.random() * w + 1,
          prevZ: 0,
        });
      }
    };

    resize();
    seedStars();

    let animationFrameId: number;

    const animate = () => {
      if (!ctx || !canvas) return;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(0, 0, w, h);

      stars.forEach((star) => {
        star.prevZ = star.z;
        star.z -= speed;

        if (star.z <= 0) {
          star.z = w;
          star.x = Math.random() * w - cx;
          star.y = Math.random() * h - cy;
          star.prevZ = star.z;
        }

        const x = (star.x / star.z) * w + cx;
        const y = (star.y / star.z) * h + cy;
        const px = (star.x / star.prevZ) * w + cx;
        const py = (star.y / star.prevZ) * h + cy;

        const depth = 1 - star.z / w;
        const alpha = Math.min(1, 0.4 + depth * 0.6);
        const lineWidth = Math.max(1, depth * 3.5);

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.strokeStyle = `rgba(${starColor[0]}, ${starColor[1]}, ${starColor[2]}, ${alpha})`;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      resize();
      seedStars();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [density, speed, starColor]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 w-full h-full z-[60]"
      style={{ background: backgroundGradient }}
    />
  );
}
