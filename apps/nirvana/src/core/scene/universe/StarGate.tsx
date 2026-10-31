'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GATE_POS } from './positions';
import type { Portal } from '@/core/portals/manifest';

/**
 * Brána — stejný obraz jako StarGate na IntroPage.
 *
 * IntroPage skládá bránu z 22 rotujících kopií `stargate/2.png` a 6 kopií `1.png`
 * (Šrí jantra), každou s jinou šířkou, směrem a periodou. Tahle scéna dělá totéž ve 3D:
 * stejné textury, stejné vrstvy, stejné poměry. Skupina se natáčí ke kameře, takže brána
 * zůstává kruhem z každého úhlu; vstup do ní vede do OASIS.
 */

const OASIS_URL = 'https://oasis.zionterranova.com';
const RADIUS = 3;

/** Šířky, periody (s) a směr rotace vrstev — opsané z IntroPage CSS. */
const RING_LAYERS: { src: 1 | 2; width: number; period: number; opacity: number }[] = [
  { src: 2, width: 0.94, period: 48, opacity: 0.55 },
  { src: 2, width: 0.72, period: -96, opacity: 0.5 },
  { src: 2, width: 0.58, period: 192, opacity: 0.45 },
  { src: 2, width: 0.44, period: -384, opacity: 0.4 },
  // Šrí jantra: pomalejší, v protisměru, drží střed.
  { src: 1, width: 0.8, period: 900, opacity: 0.5 },
  { src: 1, width: 0.62, period: -1400, opacity: 0.42 },
  { src: 1, width: 0.44, period: 2000, opacity: 0.36 },
];

function useGateTexture(url: string): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let live = true;
    const loader = new THREE.TextureLoader();
    loader.load(url, (loaded) => {
      if (!live) {
        loaded.dispose();
        return;
      }
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.anisotropy = 4;
      setTexture(loaded);
    });
    return () => {
      live = false;
    };
  }, [url]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

/** Jemná záře ve středu — drží pohled v ohnisku brány. */
function useGlowTexture(): THREE.Texture {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,246,214,0.95)');
    gradient.addColorStop(0.35, 'rgba(232,197,106,0.35)');
    gradient.addColorStop(1, 'rgba(232,197,106,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

/** Rytina po obvodu brány — 48 krátkých značek, jako glyfy na IntroPage. */
function GlyphRing() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.BoxGeometry(0.02, 0.11, 0.02), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#e8dcbe', transparent: true, opacity: 0.5, toneMapped: false }),
    [],
  );
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);
  useLayoutEffect(() => {
    const node = mesh.current;
    if (!node) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 48; i++) {
      const angle = (i / 48) * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * RADIUS * 0.93, Math.sin(angle) * RADIUS * 0.93, 0.06);
      dummy.rotation.set(0, 0, angle);
      dummy.updateMatrix();
      node.setMatrixAt(i, dummy.matrix);
    }
    node.instanceMatrix.needsUpdate = true;
  }, []);
  return <instancedMesh ref={mesh} args={[geometry, material, 48]} frustumCulled={false} />;
}

export function StarGate({ portal, onOpen }: { portal: Portal; onOpen: (id: string) => void }) {
  void portal;
  const group = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const camera = useThree((state) => state.camera);
  const [hover, setHover] = useState(false);
  const [still, setStill] = useState(false);

  const rings = useGateTexture('/stargate/2.png');
  const yantra = useGateTexture('/stargate/1.png');
  const glow = useGlowTexture();

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setStill(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => () => glow.dispose(), [glow]);

  // Brána je vždy čelem ke kameře — kruh zůstane kruhem.
  useFrame(({ clock }) => {
    if (group.current) {
      group.current.quaternion.copy(camera.quaternion);
      group.current.position.y = GATE_POS[1] + Math.sin(clock.elapsedTime * 0.5) * 0.08;
    }
    if (spin.current && !still) {
      const t = clock.elapsedTime;
      spin.current.children.forEach((child, index) => {
        const layer = RING_LAYERS[index];
        if (!layer?.period) return;
        child.rotation.z = (t / layer.period) * Math.PI * 2;
      });
    }
  });

  const enterOasis = (event?: { stopPropagation: () => void }) => {
    event?.stopPropagation();
    // Vstup do brány = vstup do OASIS. Panel v liště vede na totéž místo.
    window.open(OASIS_URL, '_blank', 'noopener,noreferrer');
    onOpen(portal.id);
    void portal;
  };

  const hit = {
    onClick: enterOasis,
    onPointerOver: (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      setHover(true);
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      setHover(false);
      document.body.style.cursor = 'auto';
    },
  };

  const scale = hover ? 1.04 : 1;

  return (
    <group ref={group} position={GATE_POS} scale={scale}>
      {/* tmavé pozadí brány + kovový prstenec, stejné jako rádiusový gradient v CSS */}
      <mesh position={[0, 0, -0.06]} {...hit}>
        <circleGeometry args={[RADIUS, 72]} />
        <meshBasicMaterial color="#05070c" transparent opacity={0.88} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, -0.04]} {...hit}>
        <torusGeometry args={[RADIUS * 0.995, 0.028, 10, 96]} />
        <meshStandardMaterial color="#7e7f81" metalness={0.85} roughness={0.35} emissive="#e8c56a" emissiveIntensity={hover ? 0.35 : 0.1} />
      </mesh>

      {/* kaleidoskopické vrstvy — stejné textury a poměry jako IntroPage */}
      <group ref={spin}>
        {RING_LAYERS.map((layer, index) => {
          const texture = layer.src === 2 ? rings : yantra;
          if (!texture) return null;
          const size = RADIUS * 2 * layer.width;
          return (
            <mesh key={index} position={[0, 0, 0.02 + index * 0.004]}>
              <planeGeometry args={[size, size]} />
              <meshBasicMaterial
                map={texture}
                transparent
                alphaTest={0.02}
                opacity={Math.min(0.9, layer.opacity * (layer.src === 2 ? 0.6 : 0.5) * (hover ? 1.25 : 1))}
                depthWrite={false}
                toneMapped={false}
                color="#f4ecd6"
              />
            </mesh>
          );
        })}
      </group>

      {/* rytina kolem dokola — stejný motiv jako glyfový prstenec na IntroPage */}
      <GlyphRing />

      {/* záře ve středu */}
      <sprite position={[0, 0, 0.12]} scale={[RADIUS * 1.1, RADIUS * 1.1, 1]}>
        <spriteMaterial map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={hover ? 0.6 : 0.34} />
      </sprite>

      {/* neviditelný terč pro pohodlný klik */}
      <mesh position={[0, 0, 0.16]} {...hit}>
        <circleGeometry args={[RADIUS * 0.92, 32]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* jemný vnější prstenec — brána se z dálky čte jako portál, ne jako placka */}
      <mesh position={[0, 0, -0.02]} rotation={[0, 0, 0]}>
        <torusGeometry args={[RADIUS * 1.12, 0.012, 8, 96]} />
        <meshBasicMaterial color="#e8c56a" transparent opacity={0.32} toneMapped={false} />
      </mesh>
    </group>
  );
}
