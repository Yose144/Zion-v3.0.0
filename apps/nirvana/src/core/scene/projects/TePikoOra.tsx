'use client';

/**
 * Te Pīko Ora — Raiatea · Nirvana presentation.
 * Mirror of apps/website-v2.9/src/components/TePikoOraPreview.tsx —
 * keep the two visually in sync when iterating on the model.
 */

import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

type Lang = 'cs' | 'en';

interface Fare {
  angle: number;
  dist: number;
  w: number;
  len: number;
  name?: { cs: string; en: string };
}

const FARES: Fare[] = [
  { angle: Math.PI * 0.08, dist: 6.3, w: 2.5, len: 5.2, name: { cs: 'Community Hale · společenské', en: 'Community Hale' } },
  { angle: Math.PI * 0.42, dist: 6.5, w: 2.2, len: 4.6, name: { cs: 'Wayfinding Hale · navigace', en: 'Wayfinding Hale · navigation' } },
  { angle: Math.PI * 0.72, dist: 6.2, w: 2.3, len: 4.8, name: { cs: 'Learning & Culture Hale', en: 'Learning & Culture Hale' } },
  { angle: Math.PI * 1.05, dist: 6.4, w: 2.2, len: 4.6, name: { cs: 'Healing Hale · léčení', en: 'Healing Hale' } },
  { angle: Math.PI * 1.36, dist: 6.5, w: 2.1, len: 4.2 },
  { angle: Math.PI * 1.62, dist: 6.3, w: 2.0, len: 4.0 },
  { angle: Math.PI * 1.86, dist: 6.4, w: 2.1, len: 4.4 },
  { angle: Math.PI * 2.12 - Math.PI * 2, dist: 6.5, w: 2.2, len: 4.2 },
];

const LAGOON_Z = -10.5;

function gableGeometry(w: number, h: number) {
  return new THREE.ShapeGeometry(
    new THREE.Shape()
      .moveTo(-w / 2, 0)
      .lineTo(w / 2, 0)
      .lineTo(0, h)
      .closePath(),
  );
}

function Fare({ fare, lang }: { fare: Fare; lang: Lang }) {
  const { angle, dist, w, len, name } = fare;
  const x = Math.sin(angle) * dist;
  const z = Math.cos(angle) * dist;
  const roofH = w * 1.05;
  const slope = Math.hypot(w / 2, roofH) * 1.06;
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

  return (
    <group position={[x, 0, z]} rotation={[0, angle, 0]}>
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
      <mesh position={[0, 0.36, 0]} geometry={innerPrism} castShadow>
        <meshStandardMaterial color="#4a3520" roughness={0.95} emissive="#a85e20" emissiveIntensity={0.3} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * (w * 0.26), 0.35 + roofH * 0.52, 0]} rotation={[0, 0, s * pitch]} castShadow>
          <boxGeometry args={[slope, 0.07, len * 1.04]} />
          <meshStandardMaterial color="#a8894f" roughness={0.98} />
        </mesh>
      ))}
      <mesh position={[0, 0.35 + roofH, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, len * 1.18, 6]} />
        <meshStandardMaterial color="#5d4526" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.36, len * 0.47]} geometry={gable}>
        <meshStandardMaterial color="#5a4426" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.95, len * 0.48]}>
        <boxGeometry args={[w * 0.24, 1.15, 0.03]} />
        <meshStandardMaterial color="#1a0e04" emissive="#ff9a3c" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, 0.36, -len * 0.47]} rotation={[0, Math.PI, 0]} geometry={gable}>
        <meshStandardMaterial color="#3d2c18" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.18, len * 0.55]} receiveShadow castShadow>
        <boxGeometry args={[w * 0.4, 0.12, 0.5]} />
        <meshStandardMaterial color="#8d7f63" roughness={0.9} />
      </mesh>
      <pointLight position={[0, 0.9, len * 0.5]} intensity={0.9} distance={3.2} color="#ffaa55" decay={2} />

      {name && (
        <Html position={[0, roofH + 1.0, 0]} center distanceFactor={11}>
          <div className="gg-label">{name[lang]}</div>
        </Html>
      )}
    </group>
  );
}

function Palm({ pos, h = 4.2, lean = 0.12, scale = 1, fronds = 9 }: {
  pos: [number, number, number];
  h?: number;
  lean?: number;
  scale?: number;
  fronds?: number;
}) {
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
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.16, h, 7]} />
        <meshStandardMaterial color="#6e5233" roughness={0.95} />
      </mesh>
      <mesh position={[0, h, 0]} castShadow>
        <sphereGeometry args={[0.17, 8, 6]} />
        <meshStandardMaterial color="#5d4526" roughness={0.95} />
      </mesh>
      {leaves.map((l, i) => (
        <group key={i} position={[0, h + 0.06, 0]} rotation={[0, l.yaw, 0]}>
          <mesh position={[l.len * 0.45, 0.18, 0]} rotation={[0, 0, l.pitch * 0.5]} scale={[0.16, l.len * 0.62, 0.05]} castShadow>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={i % 3 === 0 ? '#4a8a3c' : i % 3 === 1 ? '#3d7a35' : '#55943f'} roughness={0.9} />
          </mesh>
          <mesh position={[l.len * 0.95, -0.02, 0]} rotation={[0, 0, l.pitch]} scale={[0.11, l.len * 0.55, 0.04]} castShadow>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={i % 3 === 0 ? '#3d7a35' : '#2f6a2d'} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CenterPiko({ lang }: { lang: Lang }) {
  const fireRef = useRef<THREE.PointLight>(null);
  const flameRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const flick = 1 + Math.sin(t * 9) * 0.16 + Math.sin(t * 23) * 0.08;
    if (fireRef.current) fireRef.current.intensity = 2.6 * flick;
    if (flameRef.current) flameRef.current.scale.set(1, flick, 1);
  });

  return (
    <group>
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.9, 0.1, Math.sin(a) * 1.9]} scale={[0.28, 0.16, 0.22]} rotation={[0, a, 0]} castShadow receiveShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#8d7f63" roughness={0.95} />
          </mesh>
        );
      })}
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
      {[0.35, 1.5, 2.6, 3.9, 5.1].map((a, i) => (
        <mesh key={`s${i}`} position={[Math.cos(a) * 1.25, 0.16, 0.9 + Math.sin(a) * 1.25]} rotation={[0, -a, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 0.8, 7]} />
          <meshStandardMaterial color="#6e5233" roughness={0.95} />
        </mesh>
      ))}

      <Palm pos={[0, 0, -0.6]} h={7.2} lean={0.05} fronds={13} />

      <Html position={[0, 8.6, -0.6]} center distanceFactor={12}>
        <div className="gg-label">{lang === 'cs' ? 'Te Pīko · srdce' : 'Te Pīko · heart'}</div>
      </Html>
    </group>
  );
}

function Tiki({ pos, h = 1.5 }: { pos: [number, number, number]; h?: number }) {
  return (
    <group position={pos}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.17, h, 7]} />
        <meshStandardMaterial color="#5d4526" roughness={0.9} />
      </mesh>
      <mesh position={[0, h + 0.14, 0]} castShadow>
        <boxGeometry args={[0.3, 0.32, 0.26]} />
        <meshStandardMaterial color="#6e5233" roughness={0.9} />
      </mesh>
      {[-0.07, 0.07].map((s) => (
        <mesh key={s} position={[s, h + 0.19, 0.135]}>
          <boxGeometry args={[0.05, 0.04, 0.02]} />
          <meshBasicMaterial color="#ffd98a" />
        </mesh>
      ))}
      <mesh position={[0, h + 0.38, 0]} castShadow>
        <coneGeometry args={[0.19, 0.2, 7]} />
        <meshStandardMaterial color="#4a3520" roughness={0.95} />
      </mesh>
      <pointLight position={[0, h + 0.25, 0.4]} intensity={0.5} distance={2.4} color="#ffaa55" decay={2} />
    </group>
  );
}

function PierAndCanoe() {
  const planks = 9;
  return (
    <group>
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
      {Array.from({ length: planks }, (_, i) => (
        <mesh key={`p${i}`} position={[0, 0.68, LAGOON_Z - 0.5 - i * 0.85]} receiveShadow castShadow>
          <boxGeometry args={[1.25, 0.07, 0.78]} />
          <meshStandardMaterial color={i % 2 ? '#7a5c34' : '#6e5233'} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 0.68, LAGOON_Z - planks * 0.85 - 0.5]} receiveShadow castShadow>
        <boxGeometry args={[2.6, 0.08, 1.8]} />
        <meshStandardMaterial color="#7a5c34" roughness={0.9} />
      </mesh>

      <group position={[1.9, 0.1, LAGOON_Z - 5.4]} rotation={[0, 0.35, 0]}>
        <mesh scale={[0.32, 0.24, 2.4]} castShadow>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color="#4a3520" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.16, 0]} scale={[0.2, 0.06, 1.9]}>
          <sphereGeometry args={[1, 10, 6]} />
          <meshStandardMaterial color="#241808" roughness={1} />
        </mesh>
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

function Villagers() {
  const people = useMemo(() => {
    const out: { p: [number, number, number]; s: number; c: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      const r = 1.05 + (i % 2) * 0.55;
      out.push({
        p: [Math.cos(a) * r, 0, 0.9 + Math.sin(a) * r],
        s: 0.32 + (i % 3) * 0.04,
        c: ['#c9a458', '#8a6b3a', '#a8552e', '#6b8a4a', '#b3681f'][i % 5],
      });
    }
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

function Jungle() {
  const { bushes, palms } = useMemo(() => {
    const b: { x: number; z: number; s: number; c: string }[] = [];
    const p: { x: number; z: number; s: number; lean: number }[] = [];
    let seed = 29;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const insideVillage = (x: number, z: number) => {
      const d = Math.hypot(x, z);
      if (d < 8.6) return true;
      if (z < LAGOON_Z + 0.8) return true;
      if (Math.abs(x) < 1.6 && z < -7) return true;
      if (Math.abs(x) < 5 && z > 8.4) return true;
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

function SkyMountainsSun() {
  const skyMat = useMemo(
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
            c += vec3(1.0, 0.92, 0.66) * pow(s, 160.0) * 2.6
               + vec3(1.0, 0.75, 0.42) * pow(s, 28.0) * 0.5
               + vec3(0.98, 0.62, 0.3) * pow(s, 6.0) * 0.22;
            gl_FragColor = vec4(c, 1.0);
          }
        `,
        uniforms: {
          top: { value: new THREE.Color('#2a3d55') },
          mid: { value: new THREE.Color('#c98a4a') },
          low: { value: new THREE.Color('#e8a85e') },
          sunDir: { value: new THREE.Vector3(-0.6, 0.05, -0.75).normalize() },
        },
      }),
    [],
  );

  const peaks = useMemo(
    () =>
      [
        { p: [-58, 0, -62], s: [30, 11, 18], c: '#5a6b60' },
        { p: [-36, 0, -72], s: [20, 8, 13], c: '#65766a' },
        { p: [-78, 0, -48], s: [24, 6.5, 15], c: '#52635a' },
        { p: [-18, 0, -78], s: [15, 5.5, 10], c: '#6b7c70' },
        { p: [44, 0, -70], s: [22, 6, 13], c: '#5d6e63' },
      ] as { p: [number, number, number]; s: [number, number, number]; c: string }[],
    [],
  );

  return (
    <>
      <mesh material={skyMat} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[140, 24, 16]} />
      </mesh>
      {peaks.map((m, i) => (
        <mesh key={i} position={[m.p[0], m.s[1] * 0.32, m.p[2]]} scale={[m.s[0], m.s[1], m.s[2]]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={m.c} roughness={1} flatShading />
        </mesh>
      ))}
    </>
  );
}

export function TePikoOraScene({ lang }: { lang: Lang }) {
  return (
    <>
      <SkyMountainsSun />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[40, 72]} />
        <meshStandardMaterial color="#3d5c28" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, -4.5]} receiveShadow>
        <circleGeometry args={[9.5, 48]} />
        <meshStandardMaterial color="#c9b083" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, LAGOON_Z + 2.2]} receiveShadow>
        <boxGeometry args={[30, 4, 0.01]} />
        <meshStandardMaterial color="#d6bd8e" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[7.6, 56]} />
        <meshStandardMaterial color="#a8946f" roughness={1} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, -45]} receiveShadow>
        <planeGeometry args={[160, 72, 8, 8]} />
        <meshPhysicalMaterial
          color="#3dbfc2"
          roughness={0.1}
          metalness={0.15}
          transparent
          opacity={0.94}
          clearcoat={0.9}
          emissive="#14686e"
          emissiveIntensity={0.55}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, LAGOON_Z - 3.5]}>
        <planeGeometry args={[60, 7]} />
        <meshStandardMaterial color="#7ddfd4" transparent opacity={0.9} roughness={0.3} emissive="#3fa89e" emissiveIntensity={0.4} />
      </mesh>

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
      <mesh position={[0, 0.02, -8.9]} receiveShadow>
        <boxGeometry args={[0.85, 0.025, 3.2]} />
        <meshStandardMaterial color="#b8a070" roughness={1} />
      </mesh>

      {FARES.map((f, i) => (
        <Fare key={i} fare={f} lang={lang} />
      ))}

      <CenterPiko lang={lang} />
      <PierAndCanoe />
      <Villagers />
      <Jungle />

      <Tiki pos={[1.15, 0, -7.6]} h={1.5} />
      <Tiki pos={[-1.15, 0, -7.6]} h={1.5} />
      <Tiki pos={[4.6, 0, 4.2]} h={1.35} />
      <Tiki pos={[-4.9, 0, 3.6]} h={1.35} />
    </>
  );
}
