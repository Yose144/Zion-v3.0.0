'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sparkles, Stars } from '@react-three/drei';

type Vec3 = [number, number, number];

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
}

function AncientTree() {
  const leaves = useMemo(() => {
    const arr: Array<{ p: [number, number, number]; s: number; c: string }> = [];
    for (let i = 0; i < 180; i++) {
      const a = pseudoRandom(i * 7 + 1) * Math.PI * 2;
      const r = 0.6 + pseudoRandom(i * 7 + 2) * 2.4;
      const h = 1.2 + pseudoRandom(i * 7 + 3) * 2.6;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = h;
      const s = 0.08 + pseudoRandom(i * 7 + 4) * 0.16;
      const cRollA = pseudoRandom(i * 7 + 5);
      const cRollB = pseudoRandom(i * 7 + 6);
      const c = cRollA < 0.18 ? '#f7c35f' : cRollB < 0.3 ? '#8da55c' : '#6f8f4a';
      arr.push({ p: [x, y, z], s, c });
    }
    return arr;
  }, []);

  return (
    <group position={[0, -0.25, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.28, 0.42, 2.2, 20]} />
        <meshStandardMaterial color="#5a3a2a" roughness={0.95} metalness={0.02} />
      </mesh>

      <mesh castShadow position={[-0.42, 1.75, 0.05]} rotation={[0.2, 0.1, 0.55]}>
        <cylinderGeometry args={[0.09, 0.15, 1.35, 16]} />
        <meshStandardMaterial color="#5a3a2a" roughness={0.94} metalness={0.02} />
      </mesh>
      <mesh castShadow position={[0.5, 1.7, -0.02]} rotation={[0.15, -0.08, -0.6]}>
        <cylinderGeometry args={[0.08, 0.14, 1.3, 16]} />
        <meshStandardMaterial color="#5a3a2a" roughness={0.94} metalness={0.02} />
      </mesh>

      <mesh castShadow position={[-0.85, 2.0, 0.25]} rotation={[0.35, 0.0, 0.8]}>
        <cylinderGeometry args={[0.04, 0.07, 0.9, 12]} />
        <meshStandardMaterial color="#5a3a2a" roughness={0.93} metalness={0.02} />
      </mesh>
      <mesh castShadow position={[0.92, 1.95, -0.2]} rotation={[0.3, 0.0, -0.85]}>
        <cylinderGeometry args={[0.04, 0.07, 0.9, 12]} />
        <meshStandardMaterial color="#5a3a2a" roughness={0.93} metalness={0.02} />
      </mesh>

      <mesh position={[0, 2.3, 0]}>
        <sphereGeometry args={[1.6, 24, 24]} />
        <meshStandardMaterial color="#6d8d4b" roughness={0.9} metalness={0.03} transparent opacity={0.32} />
      </mesh>

      <mesh position={[0.05, 2.75, 0.12]}>
        <sphereGeometry args={[0.28, 14, 14]} />
        <meshStandardMaterial color="#f0cf6a" emissive="#8f6a19" emissiveIntensity={0.7} roughness={0.5} />
      </mesh>

      <mesh position={[-0.55, 2.45, -0.35]}>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshStandardMaterial color="#dec160" emissive="#765415" emissiveIntensity={0.5} roughness={0.55} />
      </mesh>

      {leaves.map((leaf, i) => (
        <mesh key={i} castShadow position={leaf.p}>
          <sphereGeometry args={[leaf.s, 10, 10]} />
          <meshStandardMaterial color={leaf.c} roughness={0.85} metalness={0.05} />
        </mesh>
      ))}

      <mesh position={[-0.65, -0.35, 0.15]} rotation={[0, 0.15, 0.35]}>
        <cylinderGeometry args={[0.06, 0.1, 0.8, 10]} />
        <meshStandardMaterial color="#4b2f22" roughness={0.95} />
      </mesh>
      <mesh position={[0.7, -0.36, -0.1]} rotation={[0, -0.1, -0.35]}>
        <cylinderGeometry args={[0.06, 0.1, 0.8, 10]} />
        <meshStandardMaterial color="#4b2f22" roughness={0.95} />
      </mesh>
    </group>
  );
}

function MiniFigure({ position, color, headColor }: { position: Vec3; color: string; headColor: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshStandardMaterial color={headColor} roughness={0.85} />
      </mesh>
    </group>
  );
}

function FireSanctuary() {
  const stones = useMemo(() => {
    const arr: Array<{ p: Vec3; sx: number; sy: number; sz: number }> = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      arr.push({
        p: [Math.cos(a) * 0.27, -0.35, Math.sin(a) * 0.17],
        sx: 0.045 + pseudoRandom(i * 3 + 11) * 0.03,
        sy: 0.02 + pseudoRandom(i * 3 + 12) * 0.02,
        sz: 0.035 + pseudoRandom(i * 3 + 13) * 0.03,
      });
    }
    return arr;
  }, []);

  return (
    <group>
      <pointLight position={[0, -0.05, 0]} intensity={3.2} distance={8} color="#ff9d2e" />
      <pointLight position={[0, 0.45, 0]} intensity={1.25} distance={4.5} color="#ffe09f" />

      <mesh position={[0, -0.24, 0]}>
        <coneGeometry args={[0.13, 0.4, 14]} />
        <meshStandardMaterial color="#ffb347" emissive="#ff7a00" emissiveIntensity={2.2} />
      </mesh>
      <mesh position={[-0.05, -0.26, 0.02]}>
        <coneGeometry args={[0.09, 0.28, 12]} />
        <meshStandardMaterial color="#ffd193" emissive="#ff8a2e" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.06, -0.27, -0.02]}>
        <coneGeometry args={[0.08, 0.24, 12]} />
        <meshStandardMaterial color="#ffc779" emissive="#ff7421" emissiveIntensity={1.4} />
      </mesh>

      <mesh position={[0, -0.38, 0]}>
        <circleGeometry args={[0.6, 28]} />
        <meshStandardMaterial color="#1d120d" emissive="#4e1f09" emissiveIntensity={0.45} transparent opacity={0.82} />
      </mesh>

      {stones.map((s, i) => (
        <mesh key={i} position={s.p}>
          <boxGeometry args={[s.sx, s.sy, s.sz]} />
          <meshStandardMaterial color="#625a53" roughness={0.95} />
        </mesh>
      ))}

      <Sparkles count={42} scale={[1.8, 1.1, 1.8]} size={3} speed={0.2} color="#ffbf67" opacity={0.75} position={[0, 0.12, 0]} />
    </group>
  );
}

function SacredFigures() {
  const masters = useMemo(() => {
    const arr: Vec3[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      arr.push([Math.cos(a) * 1.55, -0.38, Math.sin(a) * 0.75]);
    }
    return arr;
  }, []);

  return (
    <group>
      {masters.map((p, i) => (
        <group key={i} position={p}>
          <mesh position={[0, 0.03, 0]}>
            <sphereGeometry args={[0.082, 10, 10]} />
            <meshStandardMaterial color="#8b6b4c" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.046, 10, 10]} />
            <meshStandardMaterial color="#9b7857" roughness={0.9} />
          </mesh>
        </group>
      ))}

      <group position={[0, -0.36, 0.9]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
          <torusGeometry args={[0.18, 0.04, 10, 20]} />
          <meshStandardMaterial color="#9f7f4f" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <sphereGeometry args={[0.1, 14, 14]} />
          <meshStandardMaterial color="#a78352" roughness={0.88} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <sphereGeometry args={[0.06, 14, 14]} />
          <meshStandardMaterial color="#be9a6a" roughness={0.82} />
        </mesh>
        <pointLight position={[0, 0.38, 0]} intensity={0.35} distance={1.7} color="#f9d884" />
      </group>

      <group position={[1.55, -0.36, 0.32]} rotation={[0, -0.45, 0]}>
        <MiniFigure position={[-0.22, 0, 0]} color="#4f7fdf" headColor="#caa070" />
        <MiniFigure position={[0, 0, 0]} color="#d78fb8" headColor="#d1a774" />
        <MiniFigure position={[0.22, 0, 0]} color="#c89b4c" headColor="#b98d60" />
        <mesh position={[0, 0.31, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.33, 0.01, 10, 32]} />
          <meshStandardMaterial color="#f3d17c" emissive="#8f7125" emissiveIntensity={0.5} transparent opacity={0.6} />
        </mesh>
      </group>
    </group>
  );
}

function KailashBackdrop() {
  return (
    <group position={[2.4, 0.25, -3.1]} rotation={[0, -0.28, 0]}>
      <mesh position={[0, 0.15, 0]}>
        <coneGeometry args={[1.35, 2.7, 4]} />
        <meshStandardMaterial color="#2c3258" roughness={0.92} />
      </mesh>

      <mesh position={[-0.9, -0.05, 0.2]}>
        <coneGeometry args={[0.85, 1.9, 4]} />
        <meshStandardMaterial color="#252c4b" roughness={0.92} />
      </mesh>

      <mesh position={[1.0, -0.02, -0.15]}>
        <coneGeometry args={[0.92, 2.0, 4]} />
        <meshStandardMaterial color="#252f52" roughness={0.9} />
      </mesh>

      <mesh position={[0.05, 1.08, 0.03]}>
        <coneGeometry args={[0.45, 0.9, 4]} />
        <meshStandardMaterial color="#dbe0ef" roughness={0.8} emissive="#59648a" emissiveIntensity={0.15} />
      </mesh>

      <mesh position={[-0.92, 0.65, 0.22]}>
        <coneGeometry args={[0.28, 0.55, 4]} />
        <meshStandardMaterial color="#cfd7ea" roughness={0.82} />
      </mesh>

      <mesh position={[1.02, 0.7, -0.14]}>
        <coneGeometry args={[0.3, 0.6, 4]} />
        <meshStandardMaterial color="#cfd7ea" roughness={0.82} />
      </mesh>

      <mesh position={[0, -0.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.3, 40]} />
        <meshStandardMaterial color="#171826" transparent opacity={0.4} />
      </mesh>

      <Sparkles count={18} scale={[2.3, 1.2, 2.3]} size={2} speed={0.12} color="#dce5ff" opacity={0.35} position={[0, 0.95, 0]} />
    </group>
  );
}

function SkyOrnaments() {
  return (
    <group>
      <mesh position={[-3.2, 3.9, -5.1]}>
        <sphereGeometry args={[0.36, 24, 24]} />
        <meshStandardMaterial color="#eef2ff" emissive="#8e95bb" emissiveIntensity={0.65} roughness={0.55} />
      </mesh>

      <mesh position={[-3.07, 4.02, -4.84]}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshStandardMaterial color="#c5cce4" roughness={0.9} />
      </mesh>

      <pointLight position={[-3.15, 3.9, -4.9]} intensity={0.45} distance={5.5} color="#d9ddff" />

      <group position={[2.9, 3.25, -5.6]}>
        <mesh>
          <sphereGeometry args={[0.24, 18, 18]} />
          <meshStandardMaterial color="#8f6ad9" emissive="#3f275f" emissiveIntensity={0.5} roughness={0.7} />
        </mesh>
        <mesh rotation={[Math.PI / 2.8, 0.1, 0]}>
          <torusGeometry args={[0.4, 0.03, 10, 40]} />
          <meshStandardMaterial color="#ccb68b" roughness={0.55} metalness={0.25} />
        </mesh>
      </group>

      <mesh position={[1.55, 2.75, -4.7]}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color="#c96d4d" emissive="#5b291a" emissiveIntensity={0.35} roughness={0.78} />
      </mesh>

      <mesh position={[-1.9, 2.85, -4.5]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#4a89bf" emissive="#1c3650" emissiveIntensity={0.25} roughness={0.78} />
      </mesh>

      <Sparkles count={34} scale={[8, 4.2, 3.5]} size={2} speed={0.08} color="#f5f0d8" opacity={0.35} position={[0, 2.8, -3.6]} />
    </group>
  );
}

export default function SplineTreeOfLife() {
  return (
    <section className="relative py-10 md:py-16 px-4 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, #08081a 0%, #0c0c28 35%, #15122a 60%, #0b0908 100%)',
        }}
      />

      <div className="zion-container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-7 md:mb-10"
        >
          <p className="text-[10px] uppercase tracking-[0.6em] mb-3 font-light" style={{ color: 'rgba(249,217,118,0.42)' }}>
            The Eternal Network · 3D Experience
          </p>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
            Tree of{' '}
            <span className="bg-linear-to-r from-zion-gold-300 via-zion-gold-400 to-yellow-200 bg-clip-text text-transparent">
              Life
            </span>
          </h2>
          <p className="text-gray-400/90 max-w-2xl mx-auto leading-relaxed text-sm md:text-base">
            Starověký strom života, posvátný oheň, meditační kruh mistrů, Ráma · Síta · Hanumán, Buddha pod stromem a Kailáš pod noční oblohou.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative mx-auto max-w-5xl zion-rainbow-card shadow-[0_20px_80px_rgba(0,0,0,0.45)] overflow-hidden" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
        >
          <div className="absolute inset-2 rounded-[22px] border border-amber-200/20 pointer-events-none z-20" />
          <div className="absolute inset-6 rounded-[18px] border border-white/8 pointer-events-none z-20" />

          <div className="aspect-16/10 min-h-[420px] md:min-h-[560px] w-full">
            <Canvas dpr={[1, 1.5]} shadows camera={{ position: [0, 1.4, 5.2], fov: 42 }}>
              <color attach="background" args={['#090916']} />
              <fog attach="fog" args={['#0a0a17', 5.8, 11]} />

              <ambientLight intensity={0.45} />
              <directionalLight position={[3, 5, 2]} intensity={1.1} color="#ffe7b4" castShadow />
              <directionalLight position={[-4, 2, -2]} intensity={0.35} color="#7ea2ff" />

              <Stars radius={75} depth={46} count={1800} factor={3.2} saturation={0} fade speed={0.28} />
              <SkyOrnaments />

              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.42, 0]} receiveShadow>
                <planeGeometry args={[16, 16]} />
                <meshStandardMaterial color="#130e0a" roughness={0.96} />
              </mesh>

              <KailashBackdrop />
              <AncientTree />
              <FireSanctuary />
              <SacredFigures />

              <OrbitControls
                enablePan={false}
                enableZoom={false}
                autoRotate
                autoRotateSpeed={0.25}
                minPolarAngle={Math.PI / 2.45}
                maxPolarAngle={Math.PI / 2.0}
              />
            </Canvas>
          </div>

          <div className="absolute bottom-0 inset-x-0 p-3 md:p-4 bg-linear-to-t from-black/65 to-transparent pointer-events-none">
            <p className="text-[11px] text-amber-100/70 tracking-wide text-center">
              Cinematic Tree 3D · Drag to orbit · Invitation to Zion Oasis
            </p>
          </div>
        </motion.div>

        <div className="text-center mt-4">
          <p className="text-[11px] text-amber-100/60 tracking-wide">
            Vstup do Zion Oasis — místo klidu, síly a vize nové civilizace.
          </p>
        </div>
      </div>
    </section>
  );
}
