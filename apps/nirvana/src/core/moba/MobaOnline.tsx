'use client';

/**
 * MOBA „PRVNÍ SVĚT" — **online 2v2**.
 *
 * Server (`apps/nirvana-net/src/moba.ts`) drží simulaci; klient posílá jen
 * vstup a kreslí snapshoty. Žádná predikce pohybu: u MOBA je důležitější
 * shoda se serverem než plynulost vlastní postavy — kdyby klient počítal
 * poškození sám, hráči by se hádali o čísla.
 *
 * Volná sedla doplní boti, takže se dá hrát i s jedním člověkem.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useNet } from '@/core/net/useNet';
import { spellsForAvatar } from './spells';
import { MobaStage } from './MobaStage';
import { statsFromSnapshot, type MobaStats } from './MobaGame';
import type { MobaSnapshot } from './sim';

const MobaChart = {
  connecting: { cs: 'Připojuji se k Zemi…', en: 'Connecting to Earth…' },
  waiting: { cs: 'Čekám na hráče — volná sedla doplní boti.', en: 'Waiting for players — bots fill empty seats.' },
  countdown: { cs: 'Zápas začíná', en: 'Match starting' },
  offline: { cs: 'Server neodpovídá. Zkus to znovu.', en: 'Server is not responding. Try again.' },
};

export function MobaOnline({
  heroId,
  onStats,
  onEnd,
  onPhase,
  debug,
}: {
  heroId: number;
  onStats: (stats: MobaStats) => void;
  onEnd?: (winner: 'blue' | 'red') => void;
  onPhase?: (phase: 'connecting' | 'waiting' | 'countdown' | 'running' | 'ended' | 'offline') => void;
  debug?: boolean;
}) {
  const snapshotRef = useRef<MobaSnapshot | null>(null);
  const { youPlayerId } = useNet();

  return (
    <Canvas
      dpr={[1, 1.8]}
      shadows={false}
      camera={{ position: [0, 20, 17], fov: 42, near: 0.5, far: 220 }}
      gl={{ antialias: true }}
    >
      <OnlineController heroId={heroId} onStats={onStats} onEnd={onEnd} onPhase={onPhase} debug={debug} snapshotRef={snapshotRef} />
      <MobaStage snapshotRef={snapshotRef} youId={youPlayerId ?? 'hero-you'} />
    </Canvas>
  );
}

function OnlineController({
  heroId,
  onStats,
  onEnd,
  onPhase,
  debug,
  snapshotRef,
}: {
  heroId: number;
  onStats: (stats: MobaStats) => void;
  onEnd?: (winner: 'blue' | 'red') => void;
  onPhase?: (phase: 'connecting' | 'waiting' | 'countdown' | 'running' | 'ended' | 'offline') => void;
  debug?: boolean;
  snapshotRef: React.MutableRefObject<MobaSnapshot | null>;
}) {
  const { camera, gl } = useThree();
  const { subscribe, joinGame, leaveRoom, sendMobaInput, connected, youPlayerId } = useNet();
  const keys = useRef(new Set<string>());
  const pointer = useRef({ x: 0, y: 0 });
  const attack = useRef(false);
  const queuedCast = useRef<{ slot: 'Q' | 'W' | 'E' | 'R' } | null>(null);
  const lastStats = useRef(0);
  const endedSent = useRef(false);
  const serverNow = useRef({ offset: 0, at: Date.now() });
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const castPoint = useMemo(() => new THREE.Vector3(), []);
  const spells = useMemo(() => spellsForAvatar(heroId), [heroId]);
  const phaseRef = useRef<string>('connecting');

  // ── připojení a odběr snapshotů ─────────────────────────────────────
  useEffect(() => {
    if (!connected) {
      onPhase?.('offline');
      return;
    }
    onPhase?.('connecting');
    joinGame('moba', heroId);
    return () => leaveRoom();
  }, [connected, heroId, joinGame, leaveRoom, onPhase]);

  useEffect(() => {
    return subscribe((message) => {
      if (message.t !== 'snapshot' || message.game !== 'moba' || !message.moba) return;
      snapshotRef.current = message.moba;
      if (typeof message.time === 'number') {
        serverNow.current = { offset: message.time - Date.now(), at: Date.now() };
      }
      const phase =
        message.state === 'running'
          ? 'running'
          : message.state === 'ended'
            ? 'ended'
            : message.state === 'countdown'
              ? 'countdown'
              : 'waiting';
      if (phase !== phaseRef.current) {
        phaseRef.current = phase;
        onPhase?.(phase);
      }
    });
  }, [subscribe, snapshotRef, onPhase]);

  // ── vstup ───────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      keys.current.add(event.code);
      if (event.code === 'KeyQ') queuedCast.current = { slot: 'Q' };
      if (event.code === 'KeyW') queuedCast.current = { slot: 'W' };
      if (event.code === 'KeyE') queuedCast.current = { slot: 'E' };
      if (event.code === 'KeyR') queuedCast.current = { slot: 'R' };
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR'].includes(event.code)) event.preventDefault();
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const move = (event: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      pointer.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };
    const downPointer = (event: PointerEvent) => {
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
    const forward = (keys.current.has('KeyW') ? 1 : 0) - (keys.current.has('KeyS') ? 1 : 0);
    const strafe = (keys.current.has('KeyD') ? 1 : 0) - (keys.current.has('KeyA') ? 1 : 0);

    raycaster.setFromCamera(new THREE.Vector2(pointer.current.x, pointer.current.y), camera);
    const hit = raycaster.ray.intersectPlane(groundPlane, castPoint);
    const cast = queuedCast.current && hit ? { slot: queuedCast.current.slot, x: castPoint.x, z: castPoint.z } : null;
    queuedCast.current = null;

    // vstup na server (hook sám omezuje na 20 Hz)
    sendMobaInput({ moveX: strafe, moveZ: -forward, attack: attack.current, cast });

    const snapshot = snapshotRef.current;
    if (!snapshot) return;

    const now = Date.now();
    if (now - lastStats.current > 200) {
      lastStats.current = now;
      const serverTime = now + serverNow.current.offset;
      onStats(
        statsFromSnapshot(
          snapshot,
          youPlayerId ?? snapshot.heroes[0]?.id ?? '',
          spells.map((spell) => ({
            slot: spell.slot,
            name: spell.name,
            cooldownMs: spell.cooldownMs,
            mana: spell.mana,
            color: spell.color,
          })),
          serverTime,
        ),
      );
      if (snapshot.ended && !endedSent.current) {
        endedSent.current = true;
        onEnd?.(snapshot.ended);
      }
    }

    if (debug) {
      (window as unknown as Record<string, unknown>).__mobaDebug = () => ({
        phase: phaseRef.current,
        you: youPlayerId,
        time: Math.round(snapshot.time),
        wave: snapshot.wave,
        heroes: snapshot.heroes,
        minions: snapshot.minions.length,
        towers: snapshot.towers.map((tower) => ({ id: tower.id, hp: Math.round(tower.hp) })),
        nodes: snapshot.nodes.map((node) => ({ key: node.key, owner: node.owner })),
        ended: snapshot.ended,
      });
    }
  });

  return null;
}

export const MOBA_ONLINE_COPY = MobaChart;
