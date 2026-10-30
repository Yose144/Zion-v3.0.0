'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ═══ Galaktická geometrie ═══════════════════════════════════════════
   Reálná obloha: galaktická rovina je nakloněná ~63° k ekliptice →
   pás Mléčné dráhy kříží oblohu diagonálně. Procedurální prvky
   (emise, koncentrace hvězd) generujeme v galaktických souřadnicích
   (l = délka podél pásu, b = šířka) — sky sphere s reálnou texturou
   dostává STEJNÝ tilt, takže pás textury a kotvy sedí dohromady. */
const GT_X = 0.62;
const GT_Z = 1.05;
const CORE_L = -0.9;

function galactic(l: number, b: number, d: number): [number, number, number] {
  const cb = Math.cos(b);
  const x = cb * Math.cos(l) * d;
  const y = Math.sin(b) * d;
  const z = cb * Math.sin(l) * d;
  const cz = Math.cos(GT_Z);
  const sz = Math.sin(GT_Z);
  const cy = Math.cos(GT_X);
  const sy = Math.sin(GT_X);
  const nx = x * cz - y * sz;
  const ny = x * sz + y * cz;
  const ny2 = ny * cy - z * sy;
  const nz = ny * sy + z * cy;
  return [nx, ny2, nz];
}

const gauss = (sigma: number) => (Math.random() + Math.random() + Math.random() - 1.5) * 2 * sigma;

/** Měkký kruhový sprite — záře, prach, mlhoviny (canvas → texture). */
function useSoftSprite(): THREE.CanvasTexture {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.38)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);
}

/* ═══ Sky sphere — REÁLNÁ obloha ═════════════════════════════════════
   ESO 360° all-sky panorama (S. Brunier, CC BY 4.0) — skutečný pás
   Mléčné dráhy: jádro v Sagittarii, Great Rift, hvězdná mračna,
   Magellanovy mraky. Equirect mapovaná na sféru, nakloněná ~63°
   k ekliptice (stejný tilt jako galactic() → kotvy sedí na pásu).  */
const SKY_R = 1750;
const CORE_SPIN = 0.0; // posun pásu v galaktické délce (vyladěné vizuálně)

function SkySphere() {
  const ref = useRef<THREE.Mesh>(null);
  const [tex, setTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let alive = true;
    new THREE.TextureLoader().load('/textures/milkyway-eso-4k.jpg', (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      if (alive) setTex(t);
    });
    return () => {
      alive = false;
    };
  }, []);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.0006;
  });

  return (
    <group rotation={[GT_X, 0, GT_Z]}>
      <mesh ref={ref} rotation={[0, CORE_SPIN, 0]}>
        <sphereGeometry args={[SKY_R, 64, 48]} />
        {/* key → materiál se překlopí na USE_MAP až po načtení textury
            (jinak zkompilovaný shader bez mapy rendruje jen barvu = bílá) */}
        <meshBasicMaterial
          key={tex ? 'tex' : 'flat'}
          map={tex ?? undefined}
          color={tex ? '#ffffff' : '#0a0d18'}
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>
    </group>
  );
}

/* ═══ Vzdálené hvězdy — reálná distribuce barev spektrálních tříd.
   Nad texturou přidávají paralaxu a jiskru. ~30 % hvězd se drží
   blíž galaktické roviny (pás je hustší). ═══ */
function starShell(count: number, rMin: number, rMax: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    let x: number, y: number, z: number;
    const d = rMin + Math.random() * (rMax - rMin);
    if (Math.random() < 0.3) {
      const l = Math.random() * Math.PI * 2;
      const b = gauss(0.28);
      [x, y, z] = galactic(l, b, d);
    } else {
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      x = s * Math.cos(theta) * d;
      y = u * d;
      z = s * Math.sin(theta) * d;
    }
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    const roll = Math.random();
    if (roll < 0.42) c.set('#e8f0ff'); // bílo-modré B/A
    else if (roll < 0.62) c.set('#ffffff'); // bílé
    else if (roll < 0.78) c.set('#fff3d6'); // teple bílé F/G
    else if (roll < 0.9) c.set('#ffe08a'); // žluté G/K
    else if (roll < 0.97) c.set('#ffb27a'); // oranžové K
    else c.set('#ff8a7a'); // červené M/obra
    const dim = 0.45 + Math.random() * 0.6;
    colors[i * 3] = c.r * dim;
    colors[i * 3 + 1] = c.g * dim;
    colors[i * 3 + 2] = c.b * dim;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function FarStars() {
  const faint = useMemo(() => starShell(2800, 1150, 1600), []);
  const bright = useMemo(() => starShell(420, 1100, 1450), []);
  return (
    <>
      <points geometry={faint}>
        <pointsMaterial size={1.6} transparent opacity={0.55} sizeAttenuation depthWrite={false} vertexColors blending={THREE.AdditiveBlending} />
      </points>
      <points geometry={bright}>
        <pointsMaterial size={3.4} transparent opacity={0.9} sizeAttenuation depthWrite={false} vertexColors blending={THREE.AdditiveBlending} />
      </points>
    </>
  );
}

/* ═══ Emisní skvrny v galaktickém pásu — růžové/azurové hvězdotvorby.
   Kotvené v galaktických souřadnicích → sedí na pásu textury. ═══ */
function EmissionNebulae() {
  const sprite = useSoftSprite();
  const geo = useMemo(() => {
    const spots: [string, number, number][] = [
      ['#ff6fa5', CORE_L + 0.32, 0.02],
      ['#7ee0ff', CORE_L + 1.62, -0.04],
      ['#ff8fb8', CORE_L - 0.18, 0.06],
      ['#ffa06e', CORE_L - 0.5, -0.03],
      ['#b48cff', CORE_L + 0.95, 0.08],
      ['#ff7f9e', CORE_L + 1.28, 0.0],
      ['#8fd8ff', CORE_L - 0.85, -0.06],
      ['#ffe08a', CORE_L + 2.1, 0.04],
    ];
    const positions: number[] = [];
    const colors: number[] = [];
    const c = new THREE.Color();
    for (const [hex, l, b] of spots) {
      for (let i = 0; i < 22; i++) {
        const [x, y, z] = galactic(l + gauss(0.02), b + gauss(0.016), 1000 + Math.random() * 320);
        positions.push(x, y, z);
        c.set(hex);
        const dim = 0.5 + Math.random() * 0.5;
        colors.push(c.r * dim, c.g * dim, c.b * dim);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    return g;
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial
        map={sprite}
        vertexColors
        size={24}
        transparent
        opacity={0.42}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ═══ Jasné hvězdy — Sirius, Rigel, Betelgeuse… reálné barvy, puls. ═══ */
type BrightStar = {
  name: string;
  color: string;
  radius: number;
  distance: number;
  theta: number;
  phi: number;
  pulseSpeed: number;
};

const BRIGHT_STARS: BrightStar[] = [
  { name: 'Sirius', color: '#cddaff', radius: 1.1, distance: 500, theta: 0.9, phi: 1.35, pulseSpeed: 2.1 },
  { name: 'Rigel', color: '#b9d4ff', radius: 1.3, distance: 580, theta: 2.4, phi: 1.15, pulseSpeed: 1.7 },
  { name: 'Arcturus', color: '#ffb35c', radius: 1.5, distance: 460, theta: 4.2, phi: 1.05, pulseSpeed: 1.3 },
  { name: 'Vega', color: '#d5e6ff', radius: 1.2, distance: 530, theta: 5.8, phi: 0.95, pulseSpeed: 1.9 },
  { name: 'Betelgeuse', color: '#ff9c5a', radius: 1.8, distance: 430, theta: 1.6, phi: 0.85, pulseSpeed: 0.8 },
  { name: 'Antares', color: '#ff6b4a', radius: 1.3, distance: 600, theta: 3.3, phi: 1.45, pulseSpeed: 1.1 },
  { name: 'Altair', color: '#e8f1ff', radius: 1.0, distance: 480, theta: 0.3, phi: 1.2, pulseSpeed: 2.4 },
  { name: 'Spica', color: '#b9c9ff', radius: 1.1, distance: 550, theta: 4.9, phi: 0.75, pulseSpeed: 1.5 },
  { name: 'Deneb', color: '#e6edff', radius: 1.2, distance: 620, theta: 5.1, phi: 0.65, pulseSpeed: 1.2 },
  { name: 'Pollux', color: '#ffc98a', radius: 1.3, distance: 420, theta: 2.9, phi: 1.55, pulseSpeed: 1.0 },
  { name: 'Canopus', color: '#f4e8c9', radius: 1.3, distance: 560, theta: 3.9, phi: 1.25, pulseSpeed: 0.9 },
  { name: 'Aldebaran', color: '#ffa06e', radius: 1.3, distance: 470, theta: 1.9, phi: 1.4, pulseSpeed: 1.4 },
];

function BrightStars() {
  const core = useRef<THREE.InstancedMesh>(null);
  const glow1 = useRef<THREE.InstancedMesh>(null);
  const glow2 = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const stars = useMemo(
    () =>
      BRIGHT_STARS.map((s) => ({
        ...s,
        pos: [
          s.distance * Math.sin(s.phi) * Math.cos(s.theta),
          s.distance * Math.cos(s.phi),
          s.distance * Math.sin(s.phi) * Math.sin(s.theta),
        ] as [number, number, number],
        color: new THREE.Color(s.color),
      })),
    [],
  );

  const setStar = (m: THREE.InstancedMesh, i: number, scale: number) => {
    const s = stars[i];
    dummy.position.set(s.pos[0], s.pos[1], s.pos[2]);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
  };

  useLayoutEffect(() => {
    const meshes = [core.current, glow1.current, glow2.current];
    if (meshes.some((m) => !m)) return;
    stars.forEach((s, i) => {
      setStar(core.current!, i, s.radius);
      setStar(glow1.current!, i, s.radius * 3);
      setStar(glow2.current!, i, s.radius * 7);
      for (const m of meshes) m!.setColorAt(i, s.color);
    });
    for (const m of meshes) {
      m!.instanceMatrix.needsUpdate = true;
      if (m!.instanceColor) m!.instanceColor.needsUpdate = true;
    }
  }, [stars, dummy]);

  useFrame(({ clock }) => {
    if (!core.current || !glow1.current || !glow2.current) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const pulse = Math.sin(t * s.pulseSpeed) * 0.25 + 0.8;
      setStar(core.current, i, s.radius * pulse);
      setStar(glow1.current, i, s.radius * 3 * pulse);
      setStar(glow2.current, i, s.radius * 7 * pulse);
    }
    core.current.instanceMatrix.needsUpdate = true;
    glow1.current.instanceMatrix.needsUpdate = true;
    glow2.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={core} args={[undefined, undefined, stars.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial />
      </instancedMesh>
      <instancedMesh ref={glow1} args={[undefined, undefined, stars.length]} frustumCulled={false} raycast={() => null}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
      <instancedMesh ref={glow2} args={[undefined, undefined, stars.length]} frustumCulled={false} raycast={() => null}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    </>
  );
}

/* ═══ Větší mlhoviny — měkké objemy podél galaktického pásu. ═══ */
function Nebula() {
  const groupRef = useRef<THREE.Group>(null);
  const clouds = useMemo(() => {
    const defs: [number, number, number, [number, number, number], string, number][] = [
      [CORE_L + 1.4, 0.12, 1050, [130, 60, 75], '#7a3cff', 0.05],
      [CORE_L + 0.55, -0.1, 1030, [95, 48, 62], '#e41e7f', 0.045],
      [CORE_L - 0.75, 0.15, 1080, [82, 42, 58], '#4a7fff', 0.042],
      [CORE_L + 2.7, -0.06, 1120, [105, 52, 66], '#2a9d8f', 0.036],
      [CORE_L - 1.7, 0.32, 1180, [88, 44, 60], '#c084fc', 0.04],
      [CORE_L + 4.5, -0.14, 1140, [98, 50, 62], '#3b82f6', 0.028],
    ];
    return defs.map(([l, b, d, scale, color, opacity]) => ({
      pos: galactic(l, b, d),
      scale,
      color,
      opacity,
    }));
  }, []);
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      const dir = i % 2 === 0 ? 1 : -1;
      child.rotation.y += delta * 0.006 * dir;
      child.rotation.x += delta * 0.003 * dir;
    });
  });
  return (
    <group ref={groupRef}>
      {clouds.map((c, i) => (
        <mesh key={i} position={c.pos} scale={c.scale}>
          <sphereGeometry args={[1, 18, 18]} />
          <meshBasicMaterial color={c.color} transparent opacity={c.opacity} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
        </mesh>
      ))}
    </group>
  );
}

/** Pozadí vesmíru — reálná obloha ESO + paralaxní hvězdné pole,
 *  pojmenované hvězdy, emisní skvrny a mlhoviny v galaktickém pásu. */
export function SpaceBackdrop() {
  return (
    <>
      <SkySphere />
      <FarStars />
      <EmissionNebulae />
      <BrightStars />
      <Nebula />
    </>
  );
}
