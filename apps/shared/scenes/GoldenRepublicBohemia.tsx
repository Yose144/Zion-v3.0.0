/** @jsxRuntime classic */
'use client';

import { React, useFrame, useEffect, useMemo, useRef, THREE } from '@genesis/runtime';
import { SceneLabel } from './SceneLabel';

type Lang = 'cs' | 'en';

/* ─── Golden Republic Bohemia — Živý střed u Řípu ─────────────────────
 * Dle koncept boardu: tři síně v zlatém řezu (Mýtu SZ · Protokolu V ·
 * Služby J) kolem Decision Circle — kruhového náměstí s dubyovým
 * Stromem života. Zelené střechy, dřevěné lamely, kamenný sokl,
 * terasovitý svah, vodopády, Říp na ose v soumraku.
 */

const DEG = Math.PI / 180;

/* Pozice síní (azimut od +z, stupně): Mýtu NW ~225°, Protokolu E ~315°,
 * Služby S ~180° — ve třech.js: x=sin(a)·d, z=cos(a)·d, a měřeno od severu(-z). */
function polar(azDeg: number, d: number): [number, number] {
  const a = azDeg * DEG;
  return [Math.sin(a) * d, -Math.cos(a) * d];
}

const HALL_DIST = 11.2;
const HALL_R_IN = 3.1;   // vnitřní hrany (ke kolonádě)
const HALL_R_OUT = 5.6;  // zadní stěna
const HALL_SPAN = 118 * DEG;
const HALL_H = 2.0;

interface HallDef {
  az: number;
  name: { cs: string; en: string };
  accent: string;
}
const HALLS: HallDef[] = [
  { az: 315, name: { cs: 'Síň Mýtu', en: 'Hall of Myth' }, accent: '#c98a3a' },
  { az: 45, name: { cs: 'Síň Protokolu', en: 'Hall of Protocol' }, accent: '#8fb0d9' },
  { az: 180, name: { cs: 'Síň Služby', en: 'Hall of Service' }, accent: '#8fbf6a' },
];

/** plochý prstencový výsek (zelená střecha / kamenný pás) */
function ringSector(rIn: number, rOut: number, span: number, y: number, color: string, rough = 0.9) {
  const geo = new THREE.RingGeometry(rIn, rOut, 32, 1, Math.PI / 2 - span / 2, span);
  return { geo, y, color, rough };
}

/** Oblouková síň — zadní stěna + kolonáda vpředu + zelená střecha + sokl */
function Hall({ def }: { def: HallDef }) {
  const [hx, hz] = polar(def.az, HALL_DIST);
  // lokální osa +z míří do centra → rotace skupiny
  const yaw = Math.atan2(-hx, -hz);

  // kamenná zadní stěna — oblouk otočený OD centra
  const backGeo = useMemo(
    () => new THREE.CylinderGeometry(HALL_R_OUT, HALL_R_OUT, HALL_H - 0.35, 30, 1, true, Math.PI - HALL_SPAN / 2, HALL_SPAN),
    [],
  );
  // kamenný sokl — širší a nižší oblouk
  const baseGeo = useMemo(
    () => new THREE.CylinderGeometry(HALL_R_OUT + 0.35, HALL_R_OUT + 0.5, 0.55, 30, 1, true, Math.PI - (HALL_SPAN + 0.12) / 2, HALL_SPAN + 0.12),
    [],
  );
  // zelená střecha — výsek prstence s přesahem (křídlo nad kolonádou)
  const roofGeo = useMemo(() => {
    const r = ringSector(HALL_R_IN - 1.1, HALL_R_OUT + 0.7, HALL_SPAN + 0.16, 0, '#000');
    return r.geo;
  }, []);
  // vnitřní podlahový výsek — teplé světlo zevnitř
  const floorGeo = useMemo(
    () => new THREE.RingGeometry(HALL_R_IN - 0.3, HALL_R_OUT - 0.1, 28, 1, Math.PI / 2 - HALL_SPAN / 2, HALL_SPAN),
    [],
  );
  // dřevěné lamely zadní stěny — tenké sloupky podél oblouku
  const slats = useMemo(() => {
    const n = 15;
    const arr: { x: number; z: number; yaw: number }[] = [];
    for (let i = 0; i < n; i++) {
      const t = -HALL_SPAN / 2 + (HALL_SPAN * i) / (n - 1);
      arr.push({ x: Math.sin(t) * (HALL_R_OUT + 0.06), z: -Math.cos(t) * (HALL_R_OUT + 0.06), yaw: t });
    }
    return arr;
  }, []);
  // kolonáda — sloupky po vnitřním oblouku
  const columns = useMemo(() => {
    const n = 9;
    const arr: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const t = -HALL_SPAN / 2 + (HALL_SPAN * i) / (n - 1);
      arr.push([Math.sin(t) * (HALL_R_IN - 0.15), -Math.cos(t) * (HALL_R_IN - 0.15)]);
    }
    return arr;
  }, []);

  return (
    <group position={[hx, 0, hz]} rotation={[0, yaw, 0]}>
      {/* sokl */}
      <mesh geometry={baseGeo} position={[0, 0.28, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#8d8268" roughness={0.95} />
      </mesh>
      {/* zadní stěna — světlá omítka */}
      <mesh geometry={backGeo} position={[0, 0.55 + (HALL_H - 0.35) / 2, 0]} castShadow>
        <meshStandardMaterial color="#d6c9ad" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      {/* lamely */}
      {slats.map((s, i) => (
        <mesh key={i} position={[s.x, 0.55 + (HALL_H - 0.3) / 2, s.z]} rotation={[0, s.yaw, 0]} castShadow>
          <boxGeometry args={[0.11, HALL_H - 0.3, 0.09]} />
          <meshStandardMaterial color="#7a5a36" roughness={0.85} />
        </mesh>
      ))}
      {/* kolonáda — bělé sloupy */}
      {columns.map(([cx, cz], i) => (
        <mesh key={i} position={[cx, 0.55 + (HALL_H - 0.2) / 2, cz]} castShadow>
          <cylinderGeometry args={[0.11, 0.13, HALL_H - 0.2, 8]} />
          <meshStandardMaterial color="#e6dcc4" roughness={0.6} />
        </mesh>
      ))}
      {/* vnitřní podlaha — teplá záře */}
      <mesh geometry={floorGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.57, 0]}>
        <meshStandardMaterial color="#5a4632" emissive={def.accent} emissiveIntensity={0.75} roughness={0.9} />
      </mesh>
      {/* zelená střecha — tráva + kamenný lem */}
      <mesh geometry={roofGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.55 + HALL_H, 0]} castShadow>
        <meshStandardMaterial color="#5a7a42" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {/* vegetace na střeše — pár keříků */}
      {[0.25, 0.5, 0.75].map((t, i) => {
        const a = -HALL_SPAN / 2 + HALL_SPAN * t;
        const r = HALL_R_IN + (HALL_R_OUT - HALL_R_IN) * 0.55;
        return (
          <mesh key={i} position={[Math.sin(a) * r, 0.55 + HALL_H + 0.16, -Math.cos(a) * r]}>
            <sphereGeometry args={[0.3 - i * 0.04, 6, 5]} />
            <meshStandardMaterial color="#4f7139" roughness={0.95} />
          </mesh>
        );
      })}
      {/* vnitřní světlo */}
      <pointLight position={[0, 1.7, -1]} intensity={2.4} color={def.accent} distance={9} decay={2} />
    </group>
  );
}

/** Decision Circle — kamenný kruh se zlatým kruhovým a radiálním inlayem */
function DecisionCircle() {
  const rings = [1.6, 2.6, 3.6, 4.6];
  const spokes = 16;
  // zlatá spirála vložená do podlahy
  const spiral = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 90; i++) {
      const t = i / 90;
      const a = t * Math.PI * 4.6;
      const r = 0.35 + t * 1.15;
      pts.push(new THREE.Vector3(Math.sin(a) * r, 0.03, Math.cos(a) * r));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, 90, 0.035, 5);
  }, []);
  return (
    <group>
      {/* kamenná deska */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.62, 0]} receiveShadow>
        <circleGeometry args={[6.1, 64]} />
        <meshStandardMaterial color="#8f8468" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.36, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[6.1, 6.5, 0.55, 64]} />
        <meshStandardMaterial color="#7a6f56" roughness={0.95} />
      </mesh>
      {/* zlaté kruhy */}
      {rings.map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.64, 0]}>
          <ringGeometry args={[r - 0.045, r + 0.045, 72]} />
          <meshStandardMaterial color="#d9b45c" emissive="#b8862e" emissiveIntensity={0.7} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {/* radiální paprsky */}
      {Array.from({ length: spokes }, (_, i) => {
        const a = (i / spokes) * Math.PI * 2;
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, a]} position={[Math.sin(a) * 3.5, 0.635, Math.cos(a) * 3.5]}>
            <planeGeometry args={[0.06, 4.4]} />
            <meshStandardMaterial color="#d9b45c" emissive="#9a7226" emissiveIntensity={0.5} metalness={0.7} roughness={0.4} transparent opacity={0.85} />
          </mesh>
        );
      })}
      {/* spirála uprostřed */}
      <mesh geometry={spiral} position={[0, 0.66, 0]}>
        <meshStandardMaterial color="#e8c96a" emissive="#c9962e" emissiveIntensity={0.8} metalness={0.85} roughness={0.25} />
      </mesh>
    </group>
  );
}

/** Strom života — mohutný dub nad Decision Circle */
function OakTree() {
  const branches = useMemo(() => {
    const arr: { start: THREE.Vector3; end: THREE.Vector3; r: number }[] = [];
    const top = new THREE.Vector3(0, 5.6, 0);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      const end = new THREE.Vector3(Math.sin(a) * (2.2 + (i % 3) * 0.7), 4.2 + Math.sin(i * 2.1) * 0.9, Math.cos(a) * (2.2 + ((i + 1) % 3) * 0.7));
      arr.push({ start: new THREE.Vector3(0, 3.2, 0), end, r: 0.16 });
    }
    arr.push({ start: new THREE.Vector3(0, 3.2, 0), end: top, r: 0.2 });
    return arr;
  }, []);
  const canopy = useMemo(() => {
    const rng = (s: number) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
    const arr: { pos: [number, number, number]; s: number }[] = [];
    for (let i = 0; i < 26; i++) {
      const a = rng(i + 1) * Math.PI * 2;
      const rr = Math.pow(rng(i + 7), 0.6) * 3.6;
      const y = 4.4 + rng(i + 13) * 2.6 - rr * 0.28;
      arr.push({ pos: [Math.sin(a) * rr, y, Math.cos(a) * rr], s: 1.0 + rng(i + 31) * 1.15 });
    }
    return arr;
  }, []);
  return (
    <group>
      {/* kmen — mírně stočený */}
      <mesh position={[0, 1.7, 0]} rotation={[0.06, 0, -0.05]} castShadow>
        <cylinderGeometry args={[0.38, 0.62, 3.4, 9]} />
        <meshStandardMaterial color="#5d4526" roughness={0.95} />
      </mesh>
      {branches.map((b, i) => {
        const mid = b.start.clone().lerp(b.end, 0.5);
        const dir = b.end.clone().sub(b.start);
        const len = dir.length();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        return (
          <mesh key={i} position={mid} quaternion={q} castShadow>
            <cylinderGeometry args={[b.r * 0.55, b.r, len, 6]} />
            <meshStandardMaterial color="#5d4526" roughness={0.95} />
          </mesh>
        );
      })}
      {/* koruna — hustá listová clumpy */}
      {canopy.map((c, i) => (
        <mesh key={i} position={c.pos} castShadow>
          <sphereGeometry args={[c.s, 7, 6]} />
          <meshStandardMaterial color={i % 3 === 0 ? '#5d7c3f' : i % 3 === 1 ? '#4a6a34' : '#6d8c48'} roughness={0.95} />
        </mesh>
      ))}
      {/* teplý stín-podsvit stromu */}
      <pointLight position={[0, 3.4, 0]} intensity={1.6} color="#ffca70" distance={11} decay={2} />
    </group>
  );
}

/** terasovitý svah — kruhové terasy s kamennými lemy a vegetací */
function Terraces() {
  const levels = [
    { rIn: 6.5, rOut: 9.4, y: 0.42 },
    { rIn: 9.4, rOut: 13.4, y: 0.18 },
    { rIn: 13.4, rOut: 19.5, y: -0.1 },
  ];
  const shrubs = useMemo(() => {
    const rng = (s: number) => { const x = Math.sin(s * 78.233) * 43758.5453; return x - Math.floor(x); };
    const arr: { pos: [number, number, number]; s: number; c: string }[] = [];
    for (let i = 0; i < 70; i++) {
      const lvl = levels[i % levels.length];
      const a = rng(i + 3) * Math.PI * 2;
      const r = lvl.rIn + 0.5 + rng(i + 11) * (lvl.rOut - lvl.rIn - 1);
      arr.push({
        pos: [Math.sin(a) * r, lvl.y + 0.22 + rng(i + 5) * 0.1, Math.cos(a) * r],
        s: 0.28 + rng(i + 17) * 0.5,
        c: ['#5a7a3f', '#6d8c48', '#4f7139', '#7a9452'][i % 4],
      });
    }
    return arr;
  }, []);
  return (
    <group>
      {levels.map((l, i) => (
        <group key={i}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, l.y, 0]} receiveShadow>
            <ringGeometry args={[l.rIn, l.rOut, 72]} />
            <meshStandardMaterial color={i === 2 ? '#51683c' : '#5d7343'} roughness={0.95} />
          </mesh>
          {/* kamenný lem terasy */}
          <mesh position={[0, l.y - 0.14, 0]}>
            <cylinderGeometry args={[l.rOut + 0.12, l.rOut + 0.22, 0.5, 72, 1, true]} />
            <meshStandardMaterial color="#8d8268" roughness={0.95} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {shrubs.map((s, i) => (
        <mesh key={i} position={s.pos} scale={[1, s.s, 1]} castShadow>
          <sphereGeometry args={[0.5, 6, 5]} />
          <meshStandardMaterial color={s.c} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

/** les za terasami */
function ForestRing() {
  const trees = useMemo(() => {
    const rng = (s: number) => { const x = Math.sin(s * 91.17) * 24634.6345; return x - Math.floor(x); };
    const arr: { pos: [number, number, number]; h: number }[] = [];
    for (let i = 0; i < 90; i++) {
      const a = rng(i + 1) * Math.PI * 2;
      const r = 21 + rng(i + 9) * 26;
      // volný koridor na jih — vstupní cesta + výhled na vodu
      const z = Math.cos(a) * r;
      if (z > 12 && Math.abs(Math.sin(a) * r) < 14) continue;
      arr.push({ pos: [Math.sin(a) * r, -0.1, Math.cos(a) * r], h: 2.6 + rng(i + 4) * 3.4 });
    }
    return arr;
  }, []);
  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={t.pos}>
          <mesh position={[0, t.h / 2, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.14, t.h, 5]} />
            <meshStandardMaterial color="#4a3826" roughness={0.95} />
          </mesh>
          <mesh position={[0, t.h + 0.5, 0]} castShadow>
            <sphereGeometry args={[0.9 + t.h * 0.22, 6, 5]} />
            <meshStandardMaterial color={['#3f5a2e', '#4a6a34', '#557538'][i % 3]} roughness={0.95} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** vodní plochy — jezírko + prstencový potok + vodopády */
function Waters() {
  const fallRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (fallRef.current) {
      const m = fallRef.current.material as THREE.MeshStandardMaterial;
      m.opacity = 0.5 + Math.sin(t * 2.2) * 0.12;
    }
  });
  const waterMat = (
    <meshPhysicalMaterial color="#2e5a66" roughness={0.12} metalness={0.2} clearcoat={0.8} transparent opacity={0.92} />
  );
  return (
    <group>
      {/* jezírko na jihu */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2, -0.16, 27]} scale={[1.5, 1, 1]} receiveShadow>
        <circleGeometry args={[7.5, 40]} />
        {waterMat}
      </mesh>
      {/* prstencový potok mezi terasami */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.16, 0]}>
        <ringGeometry args={[9.55, 10.3, 72, 1, Math.PI * 0.62, Math.PI * 0.76]} />
        {waterMat}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <ringGeometry args={[13.55, 14.4, 72, 1, Math.PI * 1.35, Math.PI * 0.9]} />
        {waterMat}
      </mesh>
      {/* 2 vodopády — z terasy do jezírka (jih) */}
      {[-4.4, 7.6].map((x, i) => (
        <group key={i} position={[x, 0, 20.2]}>
          <mesh ref={i === 0 ? fallRef : undefined} position={[0, 0.3, 0]} rotation={[0.12, 0, 0]}>
            <planeGeometry args={[0.8, 1.9]} />
            <meshStandardMaterial color="#bfd8e0" transparent opacity={0.5} roughness={0.3} emissive="#7fa8b5" emissiveIntensity={0.3} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          {/* pěna na spodní hraně */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 1.0]}>
            <circleGeometry args={[0.75, 12]} />
            <meshBasicMaterial color="#e8f4f6" transparent opacity={0.45} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** vstupní cesta z jihu do Decision Circle */
function EntrancePath() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.63, 8.9]}>
      <planeGeometry args={[1.5, 6.4]} />
      <meshStandardMaterial color="#a39673" roughness={0.95} />
    </mesh>
  );
}

/** Říp — kuželová hora na severozápadě, v mlze */
function Rip() {
  return (
    <group position={[-46, 0, -62]}>
      <mesh position={[0, 7.4, 0]}>
        <coneGeometry args={[15, 15, 40]} />
        <meshStandardMaterial color="#4a5a48" roughness={0.95} />
      </mesh>
      {/* vrcholová rotunda */}
      <mesh position={[0, 15.1, 0]}>
        <cylinderGeometry args={[0.5, 0.7, 0.8, 8]} />
        <meshStandardMaterial color="#d9cdb0" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** vzdálená česká krajina — měkké zelené vlny v soumraku */
function DistantLand() {
  return (
    <group>
      {[
        { p: [-30, -0.6, -40], s: [60, 4, 22] },
        { p: [30, -0.8, -46], s: [70, 3.2, 20] },
        { p: [-8, -1.0, -55], s: [80, 2.6, 18] },
      ].map((h, i) => (
        <mesh key={i} position={h.p as [number, number, number]} scale={h.s as [number, number, number]}>
          <sphereGeometry args={[1, 20, 10]} />
          <meshStandardMaterial color={i === 1 ? '#40543a' : '#475c40'} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

/** obloha — teplý soumrak, slunce za Řípem */
function SkySun() {
  const mat = React.useMemo(
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
            vec3 c = d.y > 0.16 ? mix(mid, top, smoothstep(0.16, 0.7, d.y))
                              : mix(low, mid, smoothstep(-0.04, 0.16, d.y));
            float s = max(dot(d, sunDir), 0.0);
            c += vec3(1.0, 0.92, 0.66) * pow(s, 260.0) * 3.2
               + vec3(1.0, 0.72, 0.4) * pow(s, 30.0) * 0.5
               + vec3(0.95, 0.55, 0.26) * pow(s, 7.0) * 0.22;
            gl_FragColor = vec4(c, 1.0);
          }
        `,
        uniforms: {
          top: { value: new THREE.Color('#31406a') },
          mid: { value: new THREE.Color('#c98444') },
          low: { value: new THREE.Color('#e8b06a') },
          sunDir: { value: new THREE.Vector3(-0.5, 0.07, -0.86).normalize() },
        },
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[240, 24, 16]} />
    </mesh>
  );
}

export function GoldenRepublicBohemiaScene({ lang }: { lang: Lang }) {
  return (
    <>
      <SkySun />

      {/* země pod komplexem */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, 0]} receiveShadow>
        <circleGeometry args={[180, 72]} />
        <meshStandardMaterial color="#4d6039" roughness={0.98} />
      </mesh>

      <Terraces />
      <DecisionCircle />
      <OakTree />
      {HALLS.map((h) => (
        <Hall key={h.az} def={h} />
      ))}
      <EntrancePath />
      <Waters />
      <ForestRing />
      <DistantLand />
      <Rip />

      {/* labely */}
      <SceneLabel position={[polar(315, HALL_DIST)[0], 4.0, polar(315, HALL_DIST)[1]]} text={lang === 'cs' ? 'Síň Mýtu' : 'Hall of Myth'} />
      <SceneLabel position={[polar(45, HALL_DIST)[0], 4.0, polar(45, HALL_DIST)[1]]} text={lang === 'cs' ? 'Síň Protokolu' : 'Hall of Protocol'} />
      <SceneLabel position={[polar(180, HALL_DIST)[0], 4.0, polar(180, HALL_DIST)[1]]} text={lang === 'cs' ? 'Síň Služby' : 'Hall of Service'} />
      <SceneLabel position={[0, 8.6, 0]} text={lang === 'cs' ? 'Decision Circle · Strom života' : 'Decision Circle · Tree of Life'} />
      <SceneLabel position={[-46, 17.5, -62]} text="Říp · osa Čech" />
    </>
  );
}

export const BOHEMIA_CAMERA = { position: [0, 8.5, 28.5] as [number, number, number], fov: 46, far: 2000 };
export const BOHEMIA_CONTROLS = { autoRotate: true, autoRotateSpeed: 0.2, minDistance: 12, maxDistance: 75, maxPolarAngle: Math.PI / 2 - 0.07, target: [0, 2.6, 0.5] as [number, number, number], enablePan: false };
export function BohemiaLighting() {
  return <>
    <ambientLight intensity={0.6} color="#ffe9c4" />
    <hemisphereLight args={['#d3e2f5', '#3a4530', 0.6]} />
    {/* západ slunce za Řípem — zlatý backlight */}
    <directionalLight position={[-18, 9, -22]} intensity={2.2} color="#ffbe72" castShadow />
    <directionalLight position={[16, 14, 14]} intensity={0.7} color="#ffe0b0" />
  </>;
}
