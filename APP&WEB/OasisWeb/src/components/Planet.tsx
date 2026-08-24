'use client';

import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import {
  createPlanetTexture,
  createAtmosphereTexture,
  planetSecondaryColor,
  planetStyleFromColor,
  type PlanetStyle,
} from '../lib/planetTexture';
import OrbitingShip from './OrbitingShip';

/**
 * Universal planet component — uses real Earth textures for Nova Zeme,
 * procedural colored textures for other planets.
 *
 * Nova Zeme gets: earth-blue-marble + topology + night lights + atmosphere + Issobela orbiting.
 * Other planets get: procedural canvas texture based on color params.
 */
export default function Planet({
  position = [0, 0, 0] as [number, number, number],
  radius = 0.8,
  isMobile = false,
  variant = 'earth' as 'earth' | 'mars' | 'ice' | 'gas' | 'jungle' | 'ocean',
  hasAtmosphere = true,
  hasOrbit = false,
  orbitColor = '#06b6d4',
  rotationSpeed = 0.05,
  onClick,
  label,
  seed,
  style,
}: {
  position?: [number, number, number];
  radius?: number;
  isMobile?: boolean;
  variant?: 'earth' | 'mars' | 'ice' | 'gas' | 'jungle' | 'ocean';
  hasAtmosphere?: boolean;
  hasOrbit?: boolean;
  orbitColor?: string;
  rotationSpeed?: number;
  onClick?: () => void;
  label?: string;
  seed?: number;
  style?: PlanetStyle;
}) {
  const planetRef = useRef<THREE.Group>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [textures, setTextures] = useState<{
    color?: THREE.Texture;
    bump?: THREE.Texture;
    night?: THREE.Texture;
  }>({});

  const baseColor = useMemo(() => getVariantColor(variant), [variant]);
  const secondaryColor = useMemo(() => planetSecondaryColor(baseColor), [baseColor]);
  const effectiveStyle = useMemo(() => style ?? planetStyleFromColor(baseColor), [style, baseColor]);
  const effectiveSeed = useMemo(
    () => seed ?? (label ? label.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : variant.charCodeAt(0) * 137),
    [seed, label, variant]
  );

  // Load Earth textures only for 'earth' variant (Nova Zeme)
  useEffect(() => {
    if (variant !== 'earth') return;
    const loader = new THREE.TextureLoader();
    loader.load('/textures/earth-blue-marble.jpg', (color) => {
      color.colorSpace = THREE.SRGBColorSpace;
      loader.load('/textures/earth-topology.png', (bump) => {
        loader.load('/textures/earth-dark.jpg', (night) => {
          night.colorSpace = THREE.SRGBColorSpace;
          setTextures({ color, bump, night });
        });
      });
    });
  }, [variant]);

  // Procedural texture for non-earth variants — unique per seed
  const procTexture = useMemo(() => {
    if (variant === 'earth') return null;
    return createPlanetTexture(baseColor, secondaryColor, effectiveSeed, isMobile, effectiveStyle);
  }, [variant, baseColor, secondaryColor, effectiveSeed, isMobile, effectiveStyle]);

  // Atmosphere glow texture
  const glowTexture = useMemo(() => createAtmosphereTexture(baseColor, isMobile ? 64 : 128), [baseColor, isMobile]);

  useFrame((_, delta) => {
    if (planetRef.current) {
      planetRef.current.rotation.y += delta * rotationSpeed;
    }
    if (atmosphereRef.current) {
      const mat = atmosphereRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.25 + Math.sin(performance.now() * 0.001) * 0.04;
    }
  });

  // For earth variant, wait for textures
  if (variant === 'earth' && !textures.color) {
    // Show a simple sphere while loading
    return (
      <group position={position}>
        <mesh>
          <sphereGeometry args={[radius, isMobile ? 16 : 32, isMobile ? 12 : 24]} />
          <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.3} />
        </mesh>
      </group>
    );
  }

  return (
    <group
      position={position}
      onClick={(e) => { if (onClick) { e.stopPropagation(); onClick(); } }}
      onPointerOver={(e) => { if (onClick) { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; } }}
      onPointerOut={() => { if (onClick) { setHovered(false); document.body.style.cursor = 'auto'; } }}
    >
      {/* Planet */}
      <group ref={planetRef}>
        <mesh>
          <sphereGeometry args={[radius * (hovered ? 1.12 : 1), isMobile ? 24 : 32, isMobile ? 16 : 24]} />
          {variant === 'earth' ? (
            <meshStandardMaterial
              map={textures.color}
              bumpMap={textures.bump}
              bumpScale={0.04}
              roughness={0.5}
              metalness={0}
              color={new THREE.Color('#ffffff')}
              emissiveMap={textures.night}
              emissive={new THREE.Color('#f59e0b')}
              emissiveIntensity={3.0}
            />
          ) : (
            <meshPhysicalMaterial
              map={procTexture || undefined}
              color="#ffffff"
              roughness={0.65}
              metalness={0.05}
              clearcoat={0.25}
              clearcoatRoughness={0.45}
              emissive={new THREE.Color(baseColor)}
              emissiveIntensity={0.35}
            />
          )}
        </mesh>
      </group>

      {/* Atmosphere glow */}
      {hasAtmosphere && (
        <mesh ref={atmosphereRef} scale={1.08}>
          <sphereGeometry args={[radius, 16, 12]} />
          <meshBasicMaterial
            map={glowTexture}
            transparent
            opacity={0.25}
            side={THREE.BackSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Orbit ring (for Issobela-style satellites) */}
      {hasOrbit && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius + 0.3 - 0.01, radius + 0.3 + 0.01, 48]} />
          <meshBasicMaterial
            color={orbitColor}
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Light to illuminate planet */}
      <pointLight position={[radius + 1, 0.5, radius + 1]} intensity={1.5} color="#ffffff" distance={radius * 6} />
      <ambientLight intensity={0.4} />

      {/* Label (desktop only, if provided) */}
      {label && !isMobile && (
        <Html position={[0, radius + 0.25, 0]} center distanceFactor={6} occlude style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(0,0,0,0.7)',
              border: `1px solid ${getVariantColor(variant)}80`,
              color: getVariantColor(variant),
              padding: '3px 10px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: `0 0 14px ${getVariantColor(variant)}40`,
            }}
          >
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * Nova Zeme — Earth-like planet with Issobela satellite orbiting.
 * Clickable — opens WorldPanel with 3 L5 pioneer projects.
 * Bright, with 3 project markers on surface.
 */

interface PioneerProject {
  id: string;
  name: string;
  location: string;
  color: string;
  rgb: string;
  descCs: string;
  descEn: string;
  lat: number; // -90..90
  lon: number; // -180..180
}

const PIONEER_PROJECTS: PioneerProject[] = [
  {
    id: 'genesis',
    name: 'Zahrada Genesis',
    location: 'Algarve · Portugalsko',
    color: '#10b981',
    rgb: '16, 185, 129',
    descCs: 'Atlantický uzel Terra Nova — farma, glamping, voda, energie, komunita.',
    descEn: 'Atlantic Terra Nova node — farm, glamping, water, energy, community.',
    lat: 37,
    lon: -8,
  },
  {
    id: 'dharma',
    name: 'Dharma Temple',
    location: 'La Palma · Kanárské ostrovy',
    color: '#8b5cf6',
    rgb: '139, 92, 246',
    descCs: 'Spirituální uzel — meditace, syntropic zahrada, dharma governance.',
    descEn: 'Spiritual node — meditation, syntropic garden, dharma governance.',
    lat: 28,
    lon: -17,
  },
  {
    id: 'piko-ora',
    name: 'Te Pīko Ora',
    location: 'Tahiti · Francouzská Polynésie',
    color: '#06b6d4',
    rgb: '6, 182, 212',
    descCs: 'Tichomořský uzel — ochrana mořského dědictví, regenerativní komunita.',
    descEn: 'Pacific node — marine heritage protection, regenerative community.',
    lat: -17,
    lon: -149,
  },
];

function latLonToVec3(lat: number, lon: number, r: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.sin(theta);
  return [x, y, z];
}

export function NovaZeme({
  position = [0, 0, 8] as [number, number, number],
  isMobile = false,
  onSelect,
}: {
  position?: [number, number, number];
  isMobile?: boolean;
  onSelect?: () => void;
}) {
  const radius = isMobile ? 0.7 : 0.9;
  const issobelaRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const issobelaOrbit = radius + 0.4;

  useFrame(() => {
    if (issobelaRef.current) {
      const t = performance.now() * 0.0005;
      issobelaRef.current.position.x = Math.cos(t) * issobelaOrbit;
      issobelaRef.current.position.z = Math.sin(t) * issobelaOrbit;
      issobelaRef.current.position.y = Math.sin(t * 0.5) * 0.15;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect?.();
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  return (
    <group position={position} ref={groupRef}>
      {/* Nova Zeme planet — clickable */}
      <group
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <Planet
          position={[0, 0, 0]}
          radius={radius * (hovered ? 1.08 : 1)}
          isMobile={isMobile}
          variant="earth"
          hasAtmosphere
          hasOrbit
          orbitColor="#06b6d4"
          rotationSpeed={0.08}
        />

        {/* 3 Pioneer Project markers on surface */}
        {PIONEER_PROJECTS.map((p) => {
          const [mx, my, mz] = latLonToVec3(p.lat, p.lon, radius * 1.02);
          return (
            <group key={p.id} position={[mx, my, mz]}>
              {/* Glowing marker */}
              <mesh>
                <sphereGeometry args={[0.04, 12, 12]} />
                <meshBasicMaterial color={p.color} />
              </mesh>
              {/* Glow halo */}
              <mesh scale={2}>
                <sphereGeometry args={[0.04, 8, 8]} />
                <meshBasicMaterial
                  color={p.color}
                  transparent
                  opacity={0.3}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
              {/* Label (desktop only) */}
              {!isMobile && (
                <Html
                  position={[0, 0.12, 0]}
                  center
                  distanceFactor={4}
                  occlude
                  style={{ pointerEvents: 'none' }}
                >
                  <div
                    style={{
                      background: `rgba(${p.rgb}, 0.85)`,
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '8px',
                      fontSize: '10px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      boxShadow: `0 0 12px rgba(${p.rgb}, 0.6)`,
                      border: `1px solid rgba(255,255,255,0.3)`,
                    }}
                  >
                    {p.name}
                  </div>
                </Html>
              )}
            </group>
          );
        })}
      </group>

      {/* Issobela — small glowing satellite (L6) */}
      <mesh ref={issobelaRef}>
        <boxGeometry args={[0.08, 0.08, 0.08]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#38bdf8"
          emissiveIntensity={1.5}
        />
      </mesh>

      {/* Millennium Falcon-style ship in orbit around Nova Zeme */}
      {!isMobile && (
        <group scale={0.7}>
          <OrbitingShip radius={radius + 0.55} speed={0.42} yAmp={0.1} color="#9ca3af" scale={0.9} />
        </group>
      )}

      {/* "Nova Zeme" label above planet (desktop) */}
      {!isMobile && (
        <Html position={[0, radius + 0.4, 0]} center distanceFactor={6} occlude style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(0,0,0,0.7)',
              border: '1px solid rgba(6,182,212,0.5)',
              color: '#06b6d4',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              whiteSpace: 'nowrap',
              boxShadow: '0 0 20px rgba(6,182,212,0.3)',
            }}
          >
            NOVA ZEME · L5
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Helpers ──

function getVariantColor(variant: string): string {
  const colors: Record<string, string> = {
    mars: '#c2410c',
    ice: '#38bdf8',
    gas: '#a855f7',
    jungle: '#059669',
    ocean: '#0ea5e9',
    earth: '#0ea5e9',
  };
  return colors[variant] || '#ffffff';
}


