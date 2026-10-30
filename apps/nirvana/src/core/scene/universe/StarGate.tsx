'use client';

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { TextLabel } from './Label';
import * as THREE from 'three';
import { GATE_POS } from './positions';
import type { Portal } from '@/core/portals/manifest';

const TUNNEL_DEPTH = 2.8;
const CHEVRONS = 39;

const GOLD = '#e8c56a';
const ICE = '#7ec8ff';

/** Měkký radial-gradient sprite pro částice (canvas → texture). */
function useSoftSprite(): THREE.CanvasTexture {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);
}

/* ------------------------------------------------------------------ */
/*  WORMHOLE TUNEL — skutečné 3D prstence místo plochých PNG            */
/*  polygonální rámy střídající CW/CCW, flare do hloubky                */
/* ------------------------------------------------------------------ */
const TUNNEL_RINGS = 12;

function TunnelRings() {
  const spin = useRef<THREE.Group>(null);
  const rings = useMemo(
    () =>
      Array.from({ length: TUNNEL_RINGS }, (_, i) => {
        const f = i / (TUNNEL_RINGS - 1);
        return {
          key: i,
          z: -0.3 - f * TUNNEL_DEPTH,
          r: 1.15 + f * 0.75,
          sides: i % 3 === 0 ? 6 : 8, // hex/oktagon střídavě
          speed: (i % 2 === 0 ? 1 : -1) * (0.5 - f * 0.3),
          color: i % 2 === 0 ? ICE : GOLD,
          opacity: 0.75 * (1 - f) + 0.1,
        };
      }),
    [],
  );
  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (!spin.current) return;
    spin.current.children.forEach((c, i) => {
      const r = rings[i];
      if (!r) return;
      c.rotation.z += delta * r.speed;
      const s = 1 + Math.sin(t * 1.4 + i * 0.9) * 0.03;
      c.scale.setScalar(s);
    });
  });
  return (
    <group>
      <group ref={spin}>
        {rings.map((r) => (
          <mesh key={r.key} position={[0, 0, r.z]}>
            <torusGeometry args={[r.r, 0.016, 4, r.sides]} />
            <meshBasicMaterial
              color={r.color}
              transparent
              opacity={r.opacity}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
      </group>
      {/* podélná žebra spojující prstence — skutečný objem */}
      {Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2).map((a, i) => (
        <group key={`rib${i}`} rotation={[0, 0, a]}>
          <mesh position={[0, 1.5, -TUNNEL_DEPTH / 2]} rotation={[0.42, 0, 0]}>
            <boxGeometry args={[0.012, 0.012, TUNNEL_DEPTH + 0.6]} />
            <meshBasicMaterial color={ICE} transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  VADŽRA — skutečný 3D dorje: koule + nákrčníky + pařáty, osa Z       */
/* ------------------------------------------------------------------ */
function Vajra() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.5;
  });
  const mat = <meshStandardMaterial color={GOLD} metalness={0.85} roughness={0.25} emissive={GOLD} emissiveIntensity={0.5} />;
  return (
    <group ref={ref} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.75]} scale={0.9}>
      {/* středová koule */}
      <mesh>
        <sphereGeometry args={[0.11, 20, 20]} />
        {mat}
      </mesh>
      {[1, -1].map((s) => (
        <group key={s}>
          {/* nákrčník */}
          <mesh position={[0, s * 0.13, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.075, 0.02, 8, 24]} />
            {mat}
          </mesh>
          {/* lotus rozšíření */}
          <mesh position={[0, s * 0.19, 0]} rotation={[s > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.1, 0.12, 12, 1, true]} />
            {mat}
          </mesh>
          {/* středový hrot */}
          <mesh position={[0, s * 0.34, 0]} rotation={[s > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.028, 0.2, 8]} />
            {mat}
          </mesh>
        </group>
      ))}
      {/* 2×4 pařáty kolem — instancované */}
      <VajraClaws mat={mat} />
      {/* glow shell */}
      <mesh scale={1.6}>
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

/** Pařáty vadžry — 8 instancí jednoho kuželu (s = ±1 strana). */
function VajraClaws({ mat }: { mat: ReactNode }) {
  const claws = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = claws.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (const s of [1, -1]) {
      for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
        dummy.position.set(Math.cos(a) * 0.09, s * 0.28, Math.sin(a) * 0.09);
        dummy.rotation.set(s * 0.7, 0, -a + Math.PI / 2);
        dummy.updateMatrix();
        m.setMatrixAt(i++, dummy.matrix);
      }
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={claws} args={[undefined, undefined, 8]}>
      <coneGeometry args={[0.02, 0.17, 6]} />
      {mat}
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */
/*  ŠRÍ JANTRA → MAHA MERU — 9 propletených kuželů + bindu + lotus      */
/* ------------------------------------------------------------------ */
const UP_CONES: [number, number][] = [
  // [poloměr, výška hrotu]
  [0.62, 0.55],
  [0.5, 0.42],
  [0.38, 0.3],
  [0.26, 0.18],
];
const DOWN_CONES: [number, number][] = [
  [0.68, 0.5],
  [0.56, 0.4],
  [0.44, 0.3],
  [0.32, 0.2],
  [0.2, 0.1],
];

function Meru() {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.22;
  });
  const yantraMat = (
    <meshStandardMaterial
      color={GOLD}
      emissive={GOLD}
      emissiveIntensity={0.7}
      metalness={0.6}
      roughness={0.3}
      transparent
      opacity={0.82}
    />
  );
  return (
    // osa meru = osa brány (Z): hory rostou z hloubky k divákovi
    <group rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -1.15]} scale={1.05}>
      <group ref={spin}>
        {/* 4 Shiva kužely — hrot nahoru (+Y lokální = k divákovi) */}
        {UP_CONES.map(([r, h], i) => (
          <mesh key={`u${i}`} position={[0, h - (r * 0.9) / 2, 0]}>
            <coneGeometry args={[r, r * 0.9, 4, 1, true]} />
            {yantraMat}
          </mesh>
        ))}
        {/* 5 Shakti kuželů — hrot dolů */}
        {DOWN_CONES.map(([r, h], i) => (
          <mesh key={`d${i}`} position={[0, -h + (r * 0.9) / 2, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[r, r * 0.9, 4, 1, true]} />
            {yantraMat}
          </mesh>
        ))}
        {/* bindu — bod stvoření na vrcholu */}
        <mesh position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshBasicMaterial color="#fff7e0" />
        </mesh>
        {/* lotus — 16 okvětních lístků v základně, instancované */}
        <MeruPetals mat={yantraMat} />
        {/* bhupura — čtvercové rámové základny */}
        {[0.85, 0.92].map((s, i) => (
          <mesh key={`b${i}`} position={[0, -0.16 - i * 0.05, 0]} rotation={[Math.PI / 2, 0, Math.PI / 4 + i * 0.2]}>
            <torusGeometry args={[s, 0.012, 4, 4]} />
            {yantraMat}
          </mesh>
        ))}
      </group>
      {/* svatá záře meru */}
      <mesh>
        <sphereGeometry args={[0.75, 16, 16]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

/** Lotusové lístky meru — 16 instancí. */
function MeruPetals({ mat }: { mat: ReactNode }) {
  const petals = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = petals.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * 0.78, -0.1, Math.sin(a) * 0.78);
      dummy.rotation.set(0, -a, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={petals} args={[undefined, undefined, 16]}>
      <coneGeometry args={[0.05, 0.16, 4]} />
      {mat}
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */
/*  NEBULA — volumetrický oblak bodů v prostoru tunelu (žádná plocha)   */
/* ------------------------------------------------------------------ */
const NEBULA_COLORS = ['#a855f7', '#ec4899', '#22d3ee', '#3b82f6', '#f0abfc', '#ffffff'];

function Nebula({ sprite }: { sprite: THREE.Texture }) {
  const points = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const N = 700;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      // objem: kužel rozšiřující se do hloubky tunelu
      const depth = Math.random();
      const z = -0.4 - depth * (TUNNEL_DEPTH + 0.6);
      const r = (0.5 + depth * 1.4) * Math.sqrt(Math.random());
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r;
      pos[i * 3 + 2] = z;
      c.set(NEBULA_COLORS[(Math.random() * NEBULA_COLORS.length) | 0]);
      const dim = 0.35 + Math.random() * 0.65;
      col[i * 3] = c.r * dim;
      col[i * 3 + 1] = c.g * dim;
      col[i * 3 + 2] = c.b * dim;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  useFrame((_, delta) => {
    if (points.current) {
      points.current.rotation.z += delta * 0.05;
      points.current.position.z = Math.sin(Date.now() * 0.0003) * 0.08;
    }
  });
  return (
    <points ref={points} geometry={geo}>
      <pointsMaterial
        map={sprite}
        vertexColors
        size={0.09}
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/*  EVENT HORIZON — polární disk s radiálním vlněním (CPU vertex wave)  */
/* ------------------------------------------------------------------ */
function Horizon({ hover }: { hover: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => {
    // polární disk: rings × segments → vlnitelné vertexy
    const R = 1.5;
    const RINGS = 22;
    const SEGS = 56;
    const pos: number[] = [];
    const idx: number[] = [];
    pos.push(0, 0, 0); // střed
    for (let r = 1; r <= RINGS; r++) {
      const rr = (r / RINGS) * R;
      for (let s = 0; s < SEGS; s++) {
        const a = (s / SEGS) * Math.PI * 2;
        pos.push(Math.cos(a) * rr, Math.sin(a) * rr, 0);
      }
    }
    // ventilátor ze středu
    for (let s = 0; s < SEGS; s++) idx.push(0, 1 + s, 1 + ((s + 1) % SEGS));
    // pásy
    for (let r = 0; r < RINGS - 1; r++) {
      for (let s = 0; s < SEGS; s++) {
        const a = 1 + r * SEGS + s;
        const b = 1 + r * SEGS + ((s + 1) % SEGS);
        const c = a + SEGS;
        const d = b + SEGS;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // polární souřadnice předpočítané — per-frame jen sin() (žádné hypot/atan2/exp)
    const n = g.attributes.position.count;
    const rs = new Float32Array(n);
    const angs = new Float32Array(n);
    const damps = new Float32Array(n);
    const pp = g.attributes.position;
    for (let i = 0; i < n; i++) {
      const r = Math.hypot(pp.getX(i), pp.getY(i));
      rs[i] = r;
      angs[i] = Math.atan2(pp.getY(i), pp.getX(i));
      damps[i] = Math.exp(-r * 0.9);
    }
    return { g, rs, angs, damps };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const p = geo.g.attributes.position as THREE.BufferAttribute;
    const amp = hover ? 0.05 : 0.028;
    for (let i = 0; i < p.count; i++) {
      p.setZ(i, Math.sin(geo.rs[i] * 9 - t * 3.1) * amp * geo.damps[i] + Math.sin(geo.angs[i] * 5 + t * 1.7) * 0.012);
    }
    p.needsUpdate = true;
  });

  return (
    <mesh ref={mesh} geometry={geo.g} position={[0, 0, -0.06]}>
      <meshBasicMaterial
        color={hover ? '#e0aaff' : '#b478f0'}
        transparent
        opacity={hover ? 0.5 : 0.34}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  KAWOOSH — částicový výstřik z hrdla brány (hover → sílí)            */
/* ------------------------------------------------------------------ */
const KAWOOSH_N = 160;

function Kawoosh({ sprite, hover }: { sprite: THREE.Texture; hover: boolean }) {
  const points = useRef<THREE.Points>(null);
  const mat = useRef<THREE.PointsMaterial>(null);
  const data = useMemo(() => {
    const pos = new Float32Array(KAWOOSH_N * 3);
    const seed = new Float32Array(KAWOOSH_N * 4); // [phase, speed, spread, angle]
    for (let i = 0; i < KAWOOSH_N; i++) {
      seed[i * 4] = Math.random();
      seed[i * 4 + 1] = 0.5 + Math.random() * 0.9;
      seed[i * 4 + 2] = Math.random();
      seed[i * 4 + 3] = Math.random() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geo: g, seed };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const p = data.geo.attributes.position as THREE.BufferAttribute;
    const power = hover ? 1 : 0.45;
    for (let i = 0; i < KAWOOSH_N; i++) {
      const life = (data.seed[i * 4] + t * data.seed[i * 4 + 1] * 0.5) % 1;
      const a = data.seed[i * 4 + 3];
      const spread = data.seed[i * 4 + 2];
      // tryska: od středu ven a k divákovi, rozšiřující se kužel
      const r = life * (0.3 + spread * 1.5) * power;
      p.setXYZ(i, Math.cos(a) * r, Math.sin(a) * r, 0.05 + life * 1.6 * power);
    }
    p.needsUpdate = true;
    if (mat.current) mat.current.opacity = hover ? 0.9 : 0.4;
  });

  return (
    <points ref={points} geometry={data.geo}>
      <pointsMaterial
        ref={mat}
        map={sprite}
        color="#e8d5ff"
        size={0.11}
        transparent
        opacity={0.4}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/*  Chevron ring + SG-1 vnitřní glyph ring (protirostáce)               */
/* ------------------------------------------------------------------ */
function ChevronRing({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const marks = useRef<THREE.InstancedMesh>(null);
  const speed = useRef(0.06);
  useFrame((_, delta) => {
    const target = active ? 0.9 : 0.06;
    speed.current += (target - speed.current) * 0.08;
    if (group.current) group.current.rotation.z += delta * speed.current;
  });
  useLayoutEffect(() => {
    const m = marks.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < CHEVRONS; i++) {
      const a = (i / CHEVRONS) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * 1.72, Math.sin(a) * 1.72, 0);
      dummy.rotation.set(0, 0, a);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group ref={group}>
      <instancedMesh ref={marks} args={[undefined, undefined, CHEVRONS]}>
        <boxGeometry args={[0.045, 0.17, 0.045]} />
        <meshBasicMaterial color={active ? GOLD : ICE} transparent opacity={0.8} />
      </instancedMesh>
    </group>
  );
}

/** Vnitřní glyph prstenec — SG-1 styl, protirrotace vůči chevronům. */
function InnerGlyphRing() {
  const group = useRef<THREE.Group>(null);
  const marks = useRef<THREE.InstancedMesh>(null);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.z -= delta * 0.09;
  });
  useLayoutEffect(() => {
    const m = marks.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * 1.52, Math.sin(a) * 1.52, 0.02);
      dummy.rotation.set(0, 0, a);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group ref={group}>
      <mesh>
        <torusGeometry args={[1.52, 0.03, 8, 72]} />
        <meshStandardMaterial color="#4a4f63" metalness={0.8} roughness={0.35} emissive={ICE} emissiveIntensity={0.12} />
      </mesh>
      <instancedMesh ref={marks} args={[undefined, undefined, 28]}>
        <boxGeometry args={[0.02, 0.08, 0.02]} />
        <meshBasicMaterial color="#cdd6e4" transparent opacity={0.55} />
      </instancedMesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  StarGate — plně 3D: rám + chevrony + glyph ring + puddle +           */
/*  kawoosh + Maha Meru (3D Šrí Jantra) + 3D vadžra + volumetrická      */
/*  nebula + pár kaleidoskopických vrstev pro hloubku.                  */
/* ------------------------------------------------------------------ */
export function StarGate({ portal, onOpen }: { portal: Portal; onOpen: (id: string) => void }) {
  const gate = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const sprite = useSoftSprite();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (gate.current) {
      gate.current.position.y = GATE_POS[1] + Math.sin(t * 0.6) * 0.16;
      gate.current.rotation.y = -0.42 + Math.sin(t * 0.22) * 0.05;
    }
  });

  const hit = {
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onOpen(portal.id);
    },
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHover(true);
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      setHover(false);
      document.body.style.cursor = 'auto';
    },
  };

  return (
    <group ref={gate} position={GATE_POS} rotation={[0.12, -0.42, 0]}>
      {/* rám brány */}
      <mesh {...hit}>
        <torusGeometry args={[1.7, 0.08, 12, 72]} />
        <meshStandardMaterial color="#8a6d1f" metalness={0.85} roughness={0.3} emissive={GOLD} emissiveIntensity={hover ? 0.35 : 0.12} />
      </mesh>
      {/* hit-disk */}
      <mesh {...hit}>
        <circleGeometry args={[1.7, 32]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <ChevronRing active={hover} />
      <InnerGlyphRing />
      {/* vlnící se event horizon */}
      <Horizon hover={hover} />
      {/* kawoosh výstřik */}
      <Kawoosh sprite={sprite} hover={hover} />
      {/* volumetrická nebula v tunelu */}
      <Nebula sprite={sprite} />
      {/* geometrický wormhole tunel — 3D prstence + žebra */}
      <TunnelRings />
      {/* skutečné 3D objekty v hrdle brány */}
      <Vajra />
      <Meru />
      <TextLabel text={portal.title.cs} position={[0, -2.05, 0]} color="#e8c56a" height={0.3} />
    </group>
  );
}
