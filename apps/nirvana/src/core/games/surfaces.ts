/**
 * POVRCHY A OVLÁDÁNÍ — data, která potřebuje lišta i hamburger menu.
 *
 * Původně to bylo v `GameHud.tsx`. Menu se ale renderuje **z** lišty a obě
 * komponenty by se importovaly navzájem (cirkulární import). Data proto
 * bydlí tady a obě komponenty je jen čtou.
 */

/** Kde se má zobrazovat herní lišta (a tedy i menu). */
export const SURFACES = [
  '/',
  '/park',
  '/mars',
  '/venus',
  '/avatars',
  '/mercury',
  '/saturn',
  '/uranus',
  '/neptune',
  '/pluto',
  '/earth',
  '/multiplayer',
  '/lumi',
  '/fleet',
  '/piko',
];

/** Nápověda k ovládání pro aktuální povrch (jedno místo pro lištu i menu). */
export const CONTROLS: Record<string, { cs: string; en: string; es?: string; pt?: string; fr?: string }> = {
  '/': {
    cs: 'tažení myší = orbita · kolečko = přiblížení · klik na planetu = hra',
    en: 'drag = orbit · wheel = zoom · click a planet = game',
    es: 'arrastrar = órbita · rueda = zoom · clic en un planeta = juego',
    pt: 'arrastar = órbita · roda = zoom · clique num planeta = jogo',
    fr: 'glisser = orbite · molette = zoom · clic sur une planète = jeu',
  },
  '/park': {
    cs: 'vyber skříň · ve hrách šipky/WASD a klik',
    en: 'pick a cabinet · arrows/WASD and click in games',
    es: 'elige una máquina · flechas/WASD y clic en los juegos',
    pt: 'escolhe uma máquina · setas/WASD e clique nos jogos',
    fr: 'choisis une borne · flèches/WASD et clic dans les jeux',
  },
  '/mars': {
    cs: 'WASD · mezerník skok · 1–6 nebo kolečko zbraň · klik střelba',
    en: 'WASD · space jump · 1–6 or wheel weapon · click fire',
    es: 'WASD · espacio saltar · 1–6 o rueda arma · clic disparar',
    pt: 'WASD · espaço saltar · 1–6 ou roda arma · clique disparar',
    fr: 'WASD · espace saut · 1–6 ou molette arme · clic tirer',
  },
  '/venus': {
    cs: 'W/S plyn a brzda · A/D zatáčení',
    en: 'W/S throttle and brake · A/D steer',
    es: 'W/S acelerar y frenar · A/D girar',
    pt: 'W/S acelerar e travar · A/D virar',
    fr: 'W/S accélérer et freiner · A/D tourner',
  },
  '/mercury': {
    cs: 'A/D pohyb · W skok · J pěst · K kop · S blok',
    en: 'A/D move · W jump · J punch · K kick · S block',
    es: 'A/D mover · W saltar · J puño · K patada · S bloqueo',
    pt: 'A/D mover · W saltar · J soco · K pontapé · S bloqueio',
    fr: 'A/D bouger · W saut · J poing · K pied · S parade',
  },
  '/saturn': {
    cs: '← → úhel · ↑ ↓ síla · mezerník palba',
    en: '← → angle · ↑ ↓ power · space fires',
    es: '← → ángulo · ↑ ↓ potencia · espacio dispara',
    pt: '← → ângulo · ↑ ↓ força · espaço dispara',
    fr: '← → angle · ↑ ↓ puissance · espace tire',
  },
  '/earth': {
    cs: 'WASD pohyb · Q/F/E/R kouzla · G ward · 1–6 itemy',
    en: 'WASD move · Q/F/E/R spells · G ward · 1–6 items',
    es: 'WASD mover · Q/F/E/R hechizos · G barrera · 1–6 objetos',
    pt: 'WASD mover · Q/F/E/R feitiços · G barreira · 1–6 itens',
    fr: 'WASD bouger · Q/F/E/R sorts · G barrière · 1–6 objets',
  },
  '/multiplayer': {
    cs: 'vyber místnost nebo pozvi odkazem',
    en: 'pick a room or invite by link',
    es: 'elige una sala o invita con un enlace',
    pt: 'escolhe uma sala ou convida por ligação',
    fr: 'choisis une salle ou invite par lien',
  },
  '/fleet': {
    cs: 'W plyn · S brzda · A/D zatáčení · Q/E náklon · Shift boost',
    en: 'W throttle · S brake · A/D turn · Q/E roll · Shift boost',
    es: 'W acelerar · S frenar · A/D girar · Q/E alabear · Shift impulso',
    pt: 'W acelerar · S travar · A/D virar · Q/E inclinar · Shift impulso',
    fr: 'W gaz · S frein · A/D tourner · Q/E roulis · Shift boost',
  },
  '/piko': {
    cs: 'W záběr · S brzda · A/D kormidlo (kánoe i surf)',
    en: 'W stroke · S brace · A/D steer (canoe & surf)',
    es: 'W remar · S frenar · A/D timón (canoa y surf)',
    pt: 'W remar · S travar · A/D timão (canoa e surf)',
    fr: 'W ramer · S freiner · A/D gouverner (canoë et surf)',
  },
  '/neptune': {
    cs: 'A/D kormidlo proti větru · W rychlejší sestup · S přibrzdit',
    en: 'A/D steer against the wind · W dive faster · S slow down',
    es: 'A/D timón contra el viento · W descender más rápido · S frenar',
    pt: 'A/D timão contra o vento · W descer mais rápido · S travar',
    fr: 'A/D gouverner contre le vent · W descendre plus vite · S freiner',
  },
  '/avatars': {
    cs: 'klikni postavu · pak Uložit',
    en: 'click a figure · then Save',
    es: 'haz clic en una figura · luego Guardar',
    pt: 'clica numa figura · depois Guardar',
    fr: 'clique une figure · puis Enregistrer',
  },
};
