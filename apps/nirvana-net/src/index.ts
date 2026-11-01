/**
 * zion-nirvana-net — realtime služba Nirvany.
 *
 * Proč samostatný proces: Next v režimu `output: 'standalone'` **neumí** vlastní
 * server s WebSocketem (dokumentace Nextu to říká explicitně), takže herní
 * smyčka a chat bydlí tady. Web (port 3010) zůstává nedotčený a tahle služba
 * je za nginxem na `/net`.
 *
 * Stav (M0 + M1):
 *   - HTTP: `GET /net/health` (JSON) a `GET /net/metrics` (Prometheus)
 *   - WS:   `hello → welcome`, `join → room`, `leave`, `chat`, `ping → pong`
 *   - **identita ze ZIS** (cookie `zion_session` → `/api/auth/me`, cache 60 s):
 *     přihlášený píše, host jen čte
 *   - kanály: `park` (mimo místnost) a `arena:<room>` (v místnosti)
 *   - **nesimuluje hru** — to je M2a (arény) a M2b (Venuše)
 *
 * Co záměrně nedělá: neukládá nic na disk (historie je ring buffer v paměti),
 * nevěří klientovi identitu, neposílá žádné peníze.
 */

import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

import {
  CHAT_HISTORY_LEN,
  CHAT_MAX_LEN,
  CHAT_RATE_MESSAGES,
  CHAT_RATE_WINDOW_MS,
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
  type ChatLine,
  type ClientMessage,
  type ErrorCode,
  type GameId,
  type HealthResponse,
  type NetIdentity,
  type PlayerSummary,
  type RoomInfo,
  type RoomState,
  type ServerMessage,
} from '../../nirvana/src/core/net/protocol.js';
import { identityCacheSize, resolveIdentity } from './zis.js';

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
  chat: 0,
  byType: new Map<string, number>(),
};

interface Conn {
  id: string;
  socket: WebSocket;
  identity: NetIdentity;
  /** Identita ze ZIS se resolvuje asynchronně hned po připojení. */
  identityReady: Promise<NetIdentity>;
  /** Už jsme ohlásili `join` do kanálu (aby `leave` nevisel bez protějšku). */
  announced: boolean;
  helloSent: boolean;
  alive: boolean;
  room: Room | null;
  /** Okno pro rate limit zpráv (1 s). */
  windowStart: number;
  windowCount: number;
  /** Časy posledních zpráv v chatu (okno `CHAT_RATE_WINDOW_MS`). */
  chatTimes: number[];
  lastSeen: number;
}

interface Room {
  id: string;
  game: GameId;
  state: RoomState;
  createdAt: number;
  players: Map<string, Conn>;
}

const rooms = new Map<string, Room>();
const connections = new Map<string, Conn>();
const roomCounters = new Map<GameId, number>();
/** Historie kanálů — jen v paměti, po restartu prázdná (záměr, žádná DB). */
const channels = new Map<string, ChatLine[]>();

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

function sendSystem(conn: Conn, text: string): void {
  send(conn, { t: 'event', event: { kind: 'system', text, at: Date.now() } });
}

function summary(identity: NetIdentity): PlayerSummary {
  return {
    id: identity.id,
    name: identity.name,
    role: identity.role,
    avatar: identity.avatar,
    avatarId: identity.avatarId,
  };
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

function guestIdentity(): NetIdentity {
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

// ── kanály a chat ─────────────────────────────────────────────────────

function channelOf(conn: Conn): string {
  return conn.room ? `arena:${conn.room.id}` : 'park';
}

function historyOf(channel: string): ChatLine[] {
  return channels.get(channel) ?? [];
}

function pushLine(channel: string, line: ChatLine): void {
  const history = channels.get(channel) ?? [];
  history.push(line);
  if (history.length > CHAT_HISTORY_LEN) history.splice(0, history.length - CHAT_HISTORY_LEN);
  channels.set(channel, history);
}

function membersOf(channel: string): Conn[] {
  return [...connections.values()].filter(
    (conn) => conn.helloSent && channelOf(conn) === channel,
  );
}

function broadcastChannel(channel: string, message: ServerMessage, exceptId?: string): void {
  for (const conn of membersOf(channel)) {
    if (conn.id === exceptId) continue;
    send(conn, message);
  }
}

function announceJoin(conn: Conn): void {
  if (conn.announced) return;
  conn.announced = true;
  broadcastChannel(
    channelOf(conn),
    { t: 'event', event: { kind: 'join', player: summary(conn.identity) } },
    conn.id,
  );
}

function announceLeave(conn: Conn, channel: string): void {
  if (!conn.announced) return;
  conn.announced = false;
  broadcastChannel(
    channel,
    { t: 'event', event: { kind: 'leave', id: conn.identity.id, name: conn.identity.name } },
    conn.id,
  );
}

/** Očista textu: pryč s HTML tagy, řídicími znaky a `<`/`>`, strop délky. */
function cleanText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CHAT_MAX_LEN);
}

function handleCommand(conn: Conn, channel: string, text: string): void {
  const [command, ...rest] = text.split(' ');
  switch (command?.toLowerCase()) {
    case '/who': {
      const names = membersOf(channel).map((member) =>
        member.identity.role === 'zis' ? member.identity.name : `${member.identity.name} (host)`,
      );
      sendSystem(conn, names.length > 0 ? `v kanálu (${names.length}): ${names.join(', ')}` : 'nikdo tu není');
      return;
    }
    case '/help':
      sendSystem(conn, 'příkazy: /who (kdo je tu) · /help · jinak piš rovnou');
      return;
    default:
      sendSystem(conn, `neznámý příkaz ${command ?? ''} — zkus /help`);
  }
}

/**
 * Chat. Psát smí jen přihlášený (ZIS); host dostane `read_only`, ne ticho.
 * Rate limit je per spojení (2 zprávy / 2 s) — server, ne UI.
 */
function postChat(conn: Conn, raw: string): void {
  if (conn.identity.role !== 'zis') {
    sendError(conn, 'read_only', 'piš jako přihlášený (ZIS)');
    return;
  }

  const now = Date.now();
  conn.chatTimes = conn.chatTimes.filter((time) => now - time < CHAT_RATE_WINDOW_MS);
  if (conn.chatTimes.length >= CHAT_RATE_MESSAGES) {
    sendError(conn, 'rate_limited', 'příliš rychle');
    return;
  }

  const text = cleanText(raw);
  if (!text) return;
  conn.chatTimes.push(now);

  if (text.startsWith('/')) {
    handleCommand(conn, channelOf(conn), text);
    return;
  }

  const line: ChatLine = {
    id: conn.identity.id,
    name: conn.identity.name,
    role: conn.identity.role,
    text,
    at: now,
  };
  pushLine(channelOf(conn), line);
  stats.chat += 1;
  broadcastChannel(channelOf(conn), { t: 'event', event: { kind: 'chat', ...line } });
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
  };
  rooms.set(room.id, room);
  log(`room created id=${room.id} total=${rooms.size}`);
  return room;
}

function leaveRoom(conn: Conn, reason: string): void {
  const room = conn.room;
  if (!room) return;

  const channel = `arena:${room.id}`;
  announceLeave(conn, channel);
  conn.room = null;
  room.players.delete(conn.id);
  log(`leave room=${room.id} id=${conn.identity.id} reason=${reason} players=${room.players.size}`);

  if (room.players.size === 0) {
    rooms.delete(room.id);
    channels.delete(channel);
    log(`room removed id=${room.id} total=${rooms.size}`);
  }

  // zpátky do parku — ohlásit se tam a dát vědět, že je hráč zase venku
  if (conn.helloSent) {
    announceJoin(conn);
    sendSystem(conn, 'jsi zpátky v parku');
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

  // odchod z parku musí být ohlášený dřív, než se změní kanál
  announceLeave(conn, 'park');

  room.players.set(conn.id, conn);
  conn.room = room;

  send(conn, {
    t: 'room',
    room: roomInfo(room),
    occupants: [...room.players.values()].map((player) => summary(player.identity)),
    // M0/M1: bez simulace není kam hráče postavit. M2a doplní spawn z `ARENA_SPAWN`.
    spawn: null,
    history: [...historyOf(`arena:${room.id}`)],
  });

  announceJoin(conn);
  log(`join room=${room.id} id=${conn.identity.id} role=${conn.identity.role} players=${room.players.size}`);
}

// ── zprávy ────────────────────────────────────────────────────────────

async function handleMessage(conn: Conn, message: ClientMessage): Promise<void> {
  switch (message.t) {
    case 'hello': {
      if (message.proto !== PROTO_VERSION) {
        sendError(conn, 'proto_mismatch', `server mluví proto ${PROTO_VERSION}`);
        conn.socket.close(1002, 'proto_mismatch');
        return;
      }
      conn.identity = await conn.identityReady;
      conn.helloSent = true;

      const channel = channelOf(conn);
      send(conn, {
        t: 'welcome',
        proto: PROTO_VERSION,
        you: conn.identity,
        rooms: [...rooms.values()].map(roomInfo),
        serverTime: Date.now(),
        tickHz: TICK_HZ,
        snapshotHz: SNAPSHOT_HZ,
        history: [...historyOf(channel)],
        online: membersOf(channel).length,
        members: membersOf(channel).map((member) => summary(member.identity)),
      });
      announceJoin(conn);
      log(
        `hello id=${conn.identity.id} role=${conn.identity.role} name=${conn.identity.name} channel=${channel}`,
      );
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
      postChat(conn, message.text);
      return;

    case 'ping':
      send(conn, { t: 'pong', at: message.at, serverTime: Date.now() });
      return;
  }
}

function onConnection(socket: WebSocket, request: IncomingMessage): void {
  const guest = guestIdentity();
  const conn: Conn = {
    id: `c_${randomBytes(6).toString('hex')}`,
    socket,
    identity: guest,
    identityReady: resolveIdentity(request.headers.cookie, guest),
    announced: false,
    helloSent: false,
    alive: true,
    room: null,
    windowStart: Date.now(),
    windowCount: 0,
    chatTimes: [],
    lastSeen: Date.now(),
  };
  connections.set(conn.id, conn);
  log(`connect id=${conn.id} ip=${request.socket.remoteAddress ?? '?'} conns=${connections.size}`);

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

    const message = parseClientMessage(data.toString());
    if (!message) {
      stats.rejected += 1;
      sendError(conn, 'bad_frame');
      return;
    }

    stats.messagesIn += 1;
    stats.byType.set(message.t, (stats.byType.get(message.t) ?? 0) + 1);
    void handleMessage(conn, message).catch((error: unknown) => {
      log(`handler error id=${conn.id} ${String(error)}`);
    });
  });

  socket.on('close', () => {
    const channel = channelOf(conn);
    leaveRoom(conn, 'close');
    announceLeave(conn, channel);
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
    '# HELP nirvana_net_chat_lines zpráv v paměti (všechny kanály)',
    '# TYPE nirvana_net_chat_lines gauge',
    `nirvana_net_chat_lines ${[...channels.values()].reduce((sum, history) => sum + history.length, 0)}`,
    '# HELP nirvana_net_zis_cache položek v cache identit',
    '# TYPE nirvana_net_zis_cache gauge',
    `nirvana_net_zis_cache ${identityCacheSize()}`,
    '# HELP nirvana_net_chat_messages_total odeslané chatové zprávy',
    '# TYPE nirvana_net_chat_messages_total counter',
    `nirvana_net_chat_messages_total ${stats.chat}`,
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
