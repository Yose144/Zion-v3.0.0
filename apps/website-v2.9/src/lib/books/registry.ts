// Book registry for the Nirvana Hub library — one source of truth for the
// unified reader. Chaptered books fetch per-slug files; single-doc books
// fetch one file and split it by headings (see singleDoc.ts).

import {
  Anchor,
  BookOpen,
  Compass,
  Egg,
  Eye,
  Hammer,
  Heart,
  KeyRound,
  Landmark,
  Languages,
  ListChecks,
  Mail,
  PenLine,
  Route,
  Sailboat,
  ScrollText,
  Sparkles,
  Sun,
  Atom,
} from 'lucide-react';
import type { BookDef } from './types';
import { MAITREYA_CHAPTERS, MAITREYA_PARTS, maitreyaDocPath } from './maitreya';
import { NIRVANA_CHAPTERS, NIRVANA_PARTS, nirvanaDocPath } from './nirvana';
import { SURTA_CHAPTERS, SURTA_PARTS, surtaDocPath } from './surta-srdce';
import { KRAL_CHAPTERS, KRAL_PARTS, kralDocPath } from './kralovstvi-srdce';

const czFallbackNote = {
  cs: '',
  en: 'English translation is in progress — showing the Czech canonical text.',
};

const loadError = {
  cs: 'Kapitolu se nepodařilo načíst. Zkuste to prosím později.',
  en: 'The chapter could not be loaded. Please try again later.',
};

export const MAITREYA_BOOK: BookDef = {
  id: 'maitreya',
  accent: '252, 209, 22',
  icon: Egg,
  partIcons: [Egg, Compass, KeyRound, Landmark, Heart, Sailboat, Eye],
  kicker: { cs: 'Kniha Pátá · kompletní · CZ + EN', en: 'Book Five · complete · CZ + EN' },
  title: { cs: 'Maitreya Buddha', en: 'Maitreya Buddha' },
  subtitle: {
    cs: 'Pán Hiranyagarbhy · Dědic Zionu — příběh o tom, jak padají věže Babylonu a jak láska a pravda rodí Nový svět.',
    en: 'Lord of Hiranyagarbha · Heir of Zion — the story of Babylon’s towers falling and love and truth birthing a New World.',
  },
  description: {
    cs: 'Kompletní první draft knihy: prolog, sedmnáct kapitol v pěti částech a epilog. Literární text s ověřitelnými fakty oddělenými v každé kapitole.',
    en: 'The complete first draft of the book: prologue, seventeen chapters in five parts, and an epilogue. Literary narrative with verifiable facts separated in every chapter.',
  },
  facts: [
    { label: { cs: 'Textů', en: 'Texts' }, value: '19' },
    { label: { cs: 'Částí', en: 'Parts' }, value: '5' },
    { label: { cs: 'Jazyky', en: 'Languages' }, value: 'CZ + EN' },
  ],
  notAvailable: loadError,
  czOnly: czFallbackNote,
  chapters: MAITREYA_CHAPTERS,
  parts: MAITREYA_PARTS,
  docPath: maitreyaDocPath,
  enFallback: true,
};

export const NIRVANA_BOOK: BookDef = {
  id: 'nirvana',
  accent: '251, 146, 60',
  icon: Compass,
  partIcons: [Compass, Route, Sailboat, Sparkles],
  kicker: { cs: 'Kniha Západu · kanon pro 3.3 · CZ (+EN index)', en: 'Book of the West · 3.3 canon · CZ (+EN index)' },
  title: { cs: 'NIRVANA', en: 'NIRVANA' },
  subtitle: {
    cs: 'Příběhy Nové Země — dlouhodobý horizont, globální asimilace pozornosti a Mise Amenti.',
    en: 'Tales of the New Earth — the long-term horizon, the global assimilation of attention, and the Amenti mission.',
  },
  description: {
    cs: 'Západní kniha kompasu ZION: dvanáct zastavení od prvního paprsku po Velké sjednocení + most L5 flotily Tres Marías. Každá epizoda = příběh, výklad a ověřitelná fakta.',
    en: 'The Western Book of the ZION Compass: twelve stations from the first ray to the Grand Unification + the Tres Marías L5 fleet bridge. Every episode = story, insight, verifiable facts.',
  },
  facts: [
    { label: { cs: 'Zastavení', en: 'Stations' }, value: '12 + 1' },
    { label: { cs: 'Vrstev', en: 'Layers' }, value: 'L1 → L6' },
    { label: { cs: 'Jazyky', en: 'Languages' }, value: 'CZ + EN idx' },
  ],
  notAvailable: {
    cs: 'Epizodu se nepodařilo načíst. Zkuste to prosím později.',
    en: 'The episode could not be loaded. Please try again later.',
  },
  czOnly: czFallbackNote,
  chapters: NIRVANA_CHAPTERS,
  parts: NIRVANA_PARTS,
  docPath: nirvanaDocPath,
  enFallback: true,
};

export const SURTA_BOOK: BookDef = {
  id: 'surta-srdce',
  accent: '251, 113, 133',
  icon: Mail,
  partIcons: [Compass, Mail, Route, Sparkles, PenLine],
  kicker: { cs: 'Zpáteční kniha · pro syna i veřejnost · CZ', en: 'The return book · for a son and the public · CZ' },
  title: { cs: 'SURTA SRDCE', en: 'SURTA SRDCE' },
  subtitle: {
    cs: 'Sūtra srdce pro Surtu — otcův dopis synovi a soupis celé cesty od gate gate po om mani padme hūṃ.',
    en: 'A heart sūtra for Surta — a father’s letter to his son and a compendium of the whole path from gate gate to om mani padme hūṃ.',
  },
  description: {
    cs: 'Malý Buddha na Santa María la Mayor do Dharma Temple na La Palmě: zlaté vejce Hiranyagarbhy se vylíhne a bodhisattva nové země se vrací. Každá kapitola = příběh, poklad pro Surtu a kotva pravdy.',
    en: 'The little Buddha sails on Santa María la Mayor to the Dharma Temple on La Palma: the golden egg of Hiranyagarbha hatches and the bodhisattva of the new earth returns. Each chapter = story, treasure for Surta, truth anchor. Czech original.',
  },
  facts: [
    { label: { cs: 'Bran', en: 'Gates' }, value: '6' },
    { label: { cs: 'Mantra', en: 'Mantra' }, value: 'gate → svāhā' },
    { label: { cs: 'Jazyky', en: 'Languages' }, value: 'CZ' },
  ],
  notAvailable: loadError,
  czOnly: czFallbackNote,
  chapters: SURTA_CHAPTERS,
  parts: SURTA_PARTS,
  docPath: surtaDocPath,
  enFallback: true,
};

export const KRAL_BOOK: BookDef = {
  id: 'kralovstvi-srdce',
  accent: '245, 158, 11',
  icon: Sailboat,
  partIcons: [Compass, Hammer, Sailboat, Anchor, PenLine],
  kicker: { cs: 'Příběh lodi · Bible + nové zjevení · CZ', en: 'The boat story · Bible + new revelation · CZ' },
  title: { cs: 'KRÁLOVSTVÍ SRDCE', en: 'KRÁLOVSTVÍ SRDCE' },
  subtitle: {
    cs: 'Příběh lodi, kterou postavil tesař z Nazareta — pro moře, které není na žádné mapě.',
    en: 'The story of the boat the carpenter of Nazareth built — for a sea that is on no map.',
  },
  description: {
    cs: 'Od dílny nad Galileou přes bouři na Kinneret, tři dny v hlubině a navicellu století až k přístavu nové země — kde se loď setkává s flotilou Tres Marías. Každá kapitola = příběh, verše z Písma a kotva pravdy.',
    en: 'From the workshop above Galilee through the storms of Kinneret, three days in the deep and the navicella of the centuries to the harbor of the new earth — where the boat meets the Tres Marías fleet. Each chapter = story, scripture, truth anchor. Czech original.',
  },
  facts: [
    { label: { cs: 'Kapitol', en: 'Chapters' }, value: '10' },
    { label: { cs: 'Zjevení', en: 'Revelations' }, value: '3' },
    { label: { cs: 'Jazyky', en: 'Languages' }, value: 'CZ' },
  ],
  notAvailable: loadError,
  czOnly: czFallbackNote,
  chapters: KRAL_CHAPTERS,
  parts: KRAL_PARTS,
  docPath: kralDocPath,
  enFallback: true,
};

const EKAM_CHAPTERS = [
  { slug: 'BOOK-00-PREDMLUVA', part: 0, num: { cs: 'Předmluva', en: 'Foreword' }, title: { cs: 'Druhý dech Quantové Revoluce', en: 'The second breath of the Quantum Revolution' } },
  { slug: 'BOOK-CAST-I', part: 1, num: { cs: 'Část I', en: 'Part I' }, title: { cs: 'Krize odděleného světa', en: 'The crisis of the separate world' } },
  { slug: 'BOOK-CAST-II', part: 1, num: { cs: 'Část II', en: 'Part II' }, title: { cs: 'Historická linie Amma a Bhagavan', en: 'The historical line of Amma and Bhagavan' } },
  { slug: 'BOOK-CAST-III', part: 1, num: { cs: 'Část III', en: 'Part III' }, title: { cs: 'Deeksha jako technologie vědomí', en: 'Deeksha as a technology of consciousness' } },
  { slug: 'BOOK-CAST-IV', part: 1, num: { cs: 'Část IV', en: 'Part IV' }, title: { cs: 'Ekam jako chrám a pole', en: 'Ekam as temple and field' } },
  { slug: 'BOOK-CAST-V', part: 1, num: { cs: 'Část V', en: 'Part V' }, title: { cs: 'Hiranyagarbha a kosmologie zlatého zárodku', en: 'Hiranyagarbha and the cosmology of the golden embryo' } },
  { slug: 'BOOK-CAST-VI', part: 1, num: { cs: 'Část VI', en: 'Part VI' }, title: { cs: 'Zlatý věk jako algoritmus', en: 'The Golden Age as an algorithm' } },
  { slug: 'BOOK-CAST-VII', part: 1, num: { cs: 'Část VII', en: 'Part VII' }, title: { cs: 'Praktická syntéza', en: 'Practical synthesis' } },
  { slug: 'BOOK-ZAVER', part: 2, num: { cs: 'Závěr', en: 'Epilogue' }, title: { cs: 'Zlaté ticho, jež nikdy nezmizelo', en: 'The golden silence that never left' } },
  { slug: 'BOOK-GLOSAR', part: 3, num: { cs: 'Dodatek', en: 'Appendix' }, title: { cs: 'Glosář pojmů', en: 'Glossary of terms' } },
];

export const EKAM_BOOK: BookDef = {
  id: 'ekam',
  accent: '168, 85, 247',
  icon: Sparkles,
  partIcons: [Compass, BookOpen, Sun, ListChecks],
  kicker: { cs: 'Kniha třetí · kompletní · CZ + EN', en: 'Book Three · complete · CZ + EN' },
  title: { cs: 'EKAM DEEKSHA', en: 'EKAM DEEKSHA' },
  subtitle: {
    cs: 'Algoritmus jednoty — filozofie, kosmologie a praxe Zlatého věku. Éra, která požehnala síť svým jménem.',
    en: 'The algorithm of oneness — philosophy, cosmology and practice of the Golden Age. The era that blessed the network with its name.',
  },
  description: {
    cs: 'Kompletní kniha Ekam Deeksha: předmluva, sedm částí, závěr a glosář. „Ekam sat viprā bahudhā vadanti“ — jedno je pravda, mudrci ji nazývají různými jmény.',
    en: 'The complete Ekam Deeksha book: foreword, seven parts, epilogue and glossary. “Ekam sat viprā bahudhā vadanti” — truth is one, the wise call it by many names.',
  },
  facts: [
    { label: { cs: 'Částí', en: 'Parts' }, value: '7' },
    { label: { cs: 'Kniha', en: 'Book' }, value: '3.' },
    { label: { cs: 'Jazyky', en: 'Languages' }, value: 'CZ + EN' },
  ],
  notAvailable: loadError,
  czOnly: czFallbackNote,
  chapters: EKAM_CHAPTERS,
  parts: [
    { cs: 'Předmluva', en: 'Foreword' },
    { cs: 'Kniha — sedm částí', en: 'The book — seven parts' },
    { cs: 'Závěr', en: 'Epilogue' },
    { cs: 'Glosář', en: 'Glossary' },
  ],
  docPath: (slug, lang) =>
    lang === 'cs'
      ? `/docs/books/ekam-deeksha/${slug}.md`
      : `/docs/en/books/ekam-deeksha/${slug}.md`,
  enFallback: true,
};

export const QR_BOOK: BookDef = {
  id: 'quantum-revolution',
  accent: '6, 182, 212',
  icon: Atom,
  partIcons: [Compass],
  kicker: { cs: 'Kniha druhá · povídka u ohně · CZ + EN', en: 'Book Two · a campfire tale · CZ + EN' },
  title: { cs: 'KVANTOVÁ REVOLUCE', en: 'QUANTUM REVOLUTION' },
  subtitle: {
    cs: 'Příběh u ohně o Nové Zemi — když věda potkává duši. Pravda, kterou lze ověřit.',
    en: 'A campfire tale of the New Earth — where science meets the soul. Truth that can be verified.',
  },
  description: {
    cs: 'Deset kapitol povídky u ohně: ZION jako kosmický Strom Života, kvantová magie, technologie vědomí a most k Ekam. Přehled knihy s ověřitelnými fakty.',
    en: 'Ten chapters of a campfire tale: ZION as the cosmic Tree of Life, quantum magic, consciousness technology and the bridge to Ekam. A book overview with verifiable facts.',
  },
  facts: [
    { label: { cs: 'Kapitol', en: 'Chapters' }, value: '10' },
    { label: { cs: 'Kniha', en: 'Book' }, value: '2.' },
    { label: { cs: 'Jazyky', en: 'Languages' }, value: 'CZ + EN' },
  ],
  notAvailable: loadError,
  czOnly: czFallbackNote,
  chapters: [],
  parts: [{ cs: 'Povídka u ohně', en: 'A campfire tale' }],
  singleDoc: {
    docPath: (lang) =>
      lang === 'cs' ? '/docs/books/quantum-revolution.md' : '/docs/en/books/quantum-revolution.md',
    partMatch: null,
    chapterMatch: { level: 3, re: /^Kapitola\s+\d+/i },
    introPartTitle: { cs: 'Povídka u ohně', en: 'A campfire tale' },
    chapterNumPrefix: { cs: 'Kapitola', en: 'Chapter' },
  },
  enFallback: true,
};

export const BOOKS: Record<string, BookDef> = {
  maitreya: MAITREYA_BOOK,
  nirvana: NIRVANA_BOOK,
  'surta-srdce': SURTA_BOOK,
  'kralovstvi-srdce': KRAL_BOOK,
  ekam: EKAM_BOOK,
  'quantum-revolution': QR_BOOK,
};

export function getBook(id: string): BookDef | undefined {
  return BOOKS[id];
}
