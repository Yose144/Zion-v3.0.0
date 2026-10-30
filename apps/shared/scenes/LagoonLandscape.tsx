/** @jsxRuntime classic */
'use client';

import { React, useEffect, THREE } from '@genesis/runtime';
import { AtlanticOcean } from './CoastalLandscape';

/** Illustrative Raiatea coastline: a sloping beach, protected lagoon and distant ridge. */
export function LagoonLandscape() {
  const { beach, mountains } = React.useMemo(() => {
    const beach = new THREE.PlaneGeometry(220, 220, 110, 110);
    beach.rotateX(-Math.PI / 2);
    const p = beach.getAttribute('position'), colors: number[] = [];
    const color = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), shore = -10.5 - Math.sin(x * .12) * 1.5;
      p.setY(i, Math.max(-3, Math.min(0, (z - shore) * .35)));
      const sand = Math.max(1 - THREE.MathUtils.smoothstep(Math.hypot(x, z), 9, 13), 1 - THREE.MathUtils.smoothstep(z - shore, 3, 7));
      color.set('#42653b').lerp(new THREE.Color('#cfba92'), sand);
      color.multiplyScalar(.95 + .05 * Math.sin(x * 2.2 + z * .8));
      colors.push(color.r, color.g, color.b);
    }
    beach.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); beach.computeVertexNormals();
    const mountains = new THREE.PlaneGeometry(180, 90, 100, 60); mountains.rotateX(-Math.PI / 2); mountains.translate(0, 0, -112);
    const m = mountains.getAttribute('position');
    for (let i = 0; i < m.count; i++) {
      const x = m.getX(i), z = m.getZ(i);
      const peak = 16 * Math.exp(-(((x - 38) / 18) ** 2 + ((z + 104) / 18) ** 2))
        + 9 * Math.exp(-(((x - 15) / 15) ** 2 + ((z + 116) / 19) ** 2))
        + 8 * Math.exp(-(((x - 65) / 17) ** 2 + ((z + 117) / 20) ** 2));
      const spine = 1 + .13 * Math.sin(x * .6) * Math.cos(z * .4);
      m.setY(i, peak * spine - 3);
    }
    mountains.computeVertexNormals();
    return { beach, mountains };
  }, []);
  useEffect(() => () => { beach.dispose(); mountains.dispose(); }, [beach, mountains]);
  return <>
    <AtlanticOcean level={-.28} lagoon shorelineZ={-10.5} />
    <mesh geometry={beach} receiveShadow><meshStandardMaterial vertexColors roughness={1} /></mesh>
    <mesh geometry={mountains}><meshStandardMaterial color="#527067" roughness={1} /></mesh>
  </>;
}
