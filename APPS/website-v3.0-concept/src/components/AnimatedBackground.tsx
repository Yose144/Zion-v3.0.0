'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';

// Individual floating particle
function FloatingParticle({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  useFrame(({ clock }) => {
    meshRef.current.position.y += Math.sin(clock.getElapsedTime() * 0.5) * 0.002;
    meshRef.current.rotation.x += 0.005;
    meshRef.current.rotation.y += 0.005;
  });

  return (
    <mesh ref={meshRef} position={position}>
      <icosahedronGeometry args={[0.05, 0]} />
      <meshBasicMaterial color="#ffffff" opacity={0.3} transparent />
    </mesh>
  );
}

// Energy wave animation
function EnergyWave() {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  useFrame(({ clock }) => {
    const scale = 1 + Math.sin(clock.getElapsedTime()) * 0.1;
    meshRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[50, 50, 100, 100]} />
      <meshBasicMaterial color="#00ffcc" opacity={0.05} transparent wireframe />
    </mesh>
  );
}

// Main animated background
export default function AnimatedBackground() {
  const particles = Array.from({ length: 100 }).map(() => ({
    pos: [
      (Math.random() - 0.5) * 50,
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 20,
    ] as [number, number, number],
  }));

  return (
    <div className="fixed inset-0 -z-10">
      <Canvas camera={{ position: [0, 0, 10] }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} color="cyan" intensity={0.3} />
        <pointLight position={[-10, -10, -10]} color="purple" intensity={0.2} />
        
        {/* Particles */}
        {particles.map((p, i) => (
          <FloatingParticle key={i} position={p.pos} />
        ))}
        
        {/* Large central sphere */}
        <Sphere args={[5, 32, 32]} position={[0, 0, -5]}>
          <meshBasicMaterial color="#ff00cc" opacity={0.1} transparent />
        </Sphere>
        
        <EnergyWave />
      </Canvas>
    </div>
  );
}