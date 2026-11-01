/**
 * Hiran presence — the four states Nirvana actually has.
 *
 * `listening` and `speaking` from the 3D masterplan are deliberately absent:
 * there is no microphone, STT or TTS in this repository, and a fake waveform
 * would be a lie. When voice arrives, those states get added here first.
 */

export type HiranState = 'idle' | 'thinking' | 'offline' | 'error';

/** 0..1 — how alive the gold layer looks. Drives the shader, never the data. */
export function hiranActivity(state: HiranState): number {
  switch (state) {
    case 'thinking':
      return 1;
    case 'idle':
      return 0.28;
    case 'offline':
      return 0.09;
    case 'error':
      return 0.05;
  }
}

/** Accent colour while the state lasts. Gold is the identity; amethyst is thought. */
export function hiranAccent(state: HiranState): string {
  return state === 'thinking' ? '#a88eff' : '#ffd166';
}

export function hiranLabel(state: HiranState): 'idle' | 'thinking' | 'offline' | 'error' {
  return state;
}

/** Anything that is not one of our four states is not a state. */
export function normalizeHiranState(value: unknown): HiranState {
  return value === 'thinking' || value === 'offline' || value === 'error' || value === 'idle'
    ? value
    : 'idle';
}

/**
 * Review hook for art shots: `?hiran=idle|thinking|offline|error` freezes the
 * presence state and skips the availability probe. Never persisted.
 */
export function hiranReviewOverride(): HiranState | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('hiran');
  if (!value) return null;
  return value === 'thinking' || value === 'offline' || value === 'error' || value === 'idle'
    ? value
    : null;
}
