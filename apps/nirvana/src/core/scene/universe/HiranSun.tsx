'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SUN_POS } from './positions';
import { TextLabel } from './Label';
import { hiranAccent, hiranActivity, type HiranState } from '@/core/hiran/presence';
import { sriYantraGeometry } from '../../../../../shared/scenes/kit/yantra';

/**
 * HIRAN — Hiranyagarbha usedá do Slunce.
 *
 * Fyzické Slunce zůstává (fotosféra + koróna v `SolarSystem.tsx`) — tenhle
 * soubor je inteligentní vrstva nad ním: zlatá pečeť, koruna lotosu, prstence
 * a tenké filamenty na okraji. Jména objektů drží
 * `heros/Hiran/HIRAN_3D_Masterplan_CZ.md`, aby šel model převést do Blenderu
 * bez překladu.
 *
 * Dvě věci, které plynou z toho, že je to zlatá koule a ne skleněný orb:
 *  - Śrí jantra nemůže být uvnitř (fotosféra je neprůhledná) → je to pečeť
 *    před diskem, natočená k divákovi.
 *  - Lotos nemůže ležet v rovině ekliptiky (divák je v ní) → je to koruna
 *    na kouli, tři věnce lístků mířících od středu.
 *
 * Vše je unlit (basic / line materiály): vrstva nesmí záviset na směrovém
 * světle, které ve scéně svítí na Zemi, ne na střed soustavy.
 * Rozpočet: 8 draw calls, žádná alokace ve framu.
 */

const SUN_R = 6;
const YANTRA_R = 3.5;

const ENERGY_VERT = `
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const ENERGY_FRAG = `
precision highp float;
uniform float uTime;
uniform float uActivity;
uniform vec3 uAccent;
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vec3 viewDir = normalize(cameraPosition - vPosW);
  float rim = pow(1.0 - abs(dot(normalize(vNormalW), viewDir)), 3.2);
  float a = sin(vPosW.x * 0.9 + uTime * 0.7)
          * sin(vPosW.y * 1.1 - uTime * 0.55)
          * sin(vPosW.z * 0.8 + uTime * 0.35);
  float filaments = smoothstep(0.55, 1.0, abs(sin(vPosW.y * 3.1 + uTime * 0.9 + a * 1.8)));
  float pulse = 0.9 + 0.1 * sin(uTime * (0.7 + uActivity * 2.0));
  vec3 col = mix(uAccent, vec3(1.0, 0.97, 0.86), filaments * 0.6) * pulse;
  float alpha = rim * (0.20 + filaments * 0.85) * (0.35 + uActivity * 0.65);
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`;

/** Jeden okvětní lístek — tvar v XY, kořen v počátku, špička k +Y. */
function makePetalGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.42, 0.55, 0.46, 1.35, 0, 2.05);
  shape.bezierCurveTo(-0.46, 1.35, -0.42, 0.55, 0, 0);
  return new THREE.ShapeGeometry(shape, 10);
}

/** Tři věnce lotosu na kouli: (zeměpisná šířka, počet, velikost). */
const LOTUS_BANDS = [
  { lat: 0.32, count: 12, size: 1.0 },
  { lat: -0.02, count: 10, size: 0.86 },
  { lat: -0.34, count: 8, size: 0.74 },
];

export function HiranSun({ state, onOpen }: { state: HiranState; onOpen: () => void }) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const camera = useThree((s) => s.camera);

  const yantraGeo = useMemo(() => sriYantraGeometry({ radius: YANTRA_R }), []);
  const petalGeo = useMemo(makePetalGeometry, []);
  useEffect(() => () => yantraGeo.dispose(), [yantraGeo]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uActivity: { value: hiranActivity(state) },
      uAccent: { value: new THREE.Color(hiranAccent(state)) },
    }),
    // vytvořeno jednou; stav se aplikuje v rámci framu
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const yantra = useRef<THREE.Group>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const lotus = useRef<THREE.InstancedMesh>(null);
  const yantraMat = useRef<THREE.LineBasicMaterial>(null);
  const lotusMat = useRef<THREE.MeshBasicMaterial>(null);
  const ringAMat = useRef<THREE.MeshBasicMaterial>(null);
  const ringBMat = useRef<THREE.MeshBasicMaterial>(null);
  const activity = useRef(hiranActivity(state));
  const accent = useRef(new THREE.Color(hiranAccent(state)));
  const sealPos = useRef(new THREE.Vector3());

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    activity.current = hiranActivity(state);
    accent.current.set(hiranAccent(state));
  }, [state]);

  // Lotos — 30 lístků na kouli, matice se počítají jednou.
  useLayoutEffect(() => {
    const mesh = lotus.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const dir = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    let index = 0;
    for (const band of LOTUS_BANDS) {
      for (let k = 0; k < band.count; k++) {
        if (index >= mesh.count) break;
        const theta = (k / band.count) * Math.PI * 2;
        const cosLat = Math.cos(band.lat);
        dir.set(cosLat * Math.cos(theta), Math.sin(band.lat), cosLat * Math.sin(theta)).normalize();
        quat.setFromUnitVectors(up, dir);
        pos.copy(dir).multiplyScalar(SUN_R * 1.01);
        scale.setScalar(band.size);
        matrix.compose(pos, quat, scale);
        mesh.setMatrixAt(index, matrix);
        index++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    uniforms.uActivity.value +=
      (activity.current - uniforms.uActivity.value) * Math.min(1, delta * 2.5);
    uniforms.uAccent.value.lerp(accent.current, Math.min(1, delta * 2.5));

    // Pečeť visí kousek před fotosférou, na straně diváka, a natáčí se k němu.
    if (yantra.current) {
      sealPos.current.copy(camera.position).sub(yantra.current.parent!.position).normalize()
        .multiplyScalar(SUN_R * 1.04);
      yantra.current.position.copy(sealPos.current);
      yantra.current.lookAt(camera.position);
      if (!reducedMotion) yantra.current.rotateZ(t * 0.045);
    }
    if (!reducedMotion) {
      if (ringA.current) {
        ringA.current.rotation.z = t * 0.06;
        ringA.current.rotation.x = 1.16 + Math.sin(t * 0.18) * 0.05;
      }
      if (ringB.current) {
        ringB.current.rotation.z = -t * 0.04;
        ringB.current.rotation.x = -1.42 + Math.cos(t * 0.15) * 0.04;
      }
    }
    if (lotus.current) {
      lotus.current.scale.setScalar(1 + Math.min(1, activity.current) * 0.03);
    }

    // Stav je vidět i bez panelu: myšlenka rozsvítí pečeť, offline ji ztlumí.
    const a = uniforms.uActivity.value;
    if (yantraMat.current) yantraMat.current.opacity = 0.35 + a * 0.55;
    if (lotusMat.current) lotusMat.current.opacity = 0.42 + a * 0.4;
    if (ringAMat.current) ringAMat.current.opacity = 0.16 + a * 0.34;
    if (ringBMat.current) ringBMat.current.opacity = 0.09 + a * 0.21;
  });

  return (
    <group position={SUN_POS}>
      {/* energetické pole — tenké filamenty na okraji fotosféry */}
      <mesh scale={1.02}>
        <sphereGeometry args={[SUN_R, 48, 48]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={ENERGY_VERT}
          fragmentShader={ENERGY_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Śrí jantra — zlatá pečeť před slunečním diskem */}
      <group ref={yantra}>
        <lineSegments geometry={yantraGeo}>
          <lineBasicMaterial
            ref={yantraMat}
            color="#ffeec0"
            transparent
            opacity={0.78}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>
      </group>

      {/* prstence */}
      <mesh ref={ringA} rotation={[1.16, 0, 0]} scale={[7.35, 7.35, 7.35]}>
        <torusGeometry args={[1, 0.007, 6, 168]} />
        <meshBasicMaterial ref={ringAMat} color="#ffd166" transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <mesh ref={ringB} rotation={[-1.42, 0.4, 0]} scale={[8.05, 8.05, 8.05]}>
        <torusGeometry args={[1, 0.005, 6, 168]} />
        <meshBasicMaterial ref={ringBMat} color="#ffc04d" transparent opacity={0.28} depthWrite={false} />
      </mesh>

      {/* lotos — koruna 30 lístků, jedna instance */}
      <instancedMesh ref={lotus} args={[petalGeo, undefined, 30]} frustumCulled={false}>
        <meshBasicMaterial
          ref={lotusMat}
          color="#ffd98c"
          transparent
          opacity={0.82}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </instancedMesh>

      {/* neviditelný chyták na klik — Slunce je portál */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[SUN_R * 1.45, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <TextLabel
        text="HIRAN"
        position={[0, -SUN_R - 4.2, 0]}
        color="#ffe9a8"
        height={1.4}
        onClick={onOpen}
      />
    </group>
  );
}
