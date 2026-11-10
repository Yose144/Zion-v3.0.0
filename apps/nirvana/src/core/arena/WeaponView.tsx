'use client';

/**
 * ZBRAŇ V RUCE (2026-11-10) — první pořádný „pro" model v aréně.
 *
 * Do té doby byla aréna jen kamera a krabice; hráč neměl v ruce nic. Q3
 * i každá moderní střílečka stojí na tom, že **vidíš, čím střílíš**.
 * Model je záměrně z primitiv (v repu nejsou herní modely a kvůli sedmi
 * zbraním se nevyplatí tahat GLB): z dálky i zblízka se čte silueta,
 * barva a záblesk, což je přesně to, co hráč potřebuje.
 *
 * Tři pravidla:
 *  1. **Nikdy nereaguje na React state.** Zbraň se čte z refu 60×/s, takže
 *     přepnutí zbraně neznamená re-render 3D stromu.
 *  2. **Pozice jde z hráče a pohledu, ne z kamery.** `useFrame` pořadí mezi
 *     komponentami není zaručené; kdyby model četl kameru, mohl by být
 *     o jeden snímek pozadu (a v XR by se kýval s hlavou).
 *  3. **Ve VR se model schová.** Headset má vlastní ruce; cizí zbraň
 *     v obličeji je nejhorší možný zážitek.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLAYER, type Body } from './physics';
import type { WeaponId } from './weapons';

interface WeaponViewProps {
  weapon: React.MutableRefObject<WeaponId>;
  player: React.MutableRefObject<Body>;
  view: React.MutableRefObject<{ yaw: number; pitch: number }>;
  /** Kdy naposledy hráč vystřelil (ms) — od toho se počítá zpětný ráz. */
  kick: React.MutableRefObject<number>;
  /** Do kdy je vidět záblesk (ms). */
  muzzleUntil: React.MutableRefObject<number>;
  deadUntil: React.MutableRefObject<number>;
  xr?: boolean;
}

/** Kovová zbraň — jedna odpověď na to, jak vypadá materiál. */
function GunMetal({ color = '#3a4652' }: { color?: string }) {
  // Bez env mapy je kov černý — emissive + nižší metalness drží zbraň
  // čitelnou i proti tmavé podlaze (naměřeno na screenshotu).
  return (
    <meshStandardMaterial
      color={color}
      metalness={0.25}
      roughness={0.55}
      emissive={color}
      emissiveIntensity={0.4}
    />
  );
}

export function WeaponView({
  weapon,
  player,
  view,
  kick,
  muzzleUntil,
  deadUntil,
  xr = false,
}: WeaponViewProps) {
  const root = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Group>(null);
  const flashLight = useRef<THREE.PointLight>(null);
  const models = useRef<Partial<Record<WeaponId, THREE.Group | null>>>({});
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);

  useFrame(({ clock }) => {
    const node = root.current;
    if (!node) return;
    const now = performance.now();
    const visible = !xr && now >= deadUntil.current;
    node.visible = visible;
    if (!visible) return;

    euler.set(view.current.pitch, view.current.yaw, 0);
    quat.setFromEuler(euler);
    node.quaternion.copy(quat);
    node.position.set(player.current.x, player.current.y + PLAYER.eye, player.current.z);

    // Chůze houpá zbraní; běh víc. Stání drží klid.
    const speed = Math.hypot(player.current.vx, player.current.vz);
    const bob = Math.min(1, speed / 10);
    const t = clock.elapsedTime;
    const kickAmt = Math.max(0, 1 - (now - kick.current) / 140);

    node.translateX(0.34 + Math.sin(t * 9) * 0.012 * bob);
    node.translateY(-0.26 + Math.abs(Math.cos(t * 9)) * 0.009 * bob - kickAmt * 0.012);
    node.translateZ(-0.7 + kickAmt * 0.08);
    node.rotateX(kickAmt * 0.16);

    for (const [id, group] of Object.entries(models.current)) {
      if (group) group.visible = id === weapon.current;
    }

    const flashing = now < muzzleUntil.current;
    if (flash.current) flash.current.visible = flashing;
    if (flashLight.current) flashLight.current.intensity = flashing ? 3.4 : 0;
  });

  return (
    <group ref={root} scale={0.62}>
      {/* Vlastní světlo: bez něj je zbraň proti tmavé scéně černá. */}
      <pointLight position={[0.18, 0.22, 0.05]} intensity={1.5} distance={1.6} color="#ffe0c0" />
      {/* RAIL — dlouhá tenká hlaveň se zaměřovačem. */}
      <group ref={(node) => {
          models.current.rail = node;
        }}>
        <mesh position={[0, 0, -0.18]}>
          <boxGeometry args={[0.07, 0.08, 0.62]} />
          <GunMetal color="#3f4a57" />
        </mesh>
        <mesh position={[0, 0.07, -0.28]}>
          <boxGeometry args={[0.045, 0.045, 0.2]} />
          <GunMetal color="#2a3542" />
        </mesh>
        <mesh position={[0, 0.07, -0.39]}>
          <boxGeometry args={[0.05, 0.05, 0.02]} />
          <meshBasicMaterial color="#9fe4ea" toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.02, -0.5]}>
          <boxGeometry args={[0.025, 0.025, 0.18]} />
          <meshBasicMaterial color="#e8f7ff" toneMapped={false} />
        </mesh>
      </group>

      {/* RAKETA — tlustá trubka se zeleným hrotem. */}
      <group ref={(node) => {
          models.current.rocket = node;
        }}>
        <mesh position={[0, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.07, 0.55, 12]} />
          <GunMetal color="#6a4a33" />
        </mesh>
        <mesh position={[0, 0, -0.5]}>
          <boxGeometry args={[0.09, 0.09, 0.1]} />
          <meshStandardMaterial color="#ffb46a" emissive="#ff7a2a" emissiveIntensity={0.7} metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0.05, -0.06, -0.12]}>
          <boxGeometry args={[0.05, 0.09, 0.14]} />
          <GunMetal color="#3a2a1f" />
        </mesh>
      </group>

      {/* MG — kompaktní tělo, hlaveň a zásobník. */}
      <group ref={(node) => {
          models.current.mg = node;
        }}>
        <mesh position={[0, 0, -0.12]}>
          <boxGeometry args={[0.09, 0.11, 0.4]} />
          <GunMetal color="#4a4f57" />
        </mesh>
        <mesh position={[0, 0.005, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.28, 10]} />
          <GunMetal color="#8a8f98" />
        </mesh>
        <mesh position={[0, -0.08, -0.16]}>
          <boxGeometry args={[0.06, 0.12, 0.12]} />
          <meshStandardMaterial color="#ffe9a8" metalness={0.2} roughness={0.7} />
        </mesh>
      </group>

      {/* BROKOVNICE — dvě hlavně vedle sebe. */}
      <group ref={(node) => {
          models.current.shotgun = node;
        }}>
        <mesh position={[-0.035, 0, -0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.026, 0.026, 0.5, 10]} />
          <GunMetal color="#8a8f98" />
        </mesh>
        <mesh position={[0.035, 0, -0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.026, 0.026, 0.5, 10]} />
          <GunMetal color="#8a8f98" />
        </mesh>
        <mesh position={[0, -0.03, 0.06]}>
          <boxGeometry args={[0.1, 0.12, 0.24]} />
          <GunMetal color="#6a4633" />
        </mesh>
      </group>

      {/* BLESK — cívka s dvěma hroty, svítí. */}
      <group ref={(node) => {
          models.current.lightning = node;
        }}>
        <mesh position={[0, 0, -0.12]}>
          <boxGeometry args={[0.08, 0.1, 0.34]} />
          <GunMetal color="#2f4750" />
        </mesh>
        <mesh position={[0, 0.02, -0.42]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.26, 10]} />
          <meshStandardMaterial color="#7fe3ff" emissive="#3fd6ff" emissiveIntensity={1.1} metalness={0.4} roughness={0.3} />
        </mesh>
        <mesh position={[-0.05, 0.02, -0.56]}>
          <boxGeometry args={[0.015, 0.06, 0.1]} />
          <meshBasicMaterial color="#d8fbff" toneMapped={false} />
        </mesh>
        <mesh position={[0.05, 0.02, -0.56]}>
          <boxGeometry args={[0.015, 0.06, 0.1]} />
          <meshBasicMaterial color="#d8fbff" toneMapped={false} />
        </mesh>
      </group>

      {/* PLAZMA — krátká hlaveň a svítící jádro. */}
      <group ref={(node) => {
          models.current.plasma = node;
        }}>
        <mesh position={[0, 0, -0.14]}>
          <boxGeometry args={[0.11, 0.12, 0.36]} />
          <GunMetal color="#3a4150" />
        </mesh>
        <mesh position={[0, 0.01, -0.38]}>
          <sphereGeometry args={[0.05, 12, 10]} />
          <meshStandardMaterial color="#7fe3ff" emissive="#3fd6ff" emissiveIntensity={1.4} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.06, -0.2]}>
          <boxGeometry args={[0.07, 0.08, 0.1]} />
          <GunMetal color="#2a2d35" />
        </mesh>
      </group>

      {/* PĚST — rukavice, žádná hlaveň. */}
      <group ref={(node) => {
          models.current.gauntlet = node;
        }}>
        <mesh position={[0, -0.02, -0.24]} rotation={[0.2, 0, 0]}>
          <sphereGeometry args={[0.075, 12, 10]} />
          <meshStandardMaterial
            color="#c9a55c"
            metalness={0.4}
            roughness={0.45}
            emissive="#c9a55c"
            emissiveIntensity={0.16}
          />
        </mesh>
        <mesh position={[0, -0.07, -0.08]}>
          <cylinderGeometry args={[0.05, 0.06, 0.16, 10]} />
          <meshStandardMaterial
            color="#5a4034"
            metalness={0.2}
            roughness={0.8}
            emissive="#2a1d18"
            emissiveIntensity={0.4}
          />
        </mesh>
        <mesh position={[0, 0.04, -0.31]}>
          <boxGeometry args={[0.11, 0.045, 0.05]} />
          <meshStandardMaterial
            color="#e8dcc4"
            metalness={0.3}
            roughness={0.6}
            emissive="#e8dcc4"
            emissiveIntensity={0.2}
          />
        </mesh>
      </group>

      {/* Záblesk — krátký, ať je vidět výstřel, ne celá obloha. */}
      <group ref={flash} position={[0, 0.02, -0.58]} visible={false}>
        <mesh>
          <sphereGeometry args={[0.055, 8, 6]} />
          <meshBasicMaterial color="#fff6d8" toneMapped={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.13, 8, 6]} />
          <meshBasicMaterial color="#ffb46a" transparent opacity={0.45} toneMapped={false} />
        </mesh>
        <pointLight ref={flashLight} intensity={0} distance={7} color="#ffd9a0" />
      </group>
    </group>
  );
}
