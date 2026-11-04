'use client';

/**
 * VR v PRVNÍM SVĚTĚ (`/earth`).
 *
 * MOBA je nejnáročnější na vstup: pohyb, zamíření na zem a útok. Nezakládáme
 * kvůli tomu druhý vstup — posíláme **stejné události jako dotyk**:
 *
 *  - levý stick → syntetické `KeyW/A/S/D`,
 *  - pravý ovladač → paprsek na zem → promítne se do obrazovky a pošle
 *    `pointermove`, takže hra zamíří kouzlo tam, kam se opravdu díváš,
 *  - spoušť → `pointerdown` na plátno (PALBA, drží se 140 ms jako na dotyku),
 *  - A/B/X/Y → kouzla Q/W/E/R, gripy → ward a recall.
 *
 * Trik s projekcí je důležitý: hra počítá `raycaster.setFromCamera(pointer)`,
 * takže kdybychom jí poslali světový bod, museli bychom do simulace sáhnout.
 * Takto stačí, že paprsek převedeme na souřadnice kurzoru — a zbytek kódu
 * zůstane nedotčený.
 */

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { XROrigin } from '@react-three/xr';
import * as THREE from 'three';
import type { Group } from 'three';
import { VrInputs } from '@/core/xr/inputs';
import { VR_DEADZONE, useVrKeys } from '@/core/xr';
import type { MobaSnapshot } from './sim';

/** Držení PALBY v ms — hra čte `attack` jednou za snímek (stejné jako dotyk). */
const ATTACK_HOLD_MS = 140;

const sendKey = (code: string, down: boolean) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
};

export function MobaXr({
  snapshotRef,
  youId,
  active,
}: {
  snapshotRef: React.MutableRefObject<MobaSnapshot | null>;
  youId: string;
  active: boolean;
}) {
  const { camera } = useThree();
  const origin = useRef<Group>(null);
  const keys = useVrKeys();

  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const ray = useRef(new THREE.Raycaster());
  const point = useRef(new THREE.Vector3());
  const aim = useRef(new THREE.Vector2());
  const attackTimer = useRef<number | null>(null);
  /** Hrana spouště: `pointerdown` se posílá jen při stisku, ne každý snímek. */
  const triggerWas = useRef(false);
  /** Předchozí stav tlačítek — syntetická klávesa se posílá jen na hraně. */
  const buttons = useRef<Record<string, boolean>>({});

  const canvas = () => document.querySelector<HTMLCanvasElement>('.moba-stage canvas');

  const aimAtGround = (): { x: number; y: number } | null => {
    const element = canvas();
    if (!element) return null;
    const hits = ray.current.ray.intersectPlane(plane.current, point.current);
    if (!hits) return null;
    const ndc = point.current.clone().project(camera);
    if (!Number.isFinite(ndc.x) || !Number.isFinite(ndc.y)) return null;
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + ((ndc.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - ndc.y) / 2) * rect.height,
    };
  };

  const moveAim = () => {
    const element = canvas();
    const spot = aimAtGround();
    if (!element || !spot) return;
    element.dispatchEvent(new PointerEvent('pointermove', { clientX: spot.x, clientY: spot.y, bubbles: true }));
  };

  const fire = () => {
    const element = canvas();
    if (!element) return;
    const spot = aimAtGround();
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: spot?.x ?? rect.left + rect.width / 2,
        clientY: spot?.y ?? rect.top + rect.height / 2,
        button: 0,
        bubbles: true,
      }),
    );
    if (attackTimer.current !== null) window.clearTimeout(attackTimer.current);
    attackTimer.current = window.setTimeout(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      attackTimer.current = null;
    }, ATTACK_HOLD_MS);
  };

  /** Kouzlo: nejdřív zamířit (poslední paprsek), pak stisknout klávesu slotu. */
  const cast = (code: string) => {
    moveAim();
    sendKey(code, true);
    window.setTimeout(() => sendKey(code, false), 60);
  };

  useFrame(() => {
    const snapshot = snapshotRef.current;
    const hero = snapshot?.heroes.find((candidate) => candidate.id === youId) ?? snapshot?.heroes[0];
    if (origin.current && hero) {
      // nadhled jako v běžné hře: hrdina je před tebou, ne v tobě
      origin.current.position.set(hero.x, 9.5, hero.z + 8.5);
    }
  });

  return (
    <>
      <XROrigin ref={origin} />
      <VrInputs
        onInput={(input) => {
          const stick = input.left.stick;
          keys.set('KeyW', active && stick.y > VR_DEADZONE);
          keys.set('KeyS', active && stick.y < -VR_DEADZONE);
          keys.set('KeyA', active && stick.x < -VR_DEADZONE);
          keys.set('KeyD', active && stick.x > VR_DEADZONE);

          // paprsek pravého ovladače → bod na zemi (jen když je čím mířit)
          if (input.rightRay && active) {
            const source = input.rightOrigin;
            if (source) {
              ray.current.set(source, input.rightRay.clone().normalize());
            }
          }

          const pressed = {
            Q: input.left.primary,
            E: input.left.secondary,
            W: input.right.primary,
            R: input.right.secondary,
            G: input.left.squeeze,
            B: input.right.squeeze,
          };
          const codes: Record<string, string> = {
            Q: 'KeyQ',
            E: 'KeyE',
            W: 'KeyF', // slot W je na klávesnici F (W = pohyb vpřed)
            R: 'KeyR',
            G: 'KeyG',
            B: 'KeyB',
          };
          for (const [name, down] of Object.entries(pressed)) {
            if (down && !buttons.current[name]) cast(codes[name]!);
            buttons.current[name] = down;
          }

          if (input.right.trigger && !triggerWas.current && active) fire();
          triggerWas.current = input.right.trigger;
        }}
      />
    </>
  );
}
