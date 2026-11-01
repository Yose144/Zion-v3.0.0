'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { fleetPosition, fleetHeading } from './positions';
import { TextLabel } from './Label';

/**
 * Nebeská flotila — pohyblivý uzel L6 (kniha Nabukano).
 *
 * Mateřská loď Nabukano nese dokovací rám, ke kterému jsou připojené tři
 * nebeské Marie: Santa María la Mayor (červená), Nossa Senhora de Fátima
 * (bílá) a María de las Nieves (zlatá — horizont, proto nejmenší).
 *
 * Flotila není pin na povrchu: obíhá Novou Zemi mezi planetou a prstencem
 * Issobelly. Klik otevře okno flotily; scéna sama nikam nenaviguje.
 * Pozice i natočení jdou z `fleetPosition()`/`fleetHeading()` — stejný vzorec
 * používá fokus kamery, takže se nemůže rozejít.
 */

const HULL = '#22384f';
const HULL_LIGHT = '#3d5570';
const DECK = '#e6dcc6';
const GOLD = '#d8b46a';
const SAIL = '#f4ecd8';

/** Tři trupy: barva navigačního světla odpovídá rouchu jejich mořské sestry. */
const SISTERS = [
  { key: 'santa', color: '#e0403d', angle: Math.PI / 2, sail: true },
  { key: 'fatima', color: '#f2efe4', angle: (Math.PI * 7) / 6, sail: true },
  { key: 'nieves', color: '#e8bf6a', angle: (Math.PI * 11) / 6, sail: false },
] as const;

/** Malá nebeská María — trup, stěžeň, plachta ze světla a navigační světlo. */
function SkyMaria({ color, sail }: { color: string; sail: boolean }) {
  return (
    <group>
      {/* trup */}
      <mesh castShadow>
        <boxGeometry args={[0.3, 0.05, 0.09]} />
        <meshStandardMaterial color={HULL} roughness={0.45} metalness={0.35} />
      </mesh>
      {/* příď */}
      <mesh position={[0.19, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.029, 0.09, 8]} />
        <meshStandardMaterial color={HULL_LIGHT} roughness={0.45} metalness={0.4} />
      </mesh>
      {/* palubní nástavba */}
      <mesh position={[-0.03, 0.035, 0]}>
        <boxGeometry args={[0.13, 0.028, 0.055]} />
        <meshStandardMaterial color={DECK} roughness={0.7} />
      </mesh>
      {/* teplá okna — loď je z orbity vidět jako živá */}
      <mesh position={[-0.03, 0.02, 0.028]}>
        <boxGeometry args={[0.1, 0.01, 0.004]} />
        <meshStandardMaterial color="#ffd39a" emissive="#ff9f43" emissiveIntensity={2} />
      </mesh>
      {sail && (
        <>
          <mesh position={[0.01, 0.09, 0]}>
            <cylinderGeometry args={[0.004, 0.005, 0.14, 5]} />
            <meshStandardMaterial color="#8d6a42" roughness={0.6} />
          </mesh>
          {/* sluneční plachta: tlak světla, ne vítr */}
          <mesh position={[-0.03, 0.1, 0]}>
            <planeGeometry args={[0.085, 0.11]} />
            <meshStandardMaterial color={SAIL} emissive="#5a6a7a" emissiveIntensity={0.25} side={THREE.DoubleSide} roughness={0.85} />
          </mesh>
        </>
      )}
      {/* navigační světlo trupu */}
      <mesh position={[0.14, 0.035, 0]}>
        <sphereGeometry args={[0.015, 8, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function SkyFleet({ onOpen, reducedMotion = false }: { onOpen: () => void; reducedMotion?: boolean }) {
  const carrier = useRef<THREE.Group>(null);
  const frame = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = reducedMotion ? 0 : clock.elapsedTime;
    const [x, y, z] = fleetPosition(t);
    if (carrier.current) {
      carrier.current.position.set(x, y, z);
      carrier.current.rotation.y = fleetHeading(t);
    }
    if (frame.current) frame.current.rotation.x = t * 0.12;
  });

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <group ref={carrier} scale={1.3}>
      {/* hit area — flotila je z dálky malá, klikat se musí dát vždy */}
      <mesh
        visible={false}
        onClick={(e) => {
          stop(e);
          onOpen();
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}
      >
        <sphereGeometry args={[0.95, 10, 8]} />
      </mesh>

      {/* Nabukano — mateřská loď s dokovacím rámem */}
      <group
        onClick={(e) => {
          stop(e);
          onOpen();
        }}
      >
        {/* hřbet trupu */}
        <mesh castShadow>
          <boxGeometry args={[0.68, 0.12, 0.22]} />
          <meshStandardMaterial color={HULL} roughness={0.4} metalness={0.4} />
        </mesh>
        {/* příď */}
        <mesh position={[0.42, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.085, 0.24, 10]} />
          <meshStandardMaterial color={HULL_LIGHT} roughness={0.38} metalness={0.45} />
        </mesh>
        {/* záď */}
        <mesh position={[-0.42, 0, 0]}>
          <boxGeometry args={[0.18, 0.1, 0.19]} />
          <meshStandardMaterial color={HULL_LIGHT} roughness={0.5} metalness={0.4} />
        </mesh>
        {/* světelný pás oken na obou bocích */}
        {[1, -1].map((s) => (
          <mesh key={s} position={[0, 0.02, s * 0.112]}>
            <boxGeometry args={[0.5, 0.014, 0.004]} />
            <meshStandardMaterial color="#ffd39a" emissive="#ff9f43" emissiveIntensity={2.2} />
          </mesh>
        ))}

        {/* dokovací rám — ke všem třem trupům vede rameno */}
        <group ref={frame} rotation={[0, 0, 0]}>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.62, 0.013, 6, 40]} />
            <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.35} emissive="#6a5320" emissiveIntensity={0.35} />
          </mesh>
          {SISTERS.map((s) => (
            <group key={s.key} rotation={[s.angle, 0, 0]}>
              <mesh position={[0.1, 0.31, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.011, 0.011, 0.34, 6]} />
                <meshStandardMaterial color="#9aa3b2" metalness={0.75} roughness={0.4} />
              </mesh>
            </group>
          ))}
        </group>

        {/* tři nebeské Marie připojené k rámu */}
        {SISTERS.map((s) => {
          const y = Math.cos(s.angle) * 0.62;
          const z = Math.sin(s.angle) * 0.62;
          return (
            <group key={s.key} position={[0.06, y, z]}>
              <SkyMaria color={s.color} sail={s.sail} />
            </group>
          );
        })}

        {/* lucerna na přídi — světlo pro ty, kdo přicházejí zdola */}
        <mesh position={[0.52, 0.05, 0]}>
          <sphereGeometry args={[0.038, 10, 8]} />
          <meshStandardMaterial color="#ffe6b0" emissive="#ffcf8a" emissiveIntensity={3} toneMapped={false} />
        </mesh>
        <mesh position={[0.52, 0.05, 0]} scale={[0.12, 0.12, 0.12]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshBasicMaterial color="#ffcf8a" transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>

      <TextLabel text="Nabukano · Nebeská flotila" position={[0, 0.95, 0]} color="#9fe4ff" height={0.22} onClick={onOpen} />
    </group>
  );
}
