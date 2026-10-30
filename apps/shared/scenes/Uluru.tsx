/** @jsxRuntime classic */
'use client';

import { React, useFrame, useEffect, useMemo, useRef, THREE } from '@genesis/runtime';
import { SceneLabel } from './SceneLabel';
import { ScenePresentation, motionTime, motionDelta } from './ScenePresentation';

type Lang = 'cs' | 'en';

/* ─── Uluru — Tjukurpa · Songlines · Austrálie ────────────────────────
 * Dle hero: červený monolit Uluru s vertikálním žíháním dominuje
 * obzoru při západu slunce, pod ním pouštní údolí s festivalovou
 * osadou — membránové plachty, oheň v kruhu, svítící songlines cesty,
 * pouštní dubby, zlatá socha listu, solární pavilon — a nad vším
 * Mléčná dráha.
 */

const rng = (s: number) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
const DEG = Math.PI / 180;
function polar(azDeg: number, d: number): [number, number] {
  const a = azDeg * DEG;
  return [Math.sin(a) * d, -Math.cos(a) * d];
}

/** textura vertikálního žíhání pro Uluru */
function uluruTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#b0472c'); grad.addColorStop(0.55, '#a03c24'); grad.addColorStop(1, '#7e2f1c');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 1024, 256);
  // vertikální drážky — světlé a tmavé pruhy
  let seed = 7; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  for (let i = 0; i < 190; i++) {
    const x = rnd() * 1024, w = 1.5 + rnd() * 7, y0 = rnd() * 60;
    const light = rnd() > 0.55;
    ctx.fillStyle = light ? `rgba(220,120,80,${0.1 + rnd() * 0.16})` : `rgba(90,30,18,${0.12 + rnd() * 0.2})`;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.bezierCurveTo(x + w * 0.6, 90 + rnd() * 40, x - w * 0.5, 160 + rnd() * 40, x + w * 0.3, 256);
    ctx.lineTo(x + w, 256);
    ctx.bezierCurveTo(x + w * 1.3, 180, x + w * 0.7, 100, x + w, y0);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** Uluru — masivní monolit s drážkovanými svahy, mírně zvlněný hřbet */
function UluruRock() {
  const { geo, tex } = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 72, 36);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      // protažený hřbet — x~3.4, z~1.5, jemné zvlnění profilu
      const n = Math.sin(v.x * 6.5) * 0.06 + Math.sin(v.x * 13.7) * 0.03;
      const top = Math.max(0, v.y);
      let y = v.y * (1 + n * (top > 0.1 ? 1 : 0));
      // plošší vrchol — sedlový profil
      if (top > 0.55) y = v.y * (1 - (top - 0.55) * 0.35);
      pos.setXYZ(i, v.x, y, v.z);
    }
    g.scale(38, 18, 16);
    g.computeVertexNormals();
    return { geo: g, tex: uluruTexture() };
  }, []);
  useEffect(() => () => { tex.dispose(); geo.dispose(); }, [tex, geo]);
  return (
    <group position={[6, 0, -95]}>
      <mesh geometry={geo} position={[0, -0.5, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={tex} roughness={0.92} />
      </mesh>
      {/* talus — rozpadliny u paty */}
      {[...Array(9)].map((_, i) => {
        const a = rng(i + 4) * Math.PI * 2;
        const rr = 17 + rng(i) * 7;
        return (
          <mesh key={i} position={[Math.sin(a) * rr * 1.9 - 4, 0.4, Math.cos(a) * rr * 0.8 + 2]}>
            <sphereGeometry args={[1.2 + rng(i + 2) * 1.8, 7, 6]} />
            <meshStandardMaterial color="#8a3520" roughness={0.95} />
          </mesh>
        );
      })}
    </group>
  );
}

/** membránová plachta — napnutá bílá plachta mezi 4 kůly (hyperboloid) */
function ShadeSail({ x, z, s = 1, yaw = 0 }: { x: number; z: number; s?: number; yaw?: number }) {
  const sail = useMemo(() => {
    const w = 5.4 * s;
    const pts: THREE.Vector3[] = [];
    // napnutá plachta — 4 rohy v různých výškách (hypar)
    const corners = [[-w / 2, 2.6, -w / 2], [w / 2, 1.9, -w / 2], [w / 2, 2.7, w / 2], [-w / 2, 1.8, w / 2]];
    const N = 8;
    const verts: number[] = [], idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const u = i / N, vv = j / N;
        // bilinear interpolace 4 rohů
        const p = new THREE.Vector3()
          .addScaledVector(new THREE.Vector3(...corners[0] as [number, number, number]), (1 - u) * (1 - vv))
          .addScaledVector(new THREE.Vector3(...corners[1] as [number, number, number]), u * (1 - vv))
          .addScaledVector(new THREE.Vector3(...corners[2] as [number, number, number]), u * vv)
          .addScaledVector(new THREE.Vector3(...corners[3] as [number, number, number]), (1 - u) * vv);
        verts.push(p.x, p.y, p.z);
        if (i === 0) pts.push(p.clone());
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const a = i * (N + 1) + j, b = a + 1, c = a + N + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return { g, corners };
  }, [s]);
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      {sail.corners.map((c, i) => (
        <mesh key={i} position={[c[0] * 0.96, c[1] / 2, c[2] * 0.96]}>
          <cylinderGeometry args={[0.05, 0.07, c[1], 5]} />
          <meshStandardMaterial color="#7a6a50" roughness={0.8} />
        </mesh>
      ))}
      <mesh geometry={sail.g} castShadow>
        <meshStandardMaterial color="#efe8da" roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** oheň v kruhu — plamen + sedící lidé */
function FireCircle() {
  const fire = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!fire.current) return;
    const t = motionTime(clock);
    fire.current.children.forEach((c, i) => {
      c.scale.y = 0.8 + Math.sin(t * 6 + i * 2.1) * 0.25;
      c.rotation.y = t * (0.4 + i * 0.1);
    });
  });
  return (
    <group position={[0, 0, 6]}>
      {/* kamenný kruh */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[2.1, 2.3, 0.3, 24]} />
        <meshStandardMaterial color="#8a6a4a" roughness={0.9} />
      </mesh>
      {[...Array(10)].map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 2.0, 0.32, Math.cos(a) * 2.0]}>
            <sphereGeometry args={[0.28, 7, 6]} />
            <meshStandardMaterial color="#6b563c" roughness={0.95} />
          </mesh>
        );
      })}
      {/* plamen */}
      <group ref={fire} position={[0, 0.3, 0]}>
        {[...Array(3)].map((_, i) => (
          <mesh key={i} position={[0, 0.5 + i * 0.28, 0]}>
            <coneGeometry args={[0.5 - i * 0.13, 1.3 - i * 0.25, 7]} />
            <meshStandardMaterial color={['#ff9a2e', '#ffc23e', '#ffe98a'][i]} emissive={['#ff7a1a', '#ff9a1a', '#ffca3a'][i]} emissiveIntensity={1.3} transparent opacity={0.9} />
          </mesh>
        ))}
      </group>
      <pointLight position={[0, 1.6, 0]} intensity={5} color="#ff9a3e" distance={16} decay={2} />
      {/* sedící lidé v kruhu */}
      {[...Array(14)].map((_, i) => {
        const a = (i / 14) * Math.PI * 2 + 0.2;
        const r = 3.1 + (i % 3) * 0.5;
        return (
          <mesh key={i} position={[Math.sin(a) * r, 0.35, Math.cos(a) * r]} rotation={[0.2, a + Math.PI, 0]}>
            <capsuleGeometry args={[0.18, 0.5, 4, 6]} />
            <meshStandardMaterial color={['#4a3a30', '#5a4a3a', '#3a3430'][i % 3]} roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

/** svítící songline cesta — křivka napříč údolím */
function Songline({ pts, color = '#ffb050' }: { pts: [number, number][]; color?: string }) {
  const geo = useMemo(() => {
    const v = pts.map(([x, z], i) => new THREE.Vector3(x, 0.12 + Math.sin(i * 1.3) * 0.06, z));
    const curve = new THREE.CatmullRomCurve3(v);
    return new THREE.TubeGeometry(curve, 60, 0.14, 5);
  }, [pts]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.6} transparent opacity={0.55} />
    </mesh>
  );
}

/** zlatá socha listu — dvě propletené elipsy se světelným jádrem */
function LeafSculpture({ x, z }: { x: number; z: number }) {
  const core = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = core.current?.material as THREE.MeshStandardMaterial | undefined;
    if (m) m.emissiveIntensity = 0.9 + Math.sin(motionTime(clock) * 1.6) * 0.3;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[1.4, 1.7, 0.8, 10]} />
        <meshStandardMaterial color="#6b5a42" roughness={0.85} />
      </mesh>
      {/* dva zlaté oblouky ve tvaru listu */}
      {[0.32, -0.32].map((tilt, i) => (
        <mesh key={i} position={[0, 4.6, 0]} rotation={[0, i * Math.PI / 2.6, tilt]} scale={[0.14, 1, 0.62]}>
          <torusGeometry args={[3.6, 0.13, 8, 40]} />
          <meshStandardMaterial color="#d9b45c" metalness={0.8} roughness={0.3} emissive="#a06a1a" emissiveIntensity={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 4.6, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.14, 1, 0.62]}>
        <torusGeometry args={[3.6, 0.13, 8, 40]} />
        <meshStandardMaterial color="#d9b45c" metalness={0.8} roughness={0.3} emissive="#a06a1a" emissiveIntensity={0.4} />
      </mesh>
      <mesh ref={core} position={[0, 4.6, 0]}>
        <sphereGeometry args={[0.5, 10, 8]} />
        <meshStandardMaterial color="#ffe9b0" emissive="#ffca5e" emissiveIntensity={1} />
      </mesh>
      <pointLight position={[0, 4.8, 0]} intensity={2} color="#ffca5e" distance={12} decay={2} />
    </group>
  );
}

/** solární pavilon — skloněné panely na rámu */
function SolarPavilion({ x, z, yaw = 0 }: { x: number; z: number; yaw?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      {[...Array(4)].map((_, i) => (
        <mesh key={i} position={[(i % 2) * 4.4 - 2.2, 1.4, Math.floor(i / 2) * 2.6 - 1.3]}>
          <cylinderGeometry args={[0.08, 0.1, 2.8, 6]} />
          <meshStandardMaterial color="#7a6a50" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 3.1, 0]} rotation={[-0.22, 0, 0]} castShadow>
        <boxGeometry args={[5.4, 0.12, 3.4]} />
        <meshStandardMaterial color="#2a3d52" roughness={0.25} metalness={0.6} emissive="#3a5a7a" emissiveIntensity={0.25} />
      </mesh>
      {/* mřížka článků */}
      {[-1.3, 0, 1.3].map((o, i) => (
        <mesh key={i} position={[o, 3.18, 0]} rotation={[-0.22, 0, 0]}>
          <boxGeometry args={[0.06, 0.02, 3.3]} />
          <meshStandardMaterial color="#8ab0d0" roughness={0.4} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/** malá kopule osady */
function HabDome({ x, z, r = 2.6 }: { x: number; z: number; r?: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, r * 0.42, 0]} castShadow>
        <sphereGeometry args={[r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e8dcc8" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[r + 0.2, r + 0.3, 0.25, 18]} />
        <meshStandardMaterial color="#8a7a5c" roughness={0.9} />
      </mesh>
      {/* světlo ve dveřích */}
      <mesh position={[0, 0.9, r * 0.94]} rotation={[0, 0, 0]}>
        <planeGeometry args={[0.9, 1.4]} />
        <meshStandardMaterial color="#2e3d4c" emissive="#ffca70" emissiveIntensity={1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** pouštní krajina — červená zem, dubby, keře, skaliska v popředí */
function Outback() {
  const plants = useMemo(() => {
    const arr: { p: [number, number]; s: number; t: number }[] = [];
    for (let i = 0; i < 150; i++) {
      const a = rng(i + 5) * Math.PI * 2;
      const r = 12 + rng(i + 11) * 85;
      const z = Math.cos(a) * r;
      // volný prostor pro osadu a Uluru koridor
      if (Math.abs(Math.sin(a) * r) < 13 && z > -8 && z < 26) continue;
      const x = Math.sin(a) * r * 1.3;
      // stromy drží odstup od popředních skalisek a osady
      if (z > 30 && Math.abs(x) < 34) continue;
      arr.push({ p: [x, z], s: 0.28 + rng(i + 3) * 0.75, t: rng(i + 7) });
    }
    return arr;
  }, []);
  return (
    <group>
      {/* červená pouštní zem */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <circleGeometry args={[200, 80]} />
        <meshStandardMaterial color="#8a4a30" roughness={0.98} />
      </mesh>
      {/* světlejší pás půdy pod osadou */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 8]}>
        <ringGeometry args={[0, 30, 48]} />
        <meshStandardMaterial color="#9a5a38" roughness={0.95} />
      </mesh>
      {/* pouštní dubby + keře */}
      {plants.map((p, i) => (
        <group key={i} position={[p.p[0], 0, p.p[1]]}>
          {p.t > 0.72 ? (
            <>
              <mesh position={[0, 1.3 * p.s, 0]} castShadow>
                <cylinderGeometry args={[0.1 * p.s, 0.17 * p.s, 2.6 * p.s, 5]} />
                <meshStandardMaterial color="#4a3826" roughness={0.95} />
              </mesh>
              <mesh position={[0, 2.7 * p.s, 0]} scale={[1, 0.9, 1]} castShadow>
                <sphereGeometry args={[1.05 * p.s, 7, 5]} />
                <meshStandardMaterial color={i % 2 ? '#4a5e30' : '#556838'} roughness={0.95} />
              </mesh>
            </>
          ) : (
            <mesh position={[0, 0.5 * p.s, 0]} scale={[1.4, p.s, 1.4]}>
              <sphereGeometry args={[0.6, 6, 5]} />
              <meshStandardMaterial color={['#5a5e34', '#6a5e38', '#4a5230'][i % 3]} roughness={0.95} />
            </mesh>
          )}
        </group>
      ))}
      {/* červené skalisko v popředí */}
      {[...Array(7)].map((_, i) => {
        const a = -0.5 + i * 0.24;
        return (
          <mesh key={i} position={[Math.sin(a) * 34, 0.4 + rng(i) * 0.6, 38 + rng(i + 2) * 4]} scale={[1.8, 0.45 + rng(i + 4) * 0.35, 1.3]} castShadow>
            <sphereGeometry args={[1.6, 8, 6]} />
            <meshStandardMaterial color="#8a3a24" roughness={0.95} />
          </mesh>
        );
      })}
    </group>
  );
}

/** festivalová osada — plachty, kopule, lidi, lampiony */
function Settlement() {
  return (
    <group>
      <FireCircle />
      <ShadeSail x={-9} z={2} s={1.15} yaw={0.4} />
      <ShadeSail x={9.5} z={1} s={1.3} yaw={-0.3} />
      <ShadeSail x={-6} z={-7} s={0.9} yaw={1.1} />
      <ShadeSail x={7} z={-8.5} s={1.05} yaw={0.7} />
      <ShadeSail x={-14} z={-2.5} s={0.85} yaw={-0.8} />
      <HabDome x={-15} z={5.5} r={2.8} />
      <HabDome x={14.5} z={7} r={2.4} />
      <HabDome x={16} z={-4} r={3.0} />
      <SolarPavilion x={19} z={12} yaw={-0.5} />
      {/* chodící lidé */}
      {[...Array(20)].map((_, i) => {
        const a = rng(i + 30) * Math.PI * 2;
        const r = 5 + rng(i + 2) * 12;
        return (
          <mesh key={i} position={[Math.sin(a) * r, 0.5, 8 + Math.cos(a) * r * 0.55]} rotation={[0, a, 0]}>
            <capsuleGeometry args={[0.16, 0.62, 4, 6]} />
            <meshStandardMaterial color={['#4a3a30', '#6a5a48', '#3a4450', '#7a6a58'][i % 4]} roughness={0.9} />
          </mesh>
        );
      })}
      {/* lampiony na cestách */}
      {[...Array(10)].map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        const r = 12 + (i % 2) * 6;
        return (
          <group key={i} position={[Math.sin(a) * r, 0, 8 + Math.cos(a) * r * 0.6]}>
            <mesh position={[0, 0.7, 0]}>
              <cylinderGeometry args={[0.04, 0.06, 1.4, 4]} />
              <meshStandardMaterial color="#5a4a38" roughness={0.9} />
            </mesh>
            <mesh position={[0, 1.45, 0]}>
              <sphereGeometry args={[0.16, 8, 6]} />
              <meshStandardMaterial color="#ffd98a" emissive="#f4b95e" emissiveIntensity={1.5} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** obloha — západ slunce vlevo, Mléčná dráha přes zenit */
function UluruSky() {
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
          void main(){
            vec3 d = normalize(vP);
            float west = clamp(dot(normalize(d.xz), normalize(vec2(-1.0, -0.2))) * 0.5 + 0.5, 0.0, 1.0);
            vec3 night = mix(vec3(0.02, 0.04, 0.11), vec3(0.04, 0.07, 0.17), d.y * 0.5 + 0.5);
            vec3 dusk = mix(vec3(0.98, 0.6, 0.3), vec3(0.3, 0.24, 0.4), smoothstep(-0.05, 0.45, d.y));
            vec3 c = mix(night, dusk, clamp(west * (1.0 - smoothstep(0.05, 0.5, d.y)) * 1.3, 0.0, 1.0));
            // slunce nízko za obzorem
            float s = max(dot(d, sunDir), 0.0);
            c += vec3(1.0, 0.92, 0.62) * pow(s, 1600.0) * 3.2
               + vec3(1.0, 0.68, 0.38) * pow(s, 60.0) * 0.42
               + vec3(0.95, 0.5, 0.24) * pow(s, 8.0) * 0.16;
            // Mléčná dráha — diagonální pás přes oblohu
            vec3 mwN = normalize(vec3(0.62, 0.55, 0.3));
            float band = exp(-abs(dot(d, mwN)) * 8.0);
            c += vec3(0.4, 0.42, 0.6) * band * 0.55 * smoothstep(-0.05, 0.2, d.y);
            // hvězdy
            vec3 cell = floor(d * 320.0);
            float star = step(0.995, hash(cell));
            float tw = 0.6 + 0.4 * hash(cell + 1.0);
            c += vec3(1.0, 0.98, 0.92) * star * tw * 1.1 * (1.0 - smoothstep(0.1, 0.65, west)) * smoothstep(-0.02, 0.2, d.y);
            // měsíc — jemný srpek vpravo nahoře
            vec3 mdir = normalize(vec3(0.62, 0.62, -0.28));
            float md = length(d - mdir);
            float moon = (1.0 - smoothstep(0.028, 0.035, md)) - (1.0 - smoothstep(0.024, 0.03, length(d - mdir - vec3(0.014, 0.008, 0))));
            c += vec3(0.95, 0.92, 0.8) * max(moon, 0.0) * 0.9;
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
        uniforms: {
          sunDir: { value: new THREE.Vector3(-0.52, 0.06, -0.85).normalize() },
        },
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[360, 28, 18]} />
    </mesh>
  );
}

export function UluruScene({ lang }: { lang: Lang }) {
  const cs = lang === 'cs';
  return (
    <>
      <ScenePresentation camera={ULURU_CAMERA} target={ULURU_CONTROLS.target} />
      <UluruSky />
      <fog attach="fog" args={['#c97a4a', 120, 330]} />

      <UluruRock />
      <Outback />
      <Settlement />
      <LeafSculpture x={polar(115, 24)[0]} z={polar(115, 24)[1]} />
      {/* songlines — zářící cesty údolím */}
      <Songline pts={[[-60, -30], [-38, -16], [-18, -6], [-9, 2]]} />
      <Songline pts={[[9, 4], [26, 8], [44, 18], [62, 32]]} color="#ffca6e" />
      <Songline pts={[[-8, 3], [-16, 14], [-30, 30], [-46, 48]]} color="#8ad4c8" />
      <Songline pts={[[0, -6], [6, -20], [18, -38], [30, -58]]} color="#ffd98a" />

      {/* labely */}
      <SceneLabel position={[6, 22, -95]} text="Uluru · Tjukurpa" scale={4.2} />
      <SceneLabel position={[0, 4.6, 6]} text={cs ? 'Oheň v kruhu — shromáždění' : 'Fire circle — gathering'} scale={1.8} />
      <SceneLabel position={[polar(115, 24)[0], 9.6, polar(115, 24)[1]]} text={cs ? 'Socha listu' : 'Leaf sculpture'} scale={1.8} />
      <SceneLabel position={[19, 5, 12]} text={cs ? 'Solární pavilon' : 'Solar pavilion'} scale={1.7} />
      <SceneLabel position={[-9, 4.4, 2]} text={cs ? 'Festivalová osada' : 'Festival settlement'} scale={1.8} />
      <SceneLabel position={[-24, 1.6, 14]} text={cs ? 'Songlines — písněné stezky' : 'Songlines — sung paths'} scale={1.9} />
    </>
  );
}

export const ULURU_CAMERA = { position: [0, 13, 62] as [number, number, number], fov: 46, far: 1000 };
export const ULURU_CONTROLS = { autoRotate: true, autoRotateSpeed: 0.16, minDistance: 16, maxDistance: 150, maxPolarAngle: Math.PI / 2 - 0.06, target: [0, 7, -10] as [number, number, number], enablePan: false };
export function UluruLighting() {
  return <>
    <ambientLight intensity={0.55} color="#ffd8b0" />
    <hemisphereLight args={['#ffdcaa', '#4a3020', 0.7]} />
    <directionalLight position={[-80, 16, -30]} intensity={2} color="#ffb070" castShadow />
    <directionalLight position={[40, 26, 40]} intensity={0.45} color="#a8c8ff" />
  </>;
}
