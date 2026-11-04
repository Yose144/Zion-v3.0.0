import {
  GAME_H,
  GAME_W,
  PARK_PALETTE,
  prepareCanvas,
  type ParkGameHandle,
  type ParkGameHooks,
} from './types';

/**
 * VĚŽ — šestá skříň pouti.
 *
 * Kvádr se posouvá do stran, hráč ho položí (klepnutí / mezerník) a musí
 * trefit ten pod ním. Čím přesnější zásah, tím méně se kvádr zúží; kdo mine,
 * končí. Na každý kvádr je omezený čas, takže nejde jen tak čekat.
 *
 * Proč tahle mechanika a ne další střílečka: v pouti už jsou dvě hry na
 * míření (Asteroidy, střelnice) a dvě na odraz (Pong, Breakout). Věž je
 * jediná, kde rozhoduje **trpělivost a odhad**, a přitom se dá hrát myší
 * (ukazatel vede kvádr, klepnutí položí) i klávesnicí (← →, mezerník).
 *
 * Vstup: `pointer` = cílová poloha (0..1), `tap`/`Space` = položit.
 */

const BLOCK_H = 18;
const BASE_W = 170;
const MIN_W = 14;
const PERFECT = 5;
/** Čas na jeden kvádr (s) — s výškou se zkracuje, ale nikdy pod 1,2 s. */
const THINK_BASE = 3.4;
const THINK_MIN = 1.2;
const SPEED = 96;

interface Block {
  x: number;
  w: number;
  /** Barva podle pořadí — stack tak není jednolitá plocha. */
  hue: number;
}

export function createTower(canvas: HTMLCanvasElement, hooks: ParkGameHooks): ParkGameHandle {
  const ctx = prepareCanvas(canvas);
  const stack: Block[] = [{ x: (GAME_W - BASE_W) / 2, w: BASE_W, hue: 0 }];

  const state = {
    /** Střed posouvaného kvádru. */
    x: GAME_W / 2,
    w: BASE_W,
    dir: 1,
    timeLeft: THINK_BASE,
    score: 0,
    combo: 0,
    running: true,
    flash: 0,
    flashText: '',
    pointer: null as number | null,
    keys: new Set<string>(),
  };

  const ground = GAME_H - 34;
  const topY = () => ground - stack.length * BLOCK_H;

  function drop() {
    if (!state.running) return;
    const below = stack[stack.length - 1]!;
    const left = Math.max(state.x - state.w / 2, below.x);
    const right = Math.min(state.x + state.w / 2, below.x + below.w);
    const overlap = right - left;

    if (overlap <= 0) {
      // úplně mimo — kvádr padá a hra končí
      state.running = false;
      hooks.onEnd(state.score);
      return;
    }

    const perfect = Math.abs(state.x - (below.x + below.w / 2)) <= PERFECT && state.w >= below.w - 1;
    const width = perfect ? below.w : overlap;
    const center = perfect ? below.x + below.w / 2 : left + overlap / 2;

    stack.push({ x: center - width / 2, w: width, hue: stack.length % 5 });

    state.score += 10 + (perfect ? 25 : 0);
    state.combo = perfect ? state.combo + 1 : 0;
    state.flash = 0.7;
    state.flashText = perfect ? (state.combo > 1 ? `PERFECT ×${state.combo}` : 'PERFECT') : '';
    hooks.onScore(state.score);

    if (width <= MIN_W) {
      // další kvádr už nemá kam trefit
      state.running = false;
      hooks.onEnd(state.score);
      return;
    }

    state.w = width;
    state.x = GAME_W / 2;
    state.dir = stack.length % 2 === 0 ? 1 : -1;
    state.timeLeft = Math.max(THINK_MIN, THINK_BASE - stack.length * 0.06);
  }

  function frame(dt: number) {
    if (!ctx) return;
    const step = Math.min(0.05, dt);

    if (state.running) {
      // ukazatel vede kvádr; bez něj se posouvá sám (klávesnice)
      if (state.pointer !== null) {
        const target = state.pointer * GAME_W;
        state.x += (target - state.x) * Math.min(1, step * 14);
      } else {
        state.x += state.dir * SPEED * step;
        if (state.x > GAME_W - state.w / 2) {
          state.x = GAME_W - state.w / 2;
          state.dir = -1;
        } else if (state.x < state.w / 2) {
          state.x = state.w / 2;
          state.dir = 1;
        }
      }
      if (state.keys.has('ArrowLeft') || state.keys.has('KeyA')) state.x -= 140 * step;
      if (state.keys.has('ArrowRight') || state.keys.has('KeyD')) state.x += 140 * step;
      state.x = Math.max(state.w / 2, Math.min(GAME_W - state.w / 2, state.x));

      state.timeLeft -= step;
      if (state.timeLeft <= 0) drop();

      if (state.flash > 0) state.flash = Math.max(0, state.flash - step);
    }

    // ── kreslení ────────────────────────────────────────────────
    ctx.fillStyle = PARK_PALETTE.bg;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // mřížka jako podlaha
    ctx.strokeStyle = 'rgba(127, 227, 212, 0.08)';
    ctx.lineWidth = 1;
    for (let y = ground; y < GAME_H; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(GAME_W, y + 0.5);
      ctx.stroke();
    }

    const colors = ['#ffd166', '#e8a33d', '#7fe3d4', '#c8a2ff', '#ff9d8a'];
    stack.forEach((block, index) => {
      const y = ground - (index + 1) * BLOCK_H;
      ctx.fillStyle = colors[block.hue]!;
      ctx.fillRect(block.x, y, block.w, BLOCK_H - 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(block.x, y + BLOCK_H - 4, block.w, 2);
    });

    // posouvaný kvádr
    if (state.running) {
      const y = topY() - BLOCK_H;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.fillRect(state.x - state.w / 2, y, state.w, BLOCK_H - 2);
      ctx.fillStyle = 'rgba(255, 209, 102, 0.5)';
      ctx.fillRect(state.x - state.w / 2, y, state.w, 3);

      // časový pruh — jinak hráč nepozná, že mu to padá samo
      const ratio = Math.max(0, Math.min(1, state.timeLeft / THINK_BASE));
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(16, 42, GAME_W - 32, 6);
      ctx.fillStyle = ratio > 0.35 ? PARK_PALETTE.cyan : PARK_PALETTE.red;
      ctx.fillRect(16, 42, (GAME_W - 32) * ratio, 6);
    }

    ctx.font = 'bold 18px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = PARK_PALETTE.ink;
    ctx.fillText(String(state.score).padStart(4, '0'), 16, 26);
    ctx.textAlign = 'right';
    ctx.fillStyle = PARK_PALETTE.gold;
    ctx.fillText(`výška ${stack.length}`, GAME_W - 16, 26);

    if (state.flash > 0 && state.flashText) {
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, state.flash * 1.6);
      ctx.fillStyle = PARK_PALETTE.gold;
      ctx.font = 'bold 22px ui-monospace, monospace';
      ctx.fillText(state.flashText, GAME_W / 2, GAME_H / 2 - 20);
      ctx.globalAlpha = 1;
    }

    if (!state.running) {
      ctx.fillStyle = 'rgba(5, 4, 10, 0.76)';
      ctx.fillRect(0, GAME_H / 2 - 46, GAME_W, 92);
      ctx.textAlign = 'center';
      ctx.fillStyle = PARK_PALETTE.gold;
      ctx.font = 'bold 26px ui-monospace, monospace';
      ctx.fillText(state.w <= MIN_W ? 'VĚŽ JE TENKÁ' : 'SPADLO TO', GAME_W / 2, GAME_H / 2 + 2);
      ctx.font = '13px ui-monospace, monospace';
      ctx.fillStyle = PARK_PALETTE.ink;
      ctx.fillText(`skóre ${state.score} · Hrát znovu`, GAME_W / 2, GAME_H / 2 + 28);
    }
  }

  return {
    frame,
    pointer: (x) => {
      state.pointer = x;
    },
    key: (code, down) => {
      if (down) {
        state.keys.add(code);
        if (code === 'Space') {
          state.keys.delete(code);
          drop();
        }
      } else {
        state.keys.delete(code);
      }
    },
    tap: () => drop(),
    stop: () => {
      state.running = false;
    },
  };
}
