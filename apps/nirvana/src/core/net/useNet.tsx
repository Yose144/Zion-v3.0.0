'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  PROTO_VERSION,
  type GameId,
  type ChatLine,
  type NetIdentity,
  type PlayerSummary,
  type RoomInfo,
  type RoomMode,
  type ServerMessage,
} from './protocol';
import type { BattleSpellId, ItemId } from '../moba/sim';

/**
 * Jedno WebSocket spojení na celou aplikaci.
 *
 * Klient **neposílá identitu** — jen `hello` a text. Jméno, avatar i právo psát
 * rozhoduje server podle cookie `zion_session` (ZIS). Když spojení spadne,
 * UI nesmí vypadat rozbitě: stav se překlopí na `offline` a zkusí se to znovu
 * s rostoucím odstupem.
 */

export type NetStatus = 'connecting' | 'open' | 'offline';

export type NetLine =
  | ({ kind: 'chat'; park?: true } & ChatLine)
  | { kind: 'system'; text: string; at: number };

/** Klíč v `sessionStorage` pro obnovení session po výpadku. */
const RESUME_KEY = 'nirvana.net.resume';

export interface NetApi {
  status: NetStatus;
  you: NetIdentity | null;
  online: number;
  /** Živý seznam místností (lobby). Server ho posílá při každé změně. */
  rooms: RoomInfo[];
  /** Kdo je v kanálu (seřazeno podle připojení). */
  members: PlayerSummary[];
  lines: NetLine[];
  rtt: number | null;
  /** Poslední chyba ze serveru (rate limit, read-only, …) — pro HUD. */
  lastError: string | null;
  connected: boolean;
  sendChat: (text: string) => boolean;

  /** Id hráče v serverové simulaci (po `join`); hra podle něj pozná sebe. */
  youPlayerId: string | null;
  roomId: string | null;
  joinArena: () => void;
  /** Připojení do hry (`arena` = Mars, `race` = Venuše, `fight` = Merkur). */
  joinGame: (
    game: GameId,
    heroId?: number,
    battleSpell?: BattleSpellId,
    mode?: RoomMode,
    aspect?: 'a' | 'b',
  ) => void;
  /** Připojení do konkrétní místnosti z lobby (když je otevřených víc). */
  joinRoom: (game: GameId, roomId: string) => void;
  /**
   * Dívat se na rozehranou místnost. Divák nedostane sedlo, jen snapshoty —
   * vstup se na serveru zahazuje, takže se nedá „připojit do hry" omylem.
   */
  spectateRoom: (game: GameId, roomId: string) => void;
  /** Sedím v hledišti (nesedím v sedle)? */
  spectator: boolean;
  /**
   * MOBA: kouzlo na bod + držený útok.
   * Vrací `true`, když se zpráva opravdu poslala — kouzlo se nesmí ztratit
   * jen proto, že ho zrovna zahodil throttle (20 Hz).
   */
  sendMobaInput: (input: { moveX: number; moveZ: number; attack: boolean; cast: { slot: 'Q' | 'W' | 'E' | 'R'; x: number; z: number } | null }) => boolean;
  /** Tanky: mířidlo (absolutní úhel/síla). Server ho přijme jen na tvém tahu. */
  sendTanksAim: (angle: number, power: number) => void;
  /** Tanky: výstřel. */
  sendTanksShoot: () => void;
  /** Lumi: pošli svůj stav letu (relay — server ho jen předá ostatním). */
  sendFly: (state: { x: number; y: number; vx: number; vy: number; energy: number; collect?: number; finished?: boolean }) => boolean;
  /** Lumi: připoj se ke společné obloze na dané cestě. */
  joinLumi: (path: 'calm' | 'wind' | 'light') => void;
  /** Lumi: předat sebrané světlo nejbližšímu spolulentci (L-6). */
  sendHandoff: (light: number) => void;
  /** Flotila: připoj se ke společné obloze s vybranou lodí. */
  joinFleet: (shipId: string) => void;
  /** Flotila: pošli stav letu (throttlováno na 20 Hz). */
  sendFlight: (state: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    roll: number;
    speed: number;
    docked?: boolean;
    dockId?: string;
  }) => boolean;
  /** MOBA: nákup itemu (server rozhodne, jestli na něj je zlato). */
  sendBuy: (item: ItemId) => void;
  /** MOBA: prodej itemu (server vrátí 60 % ceny). */
  sendSell: (item: ItemId) => void;
  /** MOBA: polož ward na bod. */
  sendWard: (x: number, z: number) => void;
  /** MOBA: polož sentry (odhaluje neviditelné). */
  sendSentry: (x: number, z: number) => void;
  /** MOBA: battle spell (Flicker) na bod. */
  sendBattleSpell: (x: number, z: number) => void;
  /** MOBA: recall — návrat do základny po channelu. */
  sendRecall: () => void;
  /** MOBA: emote (0–3) — bublina nad hrdinou pro ostatní. */
  sendEmote: (id: number) => void;
  /** MOBA: buyback (mrtvý hráč zaplatí a vrátí se). */
  sendBuyback: () => void;
  /** MOBA: aktivní item (klávesy 1–6), bod má smysl u skoku. */
  sendUseItem: (item: ItemId, x: number, z: number) => void;
  /** MOBA: volba talentu (10/15). */
  sendTalent: (tier: number, pick: number) => void;
  leaveRoom: () => void;
  /**
   * Herní data tečou přes subscription, ne přes React state — snapshoty
   * chodí 15×/s a překreslovat kvůli tomu celý strom by bylo plýtvání.
   */
  subscribe: (handler: (message: ServerMessage) => void) => () => void;
  /** Vstup do hry (20 Hz, přebytek se zahazuje). */
  sendInput: (input: ArenaInputFrame) => void;
}

export interface ArenaInputFrame {
  forward: number;
  strafe: number;
  yaw: number;
  pitch: number;
  jump: boolean;
  fire: boolean;
  weapon: 0 | 1 | 2;
  /** Jen duel (Merkur): držený blok. Ostatní hry ignorují. */
  block?: boolean;
}

const MAX_LINES = 200;
const PING_MS = 25_000;
const BACKOFF_MS = [1000, 2000, 4000, 8000, 15_000];

const NetContext = createContext<NetApi | null>(null);

function socketUrl(): string {
  const override = process.env.NEXT_PUBLIC_NIRVANA_NET_URL;
  if (override) return override;
  if (typeof window === 'undefined') return '';
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}/net`;
}

function errorText(code: string): string {
  switch (code) {
    case 'rate_limited':
      return 'příliš rychle — zkus to za chvíli';
    case 'read_only':
      return 'psát může jen přihlášený (ZIS)';
    case 'proto_mismatch':
      return 'klient a server mluví jinou verzí protokolu';
    case 'room_missing':
      return 'místnost už neexistuje — založ novou';
    case 'room_full':
      return 'místnost je plná';
    case 'not_in_room':
      return 'nejsi v místnosti';
    default:
      return `chyba: ${code}`;
  }
}

export function NetProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<NetStatus>('connecting');
  const [you, setYou] = useState<NetIdentity | null>(null);
  const [online, setOnline] = useState(0);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [members, setMembers] = useState<PlayerSummary[]>([]);
  const [lines, setLines] = useState<NetLine[]>([]);
  const [rtt, setRtt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [youPlayerId, setYouPlayerId] = useState<string | null>(null);
  /** Sedím v hledišti (server mě neposadil do sedla). */
  const [spectator, setSpectator] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);

  const listeners = useRef(new Set<(message: ServerMessage) => void>());
  const lastInputAt = useRef(0);

  const socketRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const closedRef = useRef(false);

  const append = useCallback((line: NetLine) => {
    setLines((previous) => {
      const next = [...previous, line];
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
  }, []);

  useEffect(() => {
    closedRef.current = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;

    const connect = () => {
      const url = socketUrl();
      if (!url) return;
      setStatus('connecting');

      let socket: WebSocket;
      try {
        socket = new WebSocket(url);
      } catch {
        setStatus('offline');
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        attemptRef.current = 0;
        setStatus('open');
        let resume: string | null = null;
        try {
          resume = window.sessionStorage.getItem(RESUME_KEY);
        } catch {
          // privátní režim bez storage — reconnect prostě nebude
        }
        socket.send(
          JSON.stringify({ t: 'hello', proto: PROTO_VERSION, resume: resume ?? undefined }),
        );

        pingTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ t: 'ping', at: Date.now() }));
          }
        }, PING_MS);
      };

      socket.onmessage = (event) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return;
        }

        for (const listener of listeners.current) listener(message);

        switch (message.t) {
          case 'room': {
            setRoomId(message.room.id);
            setYouPlayerId(message.youPlayerId ?? null);
            setSpectator(message.spectator === true);
            return;
          }
          case 'rooms': {
            setRooms(message.rooms);
            return;
          }
          case 'welcome': {
            setYou(message.you);
            setOnline(message.online);
            setRooms(message.rooms ?? []);
            setMembers(message.members ?? []);
            if (message.resume) {
              try {
                window.sessionStorage.setItem(RESUME_KEY, message.resume);
              } catch {
                // bez storage reconnect nebude — hra jede dál
              }
            }
            if (message.resumed) {
              append({ kind: 'system', text: 'připojení obnoveno — jsi zpátky ve hře', at: Date.now() });
            }
            setLines(
              message.history.slice(-MAX_LINES).map((line) => ({ kind: 'chat', ...line })),
            );
            return;
          }
          case 'event': {
            const payload = message.event;
            if (payload.kind === 'chat') {
              append({
                kind: 'chat',
                id: payload.id,
                name: payload.name,
                role: payload.role,
                text: payload.text,
                at: payload.at,
              });
            } else if (payload.kind === 'system') {
              append({ kind: 'system', text: payload.text, at: payload.at });
            } else if (payload.kind === 'presence') {
              // server posílá celý seznam — žádné počítání dopředu/zpět
              setMembers(payload.members);
              setOnline(payload.online);
            }
            return;
          }
          case 'pong':
            setRtt(Math.max(0, Date.now() - message.at));
            return;
          case 'error': {
            const text = errorText(message.code);
            setLastError(text);
            append({ kind: 'system', text, at: Date.now() });
            return;
          }
          default:
            return;
        }
      };

      socket.onclose = () => {
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = undefined;
        if (socketRef.current === socket) socketRef.current = null;
        setStatus('offline');
        setYou(null);
        setOnline(0);
        setMembers([]);
        setRoomId(null);
        setYouPlayerId(null);
        if (closedRef.current) return;
        const delay = BACKOFF_MS[Math.min(attemptRef.current, BACKOFF_MS.length - 1)] ?? 15_000;
        attemptRef.current += 1;
        retryTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        // `onclose` zařídí reconnect; tady jen ať to není ticho v konzoli
        setStatus('offline');
      };
    };

    connect();

    return () => {
      closedRef.current = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (pingTimer) clearInterval(pingTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [append]);

  const sendChat = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify({ t: 'chat', text: trimmed.slice(0, 240) }));
      return true;
    },
    [],
  );

  const subscribe = useCallback((handler: (message: ServerMessage) => void) => {
    listeners.current.add(handler);
    return () => {
      listeners.current.delete(handler);
    };
  }, []);

  const send = useCallback((payload: unknown) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const joinGame = useCallback(
    (
      game: GameId,
      heroId?: number,
      battleSpell?: BattleSpellId,
      mode?: RoomMode,
      aspect?: 'a' | 'b',
    ) => {
      send({ t: 'join', game, heroId, battleSpell, mode, aspect });
    },
    [send],
  );

  const joinRoom = useCallback(
    (game: GameId, roomId: string) => {
      send({ t: 'join', game, room: roomId });
    },
    [send],
  );

  const spectateRoom = useCallback(
    (game: GameId, roomId: string) => {
      send({ t: 'join', game, room: roomId, spectate: true });
    },
    [send],
  );

  const joinArena = useCallback(() => joinGame('arena'), [joinGame]);

  const leaveRoom = useCallback(() => {
    send({ t: 'leave' });
    setRoomId(null);
    setYouPlayerId(null);
  }, [send]);

  const sendInput = useCallback(
    (input: ArenaInputFrame) => {
      const now = Date.now();
      // 20 Hz stačí; server stejně jede na 30 Hz a starší vstupy zahazuje
      if (now - lastInputAt.current < 45) return;
      lastInputAt.current = now;
      send({
        t: 'input',
        seq: now % 1_000_000,
        mx: Math.round(input.strafe * 100) / 100,
        mz: Math.round(input.forward * 100) / 100,
        yaw: Math.round(input.yaw * 1000) / 1000,
        pitch: Math.round(input.pitch * 1000) / 1000,
        jump: input.jump,
        fire: input.fire,
        weapon: input.weapon,
        block: input.block === true,
      });
    },
    [send],
  );

  const sendMobaInput = useCallback<NetApi['sendMobaInput']>(
    (input) => {
      const now = Date.now();
      if (now - lastInputAt.current < 45) return false;
      lastInputAt.current = now;
      send({
        t: 'input',
        seq: now % 1_000_000,
        mx: Math.round(input.moveX * 100) / 100,
        mz: Math.round(input.moveZ * 100) / 100,
        yaw: 0,
        pitch: 0,
        jump: false,
        fire: false,
        weapon: 0,
        attack: input.attack,
        castSlot: input.cast?.slot,
        castX: input.cast ? Math.round(input.cast.x * 100) / 100 : undefined,
        castZ: input.cast ? Math.round(input.cast.z * 100) / 100 : undefined,
      });
      return true;
    },
    [send],
  );

  const sendTanksAim = useCallback<NetApi['sendTanksAim']>(
    (angle, power) => {
      send({ t: 'aim', angle, power });
    },
    [send],
  );

  const sendTanksShoot = useCallback<NetApi['sendTanksShoot']>(
    () => {
      send({ t: 'shoot' });
    },
    [send],
  );

  /**
   * Lumi: stav letu 20×/s. Vrací `true`, když se zpráva opravdu odeslala —
   * sebrané světlo se nesmí ztratit jen proto, že ho throttle zahodil.
   */
  const flyAt = useRef(0);
  const flightAt = useRef(0);
  /** Poslední odeslaný stav doku — změna se posílá mimo throttle. */
  const lastDockSent = useRef<boolean | null>(null);
  const joinLumi = useCallback<NetApi['joinLumi']>(
    (path) => {
      send({ t: 'join', game: 'lumi', path });
    },
    [send],
  );

  const sendHandoff = useCallback<NetApi['sendHandoff']>(
    (light) => {
      // Cíl vybírá server — klient posílá jen id světla (a jen své).
      send({ t: 'handoff', light });
    },
    [send],
  );

  const sendFly = useCallback<NetApi['sendFly']>(
    (state) => {
      const now = Date.now();
      const carrying = state.collect !== undefined;
      if (!carrying && now - flyAt.current < 50) return false;
      flyAt.current = now;
      send({ t: 'fly', ...state });
      return true;
    },
    [send],
  );

  /**
   * Flotila: stav letu.
   *
   * `yaw` se posílá **zabalený do (−π, π]** — v simulaci roste otáčením
   * donekonečna, ale do sítě nemá smysl posílat 300 rad; server i klient
   * počítají se stejnou orientací.
   */
  const sendFlight = useCallback<NetApi['sendFlight']>(
    (state) => {
      const now = Date.now();
      // změna doku (přistání/odpojení) musí projít vždy, jinak by ostatní
      // viděli loď na doku, který už opustila
      const urgent = state.docked !== undefined && state.docked !== lastDockSent.current;
      if (!urgent && now - flightAt.current < 50) return false;
      flightAt.current = now;
      lastDockSent.current = state.docked ?? null;
      const tau = Math.PI * 2;
      let yaw = state.yaw % tau;
      if (yaw > Math.PI) yaw -= tau;
      if (yaw <= -Math.PI) yaw += tau;
      send({ t: 'flight', ...state, yaw });
      return true;
    },
    [send],
  );

  const joinFleet = useCallback<NetApi['joinFleet']>(
    (shipId) => {
      lastDockSent.current = null;
      send({ t: 'join', game: 'fleet', shipId });
    },
    [send],
  );

  const sendBuy = useCallback<NetApi['sendBuy']>(
    (item) => {
      send({ t: 'buy', item });
    },
    [send],
  );

  const sendSell = useCallback<NetApi['sendSell']>(
    (item) => {
      send({ t: 'sell', item });
    },
    [send],
  );

  const sendWard = useCallback<NetApi['sendWard']>(
    (x, z) => {
      send({ t: 'ward', x, z });
    },
    [send],
  );

  const sendSentry = useCallback<NetApi['sendSentry']>(
    (x, z) => {
      send({ t: 'sentry', x, z });
    },
    [send],
  );

  const sendBattleSpell = useCallback<NetApi['sendBattleSpell']>(
    (x, z) => {
      send({ t: 'battlespell', x, z });
    },
    [send],
  );

  const sendRecall = useCallback<NetApi['sendRecall']>(
    () => {
      send({ t: 'recall' });
    },
    [send],
  );

  const sendEmote = useCallback<NetApi['sendEmote']>(
    (id) => {
      send({ t: 'emote', id });
    },
    [send],
  );

  const sendBuyback = useCallback<NetApi['sendBuyback']>(
    () => {
      send({ t: 'buyback' });
    },
    [send],
  );

  const sendUseItem = useCallback<NetApi['sendUseItem']>(
    (item, x, z) => {
      send({ t: 'use', item, x, z });
    },
    [send],
  );

  const sendTalent = useCallback<NetApi['sendTalent']>(
    (tier, pick) => {
      send({ t: 'talent', tier, pick });
    },
    [send],
  );

  const value = useMemo<NetApi>(
    () => ({
      status,
      you,
      online,
      rooms,
      members,
      lines,
      rtt,
      lastError,
      connected: status === 'open',
      sendChat,
      youPlayerId,
      roomId,
      joinArena,
      joinGame,
      joinRoom,
      spectateRoom,
      spectator,
      leaveRoom,
      subscribe,
      sendInput,
      sendMobaInput,
      sendBuy,
      sendSell,
      sendWard,
      sendSentry,
      sendBattleSpell,
      sendRecall,
      sendEmote,
      sendTanksAim,
      sendTanksShoot,
      sendFly,
      sendHandoff,
      joinLumi,
      joinFleet,
      sendFlight,
      sendBuyback,
      sendUseItem,
      sendTalent,
    }),
    [
      status,
      you,
      online,
      rooms,
      members,
      lines,
      rtt,
      lastError,
      sendChat,
      youPlayerId,
      roomId,
      joinArena,
      joinGame,
      joinRoom,
      spectateRoom,
      spectator,
      leaveRoom,
      subscribe,
      sendInput,
      sendMobaInput,
      sendBuy,
      sendSell,
      sendWard,
      sendSentry,
      sendBattleSpell,
      sendRecall,
      sendEmote,
      sendTanksAim,
      sendTanksShoot,
      sendFly,
      sendHandoff,
      joinLumi,
      joinFleet,
      sendFlight,
      sendBuyback,
      sendUseItem,
      sendTalent,
    ],
  );

  return <NetContext.Provider value={value}>{children}</NetContext.Provider>;
}

export function useNet(): NetApi {
  const context = useContext(NetContext);
  if (!context) throw new Error('useNet mimo NetProvider');
  return context;
}
