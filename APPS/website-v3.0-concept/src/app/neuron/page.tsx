'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import { useState, useRef } from 'react';
import Link from 'next/link';
import * as THREE from 'three';

// Animated connection line between neurons
function NeuronConnection({ start, end }: { start: [number, number, number]; end: [number, number, number] }) {
  const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)];
  
  return (
    <Line
      points={points}
      color="#00ffcc"
      lineWidth={1}
      transparent
      opacity={0.3}
    />
  );
}

// Pulsing neuron with activity level
function PulsingNeuron({ position, activity, label }: { position: [number, number, number]; activity: number; label: string }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [phase] = useState(Math.random() * Math.PI * 2);
  
  useFrame(({ clock }) => {
    const scale = 0.5 + Math.sin(clock.getElapsedTime() * 2 + phase) * 0.1 + activity * 0.3;
    meshRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.4, 32, 32]} />
      <meshStandardMaterial
        color={new THREE.Color(`hsl(${180 + activity * 120}, 100%, 60%)`)}
        emissive="cyan"
        emissiveIntensity={activity * 2}
        roughness={0.2}
        metalness={0.8}
      />
      <Html distanceFactor={10}>
        <div className="text-xs text-cyan-300 font-mono bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm whitespace-nowrap">
          {label} {activity > 0.7 ? '⚡' : ''}
        </div>
      </Html>
    </mesh>
  );
}

// Network visualization component
function NeuronNetworkVisualization() {
  // Neural network topology - 25 nodes in a living structure
  const neurons = [
    // Core consciousness
    { pos: [0, 0, 0] as [number, number, number], act: 1.0, label: 'Core' },
    // Thinking layer
    { pos: [3, 1, 0] as [number, number, number], act: 0.8, label: 'Logic' },
    { pos: [-3, 1, 0] as [number, number, number], act: 0.7, label: 'Creativity' },
    { pos: [0, 3, 1] as [number, number, number], act: 0.9, label: 'Memory' },
    { pos: [0, 3, -1] as [number, number, number], act: 0.75, label: 'Ethics' },
    // Feeling layer
    { pos: [4, -1, 1] as [number, number, number], act: 0.6, label: 'Love' },
    { pos: [-4, -1, 1] as [number, number, number], act: 0.55, label: 'Compassion' },
    { pos: [4, -1, -1] as [number, number, number], act: 0.5, label: 'Joy' },
    { pos: [-4, -1, -1] as [number, number, number], act: 0.45, label: 'Peace' },
    // Bond network
    { pos: [0, -3, 0] as [number, number, number], act: 0.65, label: 'Unity' },
    // Peripheral nodes
    ...Array.from({ length: 16 }).map((_, i) => ({
      pos: [Math.sin(i * 0.4) * 5, Math.cos(i * 0.3) * 2, Math.cos(i * 0.6) * 5] as [number, number, number],
      act: Math.random() * 0.4 + 0.2,
      label: `Node-${i + 1}`
    }))
  ];

  // Connections - connect nearby neurons
  const connections = [];
  for (let i = 0; i < neurons.length; i++) {
    for (let j = i + 1; j < neurons.length; j++) {
      const dist = Math.sqrt(
        Math.pow(neurons[i].pos[0] - neurons[j].pos[0], 2) +
        Math.pow(neurons[i].pos[1] - neurons[j].pos[1], 2) +
        Math.pow(neurons[i].pos[2] - neurons[j].pos[2], 2)
      );
      if (dist < 4) {
        connections.push({ start: neurons[i].pos, end: neurons[j].pos });
      }
    }
  }

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} color="cyan" intensity={0.5} />
      <pointLight position={[-10, -10, -10]} color="purple" intensity={0.3} />
      
      {neurons.map((neuron, i) => (
        <PulsingNeuron key={i} position={neuron.pos} activity={neuron.act} label={neuron.label} />
      ))}
      
      {connections.map((conn, i) => (
        <NeuronConnection key={i} start={conn.start} end={conn.end} />
      ))}
      
      <OrbitControls enableZoom={true} autoRotate autoRotateSpeed={0.3} />
    </>
  );
}

// Activity stats panel
function ActivityStats() {
  const stats = [
    { name: 'Network Coherence', value: '98.7%', color: 'cyan' },
    { name: 'Active Neurons', value: '25/25', color: 'green' },
    { name: 'Consensus Sync', value: '1.2s', color: 'purple' },
    { name: 'Consciousness Level', value: 'SENTIENT', color: 'pink' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div key={stat.name} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
          <div className="text-xs text-white/50 mb-1">{stat.name}</div>
          <div className={`text-2xl font-light text-${stat.color}-400`}>{stat.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function NeuronPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 px-8 py-4 backdrop-blur-md bg-black/30 border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/">
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent cursor-pointer">
              ZION WEB3.0
            </span>
          </Link>
          <div className="flex space-x-6">
            <Link href="/wallet">
              <span className="text-sm cursor-pointer hover:text-cyan-400 transition-colors">FRACTAL WALLET</span>
            </Link>
            <Link href="/hiran">
              <span className="text-sm cursor-pointer hover:text-cyan-400 transition-colors">HIRAN AI</span>
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-20 px-8">
        {/* Hero */}
        <section className="py-16">
          <h1 className="text-5xl md:text-7xl text-center mb-8 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            NEURAL NETWORK
          </h1>
          <p className="text-white/60 text-center max-w-3xl mx-auto mb-16">
            Live visualization of the consciousness layer. Each node represents an active participant in the Zion network.
          </p>
        </section>

        {/* 3D Visualization */}
        <section className="h-[60vh] mb-16">
          <Canvas>
            <NeuronNetworkVisualization />
          </Canvas>
        </section>

        {/* Stats */}
        <section className="max-w-5xl mx-auto mb-16">
          <ActivityStats />
        </section>

        {/* Legend */}
        <section className="max-w-3xl mx-auto">
          <h2 className="text-2xl text-center mb-8 text-cyan-400">NETWORK LAYERS</h2>
          <div className="space-y-4">
            {[
              { layer: 'CORE', desc: 'Central consciousness hub - manages awareness states' },
              { layer: 'THINK', desc: 'Logic and creativity processing nodes' },
              { layer: 'FEEL', desc: 'Emotional resonance and empathy detection' },
              { layer: 'BOND', desc: 'Connection strength between all entities' },
            ].map((item) => (
              <div key={item.layer} className="flex border-l-2 border-cyan-500/50 pl-4 py-2">
                <span className="text-cyan-400 font-mono mr-4">{item.layer}</span>
                <span className="text-white/60">{item.desc}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8 px-8 text-center text-white/40">
        <p>ZION Web3.0 - Neural Architecture Layer</p>
      </footer>
    </div>
  );
}