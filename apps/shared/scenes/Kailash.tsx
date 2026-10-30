/** @jsxRuntime classic */
'use client';

import { React, useFrame, useEffect, useMemo, useRef, THREE } from '@genesis/runtime';
import { SceneLabel } from './SceneLabel';

type Lang = 'cs' | 'en';

/* ─── Kailash — Posvátná hora · L5 Spiritual Center · Himaláje ─────────
 * Dle hero: pyramidální Kailash s vrstevnatými svahy a sněhovou čepicí
 * dominuje obzoru, sluneční koruna nad vrcholem. Pod horou tyrkysová
 * ledasovcová jezera, klášter se zlatými střechami, zlatý chorten,
 * modlitební vlajky, kamenné cairny s OM a poutníci na stezce kory.
 */

const rng = (s: number) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
const FLAG_COLORS = ['#2a5fd0', '#f0eee6', '#c03a2e', '#2a8a4a', '#e0b83e'];

/** vrstevnatá skalní textura pro Kailash — vodorovná pásma se sněhem */
function strataTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#4a4038'; ctx.fillRect(0, 0, 512, 512);
  let seed = 5; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  // horizontální pásma skály
  for (let y = 0; y < 512; y += 8 + rnd() * 18) {
    const h = 3 + rnd() * 12;
    ctx.fillStyle = rnd() > 0.5 ? `rgba(96,84,70,${0.4 + rnd() * 0.4})` : `rgba(44,38,32,${0.4 + rnd() * 0.4})`;
    ctx.fillRect(0, y, 512, h);
  }
  // sněhová pásma — hustší nahoře (v textuře dole = vrchol kužele)
  for (let i = 0; i < 60; i++) {
    const y = rnd() * 512;
    const w = 30 + rnd() * 120;
    ctx.fillStyle = `rgba(235,240,246,${0.25 + rnd() * 0.5})`;
    ctx.beginPath();
    ctx.ellipse(rnd() * 512, 500 - Math.pow(rnd(), 0.6) * 512, w, 4 + rnd() * 9, rnd() * 0.4 - 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Kailash — charakteristická pyramida se seříznutým vrcholem */
function MountKailash() {
  const { geo, tex } = useMemo(() => {
    const g = new THREE.ConeGeometry(1, 1, 4, 8);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      // jemné zvlnění svahů
      const n = Math.sin(v.x * 9) * 0.04 + Math.sin(v.z * 11) * 0.04 + Math.sin(v.y * 14) * 0.03;
      // plošší vrchol
      let y = v.y;
      if (y > 0.36) y = 0.36 + (y - 0.36) * 0.55;
      pos.setXYZ(i, v.x * (1 + n), y, v.z * (1 + n));
    }
    g.scale(26, 42, 22);
    g.computeVertexNormals();
    return { geo: g, tex: strataTexture() };
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={[26, 18, -88]} rotation={[0, Math.PI / 5.5, 0]}>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
      {/* sněhová čepice */}
      <mesh position={[0, 16.6, 0]} scale={[1.12, 1, 1.12]}>
        <coneGeometry args={[8.6, 9, 4]} />
        <meshStandardMaterial color="#eef2f6" roughness={0.55} />
      </mesh>
      {/* podstavce */}
      {[...Array(4)].map((_, i) => (
        <mesh key={i} position={[-14 + i * 9 - rng(i) * 3, -14 + rng(i + 2) * 2, 8 + rng(i + 4) * 4]} scale={[4.5, 2.5 + rng(i + 6) * 1.5, 4]}>
          <sphereGeometry args={[1.6, 7, 6]} />
          <meshStandardMaterial color="#3a3430" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

/** hřeben Himálají — zubaté sněhové štíty v pozadí */
function HimalayaRange() {
  const peaks = useMemo(() => {
    const arr: { p: [number, number, number]; h: number; r: number }[] = [];
    for (let i = 0; i < 11; i++) {
      arr.push({
        p: [-95 + i * 16 + rng(i) * 8, 6 + rng(i + 2) * 4, -95 - rng(i + 4) * 12],
        h: 16 + rng(i + 3) * 12,
        r: 7 + rng(i + 5) * 4,
      });
    }
    return arr;
  }, []);
  return (
    <group>
      {peaks.map((p, i) => (
        <group key={i} position={p.p}>
          <mesh castShadow>
            <coneGeometry args={[p.r, p.h, 5]} />
            <meshStandardMaterial color="#4a4440" roughness={0.95} flatShading />
          </mesh>
          <mesh position={[0, p.h * 0.32, 0]}>
            <coneGeometry args={[p.r * 0.45, p.h * 0.36, 5]} />
            <meshStandardMaterial color="#e8eef4" roughness={0.6} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** ledasovcové jezero — tyrkysová hladina */
function GlacialLake({ x, z, r = 9, sx = 1 }: { x: number; z: number; r?: number; sx?: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} scale={[sx, 1, 1]}>
        <circleGeometry args={[r, 30]} />
        <meshStandardMaterial color="#2a9aa8" roughness={0.08} metalness={0.15} emissive="#1a6a76" emissiveIntensity={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={[sx * 1.14, 1.14, 1]}>
        <ringGeometry args={[r * 0.98, r * 1.0, 30]} />
        <meshStandardMaterial color="#c8d8ce" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** tibetský klášter — bílé bloky se zlatými střechami na svahu */
function Monastery({ x, z }: { x: number; z: number }) {
  const halls: [number, number, number, number][] = [
    [0, 0, 5.5, 2.6], [4.2, 0.4, 4, 2.2], [-4, 0.3, 3.6, 2], [1.8, -3, 3.4, 1.9], [-2.5, -3.4, 3, 1.7],
  ];
  return (
    <group position={[x, 0, z]}>
      {/* terasa na svahu */}
      <mesh position={[0, 0.9, -0.8]} receiveShadow>
        <boxGeometry args={[15, 1.8, 9.5]} />
        <meshStandardMaterial color="#9a9078" roughness={0.9} />
      </mesh>
      {halls.map(([hx, hz, w, h], i) => (
        <group key={i} position={[hx, 1.8 + h / 2, hz - 0.8]}>
          {/* bílá zeď s tibetským skloněním */}
          <mesh castShadow>
            <boxGeometry args={[w, h, w * 0.75]} />
            <meshStandardMaterial color="#e8e2d2" roughness={0.85} />
          </mesh>
          {/* černý pás oken */}
          <mesh position={[0, h * 0.2, w * 0.375 + 0.01]}>
            <planeGeometry args={[w * 0.8, h * 0.28]} />
            <meshStandardMaterial color="#2a2018" />
          </mesh>
          {/* zlatá střecha */}
          <mesh position={[0, h / 2 + 0.3, 0]}>
            <boxGeometry args={[w + 0.4, 0.35, w * 0.75 + 0.4]} />
            <meshStandardMaterial color="#d9a832" metalness={0.7} roughness={0.3} emissive="#8a5a10" emissiveIntensity={0.35} />
          </mesh>
        </group>
      ))}
      {/* centrální zlatý chrám */}
      <group position={[0, 5.1, -0.6]}>
        <mesh castShadow>
          <boxGeometry args={[3.2, 2.6, 2.8]} />
          <meshStandardMaterial color="#f0e8d8" roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.6, 0]}>
          <coneGeometry args={[2.4, 1.4, 4]} />
          <meshStandardMaterial color="#e0b040" metalness={0.75} roughness={0.25} emissive="#a06a14" emissiveIntensity={0.5} />
        </mesh>
      </group>
    </group>
  );
}

/** zlatý chorten — stupněný sokl, kupole, věnec, slunce/měsíc */
function Chorten({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0, z]} scale={[s, s, s]}>
      {[...Array(3)].map((_, i) => (
        <mesh key={i} position={[0, 0.4 + i * 0.7, 0]}>
          <boxGeometry args={[4.4 - i * 0.9, 0.7, 4.4 - i * 0.9]} />
          <meshStandardMaterial color="#e8e0cc" roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, 2.9, 0]} castShadow>
        <sphereGeometry args={[1.35, 14, 10]} />
        <meshStandardMaterial color="#f0e8d4" roughness={0.75} />
      </mesh>
      {/* zlatý věnec 13 kruhů */}
      {[...Array(7)].map((_, i) => (
        <mesh key={i} position={[0, 3.9 + i * 0.32, 0]}>
          <cylinderGeometry args={[0.55 - i * 0.055, 0.55 - i * 0.055, 0.28, 10]} />
          <meshStandardMaterial color="#d9a832" metalness={0.75} roughness={0.28} emissive="#8a5a10" emissiveIntensity={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 6.35, 0]}>
        <coneGeometry args={[0.45, 0.85, 8]} />
        <meshStandardMaterial color="#e8bc48" metalness={0.8} roughness={0.25} emissive="#c08a20" emissiveIntensity={0.7} />
      </mesh>
      <pointLight position={[0, 6.5, 0]} intensity={1.2} color="#ffca5e" distance={8} decay={2} />
    </group>
  );
}

/** modlitební vlajky — instancované barevné obdélníky na šňůrách */
function PrayerFlags({ anchors }: { anchors: { from: [number, number, number]; to: [number, number, number] }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = useMemo(() => anchors.length * 14, [anchors]);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    let k = 0;
    for (const a of anchors) {
      const from = new THREE.Vector3(...a.from);
      const to = new THREE.Vector3(...a.to);
      for (let i = 0; i < 14; i++) {
        const t = (i + 0.5) / 14;
        const p = from.clone().lerp(to, t);
        p.y -= Math.sin(t * Math.PI) * 1.6; // prověšení
        dummy.position.copy(p);
        dummy.rotation.set(-0.15, Math.atan2(to.x - from.x, to.z - from.z), 0);
        dummy.updateMatrix();
        m.setMatrixAt(k, dummy.matrix);
        m.setColorAt(k, col.set(FLAG_COLORS[i % 5]));
        k++;
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [anchors]);
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
        <planeGeometry args={[0.85, 0.6]} />
        <meshStandardMaterial side={THREE.DoubleSide} roughness={0.9} />
      </instancedMesh>
      {/* šňůry */}
      {anchors.map((a, i) => {
        const from = new THREE.Vector3(...a.from);
        const to = new THREE.Vector3(...a.to);
        const mid = from.clone().lerp(to, 0.5); mid.y -= 1.6;
        const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
        return (
          <mesh key={i}>
            <tubeGeometry args={[curve, 16, 0.025, 4]} />
            <meshStandardMaterial color="#e8e0cc" roughness={0.9} />
          </mesh>
        );
      })}
    </>
  );
}

/** stožár s vlajkami — tarboche */
function FlagPole({ x, z, h = 7, yaw = 0 }: { x: number; z: number; h?: number; yaw?: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.14, h, 6]} />
        <meshStandardMaterial color="#6a4a2e" roughness={0.9} />
      </mesh>
      <mesh position={[0, h + 0.2, 0]}>
        <sphereGeometry args={[0.22, 8, 6]} />
        <meshStandardMaterial color="#d9a832" metalness={0.7} roughness={0.3} />
      </mesh>
      <PrayerFlags anchors={[
        { from: [0, h - 0.3, 0], to: [Math.sin(yaw) * 5, 1, Math.cos(yaw) * 5] },
        { from: [0, h - 0.3, 0], to: [Math.sin(yaw + 2.1) * 5, 0.9, Math.cos(yaw + 2.1) * 5] },
        { from: [0, h - 0.3, 0], to: [Math.sin(yaw + 4.2) * 5, 1.1, Math.cos(yaw + 4.2) * 5] },
      ]} />
    </group>
  );
}

/** kamenný cairn — navrstvené kameny */
function Cairn({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0, z]} scale={[s, s, s]}>
      {[...Array(4)].map((_, i) => (
        <mesh key={i} position={[0, 0.28 + i * 0.42, 0]} scale={[1 - i * 0.17, 0.55, 0.8 - i * 0.14]} castShadow>
          <sphereGeometry args={[1.1 - i * 0.1, 8, 6]} />
          <meshStandardMaterial color={['#7a6a56', '#6a5a48', '#8a7a62', '#5a4c3e'][i]} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

/** poutníci na koře — jdoucí postavy s hůlkami */
function Pilgrims({ path }: { path: [number, number][] }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.getElapsedTime() * 0.02;
    const n = path.length;
    g.children.forEach((c, i) => {
      const t2 = (t + i / g.children.length) % 1;
      const seg = Math.min(Math.floor(t2 * (n - 1)), n - 2);
      const f = t2 * (n - 1) - seg;
      const [x1, z1] = path[seg], [x2, z2] = path[seg + 1];
      c.position.set(x1 + (x2 - x1) * f, 0.02, z1 + (z2 - z1) * f);
      c.rotation.y = Math.atan2(x2 - x1, z2 - z1);
      c.children[0].position.y = 0.75 + Math.abs(Math.sin(clock.getElapsedTime() * 3 + i * 2)) * 0.06;
    });
  });
  return (
    <group ref={group}>
      {[...Array(7)].map((_, i) => (
        <group key={i}>
          <mesh castShadow>
            <capsuleGeometry args={[0.22, 0.62, 4, 6]} />
            <meshStandardMaterial color={['#8a4a30', '#a05a38', '#6a3a28', '#b06a42', '#7a4a3a', '#96522e', '#5a3a2c'][i]} roughness={0.9} />
          </mesh>
          <mesh position={[0.3, 0.9, 0]} rotation={[0, 0, -0.15]}>
            <cylinderGeometry args={[0.025, 0.03, 1.5, 4]} />
            <meshStandardMaterial color="#4a3826" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** krajina — údolí, stezka kory, skály, tráva */
function Valley() {
  const rocks = useMemo(() => {
    const arr: { p: [number, number]; s: number }[] = [];
    for (let i = 0; i < 60; i++) {
      const a = rng(i + 3) * Math.PI * 2;
      const r = 18 + rng(i + 7) * 60;
      const z = Math.cos(a) * r;
      if (z < -58 || (Math.abs(Math.sin(a) * r) < 16 && z > -20 && z < 22)) continue;
      arr.push({ p: [Math.sin(a) * r * 1.4, z], s: 0.3 + rng(i + 5) * 1 });
    }
    return arr;
  }, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <circleGeometry args={[220, 72]} />
        <meshStandardMaterial color="#5a4e3a" roughness={0.98} />
      </mesh>
      {/* světlejší pás údolí */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, -10]}>
        <ringGeometry args={[0, 42, 48]} />
        <meshStandardMaterial color="#6a5e44" roughness={0.95} />
      </mesh>
      {rocks.map((p, i) => (
        <mesh key={i} position={[p.p[0], 0.3 * p.s, p.p[1]]} scale={[1.5, p.s, 1.3]} castShadow>
          <sphereGeometry args={[0.7, 6, 5]} />
          <meshStandardMaterial color={i % 3 ? '#6a5e48' : '#55683c'} roughness={0.95} />
        </mesh>
      ))}
      {/* stezka kory — světlý pruh */}
      <mesh rotation={[-Math.PI / 2, 0, 0.35]} position={[-14, 0.02, 12]}>
        <planeGeometry args={[3, 52]} />
        <meshStandardMaterial color="#8a7a5c" roughness={0.95} />
      </mesh>
    </group>
  );
}

/** obloha — zlatá hodina, slunce za vrcholem Kailashe, pás mraků */
function KailashSky() {
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
          uniform vec3 sunDir;
          float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
          float noise(vec2 p){
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash(vec3(i, 1.0)), b = hash(vec3(i + vec2(1.0, 0.0), 1.0));
            float c = hash(vec3(i + vec2(0.0, 1.0), 1.0)), d = hash(vec3(i + vec2(1.0, 1.0), 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
          }
          void main(){
            vec3 d = normalize(vP);
            vec3 top = vec3(0.10, 0.22, 0.42);
            vec3 hor = vec3(0.92, 0.62, 0.38);
            vec3 c = mix(hor, top, smoothstep(-0.02, 0.5, d.y));
            // slunce za vrcholem
            float s = max(dot(d, sunDir), 0.0);
            c += vec3(1.0, 0.9, 0.6) * pow(s, 900.0) * 3.6
               + vec3(1.0, 0.72, 0.4) * pow(s, 40.0) * 0.6
               + vec3(0.95, 0.6, 0.3) * pow(s, 6.0) * 0.3;
            // pás tenkých mraků
            float cl = noise(vec2(d.x * 6.0, d.y * 14.0)) * 0.5 + noise(vec2(d.x * 14.0, d.y * 30.0)) * 0.5;
            float band = smoothstep(0.48, 0.7, cl) * smoothstep(0.02, 0.1, d.y) * smoothstep(0.5, 0.2, d.y);
            c = mix(c, vec3(0.95, 0.85, 0.72), band * 0.5);
            // měsíc — jemný kotouč vlevo nahoře
            vec3 mdir = normalize(vec3(-0.7, 0.55, -0.3));
            float moon = smoothstep(0.028, 0.02, length(d - mdir));
            c = mix(c, vec3(0.85, 0.88, 0.9), moon * 0.55);
            gl_FragColor = vec4(c, 1.0);
          }
        `,
        uniforms: {
          sunDir: { value: new THREE.Vector3(0.22, 0.17, -0.96).normalize() },
        },
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[400, 32, 20]} />
    </mesh>
  );
}

export function KailashScene({ lang }: { lang: Lang }) {
  const cs = lang === 'cs';
  const koraPath: [number, number][] = [[-30, 46], [-22, 34], [-16, 24], [-12, 14], [-10, 4], [-8, -6], [-4, -14]];
  return (
    <>
      <KailashSky />
      <fog attach="fog" args={['#b89468', 110, 330]} />

      <MountKailash />
      <HimalayaRange />
      <Valley />
      <GlacialLake x={-14} z={-24} r={8.5} sx={1.3} />
      <GlacialLake x={10} z={-30} r={6} sx={1.5} />
      <Monastery x={-6} z={-16} />
      <Chorten x={18} z={-8} s={1.15} />
      <Chorten x={-20} z={2} s={0.8} />

      {/* stožáry s vlajkami podél stezky */}
      <FlagPole x={-24} z={30} yaw={0.4} />
      <FlagPole x={-14} z={14} yaw={1.9} h={6} />
      <FlagPole x={2} z={-2} yaw={4.6} h={6.5} />
      <FlagPole x={14} z={8} yaw={3.2} h={5.5} />
      {/* cairny */}
      <Cairn x={-27} z={38} s={1.3} />
      <Cairn x={-11} z={20} s={0.9} />
      <Cairn x={6} z={10} s={1.1} />
      <Cairn x={22} z={-2} s={0.85} />
      <Pilgrims path={koraPath} />

      {/* labely */}
      <SceneLabel position={[26, 41, -88]} text={cs ? 'Kailash — posvátná hora' : 'Kailash — sacred mountain'} scale={3.6} />
      <SceneLabel position={[-6, 10.5, -16]} text={cs ? 'Klášter' : 'Monastery'} scale={1.9} />
      <SceneLabel position={[-14, 3, -24]} text={cs ? 'Ledasovcová jezera' : 'Glacial lakes'} scale={1.9} />
      <SceneLabel position={[18, 10, -8]} text={cs ? 'Zlatý chorten' : 'Golden chorten'} scale={1.9} />
      <SceneLabel position={[-24, 9, 30]} text={cs ? 'Modlitební vlajky' : 'Prayer flags'} scale={1.8} />
      <SceneLabel position={[-18, 2.5, 18]} text={cs ? 'Kora — stezka poutníků' : 'Kora — pilgrims\' path'} scale={1.9} />
    </>
  );
}

export const KAILASH_CAMERA = { position: [-6, 12, 58] as [number, number, number], fov: 46, far: 1200 };
export const KAILASH_CONTROLS = { autoRotate: true, autoRotateSpeed: 0.15, minDistance: 18, maxDistance: 150, maxPolarAngle: Math.PI / 2 - 0.06, target: [4, 12, -20] as [number, number, number], enablePan: false };
export function KailashLighting() {
  return <>
    <ambientLight intensity={0.6} color="#e8dcc8" />
    <hemisphereLight args={['#ffe8c0', '#3a3428', 0.75]} />
    <directionalLight position={[50, 40, -60]} intensity={2} color="#ffdca0" castShadow />
    <directionalLight position={[-40, 24, 40]} intensity={0.4} color="#a8c0e0" />
  </>;
}
