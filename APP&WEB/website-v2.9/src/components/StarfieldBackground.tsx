'use client';

import { useEffect, useRef } from 'react';

type RGBColor = [number, number, number];

interface StarfieldBackgroundProps {
  starColor?: RGBColor;
  density?: number;
  speed?: number;
  trailOpacity?: number;
  backgroundGradient?: string;
  flowDirection?: 'outward' | 'inward';
  /** When true, clears canvas each frame (clearRect) so CSS background
   *  gradient shows through. Use for modes where nebula/gradient must
   *  be visible (desktop-agent, galaxy-core). Stars have no trails. */
  clearPerFrame?: boolean;
}

const DEFAULT_COLOR: RGBColor = [255, 215, 0];
const DEFAULT_GRADIENT = 'radial-gradient(ellipse at bottom, #1B2735 0%, #090A0F 100%)';

export default function StarfieldBackground({
  starColor = DEFAULT_COLOR,
  density = 350,
  speed = 2,
  trailOpacity = 0.08,
  backgroundGradient = DEFAULT_GRADIENT,
  flowDirection = 'outward',
  clearPerFrame = false,
}: StarfieldBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars: { x: number; y: number; z: number; size: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const seedStars = () => {
      stars.splice(0, stars.length);
      for (let i = 0; i < density; i++) {
        stars.push({
          x: Math.random() * canvas.width - canvas.width / 2,
          y: Math.random() * canvas.height - canvas.height / 2,
          z: Math.random() * canvas.width,
          size: Math.random() * 2 + 0.5,
        });
      }
    };

    resize();
    seedStars();

    let animationFrameId: number;

    const animate = () => {
      if (!ctx || !canvas) return;

      if (clearPerFrame) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(Math.max(trailOpacity * 0.5, 0.01), 0.15)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      stars.forEach((star) => {
        if (flowDirection === 'inward') {
          star.z += speed;
          if (star.z >= canvas.width) {
            star.z = Math.random() * 18 + 2;
            star.x = Math.random() * canvas.width - canvas.width / 2;
            star.y = Math.random() * canvas.height - canvas.height / 2;
          }
        } else {
          star.z -= speed;
          if (star.z <= 0) {
            star.z = canvas.width;
            star.x = Math.random() * canvas.width - canvas.width / 2;
            star.y = Math.random() * canvas.height - canvas.height / 2;
          }
        }

        const x = (star.x / star.z) * canvas.width + canvas.width / 2;
        const y = (star.y / star.z) * canvas.height + canvas.height / 2;
        const size = (1 - star.z / canvas.width) * star.size * 4;

        const brightness = 1 - star.z / canvas.width;
        const alpha = Math.min(1, 0.55 + brightness * 0.45);
        ctx.fillStyle = `rgba(${starColor[0]}, ${starColor[1]}, ${starColor[2]}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(size, 1.0), 0, Math.PI * 2);
        ctx.fill();
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
  }, [density, speed, starColor, trailOpacity, flowDirection, clearPerFrame]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full z-[1]"
      style={{ background: backgroundGradient }}
    />
  );
}
