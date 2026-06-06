import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

function NodeMesh({ position, color, label, status }: {
  position: [number, number, number];
  color: string;
  label: string;
  status: "running" | "stopped";
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const isRunning = status === "running";
  const glowIntensity = isRunning ? 2 : 0.3;

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={glowIntensity}
          roughness={0.3}
          metalness={0.8}
        />
      </mesh>
      {/* Glow ring */}
      {isRunning && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.2, 0.02, 16, 100]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} />
        </mesh>
      )}
      {/* Label */}
      <mesh position={[0, 1.5, 0]}>
        <planeGeometry args={[2, 0.5]} />
        <meshBasicMaterial color="#000" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function ConnectionLine({ start, end, active }: {
  start: [number, number, number];
  end: [number, number, number];
  active: boolean;
}) {
  const points = useMemo(() => {
    return [new THREE.Vector3(...start), new THREE.Vector3(...end)];
  }, [start, end]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color={active ? "#00ffaa" : "#333"}
        transparent
        opacity={active ? 0.8 : 0.2}
      />
    </line>
  );
}

function DataParticles({ path, count = 20 }: { path: [number, number, number][]; count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      t: i / count,
      speed: 0.005 + Math.random() * 0.01,
    }));
  }, [count]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshBasicMaterial color="#00ffaa" transparent opacity={0.8} />
    </instancedMesh>
  );
}

export function NetworkScene() {
  const nodes = [
    { name: "Edge", pos: [0, 2, 0] as [number, number, number], color: "#00ccff", status: "running" as const },
    { name: "Core", pos: [-4, 0, 2] as [number, number, number], color: "#00ffaa", status: "running" as const },
    { name: "macOS", pos: [4, 0, -2] as [number, number, number], color: "#ffcc00", status: "running" as const },
  ];

  return (
    <div className="w-full h-[500px] glass-panel rounded-xl overflow-hidden">
      <Canvas camera={{ position: [0, 5, 10], fov: 50 }}>
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} color="#00ccff" />

        {/* Grid */}
        <gridHelper args={[20, 20, "#222", "#111"]} position={[0, -2, 0]} />

        {/* Nodes */}
        {nodes.map((node) => (
          <NodeMesh
            key={node.name}
            position={node.pos}
            color={node.color}
            label={node.name}
            status={node.status}
          />
        ))}

        {/* Connections */}
        <ConnectionLine start={nodes[0].pos} end={nodes[1].pos} active />
        <ConnectionLine start={nodes[0].pos} end={nodes[2].pos} active />

        {/* Stars */}
        {Array.from({ length: 100 }).map((_, i) => (
          <mesh
            key={i}
            position={[
              (Math.random() - 0.5) * 40,
              (Math.random() - 0.5) * 40,
              (Math.random() - 0.5) * 40,
            ]}
          >
            <sphereGeometry args={[0.02, 4, 4]} />
            <meshBasicMaterial color="#fff" transparent opacity={0.3 + Math.random() * 0.4} />
          </mesh>
        ))}

        <OrbitControls enablePan enableZoom enableRotate />
      </Canvas>
    </div>
  );
}
