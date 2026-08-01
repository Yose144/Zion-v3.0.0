'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { createRandom } from '../domain/ports/random';

interface WarpIntroProps {
  speed?: number;
  onEnter: () => void;
}

const BASE_SPEED = 18;
const WARP_SPEED = 120;
const WARP_SEED = 420777;

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
    const rng = createRandom(WARP_SEED);

    const stars: { x: number; y: number; z: number; hue: number; sat: number; size: number }[] = [];
    const DENSITY = 1200;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      cx = w / 2;
      cy = h / 2;
    };

    const seedStars = () => {
      stars.splice(0, stars.length);
      for (let i = 0; i < DENSITY; i++) {
        const angle = rng.next() * Math.PI * 2;
        const dist = rng.next() * 240;
        const hueBand = rng.next();
        let hue: number;
        if (hueBand < 0.2) hue = 10 + rng.next() * 50;     // amber / gold
        else if (hueBand < 0.4) hue = 160 + rng.next() * 80; // teal / aqua
        else if (hueBand < 0.6) hue = 260 + rng.next() * 60; // violet / blue
        else if (hueBand < 0.8) hue = 300 + rng.next() * 50; // magenta / pink
        else hue = 45 + rng.next() * 35;                    // warm orange
        stars.push({
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          z: rng.next() * w * 0.8 + w * 0.2,
          hue,
          sat: 0.7 + rng.next() * 0.3,
          size: rng.next() * 1.4 + 0.3,
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
    let time = 0;

    const animate = () => {
      if (!ctx || !canvas) return;
      time += 0.016;

      currentSpeed.current += (targetSpeed.current - currentSpeed.current) * 0.035;

      const fade = 0.92 - (currentSpeed.current / WARP_SPEED) * 0.78;
      ctx.fillStyle = `rgba(2, 3, 10, ${fade})`;
      ctx.fillRect(0, 0, w, h);

      drawNebula();

      const tailScaleK = 1 + (currentSpeed.current / BASE_SPEED) * 6;

      stars.forEach((star) => {
        star.z -= currentSpeed.current;

        if (star.z <= 1) {
          const angle = rng.next() * Math.PI * 2;
          const dist = rng.next() * 180;
          star.x = Math.cos(angle) * dist;
          star.y = Math.sin(angle) * dist;
          star.z = w * (0.85 + rng.next() * 0.15);
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

        const sat = Math.round(star.sat * 100);
        const light = Math.round(45 + depth * 35);
        const color = `hsla(${star.hue}, ${sat}%, ${light}%, ${alpha})`;

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        if (depth > 0.5) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, lineWidth * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      const vortexHue = 30 + (currentSpeed.current / WARP_SPEED) * 80 + Math.sin(time * 0.4) * 20;
      const vortexIntensity = 0.08 + (currentSpeed.current / WARP_SPEED) * 0.22;
      const vortex = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.28);
      vortex.addColorStop(0, `hsla(${vortexHue}, 90%, 60%, ${vortexIntensity})`);
      vortex.addColorStop(0.3, `hsla(${vortexHue + 60}, 80%, 50%, ${vortexIntensity * 0.55})`);
      vortex.addColorStop(0.65, `hsla(${vortexHue + 140}, 70%, 40%, ${vortexIntensity * 0.25})`);
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
      setTimeout(onEnter, 1600);
    }, 4200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#02030a]">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {/* Cinematic vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, transparent 0%, rgba(2,3,10,0.2) 55%, rgba(2,3,10,0.85) 100%)',
        }}
      />

      <div className="relative z-10 flex max-w-2xl flex-col items-center px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="mb-6 text-[10px] font-semibold uppercase tracking-[0.55em] text-oasis-gold"
          style={{ textShadow: '0 0 20px rgba(245,158,11,0.4)' }}
        >
          ZION · OASIS
        </motion.p>

        <AnimatePresence mode="wait">
          {!exiting && (
            <motion.div
              key="quote"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, y: -30, filter: 'blur(12px)' }}
              transition={{ duration: 1.2 }}
              className="rounded-3xl border border-white/10 bg-black/25 p-8 shadow-2xl shadow-black/50 backdrop-blur-lg sm:p-10"
            >
              <blockquote
                className="text-base font-light italic leading-relaxed text-white/95 sm:text-lg md:text-xl"
                style={{ textShadow: '0 2px 28px rgba(0,0,0,0.7)' }}
              >
                “For small creatures such as we, the vastness is bearable only through love.”
              </blockquote>
              <p className="mt-4 text-xs tracking-wider text-white/45">— CARL SAGAN, CONTACT</p>

              <motion.button
                onClick={handleEnter}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.97 }}
                className="group mt-9 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-oasis-gold via-oasis-purple to-oasis-cyan px-8 py-3.5 text-sm font-bold text-white shadow-[0_0_60px_rgba(245,158,11,0.25)] transition-shadow hover:shadow-[0_0_90px_rgba(168,85,247,0.55)]"
              >
                Enter the OASIS
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </motion.button>

              <p className="mt-4 text-[10px] text-white/30">Click to initiate warp sequence</p>
            </motion.div>
          )}
        </AnimatePresence>

        {warping && !exiting && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.35em] text-oasis-gold" style={{ textShadow: '0 0 30px rgba(245,158,11,0.6)' }}>
                Approaching the galactic center…
              </p>
              <div className="mx-auto mt-4 h-1 w-32 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                  className="h-full w-1/2 bg-gradient-to-r from-transparent via-oasis-gold to-transparent"
                />
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
