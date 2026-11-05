/**
 * HERNÍ ODKAZY — jedno místo, kde je vidět, co jde hrát a kam se kliká.
 *
 * `/mars`, `/venus`, `/mercury`, `/park` a `/avatars` jsou **skutečné routy** (ne portály
 * ve vesmíru), takže se na ně chodí `<Link>`, ne otevřením okna. Drží je
 * pohromadě tenhle seznam, aby je konzole, pouť i případná další místa
 * nemusely opisovat — a aby nikde nechyběly.
 */

export interface GameLink {
  id: string;
  href: string;
  title: { cs: string; en: string };
  note: { cs: string; en: string };
  /** Textový glyf — v nirvaně není icon knihovna a přidávat kvůli tomu dep nechceme. */
  glyph: string;
  tone: string;
}

export const GAME_LINKS: GameLink[] = [
  {
    id: 'earth',
    href: '/earth',
    title: { cs: 'První svět', en: 'First World' },
    note: { cs: 'MOBA · 3 linky · uzly L5 · online 2v2', en: 'MOBA · 3 lanes · L5 nodes · online 2v2' },
    glyph: '🌍',
    tone: '#7fe3d4',
  },
  {
    id: 'park',
    href: '/park',
    title: { cs: 'Pouť', en: 'Fair' },
    note: { cs: 'arkády · kolo · tabule', en: 'arcades · wheel · boards' },
    glyph: '🎡',
    tone: '#ffb46a',
  },
  {
    id: 'mars',
    href: '/mars',
    title: { cs: 'Mars aréna', en: 'Mars arena' },
    note: { cs: 'deathmatch · sólo i online', en: 'deathmatch · solo & online' },
    glyph: '🎯',
    tone: '#ff7a6b',
  },
  {
    id: 'venus',
    href: '/venus',
    title: { cs: 'Venuše', en: 'Venus' },
    note: { cs: 'okruh · 3 kola · soupeři', en: 'circuit · 3 laps · rivals' },
    glyph: '🏁',
    tone: '#c8f56a',
  },
  {
    id: 'mercury',
    href: '/mercury',
    title: { cs: 'Merkur — souboj', en: 'Mercury — duel' },
    note: { cs: 'best of 3 · pugilát · online', en: 'best of 3 · fists · online' },
    glyph: '⚔',
    tone: '#e8a15c',
  },
  {
    id: 'saturn',
    href: '/saturn',
    title: { cs: 'Saturn — Kroniky', en: 'Saturn — Chronicles' },
    note: { cs: 'archiv kruhů · 15 kapitol', en: 'ring archive · 15 chapters' },
    glyph: '🪐',
    tone: '#e3cf9f',
  },
  {
    id: 'uranus',
    href: '/uranus',
    title: { cs: 'Uran', en: 'Uranus' },
    note: { cs: 'ledový archiv · na boku', en: 'ice archive · on its side' },
    glyph: '❄',
    tone: '#9fd8dc',
  },
  {
    id: 'lumi',
    href: '/lumi',
    title: { cs: 'Lumi', en: 'Lumi' },
    note: { cs: 'děvčátko s lucernou · Uran', en: 'the girl with the lantern · Uranus' },
    glyph: '🏮',
    tone: '#bfe6ea',
  },
  {
    id: 'neptune',
    href: '/neptune',
    title: { cs: 'Neptun', en: 'Neptune' },
    note: { cs: 'hlubina · nejrychlejší větry', en: 'the deep · fastest winds' },
    glyph: '🌊',
    tone: '#6f86ff',
  },
  {
    id: 'pluto',
    href: '/pluto',
    title: { cs: 'Pluto', en: 'Pluto' },
    note: { cs: 'srdce na okraji', en: 'the heart at the edge' },
    glyph: '💠',
    tone: '#d8c7b4',
  },
  {
    id: 'avatars',
    href: '/avatars',
    title: { cs: 'Avatar', en: 'Avatar' },
    note: { cs: '202 postav z OASISu', en: '202 OASIS figures' },
    glyph: '✦',
    tone: '#7fe3d4',
  },
];
