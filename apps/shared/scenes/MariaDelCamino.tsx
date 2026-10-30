/** @jsxRuntime classic */
'use client';

import { React, useFrame, useMemo, useRef, THREE } from '@genesis/runtime';
import { SceneLabel } from './SceneLabel';

type Lang = 'cs' | 'en';

/* ─── Tres Marias — tři lodě, tři oceány ──────────────────────────────
 * Santa María la Mayor (Atlantic, tmavý trup, 3stěžňový škuner, lastura),
 * Nossa Senhora de Fátima (Pacific, bílý solární katamarán, 2 stěžně),
 * María de las Nieves (Indian Ocean, bílozlatý superyacht, 3 stěžně).
 * Plachty = průsvitné zlaté solární panely s mřížkou článků (dle hero).
 * V formace dle patron.webp — Fátima v čele, křídla vzadu.
 */

/** Solární plachta — zlatá mřížka fotovoltaických článků */
function useSailTexture() {
  return useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#ffd98e');
    g.addColorStop(0.5, '#f2b95e');
    g.addColorStop(1, '#d69a3e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    // jemná mřížka článků
    ctx.strokeStyle = 'rgba(122, 72, 12, 0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 256; i += 16) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    }
    // vzpěrné švy plachty
    ctx.strokeStyle = 'rgba(96, 55, 8, 0.65)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 256; i += 64) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function sailMaterial(tex: THREE.Texture | null) {
  return new THREE.MeshStandardMaterial({
    map: tex ?? undefined,
    color: tex ? '#ffffff' : '#f2b95e',
    emissive: '#ffb84e',
    emissiveMap: tex ?? undefined,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    roughness: 0.5,
    metalness: 0.1,
    depthWrite: false,
  });
}

/** lichoběžníková plachta s břichem (square-rig / gaff styl) */
function trapezoidSail(w: number, h: number, belly = 0.16, topScale = 0.55) {
  const geo = new THREE.PlaneGeometry(w, h, 10, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const u = x / w + 0.5;
    const v = y / h + 0.5;
    const taper = 1 - (1 - topScale) * v;
    pos.setX(i, x * taper);
    pos.setZ(i, belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(v * 1.15, 1)));
  }
  geo.computeVertexNormals();
  return geo;
}

/** trojúhelníková plachta s břichem (staysail / bermuda) */
function triangleSail(w: number, h: number, belly = 0.14, flip = false) {
  const geo = new THREE.PlaneGeometry(w, h, 10, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const u = x / w + 0.5;
    const v = y / h + 0.5;
    const keep = flip ? v : 1 - v; // špička nahoře (nebo dole)
    pos.setX(i, x * (1 - keep * 0.92));
    pos.setZ(i, belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * v));
  }
  geo.computeVertexNormals();
  return geo;
}

interface SailSpec {
  kind: 'trap' | 'tri';
  pos: [number, number, number];
  w: number;
  h: number;
  rotY?: number;
  flip?: boolean;
}

function Sails({ specs, tex }: { specs: SailSpec[]; tex: THREE.Texture | null }) {
  const mat = useMemo(() => sailMaterial(tex), [tex]);
  const geos = useMemo(
    () =>
      specs.map((s) =>
        s.kind === 'trap' ? trapezoidSail(s.w, s.h) : triangleSail(s.w, s.h, 0.14, s.flip),
      ),
    [specs],
  );
  return (
    <>
      {specs.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={[0, s.rotY ?? 0, 0]} geometry={geos[i]} material={mat} renderOrder={2} />
      ))}
    </>
  );
}

/** zlatá lastura Camina na přídi Santa María */
function ScallopShell() {
  return (
    <group position={[0, 0.62, 3.02]} rotation={[-0.5, 0, 0]}>
      {[-2, -1, 0, 1, 2].map((i) => (
        <mesh key={i} position={[i * 0.055, 0, 0]} rotation={[0, 0, i * 0.22]}>
          <coneGeometry args={[0.05, 0.3, 5]} />
          <meshStandardMaterial color="#e8c25a" metalness={0.75} roughness={0.3} emissive="#8a6416" emissiveIntensity={0.4} />
        </mesh>
      ))}
      <mesh position={[0, -0.12, 0.01]}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshStandardMaterial color="#e8c25a" metalness={0.75} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** generická jednotrupá jachta — škuner styl */
function MonoHull({ hullColor, trim, superTier = 1 }: { hullColor: string; trim: string; superTier?: number }) {
  return (
    <>
      {/* trup — protáhlá kapsle pod hladinou */}
      <mesh position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.62, 3.3, 0.5]} castShadow>
        <capsuleGeometry args={[1, 1.6, 6, 14]} />
        <meshStandardMaterial color={hullColor} metalness={0.5} roughness={0.35} />
      </mesh>
      {/* zlatá lemuvice na vodorysce */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.57, 0.42, 0]} castShadow>
          <boxGeometry args={[0.03, 0.05, 5.6]} />
          <meshStandardMaterial color={trim} metalness={0.85} roughness={0.25} />
        </mesh>
      ))}
      {/* paluba — teak */}
      <mesh position={[0, 0.5, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.15, 0.08, 6.4]} />
        <meshStandardMaterial color="#8a6b42" roughness={0.85} />
      </mesh>
      {/* nástavba — moderní skleněná kajuta */}
      <mesh position={[0, 0.72, -0.6]} castShadow>
        <boxGeometry args={[0.95, 0.36, 3.2]} />
        <meshStandardMaterial color="#e8e2d4" metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.78, -0.6]}>
        <boxGeometry args={[0.97, 0.14, 3.0]} />
        <meshStandardMaterial color="#2a3d55" metalness={0.6} roughness={0.15} emissive="#d98a2a" emissiveIntensity={0.5} />
      </mesh>
      {superTier > 1 && (
        <>
          <mesh position={[0, 1.02, -1.2]} castShadow>
            <boxGeometry args={[0.8, 0.28, 1.8]} />
            <meshStandardMaterial color="#f2ead8" metalness={0.3} roughness={0.4} />
          </mesh>
          <mesh position={[0, 1.06, -1.2]}>
            <boxGeometry args={[0.82, 0.12, 1.7]} />
            <meshStandardMaterial color="#2a3d55" metalness={0.6} roughness={0.15} emissive="#d98a2a" emissiveIntensity={0.5} />
          </mesh>
        </>
      )}
      {/* příďové křidélko — clipper */}
      <mesh position={[0, 0.5, 3.35]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.09, 0.7, 6]} />
        <meshStandardMaterial color="#5d4526" roughness={0.8} metalness={0.3} />
      </mesh>
    </>
  );
}

/** stěžeň + ráhna */
function Mast({ z, h, booms }: { z: number; h: number; booms: number[] }) {
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, 0.55 + h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.055, h, 7]} />
        <meshStandardMaterial color="#5d4526" roughness={0.8} />
      </mesh>
      {booms.map((by, i) => (
        <mesh key={i} position={[0, by, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.028, 0.028, 1.7, 6]} />
          <meshStandardMaterial color="#5d4526" roughness={0.8} />
        </mesh>
      ))}
      {/* vrchol — zlatá korunka */}
      <mesh position={[0, 0.55 + h + 0.06, 0]}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshStandardMaterial color="#e8c25a" metalness={0.85} roughness={0.25} />
      </mesh>
    </group>
  );
}

/** loď obalená houpavým pohybem */
function FloatingShip({ pos, yaw, phase, children, label, lang }: {
  pos: [number, number, number];
  yaw: number;
  phase: number;
  children: React.ReactNode;
  label: { cs: string; en: string };
  lang: Lang;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) {
      ref.current.position.y = pos[1] + Math.sin(t * 0.6 + phase) * 0.07;
      ref.current.rotation.z = Math.sin(t * 0.4 + phase) * 0.02;
      ref.current.rotation.x = Math.sin(t * 0.5 + phase * 1.3) * 0.015;
    }
  });
  return (
    <group position={pos} rotation={[0, yaw, 0]}>
      <group ref={ref}>
        {children}
        <SceneLabel position={[0, 6.4, 0]} text={label[lang]} />
      </group>
    </group>
  );
}

/** Santa María la Mayor — Atlantic · tmavý škuner, 3 stěžně, lastura */
function SantaMaria({ tex }: { tex: THREE.Texture | null }) {
  const sails: SailSpec[] = useMemo(
    () => [
      // přední stěžeň — 2 čtverhranné
      { kind: 'trap', pos: [0, 2.4, 1.9], w: 1.55, h: 1.7 },
      { kind: 'trap', pos: [0, 3.9, 1.9], w: 1.15, h: 1.15 },
      // hlavní stěžeň — 2 čtverhranné
      { kind: 'trap', pos: [0, 2.5, 0], w: 1.75, h: 1.85 },
      { kind: 'trap', pos: [0, 4.15, 0], w: 1.3, h: 1.25 },
      // zadní stěžeň — 2 čtverhranné (menší)
      { kind: 'trap', pos: [0, 2.4, -1.9], w: 1.4, h: 1.55 },
      { kind: 'trap', pos: [0, 3.8, -1.9], w: 1.05, h: 1.05 },
      // kosé plachty mezi stěžni
      { kind: 'tri', pos: [0, 2.6, 0.95], w: 1.5, h: 1.9, rotY: Math.PI / 2 },
      { kind: 'tri', pos: [0, 2.5, -0.95], w: 1.5, h: 1.8, rotY: Math.PI / 2 },
      // velký přední stayšal
      { kind: 'tri', pos: [0, 2.7, 2.85], w: 1.3, h: 2.3, rotY: Math.PI / 2 },
    ],
    [],
  );
  return (
    <>
      <MonoHull hullColor="#1c2431" trim="#e8c25a" />
      <ScallopShell />
      <Mast z={1.9} h={4.3} booms={[1.55, 3.28]} />
      <Mast z={0} h={4.9} booms={[1.62, 3.52]} />
      <Mast z={-1.9} h={4.2} booms={[1.55, 3.2]} />
      <Sails specs={sails} tex={tex} />
      {/* červená vlajka — královská roucha */}
      <mesh position={[0.16, 5.35, 0]}>
        <planeGeometry args={[0.34, 0.2]} />
        <meshBasicMaterial color="#b3202e" side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

/** Nossa Senhora de Fátima — Pacific · bílý katamarán, 2 stěžně */
function Fatima({ tex }: { tex: THREE.Texture | null }) {
  const sails: SailSpec[] = useMemo(
    () => [
      // hlavní bermuda — velký trojúhelník
      { kind: 'tri', pos: [0.02, 3.1, 0.4], w: 2.3, h: 4.3, flip: true },
      // přední genoa
      { kind: 'tri', pos: [0, 2.6, 1.9], w: 1.6, h: 3.1, rotY: Math.PI / 2, flip: true },
      // zadní mizzen trojúhelník
      { kind: 'tri', pos: [0.02, 2.8, -1.6], w: 1.7, h: 3.4, flip: true },
    ],
    [],
  );
  return (
    <>
      {/* dva trupy */}
      {[-1.05, 1.05].map((s) => (
        <group key={s} position={[s, 0, 0]}>
          <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.34, 3.1, 0.4]} castShadow>
            <capsuleGeometry args={[1, 1.7, 6, 12]} />
            <meshStandardMaterial color="#f0ead8" metalness={0.45} roughness={0.35} />
          </mesh>
          <mesh position={[s > 0 ? 0.3 : -0.3, 0.4, 0]}>
            <boxGeometry args={[0.03, 0.04, 5.2]} />
            <meshStandardMaterial color="#e8c25a" metalness={0.85} roughness={0.25} />
          </mesh>
        </group>
      ))}
      {/* můstek — paluba přes trupy */}
      <mesh position={[0, 0.52, 0]} receiveShadow castShadow>
        <boxGeometry args={[2.6, 0.1, 5.4]} />
        <meshStandardMaterial color="#8a6b42" roughness={0.85} />
      </mesh>
      {/* široká skleněná kajuta */}
      <mesh position={[0, 0.8, -0.4]} castShadow>
        <boxGeometry args={[2.2, 0.42, 3.4]} />
        <meshStandardMaterial color="#f5f0e2" metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.88, -0.4]}>
        <boxGeometry args={[2.24, 0.16, 3.2]} />
        <meshStandardMaterial color="#2a3d55" metalness={0.6} roughness={0.15} emissive="#d98a2a" emissiveIntensity={0.55} />
      </mesh>
      <Mast z={0.4} h={4.9} booms={[1.1]} />
      <Mast z={-1.6} h={4.1} booms={[1.1]} />
      <Sails specs={sails} tex={tex} />
      {/* bílá vlajka — svatební šaty */}
      <mesh position={[0.15, 5.5, 0.4]}>
        <planeGeometry args={[0.3, 0.18]} />
        <meshBasicMaterial color="#f5f0e2" side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

/** María de las Nieves — Indian Ocean · bílozlatá, 3 stěžně, velké trojúhelníky */
function Nieves({ tex }: { tex: THREE.Texture | null }) {
  const sails: SailSpec[] = useMemo(
    () => [
      // velká přední bermuda
      { kind: 'tri', pos: [0.02, 3.3, 1.5], w: 2.4, h: 4.6, flip: true },
      // hlavní trojúhelník
      { kind: 'tri', pos: [0.02, 3.2, -0.2], w: 2.5, h: 4.5, flip: true },
      // mizzen
      { kind: 'tri', pos: [0.02, 3.0, -1.9], w: 1.8, h: 3.6, flip: true },
      // stayšal vpředu
      { kind: 'tri', pos: [0, 2.6, 2.7], w: 1.4, h: 2.9, rotY: Math.PI / 2, flip: true },
    ],
    [],
  );
  return (
    <>
      <MonoHull hullColor="#efe6d2" trim="#e8c25a" superTier={2} />
      <Mast z={1.5} h={5.0} booms={[1.15]} />
      <Mast z={-0.2} h={4.9} booms={[1.15]} />
      <Mast z={-1.9} h={4.2} booms={[1.1]} />
      <Sails specs={sails} tex={tex} />
      {/* zlatá vlajka — nedokončené zázraky */}
      <mesh position={[0.15, 5.55, 1.5]}>
        <planeGeometry args={[0.3, 0.18]} />
        <meshBasicMaterial color="#e8c25a" side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

/** kýl za lodí — bílá brázda */
function Wake({ pos, yaw, len }: { pos: [number, number, number]; yaw: number; len: number }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.55, 0);
    s.lineTo(0.55, 0);
    s.lineTo(0.12, -len);
    s.lineTo(-0.12, -len);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }, [len]);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, yaw]} position={pos} renderOrder={1}>
      <meshBasicMaterial color="#ffffff" transparent opacity={0.16} depthWrite={false} />
    </mesh>
  );
}

/** sluneční glittr na vodě */
function SunGlitter() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) {
      (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.22 + Math.sin(t * 1.3) * 0.07;
    }
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, -0.5]} position={[-10, 0.02, -18]} renderOrder={1}>
      <planeGeometry args={[7, 46]} />
      <meshBasicMaterial color="#ffca6a" transparent opacity={0.22} depthWrite={false} />
    </mesh>
  );
}

/** obloha + zapadající slunce nad oceánem */
function SkySun() {
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
            vec3 c = d.y > 0.2 ? mix(mid, top, smoothstep(0.2, 0.72, d.y))
                             : mix(low, mid, smoothstep(-0.05, 0.2, d.y));
            float s = max(dot(d, sunDir), 0.0);
            c += vec3(1.0, 0.94, 0.7) * pow(s, 180.0) * 2.6
               + vec3(1.0, 0.76, 0.42) * pow(s, 26.0) * 0.55
               + vec3(0.98, 0.6, 0.28) * pow(s, 6.0) * 0.25;
            gl_FragColor = vec4(c, 1.0);
          }
        `,
        uniforms: {
          top: { value: new THREE.Color('#2a3550') },
          mid: { value: new THREE.Color('#c47a3e') },
          low: { value: new THREE.Color('#e8a45c') },
          sunDir: { value: new THREE.Vector3(-0.32, 0.05, -0.95).normalize() },
        },
      }),
    [],
  );
  return (
    <mesh material={skyMat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[160, 24, 16]} />
    </mesh>
  );
}

export function MariaDelCaminoScene({ lang }: { lang: Lang }) {
  const sailTex = useSailTexture();

  return (
    <>
      <SkySun />

      {/* oceán — zlatý soumrak */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
        <circleGeometry args={[150, 72]} />
        <meshPhysicalMaterial
          color="#1e4a52"
          roughness={0.14}
          metalness={0.3}
          clearcoat={0.9}
          emissive="#0d2e34"
          emissiveIntensity={0.5}
        />
      </mesh>
      <SunGlitter />

      {/* V formace — Fátima v čele, Santa María vlevo, Nieves vpravo */}
      <FloatingShip
        pos={[0, 0, 4.6]}
        yaw={0.08}
        phase={0}
        lang={lang}
        label={{ cs: 'Nossa Senhora de Fátima · Pacific', en: 'Nossa Senhora de Fátima · Pacific' }}
      >
        <Fatima tex={sailTex} />
      </FloatingShip>
      <FloatingShip
        pos={[-6.8, 0, -2.6]}
        yaw={0.34}
        phase={1.9}
        lang={lang}
        label={{ cs: 'Santa María la Mayor · Atlantic', en: 'Santa María la Mayor · Atlantic' }}
      >
        <SantaMaria tex={sailTex} />
      </FloatingShip>
      <FloatingShip
        pos={[6.8, 0, -2.6]}
        yaw={-0.26}
        phase={3.7}
        lang={lang}
        label={{ cs: 'María de las Nieves · Indian Ocean', en: 'María de las Nieves · Indian Ocean' }}
      >
        <Nieves tex={sailTex} />
      </FloatingShip>

      {/* brázdy za loděmi */}
      <Wake pos={[0, 0.01, 2.4]} yaw={0.08} len={10} />
      <Wake pos={[-6.8, 0.01, -4.7]} yaw={0.34} len={10} />
      <Wake pos={[6.8, 0.01, -4.7]} yaw={-0.26} len={10} />
    </>
  );
}

export const MARIA_CAMERA = { position: [0, 2.9, 14.2] as [number, number, number], fov: 47, far: 2000 };
export const MARIA_CONTROLS = { autoRotate: true, autoRotateSpeed: 0.35, minDistance: 7, maxDistance: 34, maxPolarAngle: Math.PI / 2 - 0.06, target: [0, 3.1, 0] as [number, number, number], enablePan: false };
export function MariaLighting() {
  return <>
    <ambientLight intensity={0.55} color="#ffe9c4" />
    <hemisphereLight args={['#ffdca8', '#0e2430', 0.55]} />
    {/* západ slunce — zlatý backlight */}
    <directionalLight position={[-8, 6, -16]} intensity={2.4} color="#ffb060" castShadow />
    <directionalLight position={[14, 12, 12]} intensity={0.75} color="#ffd9a8" />
  </>;
}
