'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { PARK_GAMES, type ParkGameId } from '@/core/park/games';
import type { ParkScores } from '@/core/park/scores';

/**
 * JUPITER STATION — pouť.
 *
 * Plošina na oběžné dráze Jupitera: tři arkádové skříně, ruské kolo, vstupní
 * brána a tabule skóre. Jupiter visí za zády jako obloha — jediná textura
 * v celé scéně (2k_jupiter.jpg), všechno ostatní je procedurální.
 *
 * Hra samotná je canvas 2D, který se sem dostane jako `CanvasTexture`. Proto
 * ji vidí i hráč ve VR: obrazovka skříně je skutečný povrch, ne DOM.
 */

const DECK_R = 18;
const WHEEL_R = 7.6;
const WHEEL_CENTER: [number, number, number] = [0, 8.6, -13];
const CABINET_Z = -3.5;

interface Cabinet {
  id: ParkGameId;
  angle: number;
}

const CABINETS: Cabinet[] = [
  { id: 'pong', angle: -5.6 },
  { id: 'breakout', angle: 0 },
  { id: 'snake', angle: 5.6 },
];

function useJupiterTexture(): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    new THREE.TextureLoader().load('/textures/2k_jupiter.jpg', (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      if (alive) setTexture(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);
  return texture;
}

/** Pás hvězd — jedna geometrie, žádný shader. */
function Stars() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const r = 260 + Math.random() * 190;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <points geometry={geometry}>
      <pointsMaterial size={1.6} color="#cfd8ff" sizeAttenuation transparent opacity={0.75} depthWrite={false} />
    </points>
  );
}

function Deck() {
  return (
    <group>
      <mesh position={[0, -0.5, 0]} receiveShadow>
        <cylinderGeometry args={[DECK_R, DECK_R + 0.6, 1, 72]} />
        <meshStandardMaterial color="#40364f" metalness={0.05} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[DECK_R - 0.35, DECK_R - 0.05, 96]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.015, -3.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[7, 64]} />
        <meshBasicMaterial color="#4a3520" transparent opacity={0.3} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6.2, 6.35, 96]} />
        <meshBasicMaterial color="#e8a33d" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* vstupní pruh */}
      <mesh position={[0, 0.03, 10.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 8]} />
        <meshBasicMaterial color="#3a2c46" transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Cabinet({
  id,
  angle,
  lang,
  active,
  texture,
  onSelect,
}: {
  id: ParkGameId;
  angle: number;
  lang: 'cs' | 'en';
  active: boolean;
  texture: THREE.CanvasTexture | null;
  onSelect: (id: ParkGameId) => void;
}) {
  const game = PARK_GAMES.find((entry) => entry.id === id) ?? PARK_GAMES[0]!;
  const x = angle;
  const z = CABINET_Z;
  const [hover, setHover] = useState(false);

  return (
    <group
      position={[x, 0, z]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHover(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {/* tělo skříně */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[2.1, 3, 1.3]} />
        <meshStandardMaterial color={active ? '#4a3c5e' : '#3a3048'} metalness={0.2} roughness={0.6} />
      </mesh>
      {/* ovládací pult */}
      <mesh position={[0, 1.16, 0.72]} rotation={[-0.42, 0, 0]}>
        <boxGeometry args={[1.92, 0.42, 0.56]} />
        <meshStandardMaterial color="#5a4a70" metalness={0.35} roughness={0.45} />
      </mesh>
      {/* obrazovka */}
      <mesh position={[0, 2.0, 0.66]} rotation={[-0.1, 0, 0]}>
        <planeGeometry args={[1.72, 1.23]} />
        {active && texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshBasicMaterial color={hover ? '#3a3050' : '#241a2e'} />
        )}
      </mesh>
      {/* rámeček obrazovky */}
      <mesh position={[0, 2.0, 0.64]} rotation={[-0.1, 0, 0]}>
        <planeGeometry args={[1.84, 1.35]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={active ? 0.5 : 0.18} />
      </mesh>
      {/* marquee */}
      <mesh position={[0, 2.92, 0.62]}>
        <planeGeometry args={[1.86, 0.4]} />
        <meshBasicMaterial color="#e8a33d" transparent opacity={active ? 0.85 : 0.4} />
      </mesh>
      <Html position={[0, 3.7, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
        <span className={`park-cabinet${active ? ' is-active' : ''}`}>{game.title[lang]}</span>
      </Html>
      {active && (
        <pointLight position={[0, 2.2, 1.3]} intensity={6} color="#ffd9a0" distance={6} decay={2} />
      )}
    </group>
  );
}

function FerrisWheel({ riding, onRide }: { riding: boolean; onRide: () => void }) {
  const wheel = useRef<THREE.Group>(null);
  const gondolas = useRef<(THREE.Group | null)[]>([]);
  const spin = useRef(0);
  const [hover, setHover] = useState(false);
  const GONDOLAS = 10;

  useFrame((_, delta) => {
    spin.current += delta * 0.09;
    if (wheel.current) wheel.current.rotation.z = spin.current;
    for (let i = 0; i < GONDOLAS; i++) {
      const node = gondolas.current[i];
      if (!node) continue;
      const angle = spin.current + (i / GONDOLAS) * Math.PI * 2;
      node.position.set(Math.cos(angle) * WHEEL_R, Math.sin(angle) * WHEEL_R, 0);
    }
  });

  const legLength = Math.hypot(WHEEL_R * 0.62, WHEEL_CENTER[1]);
  const legAngle = Math.atan2(WHEEL_R * 0.62, WHEEL_CENTER[1]);

  return (
    <group position={WHEEL_CENTER}>
      {/* A-rámy: z plošiny do středu kola */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[(side * WHEEL_R * 0.62) / 2, -WHEEL_CENTER[1] / 2, 0]}
          rotation={[0, 0, side * legAngle]}
        >
          <cylinderGeometry args={[0.16, 0.2, legLength, 8]} />
          <meshStandardMaterial color="#5b4a6b" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, -WHEEL_CENTER[1] + 0.2, 0]} castShadow>
        <boxGeometry args={[WHEEL_R * 1.35, 0.3, 1.6]} />
        <meshStandardMaterial color="#3b3048" metalness={0.5} roughness={0.5} />
      </mesh>

      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onRide();
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHover(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[WHEEL_R + 1.4, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group ref={wheel}>
        {[-0.6, 0.6].map((z) => (
          <mesh key={z} position={[0, 0, z]}>
            <torusGeometry args={[WHEEL_R, 0.12, 8, 72]} />
            <meshStandardMaterial color="#ffd166" metalness={0.85} roughness={0.28} emissive="#4a3208" emissiveIntensity={0.6} />
          </mesh>
        ))}
        {Array.from({ length: GONDOLAS }, (_, i) => {
          const angle = (i / GONDOLAS) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(angle) * (WHEEL_R / 2), Math.sin(angle) * (WHEEL_R / 2), 0]} rotation={[0, 0, angle - Math.PI / 2]}>
              <boxGeometry args={[0.14, WHEEL_R, 0.14]} />
              <meshStandardMaterial color="#d8b46a" metalness={0.75} roughness={0.32} />
            </mesh>
          );
        })}
        <mesh>
          <cylinderGeometry args={[0.45, 0.45, 1.5, 12]} />
          <meshStandardMaterial color="#ffd166" metalness={0.9} roughness={0.25} />
        </mesh>
      </group>

      {/* gondoly visí kolmo — neotáčejí se s kolem */}
      {Array.from({ length: GONDOLAS }, (_, i) => (
        <group
          key={`g${i}`}
          ref={(node) => {
            gondolas.current[i] = node;
          }}
        >
          <mesh castShadow>
            <boxGeometry args={[1.1, 1.1, 1.1]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? '#ffd166' : '#7fe3d4'}
              metalness={0.4}
              roughness={0.5}
              emissive={i % 2 === 0 ? '#3a2a05' : '#0b3a38'}
              emissiveIntensity={0.6}
            />
          </mesh>
        </group>
      ))}

      <Html position={[0, WHEEL_R + 1.8, 0]} center distanceFactor={18} style={{ pointerEvents: 'none' }}>
        <span className={`park-ride${riding ? ' is-riding' : ''}${hover ? ' is-hover' : ''}`}>
          {riding ? 'jízda…' : 'ruské kolo'}
        </span>
      </Html>
    </group>
  );
}

/** Kamera jede v gondole — jediná věc v parku, která je lepší ve VR. */
function RideCamera({ active }: { active: boolean }) {
  const camera = useThree((state) => state.camera);
  const phase = useRef(0);
  const started = useRef(false);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (!active) {
      phase.current = 0;
      started.current = false;
    }
  }, [active]);

  useFrame((_, delta) => {
    if (!active) return;
    phase.current += delta * 0.36;
    const angle = phase.current + Math.PI / 2;
    const radius = WHEEL_R + 2.6;
    pos.set(
      WHEEL_CENTER[0] + Math.cos(angle) * radius,
      WHEEL_CENTER[1] + Math.sin(angle) * radius,
      WHEEL_CENTER[2] + 1.8,
    );
    if (!started.current) {
      // nástup: skok do gondoly, ne průlet konstrukcí
      camera.position.copy(pos);
      started.current = true;
    } else {
      camera.position.lerp(pos, Math.min(1, delta * 9));
    }
    // z gondoly dolů do nádvoří: kabiny, tabule, Jupiter v pozadí
    look.set(0, 2.4, 3);
    camera.lookAt(look);
  });

  return null;
}

function ScoreBoard({ scores, lang }: { scores: ParkScores; lang: 'cs' | 'en' }) {
  return (
    <group position={[-9.4, 0, 3.4]} rotation={[0, 0.46, 0]}>
      <mesh position={[0, 2.4, 0]} castShadow>
        <boxGeometry args={[2.9, 4.8, 0.22]} />
        <meshStandardMaterial color="#171220" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 2.4, 0.13]}>
        <planeGeometry args={[2.65, 4.5]} />
        <meshBasicMaterial color="#0d0a14" />
      </mesh>
      <Html position={[0, 2.4, 0.2]} center distanceFactor={11} style={{ pointerEvents: 'none' }}>
        <div className="park-board">
          <strong>{lang === 'cs' ? 'TABULE POUTI' : 'FAIR BOARD'}</strong>
          {PARK_GAMES.map((game) => (
            <div key={game.id} className="park-board-row">
              <em>{game.title[lang]}</em>
              <span>{(scores[game.id]?.[0]?.score ?? 0).toString().padStart(4, '0')}</span>
            </div>
          ))}
          <small>{lang === 'cs' ? 'top 10 v panelu' : 'top 10 in the panel'}</small>
        </div>
      </Html>
    </group>
  );
}

export function ParkScene({
  lang,
  activeGame,
  screenTexture,
  scores,
  riding,
  onSelectGame,
  onRide,
}: {
  lang: 'cs' | 'en';
  activeGame: ParkGameId | null;
  screenTexture: THREE.CanvasTexture | null;
  scores: ParkScores;
  riding: boolean;
  onSelectGame: (id: ParkGameId) => void;
  onRide: () => void;
}) {
  const jupiter = useJupiterTexture();
  const planet = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (planet.current) planet.current.rotation.y += delta * 0.01;
  });

  return (
    <>
      <color attach="background" args={['#060411']} />
      <ambientLight intensity={0.7} />
      <hemisphereLight args={['#8a7dff', '#151019', 0.5]} />
      <directionalLight position={[14, 20, 18]} intensity={2.3} color="#ffd6ab" />
      <pointLight position={[0, 6.5, -2]} intensity={34} color="#ffd166" distance={30} decay={2} />
      <pointLight position={[0, 3.2, 4]} intensity={12} color="#ffb46a" distance={20} decay={2} />
      <pointLight position={[0, 12, -13]} intensity={22} color="#7fe3d4" distance={32} decay={2} />

      <Stars />

      {/* Jupiter — obloha, ne dekorace */}
      <mesh ref={planet} position={[-58, 34, -210]}>
        <sphereGeometry args={[62, 48, 48]} />
        <meshBasicMaterial key={jupiter ? 'tex' : 'flat'} map={jupiter ?? undefined} color={jupiter ? '#8d7a68' : '#6d5644'} />
      </mesh>

      <Deck />
      <Html position={[0, 12.5, -9]} center distanceFactor={26} style={{ pointerEvents: 'none' }}>
        <span className="park-sign">
          JUPITER STATION
          <em>{lang === 'cs' ? 'pouť · hraj o žetony' : 'fair · play for tokens'}</em>
        </span>
      </Html>
      <ScoreBoard scores={scores} lang={lang} />

      {CABINETS.map((cabinet) => (
        <Cabinet
          key={cabinet.id}
          id={cabinet.id}
          angle={cabinet.angle}
          lang={lang}
          active={activeGame === cabinet.id}
          texture={screenTexture}
          onSelect={onSelectGame}
        />
      ))}

      <FerrisWheel riding={riding} onRide={onRide} />
      <RideCamera active={riding} />
    </>
  );
}

export const PARK_CAMERA = { position: [0, 6.6, 15.5] as [number, number, number], fov: 58, far: 2000 };
