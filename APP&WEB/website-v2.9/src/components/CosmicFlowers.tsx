'use client';

import { motion } from 'framer-motion';

/* ─── Single lotus petal (teardrop shape) ─── */
function Petal({
  angle,
  radius,
  color,
  delay = 0,
  size = 1,
}: {
  angle: number;
  radius: number;
  color: string;
  delay?: number;
  size?: number;
}) {
  const rad = (angle * Math.PI) / 180;
  const cx = Math.cos(rad) * radius;
  const cy = Math.sin(rad) * radius;

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.2, delay, ease: 'easeOut' }}
    >
      <motion.ellipse
        cx={cx}
        cy={cy}
        rx={10 * size}
        ry={26 * size}
        transform={`rotate(${angle + 90}, ${cx}, ${cy})`}
        fill={color}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
        animate={{
          scale: [1, 1.08, 1],
          opacity: [0.55, 0.85, 0.55],
        }}
        transition={{
          duration: 4 + delay * 0.5,
          repeat: Infinity,
          ease: 'easeInOut',
          delay,
        }}
      />
    </motion.g>
  );
}

/* ─── One complete radial flower ─── */
function CosmicFlower({
  x,
  y,
  petalCount = 8,
  radius = 44,
  colors,
  rotationSpeed = 24,
  size = 1,
  initialAngle = 0,
}: {
  x: number;
  y: number;
  petalCount?: number;
  radius?: number;
  colors: string[];
  rotationSpeed?: number;
  size?: number;
  initialAngle?: number;
}) {
  const petals = Array.from({ length: petalCount }, (_, i) => i);

  return (
    <motion.g
      style={{ transformOrigin: `${x}px ${y}px` }}
      animate={{ rotate: 360 }}
      transition={{ duration: rotationSpeed, repeat: Infinity, ease: 'linear' }}
    >
      <g transform={`translate(${x}, ${y}) rotate(${initialAngle})`}>
        {petals.map((i) => (
          <Petal
            key={i}
            angle={(i * 360) / petalCount}
            radius={radius}
            color={colors[i % colors.length]}
            delay={i * 0.12}
            size={size}
          />
        ))}
        {/* inner petal ring */}
        {petals.map((i) => (
          <Petal
            key={`inner-${i}`}
            angle={(i * 360) / petalCount + 360 / (petalCount * 2)}
            radius={radius * 0.55}
            color={colors[(i + 1) % colors.length]}
            delay={i * 0.08 + 0.3}
            size={size * 0.6}
          />
        ))}
        {/* center glow */}
        <motion.circle
          r={10 * size}
          fill={colors[0]}
          opacity={0.6}
          animate={{ r: [10 * size, 14 * size, 10 * size], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </g>
    </motion.g>
  );
}

/* ─── Full background canvas ─── */
export default function CosmicFlowers({ className = '' }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none select-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 1440 900"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full opacity-40"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="glowA" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(147,51,234,0.6)" />
            <stop offset="100%" stopColor="rgba(147,51,234,0)" />
          </radialGradient>
          <radialGradient id="glowB" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(6,182,212,0.6)" />
            <stop offset="100%" stopColor="rgba(6,182,212,0)" />
          </radialGradient>
          <radialGradient id="glowC" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,215,0,0.55)" />
            <stop offset="100%" stopColor="rgba(255,215,0,0)" />
          </radialGradient>
          <filter id="blur-soft">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        {/* soft ambient halos */}
        <motion.ellipse
          cx={200} cy={250} rx={300} ry={300}
          fill="url(#glowA)"
          animate={{ cx: [200, 240, 200], cy: [250, 220, 250] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          filter="url(#blur-soft)"
        />
        <motion.ellipse
          cx={1200} cy={600} rx={280} ry={280}
          fill="url(#glowB)"
          animate={{ cx: [1200, 1160, 1200], cy: [600, 640, 600] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          filter="url(#blur-soft)"
        />
        <motion.ellipse
          cx={720} cy={80} rx={180} ry={180}
          fill="url(#glowC)"
          animate={{ cy: [80, 110, 80] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          filter="url(#blur-soft)"
        />

        {/* BIG hero flower — top-left */}
        <CosmicFlower
          x={180}
          y={280}
          petalCount={12}
          radius={68}
          size={1.15}
          rotationSpeed={40}
          initialAngle={15}
          colors={[
            'rgba(147,51,234,0.55)',
            'rgba(168,85,247,0.45)',
            'rgba(129,0,255,0.40)',
            'rgba(196,128,255,0.35)',
          ]}
        />

        {/* medium flower — top-right */}
        <CosmicFlower
          x={1280}
          y={180}
          petalCount={8}
          radius={52}
          size={0.9}
          rotationSpeed={30}
          initialAngle={0}
          colors={[
            'rgba(6,182,212,0.55)',
            'rgba(34,211,238,0.45)',
            'rgba(0,230,255,0.40)',
          ]}
        />

        {/* accent flower — bottom-right */}
        <CosmicFlower
          x={1340}
          y={680}
          petalCount={6}
          radius={42}
          size={0.75}
          rotationSpeed={20}
          initialAngle={30}
          colors={[
            'rgba(255,215,0,0.5)',
            'rgba(249,168,38,0.4)',
            'rgba(251,191,36,0.35)',
          ]}
        />

        {/* small flower — centre bottom */}
        <CosmicFlower
          x={760}
          y={840}
          petalCount={10}
          radius={36}
          size={0.65}
          rotationSpeed={50}
          initialAngle={18}
          colors={[
            'rgba(147,51,234,0.4)',
            'rgba(6,182,212,0.4)',
            'rgba(255,215,0,0.3)',
          ]}
        />

        {/* tiny accent — mid-left */}
        <CosmicFlower
          x={60}
          y={600}
          petalCount={6}
          radius={28}
          size={0.55}
          rotationSpeed={16}
          initialAngle={0}
          colors={[
            'rgba(6,182,212,0.45)',
            'rgba(147,51,234,0.35)',
          ]}
        />

        {/* top center connector flower */}
        <CosmicFlower
          x={720}
          y={60}
          petalCount={8}
          radius={34}
          size={0.6}
          rotationSpeed={35}
          initialAngle={22}
          colors={[
            'rgba(255,215,0,0.45)',
            'rgba(147,51,234,0.35)',
            'rgba(6,182,212,0.3)',
          ]}
        />
      </svg>
    </div>
  );
}
