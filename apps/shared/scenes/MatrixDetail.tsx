/** @jsxRuntime classic */
'use client';

import { React, useFrame, THREE } from '@genesis/runtime';

import { motionTime } from './ScenePresentation';

type Lang = 'cs' | 'en';

type PointerEventLike = { stopPropagation: () => void };

/**
 * Detaily lunární základny MATRIX (Shackleton).
 *
 * Vše je generované procedurálně z pevných seedů, aby scéna zůstala
 * deterministická a neměnila se mezi rendery. Textury i geometrie se uvolňují
 * při výměně, takže opakované překreslení nezvyšuje počet GPU objektů.
 */

function seeded(seed: number) {
  let value = seed;
  return () => (value = (value * 16807) % 2147483647) / 2147483647;
}

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void, repeat = 1) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  return texture;
}

/** Regolit — jemný prach, kamínky a tmavší skvrny. */
function regolithDraw(ctx: CanvasRenderingContext2D, size: number) {
  const rnd = seeded(4242);
  ctx.fillStyle = '#948d81';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2400; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 0.6 + rnd() * 2.6;
    ctx.fillStyle = rnd() > 0.55
      ? `rgba(255,252,244,${0.04 + rnd() * 0.14})`
      : `rgba(44,40,34,${0.04 + rnd() * 0.18})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 190; i++) {
    ctx.fillStyle = `rgba(232,228,218,${0.12 + rnd() * 0.18})`;
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, 1.2 + rnd() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Kovový plášť modulu — panelové spáry a nýty. */
function hullDraw(ctx: CanvasRenderingContext2D, size: number) {
  const rnd = seeded(1717);
  ctx.fillStyle = '#d3cdc1';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,250' : '90,86,78'},${0.02 + rnd() * 0.06})`;
    ctx.fillRect(rnd() * size, rnd() * size, 2 + rnd() * 4, 2 + rnd() * 4);
  }
  const cells = 4;
  const step = size / cells;
  ctx.strokeStyle = 'rgba(82,78,70,0.5)';
  ctx.lineWidth = 2.4;
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(70,66,58,0.55)';
  for (let i = 0; i <= cells; i++) {
    for (let j = 0; j <= cells; j++) {
      ctx.beginPath(); ctx.arc(i * step, j * step, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }
}

/** Solární článek — tmavě modrá mřížka. */
function solarDraw(ctx: CanvasRenderingContext2D, size: number) {
  ctx.fillStyle = '#0e1d33';
  ctx.fillRect(0, 0, size, size);
  const cols = 6;
  const rows = 4;
  const w = size / cols;
  const h = size / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const gradient = ctx.createLinearGradient(i * w, j * h, (i + 1) * w, (j + 1) * h);
      gradient.addColorStop(0, 'rgba(52,104,178,0.95)');
      gradient.addColorStop(1, 'rgba(14,38,74,0.95)');
      ctx.fillStyle = gradient;
      ctx.fillRect(i * w + 2, j * h + 2, w - 4, h - 4);
    }
  }
  ctx.strokeStyle = 'rgba(160,200,255,0.35)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i <= cols; i++) { ctx.beginPath(); ctx.moveTo(i * w, 0); ctx.lineTo(i * w, size); ctx.stroke(); }
  for (let j = 0; j <= rows; j++) { ctx.beginPath(); ctx.moveTo(0, j * h); ctx.lineTo(size, j * h); ctx.stroke(); }
}

/** Země — oceán, pevnina a oblačnost. */
function earthDraw(ctx: CanvasRenderingContext2D, size: number) {
  const rnd = seeded(3110);
  const ocean = ctx.createLinearGradient(0, 0, size, size);
  ocean.addColorStop(0, '#1d4f8a');
  ocean.addColorStop(0.55, '#2f76bf');
  ocean.addColorStop(1, '#173e6d');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * size;
    const y = size * 0.18 + rnd() * size * 0.64;
    const r = 14 + rnd() * 46;
    ctx.fillStyle = rnd() > 0.45 ? 'rgba(74,116,62,0.85)' : 'rgba(126,116,74,0.8)';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.5 + rnd() * 0.6), rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.16 + rnd() * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(rnd() * size, rnd() * size, 8 + rnd() * 40, 5 + rnd() * 18, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // polární čepičky
  ctx.fillStyle = 'rgba(240,248,255,0.85)';
  ctx.fillRect(0, 0, size, size * 0.07);
  ctx.fillRect(0, size * 0.93, size, size * 0.07);
}

/** Radiální záře (slunce, setkání) — jedna textura pro sprity. */
function glowDraw(ctx: CanvasRenderingContext2D, size: number) {
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,250,232,0.85)');
  gradient.addColorStop(0.5, 'rgba(255,236,196,0.22)');
  gradient.addColorStop(1, 'rgba(255,220,180,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
}

/** Solární články pro panely. */
export function useSolarTexture() {
  const texture = React.useMemo(() => canvasTexture(256, solarDraw), []);
  React.useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

/** Sdílená textura pláště pro všechny moduly základny. */
export function useHullTexture() {
  const texture = React.useMemo(() => canvasTexture(256, hullDraw, 2), []);
  React.useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

/** Podlaha haly — tmavé panely se spárami. */
function hallFloorDraw(ctx: CanvasRenderingContext2D, size: number) {
  const rnd = seeded(6161);
  ctx.fillStyle = '#1b1f27';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${rnd() > 0.5 ? '150,170,180' : '8,10,14'},${0.02 + rnd() * 0.05})`;
    ctx.fillRect(rnd() * size, rnd() * size, 3 + rnd() * 6, 3 + rnd() * 6);
  }
  ctx.strokeStyle = 'rgba(122,146,158,0.16)';
  ctx.lineWidth = 3;
  const step = size / 4;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); ctx.stroke();
  }
}

export function useHallFloorTexture() {
  const texture = React.useMemo(() => {
    const next = canvasTexture(256, hallFloorDraw);
    if (next) next.repeat.set(2, 4);
    return next;
  }, []);
  React.useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

/** Měkká záře (setkání v hale). */
export function GlowSprite({ position, scale = 4, color = '#d6ffe8', opacity = 0.4 }: {
  position: [number, number, number];
  scale?: number;
  color?: string;
  opacity?: number;
}) {
  const texture = React.useMemo(() => canvasTexture(256, glowDraw), []);
  React.useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return (
    <sprite position={position} scale={[scale, scale, 1]}>
      <spriteMaterial
        key={texture ? 'tex' : 'flat'}
        map={texture}
        color={color}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        opacity={opacity}
      />
    </sprite>
  );
}

export function SunGlow() {  const texture = React.useMemo(() => canvasTexture(256, glowDraw), []);
  React.useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return (
    <sprite position={[196, 152, 84]} scale={[62, 62, 1]}>
      <spriteMaterial key={texture ? 'tex' : 'flat'} map={texture} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.9} />
    </sprite>
  );
}

export function Starfield() {
  const geometry = React.useMemo(() => {
    const rnd = seeded(8909);
    const count = 620;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = rnd() * Math.PI * 2;
      const phi = Math.acos(2 * rnd() - 1);
      const radius = 200;
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      const warm = rnd();
      colors[i * 3] = 0.78 + warm * 0.22;
      colors[i * 3 + 1] = 0.8 + warm * 0.16;
      colors[i * 3 + 2] = 0.86 + (1 - warm) * 0.14;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);
  React.useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial size={0.62} sizeAttenuation vertexColors transparent opacity={0.92} depthWrite={false} />
    </points>
  );
}

export function EarthBall() {
  const texture = React.useMemo(() => canvasTexture(256, earthDraw), []);
  React.useEffect(() => () => texture?.dispose(), [texture]);
  const group = React.useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += Math.min(delta, 0.1) * 0.1;
  });
  return (
    <group ref={group} position={[-60, 8, -80]}>
      <mesh>
        <sphereGeometry args={[2.2, 32, 24]} />
        <meshStandardMaterial key={texture ? 'tex' : 'flat'} map={texture ?? undefined} color={texture ? '#ffffff' : '#3d7ec8'} roughness={0.62} metalness={0.04} emissive="#0d2b4f" emissiveIntensity={0.35} />
      </mesh>
      <mesh scale={1.14}>
        <sphereGeometry args={[2.2, 20, 14]} />
        <meshBasicMaterial color="#9fd4ff" transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

/** Zvlněný lunární povrch — plošina pod základnou zůstává rovná. */
export function LunarGround() {
  const texture = React.useMemo(() => canvasTexture(512, regolithDraw, 7), []);
  const geometry = React.useMemo(() => {
    const geo = new THREE.CircleGeometry(30, 144);
    geo.rotateX(-Math.PI / 2);
    const position = geo.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const distance = Math.hypot(x, z);
      if (distance < 6.2) continue;
      const falloff = Math.min(1, (distance - 6.2) / 9);
      const relief = Math.sin(x * 0.21) * Math.cos(z * 0.18) * 0.42
        + Math.sin(x * 0.68 + z * 0.52) * 0.11
        + Math.cos(x * 1.7 - z * 1.3) * 0.03;
      position.setY(i, relief * falloff - 0.02);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);
  React.useEffect(() => () => { texture?.dispose(); geometry.dispose(); }, [texture, geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        key={texture ? 'tex' : 'flat'}
        map={texture ?? undefined}
        color={texture ? '#ffffff' : '#8a8378'}
        bumpMap={texture ?? undefined}
        bumpScale={0.035}
        roughness={1}
        metalness={0.02}
      />
    </mesh>
  );
}

/** Rozptýlené balvany kolem základny. */
export function Rocks() {
  const rocks = React.useMemo(() => {
    const rnd = seeded(9091);
    return Array.from({ length: 26 }, (_, index) => {
      const angle = rnd() * Math.PI * 2;
      const radius = 7.4 + rnd() * 15;
      return {
        key: index,
        position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number],
        scale: [0.32 + rnd() * 0.95, 0.22 + rnd() * 0.5, 0.32 + rnd() * 0.95] as [number, number, number],
        rotation: rnd() * Math.PI,
      };
    });
  }, []);
  return (
    <>
      {rocks.map((rock) => (
        <mesh key={rock.key} position={rock.position} rotation={[0, rock.rotation, 0]} scale={rock.scale} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#736c62" roughness={0.97} metalness={0.03} />
        </mesh>
      ))}
    </>
  );
}

/** Vyšlapaná stezka od modulů k přistávací ploše. */
export function Footprints() {
  const prints = React.useMemo(
    () =>
      Array.from({ length: 26 }, (_, index) => {
        const t = index / 26;
        const side = index % 2 === 0 ? -1 : 1;
        return {
          key: index,
          position: [0.2 + Math.sin(t * 2.6) * 0.4 + side * 0.17, 0.012, 1.5 + t * 4.4] as [number, number, number],
          rotation: side * 0.22,
        };
      }),
    [],
  );
  return (
    <>
      {prints.map((print) => (
        <mesh key={print.key} position={print.position} rotation={[-Math.PI / 2, 0, print.rotation]} scale={[0.1, 0.17, 1]}>
          <circleGeometry args={[1, 8]} />
          <meshStandardMaterial color="#5d5850" roughness={1} />
        </mesh>
      ))}
    </>
  );
}

/** Otočná parabolická anténa — jediný pohybující se prvek základny. */
export function Antenna({ position }: { position: [number, number, number] }) {
  const dish = React.useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (dish.current) dish.current.rotation.y = Math.sin(motionTime(clock) * 0.28) * 0.65;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 1, 8]} />
        <meshStandardMaterial color="#8d877c" metalness={0.45} roughness={0.5} />
      </mesh>
      <group ref={dish} position={[0, 1.05, 0]}>
        <mesh rotation={[0.7, 0, 0]} castShadow>
          <sphereGeometry args={[0.42, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
          <meshStandardMaterial color="#e4dfd3" roughness={0.35} metalness={0.3} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.36, 0.16]}>
          <cylinderGeometry args={[0.02, 0.02, 0.3, 6]} />
          <meshStandardMaterial color="#b9b3a7" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
    </group>
  );
}

/** Servisní rover u přistávací plochy. */
export function Rover({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const solar = React.useMemo(() => canvasTexture(128, solarDraw), []);
  React.useEffect(() => () => solar?.dispose(), [solar]);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.34, 0.85]} />
        <meshStandardMaterial color="#cfc9bd" roughness={0.55} metalness={0.35} />
      </mesh>
      <mesh position={[-0.1, 0.66, 0]} castShadow>
        <boxGeometry args={[0.85, 0.14, 0.62]} />
        <meshStandardMaterial key={solar ? 'tex' : 'flat'} map={solar ?? undefined} color={solar ? '#ffffff' : '#1c3f73'} roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[0.62, 0.72, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.42, 6]} />
        <meshStandardMaterial color="#a8a296" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0.62, 0.95, 0]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color="#d9e9ff" emissive="#1d4d7a" emissiveIntensity={0.5} roughness={0.3} />
      </mesh>
      {[-0.52, 0, 0.52].map((x) => (
        [-0.44, 0.44].map((z) => (
          <mesh key={`${x}:${z}`} position={[x, 0.22, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.14, 12]} />
            <meshStandardMaterial color="#4a463f" roughness={0.85} metalness={0.15} />
          </mesh>
        ))
      ))}
    </group>
  );
}

/** Odpadní radiátory modulu. */
export function Radiators({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[-0.28, 0.28].map((offset) => (
        <mesh key={offset} position={[0, 0.55, offset]} rotation={[0, 0, 0.08]} castShadow>
          <boxGeometry args={[0.06, 0.85, 0.5]} />
          <meshStandardMaterial color="#2b2c30" roughness={0.35} metalness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

/** Venkovní skříňka s přístroji. */
export function UtilityBox({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.56, 0.45]} />
        <meshStandardMaterial color="#b8b2a6" roughness={0.6} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.28, 0.24]}>
        <boxGeometry args={[0.44, 0.3, 0.02]} />
        <meshStandardMaterial color="#2c3138" roughness={0.4} metalness={0.4} emissive="#1f5f45" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

export type { Lang, PointerEventLike };
