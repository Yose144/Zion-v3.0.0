'use client';

/**
 * LinkLayer — kreslí spoje mezi registrovanými body vesmíru.
 *
 * Data (co je s čím spojené) drží `LinkEngine.getEdges()`, styl `links.ts`.
 * Tahle komponenta je jen renderer: každý frame si vyžádá `anchor()` obou
 * konců a přepíše pozice předalokované geometrie. Žádná alokace ve smyčce.
 *
 * Spoj, který se dotýká právě označeného bodu, svítí (`LINK_ACTIVE_OPACITY`),
 * ostatní jsou tlumené — tak je vidět, kam vede „cesta“ od zaměřeného bodu.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGlobalLinkEngine } from './LinkEngine';
import { LINK_COLOR, LINK_OPACITY, LINK_ACTIVE_OPACITY } from './links';

const SEGMENTS = 20;

function buildArc(a: THREE.Vector3, b: THREE.Vector3, out: Float32Array) {
  // Mírný oblouk: střed vystrčený radiálně od Slunce, ať linka neleží v ose
  // planety a neplete se s drahou.
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const radial = mid.clone().normalize().multiplyScalar(0.06 * a.distanceTo(b));
  mid.add(radial);
  const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
  const pts = curve.getPoints(SEGMENTS);
  for (let i = 0; i <= SEGMENTS; i++) {
    out[i * 3] = pts[i].x;
    out[i * 3 + 1] = pts[i].y;
    out[i * 3 + 2] = pts[i].z;
  }
}

export function LinkLayer() {
  const engine = getGlobalLinkEngine();
  const edges = engine.getEdges();

  // Předalokované buffery — jedna geometrie na spoj, žádná alokace ve frame.
  const buffers = useMemo(
    () => edges.map(() => new Float32Array((SEGMENTS + 1) * 3)),
    [edges],
  );

  const lines = useRef<(THREE.Line | null)[]>([]);
  const mats = useRef<(THREE.LineBasicMaterial | null)[]>([]);

  useFrame(() => {
    const current = engine.getCurrentFocus();
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const from = engine.getTarget(edge.from);
      const to = engine.getTarget(edge.to);
      const line = lines.current[i];
      if (!from || !to || !line) continue;

      // Anchor je závislý na kontextu (čas, poloha Země). LinkLayer nemá
      // vlastní ctx, takže si ho půjčí z posledního updatu enginu.
      const ctx = engine.getLastCtx();
      if (!ctx) continue;
      const a = from.anchor(ctx);
      const b = to.anchor(ctx);
      buildArc(a, b, buffers[i]);
      const geo = line.geometry as THREE.BufferGeometry;
      const attr = geo.getAttribute('position') as THREE.BufferAttribute;
      (attr.array as Float32Array).set(buffers[i]);
      attr.needsUpdate = true;
      geo.computeBoundingSphere();

      const mat = mats.current[i];
      if (mat) {
        const active = edge.from === current || edge.to === current;
        const target = active ? LINK_ACTIVE_OPACITY : LINK_OPACITY * 0.55;
        mat.opacity += (target - mat.opacity) * 0.12;
      }
    }
  });

  return (
    <group>
      {edges.map((edge, i) => (
        <line
          key={`${edge.from}-${edge.to}`}
          // `line` je v TS JSX globální SVG tag; R3F objekt je za ním.
          ref={(el) => { lines.current[i] = el as unknown as THREE.Line; }}
        >
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[buffers[i], 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            ref={(el) => { mats.current[i] = el; }}
            color={LINK_COLOR}
            transparent
            opacity={LINK_OPACITY * 0.55}
            depthWrite={false}
            toneMapped={false}
          />
        </line>
      ))}
    </group>
  );
}
