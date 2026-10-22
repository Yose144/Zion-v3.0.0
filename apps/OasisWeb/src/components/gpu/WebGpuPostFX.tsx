'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { loadTsl, type TslModule } from '../../lib/tsl';

/**
 * TSL post-processing chain for the WebGPU backend (G2).
 *
 *   scene pass → bloom → vignette grade → output
 *
 * Replaces the WebGL-only EffectComposer on `?gpu=webgpu`. Until the TSL
 * module and pipeline are built, it renders frames directly — so the
 * canvas never freezes while the lazy chunk arrives.
 */
export default function WebGpuPostFX() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const ppRef = useRef<{ renderAsync?: () => Promise<void>; render?: () => void; dispose?: () => void } | null>(null);

  useEffect(() => {
    let live = true;
    let dispose: (() => void) | undefined;
    loadTsl()
      .then((tsl: TslModule) => {
        if (!live) return;
        try {
          const postProcessing = new tsl.PostProcessing(gl);
          const scenePass = tsl.pass(scene, camera);
          const color = scenePass.getTextureNode();
          // Gentle bloom — TSL bloom output is added back to the scene
          // colour. The galaxy is already luminous (thousands of additive
          // particles + emissive nodes), so strength must stay low and the
          // threshold high, or dense bright regions lift the whole frame
          // toward white (observed on the 400-world production scene).
          const bloomPass = tsl.bloom(color, 0.12, 0.3, 0.65);
          // Vignette — darken towards the frame edges, matching the
          // WebGL Vignette(eskil=false offset .22 darkness .7) feel.
          const edgeDist = tsl.screenUV.sub(0.5).length();
          const vig = tsl.smoothstep(0.75, 0.25, edgeDist);
          const graded = color.add(bloomPass).mul(tsl.mix(0.5, 1.0, vig));
          postProcessing.outputNode = graded;
          ppRef.current = postProcessing;
          dispose = () => ppRef.current?.dispose?.();
        } catch (err) {
          console.warn('[OASIS] WebGPU post-processing unavailable, rendering direct:', err);
        }
      })
      .catch((err) => {
        console.warn('[OASIS] TSL module failed to load, rendering direct:', err);
      });
    return () => {
      live = false;
      ppRef.current = null;
      dispose?.();
    };
  }, [gl, scene, camera]);

  useFrame(({ gl: g, scene: s, camera: c }) => {
    const pp = ppRef.current;
    if (pp?.renderAsync) {
      // If the pipeline fails at draw time (not construction), drop it —
      // next frame falls through to direct rendering instead of a black canvas.
      void pp
        .renderAsync()!
        .catch((err: unknown) => {
          console.warn('[OASIS] WebGPU post-processing render failed, disabling:', err);
          ppRef.current = null;
        });
      return;
    }
    if (pp?.render) {
      try {
        pp.render();
        return;
      } catch (err) {
        console.warn('[OASIS] WebGPU post-processing render failed, disabling:', err);
        ppRef.current = null;
      }
    }
    const anyGl = g as unknown as {
      render: (sc: THREE.Scene, cam: THREE.Camera) => void;
      renderAsync?: (sc: THREE.Scene, cam: THREE.Camera) => Promise<void>;
    };
    if (anyGl.renderAsync) void anyGl.renderAsync(s, c);
    else anyGl.render(s, c);
  }, 1);

  return null;
}
