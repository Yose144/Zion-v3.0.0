'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { EARTH_ORBIT_R, planetPosition, fleetPosition, moonPosition, GATE_JUPITER_OFFSET } from './positions';
import { PLANETS, orbitRadius } from './SolarSystem';

export type LinkKind = 'planet' | 'gate' | 'station' | 'ark' | 'fleet' | 'moon' | 'sun' | 'world';

export interface LinkFocus {
  cam: THREE.Vector3;
  target: THREE.Vector3;
  fov?: number;
  minDistance?: number;
  maxDistance?: number;
  duration?: number; // seconds for transition
}

export interface LinkTarget {
  id: string;
  kind: LinkKind;
  accent?: string;
  label: { cs: string; en: string };
  cta?: { cs: string; en: string };
  getFocus: (ctx: LinkCtx) => LinkFocus;
  onArrive?: (ctx: LinkCtx) => void;
  priority?: number;
}

export interface LinkCtx {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControlsImpl | null;
  clock: { elapsedTime: number };
  earthPos: THREE.Vector3;
  reducedMotion: boolean;
  lang: 'cs' | 'en';
}

const SUN_CAM = new THREE.Vector3(17, 8, 17);
const SUN_TARGET = new THREE.Vector3(0, 0, 0);
const FLEET_CAM_LIFT = new THREE.Vector3(0, 1.6, 0);
const FLEET_UP = new THREE.Vector3(0, 1, 0);
const FLEET_CAM_TANGENT = new THREE.Vector3();

export class LinkEngine {
  private targets = new Map<string, LinkTarget>();
  private currentFocus: string = 'earth';
  private progress = 1;
  private fromCam = new THREE.Vector3();
  private fromTarget = new THREE.Vector3();
  private toCam = new THREE.Vector3();
  private toTarget = new THREE.Vector3();
  private duration = 1.6;
  private onArriveCb?: (target: LinkTarget) => void;

  register(target: LinkTarget) {
    this.targets.set(target.id, target);
  }

  unregister(id: string) {
    this.targets.delete(id);
  }

  getTarget(id: string): LinkTarget | undefined {
    return this.targets.get(id);
  }

  getCurrentFocus(): string {
    return this.currentFocus;
  }

  flyTo(id: string, ctx: LinkCtx, onArrive?: (target: LinkTarget) => void) {
    if (id === this.currentFocus && this.progress >= 1) return;

    this.currentFocus = id;
    this.progress = 0;
    this.fromCam.copy(ctx.camera.position);
    if (ctx.controls) {
      this.fromTarget.copy(ctx.controls.target);
    } else {
      this.fromTarget.set(0, 0, 0);
    }
    this.onArriveCb = onArrive;

    const target = this.targets.get(id);
    if (target) {
      const focus = target.getFocus(ctx);
      this.toCam.copy(focus.cam);
      this.toTarget.copy(focus.target);
      this.duration = focus.duration ?? 1.6;
    } else if (id === 'earth') {
      this.toTarget.copy(ctx.earthPos);
      this.duration = 1.2;
    } else {
      // Fallback
      this.toTarget.set(0, 0, 0);
      this.duration = 1.6;
    }
  }

  update(ctx: LinkCtx, delta: number): boolean {
    if (!ctx.controls) return false;

    // Handle earth following
    if (this.currentFocus === 'earth' && this.progress >= 1) {
      const dx = ctx.earthPos.x - ctx.earthPos.x; // will be handled by caller
      // Earth following is handled externally for now
      ctx.controls.target.copy(ctx.earthPos);
      return false;
    }

    if (this.progress >= 1) {
      // Check if we're following a moving target
      const target = this.targets.get(this.currentFocus);
      if (target && target.kind === 'fleet') {
        const ft = ctx.reducedMotion ? 0 : ctx.clock.elapsedTime;
        const [fx, fy, fz] = fleetPosition(ft);
        const fleetTarget = new THREE.Vector3(ctx.earthPos.x + fx, fy, ctx.earthPos.z + fz);
        const radial = fleetTarget.clone().normalize();
        const tangent = FLEET_CAM_TANGENT.crossVectors(FLEET_UP, radial).normalize();
        const fleetCam = new THREE.Vector3()
          .copy(fleetTarget)
          .addScaledVector(radial, 4.0)
          .addScaledVector(tangent, 5.2)
          .add(FLEET_CAM_LIFT);
        
        // Smooth follow
        ctx.controls.target.lerp(fleetTarget, 0.1);
        ctx.camera.position.lerp(fleetCam, 0.1);
      } else if (target && target.kind === 'moon') {
        const mt = ctx.reducedMotion ? 0 : ctx.clock.elapsedTime;
        const [mx, my, mz] = moonPosition(mt);
        const moonTarget = new THREE.Vector3(ctx.earthPos.x + mx, my, ctx.earthPos.z + mz);
        const radial = moonTarget.clone().normalize();
        const tangent = FLEET_CAM_TANGENT.crossVectors(FLEET_UP, radial).normalize();
        const moonCam = new THREE.Vector3()
          .copy(moonTarget)
          .addScaledVector(radial, 3.2)
          .addScaledVector(tangent, 2.4)
          .add(FLEET_CAM_LIFT);
        
        ctx.controls.target.lerp(moonTarget, 0.1);
        ctx.camera.position.lerp(moonCam, 0.1);
      } else if (target && target.kind === 'planet') {
        const planetDef = PLANETS.find((p) => p.id === target.id);
        if (planetDef) {
          const index = PLANETS.indexOf(planetDef);
          const [px, py, pz] = planetPosition(
            planetDef.id,
            index,
            orbitRadius(planetDef.au),
            planetDef.speed,
            ctx.clock.elapsedTime,
          );
          const distance = Math.max(3.6, planetDef.size * 3.4 + 1.6);
          const planetTarget = new THREE.Vector3(px, py + planetDef.size * 0.4, pz);
          const planetCam = new THREE.Vector3(px + distance * 0.75, py + distance * 0.5, pz + distance);
          
          ctx.controls.target.lerp(planetTarget, 0.05);
          ctx.camera.position.lerp(planetCam, 0.05);
        }
      }
      return false;
    }

    // Animate transition
    this.progress = Math.min(1, this.progress + delta / this.duration);
    const t = 1 - Math.pow(1 - this.progress, 3); // ease-out cubic
    
    ctx.controls.target.lerpVectors(this.fromTarget, this.toTarget, t);
    ctx.camera.position.lerpVectors(this.fromCam, this.toCam, t);
    
    if (this.progress >= 1 && this.onArriveCb) {
      const target = this.targets.get(this.currentFocus);
      if (target) {
        this.onArriveCb(target);
      }
      this.onArriveCb = undefined;
    }
    
    return this.progress < 1;
  }

  isTransitioning(): boolean {
    return this.progress < 1;
  }
}

export function createDefaultLinkTargets(): LinkTarget[] {
  const targets: LinkTarget[] = [];

  // Planets
  PLANETS.forEach((planet, index) => {
    if (planet.game) {
      targets.push({
        id: planet.id,
        kind: 'planet',
        accent: planet.tint,
        label: { cs: planet.name, en: planet.name },
        cta: planet.cta || { cs: 'Prozkoumat →', en: 'Explore →' },
        getFocus: (ctx: LinkCtx) => {
          const [px, py, pz] = planetPosition(
            planet.id,
            index,
            orbitRadius(planet.au),
            planet.speed,
            ctx.clock.elapsedTime,
          );
          const distance = Math.max(3.6, planet.size * 3.4 + 1.6);
          const target = new THREE.Vector3(px, py + planet.size * 0.4, pz);
          const cam = new THREE.Vector3(px + distance * 0.75, py + distance * 0.5, pz + distance);
          return {
            cam,
            target,
            duration: 1.8,
          };
        },
      });
    }
  });

  // Sun/Hiran
  targets.push({
    id: 'sun',
    kind: 'sun',
    accent: '#ffd166',
    label: { cs: 'Hiran', en: 'Hiran' },
    cta: { cs: 'Otevřít →', en: 'Open →' },
    getFocus: () => ({
      cam: SUN_CAM.clone(),
      target: SUN_TARGET.clone(),
      duration: 1.6,
    }),
  });

  // Fleet
  targets.push({
    id: 'fleet',
    kind: 'fleet',
    accent: '#38bdf8',
    label: { cs: 'Nebeská flotila', en: 'Celestial Fleet' },
    cta: { cs: 'Přiblížit →', en: 'Approach →' },
    getFocus: (ctx: LinkCtx) => {
      const ft = ctx.reducedMotion ? 0 : ctx.clock.elapsedTime;
      const [fx, fy, fz] = fleetPosition(ft);
      const fleetTarget = new THREE.Vector3(ctx.earthPos.x + fx, fy, ctx.earthPos.z + fz);
      const radial = fleetTarget.clone().normalize();
      const tangent = FLEET_CAM_TANGENT.crossVectors(FLEET_UP, radial).normalize();
      const fleetCam = new THREE.Vector3()
        .copy(fleetTarget)
        .addScaledVector(radial, 4.0)
        .addScaledVector(tangent, 5.2)
        .add(FLEET_CAM_LIFT);
      return {
        cam: fleetCam,
        target: fleetTarget,
        duration: 1.6,
      };
    },
  });

  // Moon
  targets.push({
    id: 'moon',
    kind: 'moon',
    accent: '#c9c2b6',
    label: { cs: 'Měsíc', en: 'Moon' },
    cta: { cs: 'Přiblížit →', en: 'Approach →' },
    getFocus: (ctx: LinkCtx) => {
      const mt = ctx.reducedMotion ? 0 : ctx.clock.elapsedTime;
      const [mx, my, mz] = moonPosition(mt);
      const moonTarget = new THREE.Vector3(ctx.earthPos.x + mx, my, ctx.earthPos.z + mz);
      const radial = moonTarget.clone().normalize();
      const tangent = FLEET_CAM_TANGENT.crossVectors(FLEET_UP, radial).normalize();
      const moonCam = new THREE.Vector3()
        .copy(moonTarget)
        .addScaledVector(radial, 3.2)
        .addScaledVector(tangent, 2.4)
        .add(FLEET_CAM_LIFT);
      return {
        cam: moonCam,
        target: moonTarget,
        duration: 1.6,
      };
    },
  });

  // Jupiter (park/station)
  targets.push({
    id: 'jupiter',
    kind: 'station',
    accent: '#ffb46a',
    label: { cs: 'Jupiter Station', en: 'Jupiter Station' },
    cta: { cs: 'Na pouť →', en: 'To fair →' },
    getFocus: (ctx: LinkCtx) => {
      const jupiterDef = PLANETS.find((p) => p.id === 'jupiter')!;
      const index = PLANETS.indexOf(jupiterDef);
      const [px, py, pz] = planetPosition(
        'jupiter',
        index,
        orbitRadius(jupiterDef.au),
        jupiterDef.speed,
        ctx.clock.elapsedTime,
      );
      const distance = Math.max(3.6, jupiterDef.size * 3.4 + 1.6);
      const target = new THREE.Vector3(px, py + jupiterDef.size * 0.4, pz);
      const cam = new THREE.Vector3(px + distance * 0.75, py + distance * 0.5, pz + distance);
      return {
        cam,
        target,
        duration: 1.8,
      };
    },
  });

  // Gate / OASIS (StarGate na Jupiteru)
  targets.push({
    id: 'gate',
    kind: 'gate',
    accent: '#fcd116',
    label: { cs: 'Brána do OASIS', en: 'Gate to OASIS' },
    cta: { cs: 'Vstoupit ↗', en: 'Enter ↗' },
    getFocus: (ctx: LinkCtx) => {
      const jupiterDef = PLANETS.find((p) => p.id === 'jupiter')!;
      const index = PLANETS.indexOf(jupiterDef);
      const [px, py, pz] = planetPosition(
        'jupiter',
        index,
        orbitRadius(jupiterDef.au),
        jupiterDef.speed,
        ctx.clock.elapsedTime,
      );
      const gatePos = new THREE.Vector3(px + GATE_JUPITER_OFFSET[0], py + GATE_JUPITER_OFFSET[1], pz + GATE_JUPITER_OFFSET[2]);
      const target = gatePos.clone();
      const cam = gatePos.clone().add(new THREE.Vector3(0, 2, 6));
      return {
        cam,
        target,
        duration: 1.6,
      };
    },
  });

  // Archa (SailingArk)
  targets.push({
    id: 'archa',
    kind: 'ark',
    accent: '#1d8fb3',
    label: { cs: 'Archa', en: 'The Ark' },
    cta: { cs: 'Otevřít →', en: 'Open →' },
    getFocus: (ctx: LinkCtx) => {
      // SailingArk je součástí zemské soustavy (child earthSys) - aproximace
      const target = new THREE.Vector3(ctx.earthPos.x + 12, ctx.earthPos.y + 0.8, ctx.earthPos.z + 6);
      const cam = target.clone().add(new THREE.Vector3(4, 3, 8));
      return {
        cam,
        target,
        duration: 1.6,
      };
    },
  });

  // Matrix (moon)
  targets.push({
    id: 'matrix',
    kind: 'moon',
    accent: '#00ff88',
    label: { cs: 'Matrix', en: 'Matrix' },
    cta: { cs: 'Vstoupit →', en: 'Enter →' },
    getFocus: (ctx: LinkCtx) => {
      const mt = ctx.reducedMotion ? 0 : ctx.clock.elapsedTime;
      const [mx, my, mz] = moonPosition(mt);
      const moonTarget = new THREE.Vector3(ctx.earthPos.x + mx, my, ctx.earthPos.z + mz);
      const radial = moonTarget.clone().normalize();
      const tangent = FLEET_CAM_TANGENT.crossVectors(FLEET_UP, radial).normalize();
      const moonCam = new THREE.Vector3()
        .copy(moonTarget)
        .addScaledVector(radial, 3.2)
        .addScaledVector(tangent, 2.4)
        .add(FLEET_CAM_LIFT);
      return {
        cam: moonCam,
        target: moonTarget,
        duration: 1.6,
      };
    },
  });

  // Issobella (ring)
  targets.push({
    id: 'issobella',
    kind: 'station',
    accent: '#c084fc',
    label: { cs: 'Issobella', en: 'Issobella' },
    cta: { cs: 'Otevřít →', en: 'Open →' },
    getFocus: (ctx: LinkCtx) => {
      const target = new THREE.Vector3(ctx.earthPos.x + 4, ctx.earthPos.y + 1.2, ctx.earthPos.z - 3);
      const cam = target.clone().add(new THREE.Vector3(2, 2, 5));
      return {
        cam,
        target,
        duration: 1.6,
      };
    },
  });

  return targets;
}

export function useLinkEngine() {
  const engineRef = useRef<LinkEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new LinkEngine();
    const targets = createDefaultLinkTargets();
    targets.forEach((t) => engineRef.current!.register(t));
  }
  return engineRef.current;
}

// Export singleton for non-React usage
let globalLinkEngine: LinkEngine | null = null;

export function getGlobalLinkEngine(): LinkEngine {
  if (!globalLinkEngine) {
    globalLinkEngine = new LinkEngine();
    const targets = createDefaultLinkTargets();
    targets.forEach((t) => globalLinkEngine!.register(t));
  }
  return globalLinkEngine;
}

