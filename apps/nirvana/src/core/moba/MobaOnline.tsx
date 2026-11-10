'use client';

/**
 * MOBA „PRVNÍ SVĚT" — **online 5 na 5**.
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
import { SPELL_BY_KEY } from './keys';
import { spellsForAvatar, type AspectId } from './spells';
import { MobaStage } from './MobaStage';
import { MobaXr } from './MobaXr';
import { XR } from '@react-three/xr';
import type { XRStore } from '@react-three/xr';
import { statsFromSnapshot, type MobaStats } from './MobaGame';
import { snapAim, speedFromSnapshot, type BattleSpellId, type ItemId } from './sim';
import { MobaFxOverlay, pushEmote, type DamageFloater } from './MobaFxOverlay';
import { mobaAudio, unlockMobaAudio } from './audio';
import { useMobaAudio } from './useMobaAudio';
import type { MobaSnapshot } from './sim';
import { canvasDpr } from '@/core/design/dpr';
import { isGamePaused } from '@/core/games/pause';

/** Odchylka, od které se predikce „teleportuje" na server (m). */
const PREDICT_SNAP = 1.6;

const EMOTE_LABELS = ['👍', '⚠️', '🎯', '🛡️'];

const MobaChart = {
  connecting: { cs: 'Připojuji se k Zemi…', en: 'Connecting to Earth…' },
  waiting: { cs: 'Čekám na hráče — volná sedla doplní boti.', en: 'Waiting for players — bots fill empty seats.' },
  countdown: { cs: 'Zápas začíná', en: 'Match starting' },
  offline: { cs: 'Server neodpovídá. Zkus to znovu.', en: 'Server is not responding. Try again.' },
};

export function MobaOnline({
  heroId,
  battleSpell,
  onStats,
  onEnd,
  onPhase,
  debug,
  buyRequest,
  sellRequest,
  buybackRequest,
  talentRequest,
  autoAim,
  xr = false,
  xrStore,
  watch = null,
  aspect = 'a',
}: {
  heroId: number;
  /** Battle spell vybraný před zápasem (jde do `join`). */
  battleSpell?: BattleSpellId;
  onStats: (stats: MobaStats) => void;
  onEnd?: (winner: 'blue' | 'red') => void;
  onPhase?: (phase: 'connecting' | 'waiting' | 'countdown' | 'running' | 'ended' | 'offline') => void;
  debug?: boolean;
  /** Obchod: stránka sem zapíše item, ovladač ho pošle serveru. */
  buyRequest?: React.MutableRefObject<ItemId | null>;
  /** Prodej: stránka sem zapíše item, ovladač ho pošle serveru. */
  sellRequest?: React.MutableRefObject<ItemId | null>;
  /** Buyback: stránka sem zapíše `true`, ovladač pošle serveru. */
  buybackRequest?: React.MutableRefObject<boolean>;
  /** Talent: stránka sem zapíše volbu, ovladač ji pošle serveru. */
  talentRequest?: React.MutableRefObject<{ tier: number; pick: number } | null>;
  /** Auto-aim (mobil): kouzlo se přichytí na blízkého nepřítele. */
  autoAim?: boolean;
  /** Ve VR kameru drží headset; vstup jde přes `MobaXr`. */
  xr?: boolean;
  xrStore?: XRStore;
  /** Id místnosti, na kterou se jen díváme (`?watch=`); `null` = hrajeme. */
  watch?: string | null;
  /** Aspekt kouzel vybraný před zápasem. */
  aspect?: AspectId;
}) {
  const snapshotRef = useRef<MobaSnapshot | null>(null);
  const selfPose = useRef<{ x: number; z: number; active: boolean } | null>(null);
  const floaters = useRef<DamageFloater[]>([]);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const { youPlayerId, spectator } = useNet();
  const followId = watch || spectator ? '' : (youPlayerId ?? 'hero-you');

  const world = (
    <>
      <OnlineController
        heroId={heroId}
        onStats={onStats}
        onEnd={onEnd}
        onPhase={onPhase}
        debug={debug}
        buyRequest={buyRequest}
        sellRequest={sellRequest}
        buybackRequest={buybackRequest}
        talentRequest={talentRequest}
        autoAim={autoAim}
        floaters={floaters}
        snapshotRef={snapshotRef}
        selfPose={selfPose}
        watch={watch}
        aspect={aspect}
      />
      <MobaStage
        snapshotRef={snapshotRef}
        youId={followId}
        selfPose={selfPose}
        floaters={floaters}
        cameraRef={cameraRef}
        xr={xr}
      />
      <OnlineAudioBridge snapshotRef={snapshotRef} youId={followId || null} />
      {xr && <MobaXr snapshotRef={snapshotRef} youId={followId} active />}
    </>
  );

  return (
    <>
      <MobaFxOverlay floaters={floaters} cameraRef={cameraRef} />
      <Canvas
        dpr={canvasDpr(1.8)}
        shadows={false}
        camera={{ position: [0, 20, 17], fov: 42, near: 0.5, far: 220 }}
        gl={{ antialias: true }}
      >
        {xrStore ? <XR store={xrStore}>{world}</XR> : world}
      </Canvas>
    </>
  );
}

function OnlineAudioBridge({
  snapshotRef,
  youId,
}: {
  snapshotRef: React.MutableRefObject<MobaSnapshot | null>;
  youId: string | null;
}) {
  useMobaAudio(snapshotRef, youId);
  return null;
}

function OnlineController({
  heroId,
  battleSpell,
  onStats,
  onEnd,
  onPhase,
  debug,
  buyRequest,
  sellRequest,
  buybackRequest,
  talentRequest,
  autoAim,
  floaters,
  snapshotRef,
  selfPose,
  watch = null,
  aspect = 'a',
}: {
  heroId: number;
  /** Battle spell vybraný před zápasem (jde do `join`). */
  battleSpell?: BattleSpellId;
  onStats: (stats: MobaStats) => void;
  onEnd?: (winner: 'blue' | 'red') => void;
  onPhase?: (phase: 'connecting' | 'waiting' | 'countdown' | 'running' | 'ended' | 'offline') => void;
  debug?: boolean;
  buyRequest?: React.MutableRefObject<ItemId | null>;
  sellRequest?: React.MutableRefObject<ItemId | null>;
  buybackRequest?: React.MutableRefObject<boolean>;
  talentRequest?: React.MutableRefObject<{ tier: number; pick: number } | null>;
  autoAim?: boolean;
  floaters: React.MutableRefObject<DamageFloater[]>;
  snapshotRef: React.MutableRefObject<MobaSnapshot | null>;
  selfPose: React.MutableRefObject<{ x: number; z: number; active: boolean } | null>;
  /** Id místnosti, na kterou se jen díváme (`?watch=`). */
  watch?: string | null;
  /** Aspekt kouzel vybraný před zápasem. */
  aspect?: AspectId;
}) {
  const { camera, gl } = useThree();
  const { subscribe, joinGame, spectateRoom, leaveRoom, sendMobaInput, sendBuy, sendSell, sendWard, sendSentry, sendBattleSpell, sendRecall, sendBuyback, sendUseItem, sendTalent, connected, youPlayerId, spectator } = useNet();
  const keys = useRef(new Set<string>());
  const pointer = useRef({ x: 0, y: 0 });
  const attack = useRef(false);
  const queuedCast = useRef<{ slot: 'Q' | 'W' | 'E' | 'R'; at: number } | null>(null);
  const queuedWard = useRef(false);
  const queuedSentry = useRef(false);
  const queuedBattleSpell = useRef(false);
  const queuedRecall = useRef(false);
  const queuedItem = useRef<ItemId | null>(null);
  const lastStats = useRef(0);
  const endedSent = useRef(false);
  const serverNow = useRef({ offset: 0, at: Date.now() });
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const castPoint = useMemo(() => new THREE.Vector3(), []);
  const spells = useMemo(() => spellsForAvatar(heroId, aspect), [heroId, aspect]);
  const phaseRef = useRef<string>('connecting');
  const lastFrame = useRef(0);

  // ── připojení a odběr snapshotů ─────────────────────────────────────
  useEffect(() => {
    if (!connected) {
      onPhase?.('offline');
      return;
    }
    onPhase?.('connecting');
    if (watch) spectateRoom('moba', watch);
    else joinGame('moba', heroId, battleSpell, undefined, aspect);
    return () => leaveRoom();
  }, [connected, heroId, joinGame, spectateRoom, leaveRoom, onPhase, battleSpell, watch, aspect]);

  useEffect(() => {
    return subscribe((message) => {
      if (message.t === 'event' && message.event.kind === 'emote') {
        const event = message.event;
        const hero = snapshotRef.current?.heroes.find((candidate) => candidate.id === event.playerId);
        const label = EMOTE_LABELS[event.emote] ?? '👍';
        if (hero) pushEmote(floaters.current, hero.x, 2.6, hero.z, label, performance.now());
        return;
      }
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
      unlockMobaAudio();
      keys.current.add(event.code);
      // Stejná mapa jako sólo: slot W je klávesa F. KeyW je chůze vpřed.
      const slot = SPELL_BY_KEY[event.code];
      if (slot) queuedCast.current = { slot, at: Date.now() };
      // G = ward na zem (stejná klávesa jako v sólu)
      if (event.code === 'KeyG') queuedWard.current = true;
      if (event.code === 'KeyH') queuedSentry.current = true;
      if (event.code === 'KeyV') queuedBattleSpell.current = true;
      if (event.code === 'KeyB') queuedRecall.current = true;
      // 1–6 = aktivní item (id vezmi ze snapshotu, ne z lokálního stavu)
      const digit = /^Digit([1-6])$/.exec(event.code);
      if (digit) {
        const slotIndex = Number(digit[1]) - 1;
        const hero = snapshotRef.current?.heroes.find((candidate) => candidate.id === youPlayerId);
        const item = hero?.items[slotIndex];
        if (item) queuedItem.current = item;
      }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyG'].includes(event.code)) event.preventDefault();
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const move = (event: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      pointer.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };
    const downPointer = (event: PointerEvent) => {
      unlockMobaAudio();
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
    if (isGamePaused()) return;
    const watching = Boolean(watch) || spectator;
    const forward = watching ? 0 : (keys.current.has('KeyW') ? 1 : 0) - (keys.current.has('KeyS') ? 1 : 0);
    const strafe = watching ? 0 : (keys.current.has('KeyD') ? 1 : 0) - (keys.current.has('KeyA') ? 1 : 0);

    raycaster.setFromCamera(new THREE.Vector2(pointer.current.x, pointer.current.y), camera);
    const hit = raycaster.ray.intersectPlane(groundPlane, castPoint);
    // kouzlo starší než 400 ms zahodit (hráč mezitím mohl kliknout jinam)
    if (queuedCast.current && Date.now() - queuedCast.current.at > 400) queuedCast.current = null;
    const youNow = snapshotRef.current?.heroes.find((hero) => hero.id === youPlayerId);
    let aimNow = autoAim && hit && youNow
      ? snapAim(snapshotRef.current?.heroes ?? [], youNow.team, castPoint.x, castPoint.z)
      : null;
    if (aimNow && queuedCast.current && youNow) {
      const spell = spells.find((candidate) => candidate.slot === queuedCast.current!.slot);
      if (spell && spell.range > 0 && Math.hypot(aimNow.x - youNow.x, aimNow.z - youNow.z) > spell.range + spell.radius) {
        aimNow = null;
      }
    }
    const cast = !watching && queuedCast.current && hit
      ? { slot: queuedCast.current.slot, x: aimNow?.x ?? castPoint.x, z: aimNow?.z ?? castPoint.z }
      : null;

    // vstup na server (hook sám omezuje na 20 Hz). Kouzlo se maže jen když
    // se opravdu odeslalo — jinak by ho throttle tiše zahodil (reálná chyba).
    // Divák nic z toho neposílá: jinak by nakupoval a sesílal kouzla.
    if (!watching) {
      if (cast) {
        const spell = spells.find((candidate) => candidate.slot === cast.slot);
        if (spell) mobaAudio.spell(spell.color);
      }
      const sent = sendMobaInput({ moveX: strafe, moveZ: -forward, attack: attack.current, cast });
      if (sent && cast) queuedCast.current = null;

      // obchod: požadavek ze stránky pošli serveru (rozhodne o zlatě)
      if (buyRequest?.current) {
        sendBuy(buyRequest.current);
        buyRequest.current = null;
      }
      if (sellRequest?.current) {
        sendSell(sellRequest.current);
        sellRequest.current = null;
      }
      if (queuedWard.current) {
        if (hit) queuedWard.current = false;
        if (hit) sendWard(castPoint.x, castPoint.z);
      }
      if (queuedRecall.current) {
        queuedRecall.current = false;
        sendRecall();
      }
      if (queuedBattleSpell.current) {
        if (hit) queuedBattleSpell.current = false;
        if (hit) sendBattleSpell(castPoint.x, castPoint.z);
      }
      if (queuedSentry.current) {
        if (hit) queuedSentry.current = false;
        if (hit) sendSentry(castPoint.x, castPoint.z);
      }
      if (queuedItem.current) {
        const item = queuedItem.current;
        if (hit) queuedItem.current = null;
        if (hit) sendUseItem(item, castPoint.x, castPoint.z);
      }
      if (buybackRequest?.current) {
        buybackRequest.current = false;
        sendBuyback();
      }
      if (talentRequest?.current) {
        const { tier, pick } = talentRequest.current;
        talentRequest.current = null;
        sendTalent(tier, pick);
      }
    }

    const snapshot = snapshotRef.current;
    if (!snapshot) return;

    // ── predikce vlastního pohybu ────────────────────────────────────
    // Server posílá 15 Hz; bez predikce by se vlastní postava cukala.
    // Predikuje se JEN pohyb — poškození a smrt rozhoduje server.
    const you = snapshot.heroes.find((hero) => hero.id === youPlayerId) ?? null;
    if (you) {
      const frameNow = Date.now();
      const frameDt = Math.min(0.1, (frameNow - lastFrame.current) / 1000 || 1 / 60);
      lastFrame.current = frameNow;
      const pose = selfPose.current ?? { x: you.x, z: you.z, active: you.alive };
      const length = Math.hypot(strafe, -forward);
      if (you.alive && length > 0.05) {
        const serverTime = frameNow + serverNow.current.offset;
        const speed = speedFromSnapshot(you, aspect, serverTime);
        pose.x += (strafe / length) * speed * frameDt;
        pose.z += (-forward / length) * speed * frameDt;
      }
      const error = Math.hypot(pose.x - you.x, pose.z - you.z);
      if (!you.alive || error > PREDICT_SNAP) {
        pose.x = you.x;
        pose.z = you.z;
      } else {
        // plynulé dorovnání (stejná logika jako u arény)
        pose.x += (you.x - pose.x) * 0.18;
        pose.z += (you.z - pose.z) * 0.18;
      }
      pose.active = you.alive;
      selfPose.current = pose;
    }

    const now = Date.now();
    if (now - lastStats.current > 200) {
      lastStats.current = now;
      const serverTime = now + serverNow.current.offset;
      onStats(
        statsFromSnapshot(
          snapshot,
          watching ? '' : (youPlayerId ?? snapshot.heroes[0]?.id ?? ''),
          spells.map((spell) => ({
            slot: spell.slot,
            name: spell.name,
            school: spell.school,
            cooldownMs: spell.cooldownMs,
            mana: spell.mana,
            color: spell.color,
          })),
          serverTime,
        ),
      );
      if (snapshot.ended && !endedSent.current && !watching) {
        endedSent.current = true;
        onEnd?.(snapshot.ended);
      }
    }

    if (debug) {
      // Háček čte **refy**, ne hodnotu z tohoto snímku: když prohlížeč
      // uspí kartu na pozadí, `useFrame` přestane běžet a háček by držel
      // starý snapshot (v E2E to vypadalo, že hráč nic nevidí).
      (window as unknown as Record<string, unknown>).__mobaDebug = () => {
        const snap = snapshotRef.current;
        if (!snap) return { phase: phaseRef.current, you: youPlayerId, heroes: [], time: 0 };
        return {
          phase: phaseRef.current,
          you: youPlayerId,
          time: Math.round(snap.time),
          wave: snap.wave,
          heroes: snap.heroes,
          minions: snap.minions.length,
          towers: snap.towers.map((tower) => ({ id: tower.id, hp: Math.round(tower.hp) })),
          nodes: snap.nodes.map((node) => ({ key: node.key, owner: node.owner })),
          ended: snap.ended,
          predicted: selfPose.current,
        };
      };
    }
  });

  return null;
}

export const MOBA_ONLINE_COPY = MobaChart;
