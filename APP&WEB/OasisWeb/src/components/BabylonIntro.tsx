'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  PointLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  ParticleSystem,
  Texture,
  Animation,
  GlowLayer,
  Mesh,
  DynamicTexture,
} from '@babylonjs/core';
import { AdvancedDynamicTexture, Button, TextBlock } from '@babylonjs/gui';

interface BabylonIntroProps {
  onEnter: () => void;
}

export default function BabylonIntro({ onEnter }: BabylonIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [warping, setWarping] = useState(false);
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0, 0, 0, 1);

    const flareTexture = createFlareTexture(scene);

    // Camera
    const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2.5, 14, Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 8;
    camera.upperRadiusLimit = 22;
    camera.lowerBetaLimit = 0.1;
    camera.upperBetaLimit = Math.PI / 1.9;
    camera.wheelPrecision = 50;
    camera.useAutoRotationBehavior = true;
    if (camera.autoRotationBehavior) {
      camera.autoRotationBehavior.idleRotationSpeed = 0.08;
      camera.autoRotationBehavior.idleRotationWaitTime = 100;
      camera.autoRotationBehavior.idleRotationSpinupTime = 1000;
    }

    // Lights
    new HemisphericLight('hemi', new Vector3(0, 1, 0), scene).intensity = 0.3;
    const sun = new PointLight('sun', new Vector3(8, 4, -8), scene);
    sun.intensity = 1.2;
    sun.diffuse = new Color3(1, 0.95, 0.85);

    // Glow for emissive objects
    const glow = new GlowLayer('glow', scene);
    glow.intensity = 0.9;

    // Central star / galaxy core
    const core = MeshBuilder.CreateSphere('core', { diameter: 1.6, segments: 32 }, scene);
    const coreMat = new StandardMaterial('coreMat', scene);
    coreMat.emissiveColor = new Color3(0.6, 0.4, 1);
    coreMat.disableLighting = true;
    core.material = coreMat;

    // Core particle halo
    const coreParticles = new ParticleSystem('coreParticles', 1200, scene);
    coreParticles.particleTexture = flareTexture;
    coreParticles.emitter = core;
    coreParticles.minEmitBox = new Vector3(-0.6, -0.6, -0.6);
    coreParticles.maxEmitBox = new Vector3(0.6, 0.6, 0.6);
    coreParticles.color1 = new Color4(0.6, 0.2, 1, 0.8);
    coreParticles.color2 = new Color4(0.2, 0.6, 1, 0.6);
    coreParticles.colorDead = new Color4(0, 0, 0, 0);
    coreParticles.minSize = 0.02;
    coreParticles.maxSize = 0.08;
    coreParticles.minLifeTime = 1.5;
    coreParticles.maxLifeTime = 3.5;
    coreParticles.emitRate = 200;
    coreParticles.blendMode = ParticleSystem.BLENDMODE_ONEONE;
    coreParticles.gravity = new Vector3(0, 0, 0);
    coreParticles.direction1 = new Vector3(-1, 1, -1);
    coreParticles.direction2 = new Vector3(1, 1, 1);
    coreParticles.minEmitPower = 0.1;
    coreParticles.maxEmitPower = 0.4;
    coreParticles.updateSpeed = 0.005;
    coreParticles.start();

    // Stargate rings
    createRing(scene, 'ring1', 4.2, 0.12, new Color3(0.06, 0.72, 0.83), 0.002);
    createRing(scene, 'ring2', 5.4, 0.08, new Color3(0.58, 0.18, 0.96), -0.0015);
    createRing(scene, 'ring3', 6.8, 0.06, new Color3(1, 0.76, 0.03), 0.001);

    // Nova Zeme planet in distance
    const planet = MeshBuilder.CreateSphere('planet', { diameter: 2.2, segments: 48 }, scene);
    planet.position = new Vector3(10, -2, 12);
    const planetMat = new StandardMaterial('planetMat', scene);
    planetMat.diffuseColor = new Color3(0.1, 0.4, 0.25);
    planetMat.emissiveColor = new Color3(0.05, 0.25, 0.15);
    planetMat.specularColor = new Color3(0.1, 0.1, 0.1);
    planet.material = planetMat;

    // Planet atmosphere
    const atmo = MeshBuilder.CreateSphere('atmo', { diameter: 2.5, segments: 32 }, scene);
    atmo.position = planet.position.clone();
    const atmoMat = new StandardMaterial('atmoMat', scene);
    atmoMat.emissiveColor = new Color3(0.1, 0.7, 0.5);
    atmoMat.alpha = 0.12;
    atmoMat.disableLighting = true;
    atmo.material = atmoMat;

    // Starfield
    createStarfield(scene, 2500);

    // Galaxy disc particles (spiral)
    createGalaxyDisc(scene, flareTexture);

    // GUI
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI('ui');

    const title = new TextBlock('title');
    title.text = 'Stargate · Threshold';
    title.color = 'white';
    title.fontSize = '24px';
    title.fontFamily = 'Inter, ui-sans-serif, system-ui';
    title.fontWeight = 'bold';
    title.top = '-42%';
    title.shadowColor = 'rgba(6,182,212,0.8)';
    title.shadowBlur = 24;
    uiTexture.addControl(title);

    const subtitle = new TextBlock('subtitle');
    subtitle.text = 'At the gate to Oasis stand two priestesses — Radha and Elizabeth. One holds salt and honey; the other, a lantern of the future.';
    subtitle.color = 'rgba(255,255,255,0.65)';
    subtitle.fontSize = '13px';
    subtitle.fontFamily = 'Inter, ui-sans-serif, system-ui';
    subtitle.top = '-33%';
    subtitle.width = '320px';
    subtitle.height = '80px';
    subtitle.textWrapping = true;
    subtitle.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_CENTER;
    uiTexture.addControl(subtitle);

    const enterBtn = Button.CreateSimpleButton('enterBtn', 'Cross the Threshold');
    enterBtn.width = '240px';
    enterBtn.height = '54px';
    enterBtn.color = 'white';
    enterBtn.fontSize = '16px';
    enterBtn.fontFamily = 'Inter, ui-sans-serif, system-ui';
    enterBtn.fontWeight = 'bold';
    enterBtn.cornerRadius = 12;
    enterBtn.background = 'rgba(6, 182, 212, 0.25)';
    enterBtn.thickness = 1;
    enterBtn.linkOffsetX = 0;
    enterBtn.linkOffsetY = 0;
    enterBtn.top = '34%';
    enterBtn.shadowColor = 'rgba(6, 182, 212, 0.5)';
    enterBtn.shadowBlur = 20;
    enterBtn.onPointerEnterObservable.add(() => {
      enterBtn.background = 'rgba(6, 182, 212, 0.45)';
    });
    enterBtn.onPointerOutObservable.add(() => {
      enterBtn.background = 'rgba(6, 182, 212, 0.25)';
    });
    enterBtn.onPointerClickObservable.add(() => {
      setWarping(true);
    });
    uiTexture.addControl(enterBtn);

    const hint = new TextBlock('hint');
    hint.text = 'Drag to rotate · Scroll to zoom';
    hint.color = 'rgba(255,255,255,0.35)';
    hint.fontSize = '11px';
    hint.top = '52%';
    uiTexture.addControl(hint);

    // Rotation
    scene.onBeforeRenderObservable.add(() => {
      planet.rotation.y += 0.0015;
      atmo.rotation.y += 0.0012;
    });

    // Render loop
    engine.runRenderLoop(() => scene.render());
    const resize = () => engine.resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      // Stop render loop first
      engine.stopRenderLoop();
      // Dispose Babylon scene + engine
      scene.dispose();
      engine.dispose();
      // Force WebGL context release immediately
      try {
        const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
        if (gl) {
          const ext = gl.getExtension('WEBGL_lose_context');
          if (ext) ext.loseContext();
        }
      } catch (e) {
        // ignore
      }
    };
  }, []);

  // Warp animation triggered by state
  useEffect(() => {
    if (!warping) return;
    onEnterRef.current();
  }, [warping]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
      <AnimatePresence>
        {!warping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 text-center"
          >
            <p className="text-[10px] text-gray-500">Babylon.js rendering</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function createRing(scene: Scene, name: string, radius: number, thickness: number, color: Color3, rotSpeed: number): Mesh {
  const torus = MeshBuilder.CreateTorus(name, { diameter: radius * 2, thickness, tessellation: 48 }, scene);
  const mat = new StandardMaterial(`${name}Mat`, scene);
  mat.emissiveColor = color;
  mat.disableLighting = true;
  mat.alpha = 0.9;
  torus.material = mat;

  // Random orientation
  torus.rotation.x = Math.random() * Math.PI;
  torus.rotation.y = Math.random() * Math.PI;

  scene.onBeforeRenderObservable.add(() => {
    torus.rotation.x += rotSpeed;
    torus.rotation.y += rotSpeed * 0.7;
  });
  return torus;
}

function createStarfield(scene: Scene, count: number) {
  const starMat = new StandardMaterial('starMat', scene);
  starMat.emissiveColor = new Color3(1, 1, 1);
  starMat.disableLighting = true;

  for (let i = 0; i < count; i++) {
    const star = MeshBuilder.CreateSphere(`star${i}`, { diameter: 0.04 + Math.random() * 0.04, segments: 4 }, scene);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 25 + Math.random() * 180;
    star.position = new Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    );
    const m = starMat.clone(`starMat${i}`);
    const t = 0.5 + Math.random() * 0.5;
    m.emissiveColor = new Color3(t, t, Math.random() > 0.5 ? t : t * 0.8);
    star.material = m;
  }
}

function createGalaxyDisc(scene: Scene, flareTexture: Texture) {
  const count = 1200;
  const ps = new ParticleSystem('galaxy', count, scene);
  ps.particleTexture = flareTexture;
  ps.emitter = Vector3.Zero();
  ps.minEmitBox = new Vector3(0, -0.1, 0);
  ps.maxEmitBox = new Vector3(0, 0.1, 0);
  ps.color1 = new Color4(0.2, 0.6, 1, 0.25);
  ps.color2 = new Color4(0.6, 0.2, 1, 0.2);
  ps.colorDead = new Color4(0, 0, 0, 0);
  ps.minSize = 0.02;
  ps.maxSize = 0.06;
  ps.minLifeTime = 9999;
  ps.maxLifeTime = 9999;
  ps.emitRate = count;
  ps.blendMode = ParticleSystem.BLENDMODE_ONEONE;
  ps.gravity = new Vector3(0, 0, 0);

  // Custom particle position for spiral arms
  ps.startDirectionFunction = () => Vector3.Zero();
  ps.startPositionFunction = (worldMatrix, position) => {
    const arm = Math.floor(Math.random() * 4);
    const angle = arm * (Math.PI / 2) + Math.random() * 1.2;
    const dist = 3 + Math.random() * 18;
    const spread = (Math.random() - 0.5) * 2.5;
    position.x = Math.cos(angle) * dist + spread;
    position.y = (Math.random() - 0.5) * 0.4;
    position.z = Math.sin(angle) * dist + spread;
  };

  ps.updateSpeed = 0;
  ps.start();
}

function createFlareTexture(scene: Scene): Texture {
  const size = 128;
  const tex = new DynamicTexture('flare', { width: size, height: size }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.4)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  tex.update();
  return tex;
}
