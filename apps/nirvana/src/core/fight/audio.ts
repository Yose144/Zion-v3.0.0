/**
 * Zvuk souboje na Merkuru — jeden pro sólo i online.
 *
 * Sim neposílá „trefil jsem" event; zásah se pozná **poklesem HP** mezi
 * snímky, stejně jako v MOBě. Díky tomu funguje zvuk v sólu i v multiplayeru
 * bez změny protokolu a nemůže se rozejít se serverem (ten rozhoduje, my
 * jen slyšíme, co se stalo).
 *
 * Rozlišení pěst/kop jde z velikosti poškození (`PUNCH.damage` 7 vs
 * `KICK.damage` 13) — jediné číslo, které má klient k dispozici.
 */

import { play, unlock } from '@/core/audio/engine';
import { MAX_HP } from './ragdoll';

export interface DuelSound {
  unlock: () => void;
  /**
   * Jeden snímek. Zvuk vznikne jen při poklesu HP, takže volání 60×/s
   * nic nehraje, dokud se opravdu netrefí.
   */
  step: (next: { self: number; foe: number; selfBlocking: boolean; foeBlocking: boolean }) => void;
  /** Kolo / zápas — `win` je z pohledu hráče. */
  event: (kind: 'fight_start' | 'round_end' | 'match_end', win?: boolean) => void;
  reset: () => void;
}

/** Hranice mezi pěstí a kopem — kop je fyzikálně těžší a bere víc. */
const KICK_THRESHOLD = 13;

export function createDuelSound(): DuelSound {
  let selfHp = MAX_HP;
  let foeHp = MAX_HP;

  return {
    unlock() {
      unlock();
    },
    reset() {
      selfHp = MAX_HP;
      foeHp = MAX_HP;
    },
    step(next) {
      // kdo dostal ránu, toho blok rozhoduje o zvuku: blok = kov, zásah = úder
      if (next.foe < foeHp) {
        if (next.foeBlocking) play('block');
        else play(foeHp - next.foe >= KICK_THRESHOLD ? 'kick' : 'punch');
      }
      if (next.self < selfHp) {
        if (next.selfBlocking) play('block');
        else play(selfHp - next.self >= KICK_THRESHOLD ? 'kick' : 'punch');
      }
      selfHp = next.self;
      foeHp = next.foe;
    },
    event(kind, win) {
      if (kind === 'fight_start') play('bell');
      else if (kind === 'round_end') play('roundEnd');
      else play(win ? 'victory' : 'defeat');
    },
  };
}
