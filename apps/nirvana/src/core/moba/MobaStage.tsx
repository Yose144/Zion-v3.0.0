'use client';

/**
 * Vykreslení zápasu „První svět" — **jen čte snapshot**.
 *
 * Schválně tu není žádná simulace ani vstup: sólo si snapshot počítá lokálně
 * (`MobaGame`), online ho dostává ze serveru (`MobaOnline`). Kdyby si scéna
 * počítala vlastní stav, rozešla by se s autoritou a hráč by viděl jiné
 * zásahy, než jaké se opravdu staly.
 */

import { useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AvatarModel } from '@/core/avatars/AvatarModel';
import { avatarLook } from '@/core/avatars/kit';
import type { MobaSnapshot } from './sim';
import { LANES, NODE_SITES, NODE_CAPTURE_MS, STRUCTURES } from './map';

const MAX_HEROES = 4;
const MAX_TOWERS = STRUCTURES.length;
const MAX_MINIONS = 120;
const MAX_PROJECTILES = 40;
const MAX_EFFECTS = 40;

export function MobaStage({
  snapshotRef,
  youId,
  selfPose,
}: {
  snapshotRef: React.MutableRefObject<MobaSnapshot | null>;
  youId: string;
  /**
   * Predikovaná poloha vlastního hrdiny (online). Server posílá 15 Hz, takže
   * bez predikce by se vlastní postava cukala; zásahy dál rozhoduje server,
   * predikuje se **jen pohyb**.
   */
  selfPose?: React.MutableRefObject<{ x: number; z: number; active: boolean } | null>;
}) {
  const { camera } = useThree();
  const heroRefs = useRef<(THREE.Group | null)[]>([]);
  const towerRefs = useRef<(THREE.Group | null)[]>([]);
  const nodeRefs = useRef<(THREE.Group | null)[]>([]);
  const minionMesh = useRef<THREE.InstancedMesh>(null);
  const projectileMesh = useRef<THREE.InstancedMesh>(null);
  const effectMesh = useRef<THREE.InstancedMesh>(null);

  // Složení hrdinů se mění jen na začátku zápasu — drží se v React state,
  // aby se kvůli novému avataru překreslil jen tenhle kus stromu.
  const [slots, setSlots] = useState<{ id: string; heroId: number }[]>([]);
  const looks = useRef(new Map<number, ReturnType<typeof avatarLook>>());
  const compositionRef = useRef('');
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const snapshot = snapshotRef.current;
    if (!snapshot) return;

    // ── hrdinové: pohled dopočítaný z `heroId` ───────────────────────
    const composition = snapshot.heroes.map((hero) => `${hero.id}:${hero.heroId}`).join(',');
    if (composition !== compositionRef.current) {
      compositionRef.current = composition;
      for (const hero of snapshot.heroes) {
        if (!looks.current.has(hero.heroId)) looks.current.set(hero.heroId, avatarLook(hero.heroId));
      }
      setSlots(snapshot.heroes.map((hero) => ({ id: hero.id, heroId: hero.heroId })));
    }

    const predicted = selfPose?.current;
    snapshot.heroes.forEach((hero, index) => {
      const group = heroRefs.current[index];
      if (!group) return;
      const usePredict = predicted?.active && hero.id === youId;
      group.position.set(usePredict ? predicted!.x : hero.x, 0, usePredict ? predicted!.z : hero.z);
      group.visible = hero.alive;
      const ring = group.children[1] as THREE.Mesh | undefined;
      const material = ring?.material as THREE.MeshBasicMaterial | undefined;
      if (material) material.color.set(hero.team === 'blue' ? '#7fe3d4' : '#ff7a6b');
    });

    // ── kamera drží tvého hrdinu na středu ──────────────────────────
    const you = snapshot.heroes.find((hero) => hero.id === youId) ?? snapshot.heroes[0];
    if (you) {
      const predictedNow = selfPose?.current?.active ? selfPose.current : null;
      const targetX = THREE.MathUtils.clamp(predictedNow?.x ?? you.x, -38, 38);
      const targetZ = THREE.MathUtils.clamp(predictedNow?.z ?? you.z, -26, 26);
      camera.position.set(targetX, 20, targetZ + 17);
      camera.lookAt(targetX, 0.9, targetZ);
    }

    // ── věže a Nexy ──────────────────────────────────────────────────
    for (const tower of snapshot.towers) {
      const structure = STRUCTURES.find((candidate) => candidate.id === tower.id);
      const index = structure ? STRUCTURES.indexOf(structure) : -1;
      const group = towerRefs.current[index];
      if (!group) continue;
      group.position.set(tower.x, 0, tower.z);
      group.visible = tower.hp > 0;
      group.scale.setScalar((tower.kind === 'nexus' ? 1.6 : 1) * (0.55 + (tower.hp / tower.maxHp) * 0.45));
      const crystal = group.children[2] as THREE.Mesh | undefined;
      const crystalMaterial = crystal?.material as THREE.MeshBasicMaterial | undefined;
      if (crystalMaterial) crystalMaterial.color.set(tower.team === 'blue' ? '#7fe3d4' : '#ff7a6b');
      const body = group.children[1] as THREE.Mesh | undefined;
      const bodyMaterial = body?.material as THREE.MeshStandardMaterial | undefined;
      if (bodyMaterial) bodyMaterial.emissive.set(tower.team === 'blue' ? '#0f3f3a' : '#3f1414');
    }

    // ── uzly L5 ──────────────────────────────────────────────────────
    snapshot.nodes.forEach((node, index) => {
      const group = nodeRefs.current[index];
      if (!group) return;
      const ring = group.children[0] as THREE.Mesh | undefined;
      const ringMaterial = ring?.material as THREE.MeshBasicMaterial | undefined;
      if (ringMaterial) {
        ringMaterial.color.set(node.owner === 'blue' ? '#7fe3d4' : node.owner === 'red' ? '#ff7a6b' : '#94a3b8');
      }
      const core = group.children[1] as THREE.Mesh | undefined;
      if (core) {
        const progress = Math.max(node.progress.blue, node.progress.red) / NODE_CAPTURE_MS;
        core.scale.setScalar(0.4 + Math.min(1, progress) * 0.9);
        const coreMaterial = core.material as THREE.MeshBasicMaterial | undefined;
        if (coreMaterial) {
          coreMaterial.color.set(node.progress.blue >= node.progress.red ? '#7fe3d4' : '#ff7a6b');
        }
      }
    });

    // ── minioni ──────────────────────────────────────────────────────
    if (minionMesh.current) {
      const mesh = minionMesh.current;
      for (let index = 0; index < mesh.count; index += 1) {
        const minion = snapshot.minions[index];
        if (!minion) {
          tmp.position.set(0, -60, 0);
          tmp.scale.setScalar(0.001);
        } else {
          tmp.position.set(minion.x, 0.5, minion.z);
          tmp.scale.setScalar(1.05);
        }
        tmp.updateMatrix();
        mesh.setMatrixAt(index, tmp.matrix);
        color.set(minion ? (minion.team === 'blue' ? '#7fe3d4' : '#ff7a6b') : '#000000');
        mesh.setColorAt(index, color);
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
          tmp.position.set(0, -60, 0);
          tmp.scale.setScalar(0.001);
        } else {
          tmp.position.set(projectile.x, 1.1, projectile.z);
          tmp.scale.setScalar(0.6);
        }
        tmp.updateMatrix();
        mesh.setMatrixAt(index, tmp.matrix);
        color.set(projectile ? projectile.color : '#000000');
        mesh.setColorAt(index, color);
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
          tmp.position.set(0, -60, 0);
          tmp.scale.setScalar(0.001);
        } else {
          tmp.position.set(effect.x, 0.12, effect.z);
          tmp.rotation.set(-Math.PI / 2, 0, 0);
          tmp.scale.setScalar(effect.radius * (0.6 + effect.alpha * 0.6));
        }
        tmp.updateMatrix();
        mesh.setMatrixAt(index, tmp.matrix);
        color.set(effect ? effect.color : '#000000');
        mesh.setColorAt(index, color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
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

      {/* základny */}
      <mesh position={[-38, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[9, 40]} />
        <meshBasicMaterial color="#7fe3d4" transparent opacity={0.16} />
      </mesh>
      <mesh position={[38, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[9, 40]} />
        <meshBasicMaterial color="#ff7a6b" transparent opacity={0.16} />
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
            <meshBasicMaterial color="#94a3b8" toneMapped={false} />
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
      {STRUCTURES.map((structure, index) => (
        <group
          key={structure.id}
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

      {/* hrdinové — pool čtyř (2v2), pohled z `heroId` */}
      {slots.map((slot, index) => {
        const look = looks.current.get(slot.heroId);
        return (
          <group
            key={`hero-${index}`}
            ref={(node) => {
              heroRefs.current[index] = node;
            }}
            visible={false}
          >
            {look ? (
              <AvatarModel look={look} />
            ) : (
              <mesh position={[0, 1, 0]}>
                <capsuleGeometry args={[0.3, 1.2, 4, 8]} />
                <meshStandardMaterial color="#8b93a7" />
              </mesh>
            )}
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[1.6, 24]} />
              <meshBasicMaterial color="#7fe3d4" transparent opacity={0.28} toneMapped={false} />
            </mesh>
          </group>
        );
      })}

      {/* minioni, projektily, efekty */}
      <instancedMesh ref={minionMesh} args={[undefined, undefined, MAX_MINIONS]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 10, 8]} />
        <meshStandardMaterial vertexColors roughness={0.45} emissive="#ffffff" emissiveIntensity={0.35} />
      </instancedMesh>
      <instancedMesh ref={projectileMesh} args={[undefined, undefined, MAX_PROJECTILES]} frustumCulled={false}>
        <sphereGeometry args={[0.3, 8, 6]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={effectMesh} args={[undefined, undefined, MAX_EFFECTS]} frustumCulled={false}>
        <ringGeometry args={[0.72, 1, 24]} />
        <meshBasicMaterial vertexColors transparent opacity={0.5} toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  );
}

export { MAX_HEROES, MAX_TOWERS };
