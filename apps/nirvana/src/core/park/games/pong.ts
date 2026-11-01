import {
  GAME_H,
  GAME_W,
  PARK_PALETTE,
  prepareCanvas,
  type ParkGameHandle,
  type ParkGameHooks,
} from './types';

/**
 * PONG — hráč dole, zeď nahoře. Paddle se hýbe vodorovně, takže stejný vstup
 * funguje pro myš, dotyk i VR paprsek. Do sedmi bodů, pak konec.
 */

const WIN = 7;
const PADDLE_W = 86;
const PADDLE_H = 12;
const BALL = 9;

export function createPong(canvas: HTMLCanvasElement, hooks: ParkGameHooks): ParkGameHandle {
  const ctx = prepareCanvas(canvas);
  const state = {
    playerX: GAME_W / 2,
    cpuX: GAME_W / 2,
    ballX: GAME_W / 2,
    ballY: GAME_H / 2,
    vx: 150,
    vy: -190,
    player: 0,
    cpu: 0,
    running: true,
    pointer: null as number | null,
    keys: new Set<string>(),
    flash: 0,
  };

  function resetBall(towardsPlayer: boolean) {
    state.ballX = GAME_W / 2;
    state.ballY = GAME_H / 2;
    const speed = 190 + Math.min(140, (state.player + state.cpu) * 22);
    state.vx = (Math.random() > 0.5 ? 1 : -1) * speed * 0.7;
    state.vy = (towardsPlayer ? 1 : -1) * speed;
  }

  function end() {
    if (!state.running) return;
    state.running = false;
    hooks.onEnd(state.player * 100);
  }

  function frame(dt: number) {
    if (!ctx) return;
    const step = Math.min(0.05, dt);

    if (state.running) {
      // hráč: ukazatel má přednost, klávesy jsou záloha (VR, klávesnice)
      if (state.pointer !== null) {
        state.playerX += (state.pointer * GAME_W - state.playerX) * Math.min(1, step * 18);
      } else if (state.keys.has('ArrowLeft') || state.keys.has('KeyA')) {
        state.playerX -= 460 * step;
      } else if (state.keys.has('ArrowRight') || state.keys.has('KeyD')) {
        state.playerX += 460 * step;
      }
      state.playerX = Math.max(PADDLE_W / 2, Math.min(GAME_W - PADDLE_W / 2, state.playerX));

      // protihráč: dohání míček, ale pomalu — dá se porazit
      const cpuTarget = state.ballX + Math.sin(state.ballY * 0.02) * 26;
      state.cpuX += (cpuTarget - state.cpuX) * Math.min(1, step * 3.2);
      state.cpuX = Math.max(PADDLE_W / 2, Math.min(GAME_W - PADDLE_W / 2, state.cpuX));

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

      const playerY = GAME_H - 34;
      const cpuY = 22;

      if (state.vy > 0 && state.ballY > playerY - BALL && state.ballY < playerY + PADDLE_H) {
        if (Math.abs(state.ballX - state.playerX) < PADDLE_W / 2 + BALL) {
          state.ballY = playerY - BALL;
          state.vy = -Math.abs(state.vy) * 1.04;
          state.vx += (state.ballX - state.playerX) * 2.2;
          state.vx = Math.max(-320, Math.min(320, state.vx));
          state.flash = 0.16;
        }
      }
      if (state.vy < 0 && state.ballY < cpuY + BALL && state.ballY > cpuY - PADDLE_H) {
        if (Math.abs(state.ballX - state.cpuX) < PADDLE_W / 2 + BALL) {
          state.ballY = cpuY + BALL;
          state.vy = Math.abs(state.vy) * 1.04;
          state.vx += (state.ballX - state.cpuX) * 1.4;
          state.vx = Math.max(-320, Math.min(320, state.vx));
          state.flash = 0.12;
        }
      }

      if (state.ballY > GAME_H + 20) {
        state.cpu += 1;
        hooks.onScore(state.player * 100);
        if (state.cpu >= WIN) end();
        else resetBall(false);
      } else if (state.ballY < -20) {
        state.player += 1;
        hooks.onScore(state.player * 100);
        if (state.player >= WIN) end();
        else resetBall(true);
      }

      if (state.flash > 0) state.flash -= step;
    }

    // ── kreslení ──
    ctx.fillStyle = PARK_PALETTE.bg;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    ctx.strokeStyle = 'rgba(255, 209, 102, 0.18)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 12]);
    ctx.beginPath();
    ctx.moveTo(0, GAME_H / 2);
    ctx.lineTo(GAME_W, GAME_H / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = PARK_PALETTE.gold;
    ctx.fillRect(state.playerX - PADDLE_W / 2, GAME_H - 34, PADDLE_W, PADDLE_H);
    ctx.fillStyle = PARK_PALETTE.cyan;
    ctx.fillRect(state.cpuX - PADDLE_W / 2, 22, PADDLE_W, PADDLE_H);

    ctx.beginPath();
    ctx.fillStyle = state.flash > 0 ? '#fff6dc' : PARK_PALETTE.ink;
    ctx.arc(state.ballX, state.ballY, BALL / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 40px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(255, 209, 102, 0.75)';
    ctx.textAlign = 'center';
    ctx.fillText(String(state.player), GAME_W / 2, GAME_H - 52);
    ctx.fillStyle = 'rgba(127, 227, 212, 0.75)';
    ctx.fillText(String(state.cpu), GAME_W / 2, 74);

    ctx.font = '12px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(244, 234, 210, 0.45)';
    ctx.fillText('PONG · do 7', GAME_W / 2, GAME_H - 8);

    if (!state.running) {
      ctx.fillStyle = 'rgba(5, 4, 10, 0.72)';
      ctx.fillRect(0, GAME_H / 2 - 44, GAME_W, 88);
      ctx.fillStyle = PARK_PALETTE.gold;
      ctx.font = 'bold 26px ui-monospace, monospace';
      ctx.fillText(state.player > state.cpu ? 'VYHRÁL JSI' : 'KONEC HRY', GAME_W / 2, GAME_H / 2 + 4);
      ctx.font = '13px ui-monospace, monospace';
      ctx.fillStyle = PARK_PALETTE.ink;
      ctx.fillText('klikni pro novou hru', GAME_W / 2, GAME_H / 2 + 28);
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
