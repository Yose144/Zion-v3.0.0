/**
 * JEDNA MULTIPLAYER SMYČKA PRO CELOU NIRVANU.
 *
 * Dřív měl každý režim (`arena`, `race`, `fight`, `moba`) vlastní obsluhu
 * sedadel, stavu místnosti, snapshotů i zpráv roztroušenou v `index.ts` —
 * pět if-chainů, které se musely rozšiřovat na čtyřech místech. Tenhle
 * soubor drží **jediný kontrakt**, který musí splnit každá hra; `matches.ts`
 * do něj staré moduly obalí a nové hry (tanky) ho plní rovnou.
 *
 * Pravidla:
 *  1. `step()` je jediné místo, kde se posouvá simulace — server je autorita.
 *  2. `snapshot()` staví zprávu **pro jednoho hráče** (mlha války znamená
 *     jiný snapshot pro každý tým).
 *  3. `message()` vrací `true`, když herní zprávu zpracoval; `false` nechává
 *     generickým zprávám (chat, ping, emote).
 */

import type { BattleSpellId } from '../../nirvana/src/core/moba/sim.js';
import type { ClientMessage, GameId, RoomState, ServerMessage } from '../../nirvana/src/core/net/protocol.js';

export interface MatchSeat {
  /** Veřejné jméno ze ZIS (nikdy z klienta). */
  name: string;
  avatarId?: number;
  /** Výběr hrdiny (MOBA) — ostatní hry ignorují. */
  heroId?: number;
  battleSpell?: BattleSpellId;
  /** Aspekt kouzel (MOBA): `a` ostrý, `b` ochranný. */
  aspect?: 'a' | 'b';
}

export interface MatchCtx {
  now: number;
  /** Event pro celou místnost (kanál `arena:<room>`). */
  emit: (event: unknown) => void;
  /** Systémová zpráva do chatu místnosti. */
  system: (text: string) => void;
}

export interface Match {
  readonly game: GameId;
  join(id: string, seat: MatchSeat): void;
  leave(id: string): void;
  step(dt: number, ctx: MatchCtx): void;
  state(): RoomState;
  snapshot(id: string, now: number): ServerMessage | null;
  message(id: string, message: ClientMessage): boolean;
  size(): number;
}
