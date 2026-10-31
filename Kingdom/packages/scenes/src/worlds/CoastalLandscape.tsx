/** @jsxRuntime classic */
'use client';

import { React, useEffect, useMemo, useRef, useFrame, THREE } from '../runtime';
import { OceanSurface } from './kit/ocean';

// An illustrative La Palma landscape, rather than a surveyed site model.
function coast(x: number) {
  return -23 - Math.max(x - 8, 0) * 0.65 + Math.sin(x * 0.12) * 2.5;
}

function elevation(x: number, z: number) {
  const shore = Math.max(-6, Math.min(0, (z - coast(x)) * 0.7));
  const ridge = 15 * Math.exp(-(((x - 32) / 19) ** 2 + ((z + 72) / 28) ** 2))
    + 7 * Math.exp(-(((x - 26) / 17) ** 2 + ((z + 38) / 29) ** 2)) - 5;
  const crater = 3.8 * Math.exp(-(((x - 32) / 3.1) ** 2 + ((z + 72) / 3.7) ** 2));
  const erosion = Math.sin(x * 0.7 + z * 0.45) * Math.cos(z * 0.55) * Math.max(0, ridge) * 0.035;
  return Math.max(shore, ridge - crater + erosion);
}

function VolcanicCoast() {
  const geometry = React.useMemo(() => {
    const g = new THREE.PlaneGeometry(210, 210, 150, 150);
    g.rotateX(-Math.PI / 2);
    const p = g.getAttribute('position');
    const colors: number[] = [];
    const color = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const h = elevation(x, z);
      p.setY(i, h);
      color.set(h < -0.3 ? '#494c49' : h > 10 ? '#65574f' : '#476044');
      color.multiplyScalar(0.9 + 0.1 * Math.sin(x * 1.8 + z * 0.6));
      colors.push(color.r, color.g, color.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} receiveShadow>
    <meshStandardMaterial vertexColors roughness={0.98} />
  </mesh>;
}

export function AtlanticOcean({ level = -1.8, coastal = true, lagoon = false, shorelineZ, roughSea = false, sky = '#9fb6cc', deep = '#04141c', shallow = '#0a3b45' }: { level?: number; coastal?: boolean; lagoon?: boolean; shorelineZ?: number; roughSea?: boolean; sky?: string; deep?: string; shallow?: string }) {
  // One ocean implementation for every sea scene; see kit/ocean.tsx.
  return (
    <OceanSurface
      level={level}
      foam={coastal || lagoon}
      lagoon={lagoon}
      roughness={roughSea ? 2.2 : 1}
      shoreBase={shorelineZ ?? -23}
      shoreSlope={shorelineZ === undefined ? 0.65 : 0}
      sky={sky}
      deep={deep}
      shallow={shallow}
      sun={[-0.75, 0.08, -0.66]}
    />
  );
}

function DistantSailboat() {
  const sail = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(0, 4.6); shape.quadraticCurveTo(1.5, 2.1, 2.2, .15); shape.closePath();
    return shape;
  }, []);
  return <group position={[-22, -1.75, -43]} rotation={[0, -0.45, 0]} scale={0.78}>
    <mesh position={[0, .3, 0]} scale={[2.9, .46, .65]}>
      <sphereGeometry args={[1, 16, 8]} /><meshStandardMaterial color="#5c3928" roughness={.6} />
    </mesh>
    <mesh position={[0, 2.6, 0]}>
      <cylinderGeometry args={[.045, .065, 5.1, 6]} /><meshStandardMaterial color="#72533a" />
    </mesh>
    <mesh position={[.08, .75, 0]}>
      <shapeGeometry args={[sail]} /><meshStandardMaterial color="#f3e4c4" roughness={.9} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[-.08, .8, 0]} rotation={[0, Math.PI, 0]} scale={[.7, .8, 1]}>
      <shapeGeometry args={[sail]} /><meshStandardMaterial color="#e5d8ba" roughness={.9} side={THREE.DoubleSide} />
    </mesh>
  </group>;
}

export function CoastalLandscape() {
  return <><AtlanticOcean /><VolcanicCoast /><DistantSailboat /></>;
}
