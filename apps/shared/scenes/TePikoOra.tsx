/** @jsxRuntime classic */
'use client';

import { React, useFrame, useThree, useEffect, useMemo, useRef, THREE } from '@genesis/runtime';
import { SceneLabel } from './SceneLabel';
import { ScenePresentation, motionTime, motionDelta } from './ScenePresentation';
import { LagoonLandscape } from './LagoonLandscape';

type Lang = 'cs' | 'en';

/* ─── Te Pīko Ora — polynéská vesnice na Raiatee ──────────────────────
 * Masterplan: centrální palma (Pīko) + oheň, kruh A-frame chýší (fare)
 * z bambusu a palmového rákosu, molo do tyrkysové laguny, tiki totemy,
 * food forest — západ slunce nad lagunou, hory Raiatea na horizontu.
 */

interface Fare {
  angle: number; // od osy +z, rad — čelem ke středu
  dist: number;
  w: number; // šířka štítu
  len: number;
  name?: { cs: string; en: string };
}

const FARES: Fare[] = [
  { angle: Math.PI * .22, dist: 7.8, w: 2.5, len: 4.8, name: { cs: 'Komunitní fare', en: 'Community fare' } },
  { angle: Math.PI * .46, dist: 7.8, w: 2.2, len: 4.4, name: { cs: 'Škola navigace', en: 'Wayfinding school' } },
  { angle: Math.PI * .70, dist: 7.8, w: 2.3, len: 4.5, name: { cs: 'Kultura a vzdělávání', en: 'Culture & learning' } },
  { angle: Math.PI * .88, dist: 7.8, w: 2.2, len: 4.2 },
  { angle: Math.PI * 1.12, dist: 7.8, w: 2.2, len: 4.2 },
  { angle: Math.PI * 1.30, dist: 7.8, w: 2.2, len: 4.5, name: { cs: 'Léčivé rostliny', en: 'Healing plants' } },
  { angle: Math.PI * 1.54, dist: 7.8, w: 2.1, len: 4.2 },
  { angle: Math.PI * 1.78, dist: 7.8, w: 2.2, len: 4.4 },
];

const LAGOON_Z = -10.5; // břeh — za ním začíná laguna

/* trojúhelníkový štít fare (front/back gable) */
function gableGeometry(w: number, h: number) {
  return new THREE.ShapeGeometry(
    new THREE.Shape()
      .moveTo(-w / 2, 0)
      .lineTo(w / 2, 0)
      .lineTo(0, h)
      .closePath(),
  );
}

function useThatchTexture() {
  const texture = React.useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#bca477'; ctx.fillRect(0, 0, 256, 256);
    let seed = 71; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    for (let i = 0; i < 1500; i++) {
      const x = rnd() * 256, y = rnd() * 256;
      ctx.strokeStyle = i % 3 ? 'rgba(74,48,22,.24)' : 'rgba(249,222,166,.4)';
      ctx.lineWidth = .5 + rnd(); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rnd() * 3, y + 8 + rnd() * 34); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 2);
    return tex;
  }, []);
  useEffect(() => () => texture?.dispose(), [texture]); return texture;
}

/** A-frame chýše (fare) — bambusová kostra, rákosová střecha, raised floor */
function Fare({ fare, lang, roofTexture }: { fare: Fare; lang: Lang; roofTexture: THREE.Texture | null }) {
  const { angle, dist, w, len, name } = fare;
  const x = Math.sin(angle) * dist;
  const z = Math.cos(angle) * dist;
  const roofH = w * 1.05; // výška hřebene
  const slope = Math.hypot(w / 2, roofH) * 1.06; // délka spádové roviny
  const pitch = Math.atan2(roofH, w / 2);

  const gable = useMemo(() => gableGeometry(w, roofH), [w, roofH]);
  const innerPrism = useMemo(() => {
    const shape = new THREE.Shape()
      .moveTo(-w * 0.42, 0)
      .lineTo(w * 0.42, 0)
      .lineTo(0, roofH * 0.92)
      .closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: len * 0.86, bevelEnabled: false });
    geo.translate(0, 0, -len * 0.43);
    return geo;
  }, [w, roofH, len]);
  useEffect(() => () => { gable.dispose(); innerPrism.dispose(); }, [gable, innerPrism]);

  return (
    <group position={[x, 0, z]} rotation={[0, angle + Math.PI, 0]}>
      {/* pódium na kůlech */}
      <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.92, 0.14, len * 0.98]} />
        <meshStandardMaterial color="#7a5c34" roughness={0.9} />
      </mesh>
      {[[-w * 0.36, -len * 0.38], [w * 0.36, -len * 0.38], [-w * 0.36, len * 0.38], [w * 0.36, len * 0.38]].map((p, i) => (
        <mesh key={i} position={[p[0], 0.14, p[1]]} castShadow>
          <cylinderGeometry args={[0.055, 0.065, 0.3, 6]} />
          <meshStandardMaterial color="#5d4526" roughness={0.95} />
        </mesh>
      ))}
      {/* vnitřní objem — pletené stěny, teplý interiér */}
      <mesh position={[0, 0.36, 0]} geometry={innerPrism} castShadow>
        <meshStandardMaterial color="#4a3520" roughness={0.95} emissive="#a85e20" emissiveIntensity={0.12} />
      </mesh>
      {/* spádové střechy — palmový rákos */}
      {[1, -1].map((s) => (
        <mesh
          key={s}
          position={[s * (w * 0.26), 0.35 + roofH * 0.52, 0]}
          rotation={[0, 0, -s * pitch]}
          castShadow
        >
          <boxGeometry args={[slope, 0.07, len * 1.04]} />
          <meshStandardMaterial map={roofTexture} color="#fff2d5" roughness={0.98} />
        </mesh>
      ))}
      {[-1, 1].map(side => <group key={`frame${side}`}>
        <mesh position={[side * w * .45, .95, len * .49]}><cylinderGeometry args={[.045, .06, 1.35, 6]} /><meshStandardMaterial color="#795736" roughness={.9} /></mesh>
        <mesh position={[side * w * .25, .35 + roofH * .5, len * .51]} rotation={[0, 0, -side * pitch]}>
          <boxGeometry args={[slope, .08, .09]} /><meshStandardMaterial color="#725034" roughness={.9} />
        </mesh>
        {Array.from({length: 8}, (_, i) => <mesh key={i} position={[side * w * .5 * (i + .5) / 8, .35 + roofH * (1 - (i + .5) / 8) + .045, 0]} rotation={[0, 0, -side * pitch]}>
          <boxGeometry args={[.045, .035, len * 1.055]} /><meshStandardMaterial color={i % 2 ? '#c1a679' : '#988052'} roughness={1} />
        </mesh>)}
      </group>)}
      <mesh position={[0, .28, len * .56]} receiveShadow><boxGeometry args={[w * .9, .14, .65]} /><meshStandardMaterial color="#a47d50" roughness={.9} /></mesh>
      {/* hřeben — bambusová vazba ční přes štíty */}
      <mesh position={[0, 0.35 + roofH, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, len * 1.18, 6]} />
        <meshStandardMaterial color="#5d4526" roughness={0.95} />
      </mesh>
      {/* čelní štít — pletená stěna s otevřenými dveřmi */}
      <mesh position={[0, 1.6, len * 0.47]} scale={[(roofH - 1.24) / roofH, (roofH - 1.24) / roofH, 1]} geometry={gable}>
        <meshStandardMaterial color="#5a4426" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {/* stíněný vstup za otevřenou verandou */}
      <mesh position={[0, 0.95, len * 0.44]}>
        <boxGeometry args={[w * 0.24, 1.15, 0.03]} />
        <meshStandardMaterial color="#1a0e04" emissive="#ff9a3c" emissiveIntensity={0.18} />
      </mesh>
      {/* zadní štít */}
      <mesh position={[0, 0.36, -len * 0.47]} rotation={[0, Math.PI, 0]} geometry={gable}>
        <meshStandardMaterial color="#3d2c18" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {/* schodky ke vstupu */}
      <mesh position={[0, 0.18, len * 0.55]} receiveShadow castShadow>
        <boxGeometry args={[w * 0.4, 0.12, 0.5]} />
        <meshStandardMaterial color="#8d7f63" roughness={0.9} />
      </mesh>
      {/* teplá lucerna u vchodu */}
      <pointLight position={[0, 0.9, len * 0.5]} intensity={0.9} distance={3.2} color="#ffaa55" decay={2} />

      {name && (
        <SceneLabel position={[0, roofH + 1.0, 0]} text={name[lang]} />
      )}
    </group>
  );
}

/** Kokosová palma — parametry: výška, náklon, koruna z listů */
function Palm({ pos, h = 4.2, lean = 0.12, scale = 1, fronds = 9 }: {
  pos: [number, number, number];
  h?: number;
  lean?: number;
  scale?: number;
  fronds?: number;
}) {
  const leafGeometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1, 18, 2); const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const t = p.getX(i) + .5, across = p.getY(i);
      const edge = Math.sin(t * Math.PI) * (.28 + .025 * Math.sin(t * Math.PI * 30));
      p.setXYZ(i, t, .4 * Math.sin(t * Math.PI) - .38 * t * t - Math.abs(across) * .035, across * edge);
    }
    g.computeVertexNormals(); return g;
  }, []);
  useEffect(() => () => leafGeometry.dispose(), [leafGeometry]);
  const leaves = useMemo(() => {
    const out: { yaw: number; pitch: number; len: number }[] = [];
    for (let i = 0; i < fronds; i++) {
      out.push({
        yaw: (i / fronds) * Math.PI * 2 + (i % 3) * 0.18,
        pitch: -0.55 - (i % 3) * 0.16 - (i / fronds) * 0.12,
        len: 1.5 + (i % 3) * 0.22,
      });
    }
    return out;
  }, [fronds]);

  return (
    <group position={pos} scale={scale} rotation={[0, 0, lean]}>
      {/* kmen — mírně stočený */}
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.16, h, 7]} />
        <meshStandardMaterial color="#6e5233" roughness={0.95} />
      </mesh>
      {/* korunka */}
      <mesh position={[0, h, 0]} castShadow>
        <sphereGeometry args={[0.17, 8, 6]} />
        <meshStandardMaterial color="#5d4526" roughness={0.95} />
      </mesh>
      {leaves.map((l, i) => <mesh key={i} position={[0, h + .06, 0]} rotation={[0, l.yaw, 0]} scale={[l.len * 1.5, l.len * 1.5, l.len * 1.5]} geometry={leafGeometry} castShadow>
        <meshStandardMaterial color={i % 3 === 0 ? '#537c36' : i % 3 === 1 ? '#356b38' : '#6b9045'} roughness={.92} side={THREE.DoubleSide} />
      </mesh>)}
      {h > 6 && [-.16, 0, .16].map((x, i) => <mesh key={i} position={[x, h - .15, .12]}><sphereGeometry args={[.13, 8, 6]} /><meshStandardMaterial color="#88703c" roughness={1} /></mesh>)}
    </group>
  );
}

/** Centrální Te Pīko palma + oheň + kamenný kruh — srdce vesnice */
function CenterPiko({ lang }: { lang: Lang }) {
  const fireRef = useRef<THREE.PointLight>(null);
  const flameRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = motionTime(clock);
    const flick = 1 + Math.sin(t * 9) * 0.16 + Math.sin(t * 23) * 0.08;
    if (fireRef.current) fireRef.current.intensity = 2.6 * flick;
    if (flameRef.current) flameRef.current.scale.set(1, flick, 1);
  });

  return (
    <group>
      {/* kamenný kruh — posvátný okraj píka */}
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.9, 0.1, Math.sin(a) * 1.9]} scale={[0.28, 0.16, 0.22]} rotation={[0, a, 0]} castShadow receiveShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#8d7f63" roughness={0.95} />
          </mesh>
        );
      })}

      {/* ohniště — kameny + plamen */}
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2;
        return (
          <mesh key={`f${i}`} position={[Math.cos(a) * 0.62, 0.08, 0.9 + Math.sin(a) * 0.62]} scale={0.14} castShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#6e6350" roughness={1} />
          </mesh>
        );
      })}
      <mesh ref={flameRef} position={[0, 0.34, 0.9]}>
        <coneGeometry args={[0.22, 0.6, 7]} />
        <meshBasicMaterial color="#ff9a3c" transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, 0.24, 0.9]}>
        <coneGeometry args={[0.13, 0.42, 6]} />
        <meshBasicMaterial color="#ffd98a" />
      </mesh>
      <pointLight ref={fireRef} position={[0, 0.7, 0.9]} intensity={2.6} distance={7} color="#ff8a3c" decay={2} />

      {/* sedačky — klády v kruhu kolem ohně */}
      {[0.35, 1.5, 2.6, 3.9, 5.1].map((a, i) => (
        <mesh key={`s${i}`} position={[Math.cos(a) * 1.25, 0.16, 0.9 + Math.sin(a) * 1.25]} rotation={[0, -a, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 0.8, 7]} />
          <meshStandardMaterial color="#6e5233" roughness={0.95} />
        </mesh>
      ))}

      {/* Te Pīko — velká centrální palma */}
      <Palm pos={[0, 0, -0.6]} h={7.2} lean={0.05} fronds={13} />

      {/* 4 směry — Rangi/Tangata/Whenua/Moana */}
      <SceneLabel position={[0, 8.6, -0.6]} text={lang === 'cs' ? 'Te Pīko · srdce' : 'Te Pīko · heart'} />
    </group>
  );
}

/** Tiki totem — vytesaný sloup u cest */
function Tiki({ pos, h = 1.5 }: { pos: [number, number, number]; h?: number }) {
  return (
    <group position={pos}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.17, h, 7]} />
        <meshStandardMaterial color="#5d4526" roughness={0.9} />
      </mesh>
      {/* hlava */}
      <mesh position={[0, h + 0.14, 0]} castShadow>
        <boxGeometry args={[0.3, 0.32, 0.26]} />
        <meshStandardMaterial color="#6e5233" roughness={0.9} />
      </mesh>
      {/* oči */}
      {[-0.07, 0.07].map((s) => (
        <mesh key={s} position={[s, h + 0.19, 0.135]}>
          <boxGeometry args={[0.05, 0.04, 0.02]} />
          <meshBasicMaterial color="#ffd98a" />
        </mesh>
      ))}
      {/* korunka */}
      <mesh position={[0, h + 0.38, 0]} castShadow>
        <coneGeometry args={[0.19, 0.2, 7]} />
        <meshStandardMaterial color="#4a3520" roughness={0.95} />
      </mesh>
      <pointLight position={[0, h + 0.25, 0.4]} intensity={0.5} distance={2.4} color="#ffaa55" decay={2} />
    </group>
  );
}

/** Molo do laguny + kánoe (Arrival & Canoe Landing) */
function PierAndCanoe() {
  const planks = 9;
  return (
    <group>
      {/* kůly */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <group key={i}>
          {[-0.55, 0.55].map((s) => (
            <mesh key={s} position={[s, 0.3, LAGOON_Z - 0.5 - i * 1.35]} castShadow>
              <cylinderGeometry args={[0.06, 0.07, 1.3, 6]} />
              <meshStandardMaterial color="#5d4526" roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}
      {/* palubky */}
      {Array.from({ length: planks }, (_, i) => (
        <mesh key={`p${i}`} position={[0, 0.68, LAGOON_Z - 0.5 - i * 0.85]} receiveShadow castShadow>
          <boxGeometry args={[1.25, 0.07, 0.78]} />
          <meshStandardMaterial color={i % 2 ? '#7a5c34' : '#6e5233'} roughness={0.9} />
        </mesh>
      ))}
      {/* nástupní plošina na konci */}
      <mesh position={[0, 0.68, LAGOON_Z - planks * 0.85 - 0.5]} receiveShadow castShadow>
        <boxGeometry args={[2.6, 0.08, 1.8]} />
        <meshStandardMaterial color="#7a5c34" roughness={0.9} />
      </mesh>

      {/* kánoe s balancírkou u mola */}
      <group position={[1.9, 0.1, LAGOON_Z - 5.4]} rotation={[0, 0.35, 0]}>
        <mesh scale={[0.32, 0.24, 2.4]} castShadow>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color="#4a3520" roughness={0.85} />
        </mesh>
        {/* výtlak uvnitř */}
        <mesh position={[0, 0.16, 0]} scale={[0.2, 0.06, 1.9]}>
          <sphereGeometry args={[1, 10, 6]} />
          <meshStandardMaterial color="#241808" roughness={1} />
        </mesh>
        {/* balancírka */}
        <mesh position={[0.95, -0.02, 0]} scale={[0.14, 0.14, 1.6]}>
          <sphereGeometry args={[1, 10, 6]} />
          <meshStandardMaterial color="#5d4526" roughness={0.85} />
        </mesh>
        {[0.7, -0.7].map((s) => (
          <mesh key={s} position={[0.5, 0.14, s]} rotation={[0, 0, 1.1]}>
            <cylinderGeometry args={[0.03, 0.03, 0.75, 5]} />
            <meshStandardMaterial color="#6e5233" roughness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Vesničané — jednoduché postavy u ohně a cest */
function Villagers() {
  const people = useMemo(() => {
    const out: { p: [number, number, number]; s: number; c: string }[] = [];
    // kruh u ohně
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      const r = 1.05 + (i % 2) * 0.55;
      out.push({
        p: [Math.cos(a) * r, 0, 0.9 + Math.sin(a) * r],
        s: 0.32 + (i % 3) * 0.04,
        c: ['#c9a458', '#8a6b3a', '#a8552e', '#6b8a4a', '#b3681f'][i % 5],
      });
    }
    // pár chodců na cestách
    out.push({ p: [2.6, 0, 3.4], s: 0.34, c: '#c9a458' });
    out.push({ p: [-3.2, 0, 2.1], s: 0.33, c: '#a8552e' });
    out.push({ p: [-1.6, 0, -4.2], s: 0.35, c: '#6b8a4a' });
    out.push({ p: [0.9, 0, -6.0], s: 0.34, c: '#8a6b3a' });
    return out;
  }, []);

  const ref = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    if (ref.current && headRef.current) {
      people.forEach((p, i) => {
        dummy.position.set(p.p[0], p.s, p.p[2]);
        dummy.scale.set(p.s * 0.55, p.s, p.s * 0.55);
        dummy.updateMatrix();
        ref.current!.setMatrixAt(i, dummy.matrix);
        ref.current!.setColorAt(i, color.set(p.c));
        dummy.position.set(p.p[0], p.s * 1.78, p.p[2]);
        dummy.scale.set(p.s * 0.3, p.s * 0.3, p.s * 0.3);
        dummy.updateMatrix();
        headRef.current!.setMatrixAt(i, dummy.matrix);
      });
      ref.current.instanceMatrix.needsUpdate = true;
      headRef.current.instanceMatrix.needsUpdate = true;
      if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    }
  }, [people]);

  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, people.length]} castShadow>
        <capsuleGeometry args={[0.5, 1.4, 3, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, people.length]} castShadow>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#5d4526" roughness={0.9} />
      </instancedMesh>
    </>
  );
}

/** Tropická vegetace — palmy + podrost (food forest & gardens) */
function Jungle() {
  const { bushes, palms } = useMemo(() => {
    const b: { x: number; z: number; s: number; c: string }[] = [];
    const p: { x: number; z: number; s: number; lean: number }[] = [];
    let seed = 29;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const insideVillage = (x: number, z: number) => {
      const d = Math.hypot(x, z);
      if (d < 10.6) return true; // pláza + fare
      if (z < LAGOON_Z + 0.8) return true; // voda
      if (Math.abs(x) < 1.6 && z < -7) return true; // molo
      if (Math.abs(x) < 5 && z > 8.4) return true; // jižní přístupová osa (kamera)
      return false;
    };
    for (let i = 0; i < 170; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 9.2 + rnd() * 8.5;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r * 0.92;
      if (insideVillage(x, z)) continue;
      const s = 0.3 + rnd() * 0.5;
      b.push({ x, z, s, c: i % 4 === 0 ? '#3f8a3f' : i % 4 === 1 ? '#2f7a35' : i % 4 === 2 ? '#1f5e2a' : '#5a7a2e' });
    }
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 10 + rnd() * 8;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r * 0.92;
      if (insideVillage(x, z)) continue;
      p.push({ x, z, s: 0.55 + rnd() * 0.4, lean: (rnd() - 0.5) * 0.4 });
    }
    // palmová obruba pláže
    p.push({ x: -8.5, z: LAGOON_Z + 1.6, s: 0.7, lean: -0.3 });
    p.push({ x: -6.8, z: LAGOON_Z + 1.2, s: 0.6, lean: 0.25 });
    p.push({ x: 7.6, z: LAGOON_Z + 1.8, s: 0.68, lean: 0.28 });
    return { bushes: b, palms: p };
  }, []);

  const bushRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    if (bushRef.current) {
      bushes.forEach((b, i) => {
        dummy.position.set(b.x, b.s * 0.5, b.z);
        dummy.scale.set(b.s, b.s * 0.8, b.s);
        dummy.updateMatrix();
        bushRef.current!.setMatrixAt(i, dummy.matrix);
        bushRef.current!.setColorAt(i, color.set(b.c));
      });
      bushRef.current.instanceMatrix.needsUpdate = true;
      if (bushRef.current.instanceColor) bushRef.current.instanceColor.needsUpdate = true;
    }
  }, [bushes]);

  return (
    <>
      <instancedMesh ref={bushRef} args={[undefined, undefined, bushes.length]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </instancedMesh>
      {palms.map((p, i) => (
        <Palm key={i} pos={[p.x, 0, p.z]} h={3.4 + p.s * 2} lean={p.lean} scale={p.s} fronds={8} />
      ))}
    </>
  );
}

/** Hory Raiatea na horizontu + západ slunce nad lagunou */
function SkyMountainsSun() {
  const skyMat = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: `
          varying vec3 vP;
          void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }
        `,
        fragmentShader: `
          varying vec3 vP;
          uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 sunDir;
          void main(){
            vec3 d = normalize(vP);
            vec3 c = d.y > 0.22 ? mix(mid, top, smoothstep(0.22, 0.75, d.y))
                              : mix(low, mid, smoothstep(-0.05, 0.22, d.y));
            float s = max(dot(d, sunDir), 0.0);
            c += vec3(1.0, 0.92, 0.66) * pow(s, 1600.0) * 1.5
               + vec3(1.0, 0.75, 0.42) * pow(s, 45.0) * 0.18
               + vec3(0.98, 0.62, 0.3) * pow(s, 6.0) * 0.22;
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
        uniforms: {
          top: { value: new THREE.Color('#4c7ba5') },
          mid: { value: new THREE.Color('#c6b5a4') },
          low: { value: new THREE.Color('#ebd2aa') },
          sunDir: { value: new THREE.Vector3(-0.6, 0.05, -0.75).normalize() },
        },
      }),
    [],
  );

  useEffect(() => () => skyMat.dispose(), [skyMat]);

  return (
    <>
      <mesh material={skyMat} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[1800, 24, 16]} />
      </mesh>
    </>
  );
}

export function TePikoOraScene({ lang }: { lang: Lang }) {
  const roofTexture = useThatchTexture();
  return (
    <>
      <ScenePresentation camera={PIKO_CAMERA} target={PIKO_CONTROLS.target} />
      <SkyMountainsSun />
      <fog attach="fog" args={['#bbcbd2', 70, 250]} />

      <LagoonLandscape />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .015, 0]} receiveShadow>
        <circleGeometry args={[5.1, 64]} /><meshStandardMaterial color="#cbb68f" roughness={1} />
      </mesh>

      {/* radiální pěšiny z plázy k fare a mola */}
      {FARES.map((f, i) => {
        const a = f.angle;
        const len = f.dist - 3.4;
        return (
          <mesh
            key={`w${i}`}
            position={[Math.sin(a) * (3.4 + len / 2), 0.02, Math.cos(a) * (3.4 + len / 2)]}
            rotation={[0, a, 0]}
            receiveShadow
          >
            <boxGeometry args={[0.7, 0.025, len]} />
            <meshStandardMaterial color="#b8a070" roughness={1} />
          </mesh>
        );
      })}
      {/* cesta k molu */}
      <mesh position={[0, 0.02, -8.9]} receiveShadow>
        <boxGeometry args={[0.85, 0.025, 3.2]} />
        <meshStandardMaterial color="#b8a070" roughness={1} />
      </mesh>

      {FARES.map((f, i) => (
        <Fare key={i} fare={f} lang={lang} roofTexture={roofTexture} />
      ))}

      <CenterPiko lang={lang} />
      <PierAndCanoe />
      <Villagers />
      <Jungle />

      {/* tiki totemy u cest */}
      <Tiki pos={[1.15, 0, -7.6]} h={1.5} />
      <Tiki pos={[-1.15, 0, -7.6]} h={1.5} />
      <Tiki pos={[4.6, 0, 4.2]} h={1.35} />
      <Tiki pos={[-4.9, 0, 3.6]} h={1.35} />
    </>
  );
}


export const PIKO_CAMERA = {position: [2, 9.5, 23] as [number,number,number], fov: 46, far: 2000};
export const PIKO_CONTROLS = {autoRotate:true, autoRotateSpeed:.18, minDistance:12, maxDistance:85, maxPolarAngle:Math.PI / 2 - .08, target:[0,2,-2] as [number,number,number], enablePan:false};
export function PikoLighting() {
  return <>
    <ambientLight intensity={.65} color="#e9f3ff" />
    <hemisphereLight args={['#c9e3f3','#494b30',.75]} />
    <directionalLight position={[-16,12,-14]} intensity={2} color="#ffe0a8" castShadow />
    <directionalLight position={[14,14,10]} intensity={.9} color="#d5eaff" />
  </>;
}
