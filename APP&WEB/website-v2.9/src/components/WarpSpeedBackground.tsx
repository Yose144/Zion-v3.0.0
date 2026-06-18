'use client';

import { useEffect, useRef } from 'react';

type RGBColor = [number, number, number];

interface WarpSpeedBackgroundProps {
  starColor?: RGBColor;
  density?: number;
  speed?: number;
  backgroundGradient?: string;
}

const DEFAULT_COLOR: RGBColor = [220, 230, 255];
const DEFAULT_GRADIENT = 'radial-gradient(ellipse at center, #0a0f2e 0%, #02030a 100%)';

export default function WarpSpeedBackground({
  starColor = DEFAULT_COLOR,
  density = 600,
  speed = 28,
  backgroundGradient = DEFAULT_GRADIENT,
}: WarpSpeedBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;

    // Star Trek warp: stars originate near center and streak outward
    const stars: {
      x: number;
      y: number;
      z: number;
      colorShift: number; // 0-1 for color variation
    }[] = [];

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      cx = w / 2;
      cy = h / 2;
    };

    const seedStars = () => {
      stars.splice(0, stars.length);
      for (let i = 0; i < density; i++) {
        // Start near center with random direction
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 200; // near center spread
        stars.push({
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          z: Math.random() * w * 0.8 + w * 0.2,
          colorShift: Math.random(),
        });
      }
    };

    resize();
    seedStars();

    let animationFrameId: number;

    const animate = () => {
      if (!ctx || !canvas) return;

      // Deep fade for trails
      ctx.fillStyle = 'rgba(2, 3, 10, 0.2)';
      ctx.fillRect(0, 0, w, h);

      stars.forEach((star) => {
        // Move star toward viewer (decrease z)
        star.z -= speed;

        if (star.z <= 1) {
          // Reset star: new random direction near center
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 150;
          star.x = Math.cos(angle) * dist;
          star.y = Math.sin(angle) * dist;
          star.z = w * 0.9;
        }

        // Perspective projection
        const scale = w / star.z;
        const x = star.x * scale + cx;
        const y = star.y * scale + cy;

        // Tail position (where the star was a few frames ago)
        const tailZ = star.z + speed * 5;
        const tailScale = w / tailZ;
        const tailX = star.x * tailScale + cx;
        const tailY = star.y * tailScale + cy;

        // Streak length and appearance based on depth
        const depth = 1 - star.z / w;
        const alpha = Math.min(1, 0.3 + depth * 0.7);
        const lineWidth = Math.max(0.5, depth * 4);

        // Color variation: white -> blue -> purple streaks
        const r = Math.round(starColor[0] + (255 - starColor[0]) * (1 - star.colorShift) * depth);
        const g = Math.round(starColor[1] + (255 - starColor[1]) * (1 - star.colorShift) * depth * 0.7);
        const b = Math.round(starColor[2] + (255 - starColor[2]) * depth);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Bright head dot for close stars
        if (depth > 0.6) {
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, lineWidth * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
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
