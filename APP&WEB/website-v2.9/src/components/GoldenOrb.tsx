'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Interaktivní Golden Orb v kosmickém prostoru.
 * - 3D vrstvená sféra s parallax highlights (depth)
 * - Mouse-reactive tilt + parallax (víc 3D)
 * - Vesmírné pozadí: starfield + nebula + cosmic dust
 * - Rotující paprsky, pulsující glow, floating sparkles
 */
export default function GoldenOrb({ className = '' }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [hovered, setHovered] = useState(false);
  const [stars, setStars] = useState<
    { id: number; x: number; y: number; size: number; delay: number; twinkle: number }[]
  >([]);
  const [sparkles, setSparkles] = useState<
    { id: number; x: number; y: number; delay: number; size: number }[]
  >([]);

  useEffect(() => {
    // Starfield — 60 hvězd
    setStars(
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 0.5 + Math.random() * 1.8,
        delay: Math.random() * 5,
        twinkle: 2 + Math.random() * 4,
      }))
    );
    // Sparkles uvnitř orbu
    setSparkles(
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        x: 15 + Math.random() * 70,
        y: 15 + Math.random() * 70,
        delay: Math.random() * 4,
        size: 1 + Math.random() * 2,
      }))
    );
  }, []);

  const handleMove = useCallback((e: React.MouseEvent) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = (e.clientX - cx) / (r.width / 2);
    const dy = (e.clientY - cy) / (r.height / 2);
    setTilt({ rx: -dy * 18, ry: dx * 18 });
  }, []);

  const handleLeave = useCallback(() => {
    setTilt({ rx: 0, ry: 0 });
    setHovered(false);
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`group relative flex items-center justify-center overflow-hidden ${className}`}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleLeave}
      style={{ perspective: '600px' }}
    >
      {/* ════════ KOSMICKÉ POZADÍ ════════ */}
      {/* Deep space gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, #0a0a1a 0%, #050510 40%, #020208 100%)',
        }}
      />

      {/* Nebula clouds */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 30% 30%, rgba(99,52,237,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 50% 35% at 70% 65%, rgba(168,85,247,0.08) 0%, transparent 55%),
            radial-gradient(ellipse 40% 30% at 50% 80%, rgba(251,191,36,0.06) 0%, transparent 60%)
          `,
        }}
      />

      {/* ════════ SRI YANTRA (subtle sacred geometry) ════════ */}
      <svg
        className="pointer-events-none absolute left-1/2 top-1/2 h-[85%] w-[85%] -translate-x-1/2 -translate-y-1/2 animate-[spin_180s_linear_infinite]"
        viewBox="0 0 200 200"
        fill="none"
        style={{ opacity: hovered ? 0.14 : 0.08, transition: 'opacity 1s' }}
      >
        <g stroke="rgba(251,191,36,0.9)" strokeWidth="0.4" strokeLinejoin="round">
          {/* ── Outer square with 4 gates (Bhupura) ── */}
          <rect x="14" y="14" width="172" height="172" rx="1" />
          <rect x="18" y="18" width="164" height="164" rx="1" />
          {/* T-gates on each side */}
          <line x1="100" y1="14" x2="100" y2="6" />
          <line x1="94" y1="10" x2="106" y2="10" />
          <line x1="100" y1="186" x2="100" y2="194" />
          <line x1="94" y1="190" x2="106" y2="190" />
          <line x1="14" y1="100" x2="6" y2="100" />
          <line x1="10" y1="94" x2="10" y2="106" />
          <line x1="186" y1="100" x2="194" y2="100" />
          <line x1="190" y1="94" x2="190" y2="106" />

          {/* ── 16-petal lotus ── */}
          <circle cx="100" cy="100" r="78" />
          {Array.from({ length: 16 }).map((_, i) => {
            const a = (i * 22.5 * Math.PI) / 180;
            const x1 = 100 + Math.cos(a) * 62;
            const y1 = 100 + Math.sin(a) * 62;
            const x2 = 100 + Math.cos(a) * 78;
            const y2 = 100 + Math.sin(a) * 78;
            return <line key={`p16-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
          <circle cx="100" cy="100" r="62" />

          {/* ── 8-petal lotus ── */}
          <circle cx="100" cy="100" r="56" />
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * 45 * Math.PI) / 180;
            const x1 = 100 + Math.cos(a) * 44;
            const y1 = 100 + Math.sin(a) * 44;
            const x2 = 100 + Math.cos(a) * 56;
            const y2 = 100 + Math.sin(a) * 56;
            return <line key={`p8-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
          <circle cx="100" cy="100" r="44" />

          {/* ── 9 interlocking triangles ── */}
          {/* Upward (Shiva) — 4 triangles, apex up */}
          <polygon points="100,16 22,146 178,146" />
          <polygon points="100,34 38,138 162,138" />
          <polygon points="100,52 54,130 146,130" />
          <polygon points="100,70 70,122 130,122" />

          {/* Downward (Shakti) — 5 triangles, apex down */}
          <polygon points="100,184 22,54 178,54" />
          <polygon points="100,166 38,62 162,62" />
          <polygon points="100,148 54,70 146,70" />
          <polygon points="100,130 70,78 130,78" />
          <polygon points="100,112 82,86 118,86" />

          {/* ── Bindu (central point) ── */}
          <circle cx="100" cy="100" r="1.5" fill="rgba(255,251,230,0.8)" stroke="none" />
        </g>
      </svg>

      {/* Starfield */}
      <div className="pointer-events-none absolute inset-0">
        {stars.map((s) => (
          <span
            key={s.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              boxShadow: s.size > 1.2 ? `0 0 ${s.size * 2}px rgba(255,255,255,0.6)` : 'none',
              animation: `twinkle ${s.twinkle}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Cosmic dust drift */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(circle at 20% 70%, rgba(255,255,255,0.04) 0%, transparent 30%), radial-gradient(circle at 80% 20%, rgba(251,191,36,0.04) 0%, transparent 30%)',
        }}
      />

      {/* ════════ ORB ════════ */}
      {/* Outer ambient glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[55%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-opacity duration-700"
        style={{
          background:
            'radial-gradient(circle, rgba(251,191,36,0.4) 0%, rgba(245,158,11,0.2) 40%, transparent 70%)',
          opacity: hovered ? 1 : 0.55,
        }}
      />

      {/* Rotating light rays */}
      <svg
        className="pointer-events-none absolute left-1/2 top-1/2 h-[48%] w-[48%] -translate-x-1/2 -translate-y-1/2 animate-[spin_40s_linear_infinite]"
        viewBox="0 0 200 200"
        fill="none"
        style={{ opacity: hovered ? 0.8 : 0.45, transition: 'opacity 0.6s' }}
      >
        <defs>
          <radialGradient id="rayFade" cx="50%" cy="50%" r="50%">
            <stop offset="40%" stopColor="rgba(251,191,36,0)" />
            <stop offset="65%" stopColor="rgba(251,191,36,0.3)" />
            <stop offset="100%" stopColor="rgba(251,191,36,0)" />
          </radialGradient>
        </defs>
        {Array.from({ length: 12 }).map((_, i) => (
          <rect
            key={i}
            x="98"
            y="10"
            width="3"
            height="80"
            rx="1.5"
            fill="url(#rayFade)"
            transform={`rotate(${i * 30} 100 100)`}
          />
        ))}
      </svg>

      {/* Counter-rotating inner rays */}
      <svg
        className="pointer-events-none absolute left-1/2 top-1/2 h-[40%] w-[40%] -translate-x-1/2 -translate-y-1/2 animate-[spin_55s_linear_infinite_reverse] opacity-40"
        viewBox="0 0 200 200"
        fill="none"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <rect
            key={i}
            x="99"
            y="30"
            width="1.5"
            height="50"
            rx="0.75"
            fill="rgba(255,215,128,0.35)"
            transform={`rotate(${i * 45 + 22.5} 100 100)`}
          />
        ))}
      </svg>

      {/* ── Orb body (3D layered) ── */}
      <div
        className="relative aspect-square w-[38%] transition-transform duration-150 ease-out"
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${hovered ? 1.06 : 1})`,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Pulsing halo */}
        <div
          className="absolute inset-[-12%] rounded-full animate-[pulse-glow_3s_ease-in-out_infinite]"
          style={{
            background:
              'radial-gradient(circle, transparent 52%, rgba(251,191,36,0.15) 60%, transparent 72%)',
          }}
        />

        {/* Main sphere — layered for 3D depth */}
        <div
          className="relative h-full w-full overflow-hidden rounded-full"
          style={{
            background:
              'radial-gradient(circle at 36% 30%, #fffbeb 0%, #fde68a 6%, #fbbf24 18%, #f59e0b 38%, #d97706 58%, #78350f 82%, #1c0a02 100%)',
            boxShadow: `
              inset -18px -28px 55px rgba(28,10,2,0.85),
              inset 16px 20px 45px rgba(255,251,230,0.5),
              inset 0 0 30px rgba(251,191,36,0.15),
              0 0 50px rgba(251,191,36,0.45),
              0 0 100px rgba(245,158,11,0.25),
              0 8px 40px rgba(0,0,0,0.6)
            `,
            transform: 'translateZ(0)',
          }}
        >
          {/* Iridescence swirl */}
          <div
            className="absolute inset-0 rounded-full opacity-50 mix-blend-screen animate-[spin_80s_linear_infinite]"
            style={{
              background:
                'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255,215,128,0.25) 60deg, transparent 120deg, rgba(251,191,36,0.18) 180deg, transparent 240deg, rgba(255,237,180,0.22) 300deg, transparent 360deg)',
            }}
          />

          {/* Hot core highlight — parallax (translateZ for depth) */}
          <div
            className="absolute left-[26%] top-[20%] h-[32%] w-[32%] rounded-full blur-md"
            style={{
              background:
                'radial-gradient(circle, rgba(255,255,250,0.9) 0%, rgba(255,251,230,0.45) 40%, transparent 70%)',
              transform: `translateZ(20px) translateX(${tilt.ry * 0.3}px) translateY(${-tilt.rx * 0.3}px)`,
              transition: 'transform 0.15s ease-out',
            }}
          />

          {/* Secondary highlight — deeper parallax */}
          <div
            className="absolute bottom-[14%] right-[18%] h-[16%] w-[16%] rounded-full blur-sm opacity-60"
            style={{
              background:
                'radial-gradient(circle, rgba(253,230,138,0.75) 0%, transparent 70%)',
              transform: `translateZ(10px) translateX(${tilt.ry * 0.15}px) translateY(${-tilt.rx * 0.15}px)`,
              transition: 'transform 0.15s ease-out',
            }}
          />

          {/* Inner glow ring — front depth */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, transparent 85%, rgba(251,191,36,0.35) 94%, transparent 100%)',
              transform: 'translateZ(5px)',
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

          {/* Rim light — front layer */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, transparent 87%, rgba(255,215,128,0.3) 95%, transparent 100%)',
              transform: 'translateZ(8px)',
            }}
          />
        </div>

        {/* Specular reflection — top layer for glassy 3D feel */}
        <div
          className="pointer-events-none absolute left-[22%] top-[16%] h-[22%] w-[28%] rounded-full opacity-70"
          style={{
            background:
              'radial-gradient(ellipse, rgba(255,255,255,0.6) 0%, transparent 70%)',
            filter: 'blur(4px)',
            transform: `translateZ(35px) translateX(${tilt.ry * 0.5}px) translateY(${-tilt.rx * 0.5}px)`,
            transition: 'transform 0.15s ease-out',
          }}
        />
      </div>

      {/* Orbiting sparkles outside orb */}
      {sparkles.slice(0, 5).map((s) => (
        <span
          key={`orbit-${s.id}`}
          className="pointer-events-none absolute rounded-full bg-zion-gold"
          style={{
            left: `${40 + s.x * 0.2}%`,
            top: `${40 + s.y * 0.2}%`,
            width: '2.5px',
            height: '2.5px',
            boxShadow: '0 0 8px rgba(251,191,36,0.9)',
            animation: `sparkle-float ${5 + s.delay}s ease-in-out ${s.delay}s infinite`,
            opacity: hovered ? 0.85 : 0.45,
            transition: 'opacity 0.4s',
          }}
        />
      ))}

      <style>{`
        @keyframes sparkle-float {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
          25% { transform: translate(5px, -7px) scale(1.4); opacity: 0.9; }
          50% { transform: translate(-3px, -12px) scale(0.8); opacity: 0.6; }
          75% { transform: translate(-6px, 3px) scale(1.2); opacity: 0.8; }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
