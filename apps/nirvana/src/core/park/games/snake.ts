import {
  GAME_H,
  GAME_W,
  PARK_PALETTE,
  prepareCanvas,
  type ParkGameHandle,
  type ParkGameHooks,
} from './types';

/**
 * SNAKE — klasika na mřížce. Jediná hra, která potřebuje klávesy (u VR se hraje
 * na obrazovce skříně a ovládá tlačítky na ruce; v panelu šipkami/WASD).
 */

const CELL = 16;
const COLS = GAME_W / CELL;
const ROWS = GAME_H / CELL;
const TICK = 0.12;

export function createSnake(canvas: HTMLCanvasElement, hooks: ParkGameHooks): ParkGameHandle {
  const ctx = prepareCanvas(canvas);
  const body: number[] = [];
  const state = {
    dir: 1, // 0 nahoru, 1 doprava, 2 dolů, 3 vlevo
    next: 1,
    food: 0,
    score: 0,
    acc: 0,
    running: true,
    started: false,
  };

  function reset() {
    body.length = 0;
    const cy = Math.floor(ROWS / 2);
    for (let i = 0; i < 5; i++) body.push(cy * COLS + (5 - i));
    state.dir = 1;
    state.next = 1;
    state.score = 0;
    state.acc = 0;
    state.running = true;
    state.started = false;
    hooks.onScore(0);
    placeFood();
  }

  function placeFood() {
    for (let tries = 0; tries < 200; tries++) {
      const cell = Math.floor(Math.random() * COLS * ROWS);
      if (!body.includes(cell)) {
        state.food = cell;
        return;
      }
    }
    state.food = 0;
  }

  function step() {
    state.dir = state.next;
    const head = body[0];
    const x = head % COLS;
    const y = Math.floor(head / COLS);
    let nx = x;
    let ny = y;
    if (state.dir === 0) ny -= 1;
    if (state.dir === 1) nx += 1;
    if (state.dir === 2) ny += 1;
    if (state.dir === 3) nx -= 1;

    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
      state.running = false;
      hooks.onEnd(state.score);
      return;
    }
    const next = ny * COLS + nx;
    // náraz do sebe sama (ocas, který zrovna mizí, se nepočítá)
    for (let i = 0; i < body.length - 1; i++) {
      if (body[i] === next) {
        state.running = false;
        hooks.onEnd(state.score);
        return;
      }
    }

    body.unshift(next);
    if (next === state.food) {
      state.score += 25;
      hooks.onScore(state.score);
      placeFood();
    } else {
      body.pop();
    }
  }

  function frame(dt: number) {
    if (!ctx) return;
    const step_ = Math.min(0.05, dt);
    if (state.running) {
      state.acc += step_;
      if (state.acc >= TICK) {
        state.acc = 0;
        step();
      }
    }

    ctx.fillStyle = PARK_PALETTE.bg;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    ctx.strokeStyle = 'rgba(255, 209, 102, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, GAME_H);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(GAME_W, y * CELL);
      ctx.stroke();
    }

    for (let i = body.length - 1; i >= 0; i--) {
      const cell = body[i];
      const alpha = 1 - i / (body.length + 6);
      ctx.fillStyle = i === 0 ? PARK_PALETTE.gold : `rgba(232, 163, 61, ${Math.max(0.25, alpha)})`;
      ctx.fillRect((cell % COLS) * CELL + 1, Math.floor(cell / COLS) * CELL + 1, CELL - 2, CELL - 2);
    }

    ctx.fillStyle = PARK_PALETTE.cyan;
    ctx.beginPath();
    ctx.arc(
      (state.food % COLS) * CELL + CELL / 2,
      Math.floor(state.food / COLS) * CELL + CELL / 2,
      CELL / 2 - 2,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.font = 'bold 18px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = PARK_PALETTE.ink;
    ctx.fillText(String(state.score).padStart(4, '0'), 16, 26);

    if (!state.running) {
      ctx.fillStyle = 'rgba(5, 4, 10, 0.74)';
      ctx.fillRect(0, GAME_H / 2 - 46, GAME_W, 92);
      ctx.textAlign = 'center';
      ctx.fillStyle = PARK_PALETTE.gold;
      ctx.font = 'bold 26px ui-monospace, monospace';
      ctx.fillText('KONEC HRY', GAME_W / 2, GAME_H / 2 + 2);
      ctx.font = '13px ui-monospace, monospace';
      ctx.fillStyle = PARK_PALETTE.ink;
      ctx.fillText(`skóre ${state.score} · klikni pro novou hru`, GAME_W / 2, GAME_H / 2 + 28);
    }
  }

  reset();

  return {
    frame,
    pointer: () => {
      // had je klávesový — ukazatel ignoruje, ale rozhraní zůstává stejné
    },
    key: (code, down) => {
      if (!down) return;
      const map: Record<string, number> = {
        ArrowUp: 0,
        KeyW: 0,
        ArrowRight: 1,
        KeyD: 1,
        ArrowDown: 2,
        KeyS: 2,
        ArrowLeft: 3,
        KeyA: 3,
      };
      const dir = map[code];
      if (dir === undefined) return;
      // otočka o 180° by hráče zabila vlastním ocasem
      if ((dir + 2) % 4 === state.dir) return;
      state.next = dir;
      state.started = true;
    },
    stop: () => {
      state.running = false;
    },
  };
}
