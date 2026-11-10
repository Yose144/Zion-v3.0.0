'use client';

/**
 * VENUŠE — model závodního vozu + jeho překreslové efekty.
 *
 * Sdílí ho sólový i multiplayerový závod (dřív byly boxy opsané dvakrát).
 * Karoserie je **extrudovaný bokorys** — jeden `ExtrudeGeometry` dává
 * supersportový klín místo hromady krabic.
 *
 * Rodič ovládá detaily přes `fx` (volitelné): barva brzdových světel,
 * viditelnost/škála nitro plamenů a jas podvozkového světla se animují
 * v `useFrame` — React state by na to byl zbytečně drahý.
 *
 * `CraftSmoke` je **světový** particle systém (ne child vozu): kouř jednou
 * emitnutý zůstává na místě ve světě, zatímco vůz se točí — child by se
 * s ním točil taky a kouř by "létal" za vozem do stran.
 */

import { useMemo, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Craft } from './physics';

/** Efekty, které si rodič может animovat Each frame. */
export interface CraftFx {
  /** Materiál brzdového pásma — zesílí se při brzdění. */
  brake: THREE.MeshBasicMaterial | null;
  /** Skupina s dvěma trysekami nitra — `visible` + `scale` řídí rodič. */
  flames: THREE.Group | null;
  /** Bodové světlo podvozku — jas se zvedá při nitru. */
  glow: THREE.PointLight | null;
}

export function emptyCraftFx(): CraftFx {
  return { brake: null, flames: null, glow: null };
}

const HULL = '#ffd166';
const ACCENT = '#ff9a3c';
const GLASS = '#0d0a16';
const TYRE = '#14101c';

/** Bokorys vozu: x = délka (−1.9 ocas … +1.9 čumák), y = výška. */
function hullGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(-1.9, 0.12);
  s.lineTo(1.9, 0.12);
  s.lineTo(1.9, 0.32); // nízký čumák
  s.lineTo(0.85, 0.58); // čelní sklo
  s.lineTo(-0.45, 0.74); // střecha
  s.lineTo(-1.55, 0.64); // zadní kapota
  s.lineTo(-1.9, 0.5); // ocas
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 1.5, bevelEnabled: false });
  geo.translate(0, 0, -0.75); // šířka na střed
  geo.rotateY(-Math.PI / 2); // délka x→z, čumák na +z, šířka na x
  return geo;
}

export function CraftMesh({
  body = HULL,
  accent = ACCENT,
  canopy = GLASS,
  fx,
}: {
  body?: string;
  accent?: string;
  canopy?: string;
  /** Volitelná schránka na materiály/skupiny pro animaci — viz `CraftFx`. */
  fx?: CraftFx;
}) {
  const hull = useMemo(hullGeometry, []);

  return (
    <group>
      {/* karoserie — lak */}
      <mesh geometry={hull}>
        <meshStandardMaterial color={body} metalness={0.72} roughness={0.26} />
      </mesh>

      {/* kabina — lesklé sklo */}
      <mesh position={[0, 0.72, -0.28]}>
        <boxGeometry args={[0.92, 0.3, 1.45]} />
        <meshStandardMaterial color={canopy} metalness={0.9} roughness={0.1} />
      </mesh>

      {/* kola — 4× válec s osou přes x */}
      {[
        [-0.84, 1.18],
        [0.84, 1.18],
        [-0.84, -1.18],
        [0.84, -1.18],
      ].map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, 0.36, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.37, 0.37, 0.34, 14]} />
          <meshStandardMaterial color={TYRE} metalness={0.25} roughness={0.9} />
        </mesh>
      ))}

      {/* spoiler + vzpěry */}
      <mesh position={[0, 1.0, -1.72]} rotation={[-0.18, 0, 0]}>
        <boxGeometry args={[1.75, 0.07, 0.5]} />
        <meshStandardMaterial color={accent} metalness={0.6} roughness={0.35} />
      </mesh>
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, 0.84, -1.72]}>
          <boxGeometry args={[0.09, 0.34, 0.12]} />
          <meshStandardMaterial color={accent} metalness={0.6} roughness={0.35} />
        </mesh>
      ))}

      {/* splitter a boční sukně */}
      <mesh position={[0, 0.09, 1.95]}>
        <boxGeometry args={[1.7, 0.07, 0.5]} />
        <meshStandardMaterial color={accent} metalness={0.6} roughness={0.35} />
      </mesh>
      {[-0.92, 0.92].map((x) => (
        <mesh key={x} position={[x, 0.16, 0]}>
          <boxGeometry args={[0.12, 0.15, 2.7]} />
          <meshStandardMaterial color={accent} metalness={0.6} roughness={0.35} />
        </mesh>
      ))}

      {/* podvozkové neon — přidá underglow lesk */}
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.3, 4.1]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* brzdové světlo — jas řídí `fx.brake` */}
      <mesh position={[0, 0.52, -1.93]}>
        <boxGeometry args={[1.3, 0.1, 0.07]} />
        <meshBasicMaterial
          ref={(m) => {
            if (fx) fx.brake = m;
          }}
          color="#ff3040"
          transparent
          opacity={0.4}
          toneMapped={false}
        />
      </mesh>

      {/* mlhovky vpředu */}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.33, 1.93]}>
          <boxGeometry args={[0.3, 0.08, 0.06]} />
          <meshBasicMaterial color="#ffe9b0" transparent opacity={0.85} toneMapped={false} />
        </mesh>
      ))}

      {/* trysky nitra — `fx.flames` groups, rodič škáluje */}
      <group
        ref={(g) => {
          if (fx) fx.flames = g;
        }}
        position={[0, 0.34, -2.02]}
        visible={false}
      >
        {[-0.42, 0.42].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.15, 0.85, 10]} />
            <meshBasicMaterial
              color="#66d9ff"
              transparent
              opacity={0.85}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      {/* podvozkové světlo — `fx.glow` zvedá při nitru */}
      <pointLight
        ref={(l) => {
          if (fx) fx.glow = l;
        }}
        position={[0, 0.2, 0]}
        intensity={1.6}
        color={accent}
        distance={5.5}
        decay={2}
      />
    </group>
  );
}

// ── driftový kouř ────────────────────────────────────────────────────────

const SMOKE_COUNT = 140;
/** Barva prachu Venuše — kouř je šedohnědý, ne černý ( planeta je písková ). */
const SMOKE_RGB: [number, number, number] = [0.62, 0.5, 0.38];

/**
 * Kouř za koly při driftu. `level` je 0..1 (řídí rodič z `CraftStep.slide`);
 * `craft` dává pozici a směr pro **světové** emise. Když `active` je false,
 * nic se nespawnuje (mrznoucí `level` po zastavení závodu by jinak dýchal
 * donekonečna).
 */
export function CraftSmoke({
  craft,
  level,
  active = true,
}: {
  craft: MutableRefObject<Craft>;
  level: MutableRefObject<number>;
  active?: boolean;
}) {
  const sim = useMemo(
    () => ({
      pos: new Float32Array(SMOKE_COUNT * 3),
      col: new Float32Array(SMOKE_COUNT * 3),
      vel: new Float32Array(SMOKE_COUNT * 3),
      life: new Float32Array(SMOKE_COUNT),
      max: new Float32Array(SMOKE_COUNT),
      cursor: 0,
      acc: 0,
    }),
    [],
  );

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(sim.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(sim.col, 3));
    return g;
  }, [sim]);

  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta);
    const car = craft.current;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const rx = Math.cos(car.heading);
    const rz = -Math.sin(car.heading);

    // ── spawn ──
    const amount = active ? Math.min(1, Math.max(0, level.current)) : 0;
    sim.acc += amount * 120 * dt;
    let spawn = Math.floor(sim.acc);
    sim.acc -= spawn;
    while (spawn-- > 0) {
      const i = sim.cursor;
      sim.cursor = (sim.cursor + 1) % SMOKE_COUNT;
      const side = i % 2 === 0 ? 1 : -1;
      // zadní kola ve světových souřadnicích
      sim.pos[i * 3] = car.x + rx * side * 0.78 + fx * -1.55;
      sim.pos[i * 3 + 1] = 0.18 + Math.random() * 0.12;
      sim.pos[i * 3 + 2] = car.z + rz * side * 0.78 + fz * -1.55;
      // unáší se dozadu (proti směru jízdy) + turbulence
      const back = 2.4 + Math.random() * 2.6;
      sim.vel[i * 3] = -fx * back + rx * side * (Math.random() - 0.5) * 1.8;
      sim.vel[i * 3 + 1] = 0.9 + Math.random() * 1.3;
      sim.vel[i * 3 + 2] = -fz * back + rz * side * (Math.random() - 0.5) * 1.8;
      sim.life[i] = sim.max[i] = 0.55 + Math.random() * 0.45;
    }

    // ── stárnutí + fade (barva → černá = neviditelná na tmavém pozadí) ──
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < SMOKE_COUNT; i++) {
      if (sim.life[i]! <= 0) {
        sim.col[i * 3] = sim.col[i * 3 + 1] = sim.col[i * 3 + 2] = 0;
        continue;
      }
      sim.life[i]! -= dt;
      const drag = Math.max(0, 1 - 2.4 * dt);
      sim.vel[i * 3]! *= drag;
      sim.vel[i * 3 + 1]! *= drag;
      sim.vel[i * 3 + 2]! *= drag;
      sim.pos[i * 3]! += sim.vel[i * 3]! * dt;
      sim.pos[i * 3 + 1]! += sim.vel[i * 3 + 1]! * dt;
      sim.pos[i * 3 + 2]! += sim.vel[i * 3 + 2]! * dt;
      const t = Math.max(0, sim.life[i]! / sim.max[i]!);
      const fade = 0.5 * t * t;
      sim.col[i * 3] = SMOKE_RGB[0] * fade;
      sim.col[i * 3 + 1] = SMOKE_RGB[1] * fade;
      sim.col[i * 3 + 2] = SMOKE_RGB[2] * fade;
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.85}
        vertexColors
        transparent
        opacity={0.9}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
