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
import { useI18n } from '@/core/i18n';
import { FleetCanvas, type FleetStats, type RemotePilot } from '@/core/fleet/FleetScene';
import { SHIPS, shipById, DEFAULT_SHIP } from '@/core/fleet/ships';
import { DOCK_HOLD, DOCK_RADIUS } from '@/core/fleet/flight';
import { play, unlock } from '@/core/audio/engine';
import { useNet } from '@/core/net/useNet';
import { InviteButton } from '@/core/net/InviteButton';
import { TouchButton } from '@/core/games/TouchPad';

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
  const { subscribe, joinFleet, leaveRoom, sendFlight, connected, roomId } = useNet();
  /** `true` = letí se s ostatními; sólo zůstává výchozí. */
  const [coop, setCoop] = useState(false);
  /** Ostatní piloti chodí 15×/s, takže v refu — ne v React state. */
  const remotes = useRef<RemotePilot[]>([]);
  const [peers, setPeers] = useState(0);

  /** Debug háček se čte při prvním renderu — efekt by ho nestihl (viz AGENTS). */
  const debug = useMemo(
    () => (typeof window === 'undefined' ? false : new URLSearchParams(window.location.search).has('fleetDebug')),
    [],
  );

  const spec = useMemo(() => shipById(shipId), [shipId]);

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
            : cs
              ? 'Přistáno na Issobelle'
              : 'Docked at Issobella',
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
    });
  }, [coop, subscribe]);

  // připojení / odpojení podle fáze
  useEffect(() => {
    if (!coop || phase !== 'flying' || !connected) return;
    joinFleet(shipId);
    return () => {
      leaveRoom();
      remotes.current = [];
      setPeers(0);
    };
  }, [coop, phase, connected, joinFleet, leaveRoom, shipId]);

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
  const targetName = nearest
    ? nearest.kind === 'nabukano'
      ? cs
        ? 'Nabukano'
        : 'Nabukano'
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
        />
      )}

      {phase === 'flying' && (
        <>
          <div className="fleet-hud">
            <div className="fleet-ship">
              <strong>{spec.name}</strong>
              <span>{cs ? spec.role.cs : spec.role.en}</span>
            </div>
            <div className="fleet-gauges">
              <span>
                <em>{cs ? 'rychlost' : 'speed'}</em> {Math.round(Math.abs(stats.speed) * 10)}
              </span>
              <span>
                <em>{cs ? 'kurz' : 'heading'}</em> {Math.round(stats.heading)}°
              </span>
              <span>
                <em>{cs ? 'výška' : 'altitude'}</em> {Math.max(0, Math.round(stats.altitude))}
              </span>
            </div>
            {coop && (
              <div className="fleet-peers">
                <span>{connected ? (cs ? 'společný let' : 'shared flight') : cs ? 'offline' : 'offline'}</span>
                <strong>{peers + 1}</strong>
                {roomId && <em>{roomId}</em>}
                {roomId && <InviteButton roomId={roomId} className="fleet-invite" />}
              </div>
            )}
            <div className="fleet-bars">
              <div className="fleet-bar">
                <span>{cs ? 'tah' : 'thrust'}</span>
                <i style={{ width: `${Math.round(speedPct * 100)}%` }} />
              </div>
              <div className="fleet-bar is-boost">
                <span>boost</span>
                <i style={{ width: `${Math.round(stats.boost * 100)}%` }} />
              </div>
            </div>
          </div>

          <div className="fleet-target">
            <span className="fleet-target-kind">{cs ? 'nejbližší dok' : 'nearest dock'}</span>
            <strong>{targetName}</strong>
            <span>{nearest ? `${nearest.distance.toFixed(1)} j.` : '—'}</span>
            {stats.dockId && stats.dockProgress > 0.02 && (
              <div className="fleet-dock-progress">
                <i style={{ width: `${Math.round(stats.dockProgress * 100)}%` }} />
              </div>
            )}
          </div>

          {!coarse && (
            <div className="fleet-keys">
              {cs
                ? 'W plyn · S brzda · A/D zatáčení · ↑↓ klopení · Q/E náklon · Shift boost'
                : 'W throttle · S brake · A/D yaw · ↑↓ pitch · Q/E roll · Shift boost'}
            </div>
          )}

          {stats.dockId && stats.dockProgress > 0.05 && !docked && (
            <div className="fleet-hint">
              {cs ? 'Drž se u doku…' : 'Hold at the dock…'}{' '}
              {Math.round((stats.dockProgress / 1) * 100)}%
            </div>
          )}

          {notice && <div className="fleet-notice">{notice}</div>}

          {docked && (
            <div className="fleet-docked" role="dialog" aria-label={cs ? 'Přistáno' : 'Docked'}>
              <h2>{docked.startsWith('nabukano') ? 'Nabukano' : 'Issobella'}</h2>
              <p>
                {docked.startsWith('nabukano')
                  ? cs
                    ? 'Stojíš na dokovacím rámu mateřské lodi. Rám se otáčí s flotilou, takže i dok jede.'
                    : 'You are standing on the mother ship dock frame. The frame rotates with the fleet, so the dock moves too.'
                  : cs
                    ? 'Stanice na prstenci L6. Prstenec se otáčí, dok jede s ním.'
                    : 'The L6 ring station. The ring rotates and the dock moves with it.'}
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
                  {cs ? 'Odpojit se' : 'Undock'}
                </button>
                <button type="button" className="is-ghost" onClick={leave}>
                  {cs ? 'Zpět do výběru' : 'Back to hangar'}
                </button>
              </div>
            </div>
          )}

          <button type="button" className="fleet-exit" onClick={leave}>
            ← {cs ? 'Hangár' : 'Hangar'}
          </button>

          {coarse && (
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
                  {cs ? 'PLYN' : 'THRUST'}
                </TouchButton>
                <TouchButton code="KeyS" className="is-wide is-dim">
                  {cs ? 'BRZDA' : 'BRAKE'}
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
            <p className="fleet-kicker">{cs ? 'Nirvana · nebeská flotila' : 'Nirvana · sky fleet'}</p>
            <h1>{cs ? 'Flotila z marketu' : 'The marketplace fleet'}</h1>
            <p className="fleet-lead">
              {cs
                ? 'Sedm stíhaček, které v marketu existují jako dřevěné skládačky, teď letí. Vyber si loď a doleť k Nabukanu nebo k Issobelle — oba doky se hýbou, takže se na ně musí doletět.'
                : 'Seven starfighters that exist as wooden kits in the marketplace now fly. Pick a ship and reach Nabukano or Issobella — both docks move, so you have to fly to them.'}
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
                <span className="fleet-card-role">{cs ? ship.role.cs : ship.role.en}</span>
                <span className="fleet-card-stats">
                  <i style={{ width: `${Math.round((ship.maxSpeed / 12) * 100)}%` }} />
                </span>
              </button>
            ))}
          </div>

          <div className="fleet-launch">
            <button type="button" onClick={start}>
              {cs ? 'Vzlétnout' : 'Launch'}
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
              {coop ? (cs ? '✈ Letí se společně' : '✈ Flying together') : cs ? 'Letět s ostatními' : 'Fly with others'}
            </button>
            <Link href="/multiplayer">{cs ? 'Online místnosti' : 'Online rooms'}</Link>
          </div>

          {coop && (
            <p className="fleet-coop-note">
              {cs
                ? 'Ostatní uvidí tvoji loď i to, kdy přistaneš. Místnost má šest pilotů — když je plná, přidej se jinam.'
                : 'Others see your ship and when you dock. A room holds six pilots — if it is full, join elsewhere.'}
            </p>
          )}

          <footer className="fleet-foot">
            {cs
              ? `Dok drží ${DOCK_HOLD} s v okruhu ${DOCK_RADIUS} jednotky. Lodě mají vlastní tah i obratnost — B-Wing je pomalý, TIE Interceptor nejobratnější.`
              : `A dock holds for ${DOCK_HOLD}s within ${DOCK_RADIUS} units. Ships differ in thrust and agility — the B-Wing is slow, the TIE Interceptor the most agile.`}
          </footer>
        </div>
      )}
    </main>
  );
}
