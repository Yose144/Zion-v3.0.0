'use client';

/**
 * LinkEngine — jediný engine pro linky a kameru ve vesmírné scéně.
 *
 * Co řeší (a co dřív bylo na třech místech):
 *   1. Registr všech „linkovatelných“ bodů scény (planety, brána, stanice,
 *      archa, flotila, Měsíc, Slunce, Země) — každý má `anchor()` ve světových
 *      souřadnicích. Pohyblivé body počítají polohu stejným vzorcem jako scéna
 *      (`positions.ts`), takže kamera doletí tam, kde objekt skutečně je.
 *   2. Přelet kamery (`flyTo`) — jeden tween, jedna easing křivka, jedna
 *      framing funkce (`frameFor`). Žádné druhé kopie `distance*3.4+1.6`.
 *   3. Sledování pohyblivých cílů po příletu — posun kamery i `controls.target`
 *      o delta anchoru, takže planeta zůstane v záběru a uživatel může dál
 *      rotovat/zoomovat (dřív se kamera lerpovala zpět a bojovala s myší).
 *   4. „Označený bod“ (`current`) — kdo je právě zaměřený; HUD i vrstva linek
 *      z něj čtou. `flyTo('earth')` = návrat.
 *
 * Volání z komponent je bez kontextu: `flyTo(id)` jen označí cíl, skutečný
 * přelet spustí nejbližší `update(ctx, delta)` uvnitř `<Canvas>`. Tím zmizely
 * hacky typu `camera: null as any` v `Shell.tsx` a `window.__nirvanaCamera`
 * v `SolarSystem.tsx`.
 */

import { useEffect, useReducer } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  planetPosition,
  fleetPosition,
  moonPosition,
  arkPosition,
  ISSOBELLA_FOCUS,
  GATE_JUPITER_OFFSET,
} from './positions';
import { PLANETS, orbitRadius, planetIndex } from './planetCatalog';

export type LinkKind =
  | 'planet'
  | 'gate'
  | 'station'
  | 'ark'
  | 'fleet'
  | 'moon'
  | 'sun'
  | 'world'
  | 'earth';

/** Cíle, na které umí kamera doletět — jeden typ pro Shell, SceneRoot i Universe. */
export type UniverseFocus =
  | 'earth'
  | 'sun'
  | 'jupiter'
  | 'mars'
  | 'venus'
  | 'mercury'
  | 'fleet'
  | 'moon'
  | 'archa'
  | 'issobella'
  | 'gate';

/** Kontext, který engine dostane z `useFrame` — nic z toho si nedrží. */
export interface LinkCtx {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControlsImpl | null;
  clock: { elapsedTime: number };
  earthPos: THREE.Vector3;
  reducedMotion: boolean;
  lang: 'cs' | 'en';
}

export interface LinkFraming {
  /** Násobek poloměru pro vzdálenost kamery (planety: 3.4). */
  radius?: number;
  /** Minimální vzdálenost (malé objekty: 3.6). */
  minDistance?: number;
  /** Zdroj dat pro fokus (planeta, flotila…). */
  size?: number;
  /** Offset kamery ve zlomcích vzdálenosti [x, y, z] (planety: 0.75, 0.5, 1). */
  offset?: [number, number, number];
  /** Vlastní framing (flotila, Měsíc, brána…) — přebíjí offset. */
  compute?: (anchor: THREE.Vector3, ctx: LinkCtx) => LinkFrame;
  duration?: number;
}

export interface LinkFrame {
  cam: THREE.Vector3;
  target: THREE.Vector3;
  duration: number;
}

export interface LinkTarget {
  id: string;
  kind: LinkKind;
  accent?: string;
  label: { cs: string; en: string };
  cta?: { cs: string; en: string };
  /** Světová poloha — volá se každý frame (pohyblivé cíle). */
  anchor: (ctx: LinkCtx) => THREE.Vector3;
  size?: number;
  framing?: LinkFraming;
  /** Sledovat po příletu (posunout kameru i target o delta anchoru). */
  follow?: boolean;
}

export interface LinkEdge {
  from: string;
  to: string;
  accent?: string;
  /** Jen dekorativní spoje (ne trasy, po kterých jde skočit). */
  kind?: 'route' | 'orbit';
}

const DEFAULT_DURATION = 1.6;
const FOLLOW_LERP = 0.16;
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

/** Jeden framing pro všechny — žádná druhá kopie výpočtu vzdálenosti. */
export function frameFor(target: LinkTarget, ctx: LinkCtx): LinkFrame {
  const anchor = target.anchor(ctx);
  const size = target.size ?? target.framing?.size ?? 1;
  const f = target.framing ?? {};
  if (f.compute) return f.compute(anchor, ctx);

  const dist = Math.max(f.minDistance ?? 3.6, size * (f.radius ?? 3.4) + 1.6);
  const [ox, oy, oz] = f.offset ?? [0.75, 0.5, 1];
  const lift = size * 0.4;
  return {
    cam: new THREE.Vector3(anchor.x + dist * ox, anchor.y + dist * oy, anchor.z + dist * oz),
    target: new THREE.Vector3(anchor.x, anchor.y + lift, anchor.z),
    duration: f.duration ?? DEFAULT_DURATION,
  };
}

export class LinkEngine {
  private targets = new Map<string, LinkTarget>();
  private edges: LinkEdge[] = [];
  private current = 'earth';
  private pending: string | null = null;
  private progress = 1;
  private duration = DEFAULT_DURATION;
  private fromCam = new THREE.Vector3();
  private fromTarget = new THREE.Vector3();
  private lastAnchor = new THREE.Vector3();
  private hasAnchor = false;
  private arrived = true;
  private onArriveCb?: (target: LinkTarget | null) => void;
  private listeners = new Set<() => void>();
  /** Poslední kontext z `update` — používá ho `LinkLayer` pro anchor(). */
  private lastCtx: LinkCtx | null = null;

  register(target: LinkTarget) {
    this.targets.set(target.id, target);
    this.notify();
  }

  unregister(id: string) {
    this.targets.delete(id);
    this.notify();
  }

  getTarget(id: string): LinkTarget | undefined {
    return this.targets.get(id);
  }

  getTargets(): LinkTarget[] {
    return Array.from(this.targets.values());
  }

  setEdges(edges: LinkEdge[]) {
    this.edges = edges;
    this.notify();
  }

  getEdges(): LinkEdge[] {
    return this.edges;
  }

  /** Sousedé přes spoje — HUD z nich dělá „skoč na…“ tlačítka. */
  neighbors(id: string): string[] {
    const out: string[] = [];
    for (const e of this.edges) {
      if (e.from === id && !out.includes(e.to)) out.push(e.to);
      else if (e.to === id && !out.includes(e.from)) out.push(e.from);
    }
    return out;
  }

  getCurrentFocus(): string {
    return this.current;
  }

  /** Označí cíl a spustí přelet při nejbližším `update`. */
  flyTo(id: string, onArrive?: (target: LinkTarget | null) => void) {
    if (!this.targets.has(id)) return;
    this.pending = id;
    this.onArriveCb = onArrive;
    this.notify();
  }

  /** Okamžitý skok (reduced motion / teleport). */
  snapTo(id: string, ctx: LinkCtx) {
    const target = this.targets.get(id);
    if (!target || !ctx.controls) return;
    this.current = id;
    this.pending = null;
    this.progress = 1;
    this.arrived = true;
    const f = frameFor(target, ctx);
    ctx.camera.position.copy(f.cam);
    ctx.controls.target.copy(f.target);
    this.lastAnchor.copy(target.anchor(ctx));
    this.hasAnchor = true;
    this.notify();
  }

  isTransitioning(): boolean {
    return this.progress < 1 || this.pending !== null;
  }

  /** Subscribe for HUD (current focus changes). */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn();
  }

  private begin(ctx: LinkCtx) {
    const id = this.pending!;
    this.pending = null;
    const target = this.targets.get(id);
    if (!target) return;
    this.current = id;
    this.progress = 0;
    this.arrived = false;
    this.hasAnchor = false;
    this.fromCam.copy(ctx.camera.position);
    if (ctx.controls) this.fromTarget.copy(ctx.controls.target);
    else this.fromTarget.set(0, 0, 0);
    this.duration = frameFor(target, ctx).duration;
    this.notify();
  }

  getLastCtx(): LinkCtx | null {
    return this.lastCtx;
  }

  update(ctx: LinkCtx, delta: number): boolean {
    if (!ctx.controls) return false;
    this.lastCtx = ctx;
    if (this.pending) this.begin(ctx);

    const target = this.targets.get(this.current);

    // ── přelet ──
    if (this.progress < 1) {
      this.progress = Math.min(1, this.progress + delta / Math.max(0.001, this.duration));
      const k = easeOut(this.progress);
      if (target) {
        // Cíl se počítá každý frame z živého anchoru — pohyblivá planeta
        // tak během přeletu neuletí.
        const f = frameFor(target, ctx);
        ctx.controls.target.lerpVectors(this.fromTarget, f.target, k);
        ctx.camera.position.lerpVectors(this.fromCam, f.cam, k);
      }
      if (this.progress >= 1) {
        this.arrived = true;
        if (target) {
          this.lastAnchor.copy(target.anchor(ctx));
          this.hasAnchor = true;
        }
        const cb = this.onArriveCb;
        this.onArriveCb = undefined;
        cb?.(target ?? null);
      }
      return this.progress < 1;
    }

    // ── sledování po příletu ──
    if (target?.follow && this.arrived) {
      const anchor = target.anchor(ctx);
      if (this.hasAnchor) {
        const dx = anchor.x - this.lastAnchor.x;
        const dy = anchor.y - this.lastAnchor.y;
        const dz = anchor.z - this.lastAnchor.z;
        if (dx !== 0 || dy !== 0 || dz !== 0) {
          ctx.camera.position.x += dx;
          ctx.camera.position.y += dy;
          ctx.camera.position.z += dz;
          ctx.controls.target.x += dx;
          ctx.controls.target.y += dy;
          ctx.controls.target.z += dz;
        }
      }
      this.lastAnchor.copy(anchor);
      this.hasAnchor = true;
    }

    return false;
  }
}

/* ─── Registrace výchozích cílů ─────────────────────────────────────────── */

function planetAnchor(id: string) {
  return (ctx: LinkCtx): THREE.Vector3 => {
    const def = PLANETS.find((p) => p.id === id);
    if (!def) return new THREE.Vector3();
    const index = planetIndex(id);
    const t = ctx.reducedMotion ? 0 : ctx.clock.elapsedTime;
    return new THREE.Vector3(...planetPosition(id, index, orbitRadius(def.au), def.speed, t));
  };
}

/** Brána je dítě Jupiteru — obíhá s ním, takže anchor = Jupiter + offset. */
function gateAnchor(ctx: LinkCtx): THREE.Vector3 {
  const def = PLANETS.find((p) => p.id === 'jupiter')!;
  const index = planetIndex('jupiter');
  const t = ctx.reducedMotion ? 0 : ctx.clock.elapsedTime;
  const [jx, jy, jz] = planetPosition('jupiter', index, orbitRadius(def.au), def.speed, t);
  return new THREE.Vector3(
    jx + GATE_JUPITER_OFFSET[0],
    jy + GATE_JUPITER_OFFSET[1],
    jz + GATE_JUPITER_OFFSET[2],
  );
}

function fleetAnchor(ctx: LinkCtx): THREE.Vector3 {
  const t = ctx.reducedMotion ? 0 : ctx.clock.elapsedTime;
  const [fx, fy, fz] = fleetPosition(t);
  return new THREE.Vector3(ctx.earthPos.x + fx, fy, ctx.earthPos.z + fz);
}

function moonAnchor(ctx: LinkCtx): THREE.Vector3 {
  const t = ctx.reducedMotion ? 0 : ctx.clock.elapsedTime;
  const [mx, my, mz] = moonPosition(t);
  return new THREE.Vector3(ctx.earthPos.x + mx, my, ctx.earthPos.z + mz);
}

function arkAnchor(ctx: LinkCtx): THREE.Vector3 {
  const t = ctx.reducedMotion ? 0 : ctx.clock.elapsedTime;
  const [ax, ay, az] = arkPosition(t);
  return new THREE.Vector3(ctx.earthPos.x + ax, ay, ctx.earthPos.z + az);
}

function issobellaAnchor(ctx: LinkCtx): THREE.Vector3 {
  return new THREE.Vector3(
    ctx.earthPos.x + ISSOBELLA_FOCUS[0],
    ISSOBELLA_FOCUS[1],
    ctx.earthPos.z + ISSOBELLA_FOCUS[2],
  );
}

/** Odstup od středu pro orbitální/flotilní fokus — kamera stojí dál od Slunce. */
function radialCam(anchor: THREE.Vector3, out: number, side: number, lift: number): THREE.Vector3 {
  const radial = anchor.clone().normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3().crossVectors(up, radial).normalize();
  return new THREE.Vector3()
    .copy(anchor)
    .addScaledVector(radial, out)
    .addScaledVector(tangent, side)
    .add(new THREE.Vector3(0, lift, 0));
}

export function createDefaultLinkTargets(): LinkTarget[] {
  const targets: LinkTarget[] = [];

  // Země — výchozí bod, sleduje oběžnou dráhu.
  targets.push({
    id: 'earth',
    kind: 'earth',
    accent: '#6fb1ff',
    label: { cs: 'Nová Země', en: 'New Earth' },
    cta: { cs: 'Přiblížit →', en: 'Approach →' },
    size: 4,
    follow: true,
    framing: { offset: [11 / 4, 6 / 4, 19 / 4], minDistance: 1, radius: 1, duration: 1.3 },
    anchor: (ctx) => ctx.earthPos.clone(),
  });

  // Planety s herním vstupem.
  for (const planet of PLANETS) {
    if (!planet.game) continue;
    targets.push({
      id: planet.id,
      kind: 'planet',
      accent: planet.tint,
      label: { cs: planet.name, en: planet.name },
      cta: planet.cta,
      size: planet.size,
      follow: true,
      framing: { radius: 3.4, minDistance: 3.6, duration: 1.8 },
      anchor: planetAnchor(planet.id),
    });
  }

  // Slunce / Hiran.
  targets.push({
    id: 'sun',
    kind: 'sun',
    accent: '#ffd166',
    label: { cs: 'Hiran', en: 'Hiran' },
    cta: { cs: 'Otevřít →', en: 'Open →' },
    framing: {
      duration: 1.6,
      compute: () => ({
        cam: new THREE.Vector3(17, 8, 17),
        target: new THREE.Vector3(0, 0, 0),
        duration: 1.6,
      }),
    },
    anchor: () => new THREE.Vector3(0, 0, 0),
  });

  // Nebeská flotila.
  targets.push({
    id: 'fleet',
    kind: 'fleet',
    accent: '#38bdf8',
    label: { cs: 'Nebeská flotila', en: 'Celestial Fleet' },
    cta: { cs: 'Přiblížit →', en: 'Approach →' },
    size: 2,
    follow: true,
    framing: {
      duration: 1.6,
      compute: (anchor) => ({
        cam: radialCam(anchor, 4.0, 5.2, 1.6),
        target: anchor.clone(),
        duration: 1.6,
      }),
    },
    anchor: fleetAnchor,
  });

  // Měsíc / Matrix.
  targets.push({
    id: 'moon',
    kind: 'moon',
    accent: '#c9c2b6',
    label: { cs: 'Měsíc · Matrix', en: 'Moon · Matrix' },
    cta: { cs: 'Přiblížit →', en: 'Approach →' },
    size: 1.4,
    follow: true,
    framing: {
      duration: 1.6,
      compute: (anchor) => ({
        cam: radialCam(anchor, 3.2, 2.4, 1.6),
        target: anchor.clone(),
        duration: 1.6,
      }),
    },
    anchor: moonAnchor,
  });

  // Jupiter Station (pouť) — kotví na Jupiteru.
  targets.push({
    id: 'jupiter',
    kind: 'station',
    accent: '#ffb46a',
    label: { cs: 'Jupiter Station', en: 'Jupiter Station' },
    cta: { cs: 'Na pouť →', en: 'To fair →' },
    size: 3.6,
    follow: true,
    framing: { radius: 3.4, minDistance: 3.6, duration: 1.8 },
    anchor: planetAnchor('jupiter'),
  });

  // Brána do OASIS — dítě Jupiteru.
  targets.push({
    id: 'gate',
    kind: 'gate',
    accent: '#fcd116',
    label: { cs: 'Brána do OASIS', en: 'Gate to OASIS' },
    cta: { cs: 'Vstoupit ↗', en: 'Enter ↗' },
    size: 2,
    follow: true,
    framing: {
      duration: 1.6,
      compute: (anchor) => ({
        cam: anchor.clone().add(new THREE.Vector3(0, 2, 6)),
        target: anchor.clone(),
        duration: 1.6,
      }),
    },
    anchor: gateAnchor,
  });

  // Archa Království srdce — obíhá Novou Zemi.
  targets.push({
    id: 'archa',
    kind: 'ark',
    accent: '#1d8fb3',
    label: { cs: 'Archa', en: 'The Ark' },
    cta: { cs: 'Otevřít →', en: 'Open →' },
    size: 1,
    follow: true,
    framing: {
      duration: 1.6,
      compute: (anchor) => ({
        cam: anchor.clone().add(new THREE.Vector3(4, 3, 8)),
        target: anchor.clone(),
        duration: 1.6,
      }),
    },
    anchor: arkAnchor,
  });

  // Issobella — L6 science ring.
  targets.push({
    id: 'issobella',
    kind: 'station',
    accent: '#c084fc',
    label: { cs: 'Issobella', en: 'Issobella' },
    cta: { cs: 'Otevřít →', en: 'Open →' },
    size: 1.5,
    follow: true,
    framing: {
      duration: 1.6,
      compute: (anchor) => ({
        cam: anchor.clone().add(new THREE.Vector3(2, 2, 5)),
        target: anchor.clone(),
        duration: 1.6,
      }),
    },
    anchor: issobellaAnchor,
  });

  return targets;
}

/**
 * Linky mezi body — jediný seznam. Kreslí je `LinkLayer`, engine je jen drží,
 * aby „co je s čím spojené“ bylo na jednom místě.
 */
export const DEFAULT_LINK_EDGES: LinkEdge[] = [
  { from: 'earth', to: 'moon', kind: 'orbit' },
  { from: 'earth', to: 'fleet', kind: 'orbit' },
  { from: 'earth', to: 'issobella', kind: 'orbit' },
  { from: 'earth', to: 'archa', kind: 'orbit' },
  { from: 'earth', to: 'jupiter', kind: 'route' },
  { from: 'jupiter', to: 'gate', kind: 'orbit' },
];

/* ─── Singleton ─────────────────────────────────────────────────────────── */

let globalLinkEngine: LinkEngine | null = null;

export function getGlobalLinkEngine(): LinkEngine {
  if (!globalLinkEngine) {
    globalLinkEngine = new LinkEngine();
    for (const t of createDefaultLinkTargets()) globalLinkEngine.register(t);
    globalLinkEngine.setEdges(DEFAULT_LINK_EDGES);
  }
  return globalLinkEngine;
}

export function useLinkEngine() {
  return getGlobalLinkEngine();
}

/** Re-render HUD při změně fokusu (malá frekvence, ne 60×/s). */
export function useLinkFocus(): string {
  const engine = getGlobalLinkEngine();
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => engine.subscribe(force), [engine, force]);
  return engine.getCurrentFocus();
}
