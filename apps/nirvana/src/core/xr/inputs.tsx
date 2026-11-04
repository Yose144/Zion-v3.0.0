'use client';

/**
 * Jedno čtení ovladačů pro celou Nirvanu.
 *
 * Mars měl vlastní `ArenaXrInput`, pouť taky — a ostatní hry neměly nic,
 * takže VR uměly jen dvě. Tady je společný most: každý snímek předá hře
 * normalizovaný stav obou ovladačů a hra si z něj vezme, co potřebuje.
 *
 * Proč callback a ne React state: stav ovladače se čte 72–90×/s a předávat
 * ho přes `setState` by překreslovalo celý 3D strom. Callback dostane **stále
 * stejný objekt**, takže se nic nealokuje ve smyčce.
 */

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useXRInputSourceState } from '@react-three/xr';
import * as THREE from 'three';
import { VR_DEADZONE } from './index';

export interface VrAxis {
  x: number;
  y: number;
}

export interface VrHand {
  /** Thumbstick −1..1; osa Y je v XR obráceně (dopředu = kladné). */
  stick: VrAxis;
  /** Spoušť — „palba / úder". */
  trigger: boolean;
  /** Stisk (grip) — „druhá akce". */
  squeeze: boolean;
  /** A / X — primární tlačítko. */
  primary: boolean;
  /** B / Y — sekundární tlačítko. */
  secondary: boolean;
}

export interface VrInputState {
  left: VrHand;
  right: VrHand;
  /** Paprsek pravého ovladače ve světových souřadnicích (míření). */
  rightRay: THREE.Vector3 | null;
  /** Počátek paprsku (poloha ovladače) — pro průsečík se zemí. */
  rightOrigin: THREE.Vector3 | null;
}

const dead = (value: number | undefined): number => {
  const v = value ?? 0;
  return Math.abs(v) < VR_DEADZONE ? 0 : v;
};

const pressed = (button: { state?: string } | undefined): boolean => button?.state === 'pressed';

type XrButtonLike = { state?: string };
type XrPad = Record<string, XrButtonLike & { xAxis?: number; yAxis?: number }>;

function readHand(source: unknown, hand: VrHand): void {
  const pad = (source as { gamepad?: XrPad } | undefined)?.gamepad;
  const stick = pad?.['xr-standard-thumbstick'];
  hand.stick.x = dead(stick?.xAxis);
  // osa Y je v XR obráceně: nahoru = −1, my chceme „vpřed" kladně
  hand.stick.y = dead(stick?.yAxis === undefined ? 0 : -stick.yAxis);
  hand.trigger = pressed(pad?.['xr-standard-trigger']);
  hand.squeeze = pressed(pad?.['xr-standard-squeeze']);
  hand.primary = pressed(pad?.['a-button']) || pressed(pad?.['x-button']);
  hand.secondary = pressed(pad?.['b-button']) || pressed(pad?.['y-button']);
}

export function VrInputs({ onInput }: { onInput: (state: VrInputState) => void }) {
  const left = useXRInputSourceState('controller', 'left');
  const right = useXRInputSourceState('controller', 'right');
  const callback = useRef(onInput);
  callback.current = onInput;

  const state = useRef<VrInputState>({
    left: { stick: { x: 0, y: 0 }, trigger: false, squeeze: false, primary: false, secondary: false },
    right: { stick: { x: 0, y: 0 }, trigger: false, squeeze: false, primary: false, secondary: false },
    rightRay: null,
    rightOrigin: null,
  });
  const direction = useRef(new THREE.Vector3(0, 0, -1));
  const origin = useRef(new THREE.Vector3());

  useFrame(() => {
    const current = state.current;
    readHand(left, current.left);
    readHand(right, current.right);
    const object = right?.object;
    if (object) {
      object.getWorldDirection(direction.current);
      object.getWorldPosition(origin.current);
      current.rightRay = direction.current;
      current.rightOrigin = origin.current;
    } else {
      current.rightRay = null;
      current.rightOrigin = null;
    }
    callback.current(current);
  });

  return null;
}

/**
 * Uvolní vstup, když session skončí — bez toho by postava běžela dál
 * (syntetické klávesy zůstanou „držené", protože je nikdo nepustil).
 */
export function useVrRelease(release: () => void, presenting: boolean): void {
  useEffect(() => {
    if (presenting) return;
    release();
  }, [presenting, release]);
}
