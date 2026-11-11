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

import {
  ITEMS,
  type BattleSpellId,
  type ItemId,
  type MobaSnapshot,
} from '../moba/sim';
import type { AspectId } from '../moba/spells';

const ITEM_IDS = new Set<string>(ITEMS.map((item) => item.id));
const asItemId = (value: unknown): ItemId | null =>
  typeof value === 'string' && ITEM_IDS.has(value) ? (value as ItemId) : null;

/**
 * Historie:
 *  5 — MOBA online 2v2 (`moba.ts`, snapshoty, vstup)
 *  6 — obchod s itemy (`buy`) + 3v3
 *  7 — **mlha války**: snapshot se posílá per tým, takže starý klient by
 *      viděl celou mapu (cheat) a nový klient na starém serveru by neviděl
 *      nic filtrované. Verze se musí potkat.
 *  8 — **ekonomika**: hrdina nese `xp` a `xpNeed` (HUD ukazuje postup),
 *      zlato má nový strop a přibylo pasivní zlato/deny/asistence.
 *  9 — **itemy**: 14 itemů s recepty a 6 sloty; nová zpráva `sell`.
 *      Starý klient by neznal nová id itemů v inventáři.
 * 10 — **mapa**: inhibitory (`kind: 'inhibitor'`) a super minioni (`super`).
 *      Starý klient by inhibitory kreslil jako věže a super miniony jako
 *      obyčejné — liší se jen tvarem a velikostí, ale je to jiná mapa.
 * 11 — **objektivy**: runy a boss (`runes`, `boss`) + `aegis` u hrdiny.
 *      Starý klient by runy ani bosse nekreslil, takže by hráč neviděl,
 *      o co se hraje.
 * 12 — **vidění a smrt**: wardy (`wards`, `help` zprávy `ward`/`buyback`)
 *      a cena buybacku. Starý klient by wardy neviděl a nemohl je položit.
 * 13 — **meta**: snapshot hrdiny nese `damage` a `healing` (scoreboard).
 *      Starý klient by měl tabulku bez poškození — jen kosmetika, ale je to
 *      jiný snapshot.
 * 14 — **aktivní itemy**: zpráva `use` a `itemCooldowns` u hrdiny.
 *      Starý klient by itemy neuměl spustit (klávesy 1–6) a neviděl by
 *      jejich cooldowny.
 * 15 — **talenty**: zpráva `talent` a `talents`/`talentPending` u hrdiny.
 *      Starý klient by neuměl talent vybrat a neviděl by, že na něj má nárok.
 * 16 — **neviditelnost**: `sentries`, `invisible` u hrdiny a zpráva `sentry`.
 *      Starý klient by neviděl vlastní neviditelnost ani sentry a neuměl by
 *      je položit — a nechápal, proč soupeř „zmizel".
 * 17 — **battle spell**: zpráva `battlespell` a `battleSpellIn` u hrdiny.
 *      Starý klient by neuměl Flicker spustit a neviděl by jeho cooldown.
 * 18 — **recall**: zpráva `recall` a `recallIn` u hrdiny.
 *      Starý klient by recall neuměl spustit a neviděl by channel.
 * 19 — **battle spelly**: `join` nese `battleSpell` a snapshot `battleSpell`
 *      u hrdiny. Starý klient by v multiplayeru vždy dostal Flicker.
 * 20 — **emotes**: zpráva `emote` a event `emote` (bublina nad hrdinou).
 *      Starý klient by emote neuměl poslat ani zobrazit.
 * 21 — **tanky (Saturn)**: nové `GameId 'tanks'`, zprávy `aim`/`shoot`
 *      a `tanks` ve snapshotu. Starý server by join do `tanks` neuměl a
 *      klient by skončil v chybě.
 * 22 — **lobby**: server posílá `rooms` při každé změně (nová místnost,
 *      hráč navíc, konec hry). Starý klient tuhle zprávu ignoroval, takže
 *      by jen neměl živý seznam — proto se verze zvedá kvůli shodě.
 * 23 — **pozvánky a chat hostů**: `join` s neexistující místností vrací
 *      `room_missing` (dřív se tiše založila nová) a psát smí i host
 *      (1 zpráva / 4 s, 120 znaků) — jinak byl chat v multiplayeru mrtvý.
 * 24 — **reconnect**: `hello` nese `resume` token, `welcome` ho vrací
 *      (`resume`/`resumed`), takže po výpadku se hráč vrátí do stejného
 *      sedla. Starý server by token ignoroval a poslal hráče do nové
 *      místnosti, proto se verze zvedá.
 * 25 — **režim místnosti**: `join` nese `mode` (`bots`/`humans`) a `RoomInfo`
 *      ho vrací. Starý server by `humans` ignoroval a hned doplnil boty.
 * 26 — **pas i na multiplayeru**: bez cookie `zion_nirvana_pass` server
 *      odmítne `join` (`pass_required`). Klient bez pasu by se jinak dostal
 *      do hry přes vlastní WebSocket klient.
 *  33 — **ragdoll Merkur**: `FightPlayerState` nese `pose` (22 čísel = 11 bodů
 *      loutky). Starý klient by kreslil loutku bez pózy. Verze se musí potkat.
 *  34 — **ragdoll pro**: snapshot nese `guard` (výdrž krytu) a `combo`
 *      (série zásahů). Starý klient by neviděl výdrž krytu ani kombo.
 *  35 — **ragdoll tuning**: MAX_HP 160, nové poškození/kryt/kombo. Formát
 *      zpráv se nemění, ale starý server by posílal HP ze 100 a klient by
 *      kreslil jiné bary — verze se musí potkat.
 */
export const PROTO_VERSION = 36;

/** Hz serverové smyčky, rozesílání stavu a vstupu klienta. */
export const TICK_HZ = 30;
export const SNAPSHOT_HZ = 15;
export const INPUT_HZ = 20;

export const MAX_PLAYERS = 8;
export const MAX_ROOMS = 4;
/** Místnost souboje na Merkuru — duel je vždy dva. */
export const FIGHT_ROOM_SIZE = 2;
/** Kolik lidí může letět v Lumi najednou (víc by z oblohy udělalo trh). */
export const LUMI_ROOM_SIZE = 4;
/**
 * Kolik stíhaček letí jednou místností flotily.
 *
 * Šest je strop kvůli modelům: každá loď z marketu je 10–24 k trojúhelníků,
 * takže šest cizích lodí + vlastní už je za polovinou rozpočtu scény
 * (naměřeno 26 k s jednou lodí; univerzum má 90 k).
 */
export const FLEET_ROOM_SIZE = 6;
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

export type GameId = 'arena' | 'race' | 'fight' | 'moba' | 'tanks' | 'lumi' | 'fleet';
/** `guest` = bez ZIS (hraje, ale nepíše), `zis` = ověřený uživatel. */
export type Role = 'guest' | 'zis';
export type RoomState = 'waiting' | 'running' | 'ended';

/**
 * `bots` = prázdná sedla hned doplní boti (výchozí, hra začne hned),
 * `humans` = čeká se na lidi (turnaj, hraní s pozvaným).
 */
export type RoomMode = 'bots' | 'humans';
/**
 * 0 = rail, 1 = rakety, 2 = MG, 3 = brokovnice, 4 = blesk, 5 = plazma,
 * 6 = pěst (Q3 sada). Stejné pořadí jako `WEAPONS` v `core/arena`.
 */
export type WeaponId = 0 | 1 | 2 | 3 | 4 | 5 | 6;
/** Jméno zbraně do eventů (čitelnost > bajty). */
export type WeaponName = 'rail' | 'rocket' | 'mg' | 'shotgun' | 'lightning' | 'plasma' | 'gauntlet';

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
  mode: RoomMode;
  /** Kolik lidí se jen dívá (nesedí v sedle, nepočítají se do kapacity). */
  spectators?: number;
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
  /** Munice všech zbraní pro HUD (rail/pěst = −1 = nekonečno). */
  ammoByWeapon?: Record<number, number>;
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
  /** Nádrž nitra 0..1 (jen novější server — může chybět). */
  nitro?: number;
  /** Právě táhne nitro — pro plameny na vzdálených vozidlech. */
  boost?: boolean;
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
  /**
   * Póza ragdoll loutky: ploché `[x0,y0,x1,y1,…]`, 11 bodů (22 čísel).
   * Server je autorita, klient pózy jen interpoluje.
   */
  pose?: number[];
  /** Výdrž krytu 0..1 — při nule se kryt zlomí a hráč dostane stun. */
  guard?: number;
  /** Aktuální série zásahů (0 = žádná). */
  combo?: number;
}

/** Saturn — tanky: strana 0 = levý hráč, 1 = pravý (dřív bot). */
export type TankSideId = 0 | 1;

export interface TanksViewTank {
  side: TankSideId;
  x: number;
  hp: number;
  angle: number;
  power: number;
  alive: boolean;
}

/**
 * Snapshot tanků. `terrain` se posílá **jen když se změnil** (kráter) —
 * 161 výšek při 15 Hz by jinak byl zbytečný provoz.
 */
export interface TanksView {
  you: TankSideId;
  turn: TankSideId;
  phase: 'aim' | 'flight' | 'resolve' | 'over';
  wind: number;
  tanks: [TanksViewTank, TanksViewTank];
  shot: { x: number; y: number; trail: number[] } | null;
  lastHit: { x: number; y: number; damage: number; by: TankSideId } | null;
  wins: [number, number];
  shots: number;
  over: TankSideId | null;
  terrainVersion: number;
  /** Jen při změně terénu (jinak `null`). */
  terrain: number[] | null;
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
  | {
      kind: 'chat';
      id: string;
      name: string;
      role: Role;
      text: string;
      at: number;
      /** Zpráva z haly (park) — vidí ji i hráči v místnostech. */
      park?: true;
    }
  | { kind: 'kill'; killer: string; victim: string; weapon: WeaponName; at: number }
  | { kind: 'respawn'; id: string }
  | { kind: 'pickup'; id: string; item: 'health' | 'armor' | 'ammo' | 'powerup' | 'mega' }
  | { kind: 'system'; text: string; at: number }
  | { kind: 'emote'; playerId: string; emote: number; at: number }
  /**
   * Lumi: světlo bylo předáno (L-6). Nese oba konce, takže to vidí dárce
   * i obdarovaný — klient si podle `to` pozná, že se to týká jeho HUD.
   */
  | { kind: 'gift'; light: number; from: string; fromName: string; to: string; at: number }
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
  /** Pozvánka do místnosti, která mezitím zmizela (nebo je jiné hry). */
  | 'room_missing'
  /** Vstup do hry vyžaduje ZION Archive Pass (cookie). */
  | 'pass_required'
  | 'busy'
  | 'not_in_room'
  | 'not_available'
  | 'read_only'
  | 'origin';

export type ClientMessage =
  | {
      t: 'hello';
      proto: number;
      /** Token z předchozího `welcome` — obnovení rozehráté session. */
      resume?: string;
    }
  | {
      t: 'join';
      game: GameId;
      room?: string;
      heroId?: number;
      battleSpell?: BattleSpellId;
      /** Aspekt kouzel (`a` ostrý, `b` ochranný) — volba před zápasem. */
      aspect?: AspectId;
      /** Lumi: kterou cestou se letí (`calm` | `wind` | `light`). */
      path?: 'calm' | 'wind' | 'light';
      /**
       * Flotila: kterou lodí se letí (`awing`, `xwing`, …).
       * Server id jen ověří proti seznamu a přeposílá ostatním — kdyby si
       * klient posílal id každý snímek, byl by to zbytečný provoz.
       */
      shipId?: string;
      /** Režim nové místnosti (u existující se ignoruje). */
      mode?: RoomMode;
      /**
       * Divák: usedne do místnosti, ale **nedostane sedlo**. Server mu
       * posílá stejné snapshoty, jeho vstup zahazuje. `room` je povinné —
       * dívat se dá jen na místnost, která existuje.
       */
      spectate?: boolean;
    }
  /** MOBA: nákup itemu (jen v místnosti typu `moba`). */
  | { t: 'buy'; item: ItemId }
  /** MOBA: prodej itemu (vrací 60 % ceny). */
  | { t: 'sell'; item: ItemId }
  /** MOBA: polož ward na bod (jen v místnosti `moba`). */
  | { t: 'ward'; x: number; z: number }
  /** MOBA: buyback — mrtvý hráč zaplatí a vrátí se do hry. */
  | { t: 'buyback' }
  /** MOBA: použití aktivního itemu (bod má smysl u skoku). */
  | { t: 'use'; item: ItemId; x?: number; z?: number }
  /** MOBA: volba talentu (tier 10/15, pick 0/1). */
  | { t: 'talent'; tier: number; pick: number }
  /** MOBA: polož sentry (odhaluje neviditelné). */
  | { t: 'sentry'; x: number; z: number }
  /** MOBA: battle spell (Flicker) na bod. */
  | { t: 'battlespell'; x: number; z: number }
  /** MOBA: recall — návrat do základny po channelu. */
  | { t: 'recall' }
  /** MOBA: emote (0–3) — bublina nad hrdinou pro celý tým/soupeře. */
  | { t: 'emote'; id: number }
  /** Tanky: nastavení mířidla (absolutní hodnoty, server validuje rozsah). */
  | { t: 'aim'; angle: number; power: number }
  /** Tanky: výstřel — platí jen ve fázi `aim` a na tahu. */
  | { t: 'shoot' }
  /**
   * Lumi: stav letu od klienta.
   *
   * Lumi je **relay** hra, ne autoritativní simulace: nemá zásahy ani skóre,
   * které by šlo podvádět, takže klient počítá svůj let sám a server ho jen
   * předává ostatním (a drží sdílený seznam sebraných světel).
   */
  | {
      t: 'fly';
      x: number;
      y: number;
      vx: number;
      vy: number;
      energy: number;
      collect?: number;
      finished?: boolean;
    }
  /**
   * Lumi: předat světlo spolulentci (L-6).
   *
   * Vlastní zpráva, ne pole ve `fly` — jinak by musel klient posílat i pozici
   * a mohl by ji omylem vynulovat. Posílá se **id světla**, ne komu: cíl
   * vybírá server (nejbližší jiný letec), takže klient nepotřebuje znát cizí
   * identitu a nemůže darovat „někomu, kdo tam není".
   */
  | { t: 'handoff'; light: number }
  /**
   * Flotila: stav letu od klienta (3D).
   *
   * Stejný princip jako Lumi — **relay, ne autoritativní simulace**: volný let
   * nemá zásahy ani skóre, takže není co podvádět. Server hodnoty jen ověří
   * (konečná čísla, rozsahy, `dockId` proti seznamu doků) a přepošle.
   */
  | {
      t: 'flight';
      x: number;
      y: number;
      z: number;
      yaw: number;
      pitch: number;
      roll: number;
      speed: number;
      /** Kotví loď? Ostatní díky tomu vidí, kdo stojí na doku. */
      docked?: boolean;
      dockId?: string;
    }
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
      /** Jen MOBA (První svět): držený útok a kouzlo na bod. */
      attack?: boolean;
      castSlot?: 'Q' | 'W' | 'E' | 'R';
      castX?: number;
      castZ?: number;
      /** Jen závod (Venuše): ruční brzda do driftu a nitro. Ostatní hry ignorují. */
      handbrake?: boolean;
      boost?: boolean;
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
      /** Token pro obnovení session po výpadku (ukládá klient). */
      resume?: string;
      /** `true` = server navázal na předchozí session (místnost zůstala). */
      resumed?: boolean;
    }
  | {
      t: 'room';
      room: RoomInfo;
      /** `true` = sedíš v hledišti, ne v sedle (vstup se zahazuje). */
      spectator?: boolean;
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
      /** Aréna/závod/duel: stav hráčů. MOBA posílá `moba` a tohle nechává prázdné. */
      players: SnapshotPlayer[];
      /** Jen Lumi: sdílená světla místnosti a stav ostatních letců. */
      lumi?: {
        path: 'calm' | 'wind' | 'light';
        /** Sebraná světla — společná pro celou místnost. */
        lights: number[];
        /** Je svatyně otevřená (máme všech sedm)? */
        open: boolean;
        /** Ostatní letci (relay; vlastní stav klient nepotřebuje). */
        flyers: {
          id: string;
          name: string;
          avatarId: number | null;
          x: number;
          y: number;
          vx: number;
          vy: number;
          energy: number;
          finished: boolean;
          /**
           * Hráč odešel a tohle je jen **duch** na poslední pozici (3 s).
           * Klient ho kreslí s klesající průhledností; nepočítá se do
           * „letí s tebou", protože už tam není.
           */
          ghost?: boolean;
          /** Kolik světel tenhle letec dostal darem (L-6). */
          gifts?: number;
          /**
           * Kolik světel **sám** sebral (L-11). Slouží k rozdělení koop
           * odměny podílem — obdoba PPLNS: kdo přinesl víc, dostane víc.
           */
          collected?: number;
        }[];
        /**
         * Vlastní souhrn (snapshot jinak sebe neposílá) — bez něj by klient
         * nemohl spočítat svůj podíl na koop odměně.
         */
        you?: { collected: number };
      };
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
      /** MOBA (První svět): celý stav hry — hrdinové, věže, uzly, efekty. */
      moba?: MobaSnapshot;
      /** Saturn — tanky (artilerie 1v1). */
      tanks?: TanksView;
      /**
       * Flotila: ostatní stíhačky v místnosti (relay, vlastní stav klient
       * nepotřebuje — predikuje si ho sám stejnou `stepShip`).
       */
      fleet?: {
        /**
         * Kotviště, která právě drží někdo jiný. Jedno kotviště = jedna loď;
         * HUD podle toho řekne „obsazeno", aby člověk letěl na volné.
         */
        occupied?: string[];
        /** Kotviště, které server právě odmítl (bylo obsazené) — pro mě. */
        conflict?: string;
        pilots: {
          id: string;
          name: string;
          avatarId: number | null;
          /** Která loď z marketu — klient ji vykreslí stejnou cestou jako svou. */
          shipId: string;
          x: number;
          y: number;
          z: number;
          yaw: number;
          pitch: number;
          roll: number;
          speed: number;
          docked: boolean;
          dockId?: string;
          /** Hráč odešel, tohle je duch na poslední pozici (3 s). */
          ghost?: boolean;
        }[];
      };
    }
  | {
      /**
       * Živý seznam místností — posílá se **každému**, kdo prošel `hello`,
       * když se změní počet hráčů nebo stav místnosti. Lobby podle toho
       * kreslí, co je otevřené; bez toho by klient viděl jen stav při
       * připojení a seznam by zastaral.
       */
      t: 'rooms';
      rooms: RoomInfo[];
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
      return {
        t: 'hello',
        proto: num(message.proto, 0, 10_000),
        resume: typeof message.resume === 'string' ? message.resume.slice(0, 64) : undefined,
      };

    case 'join': {
      // neznámá hra nesmí tiše skončit v aréně — buď je v seznamu, nebo join propadne
      const game = message.game;
      if (
        game !== 'arena' &&
        game !== 'race' &&
        game !== 'fight' &&
        game !== 'moba' &&
        game !== 'tanks' &&
        game !== 'lumi' &&
        game !== 'fleet'
      ) {
        return null;
      }
      return {
        t: 'join',
        game,
        room: typeof message.room === 'string' ? message.room.slice(0, 32) : undefined,
        mode: message.mode === 'humans' ? 'humans' : message.mode === 'bots' ? 'bots' : undefined,
        heroId: typeof message.heroId === 'number' ? num(message.heroId, 0, 202) : undefined,
        battleSpell:
          message.battleSpell === 'heal' || message.battleSpell === 'purify' || message.battleSpell === 'flicker'
            ? message.battleSpell
            : undefined,
        aspect: message.aspect === 'b' ? 'b' : message.aspect === 'a' ? 'a' : undefined,
        path:
          message.path === 'wind' || message.path === 'light' || message.path === 'calm'
            ? message.path
            : undefined,
        // id lodi ověří až server proti seznamu z `core/fleet/ships` — tady
        // jen ořežeme, co přes síť může přijít
        shipId: typeof message.shipId === 'string' ? message.shipId.slice(0, 24) : undefined,
        spectate: message.spectate === true ? true : undefined,
      };
    }

    case 'leave':
      return { t: 'leave' };

    case 'aim':
      return {
        t: 'aim',
        angle: num(message.angle, 0, 90),
        power: num(message.power, 0, 100),
      };

    case 'shoot':
      return { t: 'shoot' };

    case 'fly':
      return {
        t: 'fly',
        x: num(message.x, 0, 120),
        y: num(message.y, 0, 120),
        vx: num(message.vx, -60, 60),
        vy: num(message.vy, -60, 60),
        energy: num(message.energy, 0, 100),
        collect: typeof message.collect === 'number' ? num(message.collect, 1, 7) : undefined,
        finished: message.finished === true ? true : undefined,
      };

    case 'handoff':
      return { t: 'handoff', light: num(message.light, 1, 7) };

    // Flotila: volný let. Rozsahy odpovídají `core/fleet/flight.ts` —
      // souřadnice jsou v lokální soustavě Nové Země (±WORLD_RADIUS 34),
      // pitch ±1,15 a roll ±0,8 (sim je tak drží), yaw se posílá zabalený
      // do (−π, π], takže ±4 stačí s rezervou.
    case 'flight':
      return {
        t: 'flight',
        x: num(message.x, -40, 40),
        y: num(message.y, -40, 40),
        z: num(message.z, -40, 40),
        yaw: num(message.yaw, -4, 4),
        pitch: num(message.pitch, -1.2, 1.2),
        roll: num(message.roll, -1, 1),
        speed: num(message.speed, -30, 40),
        docked: message.docked === true ? true : undefined,
        dockId: typeof message.dockId === 'string' ? message.dockId.slice(0, 24) : undefined,
      };

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
        weapon: Math.round(num(message.weapon, 0, 6)) as WeaponId,
        block: message.block === true,
        attack: message.attack === true,
        castSlot:
          message.castSlot === 'Q' || message.castSlot === 'W' || message.castSlot === 'E' || message.castSlot === 'R'
            ? message.castSlot
            : undefined,
        castX: num(message.castX, -60, 60),
        castZ: num(message.castZ, -60, 60),
        handbrake: message.handbrake === true,
        boost: message.boost === true,
      };

    case 'buy': {
      const item = asItemId(message.item);
      return item ? { t: 'buy', item } : null;
    }

    case 'sell': {
      const item = asItemId(message.item);
      return item ? { t: 'sell', item } : null;
    }

    case 'ward':
      return { t: 'ward', x: num(message.x, -60, 60), z: num(message.z, -60, 60) };

    case 'buyback':
      return { t: 'buyback' };

    case 'sentry':
      return { t: 'sentry', x: num(message.x, -60, 60), z: num(message.z, -60, 60) };

    case 'battlespell':
      return { t: 'battlespell', x: num(message.x, -60, 60), z: num(message.z, -60, 60) };

    case 'recall':
      return { t: 'recall' };

    case 'emote':
      return { t: 'emote', id: num(message.id, 0, 3) };

    case 'talent': {
      const tier = Number(message.tier);
      const pick = Number(message.pick);
      if ((tier !== 10 && tier !== 15) || (pick !== 0 && pick !== 1)) return null;
      return { t: 'talent', tier, pick };
    }

    case 'use': {
      const item = asItemId(message.item);
      if (!item) return null;
      return { t: 'use', item, x: num(message.x, -60, 60), z: num(message.z, -60, 60) };
    }

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
