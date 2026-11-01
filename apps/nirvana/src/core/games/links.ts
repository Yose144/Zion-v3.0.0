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
    id: 'avatars',
    href: '/avatars',
    title: { cs: 'Avatar', en: 'Avatar' },
    note: { cs: '200 postav z OASISu', en: '200 OASIS figures' },
    glyph: '✦',
    tone: '#7fe3d4',
  },
];
