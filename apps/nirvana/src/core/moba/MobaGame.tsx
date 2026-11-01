'use client';

/**
 * MOBA „PRVNÍ SVĚT" — 3D scéna a ovládání.
 *
 * Simulace (`sim.ts`) běží v refu a scéna jen čte, co spočítala — stejné
 * pravidlo jako u arény: 30 Hz logika, 60 Hz kreslení, žádný React state
 * v herní smyčce (jinak by se překresloval celý strom).
 *
 * Ovládání je klasické MOBA: WASD pohyb, Q/W/E/R kouzlo na kurzor,
 * držené levé tlačítko = útok. Kamera je izometrická a sleduje hrdinu.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AvatarModel } from '@/core/avatars/AvatarModel';
import { avatarLook } from '@/core/avatars/kit';
import { createMoba, stepMoba, mobaSnapshot, NO_INPUT, type MobaSnapshot, type MobaState } from './sim';
import { LANES, NODE_SITES } from './map';
import type { SpellSlot } from './spells';

const STEP = 1 / 30;

export interface MobaStats {
  snapshot: MobaSnapshot;
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

interface Props {
  playerHeroId: number;
  enemyHeroId: number;
  running: boolean;
  onStats: (stats: MobaStats) => void;
  onEnd?: (winner: 'blue' | 'red') => void;
  /** Ladicí háček pro headless testy (`?mobaDebug=1`). */
  debug?: boolean;
}

export function MobaGame({ playerHeroId, enemyHeroId, running, onStats, onEnd, debug }: Props) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      shadows={false}
      camera={{ position: [0, 26, 22], fov: 42, near: 0.5, far: 220 }}
      gl={{ antialias: true }}
    >
      <Scene
        playerHeroId={playerHeroId}
        enemyHeroId={enemyHeroId}
        running={running}
        onStats={onStats}
        onEnd={onEnd}
        debug={debug}
      />
    </Canvas>
  );
}

function Scene({ playerHeroId, enemyHeroId, running, onStats, onEnd, debug }: Props) {
  const { camera, gl, scene } = useThree();
  const state = useRef<MobaState | null>(null);
  const player = useRef<THREE.Group>(null);
  const foe = useRef<THREE.Group>(null);
  const towerRefs = useRef<(THREE.Group | null)[]>([]);
  const nodeRefs = useRef<(THREE.Group | null)[]>([]);
  const minionMesh = useRef<THREE.InstancedMesh>(null);
  const projectileMesh = useRef<THREE.InstancedMesh>(null);
  const effectMesh = useRef<THREE.InstancedMesh>(null);
  const keys = useRef(new Set<string>());
  const pointer = useRef({ x: 0, y: 0 });
  const attack = useRef(false);
  const queuedCast = useRef<{ slot: SpellSlot } | null>(null);
  const lastStats = useRef(0);
  const lastTick = useRef(0);
  const endedSent = useRef(false);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const castPoint = useMemo(() => new THREE.Vector3(), []);

  const playerLook = useMemo(() => avatarLook(playerHeroId), [playerHeroId]);
  const foeLook = useMemo(() => avatarLook(enemyHeroId), [enemyHeroId]);
  const playerSpells = useMemo(() => playerLook && createMoba(playerHeroId, enemyHeroId, 0).heroes[0]!.spells, [playerHeroId, enemyHeroId, playerLook]);

  // ── vstup ──────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      keys.current.add(event.code);
      if (event.code === 'KeyQ') queuedCast.current = { slot: 'Q' };
      if (event.code === 'KeyW') queuedCast.current = { slot: 'W' };
      if (event.code === 'KeyE') queuedCast.current = { slot: 'E' };
      if (event.code === 'KeyR') queuedCast.current = { slot: 'R' };
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyQ', 'KeyE', 'KeyR'].includes(event.code)) {
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

  // ── smyčka ─────────────────────────────────────────────────────────
  useFrame(() => {
    if (!running) return;
    const now = performance.now();
    if (!state.current) state.current = createMoba(playerHeroId, enemyHeroId, now);

    const dt = Math.min(0.1, (now - lastTick.current) / 1000 || STEP);
    lastTick.current = now;

    // vstup → sim (pohyb relativně ke kameře, jako v MOBA)
    const forward = (keys.current.has('KeyW') ? 1 : 0) - (keys.current.has('KeyS') ? 1 : 0);
    const strafe = (keys.current.has('KeyD') ? 1 : 0) - (keys.current.has('KeyA') ? 1 : 0);

    // kurzor na zem → bod seslání
    raycaster.setFromCamera(new THREE.Vector2(pointer.current.x, pointer.current.y), camera);
    const hit = raycaster.ray.intersectPlane(groundPlane, castPoint);
    const cast = queuedCast.current && hit ? { slot: queuedCast.current.slot, x: castPoint.x, z: castPoint.z } : null;
    queuedCast.current = null;

    const input = {
      moveX: strafe,
      moveZ: -forward,
      cast,
      attack: attack.current,
    };

    for (let elapsed = 0; elapsed < dt; elapsed += STEP) {
      stepMoba(state.current, STEP, input, now + elapsed * 1000);
    }

    const snapshot = mobaSnapshot(state.current);
    const you = state.current.heroes[0]!;

    // ── kamera sleduje hrdinu ────────────────────────────────────────
    // kamera drží hrdinu na středu — bez dojezdu, jinak se záběr rozjíždí
    const targetX = THREE.MathUtils.clamp(you.x, -38, 38);
    const targetZ = THREE.MathUtils.clamp(you.z, -26, 26);
    camera.position.set(targetX, 20, targetZ + 17);
    camera.lookAt(targetX, 0.9, targetZ);

    // ── hrdinové ─────────────────────────────────────────────────────
    if (player.current) {
      player.current.position.set(you.x, 0, you.z);
      player.current.rotation.y = you.facing;
      player.current.visible = you.alive;
    }
    const enemy = state.current.heroes[1]!;
    if (foe.current) {
      foe.current.position.set(enemy.x, 0, enemy.z);
      foe.current.rotation.y = enemy.facing;
      foe.current.visible = enemy.alive;
    }

    // ── věže a Nexy ──────────────────────────────────────────────────
    state.current.towers.forEach((tower, index) => {
      const group = towerRefs.current[index];
      if (!group) return;
      group.position.set(tower.x, 0, tower.z);
      group.visible = tower.hp > 0 || tower.kind === 'nexus';
      const scale = tower.kind === 'nexus' ? 1.6 : 1;
      group.scale.setScalar(scale * (0.6 + (tower.hp / tower.maxHp) * 0.4));

      // barva podle strany — modrá ZION, červená Opozice
      const crystal = group.children[2] as THREE.Mesh | undefined;
      const crystalMaterial = crystal?.material as THREE.MeshBasicMaterial | undefined;
      if (crystalMaterial) crystalMaterial.color.set(tower.team === 'blue' ? '#7fe3d4' : '#ff7a6b');
      const body = group.children[1] as THREE.Mesh | undefined;
      const bodyMaterial = body?.material as THREE.MeshStandardMaterial | undefined;
      if (bodyMaterial) bodyMaterial.emissive.set(tower.team === 'blue' ? '#0f3f3a' : '#3f1414');
    });

    // ── uzly L5 ──────────────────────────────────────────────────────
    state.current.nodes.forEach((node, index) => {
      const group = nodeRefs.current[index];
      if (!group) return;
      const ring = group.children[0] as THREE.Mesh | undefined;
      const material = ring?.material as THREE.MeshBasicMaterial | undefined;
      if (material) {
        material.color.set(node.owner === 'blue' ? '#7fe3d4' : node.owner === 'red' ? '#ff7a6b' : '#6b7280');
      }
      const inner = group.children[1] as THREE.Mesh | undefined;
      if (inner) {
        const progress = Math.max(node.progress.blue, node.progress.red) / 2600;
        inner.scale.setScalar(0.4 + Math.min(1, progress) * 0.9);
        const innerMaterial = inner.material as THREE.MeshBasicMaterial | undefined;
        if (innerMaterial) {
          innerMaterial.color.set(node.progress.blue >= node.progress.red ? '#7fe3d4' : '#ff7a6b');
        }
      }
    });

    // ── minioni (instanced) ──────────────────────────────────────────
    if (minionMesh.current) {
      const mesh = minionMesh.current;
      const count = Math.min(snapshot.minions.length, mesh.count);
      for (let index = 0; index < mesh.count; index += 1) {
        const minion = snapshot.minions[index];
        if (!minion || index >= count) {
          tmp.position.set(0, -50, 0);
        } else {
          tmp.position.set(minion.x, 0.5, minion.z);
          tmp.scale.setScalar(1.05);
        }
        tmp.updateMatrix();
        mesh.setMatrixAt(index, tmp.matrix);
        if (minion) {
          color.set(minion.team === 'blue' ? '#7fe3d4' : '#ff7a6b');
          mesh.setColorAt(index, color);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // ── projektily ───────────────────────────────────────────────────
    if (projectileMesh.current) {
      const mesh = projectileMesh.current;
      for (let index = 0; index < mesh.count; index += 1) {
        const projectile = snapshot.projectiles[index];
        if (!projectile) {
          tmp.position.set(0, -50, 0);
        } else {
          tmp.position.set(projectile.x, 1.1, projectile.z);
          tmp.scale.setScalar(0.6);
        }
        tmp.updateMatrix();
        mesh.setMatrixAt(index, tmp.matrix);
        if (projectile) {
          color.set(projectile.color);
          mesh.setColorAt(index, color);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // ── efekty kouzel ────────────────────────────────────────────────
    if (effectMesh.current) {
      const mesh = effectMesh.current;
      for (let index = 0; index < mesh.count; index += 1) {
        const effect = snapshot.effects[index];
        if (!effect) {
          tmp.position.set(0, -50, 0);
          tmp.scale.setScalar(0.001);
        } else {
          tmp.position.set(effect.x, 0.12, effect.z);
          tmp.rotation.set(-Math.PI / 2, 0, 0);
          tmp.scale.setScalar(effect.radius * (0.6 + effect.alpha * 0.6));
        }
        tmp.updateMatrix();
        mesh.setMatrixAt(index, tmp.matrix);
        if (effect) {
          color.set(effect.color);
          mesh.setColorAt(index, color);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // ── HUD telemetrie (5×/s) ────────────────────────────────────────
    if (now - lastStats.current > 200) {
      lastStats.current = now;
      onStats({
        snapshot,
        spells: playerSpells.map((spell) => ({
          slot: spell.slot,
          name: spell.name,
          cooldown: Math.max(0, you.cooldowns[spell.slot] - state.current!.now),
          cooldownMs: spell.cooldownMs,
          mana: spell.mana,
          color: spell.color,
        })),
        playerHp: Math.round(you.hp),
        playerMaxHp: Math.round(you.maxHp),
        playerMana: Math.round(you.mana),
        playerMaxMana: Math.round(you.maxMana),
        playerLevel: you.level,
        kills: you.kills,
        deaths: you.deaths,
        respawnIn: you.alive ? 0 : Math.max(0, Math.ceil((you.respawnAt - state.current.now) / 1000)),
        ended: snapshot.ended,
        nodeOwner: snapshot.nodes.map((node) => ({ key: node.key, owner: node.owner })),
      });
      if (snapshot.ended && !endedSent.current) {
        endedSent.current = true;
        onEnd?.(snapshot.ended);
      }
    }

    // ── debug háček ──────────────────────────────────────────────────
    if (debug) {
      (window as unknown as Record<string, unknown>).__mobaDebug = () => {
        const current = state.current!;
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
            current.heroes[0]!.cooldowns[slot] = 0;
            current.heroes[0]!.mana = current.heroes[0]!.maxMana;
            stepMoba(current, STEP, { ...NO_INPUT, cast: { slot, x, z } }, current.now + 16);
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

  return (
    <>
      <color attach="background" args={['#04070d']} />
      <fog attach="fog" args={['#04070d', 46, 120]} />
      <ambientLight intensity={1.35} color="#d9ecff" />
      <directionalLight position={[18, 30, 12]} intensity={3} color="#fff2d8" />
      <directionalLight position={[-16, 22, -10]} intensity={1.1} color="#9ff0dd" />
      <pointLight position={[-20, 8, 0]} intensity={40} color="#4fe0c0" distance={40} decay={2} />
      <pointLight position={[20, 8, 0]} intensity={40} color="#ff6b6b" distance={40} decay={2} />

      {/* Země */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[48, 64]} />
        <meshStandardMaterial color="#1d4a3b" roughness={0.95} emissive="#0a1f19" emissiveIntensity={0.6} />
      </mesh>

      {/* tři linky */}
      {LANES.map((lane) => (
        <group key={lane.id}>
          <mesh position={[0, 0.01, lane.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[64, 5.5]} />
            <meshBasicMaterial color="#2f8a68" transparent opacity={0.75} />
          </mesh>
          <mesh position={[0, 0.02, lane.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[64, 0.35]} />
            <meshBasicMaterial color="#8bf0c4" transparent opacity={0.75} />
          </mesh>
        </group>
      ))}

      {/* základny */}
      <mesh position={[-38, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[9, 40]} />
        <meshBasicMaterial color="#7fe3d4" transparent opacity={0.16} />
      </mesh>
      <mesh position={[38, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[9, 40]} />
        <meshBasicMaterial color="#ff7a6b" transparent opacity={0.16} />
      </mesh>

      {/* uzly L5 */}
      {NODE_SITES.map((site, index) => (
        <group
          key={site.key}
          position={[site.x, 0, site.z]}
          ref={(node) => {
            nodeRefs.current[index] = node;
          }}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <torusGeometry args={[3.2, 0.16, 8, 40]} />
            <meshBasicMaterial color="#6b7280" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <octahedronGeometry args={[0.9, 0]} />
            <meshBasicMaterial color="#7fe3d4" transparent opacity={0.75} toneMapped={false} />
          </mesh>
          <mesh position={[0, 2.6, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 3.2, 6]} />
            <meshBasicMaterial color="#7fe3d4" transparent opacity={0.35} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* věže a Nexy */}
      {Array.from({ length: 14 }, (_, index) => (
        <group
          key={`tower-${index}`}
          ref={(node) => {
            towerRefs.current[index] = node;
          }}
        >
          <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[2.2, 18]} />
            <meshBasicMaterial color="#0a1a16" transparent opacity={0.7} />
          </mesh>
          <mesh position={[0, 1.8, 0]}>
            <coneGeometry args={[0.9, 3.4, 6]} />
            <meshStandardMaterial color="#34505f" emissive="#123742" emissiveIntensity={1.2} roughness={0.4} />
          </mesh>
          <mesh position={[0, 3.9, 0]}>
            <octahedronGeometry args={[0.55, 0]} />
            <meshBasicMaterial color="#7fe3d4" toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* hrdinové */}
      <group ref={player} position={[-34, 0, 0]}>
        <AvatarModel look={playerLook} />
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.6, 24]} />
          <meshBasicMaterial color="#7fe3d4" transparent opacity={0.28} toneMapped={false} />
        </mesh>
      </group>
      <group ref={foe} position={[34, 0, 0]}>
        <AvatarModel look={foeLook} />
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.6, 24]} />
          <meshBasicMaterial color="#ff7a6b" transparent opacity={0.28} toneMapped={false} />
        </mesh>
      </group>

      {/* minioni, projektily, efekty */}
      <instancedMesh ref={minionMesh} args={[undefined, undefined, 120]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 10, 8]} />
        <meshStandardMaterial vertexColors roughness={0.45} emissive="#ffffff" emissiveIntensity={0.35} />
      </instancedMesh>
      <instancedMesh ref={projectileMesh} args={[undefined, undefined, 40]} frustumCulled={false}>
        <sphereGeometry args={[0.3, 8, 6]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={effectMesh} args={[undefined, undefined, 40]} frustumCulled={false}>
        <ringGeometry args={[0.72, 1, 24]} />
        <meshBasicMaterial vertexColors transparent opacity={0.5} toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  );
}
