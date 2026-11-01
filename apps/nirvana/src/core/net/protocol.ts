/**
 * Drát Nirvany — **jediný zdroj pravdy** pro realtime protokol.
 *
 * Importuje ho klient (`apps/nirvana`, soubor se bundluje do prohlížeče)
 * i služba (`apps/nirvana-net`, běží na Node 22). Když se formát změní,
 * zvedni `PROTO_VERSION` — server starší verzi odmítne (`proto_mismatch`),
 * aby se klient nepřipojil k neslučitelné hře a nepadal na neznámých polích.
 *
 * Co tu záměrně **není**: žádná identita od klienta. Jméno a avatar dodává
 * server z cookie (`zion_session` → ZIS), tak si je nikdo nemůže přepsat.
 */

export const PROTO_VERSION = 4;

/** Hz serverové smyčky, rozesílání stavu a vstupu klienta. */
export const TICK_HZ = 30;
export const SNAPSHOT_HZ = 15;
export const INPUT_HZ = 20;

export const MAX_PLAYERS = 8;
export const MAX_ROOMS = 4;
/** Místnost souboje na Merkuru — duel je vždy dva. */
export const FIGHT_ROOM_SIZE = 2;
/** Maximum jednoho WS rámce. Větší = zahodit, ne parsovat. */
export const MAX_FRAME_BYTES = 4096;
/** Strop příchozích zpráv na spojení (vstup 20 Hz + rezerva). */
export const MAX_INBOUND_PER_SEC = 40;

export const CHAT_MAX_LEN = 240;
export const CHAT_RATE_MESSAGES = 2;
export const CHAT_RATE_WINDOW_MS = 2000;
export const CHAT_HISTORY_LEN = 200;

export const HEARTBEAT_MS = 20_000;
export const IDLE_TIMEOUT_MS = 60_000;

export type GameId = 'arena' | 'race' | 'fight';
/** `guest` = bez ZIS (hraje, ale nepíše), `zis` = ověřený uživatel. */
export type Role = 'guest' | 'zis';
export type RoomState = 'waiting' | 'running' | 'ended';
/** 0 = rail, 1 = rakety, 2 = strojní puška (Q3 sestava). */
export type WeaponId = 0 | 1 | 2;
/** Jméno zbraně do eventů (čitelnost > bajty). */
export type WeaponName = 'rail' | 'rocket' | 'mg';

/** Veřejná identita hráče — jen tohle smí do hry. Nikdy e-mail, role, adresy. */
export interface NetIdentity {
  id: string;
  name: string;
  role: Role;
  /** URL avatara (ZIS sigil nebo upload), nebo null. */
  avatar: string | null;
  /** 0–202 = položka z OASIS rosteru, nebo null. */
  avatarId: number | null;
  callsign: string | null;
}

/** Jedna zpráva v chatu. `role` nese, kdo ji smí napsat (`zis`). */
export interface ChatLine {
  id: string;
  name: string;
  role: Role;
  text: string;
  at: number;
}

export interface PlayerSummary {
  id: string;
  name: string;
  role: Role;
  /** Avatar (ZIS sigil/upload) — host ho nemá, proto null. */
  avatar: string | null;
  avatarId: number | null;
}

export interface RoomInfo {
  id: string;
  game: GameId;
  players: number;
  maxPlayers: number;
  state: RoomState;
}

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

/** Stav hráče v aréně (server-authoritative). */
export interface ArenaPlayerState {
  id: string;
  /** Jméno ze serveru (identita), aby tabule nemusela mapovat id → jméno. */
  name: string;
  /** Vybraný avatar z OASIS rosteru (ZIS `avatar3d.avatarId`), nebo null. */
  avatarId: number | null;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  hp: number;
  armor: number;
  frags: number;
  deaths: number;
  weapon: WeaponId;
  alive: boolean;
  /** Serverový bot (Q3 sestava) — tabule ho odliší. */
  isBot?: boolean;
  /** Munice zbraně — server je vlastník (klient jen zobrazuje). */
  ammo?: number;
  /** Munice strojní pušky (vlastní zásobník vedle raket). */
  mgAmmo?: number;
}

/** Stav vozidla na Venuši. */
export interface RacePlayerState {
  id: string;
  name: string;
  avatarId: number | null;
  x: number;
  z: number;
  heading: number;
  speed: number;
  lap: number;
  checkpoint: number;
  offTrack: boolean;
  finishedAtMs: number | null;
}

/** Stav bojovníka na Merkuru (x = pozice v kleci, y = skok). */
export interface FightPlayerState {
  id: string;
  name: string;
  avatarId: number | null;
  x: number;
  y: number;
  facing: 1 | -1;
  hp: number;
  wins: number;
  ko: boolean;
  stun: number;
  /** Držený blok (pro animaci). */
  blocking: boolean;
  /** Právě probíhající úder (pro animaci), nebo null. */
  attack: { kind: 'punch' | 'kick'; elapsed: number } | null;
}

export type SnapshotPlayer = ArenaPlayerState | RacePlayerState | FightPlayerState;

/** Raketa ve snapshotu (pohybuje se jen server). */
export interface RocketView {
  id: number;
  owner: string;
  x: number;
  y: number;
  z: number;
}

/** Pickup: `taken` = právě sebrán, vrátí se po `respawn` sekundách. */
export interface PickupView {
  id: string;
  taken: boolean;
}

export interface ScoreRow {
  id: string;
  name: string;
  frags: number;
  deaths: number;
}

export type EventPayload =
  /**
   * Kdo je v kanálu — posílá se **každému zvlášť** při každé změně.
   * (Dřívější `join`/`leave` chodily za každý kanál zvlášť, takže klient
   * při přechodu park → aréna napočítal člena dvakrát.)
   */
  | { kind: 'presence'; members: PlayerSummary[]; online: number }
  | { kind: 'chat'; id: string; name: string; role: Role; text: string; at: number }
  | { kind: 'kill'; killer: string; victim: string; weapon: WeaponName; at: number }
  | { kind: 'respawn'; id: string }
  | { kind: 'pickup'; id: string; item: 'health' | 'armor' }
  | { kind: 'system'; text: string; at: number }
  | { kind: 'match_start'; at: number }
  | { kind: 'match_end'; scoreboard: ScoreRow[] }
  | { kind: 'race_start'; at: number }
  | {
      kind: 'finish';
      id: string;
      name: string;
      totalSeconds: number;
      position: number;
    }
  | {
      kind: 'race_end';
      standings: { id: string; name: string; totalSeconds: number | null; laps: number }[];
    }
  // ── Merkur (duel) ────────────────────────────────────────────────────
  | { kind: 'round_start'; round: number; at: number }
  | { kind: 'round_end'; round: number; winner: string | null; reason: 'ko' | 'time'; at: number }
  | { kind: 'duel_ko'; winner: string; loser: string; round: number; at: number }
  | { kind: 'duel_end'; winner: string; aWins: number; bWins: number; at: number };

export type ErrorCode =
  | 'proto_mismatch'
  | 'bad_frame'
  | 'unknown_type'
  | 'rate_limited'
  | 'room_full'
  | 'busy'
  | 'not_in_room'
  | 'not_available'
  | 'read_only'
  | 'origin';

export type ClientMessage =
  | { t: 'hello'; proto: number }
  | { t: 'join'; game: GameId; room?: string }
  | { t: 'leave' }
  | {
      t: 'input';
      seq: number;
      /** Posun −1..1 (dopředu/vpravo), stejná konvence jako klávesy. */
      mx: number;
      mz: number;
      yaw: number;
      pitch: number;
      jump: boolean;
      fire: boolean;
      weapon: WeaponId;
      /** Jen duel (Merkur): držení bloku. Aréna/závod ji ignoruje. */
      block?: boolean;
    }
  | { t: 'chat'; text: string }
  | { t: 'ping'; at: number };

export type ServerMessage =
  | {
      t: 'welcome';
      proto: number;
      you: NetIdentity;
      rooms: RoomInfo[];
      serverTime: number;
      tickHz: number;
      snapshotHz: number;
      /** Historie kanálu, do kterého hráč padne (mimo místnost = `park`). */
      history: ChatLine[];
      /** Kolik hráčů je v jeho kanálu (včetně něj). */
      online: number;
      /** Kdo je v kanálu — pro seznam přítomných s avatary. */
      members: PlayerSummary[];
    }
  | {
      t: 'room';
      room: RoomInfo;
      occupants: PlayerSummary[];
      /** Id hráče v serverové simulaci (klient podle něj pozná sebe ve snapshotech). */
      youPlayerId?: string;
      spawn: SpawnPoint | null;
      history: ChatLine[];
    }
  | {
      t: 'snapshot';
      game: GameId;
      seq: number;
      time: number;
      players: SnapshotPlayer[];
      /** Jen aréna: rakety ve vzduchu. */
      projectiles?: RocketView[];
      pickups?: PickupView[];
      state?: 'running' | 'ended' | 'countdown' | 'roundEnd' | 'matchEnd';
      secondsLeft?: number;
      /** Závod: odpočet do startu (s), když `state === 'countdown'`. */
      countdown?: number;
      /** Závod: čas od startu (s). */
      raceSeconds?: number;
      /** Závod: počet kol. */
      laps?: number;
      /** Duel: číslo aktuálního kola (1..). */
      round?: number;
    }
  | { t: 'event'; event: EventPayload }
  | { t: 'pong'; at: number; serverTime: number }
  | { t: 'error'; code: ErrorCode; message?: string };

export interface HealthResponse {
  ok: boolean;
  service: string;
  proto: number;
  build: string;
  uptimeSec: number;
  connections: number;
  rooms: number;
}

// ── validace příchozích zpráv ─────────────────────────────────────────
// Server nesmí věřit ničemu, co přijde z drátu: čísla se ořezávají do
// rozsahů, řetězce do délek, neznámé typy se zahazují (vrátí `null`).

function num(value: unknown, min: number, max: number, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value < min ? min : value > max ? max : value;
}

function str(value: unknown, maxLen: number): string {
  return typeof value === 'string' ? value.slice(0, maxLen) : '';
}

/** `JSON.parse` + validace. `null` = zprávu zahodit (server odpoví `bad_frame`). */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > MAX_FRAME_BYTES) return null;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const message = data as Record<string, unknown>;
  switch (message.t) {
    case 'hello':
      return { t: 'hello', proto: num(message.proto, 0, 10_000) };

    case 'join':
      return {
        t: 'join',
        game: message.game === 'race' ? 'race' : message.game === 'fight' ? 'fight' : 'arena',
        room: typeof message.room === 'string' ? message.room.slice(0, 32) : undefined,
      };

    case 'leave':
      return { t: 'leave' };

    case 'input':
      return {
        t: 'input',
        seq: num(message.seq, 0, 2_147_483_647),
        mx: num(message.mx, -1, 1),
        mz: num(message.mz, -1, 1),
        yaw: num(message.yaw, -Math.PI, Math.PI),
        pitch: num(message.pitch, -Math.PI / 2, Math.PI / 2),
        jump: message.jump === true,
        fire: message.fire === true,
        weapon: message.weapon === 1 ? 1 : 0,
        block: message.block === true,
      };

    case 'chat':
      return { t: 'chat', text: str(message.text, CHAT_MAX_LEN) };

    case 'ping':
      return { t: 'ping', at: num(message.at, 0, Number.MAX_SAFE_INTEGER) };

    default:
      return null;
  }
}

export function encodeMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}
