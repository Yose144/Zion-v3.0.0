/** @jsxRuntime classic */
'use client';

import { React, useEffect, useMemo, useRef, useFrame, THREE } from '@genesis/runtime';

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

export function AtlanticOcean({ level = -1.8, coastal = true, lagoon = false, shorelineZ }: { level?: number; coastal?: boolean; lagoon?: boolean; shorelineZ?: number }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, coastal: { value: coastal ? 1 : 0 }, lagoon: { value: lagoon ? 1 : 0 }, shoreline: { value: new THREE.Vector2(shorelineZ === undefined ? 0 : 1, shorelineZ ?? 0) }, sun: { value: new THREE.Vector3(-0.75, 0.08, -0.66).normalize() } },
    vertexShader: `
      uniform float time;
      varying vec3 world;
      void main() {
        vec3 p = position;
        p.z += sin(p.x * .17 + time * .55) * .035 + sin(p.y * .23 - time * .42) * .025;
        world = (modelMatrix * vec4(p, 1.)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 sun;
      uniform float coastal;
      uniform float lagoon;
      uniform vec2 shoreline;
      varying vec3 world;
      void main() {
        vec2 p = world.xz;
        float a = p.x * .23 + p.y * .39 + sin(p.x * .11 - p.y * .13) * 1.5 + time * .6;
        float b = p.x * -.37 + p.y * .17 + sin(p.y * .19) * .9 - time * .42;
        float attenuation = 1. / (1. + length(fwidth(p)) * .8);
        vec3 n = normalize(vec3((cos(a) * .022 - cos(b) * .016) * attenuation, 1., (cos(a) * .018 + cos(b) * .027) * attenuation));
        vec3 viewDir = normalize(cameraPosition - world);
        float fresnel = pow(1. - max(dot(n, viewDir), 0.), 3.);
        float distanceFade = smoothstep(90., 650., length(cameraPosition.xz - p));
        float shore = -23. - max(p.x - 8., 0.) * .65 + sin(p.x * .12) * 2.5;
        shore = mix(shore, shoreline.y - sin(p.x * .12) * 1.5, shoreline.x);
        float nearShore = exp(-abs(p.y - shore + 2.4) * .38) * coastal;
        vec3 water = mix(vec3(.025,.14,.23), vec3(.06,.33,.36), nearShore * .75);
        vec3 tropical = mix(vec3(.015,.16,.25), vec3(.07,.54,.45), exp(-max(shore - p.y, 0.) * .045));
        water = mix(water, tropical, lagoon);
        water = mix(water, vec3(.31,.40,.48), fresnel * .65);
        float reflection = pow(max(dot(reflect(-sun, n), viewDir), 0.), 45.);
        water += vec3(1.,.69,.38) * reflection * .32;
        float foam = nearShore * smoothstep(.65, .95, sin(p.y * 3. + sin(p.x * .6) - time * .65)) * .13;
        water += vec3(.65,.78,.76) * foam;
        water = mix(water, vec3(.52,.56,.61), distanceFade * .8);
        gl_FragColor = vec4(water, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }), [coastal, lagoon, shorelineZ]);
  const reducedMotion = useRef(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reducedMotion.current = query.matches; };
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, delta) => { if (!reducedMotion.current) material.uniforms.time.value += Math.min(delta, .05); });
  return <mesh position={[0, level, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
    <planeGeometry args={[2800, 2800, 100, 100]} />
  </mesh>;
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
