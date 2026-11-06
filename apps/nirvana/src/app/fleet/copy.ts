/**
 * Texty flotily (`/fleet`) — jeden slovník, tři jazyky (L-10).
 *
 * HUD volného letu (rychlost/kurz/výška/tah) a dockový panel; názvy lodí
 * z marketu zůstávají v datech, protože je to obchodní nomenklatura.
 */
import type { Localized } from '@/core/i18n';

export const FLEET_COPY = {
  dockNote: {
    cs: 'Dok drží {hold} s v okruhu {radius} jednotky. Lodě mají vlastní tah i obratnost — B-Wing je pomalý, TIE Interceptor nejobratnější.',
    en: 'A dock holds for {hold}s within {radius} units. Ships differ in thrust and agility — the B-Wing is slow, the TIE Interceptor the most agile.',
    es: 'El dique aguanta {hold} s en un radio de {radius} unidades. Cada nave tiene su empuje y agilidad: la B-Wing es lenta, el TIE Interceptor el más ágil.',
  },
  kicker: { cs: 'Nirvana · nebeská flotila', en: 'Nirvana · sky fleet', es: 'Nirvana · flota del cielo' },
  title: { cs: 'Flotila z marketu', en: 'The marketplace fleet', es: 'La flota del mercado' },
  intro: {
    cs: 'Sedm stíhaček, které v marketu existují jako dřevěné skládačky, teď letí. Vyber si loď a doleť k Nabukanu nebo k Issobelle — oba doky se hýbou, takže se na ně musí doletět.',
    en: 'Seven starfighters that exist as wooden kits in the marketplace now fly. Pick a ship and reach Nabukano or Issobella — both docks move, so you have to fly to them.',
    es: 'Siete cazas que en el mercado existen como maquetas de madera ahora vuelan. Elige una nave y llega a Nabukano o Issobella: los dos diques se mueven, así que hay que volar hasta ellos.',
  },
  tribute: {
    cs: 'Pocta lodím, se kterými jsme vyrůstali — flotila je fanouškovská pocta, ne oficiální produkt ani spojení s držiteli práv. Modely jsou vlastní render z podkladů marketplace.',
    en: 'An homage to the ships we grew up with — the fleet is a fan tribute, not an official product or an association with the rights holders. Models are our own render of the marketplace source files.',
    es: 'Un homenaje a las naves con las que crecimos: la flota es un tributo de fans, no un producto oficial ni una asociación con los titulares de derechos. Los modelos son un render propio a partir de los archivos del mercado.',
  },
  launch: { cs: 'Vzlétnout', en: 'Launch', es: 'Despegar' },
  hangar: { cs: 'Hangár', en: 'Hangar', es: 'Hangar' },
  speed: { cs: 'rychlost', en: 'speed', es: 'velocidad' },
  heading: { cs: 'kurz', en: 'heading', es: 'rumbo' },
  altitude: { cs: 'výška', en: 'altitude', es: 'altitud' },
  thrust: { cs: 'tah', en: 'thrust', es: 'empuje' },
  nearestDock: { cs: 'nejbližší dok', en: 'nearest dock', es: 'dique más cercano' },
  throttle: { cs: 'PLYN', en: 'THRUST', es: 'EMPUJE' },
  brake: { cs: 'BRZDA', en: 'BRAKE', es: 'FRENO' },
  holdAtDock: { cs: 'Drž se u doku…', en: 'Hold at the dock…', es: 'Mantente en el dique…' },
  docked: { cs: 'Přistáno', en: 'Docked', es: 'Atracado' },
  dockedIssobella: { cs: 'Přistáno na Issobelle', en: 'Docked at Issobella', es: 'Atracado en Issobella' },
  nabukano: { cs: 'Nabukano', en: 'Nabukano', es: 'Nabukano' },
  undock: { cs: 'Odpojit se', en: 'Undock', es: 'Desatracar' },
  backToHangar: { cs: 'Zpět do výběru', en: 'Back to hangar', es: 'Volver al hangar' },
  motherShipNote: {
    cs: 'Stojíš na dokovacím rámu mateřské lodi. Rám se otáčí s flotilou, takže i dok jede.',
    en: 'You are standing on the mother ship dock frame. The frame rotates with the fleet, so the dock moves too.',
    es: 'Estás en el marco de atraque de la nave nodriza. El marco gira con la flota, así que el dique también se mueve.',
  },
  ringNote: {
    cs: 'Stanice na prstenci L6. Prstenec se otáčí, dok jede s ním.',
    en: 'The L6 ring station. The ring rotates and the dock moves with it.',
    es: 'La estación del anillo L6. El anillo gira y el dique se mueve con él.',
  },
  keys: {
    cs: 'W plyn · S brzda · A/D zatáčení · ↑↓ klopení · Q/E náklon · Shift boost',
    en: 'W throttle · S brake · A/D yaw · ↑↓ pitch · Q/E roll · Shift boost',
    es: 'W empuje · S freno · A/D giro · ↑↓ cabeceo · Q/E alabeo · Shift impulso',
  },
  spectator: { cs: 'Hlediště', en: 'Spectator', es: 'Público' },
  watching: { cs: 'díváš se na let', en: 'watching the flight', es: 'mirando el vuelo' },
  sharedFlight: { cs: 'společný let', en: 'shared flight', es: 'vuelo compartido' },
  offline: { cs: 'offline', en: 'offline', es: 'sin conexión' },
  flyingTogether: { cs: '✈ Letí se společně', en: '✈ Flying together', es: '✈ Volando juntos' },
  flyWithOthers: { cs: 'Letět s ostatními', en: 'Fly with others', es: 'Volar con otros' },
  onlineRooms: { cs: 'Online místnosti', en: 'Online rooms', es: 'Salas en línea' },
  roomNote: {
    cs: 'Ostatní uvidí tvoji loď i to, kdy přistaneš. Místnost má šest pilotů — když je plná, přidej se jinam.',
    en: 'Others see your ship and when you dock. A room holds six pilots — if it is full, join elsewhere.',
    es: 'Los demás ven tu nave y cuándo atracas. Una sala tiene seis pilotos: si está llena, únete a otra.',
  },
} as const satisfies Record<string, Localized>;

export type FleetCopyKey = keyof typeof FLEET_COPY;
