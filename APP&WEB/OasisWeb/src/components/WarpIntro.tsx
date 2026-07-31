'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

interface WarpIntroProps {
  speed?: number;
  onEnter: () => void;
}

const BASE_SPEED = 18;
const WARP_SPEED = 90;

export default function WarpIntro({ speed = BASE_SPEED, onEnter }: WarpIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [warping, setWarping] = useState(false);
  const [exiting, setExiting] = useState(false);

  const currentSpeed = useRef(speed);
  const targetSpeed = useRef(speed);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;

    const stars: { x: number; y: number; z: number; hue: number; sat: number; size: number }[] = [];
    const DENSITY = 900;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      cx = w / 2;
      cy = h / 2;
    };

    const seedStars = () => {
      stars.splice(0, stars.length);
      for (let i = 0; i < DENSITY; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 240;
        stars.push({
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          z: Math.random() * w * 0.8 + w * 0.2,
          hue: Math.random() > 0.7 ? 260 + Math.random() * 60 : 35 + Math.random() * 40 + Math.random() * 180,
          sat: 0.5 + Math.random() * 0.5,
          size: Math.random() * 1.2 + 0.3,
        });
      }
    };

    const drawNebula = () => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.65);
      g.addColorStop(0, 'rgba(10, 15, 35, 0.55)');
      g.addColorStop(0.35, 'rgba(15, 8, 30, 0.35)');
      g.addColorStop(0.7, 'rgba(5, 3, 12, 0.2)');
      g.addColorStop(1, 'rgba(2, 3, 10, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };

    resize();
    seedStars();

    let animationFrameId: number;

    const animate = () => {
      if (!ctx || !canvas) return;

      currentSpeed.current += (targetSpeed.current - currentSpeed.current) * 0.04;

      // Longer trails when warping, crisp when still
      const fade = 0.92 - (currentSpeed.current / WARP_SPEED) * 0.78;
      ctx.fillStyle = `rgba(2, 3, 10, ${fade})`;
      ctx.fillRect(0, 0, w, h);

      // Re-apply the soft nebula glow each frame (very low opacity so it builds)
      drawNebula();

      const tailScaleK = 1 + (currentSpeed.current / BASE_SPEED) * 5;

      stars.forEach((star) => {
        star.z -= currentSpeed.current;

        if (star.z <= 1) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 180;
          star.x = Math.cos(angle) * dist;
          star.y = Math.sin(angle) * dist;
          star.z = w * (0.85 + Math.random() * 0.15);
        }

        const scale = (w * 0.6) / star.z;
        const x = star.x * scale + cx;
        const y = star.y * scale + cy;

        const tailZ = star.z + currentSpeed.current * tailScaleK;
        const tailScale = (w * 0.6) / tailZ;
        const tailX = star.x * tailScale + cx;
        const tailY = star.y * tailScale + cy;

        const depth = Math.min(1, Math.max(0, 1 - star.z / w));
        const alpha = Math.min(1, 0.25 + depth * 0.75);
        const lineWidth = Math.max(0.4, depth * 2.5 * star.size);

        // Color shifts from cool purple/blue near viewer to warm gold at the center
        const r = Math.round(220 + (1 - depth) * 60 * star.sat + (depth * 80 * star.hue) / 360);
        const g = Math.round(230 - (1 - depth) * 30 + depth * (star.hue > 300 ? 40 : 120) * star.sat);
        const b = Math.round(255 - (1 - depth) * 80);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = `rgba(${Math.min(255, r)}, ${Math.min(255, g)}, ${Math.min(255, b)}, ${alpha})`;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        if (depth > 0.5) {
          ctx.fillStyle = `rgba(${Math.min(255, r)}, ${Math.min(255, g)}, ${Math.min(255, b)}, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, lineWidth * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Central vortex glow
      const vortex = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.25);
      const vortexIntensity = 0.08 + (currentSpeed.current / WARP_SPEED) * 0.2;
      vortex.addColorStop(0, `rgba(240, 200, 100, ${vortexIntensity})`);
      vortex.addColorStop(0.4, `rgba(80, 40, 120, ${vortexIntensity * 0.4})`);
      vortex.addColorStop(1, 'rgba(2, 3, 10, 0)');
      ctx.fillStyle = vortex;
      ctx.fillRect(0, 0, w, h);

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
  }, []);

  useEffect(() => {
    targetSpeed.current = speed;
  }, [speed]);

  const handleEnter = () => {
    setWarping(true);
    targetSpeed.current = WARP_SPEED;

    setTimeout(() => {
      setExiting(true);
      setTimeout(onEnter, 1400);
    }, 4200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#02030a]">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      <div className="relative z-10 flex max-w-3xl flex-col items-center px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="mb-6 text-xs font-semibold uppercase tracking-[0.5em] text-oasis-gold"
        >
          Brána do Oasis
        </motion.p>

        <AnimatePresence mode="wait">
          {!exiting && (
            <motion.div
              key="quote"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
              transition={{ duration: 1 }}
              className="rounded-3xl border border-white/10 bg-black/30 p-8 shadow-2xl backdrop-blur-md sm:p-10"
            >
              <blockquote className="text-lg font-light italic leading-relaxed text-white/95 sm:text-2xl md:text-3xl" style={{ textShadow: '0 2px 24px rgba(0,0,0,0.7)' }}>
                „Vstupuješ do světa, kde každý tvůj čin zanechává stopu v paměti.
                <br />
                Svět se neotevírá klíčem ze zlata,
                <br />
                ale klíčem tvého vlastního záměru.“
              </blockquote>

              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <motion.button
                  onClick={handleEnter}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-oasis-gold via-oasis-purple to-oasis-cyan px-8 py-4 text-sm font-bold text-white shadow-[0_0_60px_rgba(245,158,11,0.25)] transition-shadow hover:shadow-[0_0_80px_rgba(168,85,247,0.5)]"
                >
                  Vstoupit do Oasis
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {warping && !exiting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <p className="text-sm uppercase tracking-[0.3em] text-oasis-gold" style={{ textShadow: '0 0 30px rgba(245,158,11,0.6)' }}>
              Přijíždíme do středu galaxie…
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
