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
  type ChatLine,
  type NetIdentity,
  type PlayerSummary,
  type ServerMessage,
} from './protocol';

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
  | ({ kind: 'chat' } & ChatLine)
  | { kind: 'system'; text: string; at: number };

export interface NetApi {
  status: NetStatus;
  you: NetIdentity | null;
  online: number;
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
  weapon: 0 | 1;
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
    default:
      return `chyba: ${code}`;
  }
}

export function NetProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<NetStatus>('connecting');
  const [you, setYou] = useState<NetIdentity | null>(null);
  const [online, setOnline] = useState(0);
  const [members, setMembers] = useState<PlayerSummary[]>([]);
  const [lines, setLines] = useState<NetLine[]>([]);
  const [rtt, setRtt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [youPlayerId, setYouPlayerId] = useState<string | null>(null);
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
        socket.send(JSON.stringify({ t: 'hello', proto: PROTO_VERSION }));

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
            return;
          }
          case 'welcome': {
            setYou(message.you);
            setOnline(message.online);
            setMembers(message.members ?? []);
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

  const joinArena = useCallback(() => {
    send({ t: 'join', game: 'arena' });
  }, [send]);

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
      });
    },
    [send],
  );

  const value = useMemo<NetApi>(
    () => ({
      status,
      you,
      online,
      members,
      lines,
      rtt,
      lastError,
      connected: status === 'open',
      sendChat,
      youPlayerId,
      roomId,
      joinArena,
      leaveRoom,
      subscribe,
      sendInput,
    }),
    [
      status,
      you,
      online,
      members,
      lines,
      rtt,
      lastError,
      sendChat,
      youPlayerId,
      roomId,
      joinArena,
      leaveRoom,
      subscribe,
      sendInput,
    ],
  );

  return <NetContext.Provider value={value}>{children}</NetContext.Provider>;
}

export function useNet(): NetApi {
  const context = useContext(NetContext);
  if (!context) throw new Error('useNet mimo NetProvider');
  return context;
}
