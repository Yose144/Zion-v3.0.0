'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  color: string;
}

interface FloatingBubblesProps {
  count?: number;
  colors?: string[];
  intensity?: 'low' | 'medium' | 'high';
}

const speeds = {
  low: { min: 0.1, max: 0.3 },
  medium: { min: 0.2, max: 0.5 },
  high: { min: 0.3, max: 0.8 }
};

export default function FloatingBubbles({ 
  count = 15, 
  colors = ['rgba(255, 215, 0, 0.1)', 'rgba(157, 78, 221, 0.1)', 'rgba(0, 255, 255, 0.1)'],
  intensity = 'medium'
}: FloatingBubblesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    // Initialize bubbles
    const initBubbles = () => {
      bubblesRef.current = Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 80 + 40,
        speedX: (Math.random() - 0.5) * (speeds[intensity].max - speeds[intensity].min) + speeds[intensity].min,
        speedY: (Math.random() - 0.5) * (speeds[intensity].max - speeds[intensity].min) + speeds[intensity].min,
        color: colors[Math.floor(Math.random() * colors.length)]
      }));
    };
    initBubbles();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      bubblesRef.current.forEach((bubble) => {
        // Update position
        bubble.x += bubble.speedX;
        bubble.y += bubble.speedY;

        // Bounce off edges
        if (bubble.x < 0 || bubble.x > canvas.width) bubble.speedX *= -1;
        if (bubble.y < 0 || bubble.y > canvas.height) bubble.speedY *= -1;

        // Keep in bounds
        bubble.x = Math.max(0, Math.min(canvas.width, bubble.x));
        bubble.y = Math.max(0, Math.min(canvas.height, bubble.y));

        // Draw bubble with gradient
        const gradient = ctx.createRadialGradient(
          bubble.x, bubble.y, 0,
          bubble.x, bubble.y, bubble.size
        );
        gradient.addColorStop(0, bubble.color);
        gradient.addColorStop(0.5, bubble.color.replace(/[0-9.]+\)/, '0.05)'));
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.size, 0, Math.PI * 2);
        ctx.fill();

        // Add shimmer effect
        ctx.strokeStyle = bubble.color.replace(/[0-9.]+\)/, '0.2)');
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    window.addEventListener('resize', () => {
      resize();
      initBubbles();
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', resize);
    };
  }, [count, colors, intensity]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
}
