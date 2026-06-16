'use client';

function Petal({
  angle,
  radius,
  color,
  size = 1,
}: {
  angle: number;
  radius: number;
  color: string;
  size?: number;
}) {
  const rad = (angle * Math.PI) / 180;
  const cx = Math.cos(rad) * radius;
  const cy = Math.sin(rad) * radius;

  return (
    <ellipse
      cx={cx}
      cy={cy}
      rx={10 * size}
      ry={26 * size}
      transform={`rotate(${angle + 90}, ${cx}, ${cy})`}
      fill={color}
      opacity={0.72}
    />
  );
}

function CosmicFlower({
  x,
  y,
  petalCount = 8,
  radius = 44,
  colors,
  size = 1,
  initialAngle = 0,
}: {
  x: number;
  y: number;
  petalCount?: number;
  radius?: number;
  colors: string[];
  size?: number;
  initialAngle?: number;
}) {
  const petals = Array.from({ length: petalCount }, (_, index) => index);

  return (
    <g>
      <g transform={`translate(${x}, ${y}) rotate(${initialAngle})`}>
        {petals.map((index) => (
          <Petal
            key={index}
            angle={(index * 360) / petalCount}
            radius={radius}
            color={colors[index % colors.length]}
            size={size}
          />
        ))}
        {petals.map((index) => (
          <Petal
            key={`inner-${index}`}
            angle={(index * 360) / petalCount + 360 / (petalCount * 2)}
            radius={radius * 0.55}
            color={colors[(index + 1) % colors.length]}
            size={size * 0.6}
          />
        ))}
        <circle r={10 * size} fill={colors[0]} opacity={0.6} />
      </g>
    </g>
  );
}

export default function CosmicFlowers({ className = '' }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 1440 900"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full opacity-30"
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

        <ellipse cx={200} cy={250} rx={300} ry={300} fill="url(#glowA)" filter="url(#blur-soft)" />
        <ellipse cx={1200} cy={600} rx={280} ry={280} fill="url(#glowB)" filter="url(#blur-soft)" />
        <ellipse cx={720} cy={80} rx={180} ry={180} fill="url(#glowC)" filter="url(#blur-soft)" />

        <CosmicFlower
          x={180}
          y={280}
          petalCount={10}
          radius={64}
          size={1.05}
          initialAngle={15}
          colors={[
            'rgba(147,51,234,0.55)',
            'rgba(168,85,247,0.45)',
            'rgba(129,0,255,0.40)',
            'rgba(196,128,255,0.35)',
          ]}
        />

        <CosmicFlower
          x={1280}
          y={180}
          petalCount={6}
          radius={48}
          size={0.82}
          initialAngle={0}
          colors={[
            'rgba(6,182,212,0.55)',
            'rgba(34,211,238,0.45)',
            'rgba(0,230,255,0.40)',
          ]}
        />

        <CosmicFlower
          x={1340}
          y={680}
          petalCount={6}
          radius={38}
          size={0.68}
          initialAngle={30}
          colors={[
            'rgba(255,215,0,0.5)',
            'rgba(249,168,38,0.4)',
            'rgba(251,191,36,0.35)',
          ]}
        />

        <circle cx={760} cy={840} r={36} fill="rgba(255,215,0,0.08)" />
        <circle cx={60} cy={600} r={24} fill="rgba(6,182,212,0.08)" />
        <circle cx={720} cy={60} r={28} fill="rgba(255,215,0,0.1)" />
      </svg>
    </div>
  );
}
