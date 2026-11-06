/**
 * Texty Merkuru (`/mercury`) — jeden slovník, tři jazyky (L-10).
 *
 * Souboj má dva režimy (sólo proti stínu, online proti lidem), takže se tu
 * potkávají texty pro oba — včetně hlášek z konce kola, které se snadno
 * zapomenou, protože jsou vidět jen dvě sekundy.
 */
import type { Localized } from '@/core/i18n';

export const DUEL_COPY = {
  botOpponent: {
    cs: 'soupeř byl bot — zápas se nepočítá do tabule',
    en: 'opponent was a bot — not ranked',
    es: 'el rival era un bot — no cuenta para la tabla',
  },
  noPoints: { cs: 'duel skončil bez bodů', en: 'duel ended without points', es: 'el duelo terminó sin puntos' },
  win: { cs: 'výhra', en: 'win', es: 'victoria' },
  you: { cs: 'Ty', en: 'You', es: 'Tú' },
  practiceShadow: { cs: 'Cvičný stín', en: 'Practice shadow', es: 'Sombra de práctica' },
  leaveDuel: {
    cs: 'Ukončit souboj a vrátit se do menu',
    en: 'Leave duel and return to menu',
    es: 'Salir del duelo y volver al menú',
  },
  menu: { cs: 'Menu', en: 'Menu', es: 'Menú' },
  round: { cs: 'kolo', en: 'round', es: 'asalto' },
  waiting: { cs: 'čeká se na soupeře', en: 'waiting for opponent', es: 'esperando rival' },
  offline: { cs: 'offline', en: 'offline', es: 'sin conexión' },
  practice: { cs: 'cvičení', en: 'practice', es: 'práctica' },
  connecting: { cs: 'Připojuji duel…', en: 'Connecting to duel…', es: 'Conectando al duelo…' },
  findingRing: {
    cs: 'Hledám volnou klec na Merkuru.',
    en: 'Finding an open Mercury ring.',
    es: 'Buscando una jaula libre en Mercurio.',
  },
  reconnecting: {
    cs: 'Obnovuji spojení s herním serverem.',
    en: 'Reconnecting to the game server.',
    es: 'Reconectando con el servidor de juego.',
  },
  youWon: {
    cs: 'vyhrál jsi — nový duel začne za chvíli',
    en: 'you won — new duel starts shortly',
    es: 'has ganado — empieza otro duelo en un momento',
  },
  youLost: { cs: 'prohra — odplata začne za chvíli', en: 'defeat — rematch incoming', es: 'derrota — la revancha llega pronto' },
  victory: { cs: 'VÍTĚZSTVÍ', en: 'VICTORY', es: 'VICTORIA' },
  defeat: { cs: 'PROHRA', en: 'DEFEAT', es: 'DERROTA' },
  practiceResets: { cs: 'Cvičný souboj se za chvíli obnoví.', en: 'Practice match resets shortly.', es: 'El combate de práctica se reinicia pronto.' },
  left: { cs: 'Doleva', en: 'Move left', es: 'Izquierda' },
  right: { cs: 'Doprava', en: 'Move right', es: 'Derecha' },
  punch: { cs: 'Pěst', en: 'Punch', es: 'Puñetazo' },
  kick: { cs: 'Kop', en: 'Kick', es: 'Patada' },
  block: { cs: 'Blokovat', en: 'Block', es: 'Bloquear' },
  blockShort: { cs: 'blok', en: 'block', es: 'bloqueo' },
  jump: { cs: 'Skočit', en: 'Jump', es: 'Saltar' },
  jumpShort: { cs: 'skok', en: 'jump', es: 'salto' },
  title: { cs: 'Merkur — souboj', en: 'Mercury — duel', es: 'Mercurio — duelo' },
  moveShort: { cs: 'pohyb', en: 'move', es: 'movimiento' },
  punchShort: { cs: 'pěst', en: 'punch', es: 'puñetazo' },
  kickShort: { cs: 'kop', en: 'kick', es: 'patada' },
  difficulty: { cs: 'Obtížnost soupeře', en: 'Opponent difficulty', es: 'Dificultad del rival' },
  shadowSkill: { cs: 'Síla cvičného stínu', en: 'Practice shadow skill', es: 'Nivel de la sombra' },
  practiceVsBot: { cs: 'Cvičit proti botovi', en: 'Practice vs bot', es: 'Practicar contra un bot' },
  online: { cs: 'Online duel — proti lidem', en: 'Online duel — against people', es: 'Duelo en línea — contra personas' },
  backToMars: { cs: '← Mars aréna', en: '← Mars arena', es: '← Arena de Marte' },
  toVenus: { cs: 'Venuše závod →', en: 'Venus race →', es: 'Carrera de Venus →' },
  intro: {
    cs: 'Klec na Merkuru, dva bojovníci, pěst a kop. Cvič proti stínu, nebo připoj online duel — server rozhoduje každý zásah.',
    en: 'A cage on Mercury, two fighters, fists and kicks. Practice against the shadow, or join an online duel — the server rules every hit.',
    es: 'Una jaula en Mercurio, dos luchadores, puños y patadas. Entrena contra la sombra o únete a un duelo en línea: el servidor decide cada golpe.',
  },
  keysTip: {
    cs: 'A/D pohyb · W skok · J pěst · K kop · S blok',
    en: 'A/D move · W jump · J punch · K kick · S block',
    es: 'A/D movimiento · W salto · J puñetazo · K patada · S bloqueo',
  },
  coachTip: {
    cs: 'Nejdřív dojdi do dosahu. Pěst je rychlá, kop zasáhne dál a blok výrazně tlumí poškození.',
    en: 'Close the distance first. Punches are quick, kicks reach farther, and blocking cuts damage.',
    es: 'Primero acércate. El puñetazo es rápido, la patada llega más lejos y bloquear reduce el daño.',
  },
} as const satisfies Record<string, Localized>;

export type DuelCopyKey = keyof typeof DUEL_COPY;
