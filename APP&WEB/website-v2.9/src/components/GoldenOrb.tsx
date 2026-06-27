'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Interaktivní Golden Orb — CSS/SVG animated, no external deps.
 * - Radial gradient core (gold → amber → white-hot center)
 * - Pulsing glow halo
 * - Rotating light rays (conic gradient via SVG)
 * - Floating sparkles (CSS particles)
 * - Mouse-reactive: orb tilts toward cursor, glow intensifies on hover
 */
export default function GoldenOrb({ className = '' }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [hovered, setHovered] = useState(false);
  const [sparkles, setSparkles] = useState<
    { id: number; x: number; y: number; delay: number; size: number }[]
  >([]);

  // Generate stable sparkle positions once on mount
  useEffect(() => {
    const arr = Array.from({ length: 14 }, (_, i) => ({
      id: i,
      x: 8 + Math.random() * 84,
      y: 8 + Math.random() * 84,
      delay: Math.random() * 4,
      size: 1.5 + Math.random() * 2.5,
    }));
    setSparkles(arr);
  }, []);

  const handleMove = useCallback((e: React.MouseEvent) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = (e.clientX - cx) / (r.width / 2);
    const dy = (e.clientY - cy) / (r.height / 2);
    setTilt({ rx: -dy * 12, ry: dx * 12 });
  }, []);

  const handleLeave = useCallback(() => {
    setTilt({ rx: 0, ry: 0 });
    setHovered(false);
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`group relative flex items-center justify-center ${className}`}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleLeave}
      style={{ perspective: '800px' }}
    >
      {/* ── Outer ambient glow ── */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full blur-3xl transition-opacity duration-700"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(251,191,36,0.35) 0%, rgba(245,158,11,0.18) 35%, transparent 70%)',
          opacity: hovered ? 1 : 0.6,
          transform: 'scale(1.3)',
        }}
      />

      {/* ── Rotating light rays (SVG conic) ── */}
      <svg
        className="pointer-events-none absolute h-[115%] w-[115%] animate-[spin_40s_linear_infinite] opacity-60"
        viewBox="0 0 200 200"
        fill="none"
        style={{ transition: 'opacity 0.6s', opacity: hovered ? 0.85 : 0.5 }}
      >
        <defs>
          <radialGradient id="rayFade" cx="50%" cy="50%" r="50%">
            <stop offset="40%" stopColor="rgba(251,191,36,0)" />
            <stop offset="65%" stopColor="rgba(251,191,36,0.25)" />
            <stop offset="100%" stopColor="rgba(251,191,36,0)" />
          </radialGradient>
        </defs>
        {Array.from({ length: 12 }).map((_, i) => (
          <rect
            key={i}
            x="98"
            y="10"
            width="4"
            height="80"
            rx="2"
            fill="url(#rayFade)"
            transform={`rotate(${i * 30} 100 100)`}
          />
        ))}
      </svg>

      {/* ── Counter-rotating inner rays ── */}
      <svg
        className="pointer-events-none absolute h-[90%] w-[90%] animate-[spin_60s_linear_infinite_reverse] opacity-40"
        viewBox="0 0 200 200"
        fill="none"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <rect
            key={i}
            x="99"
            y="30"
            width="2"
            height="50"
            rx="1"
            fill="rgba(255,215,128,0.3)"
            transform={`rotate(${i * 45 + 22.5} 100 100)`}
          />
        ))}
      </svg>

      {/* ── Orb body (3D tilt) ── */}
      <div
        className="relative aspect-square w-full max-w-[420px] transition-transform duration-200 ease-out"
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${hovered ? 1.04 : 1})`,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Pulsing halo ring */}
        <div
          className="absolute inset-[-8%] rounded-full animate-[pulse-glow_3s_ease-in-out_infinite]"
          style={{
            background:
              'radial-gradient(circle, transparent 55%, rgba(251,191,36,0.12) 62%, transparent 72%)',
          }}
        />

        {/* Main orb sphere */}
        <div
          className="relative h-full w-full overflow-hidden rounded-full"
          style={{
            background:
              'radial-gradient(circle at 38% 32%, #fffbeb 0%, #fde68a 8%, #fbbf24 22%, #f59e0b 42%, #b45309 68%, #451a03 100%)',
            boxShadow: `
              inset -20px -30px 60px rgba(69,26,3,0.7),
              inset 18px 22px 50px rgba(255,251,230,0.45),
              0 0 60px rgba(251,191,36,0.5),
              0 0 120px rgba(245,158,11,0.3)
            `,
          }}
        >
          {/* Surface swirl / iridescence */}
          <div
            className="absolute inset-0 rounded-full opacity-50 mix-blend-screen animate-[spin_80s_linear_infinite]"
            style={{
              background:
                'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255,215,128,0.2) 60deg, transparent 120deg, rgba(251,191,36,0.15) 180deg, transparent 240deg, rgba(255,237,180,0.18) 300deg, transparent 360deg)',
            }}
          />

          {/* Hot core highlight */}
          <div
            className="absolute left-[28%] top-[22%] h-[35%] w-[35%] rounded-full blur-md"
            style={{
              background:
                'radial-gradient(circle, rgba(255,255,245,0.85) 0%, rgba(255,251,230,0.4) 40%, transparent 70%)',
            }}
          />

          {/* Secondary highlight */}
          <div
            className="absolute bottom-[15%] right-[20%] h-[18%] w-[18%] rounded-full blur-sm opacity-60"
            style={{
              background:
                'radial-gradient(circle, rgba(253,230,138,0.7) 0%, transparent 70%)',
            }}
          />

          {/* Floating sparkles inside orb */}
          {sparkles.map((s) => (
            <span
              key={s.id}
              className="absolute rounded-full bg-amber-50"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                boxShadow: `0 0 ${s.size * 3}px rgba(255,251,230,0.9)`,
                animation: `sparkle-float ${4 + s.delay}s ease-in-out ${s.delay}s infinite`,
              }}
            />
          ))}

          {/* Rim light */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, transparent 88%, rgba(251,191,36,0.4) 95%, transparent 100%)',
            }}
          />
        </div>
      </div>

      {/* ── Sparkles orbiting outside ── */}
      {sparkles.slice(0, 6).map((s) => (
        <span
          key={`orbit-${s.id}`}
          className="pointer-events-none absolute rounded-full bg-zion-gold"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: '3px',
            height: '3px',
            boxShadow: '0 0 8px rgba(251,191,36,0.9)',
            animation: `sparkle-float ${5 + s.delay}s ease-in-out ${s.delay}s infinite`,
            opacity: hovered ? 0.9 : 0.5,
            transition: 'opacity 0.4s',
          }}
        />
      ))}

      <style>{`
        @keyframes sparkle-float {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
          25% { transform: translate(6px, -8px) scale(1.4); opacity: 0.9; }
          50% { transform: translate(-4px, -14px) scale(0.8); opacity: 0.6; }
          75% { transform: translate(-8px, 4px) scale(1.2); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
