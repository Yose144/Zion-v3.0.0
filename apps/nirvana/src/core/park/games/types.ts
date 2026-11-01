/**
 * Park games — sdílený kontrakt.
 *
 * Hry jsou čisté canvas 2D: žádná knihovna, žádné assety. Jeden canvas se
 * vykresluje do `CanvasTexture` na skříni automatu, takže hru vidí i hráč ve VR.
 * Odtud plynou dvě pravidla:
 *
 *  1. `frame(dt)` nikdy nic nealokuje (žádné `new` ve smyčce).
 *  2. Vstup je abstraktní (`pointer`, `key`) — myš, dotyk i VR paprsek jsou
 *     jen zdroje stejných dvou signálů.
 */

export type CanvasGameId = 'pong' | 'breakout' | 'snake';
/** Cokoli, co jde hrát a zapsat do tabule. Střelnice je 3D, ne canvas. */
export type ParkGameId = CanvasGameId | 'gallery';

export interface ParkGameHooks {
  /** Aktuální skóre (volá se při každé změně, ne každý frame). */
  onScore: (score: number) => void;
  /** Konec hry — hráč dohrál, skóre je finální. */
  onEnd: (score: number) => void;
}

export interface ParkGameHandle {
  /** Posunout simulaci. `dt` v sekundách, omezené na 0.05. */
  frame: (dt: number) => void;
  /** Vodorovná poloha ukazatele 0..1 (null = pryč). */
  pointer: (x: number | null) => void;
  /** Klávesa ve stylu `KeyboardEvent.code`, `down` = stisk. */
  key: (code: string, down: boolean) => void;
  stop: () => void;
}

export interface ParkGameDefinition {
  id: CanvasGameId;
  title: { cs: string; en: string };
  hint: { cs: string; en: string };
  /** Vytvoří hru nad existujícím canvasem a spustí ji. */
  create: (canvas: HTMLCanvasElement, hooks: ParkGameHooks) => ParkGameHandle;
}

export const GAME_W = 512;
export const GAME_H = 384;

/** Připraví kontext a vrátí ho; při chybě vrátí null (hra pak jen mlčí). */
export function prepareCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  canvas.width = GAME_W;
  canvas.height = GAME_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  return ctx;
}

/** Zlatá paleta parku — stejná jako Hiran, jen tvrdší (obrazovka, ne oltář). */
export const PARK_PALETTE = {
  bg: '#0b0812',
  ink: '#f4ead2',
  gold: '#ffd166',
  amber: '#e8a33d',
  cyan: '#7fe3d4',
  red: '#ff7a6b',
} as const;
