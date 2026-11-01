import {
  GAME_H,
  GAME_W,
  PARK_PALETTE,
  prepareCanvas,
  type ParkGameHandle,
  type ParkGameHooks,
} from './types';

/**
 * BREAKOUT — cihlová zeď, tři životy. Paddle vodorovně (myš / paprsek),
 * stejné ovládání jako Pong, takže se hráč neučí nic nového.
 */

const COLS = 9;
const ROWS = 5;
const BRICK_W = 46;
const BRICK_H = 16;
const PADDLE_W = 92;
const PADDLE_H = 12;
const BALL = 8;

export function createBreakout(canvas: HTMLCanvasElement, hooks: ParkGameHooks): ParkGameHandle {
  const ctx = prepareCanvas(canvas);
  const bricks = new Uint8Array(COLS * ROWS).fill(1);
  const state = {
    paddleX: GAME_W / 2,
    ballX: GAME_W / 2,
    ballY: GAME_H - 80,
    vx: 150,
    vy: -215,
    lives: 3,
    score: 0,
    running: true,
    pointer: null as number | null,
    keys: new Set<string>(),
  };

  const brickX = (i: number) => 34 + (i % COLS) * (BRICK_W + 4);
  const brickY = (i: number) => 44 + Math.floor(i / COLS) * (BRICK_H + 6);

  function resetBall() {
    state.ballX = state.paddleX;
    state.ballY = GAME_H - 80;
    state.vx = (Math.random() > 0.5 ? 1 : -1) * 165;
    state.vy = -215;
  }

  function remaining() {
    let n = 0;
    for (let i = 0; i < bricks.length; i++) if (bricks[i]) n++;
    return n;
  }

  function frame(dt: number) {
    if (!ctx) return;
    const step = Math.min(0.05, dt);

    if (state.running) {
      if (state.pointer !== null) {
        state.paddleX += (state.pointer * GAME_W - state.paddleX) * Math.min(1, step * 20);
      } else if (state.keys.has('ArrowLeft') || state.keys.has('KeyA')) {
        state.paddleX -= 480 * step;
      } else if (state.keys.has('ArrowRight') || state.keys.has('KeyD')) {
        state.paddleX += 480 * step;
      }
      state.paddleX = Math.max(PADDLE_W / 2, Math.min(GAME_W - PADDLE_W / 2, state.paddleX));

      state.ballX += state.vx * step;
      state.ballY += state.vy * step;

      if (state.ballX < BALL / 2) {
        state.ballX = BALL / 2;
        state.vx = Math.abs(state.vx);
      }
      if (state.ballX > GAME_W - BALL / 2) {
        state.ballX = GAME_W - BALL / 2;
        state.vx = -Math.abs(state.vx);
      }
      if (state.ballY < BALL / 2) {
        state.ballY = BALL / 2;
        state.vy = Math.abs(state.vy);
      }

      const paddleY = GAME_H - 30;
      if (state.vy > 0 && state.ballY > paddleY - BALL && state.ballY < paddleY + PADDLE_H) {
        if (Math.abs(state.ballX - state.paddleX) < PADDLE_W / 2 + BALL) {
          state.ballY = paddleY - BALL;
          state.vy = -Math.abs(state.vy);
          state.vx += (state.ballX - state.paddleX) * 2.4;
          state.vx = Math.max(-330, Math.min(330, state.vx));
        }
      }

      // cihly
      for (let i = 0; i < bricks.length; i++) {
        if (!bricks[i]) continue;
        const x = brickX(i);
        const y = brickY(i);
        if (
          state.ballX > x - BALL &&
          state.ballX < x + BRICK_W + BALL &&
          state.ballY > y - BALL &&
          state.ballY < y + BRICK_H + BALL
        ) {
          bricks[i] = 0;
          state.vy = -state.vy;
          state.score += 10;
          hooks.onScore(state.score);
          break;
        }
      }

      if (state.ballY > GAME_H + 20) {
        state.lives -= 1;
        if (state.lives <= 0) {
          state.running = false;
          hooks.onEnd(state.score);
        } else {
          resetBall();
        }
      }

      if (remaining() === 0) {
        state.running = false;
        hooks.onEnd(state.score + 50);
      }
    }

    // ── kreslení ──
    ctx.fillStyle = PARK_PALETTE.bg;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    for (let i = 0; i < bricks.length; i++) {
      if (!bricks[i]) continue;
      const row = Math.floor(i / COLS);
      ctx.fillStyle = ['#ffd166', '#e8a33d', '#7fe3d4', '#c8a2ff', '#ff9d8a'][row % 5];
      ctx.fillRect(brickX(i), brickY(i), BRICK_W, BRICK_H);
    }

    ctx.fillStyle = PARK_PALETTE.gold;
    ctx.fillRect(state.paddleX - PADDLE_W / 2, GAME_H - 30, PADDLE_W, PADDLE_H);

    ctx.beginPath();
    ctx.fillStyle = PARK_PALETTE.ink;
    ctx.arc(state.ballX, state.ballY, BALL / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 18px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = PARK_PALETTE.ink;
    ctx.fillText(String(state.score).padStart(4, '0'), 16, 26);
    ctx.fillStyle = PARK_PALETTE.red;
    ctx.textAlign = 'right';
    ctx.fillText('♥'.repeat(Math.max(0, state.lives)), GAME_W - 16, 26);

    if (!state.running) {
      ctx.fillStyle = 'rgba(5, 4, 10, 0.74)';
      ctx.fillRect(0, GAME_H / 2 - 46, GAME_W, 92);
      ctx.textAlign = 'center';
      ctx.fillStyle = PARK_PALETTE.gold;
      ctx.font = 'bold 26px ui-monospace, monospace';
      ctx.fillText(remaining() === 0 ? 'ZEĎ JE DOLE' : 'KONEC HRY', GAME_W / 2, GAME_H / 2 + 2);
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
      if (down) state.keys.add(code);
      else state.keys.delete(code);
    },
    stop: () => {
      state.running = false;
    },
  };
}
