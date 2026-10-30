/** @jsxRuntime classic */
'use client';

import { React, useEffect, useFrame, useMemo, useRef, useThree, THREE } from '@genesis/runtime';
import { SceneLabel } from './SceneLabel';
import { AtlanticOcean } from './CoastalLandscape';

type Lang = 'cs' | 'en';
type Point = [number, number, number];

// One fleet model used by the website and Nirvana. The first two hull types
// follow the wooden schooner / ocean catamaran reference; Nieves is a light variant.
const VESSELS = [
  { id: 'santa', name: 'Santa María la Mayor', ocean: { cs: 'Atlantik', en: 'Atlantic' }, position: [-6.3, 0, -1.7] as Point, yaw: -.65, flag: '#a83134', hull: '#62402b', cat: false, tier: false },
  { id: 'fatima', name: 'Nossa Senhora de Fátima', ocean: { cs: 'Pacifik', en: 'Pacific' }, position: [0, 0, 3.7] as Point, yaw: -.72, flag: '#eee9d9', hull: '#e7ded0', cat: true, tier: false },
  { id: 'nieves', name: 'María de las Nieves', ocean: { cs: 'Indický oceán', en: 'Indian Ocean' }, position: [6.3, 0, -1.7] as Point, yaw: -.58, flag: '#c6a25b', hull: '#eee5d2', cat: false, tier: true },
];

function widthAt(t: number, beam: number) {
  return beam * (.07 + .93 * Math.pow(Math.sin(Math.PI * t), .65)) * (1 - .12 * t);
}
function sheer(t: number) { return .56 + .2 * Math.pow(Math.abs(t - .5) * 2, 3); }

function useFabric() {
  const [texture] = React.useState(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#eee4c9'; ctx.fillRect(0, 0, 256, 256);
    // Quiet solar-cell seams rather than luminous orange panels.
    ctx.strokeStyle = '#d4c8ac'; ctx.lineWidth = .7;
    for (let i = 0; i <= 256; i += 16) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    }
    ctx.strokeStyle = '#c6b798';
    for (let i = 0; i <= 256; i += 64) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

/** A tapered, curved hull with a pointed bow, keel and raised sheer. */
function Hull({ beam, color }: { beam: number; color: string }) {
  const { hull, deck, outline } = useMemo(() => {
    const vertices: number[] = [], uv: number[] = [], indices: number[] = [];
    const deckVertices: number[] = [], deckIndices: number[] = [];
    const outline: Point[] = [];
    const sections = 36, arcs = 16;
    for (let j = 0; j <= sections; j++) {
      const t = j / sections, z = -3.25 + t * 6.5, w = widthAt(t, beam);
      const depth = .44 + Math.sin(t * Math.PI) * .42;
      for (let i = 0; i <= arcs; i++) {
        const a = i / arcs * Math.PI;
        vertices.push(Math.cos(a) * w, sheer(t) - Math.sin(a) * depth, z);
        uv.push(t, i / arcs);
        if (j < sections && i < arcs) {
          const k = j * (arcs + 1) + i;
          indices.push(k, k + 1, k + arcs + 1, k + 1, k + arcs + 2, k + arcs + 1);
        }
      }
      deckVertices.push(-w, sheer(t) + .012, z, w, sheer(t) + .012, z);
      if (j < sections) { const k = j * 2; deckIndices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    for (let side = 0; side < 2; side++) for (let i = 0; i <= 36; i++) {
      const t = side ? 1 - i / 36 : i / 36;
      outline.push([(side ? 1 : -1) * widthAt(t, beam), sheer(t) + .12, -3.25 + t * 6.5]);
    }
    outline.push(outline[0]);
    const hull = new THREE.BufferGeometry(); hull.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); hull.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); hull.setIndex(indices); hull.computeVertexNormals();
    const deck = new THREE.BufferGeometry(); deck.setAttribute('position', new THREE.Float32BufferAttribute(deckVertices, 3)); deck.setIndex(deckIndices); deck.computeVertexNormals();
    return { hull, deck, outline };
  }, [beam]);
  useEffect(() => () => { hull.dispose(); deck.dispose(); }, [hull, deck]);
  return <>
    <mesh geometry={hull} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.48} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={deck} receiveShadow><meshStandardMaterial color="#bd9565" roughness={.82} side={THREE.DoubleSide} /></mesh>
    <Rail outline={outline} />
    {/* Longitudinal teak seams, kept within the taper of the deck. */}
    {[-.6, -.3, 0, .3, .6].filter(x => Math.abs(x) < beam * .85).map(x => <mesh key={x} position={[x, .588, 0]}>
      <boxGeometry args={[.012, .008, 4.7]} /><meshStandardMaterial color="#896840" roughness={1} />
    </mesh>)}
  </>;
}

function Rail({ outline }: { outline: Point[] }) {
  const curves = useMemo(() => [0, .3].map(h => new THREE.CatmullRomCurve3(outline.map(p => new THREE.Vector3(p[0], p[1] + h, p[2])), false)), [outline]);
  const posts = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!posts.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 26; i++) {
      const p = curves[0].getPoint(i / 26); dummy.position.set(p.x, p.y + .15, p.z); dummy.updateMatrix(); posts.current.setMatrixAt(i, dummy.matrix);
    }
    posts.current.instanceMatrix.needsUpdate = true;
  }, [curves]);
  return <>
    {curves.map((c, i) => <mesh key={i}><tubeGeometry args={[c, 90, .017, 4, false]} /><meshStandardMaterial color="#aa8957" metalness={.45} roughness={.5} /></mesh>)}
    <instancedMesh ref={posts} args={[undefined, undefined, 26]} frustumCulled={false}>
      <cylinderGeometry args={[.014, .014, .3, 4]} /><meshStandardMaterial color="#bba16e" metalness={.6} roughness={.4} />
    </instancedMesh>
  </>;
}

function Spar({ a, b, radius = .026, color = '#87603a' }: { a: Point; b: Point; radius?: number; color?: string }) {
  const { center, rotation, length } = useMemo(() => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), dir = to.clone().sub(from);
    return { center: from.add(to).multiplyScalar(.5), rotation: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()), length: dir.length() };
  }, [a[0], a[1], a[2], b[0], b[1], b[2]]);
  return <mesh position={center} quaternion={rotation}><cylinderGeometry args={[radius * .7, radius, length, 6]} /><meshStandardMaterial color={color} roughness={.65} /></mesh>;
}

function Sail({ z, height, width, tex, jib = false }: { z: number; height: number; width: number; tex: THREE.Texture | null; jib?: boolean }) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1, 14, 16); const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) + .5, v = pos.getY(i) + .5;
      const taper = jib ? 1 - v : 1 - .28 * v;
      const span = width * taper;
      pos.setXYZ(i, .035 + .24 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v), 1.35 + v * height + (jib ? 0 : u * v * height * .176), z + (jib ? 1 : -1) * u * span);
    }
    g.computeVertexNormals(); return g;
  }, [z, height, width, jib]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} castShadow>
    <meshStandardMaterial map={tex} color="#fff9e9" side={THREE.DoubleSide} roughness={.9} />
  </mesh>;
}

function Deckhouse({ cat, tier }: { cat: boolean; tier: boolean }) {
  const width = cat ? 2.08 : 1.25;
  return <group position={[0, 0, -.55]}>
    <mesh position={[0, .88, 0]} castShadow><boxGeometry args={[width, .52, 2.6]} /><meshStandardMaterial color="#98663d" roughness={.7} /></mesh>
    {[-1, 1].map(side => <group key={side}>
      {[-.9, -.3, .3, .9].map(z => <mesh key={z} position={[side * (width / 2 + .008), .94, z]}>
        <boxGeometry args={[.018, .21, .42]} /><meshStandardMaterial color="#284957" metalness={.3} roughness={.23} />
      </mesh>)}
    </group>)}
    <mesh position={[0, 1.18, 0]} castShadow><boxGeometry args={[width + .12, .09, 2.76]} /><meshStandardMaterial color="#f0e3c8" roughness={.7} /></mesh>
    <mesh position={[0, .94, 1.31]}><boxGeometry args={[width * .8, .24, .015]} /><meshStandardMaterial color="#335566" metalness={.3} roughness={.2} /></mesh>
    {tier && <mesh position={[0, 1.33, -.6]}><boxGeometry args={[.95, .22, 1.0]} /><meshStandardMaterial color="#eee5d2" roughness={.5} /></mesh>}
  </group>;
}

function Vessel({ spec, index, lang, tex, reduced }: { spec: typeof VESSELS[number]; index: number; lang: Lang; tex: THREE.Texture | null; reduced: React.RefObject<boolean> }) {
  const ref = useRef<THREE.Group>(null);
  const masts = spec.cat ? [{ z: .9, h: 5.5, w: 2.15 }, { z: -1.65, h: 4.6, w: 1.45 }] : [{ z: 1.55, h: 4.8, w: 1.5 }, { z: -.15, h: 5.5, w: 1.5 }, { z: -1.85, h: 4.5, w: 1.35 }];
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = reduced.current ? 0 : clock.getElapsedTime();
    ref.current.position.y = reduced.current ? 0 : Math.sin(t * .65 + index * 2) * .045;
    ref.current.rotation.z = reduced.current ? 0 : Math.sin(t * .5 + index * 2) * .014;
  });
  return <group position={spec.position} rotation={[0, spec.yaw, 0]}><group ref={ref}>
    {spec.cat ? <>
      {[-1.2, 1.2].map(x => <group key={x} position={[x, 0, 0]}><Hull beam={.35} color={spec.hull} /></group>)}
      <mesh position={[0, .58, -.45]} castShadow><boxGeometry args={[2.45, .14, 4.1]} /><meshStandardMaterial color="#bb9468" roughness={.8} /></mesh>
      {/* Open forward trampoline between the two bows. */}
      <mesh position={[0, .53, 2.05]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.7, 1.3, 8, 8]} /><meshStandardMaterial color="#c8bd9d" wireframe /></mesh>
    </> : <Hull beam={.96} color={spec.hull} />}
    <Deckhouse cat={spec.cat} tier={spec.tier} />
    <Spar a={[0, .64, 2.5]} b={[0, .9, 4.25]} radius={.05} />
    {masts.map(({ z, h, w }, i) => <group key={i}>
      <Spar a={[0, .57, z]} b={[0, h + 1.35, z]} radius={.044} />
      <Spar a={[.025, 1.35, z]} b={[.025, 1.35, z - w]} radius={.027} />
      <Spar a={[0, 1.35 + h * .85, z]} b={[0, 1.35 + h, z - w * .72]} radius={.019} />
      <Sail z={z} height={h * .85} width={w} tex={tex} />
      {[-1, 1].map(side => <Spar key={side} a={[0, h + .8, z]} b={[side * (spec.cat ? 1.3 : .78), .83, z - .65]} radius={.006} color="#b5a889" />)}
      <Spar a={[0, h + 1.0, z]} b={[0, .88, i === 0 ? 4.1 : masts[i - 1].z]} radius={.006} color="#b5a889" />
    </group>)}
    <Sail z={1.68} height={3.65} width={2.3} jib tex={tex} />
    <mesh position={[.18, 6.4, masts[spec.cat ? 0 : 1].z]}><planeGeometry args={[.34, .2]} /><meshStandardMaterial color={spec.flag} side={THREE.DoubleSide} roughness={1} /></mesh>
    <SceneLabel position={[0, 7.55, -.1]} text={`${spec.name} · ${spec.ocean[lang]}`} />
    {[-1, 1].map(side => <mesh key={side} position={[side * (spec.cat ? 1.5 : .86), .43, -1.8]} rotation={[0, side * Math.PI / 2, 0]}>
      <torusGeometry args={[.13, .035, 6, 14]} /><meshStandardMaterial color="#efdfb9" roughness={.9} />
    </mesh>)}
  </group></group>;
}

function Sky() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#456b95') }, low: { value: new THREE.Color('#e4bd9d') } },
    vertexShader: 'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 p; uniform vec3 top; uniform vec3 low; void main(){
      vec3 d=normalize(p);vec3 c=mix(low,top,smoothstep(-.04,.7,d.y));
      float s=max(dot(d,normalize(vec3(-.55,.10,-1.))),0.);
      c+=vec3(1.,.7,.35)*pow(s,1600.)*1.6+vec3(.4,.2,.1)*pow(s,30.);
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  }), []);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh material={material} renderOrder={-10}><sphereGeometry args={[1800, 24, 16]} /></mesh>;
}

function FleetFraming() {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const factor = Math.max(1, .78 / aspect);
    if (camera instanceof THREE.PerspectiveCamera) camera.fov = aspect < 1 ? 60 : 45;
    camera.position.set(9 * factor, 8.3 * factor, 20.5 * factor); camera.lookAt(0, 2.5, .5); camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

export function MariaDelCaminoScene({ lang }: { lang: Lang }) {
  const texture = useFabric();
  const reduced = useRef(false);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => { reduced.current = q.matches; };
    update();q.addEventListener('change', update);return () => q.removeEventListener('change', update);
  }, []);
  return <><Sky /><FleetFraming /><AtlanticOcean level={-.05} coastal={false} />
    {VESSELS.map((spec, i) => <Vessel key={spec.id} spec={spec} index={i} lang={lang} tex={texture} reduced={reduced} />)}
  </>;
}

export const MARIA_CAMERA = { position: [9, 8.3, 20.5] as Point, fov: 45, far: 2000 };
export const MARIA_CONTROLS = { autoRotate: true, autoRotateSpeed: .18, minDistance: 13, maxDistance: 95, maxPolarAngle: Math.PI / 2 - .08, target: [0, 2.5, .5] as Point, enablePan: false };
export function MariaLighting() {
  return <>
    <ambientLight intensity={.65} color="#f1e7da" />
    <hemisphereLight args={['#d3e6ff', '#243941', .7]} />
    <directionalLight position={[-8, 12, -14]} intensity={2.0} color="#ffe0b3" castShadow />
    <directionalLight position={[14, 10, 14]} intensity={1.0} color="#d2e4fa" />
  </>;
}
