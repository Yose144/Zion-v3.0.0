/**
 * zion-nirvana-net — realtime služba Nirvany.
 *
 * Proč samostatný proces: Next v režimu `output: 'standalone'` **neumí** vlastní
 * server s WebSocketem (dokumentace Nextu to říká explicitně), takže herní
 * smyčka a chat bydlí tady. Web (port 3010) zůstává nedotčený a tahle služba
 * je za nginxem na `/net`.
 *
 * Co služba dělá v tuhle chvíli (M0):
 *   - HTTP: `GET /net/health` (JSON) a `GET /net/metrics` (Prometheus)
 *   - WS:   `hello → welcome`, `join → room`, `leave`, `ping → pong`
 *   - drží místnosti a seznam přítomných (presence pro chat v M1)
 *   - **nesimuluje hru** — to je M2a (arény) a M2b (Venuše)
 *
 * Co záměrně nedělá: nevěří klientovi identitu (jméno/avatar dodá server v M1
 * z cookie `zion_session` → ZIS), neukládá nic na disk, neposílá žádné peníze.
 */

import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

import {
  CHAT_HISTORY_LEN,
  HEARTBEAT_MS,
  IDLE_TIMEOUT_MS,
  MAX_FRAME_BYTES,
  MAX_INBOUND_PER_SEC,
  MAX_PLAYERS,
  MAX_ROOMS,
  PROTO_VERSION,
  SNAPSHOT_HZ,
  TICK_HZ,
  encodeMessage,
  parseClientMessage,
  type ClientMessage,
  type ErrorCode,
  type GameId,
  type HealthResponse,
  type NetIdentity,
  type PlayerSummary,
  type Role,
  type RoomInfo,
  type RoomState,
  type ServerMessage,
} from '../../nirvana/src/core/net/protocol.js';

const SERVICE = 'zion-nirvana-net';
const PORT = Number(process.env.NIRVANA_NET_PORT ?? 3011);
const HOST = process.env.NIRVANA_NET_HOST ?? '127.0.0.1';
const PATH = process.env.NIRVANA_NET_PATH ?? '/net';
const BUILD = process.env.ZION_DEPLOY_RELEASE ?? 'dev';
/** Prázdný seznam = povolit jen požadavky bez `Origin` (nástroje, testy). */
const ALLOWED_ORIGINS = (process.env.NIRVANA_NET_ALLOWED_ORIGINS ?? 'https://nirvana.zionterranova.com')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const startedAt = Date.now();
const stats = {
  messagesIn: 0,
  messagesOut: 0,
  rejected: 0,
  byType: new Map<string, number>(),
};

interface ChatLine {
  id: string;
  name: string;
  role: Role;
  text: string;
  at: number;
}

interface Conn {
  id: string;
  socket: WebSocket;
  identity: NetIdentity;
  helloSent: boolean;
  alive: boolean;
  room: Room | null;
  /** Okno pro rate limit (1 s). */
  windowStart: number;
  windowCount: number;
  lastSeen: number;
}

interface Room {
  id: string;
  game: GameId;
  state: RoomState;
  createdAt: number;
  players: Map<string, Conn>;
  chat: ChatLine[];
}

const rooms = new Map<string, Room>();
const connections = new Map<string, Conn>();
const roomCounters = new Map<GameId, number>();

// ── pomocné ───────────────────────────────────────────────────────────

function log(line: string): void {
  console.log(`${new Date().toISOString()} ${line}`);
}

function send(conn: Conn, message: ServerMessage): void {
  if (conn.socket.readyState !== WebSocket.OPEN) return;
  conn.socket.send(encodeMessage(message));
  stats.messagesOut += 1;
}

function sendError(conn: Conn, code: ErrorCode, message?: string): void {
  send(conn, { t: 'error', code, message });
}

function broadcast(room: Room, message: ServerMessage, exceptId?: string): void {
  for (const player of room.players.values()) {
    if (player.id === exceptId) continue;
    send(player, message);
  }
}

function summary(identity: NetIdentity): PlayerSummary {
  return { id: identity.id, name: identity.name, role: identity.role };
}

function roomInfo(room: Room): RoomInfo {
  return {
    id: room.id,
    game: room.game,
    players: room.players.size,
    maxPlayers: MAX_PLAYERS,
    state: room.state,
  };
}

/**
 * Identita hráče. **V M0 jen host** — jméno si nikdo neposílá sám.
 * V M1 sem přibude resoluce cookie `zion_session` → ZIS (`/api/auth/me`)
 * a `role` se překlopí na `zis`; zbytek hry se nemění.
 */
function identityForConnection(): NetIdentity {
  const id = `g_${randomBytes(4).toString('hex')}`;
  return {
    id,
    name: `host-${id.slice(2, 5)}`,
    role: 'guest',
    avatar: null,
    avatarId: null,
    callsign: null,
  };
}

function originAllowed(origin: string | undefined): boolean {
  // Prohlížeč `Origin` vždy posílá; když chybí, jde o nástroj/test, ne o cizí web.
  if (!origin) return true;
  if (ALLOWED_ORIGINS.length === 0) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

function rateLimited(conn: Conn, now: number): boolean {
  if (now - conn.windowStart > 1000) {
    conn.windowStart = now;
    conn.windowCount = 0;
  }
  conn.windowCount += 1;
  return conn.windowCount > MAX_INBOUND_PER_SEC;
}

// ── místnosti ─────────────────────────────────────────────────────────

function createRoom(game: GameId): Room {
  const counter = (roomCounters.get(game) ?? 0) + 1;
  roomCounters.set(game, counter);
  const room: Room = {
    id: `${game}-${counter}`,
    game,
    state: 'waiting',
    createdAt: Date.now(),
    players: new Map(),
    chat: [],
  };
  rooms.set(room.id, room);
  log(`room created id=${room.id} total=${rooms.size}`);
  return room;
}

function leaveRoom(conn: Conn, reason: string): void {
  const room = conn.room;
  if (!room) return;
  conn.room = null;
  room.players.delete(conn.id);
  broadcast(room, { t: 'event', event: { kind: 'leave', id: conn.identity.id, name: conn.identity.name } });
  log(`leave room=${room.id} id=${conn.identity.id} reason=${reason} players=${room.players.size}`);
  if (room.players.size === 0) {
    rooms.delete(room.id);
    log(`room removed id=${room.id} total=${rooms.size}`);
  }
}

function joinRoom(conn: Conn, game: GameId, wanted?: string): void {
  if (!conn.helloSent) {
    sendError(conn, 'bad_frame', 'nejdřív hello');
    return;
  }
  if (conn.room) leaveRoom(conn, 'switch');

  let room: Room | undefined;
  if (wanted) {
    const candidate = rooms.get(wanted);
    if (candidate && candidate.game === game && candidate.players.size < MAX_PLAYERS) {
      room = candidate;
    }
  } else {
    for (const candidate of rooms.values()) {
      if (candidate.game === game && candidate.players.size < MAX_PLAYERS) {
        room = candidate;
        break;
      }
    }
  }

  if (!room) {
    if (rooms.size >= MAX_ROOMS) {
      sendError(conn, 'busy', 'všechny místnosti jsou plné');
      return;
    }
    room = createRoom(game);
  }

  room.players.set(conn.id, conn);
  conn.room = room;

  send(conn, {
    t: 'room',
    room: roomInfo(room),
    occupants: [...room.players.values()].map((player) => summary(player.identity)),
    // M0: bez simulace není kam hráče postavit. M2a doplní spawn z `ARENA_SPAWN`.
    spawn: null,
    history: room.chat.map((line) => ({ ...line })),
  });

  broadcast(room, { t: 'event', event: { kind: 'join', player: summary(conn.identity) } }, conn.id);
  log(`join room=${room.id} id=${conn.identity.id} role=${conn.identity.role} players=${room.players.size}`);
}

// ── zprávy ────────────────────────────────────────────────────────────

function handleMessage(conn: Conn, message: ClientMessage): void {
  switch (message.t) {
    case 'hello': {
      if (message.proto !== PROTO_VERSION) {
        sendError(conn, 'proto_mismatch', `server mluví proto ${PROTO_VERSION}`);
        conn.socket.close(1002, 'proto_mismatch');
        return;
      }
      conn.helloSent = true;
      send(conn, {
        t: 'welcome',
        proto: PROTO_VERSION,
        you: conn.identity,
        rooms: [...rooms.values()].map(roomInfo),
        serverTime: Date.now(),
        tickHz: TICK_HZ,
        snapshotHz: SNAPSHOT_HZ,
      });
      return;
    }

    case 'join':
      joinRoom(conn, message.game, message.room);
      return;

    case 'leave':
      if (!conn.room) {
        sendError(conn, 'not_in_room');
        return;
      }
      leaveRoom(conn, 'leave');
      return;

    case 'input':
      // M2a: tady se vstup vloží do serverové smyčky a vznikne z něj snapshot.
      if (!conn.room) sendError(conn, 'not_in_room');
      return;

    case 'chat':
      // M1: až bude ZIS identita, protáhne se text filtrem, rate limitem a historií.
      sendError(conn, 'not_available', 'chat dorazí s identitou ZIS (M1)');
      return;

    case 'ping':
      send(conn, { t: 'pong', at: message.at, serverTime: Date.now() });
      return;
  }
}

function onConnection(socket: WebSocket, request: IncomingMessage): void {
  const conn: Conn = {
    id: `c_${randomBytes(6).toString('hex')}`,
    socket,
    identity: identityForConnection(),
    helloSent: false,
    alive: true,
    room: null,
    windowStart: Date.now(),
    windowCount: 0,
    lastSeen: Date.now(),
  };
  connections.set(conn.id, conn);
  log(
    `connect id=${conn.id} ip=${request.socket.remoteAddress ?? '?'} conns=${connections.size}`,
  );

  socket.on('pong', () => {
    conn.alive = true;
  });

  socket.on('message', (data, isBinary) => {
    const now = Date.now();
    conn.lastSeen = now;

    if (isBinary) {
      stats.rejected += 1;
      sendError(conn, 'bad_frame', 'jen JSON text');
      return;
    }
    if (rateLimited(conn, now)) {
      stats.rejected += 1;
      sendError(conn, 'rate_limited');
      return;
    }

    const raw = data.toString();
    const message = parseClientMessage(raw);
    if (!message) {
      stats.rejected += 1;
      sendError(conn, 'bad_frame');
      return;
    }

    stats.messagesIn += 1;
    stats.byType.set(message.t, (stats.byType.get(message.t) ?? 0) + 1);
    handleMessage(conn, message);
  });

  socket.on('close', () => {
    leaveRoom(conn, 'close');
    connections.delete(conn.id);
    log(`disconnect id=${conn.id} conns=${connections.size}`);
  });

  socket.on('error', (error) => {
    log(`socket error id=${conn.id} ${error.message}`);
  });
}

// ── HTTP (health + metriky) ───────────────────────────────────────────

function metricsText(): string {
  const lines: string[] = [
    '# HELP nirvana_net_up 1 = služba běží',
    '# TYPE nirvana_net_up gauge',
    'nirvana_net_up 1',
    '# HELP nirvana_net_proto_version verze protokolu',
    '# TYPE nirvana_net_proto_version gauge',
    `nirvana_net_proto_version ${PROTO_VERSION}`,
    '# HELP nirvana_net_uptime_seconds doba běhu',
    '# TYPE nirvana_net_uptime_seconds gauge',
    `nirvana_net_uptime_seconds ${Math.round((Date.now() - startedAt) / 1000)}`,
    '# HELP nirvana_net_connections otevřená spojení',
    '# TYPE nirvana_net_connections gauge',
    `nirvana_net_connections ${connections.size}`,
    '# HELP nirvana_net_rooms aktivní místnosti',
    '# TYPE nirvana_net_rooms gauge',
    `nirvana_net_rooms ${rooms.size}`,
    '# HELP nirvana_net_players hráči v místnostech',
    '# TYPE nirvana_net_players gauge',
    `nirvana_net_players ${[...rooms.values()].reduce((sum, room) => sum + room.players.size, 0)}`,
    '# HELP nirvana_net_messages_total zprávy po směru',
    '# TYPE nirvana_net_messages_total counter',
    `nirvana_net_messages_total{direction="in"} ${stats.messagesIn}`,
    `nirvana_net_messages_total{direction="out"} ${stats.messagesOut}`,
    '# HELP nirvana_net_messages_by_type zprávy podle typu',
    '# TYPE nirvana_net_messages_by_type counter',
  ];
  for (const [type, count] of stats.byType) {
    lines.push(`nirvana_net_messages_by_type{type="${type}"} ${count}`);
  }
  lines.push(
    '# HELP nirvana_net_rejected_total odmítnuté rámce',
    '# TYPE nirvana_net_rejected_total counter',
    `nirvana_net_rejected_total ${stats.rejected}`,
    '# HELP nirvana_net_memory_bytes RSS procesu',
    '# TYPE nirvana_net_memory_bytes gauge',
    `nirvana_net_memory_bytes ${process.memoryUsage().rss}`,
  );
  return `${lines.join('\n')}\n`;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

function httpHandler(request: IncomingMessage, response: ServerResponse): void {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (url.pathname === `${PATH}/health`) {
    const body: HealthResponse = {
      ok: true,
      service: SERVICE,
      proto: PROTO_VERSION,
      build: BUILD,
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      connections: connections.size,
      rooms: rooms.size,
    };
    json(response, 200, body);
    return;
  }

  if (url.pathname === `${PATH}/metrics`) {
    const body = metricsText();
    response.writeHead(200, {
      'content-type': 'text/plain; version=0.0.4; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(body),
    });
    response.end(body);
    return;
  }

  if (url.pathname === PATH) {
    json(response, 426, { error: 'upgrade_required', hint: 'WebSocket na /net' });
    return;
  }

  json(response, 404, { error: 'not_found' });
}

// ── start ─────────────────────────────────────────────────────────────

const server = createServer(httpHandler);
const sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES, clientTracking: false });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (url.pathname !== PATH) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  if (!originAllowed(request.headers.origin)) {
    stats.rejected += 1;
    log(`upgrade rejected origin=${request.headers.origin ?? '?'}`);
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  sockets.handleUpgrade(request, socket, head, (ws) => {
    sockets.emit('connection', ws, request);
  });
});

sockets.on('connection', onConnection);

const heartbeat = setInterval(() => {
  const now = Date.now();
  for (const conn of connections.values()) {
    if (!conn.alive || now - conn.lastSeen > IDLE_TIMEOUT_MS) {
      log(`terminate id=${conn.id} reason=${conn.alive ? 'idle' : 'no_pong'}`);
      conn.socket.terminate();
      continue;
    }
    conn.alive = false;
    conn.socket.ping();
  }
}, HEARTBEAT_MS);

function shutdown(signal: string): void {
  log(`shutdown signal=${signal}`);
  clearInterval(heartbeat);
  for (const conn of connections.values()) conn.socket.close(1001, 'server shutdown');
  sockets.close();
  server.close(() => process.exit(0));
  // kdyby se něco zaseklo, nedržet systémd čekáním
  setTimeout(() => process.exit(0), 3000).unref();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => shutdown(signal));
}

process.on('unhandledRejection', (reason) => {
  log(`unhandledRejection ${String(reason)}`);
});
process.on('uncaughtException', (error) => {
  log(`uncaughtException ${error.message}`);
});

server.listen(PORT, HOST, () => {
  log(`${SERVICE} listening ws://${HOST}:${PORT}${PATH} build=${BUILD} proto=${PROTO_VERSION}`);
});
