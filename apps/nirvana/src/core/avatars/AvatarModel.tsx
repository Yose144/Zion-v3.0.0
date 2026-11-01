'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarLook } from './kit';

/**
 * Procedurální avatar — postava z primitiv, ~14 meshů.
 *
 * Nic se nenačítá (v repu nejsou modely); všechno plyne z `avatarLook()`,
 * takže stejné id vypadá u tebe i u ostatních hráčů stejně.
 * Měřítko: postava stojí nohama na y = 0, základní výška 1,75 m.
 */
export function AvatarModel({
  look,
  animate = false,
  opacity = 1,
}: {
  look: AvatarLook;
  animate?: boolean;
  opacity?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const scale = useMemo(() => look.height / 1.75, [look.height]);
  const width = look.width;

  useFrame((_, delta) => {
    if (!animate || !group.current) return;
    group.current.rotation.y += delta * 0.35;
    group.current.position.y = Math.sin(performance.now() / 900) * 0.02;
  });

  const transparent = opacity < 1;

  return (
    <group ref={group} scale={[scale, scale, scale]}>
      {/* záře pod nohama */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42 * width, 20]} />
        <meshBasicMaterial color={look.palette.glow} transparent opacity={0.22 * opacity} />
      </mesh>

      {/* plášť */}
      <mesh position={[0, 0.52, 0]}>
        <coneGeometry args={[0.42 * width, 1.02, 14, 1, true]} />
        <meshStandardMaterial
          color={look.palette.robe}
          roughness={0.82}
          metalness={0.08}
          side={THREE.DoubleSide}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>

      {/* lem pláště */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36 * width, 0.43 * width, 20]} />
        <meshStandardMaterial
          color={look.palette.trim}
          emissive={look.palette.trim}
          emissiveIntensity={0.5}
          side={THREE.DoubleSide}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>

      {/* trup */}
      <mesh position={[0, 1.12, 0]}>
        <capsuleGeometry args={[0.19 * width, 0.42, 4, 12]} />
        <meshStandardMaterial
          color={look.palette.robe}
          roughness={0.7}
          metalness={0.12}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>

      {/* náhrdelník / pás */}
      <mesh position={[0, 1.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.15 * width, 0.022, 6, 18]} />
        <meshStandardMaterial
          color={look.palette.trim}
          emissive={look.palette.trim}
          emissiveIntensity={0.7}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>

      {/* ramena */}
      {[-1, 1].map((side) => (
        <mesh key={`shoulder-${side}`} position={[side * 0.16 * width, 1.3, 0]}>
          <sphereGeometry args={[0.085, 12, 10]} />
          <meshStandardMaterial color={look.palette.robe} roughness={0.72} metalness={0.1} />
        </mesh>
      ))}

      {/* krk */}
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.055, 0.06, 0.1, 10]} />
        <meshStandardMaterial color={look.palette.skin} roughness={0.62} />
      </mesh>

      {/* hlava */}
      <mesh position={[0, 1.53, 0]}>
        <sphereGeometry args={[0.145, 16, 14]} />
        <meshStandardMaterial color={look.palette.skin} roughness={0.62} metalness={0.04} />
      </mesh>

      {/* koruna / čelenka */}
      {look.crown && (
        <mesh position={[0, 1.64, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.11, 0.022, 6, 16]} />
          <meshStandardMaterial
            color={look.palette.trim}
            emissive={look.palette.glow}
            emissiveIntensity={1.1}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      )}

      {/* paže */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.24 * width, 1.08, 0]}>
          <capsuleGeometry args={[0.06, 0.42, 4, 8]} />
          <meshStandardMaterial color={look.palette.skin} roughness={0.62} />
        </mesh>
      ))}

      {/* aura (vzácní) */}
      {Array.from({ length: look.auraRings }, (_, index) => (
        <mesh
          key={`aura-${index}`}
          position={[0, 0.95 + index * 0.22, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.42 * width + index * 0.08, 0.012, 6, 32]} />
          <meshBasicMaterial
            color={look.palette.glow}
            transparent
            opacity={0.5 * opacity}
            toneMapped={false}
          />
        </mesh>
      ))}

      {look.ornaments.includes('halo') && (
        <mesh position={[0, 1.7, -0.06]} rotation={[Math.PI / 2.6, 0, 0]}>
          <torusGeometry args={[0.2, 0.017, 6, 26]} />
          <meshBasicMaterial color={look.palette.glow} toneMapped={false} transparent opacity={0.85 * opacity} />
        </mesh>
      )}

      {look.ornaments.includes('staff') && (
        <group position={[0.3 * width, 1.05, 0.02]}>
          <mesh>
            <cylinderGeometry args={[0.022, 0.026, 1.9, 8]} />
            <meshStandardMaterial color="#6b4a2f" roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.0, 0]}>
            <sphereGeometry args={[0.075, 12, 10]} />
            <meshBasicMaterial color={look.palette.glow} toneMapped={false} />
          </mesh>
        </group>
      )}

      {look.ornaments.includes('sword') && (
        <group position={[-0.3 * width, 1.02, 0.04]} rotation={[0, 0, 0.18]}>
          <mesh>
            <boxGeometry args={[0.05, 1.15, 0.02]} />
            <meshStandardMaterial color="#cfd6e4" metalness={0.85} roughness={0.22} />
          </mesh>
          <mesh position={[0, -0.55, 0]}>
            <boxGeometry args={[0.2, 0.03, 0.05]} />
            <meshStandardMaterial color={look.palette.trim} metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
      )}

      {look.ornaments.includes('book') && (
        <mesh position={[-0.22 * width, 0.95, 0.22]} rotation={[0.2, -0.4, 0]}>
          <boxGeometry args={[0.26, 0.34, 0.06]} />
          <meshStandardMaterial color={look.palette.trim} roughness={0.55} metalness={0.15} />
        </mesh>
      )}

      {look.ornaments.includes('lotus') && (
        <group position={[0.26 * width, 1.34, 0.1]}>
          {Array.from({ length: 6 }, (_, petal) => (
            <mesh
              key={petal}
              rotation={[0, (petal / 6) * Math.PI * 2, 0.7]}
              position={[0, 0, 0]}
            >
              <coneGeometry args={[0.05, 0.16, 5]} />
              <meshStandardMaterial color="#ff9de2" emissive="#ff9de2" emissiveIntensity={0.35} />
            </mesh>
          ))}
        </group>
      )}

      {look.ornaments.includes('orb') && (
        <mesh position={[0.32 * width, 1.5, 0.12]}>
          <sphereGeometry args={[0.085, 14, 12]} />
          <meshBasicMaterial color={look.palette.glow} toneMapped={false} />
        </mesh>
      )}

      {look.ornaments.includes('bow') && (
        <mesh position={[-0.3 * width, 1.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.34, 0.02, 6, 24, Math.PI * 0.9]} />
          <meshStandardMaterial color="#c8a26a" roughness={0.7} />
        </mesh>
      )}

      {look.ornaments.includes('spear') && (
        <group position={[0.32 * width, 1.05, 0]}>
          <mesh>
            <cylinderGeometry args={[0.018, 0.018, 1.9, 6]} />
            <meshStandardMaterial color="#7a5a3a" roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.02, 0]}>
            <coneGeometry args={[0.055, 0.2, 6]} />
            <meshStandardMaterial color="#cfd6e4" metalness={0.8} roughness={0.25} />
          </mesh>
        </group>
      )}

      {look.ornaments.includes('conch') && (
        <mesh position={[0.22 * width, 1.3, 0.16]} rotation={[0.3, 0.4, 0.2]}>
          <coneGeometry args={[0.07, 0.2, 10]} />
          <meshStandardMaterial color="#f4efe4" roughness={0.4} metalness={0.1} />
        </mesh>
      )}

      {look.ornaments.includes('veena') && (
        <group position={[-0.26 * width, 1.2, 0.16]} rotation={[0, 0, 0.5]}>
          <mesh>
            <boxGeometry args={[0.09, 0.9, 0.06]} />
            <meshStandardMaterial color="#8a5f2f" roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.42, 0]}>
            <sphereGeometry args={[0.11, 12, 10]} />
            <meshStandardMaterial color="#8a5f2f" roughness={0.6} />
          </mesh>
        </group>
      )}

      {look.ornaments.includes('drum') && (
        <mesh position={[0.24 * width, 1.15, 0.18]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.16, 12]} />
          <meshStandardMaterial color="#b06a3a" roughness={0.65} />
        </mesh>
      )}

      {look.ornaments.includes('banner') && (
        <group position={[-0.3 * width, 1.2, 0]}>
          <mesh>
            <cylinderGeometry args={[0.018, 0.018, 1.8, 6]} />
            <meshStandardMaterial color="#6b4a2f" roughness={0.8} />
          </mesh>
          <mesh position={[0.1, 0.55, 0]}>
            <planeGeometry args={[0.28, 0.42]} />
            <meshStandardMaterial
              color={look.palette.trim}
              emissive={look.palette.trim}
              emissiveIntensity={0.35}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}
