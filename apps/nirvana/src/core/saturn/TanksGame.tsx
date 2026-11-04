'use client';

/**
 * TANKY — obal kolem sdílené simulace.
 *
 * Drží **jeden** krok simulace pro oba rendery (2D canvas i 3D scéna), takže
 * se obě verze nemůžou rozejít v čase ani v pravidlech. Renderery jen čtou
 * `state.current`; vstup (klávesnice i dotyk) jde do stejných funkcí
 * (`adjustAim`, `fire`).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createTanks,
  fire,
  rematch,
  adjustAim,
  stepTanks,
  tanksInfo,
  TANK_HP,
  type TanksInfo,
  type TanksState,
} from './tanks';
import { TanksCanvas } from './TanksCanvas';
import { TanksScene } from './TanksScene';

type Mode = '2d' | '3d';

const HINTS: Record<Mode, { cs: string; en: string }> = {
  '2d': {
    cs: '← → úhel · ↑ ↓ síla · mezerník palba',
    en: '← → angle · ↑ ↓ power · space fires',
  },
  '3d': {
    cs: 'Stejná pravidla, jiný pohled · kamera letí za střelou',
    en: 'Same rules, different view · the camera follows the shell',
  },
};

export function TanksGame({ onExit }: { onExit: () => void }) {
  const state = useRef<TanksState>(createTanks());
  const [mode, setMode] = useState<Mode>('2d');
  const [info, setInfo] = useState<TanksInfo>(() => tanksInfo(state.current));
  const keys = useRef(new Set<string>());
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(hover: none) and (pointer: coarse)');
    const update = () => setCoarse(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const restart = useCallback(() => {
    state.current = rematch(state.current);
    setInfo(tanksInfo(state.current));
  }, []);

  // ── smyčka: jeden krok simulace pro oba rendery ────────────────────
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;

      const current = state.current;
      if (current.phase === 'aim' && current.turn === 'player') {
        const held = keys.current;
        let dAngle = 0;
        let dPower = 0;
        if (held.has('ArrowLeft')) dAngle -= 34 * dt;
        if (held.has('ArrowRight')) dAngle += 34 * dt;
        if (held.has('ArrowUp')) dPower += 46 * dt;
        if (held.has('ArrowDown')) dPower -= 46 * dt;
        if (dAngle || dPower) adjustAim(current, 'player', dAngle, dPower);
      }

      stepTanks(current, dt);

      if (now - hudAt > 130) {
        hudAt = now;
        setInfo(tanksInfo(current));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── vstup ───────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        onExit();
        return;
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      if (event.code === 'Space') {
        if (state.current.over) restart();
        else fire(state.current, 'player');
        return;
      }
      if (event.code === 'KeyR') {
        restart();
        return;
      }
      keys.current.add(event.code);
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [onExit, restart]);

  // hra běží na celou obrazovku → navigace i chat jdou pryč
  useEffect(() => {
    document.body.dataset.playing = '1';
    return () => {
      document.body.dataset.playing = '';
    };
  }, []);

  const shooter = info.turn === 'player';
  const hpPlayer = Math.round((info.playerHp / TANK_HP) * 100);
  const hpBot = Math.round((info.botHp / TANK_HP) * 100);
  const press = (code: string, action: 'hold' | 'tap') => {
    if (action === 'tap') {
      if (code === 'Space') {
        if (state.current.over) restart();
        else fire(state.current, 'player');
      }
      return;
    }
    keys.current.add(code);
    window.setTimeout(() => keys.current.delete(code), 140);
  };

  return (
    <section className={`tanks is-${mode}`} aria-label="Tanky">
      <header className="tanks-chrome">
        <strong>TANKY</strong>
        <div className="tanks-modes" role="tablist" aria-label="Verze hry">
          <button
            type="button"
            role="tab"
            aria-selected={mode === '2d'}
            className={mode === '2d' ? 'is-active' : ''}
            onClick={() => setMode('2d')}
          >
            OLDSCHOOL 2D
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === '3d'}
            className={mode === '3d' ? 'is-active' : ''}
            onClick={() => setMode('3d')}
          >
            3D NOVÉ
          </button>
        </div>
        <button type="button" className="tanks-exit" onClick={onExit}>
          Zpět na Kroniky
        </button>
      </header>

      <div className="tanks-stage">
        {mode === '2d' ? <TanksCanvas state={state} compact={coarse} /> : <TanksScene state={state} />}
      </div>

      {(mode === '3d' || coarse) && (
        <div className="tanks-hud" aria-hidden>
          <span className={`tanks-turn${shooter ? ' is-you' : ''}`}>
            {info.phase === 'over'
              ? info.wins.player > info.wins.bot
                ? 'VÍTĚZSTVÍ'
                : 'PORÁŽKA'
              : shooter
                ? 'TVŮJ TAH'
                : 'BOT MÍŘÍ'}
          </span>
          <span className="tanks-stat">
            ÚHEL <b>{info.angle}°</b>
          </span>
          <span className="tanks-stat">
            SÍLA <b>{info.power}</b>
          </span>
          <span className="tanks-stat">
            VÍTR <b>{info.wind > 0 ? `→ ${info.wind}` : info.wind < 0 ? `← ${-info.wind}` : '—'}</b>
          </span>
          <span className="tanks-hp">
            TY
            <i>
              <b style={{ width: `${hpPlayer}%` }} />
            </i>
          </span>
          <span className="tanks-hp is-bot">
            BOT
            <i>
              <b style={{ width: `${hpBot}%` }} />
            </i>
          </span>
          <span className="tanks-score">
            {info.wins.player} : {info.wins.bot}
          </span>
        </div>
      )}

      <footer className="tanks-foot">
        <span>{HINTS[mode].cs}</span>
        <span className="tanks-foot-right">
          {info.phase === 'over' ? (
            <button type="button" className="tanks-again" onClick={restart}>
              Nová hra (R)
            </button>
          ) : (
            <span className="tanks-damage">
              {info.lastDamage != null ? `poslední zásah −${info.lastDamage}` : 'bez zásahu'}
            </span>
          )}
        </span>
      </footer>

      {coarse && info.phase === 'over' && (
        <button type="button" className="tanks-touch-again" onClick={restart}>
          NOVÁ HRA
        </button>
      )}

      {coarse && (
        <div className="tanks-touch">
          <div className="tanks-touch-pad">
            <button type="button" onPointerDown={() => press('ArrowLeft', 'hold')} aria-label="úhel doleva">
              ◀
            </button>
            <button type="button" onPointerDown={() => press('ArrowRight', 'hold')} aria-label="úhel doprava">
              ▶
            </button>
            <button type="button" onPointerDown={() => press('ArrowUp', 'hold')} aria-label="síla nahoru">
              ▲
            </button>
            <button type="button" onPointerDown={() => press('ArrowDown', 'hold')} aria-label="síla dolů">
              ▼
            </button>
          </div>
          <button type="button" className="tanks-touch-fire" onClick={() => press('Space', 'tap')}>
            PALBA
          </button>
        </div>
      )}
    </section>
  );
}
