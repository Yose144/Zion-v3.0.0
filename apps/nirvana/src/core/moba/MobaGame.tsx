'use client';

/**
 * MOBA „PRVNÍ SVĚT" — sólo 1v1 proti botovi.
 *
 * Ovladač běží **uvnitř `<Canvas>`**, protože potřebuje kameru pro převod
 * kurzoru na bod na zemi. Simulace je v refu, scéna (`MobaStage`) jen čte
 * snapshot — jediná pravidla jsou v `sim.ts`.
 *
 * Online varianta (`MobaOnline`) používá stejnou scénu, ale snapshot chodí
 * ze serveru; proto mezi nimi není žádná duplikace fyziky ani kouzel.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { buyItem, createMoba, mobaSnapshot, stepMoba, NO_INPUT, type ItemId, type MobaSnapshot, type MobaState } from './sim';
import { mobaAudio, unlockMobaAudio } from './audio';
import { useMobaAudio } from './useMobaAudio';
import { MobaStage } from './MobaStage';
import type { SpellSlot } from './spells';
import { SPELL_BY_KEY } from './keys';

const STEP = 1 / 30;

export interface MobaStats {
  snapshot: MobaSnapshot;
  /** Id hrdiny, kterého ovládáš (pro minimapu a zvýraznění). */
  youId: string | null;
  gold: number;
  items: ItemId[];
  spells: { slot: SpellSlot; name: string; cooldown: number; cooldownMs: number; mana: number; color: string }[];
  playerHp: number;
  playerMaxHp: number;
  playerMana: number;
  playerMaxMana: number;
  playerLevel: number;
  kills: number;
  deaths: number;
  respawnIn: number;
  ended: 'blue' | 'red' | null;
  nodeOwner: { key: string; owner: 'blue' | 'red' | null }[];
}

/** Metadata kouzel pro HUD (cooldown se dopočítá ze snapshotu). */
export interface SpellMeta {
  slot: SpellSlot;
  name: string;
  cooldownMs: number;
  mana: number;
  color: string;
}

export interface MobaProps {
  playerHeroId: number;
  enemyHeroId: number;
  running: boolean;
  onStats: (stats: MobaStats) => void;
  onEnd?: (winner: 'blue' | 'red') => void;
  /** Ladicí háček pro headless testy (`?mobaDebug=1`). */
  debug?: boolean;
  /** Obchod: stránka sem zapíše item, ovladač ho hned koupí. */
  buyRequest?: React.MutableRefObject<ItemId | null>;
}

/** Sestaví HUD data ze snapshotu — společná pro sólo i online. */
export function statsFromSnapshot(
  snapshot: MobaSnapshot,
  youId: string,
  spells: SpellMeta[],
  now: number,
): MobaStats {
  const you = snapshot.heroes.find((hero) => hero.id === youId) ?? snapshot.heroes[0];
  return {
    snapshot,
    youId,
    spells: spells.map((spell) => ({
      slot: spell.slot,
      name: spell.name,
      cooldown: Math.max(0, (you?.cooldowns?.[spell.slot] ?? 0) - now),
      cooldownMs: spell.cooldownMs,
      mana: spell.mana,
      color: spell.color,
    })),
    playerHp: you?.hp ?? 0,
    playerMaxHp: you?.maxHp ?? 1,
    playerMana: you?.mana ?? 0,
    playerMaxMana: you?.maxMana ?? 1,
    gold: you?.gold ?? 0,
    items: you?.items ?? [],
    playerLevel: you?.level ?? 1,
    kills: you?.kills ?? 0,
    deaths: you?.deaths ?? 0,
    respawnIn: you?.respawnIn ?? 0,
    ended: snapshot.ended,
    nodeOwner: snapshot.nodes.map((node) => ({ key: node.key, owner: node.owner })),
  };
}

export function MobaGame({ playerHeroId, enemyHeroId, running, onStats, onEnd, debug, buyRequest }: MobaProps) {
  const snapshotRef = useRef<MobaSnapshot | null>(null);
  return (
    <Canvas
      dpr={[1, 1.8]}
      shadows={false}
      camera={{ position: [0, 20, 17], fov: 42, near: 0.5, far: 220 }}
      gl={{ antialias: true }}
    >
      <SoloController
        playerHeroId={playerHeroId}
        enemyHeroId={enemyHeroId}
        running={running}
        onStats={onStats}
        onEnd={onEnd}
        debug={debug}
        buyRequest={buyRequest}
        snapshotRef={snapshotRef}
      />
      <MobaStage snapshotRef={snapshotRef} youId="hero-you" />
      <MobaAudioBridge snapshotRef={snapshotRef} youId="hero-you" />
    </Canvas>
  );
}

function MobaAudioBridge({ snapshotRef, youId }: { snapshotRef: React.MutableRefObject<MobaSnapshot | null>; youId: string | null }) {
  useMobaAudio(snapshotRef, youId);
  return null;
}

function SoloController({
  playerHeroId,
  enemyHeroId,
  running,
  onStats,
  onEnd,
  debug,
  buyRequest,
  snapshotRef,
}: MobaProps & { snapshotRef: React.MutableRefObject<MobaSnapshot | null> }) {
  const { camera, gl } = useThree();
  const state = useRef<MobaState | null>(null);
  const keys = useRef(new Set<string>());
  const pointer = useRef({ x: 0, y: 0 });
  const attack = useRef(false);
  const queuedCast = useRef<{ slot: SpellSlot } | null>(null);
  const lastStats = useRef(0);
  const lastTick = useRef(0);
  const endedSent = useRef(false);
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const castPoint = useMemo(() => new THREE.Vector3(), []);
  const spellList = useRef<SpellMeta[]>([]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      unlockMobaAudio();
      keys.current.add(event.code);
      // Kouzla nejsou Q/W/E/R: `W` je pohyb vpřed (viz `core/moba/keys.ts`).
      const slot = SPELL_BY_KEY[event.code];
      if (slot) queuedCast.current = { slot };
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyQ', 'KeyE', 'KeyR', 'KeyF'].includes(event.code)) {
        event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const move = (event: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      pointer.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };
    const downPointer = (event: PointerEvent) => {
      unlockMobaAudio();
      // Dotyk (a klik bez předchozího pohybu) neposílá `pointermove`, takže
      // bez tohohle by se kouzlo seslalo na poslední staré místo.
      move(event);
      if (event.button === 0) attack.current = true;
    };
    const upPointer = () => {
      attack.current = false;
    };
    const blur = () => {
      keys.current.clear();
      attack.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    gl.domElement.addEventListener('pointermove', move);
    gl.domElement.addEventListener('pointerdown', downPointer);
    window.addEventListener('pointerup', upPointer);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      gl.domElement.removeEventListener('pointermove', move);
      gl.domElement.removeEventListener('pointerdown', downPointer);
      window.removeEventListener('pointerup', upPointer);
    };
  }, [gl]);

  useFrame(() => {
    if (!running) return;
    const now = performance.now();
    if (!state.current) state.current = createMoba(playerHeroId, enemyHeroId, now);
    const you = state.current.heroes[0]!;

    const dt = Math.min(0.1, (now - lastTick.current) / 1000 || STEP);
    lastTick.current = now;

    const forward = (keys.current.has('KeyW') ? 1 : 0) - (keys.current.has('KeyS') ? 1 : 0);
    const strafe = (keys.current.has('KeyD') ? 1 : 0) - (keys.current.has('KeyA') ? 1 : 0);

    raycaster.setFromCamera(new THREE.Vector2(pointer.current.x, pointer.current.y), camera);
    const hit = raycaster.ray.intersectPlane(groundPlane, castPoint);
    const cast = queuedCast.current && hit ? { slot: queuedCast.current.slot, x: castPoint.x, z: castPoint.z } : null;
    queuedCast.current = null;

    if (cast) {
      const spell = you.spells.find((candidate) => candidate.slot === cast.slot);
      if (spell) mobaAudio.spell(spell.color);
    }
    const input = { moveX: strafe, moveZ: -forward, cast, attack: attack.current };
    const inputs = { [you.id]: input };
    for (let elapsed = 0; elapsed < dt; elapsed += STEP) {
      stepMoba(state.current, STEP, inputs, now + elapsed * 1000);
    }

    // obchod: požadavek ze stránky hned aplikuj (server/sólo rozhodne o zlatě)
    if (buyRequest?.current) {
      const item = buyRequest.current;
      buyRequest.current = null;
      if (buyItem(you, item)) mobaAudio.buy();
    }

    // Mlha války: kreslíme jen to, co náš tým vidí (stejné pravidlo jako server).
    const snapshot = mobaSnapshot(state.current, you.team);
    snapshotRef.current = snapshot;
    spellList.current = you.spells.map((spell) => ({
      slot: spell.slot,
      name: spell.name,
      cooldownMs: spell.cooldownMs,
      mana: spell.mana,
      color: spell.color,
    }));

    if (now - lastStats.current > 200) {
      lastStats.current = now;
      onStats(statsFromSnapshot(snapshot, you.id, spellList.current, state.current.now));
      if (snapshot.ended && !endedSent.current) {
        endedSent.current = true;
        onEnd?.(snapshot.ended);
      }
    }

    if (debug) {
      (window as unknown as Record<string, unknown>).__mobaDebug = () => {
        const current = state.current!;
        // Debug háček vrací **nefiltrovaný** snapshot — testy potřebují
        // videt soupeře i mimo dosah (a je to jen v `?mobaDebug=1`).
        const snapshotNow = mobaSnapshot(current);
        return {
          camera: { x: Math.round(camera.position.x), z: Math.round(camera.position.z), y: Math.round(camera.position.y) },
          time: Math.round(snapshotNow.time),
          wave: snapshotNow.wave,
          heroes: snapshotNow.heroes,
          minions: snapshotNow.minions.length,
          towers: snapshotNow.towers.map((tower) => ({ id: tower.id, hp: Math.round(tower.hp) })),
          nodes: snapshotNow.nodes.map((node) => ({ key: node.key, owner: node.owner })),
          ended: snapshotNow.ended,
          spells: current.heroes[0]!.spells.map((spell) => ({
            slot: spell.slot,
            name: spell.name,
            damage: spell.damage,
            mana: spell.mana,
            cooldownMs: spell.cooldownMs,
          })),
          cast(slot: SpellSlot, x: number, z: number) {
            const hero = current.heroes[0]!;
            hero.cooldowns[slot] = 0;
            hero.mana = hero.maxMana;
            stepMoba(current, STEP, { [hero.id]: { ...NO_INPUT, cast: { slot, x, z } } }, current.now + 16);
          },
          teleport(x: number, z: number) {
            current.heroes[0]!.x = x;
            current.heroes[0]!.z = z;
          },
          damageNexus(amount: number) {
            const nexus = current.towers.find((tower) => tower.id === 'red-nexus');
            if (nexus) nexus.hp = Math.max(0, nexus.hp - amount);
          },
        };
      };
    }
  });

  return null;
}
