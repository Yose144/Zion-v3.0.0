'use client';

/**
 * FLOTILA — volný let mezi Nabukanem a Issobellou.
 *
 * Hra nemá skóre ani soupeře: jde o to **doletět a přistát**. Lodě jsou ty,
 * které si člověk může koupit v marketu (`SHIPS`), doky jsou dvě skutečná
 * místa Nirvany — mateřská loď Nabukano a stanice na prstenci Issobella.
 *
 * Stránka drží jen to, co je skutečně UI: výběr lodi, HUD, panel po přistání
 * a dotykové ovládání. Simulace je v `core/fleet/flight.ts`, scéna ve
 * `FleetScene.tsx` — díky tomu jde let otestovat bez prohlížeče.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { fill, tx, useI18n } from '@/core/i18n';
import { FleetCanvas, type FleetStats, type RemotePilot } from '@/core/fleet/FleetScene';
import { SHIPS, shipById, DEFAULT_SHIP } from '@/core/fleet/ships';
import { DOCK_HOLD, DOCK_RADIUS } from '@/core/fleet/flight';
import { play, startEngineLoop, unlock, type LoopHandle } from '@/core/audio/engine';
import { useNet } from '@/core/net/useNet';
import { InviteButton } from '@/core/net/InviteButton';
import { SpectatorBar } from '@/core/net/SpectatorBar';
import { watchRoom } from '@/core/net/watch';
import { TouchButton } from '@/core/games/TouchPad';
import { FLEET_COPY, type FleetCopyKey } from './copy';

type Phase = 'intro' | 'flying';

const EMPTY_STATS: FleetStats = {
  x: 0,
  y: 0,
  z: 0,
  speed: 0,
  boost: 1,
  dockProgress: 0,
  dockId: null,
  docked: null,
  travelled: 0,
  nearest: null,
  heading: 0,
  altitude: 0,
};

/**
 * Start: 24 jednotek od Nové Země, mezi planetou a Nabukanem — v záběru jsou
 * **obě** (planeta ~24° vlevo, flotila ~31° vpravo), takže je hned vidět, že
 * se letí od planety k lodi. Start těsně u trupu vypadal jako temná stěna
 * a hráč nevěděl, co vidí.
 */
const START = { x: -6, y: 7, z: 24, yaw: 2.68 };

export default function FleetPage() {
  const { lang } = useI18n();
  /** Texty obrazovky jdou přes `./copy` — žádné `cs ? :` v JSX. */
  const l = useCallback(
    (key: FleetCopyKey, values?: Record<string, string | number>) => {
      const text = tx(FLEET_COPY[key], lang);
      return values ? fill(text, values) : text;
    },
    [lang],
  );
  const cs = lang === 'cs';

  const [phase, setPhase] = useState<Phase>('intro');
  const [shipId, setShipId] = useState(DEFAULT_SHIP);
  const [stats, setStats] = useState<FleetStats>(EMPTY_STATS);
  const [docked, setDocked] = useState<string | null>(null);
  const [undockSignal, setUndockSignal] = useState(0);
  const [coarse, setCoarse] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [run, setRun] = useState(0);
  const lastDock = useRef<string | null>(null);

  // ── společný let ───────────────────────────────────────────────────
  const { subscribe, joinFleet, leaveRoom, sendFlight, spectateRoom, connected, roomId } = useNet();
  /**
   * Hlediště: `?watch=fleet-1` z lobby nebo z chatu. Čte se v efektu (na
   * serveru `window` není) a **neprosazuje se do `intro`** — divák nemá
   * vybírat loď, takže jde rovnou do scény.
   */
  const [watchId, setWatchId] = useState<string | null>(null);
  /** `true` = letí se s ostatními; sólo zůstává výchozí. */
  const [coop, setCoop] = useState(false);
  /** Ostatní piloti chodí 15×/s, takže v refu — ne v React state. */
  const remotes = useRef<RemotePilot[]>([]);
  const [peers, setPeers] = useState(0);
  /** Kotviště obsazená někým jiným (server je posílá ve snapshotu). */
  const [occupied, setOccupied] = useState<string[]>([]);
  /** Poslední zpracovaný konflikt — aby hláška nevznikala 15×/s. */
  const conflictSeen = useRef<string | null>(null);
  const occupiedSignature = useRef('');
  /**
   * Spojitý zvuk motoru — **stejný** jako ve Venuši (`startEngineLoop`).
   * Vlastní loop by byl druhý motor v jedné hře; tady se jen řídí plynem.
   */
  const thruster = useRef<LoopHandle | null>(null);
  const boosting = useRef(false);

  /** Debug háček se čte při prvním renderu — efekt by ho nestihl (viz AGENTS). */
  useEffect(() => {
    const room = watchRoom();
    if (!room) return;
    setWatchId(room);
    setCoop(true);
    setPhase('flying');
  }, []);

  const debug = useMemo(
    () => (typeof window === 'undefined' ? false : new URLSearchParams(window.location.search).has('fleetDebug')),
    [],
  );

  const spec = useMemo(() => shipById(shipId), [shipId]);

  // motor běží jen za letu a jen když letí člověk (divák nic neslyší)
  useEffect(() => {
    if (phase !== 'flying' || watchId) return;
    thruster.current = startEngineLoop();
    thruster.current?.setIntensity(0.15);
    return () => {
      thruster.current?.stop();
      thruster.current = null;
    };
  }, [phase, watchId]);

  // plyn/rychlost řídí výšku i jas motoru
  useEffect(() => {
    const top = spec.maxSpeed * spec.boost;
    thruster.current?.setIntensity(Math.min(1, Math.abs(stats.speed) / top));
  }, [stats.speed, spec]);

  // boost je slyšet jen při zažehnutí, ne po celou dobu
  useEffect(() => {
    const active = stats.boost < 0.999 && stats.speed > spec.maxSpeed * 0.55;
    if (active && !boosting.current) play('gust');
    boosting.current = active;
  }, [stats.boost, stats.speed, spec]);

  useEffect(() => {
    const query = window.matchMedia('(hover: none) and (pointer: coarse)');
    const update = () => setCoarse(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  // během letu schovej navigaci a chat — celá obrazovka patří obloze
  useEffect(() => {
    document.body.dataset.playing = phase === 'flying' ? '1' : '';
    return () => {
      document.body.dataset.playing = '';
    };
  }, [phase]);

  const start = useCallback(() => {
    unlock();
    play('countdown');
    lastDock.current = null;
    setStats(EMPTY_STATS);
    setDocked(null);
    setNotice(null);
    setRun((value) => value + 1);
    setPhase('flying');
  }, []);

  const onStats = useCallback((next: FleetStats) => {
    setStats(next);
  }, []);

  const onDock = useCallback(
    (dockId: string | null) => {
      setDocked(dockId);
      if (dockId && dockId !== lastDock.current) {
        lastDock.current = dockId;
        play('lock');
        setNotice(
          dockId.startsWith('nabukano')
            ? cs
              ? `Přistáno na Nabukanu — ${dockId.replace('nabukano-', 'kotviště ')}`
              : `Docked at Nabukano — ${dockId.replace('nabukano-', 'berth ')}`
            : l('dockedIssobella'),
        );
        window.setTimeout(() => setNotice(null), 4200);
      }
      if (!dockId) lastDock.current = null;
    },
    [cs],
  );

  const leave = useCallback(() => {
    setPhase('intro');
    setDocked(null);
  }, []);

  // snapshoty společného letu
  useEffect(() => {
    if (!coop) return;
    return subscribe((message) => {
      if (message.t !== 'snapshot' || message.game !== 'fleet' || !message.fleet) return;
      remotes.current = message.fleet.pilots;
      setPeers(message.fleet.pilots.length);

      // Obsazenost: stav mění jen občas, takže se `setState` volá jen při
      // změně (15 snapshotů/s by jinak překreslovalo celou stránku).
      const free = message.fleet.occupied ?? [];
      const signature = free.join(',');
      if (signature !== occupiedSignature.current) {
        occupiedSignature.current = signature;
        setOccupied(free);
      }

      // Server odmítl kotviště (bylo obsazené) — vlastní simulace ho drží
      // dál, takže se loď musí odpojit a hráč to musí vidět.
      const conflict = message.fleet.conflict ?? null;
      if (conflict && conflict !== conflictSeen.current) {
        conflictSeen.current = conflict;
        play('block');
        setNotice(
          cs
            ? `Kotviště ${conflict.replace('nabukano-', 'Nabukano ')} je obsazené — letíš na jiné`
            : `Berth ${conflict.replace('nabukano-', 'Nabukano ')} is taken — pick another`,
        );
        window.setTimeout(() => setNotice(null), 4200);
        setUndockSignal((value) => value + 1);
      } else if (!conflict) {
        conflictSeen.current = null;
      }
    });
  }, [coop, subscribe]);

  // připojení / odpojení podle fáze — divák se připojí do hlediště
  useEffect(() => {
    if (!coop || phase !== 'flying' || !connected) return;
    if (watchId) spectateRoom('fleet', watchId);
    else joinFleet(shipId);
    return () => {
      leaveRoom();
      remotes.current = [];
      setPeers(0);
    };
  }, [coop, phase, connected, joinFleet, leaveRoom, shipId, spectateRoom, watchId]);

  /** Stav letu do sítě — `sendFlight` si sám hlídá 20 Hz i změnu doku. */
  const relay = useCallback(
    (ship: { x: number; y: number; z: number; yaw: number; pitch: number; roll: number; speed: number; docked: string | null }) => {
      sendFlight({
        x: ship.x,
        y: ship.y,
        z: ship.z,
        yaw: ship.yaw,
        pitch: ship.pitch,
        roll: ship.roll,
        speed: ship.speed,
        docked: Boolean(ship.docked),
        dockId: ship.docked ?? undefined,
      });
    },
    [sendFlight],
  );

  const nearest = stats.nearest;
  const occupiedOthers = occupied.filter((id) => id !== stats.docked);
  const nearestTaken = nearest ? occupiedOthers.includes(nearest.id) : false;
  const targetName = nearest
    ? nearest.kind === 'nabukano'
      ? l('nabukano')
      : 'Issobella'
    : '—';
  const speedPct = Math.min(1, stats.speed / (spec.maxSpeed * spec.boost));

  return (
    <main className={`fleet ${phase === 'flying' ? 'is-flying' : ''}`}>
      {phase === 'flying' && (
        <FleetCanvas
          key={`${spec.id}-${run}`}
          spec={spec}
          start={START}
          onStats={onStats}
          onDock={onDock}
          undockSignal={undockSignal}
          debug={debug}
          remotes={coop ? remotes : undefined}
          onFlight={coop ? relay : undefined}
          spectator={Boolean(watchId)}
        />
      )}

      {phase === 'flying' && (
        <>
          <div className="fleet-hud">
            <div className="fleet-ship">
              <strong>{watchId ? (l('spectator')) : spec.name}</strong>
              <span>
                {watchId
                  ? l('watching')
                  : cs
                    ? spec.role.cs
                    : spec.role.en}
              </span>
            </div>
            {!watchId && (
            <div className="fleet-gauges">
              <span>
                <em>{l('speed')}</em> {Math.round(Math.abs(stats.speed) * 10)}
              </span>
              <span>
                <em>{l('heading')}</em> {Math.round(stats.heading)}°
              </span>
              <span>
                <em>{l('altitude')}</em> {Math.max(0, Math.round(stats.altitude))}
              </span>
            </div>
            )}
            {coop && (
              <div className="fleet-peers">
                <span>{connected ? (l('sharedFlight')) : l('offline')}</span>
                <strong>{peers + 1}</strong>
                {roomId && <em>{roomId}</em>}
                {roomId && <InviteButton roomId={roomId} className="fleet-invite" />}
              </div>
            )}
            {!watchId && (
            <div className="fleet-bars">
              <div className="fleet-bar">
                <span>{l('thrust')}</span>
                <i style={{ width: `${Math.round(speedPct * 100)}%` }} />
              </div>
              <div className="fleet-bar is-boost">
                <span>boost</span>
                <i style={{ width: `${Math.round(stats.boost * 100)}%` }} />
              </div>
            </div>
            )}
          </div>

          {watchId && <SpectatorBar room={watchId} />}
          {!watchId && (
          <div className="fleet-target">
            <span className="fleet-target-kind">{l('nearestDock')}</span>
            <strong>{targetName}</strong>
            <span>
              {nearest ? `${nearest.distance.toFixed(1)} j.` : '—'}
              {nearestTaken && (
                <em className="fleet-taken">{cs ? ' · obsazeno' : ' · taken'}</em>
              )}
            </span>
            {stats.dockId && stats.dockProgress > 0.02 && (
              <div className="fleet-dock-progress">
                <i style={{ width: `${Math.round(stats.dockProgress * 100)}%` }} />
              </div>
            )}
          </div>
          )}

          {!coarse && !watchId && (
            <div className="fleet-keys">
              {l('keys')}
            </div>
          )}

          {stats.dockId && stats.dockProgress > 0.05 && !docked && (
            <div className="fleet-hint">
              {l('holdAtDock')}{' '}
              {Math.round((stats.dockProgress / 1) * 100)}%
            </div>
          )}

          {notice && <div className="fleet-notice">{notice}</div>}

          {docked && (
            <div className="fleet-docked" role="dialog" aria-label={l('docked')}>
              <h2>{docked.startsWith('nabukano') ? 'Nabukano' : 'Issobella'}</h2>
              <p>
                {docked.startsWith('nabukano')
                  ? l('motherShipNote')
                  : l('ringNote')}
              </p>
              <div className="fleet-docked-actions">
                <button
                  type="button"
                  onClick={() => {
                    play('turn');
                    setUndockSignal((value) => value + 1);
                    setDocked(null);
                  }}
                >
                  {l('undock')}
                </button>
                <button type="button" className="is-ghost" onClick={leave}>
                  {l('backToHangar')}
                </button>
              </div>
            </div>
          )}

          <button type="button" className="fleet-exit" onClick={leave}>
            ← {l('hangar')}
          </button>

          {coarse && !watchId && (
            <>
              <div className="fleet-touch is-left">
                <TouchButton code="KeyA" className="is-round">
                  ←
                </TouchButton>
                <div className="fleet-touch-col">
                  <TouchButton code="ArrowUp" className="is-round">
                    ↑
                  </TouchButton>
                  <TouchButton code="ArrowDown" className="is-round">
                    ↓
                  </TouchButton>
                </div>
                <TouchButton code="KeyD" className="is-round">
                  →
                </TouchButton>
              </div>
              <div className="fleet-touch is-right">
                <TouchButton code="KeyW" className="is-wide">
                  {l('throttle')}
                </TouchButton>
                <TouchButton code="KeyS" className="is-wide is-dim">
                  {l('brake')}
                </TouchButton>
                <TouchButton code="ShiftLeft" className="is-wide is-boost">
                  BOOST
                </TouchButton>
              </div>
            </>
          )}
        </>
      )}

      {phase === 'intro' && (
        <div className="fleet-hangar">
          <header>
            <p className="fleet-kicker">{l('kicker')}</p>
            <h1>{l('title')}</h1>
            <p className="fleet-lead">
              {l('intro')}
            </p>
          </header>

          <div className="fleet-grid">
            {SHIPS.map((ship) => (
              <button
                key={ship.id}
                type="button"
                className={`fleet-card ${ship.id === shipId ? 'is-active' : ''}`}
                onClick={() => {
                  setShipId(ship.id);
                  play('turn');
                }}
              >
                <span className="fleet-card-name">{ship.name}</span>
                <span className="fleet-card-role">{tx(ship.role, lang)}</span>
                <span className="fleet-card-stats">
                  <i style={{ width: `${Math.round((ship.maxSpeed / 12) * 100)}%` }} />
                </span>
              </button>
            ))}
          </div>

          <div className="fleet-launch">
            <button type="button" onClick={start}>
              {l('launch')}
            </button>
            <button
              type="button"
              className={`fleet-coop ${coop ? 'is-active' : ''}`}
              onClick={() => {
                setCoop((value) => !value);
                play('turn');
              }}
              aria-pressed={coop}
            >
              {coop ? (l('flyingTogether')) : l('flyWithOthers')}
            </button>
            <Link href="/multiplayer">{l('onlineRooms')}</Link>
          </div>

          <p className="fleet-homage-note">
            {l('tribute')}
          </p>

          {coop && (
            <p className="fleet-coop-note">
              {l('roomNote')}
            </p>
          )}

          <footer className="fleet-foot">
            {l('dockNote', { hold: DOCK_HOLD, radius: DOCK_RADIUS })}
          </footer>
        </div>
      )}
    </main>
  );
}
