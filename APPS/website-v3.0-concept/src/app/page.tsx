import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial, Html } from '@react-three/drei';
import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

// Animated Neuron Node
function NeuronNode({ position, color, label }: { position: [number, number, number]; color: string; label: string }) {
  return (
    <Sphere position={position} args={[0.3, 32, 32]}>
      <MeshDistortMaterial
        color={color}
        distort={0.4}
        speed={2}
        roughness={0.2}
        metalness={0.8}
      />
      <Html distanceFactor={10}>
        <div className="text-xs text-white font-mono bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">
          {label}
        </div>
      </Html>
    </Sphere>
  );
}

// Neural Network Structure
function NeuronNetwork() {
  const nodes = [
    { pos: [0, 0, 0] as [number, number, number], color: '#00ffcc', label: 'Aware' },
    { pos: [2, 1, -1] as [number, number, number], color: '#ff00cc', label: 'Think' },
    { pos: [-2, 1, -1] as [number, number, number], color: '#ffcc00', label: 'Feel' },
    { pos: [1, -2, 1] as [number, number, number], color: '#cc00ff', label: 'Bond' },
    { pos: [-1, -2, 1] as [number, number, number], color: '#00ccff', label: 'Dharma' },
    { pos: [0, 2, 0] as [number, number, number], color: '#ffffff', label: 'Core' },
  ];

  return (
    <>
      {nodes.map((node, i) => (
        <NeuronNode key={i} position={node.pos} color={node.color} label={node.label} />
      ))}
    </>
  );
}

// Living Tree of Life (3D fractal tree)
function LivingTree() {
  return (
    <group>
      <Sphere args={[0.5, 32, 32]} position={[0, 0, 0]}>
        <meshBasicMaterial color="#00ffcc" wireframe />
      </Sphere>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} position={[Math.sin(i * 0.5) * 2, Math.cos(i * 0.3) * 2, Math.cos(i * 0.7) * 2]}>
          <tetrahedronGeometry args={[0.2, 0]} />
          <meshBasicMaterial color={i % 3 === 0 ? '#ff00cc' : i % 3 === 1 ? '#00ccff' : '#ffcc00'} wireframe />
        </mesh>
      ))}
      <group position={[0, -3, 0]}>
        {Array.from({ length: 20 }).map((_, i) => (
          <Sphere key={i} args={[0.1, 16, 16]} position={[Math.sin(i * 0.3) * 3, -2, Math.cos(i * 0.3) * 3]}>
            <meshBasicMaterial color="#ffffff" opacity={0.3} transparent />
          </Sphere>
        ))}
      </group>
    </group>
  );
}

// Consciousness Particles
function ConsciousnessParticles() {
  const positions = useMemo(() => 
    new Float32Array(Array.from({ length: 1000 }, () => (Math.random() - 0.5) * 20), []
  );
  
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#00ffcc" opacity={0.6} transparent />
    </points>
  );
}

export default function ConsciousnessPortal() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    { href: '/neuron', label: 'NEURON' },
    { href: '/wallet', label: 'WALLET' },
    { href: '/hiran', label: 'HIRAN' },
  ];

  return (
    <div className="min-h-screen relative">
      {/* Navigation - Desktop */}
      <nav className="fixed top-0 w-full z-50 px-4 sm:px-8 py-3 sm:py-4 backdrop-blur-md bg-black/30 border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent"
          >
            ZION WEB3.0
          </motion.div>
          {/* Desktop menu */}
          <div className="hidden sm:flex space-x-4 md:space-x-6">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <motion.span
                  whileHover={{ scale: 1.1, color: '#00ffcc' }}
                  className="text-xs sm:text-sm cursor-pointer hover:text-cyan-400 transition-colors"
                >
                  {item.label}
                </motion.span>
              </Link>
            ))}
          </div>
          {/* Mobile menu button */}
          <div className="sm:hidden">
            <button className="text-cyan-400">☰</button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20 px-8">
        {/* Hero Section */}
        <section className="min-h-[80vh] flex flex-col justify-center items-center relative">
          <div className="absolute inset-0 -z-10">
            {mounted && (
              <Canvas>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />
                <LivingTree />
                <ConsciousnessParticles />
                <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
              </Canvas>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="text-center z-10"
          >
            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-extralight mb-6 sm:mb-8 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent px-4">
              CONSCIOUSNESS PORTAL
            </h1>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/70 max-w-2xl sm:max-w-3xl mx-auto mb-8 sm:mb-12 font-light px-4">
              Enter the quantum realm of decentralized awareness.
            </p>
            <motion.div whileHover={{ scale: 1.05 }} className="inline-block">
              <Link href="/neuron">
                <button className="px-6 sm:px-12 py-3 sm:py-4 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/50 rounded-full text-base sm:text-lg backdrop-blur-sm hover:bg-cyan-500/30 transition-all">
                  ENTER THE NETWORK →
                </button>
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* Features Grid */}
        <section className="py-32 max-w-7xl mx-auto">
          <h2 className="text-4xl text-center mb-16 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            NEURAL ARCHITECTURE
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: 'Aware Layer', desc: 'Real-time consciousness monitoring of all network nodes', color: 'cyan' },
              { title: 'Think Layer', desc: 'AI-powered consensus through neural pathways', color: 'purple' },
              { title: 'Feel Layer', desc: 'Emotional resonance detection in transactions', color: 'pink' },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className={`p-8 border border-${feature.color}-500/30 rounded-3xl bg-gradient-to-b from-${feature.color}-500/5 to-transparent backdrop-blur-sm`}
              >
                <h3 className={`text-2xl font-light mb-4 text-${feature.color}-400`}>{feature.title}</h3>
                <p className="text-white/60">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-8 text-center text-white/40">
        <p>ZION Web3.0 - Where Consciousness Meets Consensus</p>
      </footer>
    </div>
  );
}