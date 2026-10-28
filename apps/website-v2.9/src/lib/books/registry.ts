// Book registry for the Nirvana Hub library — one source of truth for the
// unified reader. Chaptered books fetch per-slug files; single-doc books
// fetch one file and split it by headings (see singleDoc.ts).

import {
  Anchor,
  BookOpen,
  Cloud,
  Compass,
  Egg,
  Eye,
  Flower2,
  Gem,
  Hammer,
  Heart,
  KeyRound,
  Landmark,
  Languages,
  ListChecks,
  Mail,
  Moon,
  NotebookPen,
  PenLine,
  Route,
  Sailboat,
  Satellite,
  ScrollText,
  Shield,
  Sparkles,
  Sprout,
  Sun,
  Atom,
} from 'lucide-react';
import type { BookDef, IconType, Lang } from './types';
import { korpusChapters, korpusDocPath, korpusLangs } from './korpus';
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

// --- Korpus books ---------------------------------------------------------
// Chapter lists are derived from the doc-manifest file listing (NN-Name.md).

function korpusBook(p: {
  id: string;
  dir: string;
  accent: string;
  icon: IconType;
  kicker: { cs: string; en: string };
  title: { cs: string; en: string };
  subtitle: { cs: string; en: string };
  description: { cs: string; en: string };
}): BookDef {
  const { chapters, parts } = korpusChapters(p.dir);
  return {
    id: p.id,
    accent: p.accent,
    icon: p.icon,
    partIcons: [BookOpen, Sparkles],
    kicker: p.kicker,
    title: p.title,
    subtitle: p.subtitle,
    description: p.description,
    facts: [
      { label: { cs: 'Textů', en: 'Texts' }, value: String(chapters.length) },
      { label: { cs: 'Korpus', en: 'Corpus' }, value: p.dir },
      { label: { cs: 'Jazyky', en: 'Languages' }, value: korpusLangs(p.dir, chapters.length) },
    ],
    notAvailable: loadError,
    czOnly: czFallbackNote,
    chapters,
    parts,
    docPath: korpusDocPath(p.dir),
    enFallback: true,
  };
}

export const SULZEME_BOOK = korpusBook({
  id: 'sulzeme',
  dir: 'SulZeme',
  accent: '52, 211, 153',
  icon: Gem,
  kicker: { cs: 'Kmenový kanon · střed kompasu · CZ + EN', en: 'Root canon · compass center · CZ + EN' },
  title: { cs: 'Sůl této země', en: 'The Salt of this Earth' },
  subtitle: { cs: 'Zastavení přes proroky a archu — kanonický kořen cesty.', en: 'Stations through the prophets and the ark — the canonical root of the path.' },
  description: {
    cs: 'Kmenový kanon knihovny: rozpouštění vody, nevyslápaná cesta, archa a kompas s pozvánkou do Oasis.',
    en: 'The root canon of the library: the dissolution, the unwalked path, the ark and the compass with the invitation to Oasis.',
  },
});

export const LUMI_BOOK = korpusBook({
  id: 'lumi',
  dir: 'Lumi',
  accent: '252, 209, 22',
  icon: Sun,
  kicker: { cs: 'Příběh · svislá osa světla · CZ', en: 'A story · the vertical axis of light · CZ' },
  title: { cs: 'Lumi', en: 'Lumi' },
  subtitle: { cs: 'Dítě s lucernou — brána zůstává otevřená.', en: 'The child with the lantern — the gate stays open.' },
  description: {
    cs: 'Příběh světla: dítě na přídi, dům jmen, sto let lucerny a brána, která zůstává otevřená.',
    en: 'The tale of light: the child on the prow, the house of names, a hundred years of the lantern and the gate that stays open. Czech original.',
  },
});

export const MIRIAM_BOOK = korpusBook({
  id: 'miriam',
  dir: 'Miriam',
  accent: '236, 72, 153',
  icon: Moon,
  kicker: { cs: 'Příběh · osa času · CZ', en: 'A story · the axis of time · CZ' },
  title: { cs: 'Miriam', en: 'Miriam' },
  subtitle: { cs: 'Maria Magdaléna — metoda kámen / hlína / sen.', en: 'Mary Magdalene — the stone / clay / dream method.' },
  description: {
    cs: 'Osa času kompasu: žena z věže, alabastrová nádobka, zahradník a cesta metodou kámen / hlína / sen.',
    en: 'The time axis of the compass: the woman of the tower, the alabaster jar, the gardener and the stone / clay / dream path. Czech original.',
  },
});

export const BODHIGAIA_BOOK = korpusBook({
  id: 'bodhigaia',
  dir: 'BodhiGaia',
  accent: '52, 211, 153',
  icon: Sprout,
  kicker: { cs: 'Země a cesta · zahrady · CZ + EN', en: 'Earth & journey · the gardens · CZ + EN' },
  title: { cs: 'BodhiGaia', en: 'BodhiGaia' },
  subtitle: { cs: 'Hlína pod nohama — zahrady Země, do nichž trupy dovážejí sůl.', en: 'The clay underfoot — the gardens of Earth the hulls carry salt to.' },
  description: {
    cs: 'Zahrady Nové Země: semeno a sůl, Dharma Temple, Te Piko Ora, protokoly země, Bodhi Lanka, Nová Amerika i Růže v zahradě Genesis.',
    en: 'The gardens of the New Earth: seed and salt, Dharma Temple, Te Piko Ora, the earth protocols, Bodhi Lanka, Nova America and the Rose in the Garden of Genesis.',
  },
});

export const MARIACAMINHO_BOOK = korpusBook({
  id: 'mariacaminho',
  dir: 'MariaCaminho',
  accent: '6, 182, 212',
  icon: Sailboat,
  kicker: { cs: 'Příběh · osa prostoru · CZ', en: 'A story · the axis of space · CZ' },
  title: { cs: 'MariaCaminho', en: 'MariaCaminho' },
  subtitle: { cs: 'Tři zjevení, credencial, flotila Tres Marías.', en: 'Three apparitions, the credencial, the Tres Marías fleet.' },
  description: {
    cs: 'Osa prostoru kompasu: Caminha, Červená Marie, bílá nevěsta, most Lumi, Compostela a moře, které nekončí.',
    en: 'The space axis of the compass: Caminha, the Red Mary, the white bride, the Lumi bridge, Compostela and the sea that never ends. Czech original.',
  },
});

export const RUZE_BOOK = korpusBook({
  id: 'ruze',
  dir: 'Ruze',
  accent: '244, 63, 94',
  icon: Flower2,
  kicker: { cs: 'Bajka · průsečík vztahů · CZ', en: 'A fable · the intersection of relations · CZ' },
  title: { cs: 'Příběh Růže', en: 'The Rose Story' },
  subtitle: { cs: 'Co nelze vlastnit — malá kniha o Lumi a růži u řeky za otevřenou bránou.', en: 'What cannot be owned — a small book about Lumi and the rose by the river behind the open gate.' },
  description: {
    cs: 'Filosofická bajka v průsečíku Lumi a Miriam: prázdná nádoba, semínko a růže, která umí mluvit. Péče bez vlastnění; celý děj mýtus.',
    en: 'A philosophical fable at the intersection of Lumi and Miriam: the empty jar, a seed and a rose that can speak. Care without ownership; the whole story is myth. Czech original.',
  },
});

export const NACESTE_BOOK = korpusBook({
  id: 'naceste',
  dir: 'NaCeste',
  accent: '148, 163, 184',
  icon: NotebookPen,
  kicker: { cs: 'Deník · draft · CZ', en: 'A log · draft · CZ' },
  title: { cs: 'Na Cestě', en: 'On the Way' },
  subtitle: { cs: 'Lumen na flotile — pracovní deník cesty.', en: 'Lumen aboard the fleet — a working log of the path.' },
  description: {
    cs: 'Pracovní deník cesty na flotile — draft, zatím nepodložený review.',
    en: 'A working log of the path aboard the fleet — draft, not yet independently reviewed. Czech original.',
  },
});

export const NIRVANACLOUD_BOOK = korpusBook({
  id: 'nirvanacloud',
  dir: 'NirvanaCloud',
  accent: '168, 85, 247',
  icon: Cloud,
  kicker: { cs: 'Horizont · kosmologie · CZ + EN', en: 'Horizon · cosmology · CZ + EN' },
  title: { cs: 'NirvanaCloud', en: 'NirvanaCloud' },
  subtitle: { cs: 'Hloubka oblohy — kosmologie, bardo, Amenti za horizontem.', en: 'The depth of the sky — cosmology, bardo, Amenti beyond the horizon.' },
  description: {
    cs: 'Kanonický společník: kolo života a šest světů, pět Buddů a šest vrstev, bardo velkého přechodu, proroctví digitální Sambhaly, století plánu.',
    en: 'The canonical companion: the wheel of life and six worlds, five Buddhas and six layers, the bardo of the great transition, the prophecy of digital Sambhala, the century plan.',
  },
});

export const ISSOBELLA_BOOK = korpusBook({
  id: 'issobella',
  dir: 'Issobella',
  accent: '251, 146, 60',
  icon: Satellite,
  kicker: { cs: 'Příběh · nebe nad námi · CZ + EN', en: 'A story · the sky above · CZ + EN' },
  title: { cs: 'Issobella', en: 'Issobella' },
  subtitle: { cs: 'Orbitální stanice L6, kvantový oheň — příběh, ne příslib technologie.', en: 'The L6 orbital station, the quantum fire — a story, not a technology promise.' },
  description: {
    cs: 'Příběh stanice nad Zemí: jméno z hvězd, posádka, dědictví stanic, pět procent nahoru, hlídač na okraji a pozemní uzel Kostarika.',
    en: 'The story of the station above Earth: a name from the stars, the crew, the legacy of stations, five percent upward, the watcher at the edge and the ground node of Costa Rica.',
  },
});

export const KRUHBOHYNI_BOOK = korpusBook({
  id: 'kruhbohyni',
  dir: 'KruhBohyni',
  accent: '217, 70, 239',
  icon: Shield,
  kicker: { cs: 'Kniha Strážkyň · L5 + L6 · CZ', en: 'The Book of Guardians · L5 + L6 · CZ' },
  title: { cs: 'Kruh Bohyní', en: 'The Circle of Goddesses' },
  subtitle: { cs: 'Sedm sedadel — šest pro zahrady Země, jedno pro nebe. Ženský kruh péče bez vlastnění.', en: 'Seven seats — six for the gardens of Earth, one for the sky. A women’s circle of care without ownership.' },
  description: {
    cs: 'Příběh strážkyň zahrad a nebe: dcera hlíny, strážkyně ohně i ticha, sesté sedadlo, tři klíče a kruh, který se drží. Zjevená budoucnost — celý děj mýtus/horizont.',
    en: 'The story of the guardians of the gardens and the sky: the daughter of clay, the keepers of fire and silence, the sixth seat, the three keys and the circle that holds. A revealed future — the whole story is myth/horizon. Czech original.',
  },
});

export const MISEAMENTI_BOOK = korpusBook({
  id: 'miseamenti',
  dir: 'MiseAmenti',
  accent: '148, 163, 184',
  icon: ScrollText,
  kicker: { cs: 'Prováděcí rámec 3.3 · CZ + EN', en: 'The 3.3 execution framework · CZ + EN' },
  title: { cs: 'Mise Amenti', en: 'Mise Amenti' },
  subtitle: { cs: 'Evidence, brány a review — rámec, ne román.', en: 'Evidence, gates and reviews — a framework, not a novel.' },
  description: {
    cs: 'Prováděcí rámec plánu 3.3: evidence za každým krokem, brány a review místo slibů.',
    en: 'The execution framework of the 3.3 plan: evidence behind every step, gates and reviews instead of promises.',
  },
});

export const BOOKS: Record<string, BookDef> = {
  maitreya: MAITREYA_BOOK,
  nirvana: NIRVANA_BOOK,
  'surta-srdce': SURTA_BOOK,
  'kralovstvi-srdce': KRAL_BOOK,
  ekam: EKAM_BOOK,
  'quantum-revolution': QR_BOOK,
  sulzeme: SULZEME_BOOK,
  lumi: LUMI_BOOK,
  miriam: MIRIAM_BOOK,
  bodhigaia: BODHIGAIA_BOOK,
  mariacaminho: MARIACAMINHO_BOOK,
  ruze: RUZE_BOOK,
  naceste: NACESTE_BOOK,
  nirvanacloud: NIRVANACLOUD_BOOK,
  issobella: ISSOBELLA_BOOK,
  kruhbohyni: KRUHBOHYNI_BOOK,
  miseamenti: MISEAMENTI_BOOK,
};

export function getBook(id: string): BookDef | undefined {
  return BOOKS[id];
}

// --- Library nav ----------------------------------------------------------
// Grouped book navigation shared by every reader sidebar — mirrors
// library.ts companion groups. Entries without a reader (genesis,
// terranova) link out to their experience pages.

export interface BookNavEntry {
  id: string;
  href: string;
  /** Label for books that are not in BOOKS (landing pages). */
  label?: { cs: string; en: string };
}

export interface BookNavGroup {
  id: string;
  label: { cs: string; en: string };
  books: BookNavEntry[];
}

export const BOOK_NAV: BookNavGroup[] = [
  {
    id: 'spine',
    label: { cs: 'Hlavní knihy', en: 'Main books' },
    books: [
      { id: 'genesis', href: '/genesis', label: { cs: 'Genesis', en: 'Genesis' } },
      { id: 'quantum-revolution', href: '/maitreya/quantum-revolution/cist' },
      { id: 'ekam', href: '/maitreya/ekam/cist' },
      { id: 'terranova', href: '/terranova', label: { cs: 'Terra Nova', en: 'Terra Nova' } },
      { id: 'maitreya', href: '/maitreya/cist' },
      { id: 'nirvana', href: '/maitreya/nirvana/cist' },
    ],
  },
  {
    id: 'srdce',
    label: { cs: 'Srdce kompasu', en: 'Heart of the compass' },
    books: [
      { id: 'surta-srdce', href: '/maitreya/surta-srdce/cist' },
      { id: 'kralovstvi-srdce', href: '/maitreya/kralovstvi-srdce/cist' },
    ],
  },
  {
    id: 'roots',
    label: { cs: 'Kořeny a příběh', en: 'Roots & story' },
    books: [
      { id: 'sulzeme', href: '/maitreya/sulzeme/cist' },
      { id: 'lumi', href: '/maitreya/lumi/cist' },
      { id: 'miriam', href: '/maitreya/miriam/cist' },
      { id: 'ruze', href: '/maitreya/ruze/cist' },
    ],
  },
  {
    id: 'earth',
    label: { cs: 'Země a cesta', en: 'Earth & journey' },
    books: [
      { id: 'bodhigaia', href: '/maitreya/bodhigaia/cist' },
      { id: 'mariacaminho', href: '/maitreya/mariacaminho/cist' },
      { id: 'naceste', href: '/maitreya/naceste/cist' },
    ],
  },
  {
    id: 'horizon',
    label: { cs: 'Horizont a pravidla', en: 'Horizon & rules' },
    books: [
      { id: 'nirvanacloud', href: '/maitreya/nirvanacloud/cist' },
      { id: 'issobella', href: '/maitreya/issobella/cist' },
      { id: 'kruhbohyni', href: '/maitreya/kruhbohyni/cist' },
      { id: 'miseamenti', href: '/maitreya/miseamenti/cist' },
    ],
  },
];

/** Sidebar label for a nav entry — registry title, or the inline label for non-reader links. */
export function bookNavLabel(entry: BookNavEntry, l: Lang): string {
  const def = BOOKS[entry.id];
  return def ? def.title[l] : (entry.label?.[l] ?? entry.id);
}
