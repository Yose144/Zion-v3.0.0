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

        switch (message.t) {
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
            } else if (payload.kind === 'join') {
              setOnline((value) => value + 1);
              setMembers((list) =>
                list.some((member) => member.id === payload.player.id)
                  ? list
                  : [...list, payload.player],
              );
            } else if (payload.kind === 'leave') {
              setOnline((value) => Math.max(0, value - 1));
              setMembers((list) => list.filter((member) => member.id !== payload.id));
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
    }),
    [status, you, online, members, lines, rtt, lastError, sendChat],
  );

  return <NetContext.Provider value={value}>{children}</NetContext.Provider>;
}

export function useNet(): NetApi {
  const context = useContext(NetContext);
  if (!context) throw new Error('useNet mimo NetProvider');
  return context;
}
