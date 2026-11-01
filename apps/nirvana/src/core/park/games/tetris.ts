import {
  GAME_H,
  GAME_W,
  PARK_PALETTE,
  prepareCanvas,
  type ParkGameHandle,
  type ParkGameHooks,
} from './types';

/**
 * TETRIS — klasika, která v arkádě nesmí chybět.
 *
 * Hrací pole 10×16, sedm kostek, gravitace zrychluje s počtem řádků.
 * Ovládání: ←/→ posun, ↑/X otočit, ↓ zrychlit, mezerník shodit.
 * (Ve VR se hraje na obrazovce skříně; tohle je jediná hra, která potřebuje
 * víc než jeden signál, takže v headsetu potřebuje ovladač s tlačítky.)
 */

const COLS = 10;
const ROWS = 16;
const CELL = 22;

type Shape = number[][];

const SHAPES: Shape[] = [
  [[1, 1, 1, 1]], // I
  [
    [1, 1],
    [1, 1],
  ], // O
  [
    [0, 1, 0],
    [1, 1, 1],
  ], // T
  [
    [1, 0, 0],
    [1, 1, 1],
  ], // J
  [
    [0, 0, 1],
    [1, 1, 1],
  ], // L
  [
    [0, 1, 1],
    [1, 1, 0],
  ], // S
  [
    [1, 1, 0],
    [0, 1, 1],
  ], // Z
];

const COLORS = ['#7fe3d4', '#ffd166', '#c8a2ff', '#8ab4ff', '#ffb46a', '#9fe08a', '#ff8f8a'];

export function createTetris(canvas: HTMLCanvasElement, hooks: ParkGameHooks): ParkGameHandle {
  const ctx = prepareCanvas(canvas);
  const board: number[] = new Array(COLS * ROWS).fill(-1);
  const state = {
    shape: 0,
    rotation: 0,
    x: 3,
    y: 0,
    score: 0,
    lines: 0,
    drop: 0,
    interval: 0.62,
    running: true,
  };

  function cells(shape: Shape, rotation: number): Shape {
    let matrix = shape.map((row) => [...row]);
    for (let i = 0; i < rotation % 4; i++) {
      const rotated: number[][] = [];
      for (let x = 0; x < matrix[0]!.length; x++) {
        rotated.push(matrix.map((row) => row[x]!).reverse());
      }
      matrix = rotated;
    }
    return matrix;
  }

  function fits(shape: Shape, px: number, py: number): boolean {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y]!.length; x++) {
        if (!shape[y]![x]) continue;
        const bx = px + x;
        const by = py + y;
        if (bx < 0 || bx >= COLS || by >= ROWS) return false;
        if (by >= 0 && board[by * COLS + bx] !== -1) return false;
      }
    }
    return true;
  }

  function spawn() {
    state.shape = Math.floor(Math.random() * SHAPES.length);
    state.rotation = 0;
    state.x = Math.floor((COLS - 4) / 2);
    state.y = 0;
    if (!fits(cells(SHAPES[state.shape]!, 0), state.x, state.y)) {
      state.running = false;
      hooks.onEnd(state.score);
    }
  }

  function lock() {
    const shape = cells(SHAPES[state.shape]!, state.rotation);
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y]!.length; x++) {
        if (!shape[y]![x]) continue;
        const by = state.y + y;
        const bx = state.x + x;
        if (by >= 0) board[by * COLS + bx] = state.shape;
      }
    }

    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      let full = true;
      for (let x = 0; x < COLS; x++) {
        if (board[y * COLS + x] === -1) {
          full = false;
          break;
        }
      }
      if (!full) continue;
      cleared++;
      for (let row = y; row > 0; row--) {
        for (let x = 0; x < COLS; x++) board[row * COLS + x] = board[(row - 1) * COLS + x]!;
      }
      for (let x = 0; x < COLS; x++) board[x] = -1;
      y++;
    }

    if (cleared > 0) {
      state.lines += cleared;
      state.score += [0, 100, 250, 450, 700][cleared] ?? 700;
      hooks.onScore(state.score);
      state.interval = Math.max(0.16, 0.62 - state.lines * 0.03);
    }
    spawn();
  }

  function move(dx: number) {
    const shape = cells(SHAPES[state.shape]!, state.rotation);
    if (fits(shape, state.x + dx, state.y)) state.x += dx;
  }

  function rotate() {
    const next = (state.rotation + 1) % 4;
    const shape = cells(SHAPES[state.shape]!, next);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (fits(shape, state.x + kick, state.y)) {
        state.rotation = next;
        state.x += kick;
        return;
      }
    }
  }

  function hardDrop() {
    const shape = cells(SHAPES[state.shape]!, state.rotation);
    while (fits(shape, state.x, state.y + 1)) state.y++;
    lock();
  }

  function step() {
    const shape = cells(SHAPES[state.shape]!, state.rotation);
    if (fits(shape, state.x, state.y + 1)) state.y++;
    else lock();
  }

  spawn();

  function frame(dt: number) {
    if (!ctx) return;
    const step_ = Math.min(0.05, dt);
    if (state.running) {
      state.drop += step_;
      if (state.drop >= state.interval) {
        state.drop = 0;
        step();
      }
    }

    const offsetX = Math.floor((GAME_W - COLS * CELL) / 2) - 30;

    ctx.fillStyle = PARK_PALETTE.bg;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // pole
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.14)';
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, 10, COLS * CELL, ROWS * CELL);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const value = board[y * COLS + x]!;
        if (value < 0) continue;
        ctx.fillStyle = COLORS[value % COLORS.length]!;
        ctx.fillRect(offsetX + x * CELL + 1, 10 + y * CELL + 1, CELL - 2, CELL - 2);
      }
    }

    // padající kostka
    if (state.running) {
      const shape = cells(SHAPES[state.shape]!, state.rotation);
      for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y]!.length; x++) {
          if (!shape[y]![x]) continue;
          const by = state.y + y;
          if (by < 0) continue;
          ctx.fillStyle = COLORS[state.shape % COLORS.length]!;
          ctx.fillRect(offsetX + (state.x + x) * CELL + 1, 10 + by * CELL + 1, CELL - 2, CELL - 2);
        }
      }
    }

    // skóre vpravo
    ctx.textAlign = 'left';
    ctx.fillStyle = PARK_PALETTE.ink;
    ctx.font = 'bold 20px ui-monospace, monospace';
    ctx.fillText(String(state.score).padStart(4, '0'), GAME_W - 148, 42);
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(244, 234, 210, 0.55)';
    ctx.fillText(`řádky ${state.lines}`, GAME_W - 148, 62);
    ctx.fillText('← → posun', GAME_W - 148, 88);
    ctx.fillText('↑ otočit', GAME_W - 148, 104);
    ctx.fillText('mezerník hodit', GAME_W - 148, 120);

    if (!state.running) {
      ctx.fillStyle = 'rgba(5, 4, 10, 0.76)';
      ctx.fillRect(0, GAME_H / 2 - 46, GAME_W, 92);
      ctx.textAlign = 'center';
      ctx.fillStyle = PARK_PALETTE.gold;
      ctx.font = 'bold 26px ui-monospace, monospace';
      ctx.fillText('KONEC HRY', GAME_W / 2, GAME_H / 2 + 2);
      ctx.font = '13px ui-monospace, monospace';
      ctx.fillStyle = PARK_PALETTE.ink;
      ctx.fillText(`skóre ${state.score} · Hrát znovu`, GAME_W / 2, GAME_H / 2 + 28);
    }
  }

  return {
    frame,
    pointer: () => {
      // Tetris je klávesový — ukazatel ignoruje
    },
    key: (code, down) => {
      if (!down || !state.running) return;
      if (code === 'ArrowLeft' || code === 'KeyA') move(-1);
      else if (code === 'ArrowRight' || code === 'KeyD') move(1);
      else if (code === 'ArrowUp' || code === 'KeyW' || code === 'KeyX') rotate();
      else if (code === 'ArrowDown' || code === 'KeyS') {
        const shape = cells(SHAPES[state.shape]!, state.rotation);
        if (fits(shape, state.x, state.y + 1)) state.y++;
        else lock();
      } else if (code === 'Space') hardDrop();
    },
    stop: () => {
      state.running = false;
    },
  };
}
