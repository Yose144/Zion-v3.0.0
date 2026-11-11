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
import { useNet } from '@/core/net/useNet';
import { InviteButton } from '@/core/net/InviteButton';
import { play, unlock } from '@/core/audio/engine';
import { watchRoom } from '@/core/net/watch';
import { SpectatorBar } from '@/core/net/SpectatorBar';
import { useXr } from '@/core/xr';
import { describeRun, nickname as pickNickname, recordRun } from '@/core/progress/run';
import { VrButton } from '@/core/xr/VrButton';
import { isGamePaused } from '@/core/games/pause';

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
  const { store: xrStore, presenting } = useXr();
  const [info, setInfo] = useState<TanksInfo>(() => tanksInfo(state.current));
  const keys = useRef(new Set<string>());
  const [coarse, setCoarse] = useState(false);
  /** Hláška po zápase — stejná jako v ostatních hrách (žetony, rekord, level). */
  const [notice, setNotice] = useState<string | null>(null);
  const recordedOver = useRef<string | null>(null);

  // ── online ──────────────────────────────────────────────────────────
  const { joinGame, spectateRoom, leaveRoom, subscribe, sendTanksAim, sendTanksShoot, roomId } = useNet();
  /** `?watch=` = hlediště: místnost se otevře sama a my jen sledujeme. */
  const [watch, setWatch] = useState<string | null>(null);
  /** Smyčka i klávesy čtou ref — `watch` se nastaví až po mountu a efekt by jinak střílel. */
  const watching = useRef(false);
  watching.current = watch !== null;
  const [online, setOnline] = useState(false);
  const [peers, setPeers] = useState(0);
  /** Strana, kterou server přidělil (0 = vlevo, 1 = vpravo). */
  const side = useRef<0 | 1>(0);
  const sentAim = useRef({ angle: 0, power: 0 });
  const lastHitKey = useRef('');
  /** Zvukové značky: co se oproti minulému snímku změnilo. */
  const sound = useRef({ shots: 0, hitAt: 0, turn: '' as string, over: '' as string });

  useEffect(() => {
    const query = window.matchMedia('(hover: none) and (pointer: coarse)');
    const update = () => setCoarse(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const restart = useCallback(() => {
    // v online režimu zápas restartuje server (nová mapa po pár sekundách)
    if (online) return;
    state.current = rematch(state.current);
    setInfo(tanksInfo(state.current));
  }, [online]);

  /** Přepnutí online režimu: join/leave a čistý lokální stav. */
  const toggleOnline = useCallback(() => {
    if (watching.current) return;
    setOnline((was) => {
      if (was) {
        leaveRoom();
        state.current = rematch(state.current);
        setPeers(0);
      } else {
        state.current = createTanks(undefined, { autoBot: true });
        joinGame('tanks');
        setPeers(0);
      }
      setInfo(tanksInfo(state.current));
      return !was;
    });
  }, [joinGame, leaveRoom]);

  // ── hlediště ─────────────────────────────────────────────────────
  useEffect(() => {
    const room = watchRoom();
    if (!room) return;
    setWatch(room);
    setOnline(true);
    setMode('3d');
    spectateRoom('tanks', room);
    return () => leaveRoom();
  }, [spectateRoom, leaveRoom]);

  // Server posílá stav; klient ho jen přepíše do stejného `TanksState`,
  // takže oba renderery kreslí dál bez vědomí, že jde o síť.
  useEffect(() => {
    if (!online) return undefined;
    return subscribe((message) => {
      if (message.t === 'event' && message.event.kind === 'presence') {
        setPeers(message.event.members.filter((member) => member.id !== 'server').length);
        return;
      }
      if (message.t !== 'snapshot' || message.game !== 'tanks' || !message.tanks) return;
      const view = message.tanks;
      const current = state.current;
      side.current = view.you;

      if (view.terrain) {
        for (let i = 0; i < view.terrain.length && i < current.terrain.heights.length; i += 1) {
          current.terrain.heights[i] = view.terrain[i]!;
        }
        current.terrain.version = view.terrainVersion;
      }

      const slots: Array<typeof current.player> = [current.player, current.bot];
      view.tanks.forEach((tank, index) => {
        const target = slots[index];
        if (!target) return;
        target.x = tank.x;
        target.hp = tank.hp;
        target.angle = tank.angle;
        target.power = tank.power;
        target.alive = tank.alive;
      });

      current.turn = view.turn === 0 ? 'player' : 'bot';
      current.phase = view.phase;
      current.wind = view.wind;
      current.wins = { player: view.wins[0], bot: view.wins[1] };
      current.shotsFired = view.shots;
      current.over = view.over === null ? null : view.over === 0 ? 'player' : 'bot';
      current.shot = view.shot
        ? {
            x: view.shot.x,
            y: view.shot.y,
            vx: 0,
            vy: 0,
            trail: view.shot.trail,
            by: side.current === 0 ? 'player' : 'bot',
          }
        : null;

      // výbuch se pozná podle otisku (`shots` + souřadnice) — snapshoty chodí
      // 15×/s a exploze by se jinak přidala mnohokrát
      if (view.lastHit) {
        const key = `${view.shots}:${view.lastHit.x}:${view.lastHit.y}:${view.lastHit.damage}`;
        if (key !== lastHitKey.current) {
          lastHitKey.current = key;
          current.explosions.push({ x: view.lastHit.x, y: view.lastHit.y, age: 0, force: 0.6 });
          current.lastHit = {
            x: view.lastHit.x,
            y: view.lastHit.y,
            damage: view.lastHit.damage,
            by: view.lastHit.by === 0 ? 'player' : 'bot',
            at: current.now,
          };
        }
      }
    });
  }, [online, subscribe]);

  // ── smyčka: jeden krok simulace pro oba rendery ────────────────────
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    const tick = (now: number) => {
      if (isGamePaused()) {
        last = now;
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;

      const current = state.current;
      // v online režimu hraješ stranu, kterou přidělil server (0 = vlevo)
      const my: 'player' | 'bot' = online && side.current === 1 ? 'bot' : 'player';
      // Divák nesedí v žádném sedle — míření by posouvalo hlaveň a server by
      // vstupy stejně zahodil, ale lokální pohled by do dalšího snímku lhal.
      if (!watching.current && current.phase === 'aim' && current.turn === my) {
        const held = keys.current;
        let dAngle = 0;
        let dPower = 0;
        if (held.has('ArrowLeft')) dAngle -= 34 * dt;
        if (held.has('ArrowRight')) dAngle += 34 * dt;
        if (held.has('ArrowUp')) dPower += 46 * dt;
        if (held.has('ArrowDown')) dPower -= 46 * dt;
        if (dAngle || dPower) {
          adjustAim(current, my, dAngle, dPower);
          if (online) {
            const tank = my === 'player' ? current.player : current.bot;
            const moved =
              Math.abs(tank.angle - sentAim.current.angle) > 0.3 ||
              Math.abs(tank.power - sentAim.current.power) > 0.4;
            if (moved) {
              sentAim.current = { angle: tank.angle, power: tank.power };
              sendTanksAim(tank.angle, tank.power);
            }
          }
        }
      }

      if (online) {
        // server je autorita — jen dozrávají výbuchy
        current.now += dt * 1000;
        for (const blast of current.explosions) blast.age += dt;
        for (let i = current.explosions.length - 1; i >= 0; i -= 1) {
          if (current.explosions[i]!.age > 1.1) current.explosions.splice(i, 1);
        }
      } else {
        stepTanks(current, dt);
      }

      // ── zvuk ─────────────────────────────────────────────────────
      // Sólo i online se pozná podle změn ve stavu, ne podle vstupu: server
      // střílí za nás, takže „zahraj při klávese" by v multiplayeru mlčelo.
      const cues = sound.current;
      if (current.shotsFired !== cues.shots) {
        cues.shots = current.shotsFired;
        play('cannon');
      }
      const hitAt = current.lastHit?.at ?? 0;
      if (hitAt !== cues.hitAt) {
        cues.hitAt = hitAt;
        play('impact');
      }
      if (current.turn !== cues.turn) {
        // první snímek jen synchronizuje značku, aby hra nezačínala pípnutím
        if (cues.turn !== '') play('turn');
        cues.turn = current.turn;
      }
      const over = current.over ?? '';
      if (over !== cues.over) {
        cues.over = over;
        if (over && !watching.current) play(over === my ? 'victory' : 'defeat');
      }

      if (now - hudAt > 130) {
        hudAt = now;
        setInfo(tanksInfo(current));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [online]);

  // ── vstup ───────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      unlock();
      if (event.code === 'Escape') {
        onExit();
        return;
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      if (watching.current) return;
      if (event.code === 'Space') {
        if (state.current.over) restart();
        else if (online) sendTanksShoot();
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

  // ── zápis dohraného zápasu ─────────────────────────────────────────
  // Pozor: `over` se při rematchi vrací na null, takže se guard musí resetovat
  // podle hodnoty, ne podle „už jednou zapsáno".
  useEffect(() => {
    if (watching.current) return;
    if (info.phase !== 'over') {
      // rematch i odchod hru vracejí do hry — guard se musí uvolnit
      recordedOver.current = null;
      setNotice(null);
      return;
    }
    if (recordedOver.current) return;
    recordedOver.current = 'done';
    const score = Math.max(0, info.wins.player * 300 - info.wins.bot * 100);
    const outcome = recordRun({
      game: 'tanks',
      score,
      nickname: pickNickname(),
      metrics: {
        // v online režimu klient sim neposouvá, takže `elapsed` zůstane 0 —
        // pak se čas odhadne z výstřelů (lepší než jedenáct vteřin)
        seconds: info.elapsed >= 5 ? Math.round(info.elapsed) : 40 + info.shots * 4,
        completed: info.wins.player > info.wins.bot,
        objectives: info.wins.player,
        objectivesTotal: Math.max(1, info.wins.player + info.wins.bot),
        setbacks: info.wins.bot,
      },
    });
    setNotice(describeRun(outcome, true));
  }, [info.phase, info.wins.player, info.wins.bot]);

  // hra běží na celou obrazovku → navigace i chat jdou pryč
  useEffect(() => {
    document.body.dataset.playing = '1';
    return () => {
      document.body.dataset.playing = '';
    };
  }, []);

  // `info.turn` je globální strana (0/1), ne „já" — v online režimu můžeš
  // sedět vpravo, takže se to musí porovnat s přidělenou stranou.
  const mySideId = online ? side.current : 0;
  const shooter = (info.turn === 'player') === (mySideId === 0);
  const rivalLabel = online && peers > 1 ? 'SOUPEŘ MÍŘÍ' : 'BOT MÍŘÍ';
  const hpPlayer = Math.round((info.playerHp / TANK_HP) * 100);
  const hpBot = Math.round((info.botHp / TANK_HP) * 100);
  const press = (code: string, action: 'hold' | 'tap') => {
    if (watch) return;
    unlock();
    if (action === 'tap') {
      if (code === 'Space') {
        if (state.current.over) restart();
        else if (online) sendTanksShoot();
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
        <InviteButton roomId={online ? roomId : null} className="tanks-invite" />
        {mode === '3d' && <VrButton xr={{ store: xrStore, presenting }} className="arena-vr" />}
        <button
          type="button"
          className={`tanks-online${online ? ' is-on' : ''}`}
          onClick={toggleOnline}
          aria-pressed={online}
          disabled={watch !== null}
        >
          {watch ? 'Díváš se' : online ? 'Online 1v1' : 'Hrát online'}
        </button>
        <button type="button" className="tanks-exit" onClick={onExit}>
          Zpět na Kroniky
        </button>
      </header>

      {watch && <SpectatorBar room={watch} className="tanks-spectator" />}

      <div className="tanks-stage">
        {/* Ve VR se vždy kreslí 3D — 2D plátno v headsetu nemá hloubku ani kurzor. */}
        {mode === '2d' && !presenting ? (
          <TanksCanvas state={state} compact={coarse} />
        ) : (
          <TanksScene state={state} xrStore={xrStore} xr={presenting} />
        )}
      </div>

      {(mode === '3d' || coarse) && (
        <div className="tanks-hud" aria-hidden>
          <span className={`tanks-turn${shooter ? ' is-you' : ''}`}>
            {watch
              ? 'DÍVÁŠ SE'
              : info.phase === 'over'
                ? info.wins.player > info.wins.bot
                  ? 'VÍTĚZSTVÍ'
                  : 'PORÁŽKA'
                : shooter
                  ? 'TVŮJ TAH'
                  : rivalLabel}
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
            {watch ? 'LEVÝ' : 'TY'}
            <i>
              <b style={{ width: `${hpPlayer}%` }} />
            </i>
          </span>
          <span className="tanks-hp is-bot">
            {watch ? 'PRAVÝ' : 'BOT'}
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
        <span>
          {watch
            ? 'díváš se · míření a palba patří hráčům v sedlech'
            : online
              ? peers > 1
                ? 'online · soupeř připojen'
                : 'online · prázdné sedlo hraje bot (kdokoli se může připojit)'
              : HINTS[mode].cs}
        </span>
        {notice && <span className="tanks-notice">{notice}</span>}
        <span className="tanks-foot-right">
          {info.phase === 'over' && !watch ? (
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

      {coarse && info.phase === 'over' && !watch && (
        <button type="button" className="tanks-touch-again" onClick={restart}>
          NOVÁ HRA
        </button>
      )}

      {coarse && !watch && (
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
