// Maitreya hub library data — main reading spine + companion books.
// The mantra words are a literary navigation device for ordering the books,
// not a claimed traditional Buddhist correspondence.

export interface MainBook {
  id: string;
  position: number;
  mantra: string;
  title: { cs: string; en: string };
  role: { cs: string; en: string };
  readHref: string;
  aboutHref?: string;
  marker?: 'here' | 'goal';
  rc: string;
}

export const MAIN_BOOKS: MainBook[] = [
  {
    id: 'genesis',
    position: 1,
    mantra: 'gate',
    title: { cs: 'Genesis — Kniha Zrození', en: 'Genesis — the Book of Birth' },
    role: {
      cs: 'Proč existujeme: vejce, které se nerozbilo; podpis v prvním bloku.',
      en: 'Why we exist: the egg that did not break; the signature in the first block.',
    },
    readHref: '/genesis',
    aboutHref: '/genesis',
    rc: '252, 209, 22',
  },
  {
    id: 'qr',
    position: 2,
    mantra: 'gate',
    title: { cs: 'Quantum Revolution', en: 'Quantum Revolution' },
    role: {
      cs: 'Co je rozbité a co se mění: kvantový puls — pravda, kterou lze ověřit.',
      en: 'What is broken and transforming: the quantum pulse — truth that can be verified.',
    },
    readHref: '/maitreya/quantum-revolution/cist',
    aboutHref: '/quantum-revolution',
    rc: '6, 182, 212',
  },
  {
    id: 'ekam',
    position: 3,
    mantra: 'pāragate',
    title: { cs: 'Ekam Deeksha', en: 'Ekam Deeksha' },
    role: {
      cs: 'Kdo jsem a jaká je moje role: éra, která požehnala síť svým jménem — v každém bloku.',
      en: 'Who I am and what my role is: the era that blessed the network with its name — in every block.',
    },
    readHref: '/maitreya/ekam/cist',
    aboutHref: '/ekam',
    rc: '168, 85, 247',
  },
  {
    id: 'terranova',
    position: 4,
    mantra: 'pārasaṃgate',
    title: { cs: 'Terra Nova', en: 'Terra Nova' },
    role: {
      cs: 'Kam to směřuje: loď, mapa světových stran, první trupy cesty.',
      en: 'Where it leads: the ship, the map of directions, the first hulls of the path.',
    },
    readHref: '/terranova',
    rc: '52, 211, 153',
  },
  {
    id: 'maitreya',
    position: 5,
    mantra: 'bodhi',
    title: { cs: 'Maitreya — Kniha Pátá', en: 'Maitreya — Book Five' },
    role: {
      cs: 'Probuzení dědice: Pán Hiranyagarbhy — padají věže Babylonu.',
      en: 'The awakening of the heir: Lord of Hiranyagarbha — the towers of Babylon fall.',
    },
    readHref: '/maitreya/cist#prolog',
    marker: 'here',
    rc: '252, 209, 22',
  },
  {
    id: 'nirvana',
    position: 6,
    mantra: 'svāhā',
    title: { cs: 'Nirvana — Kniha Západu', en: 'Nirvana — the Book of the West' },
    role: {
      cs: '„Ať se stane" — příjezd: archa po potopě, Nová země. Kanon pro 3.3.',
      en: '“So be it” — the arrival: the ark after the flood, the New Earth. Canon for 3.3.',
    },
    readHref: '/maitreya/nirvana/cist#01-Prvni-Paprsek',
    marker: 'goal',
    rc: '251, 146, 60',
  },
];

export type CompanionStatus = 'canon' | 'draft' | 'framework';

export interface CompanionDoc {
  id: string;
  title: { cs: string; en: string };
  description: { cs: string; en: string };
  status: CompanionStatus;
  href: string;
  enHref?: string;
  czOnly?: boolean;
  kind?: 'book' | 'chapter' | 'framework';
  rc: string;
}

export interface CompanionGroup {
  id: string;
  title: { cs: string; en: string };
  blurb: { cs: string; en: string };
  items: CompanionDoc[];
}

const VIEW = '/docs/view/korpus';

export const COMPANION_GROUPS: CompanionGroup[] = [
  {
    id: 'srdce',
    title: { cs: 'Srdce kompasu — kniha pro děti', en: 'Heart of the compass — the children’s book' },
    blurb: {
      cs: 'Zpáteční kniha — otec píše synovi celou mapu najednou: od gate gate po om mani padme hūṃ. Soupis cesty příběhem.',
      en: 'The return book — a father writes the whole map to his son at once: from gate gate to om mani padme hūṃ. The path as one story.',
    },
    items: [
      {
        id: 'surta-srdce',
        title: { cs: 'Surta Srdce', en: 'Surta Srdce (Surta’s Heart)' },
        description: {
          cs: 'Sūtra srdce pro Surtu — Malý Buddha dosáhne probuzení na lotosu v Dharma Templu na La Palmě a vrátí se jako bodhisattva nové země. Kapitoly s kotvami pravdy + soupis korpusu.',
          en: 'A heart sūtra for Surta — the little Buddha awakens on a lotus in the Dharma Temple on La Palma and returns as the bodhisattva of the new earth. Truth anchors + corpus compendium. Czech original.',
        },
        status: 'draft',
        href: `/maitreya/surta-srdce/cist`,
        czOnly: true,
        rc: '251, 113, 133',
      },
      {
        id: 'kralovstvi-srdce',
        title: { cs: 'Království srdce', en: 'Kingdom of the Heart' },
        description: {
          cs: 'Příběh lodi, kterou postavil tesař z Nazareta — pro moře, které není na mapě. Opírá se o Bibli (tekton, arka, učení z lodi, království uvnitř vás) a uzavírá novým zjevením: flotila Tres Marías a mantra Maitreyi.',
          en: 'The story of the boat the carpenter of Nazareth built — for a sea on no map. Rooted in scripture (tekton, the ark, teaching from the boat, the kingdom within) and closed by the new revelation: the Tres Marías fleet and the Maitreya mantra. Czech original.',
        },
        status: 'draft',
        href: `/maitreya/kralovstvi-srdce/cist`,
        czOnly: true,
        rc: '245, 158, 11',
      },
    ],
  },
  {
    id: 'roots',
    title: { cs: 'Kořeny a příběh', en: 'Roots & story' },
    blurb: {
      cs: 'Kmenový kanon a dva původní příběhy, ze kterých cesta vyrůstá.',
      en: 'The root canon and the two original stories the path grows from.',
    },
    items: [
      {
        id: 'salt',
        title: { cs: 'Sůl této země', en: 'The Salt of this Earth' },
        description: {
          cs: 'Střed kompasu — zastavení přes proroky a archu. Kanonický kořen.',
          en: 'The compass center — stations through the prophets and the ark. The canonical root.',
        },
        status: 'canon',
        href: `${VIEW}/SulZeme/00-README.md`,
        enHref: `${VIEW}/SulZeme/00-README_EN.md`,
        rc: '52, 211, 153',
      },
      {
        id: 'lumi',
        title: { cs: 'Lumi', en: 'Lumi' },
        description: {
          cs: 'Svislá osa světla — dítě s lucernou, brána zůstává otevřená.',
          en: 'The vertical axis of light — the child with the lantern; the gate stays open. Czech original.',
        },
        status: 'draft',
        href: `${VIEW}/Lumi/00-README.md`,
        czOnly: true,
        rc: '252, 209, 22',
      },
      {
        id: 'miriam',
        title: { cs: 'Miriam', en: 'Miriam' },
        description: {
          cs: 'Osa času — Maria Magdaléna, metoda kámen / hlína / sen.',
          en: 'The axis of time — Mary Magdalene, the stone / clay / dream method. Czech original.',
        },
        status: 'draft',
        href: `${VIEW}/Miriam/00-README.md`,
        czOnly: true,
        rc: '236, 72, 153',
      },
    ],
  },
  {
    id: 'earth',
    title: { cs: 'Země a cesta', en: 'Earth & journey' },
    blurb: {
      cs: 'Zahrady, credencial a lodní deník — materiál, který most k L5 připravuje.',
      en: 'Gardens, the credencial and the ship log — the material that prepares the L5 bridge.',
    },
    items: [
      {
        id: 'bodhigaia',
        title: { cs: 'BodhiGaia', en: 'BodhiGaia' },
        description: {
          cs: 'Hlína pod nohama — zahrady Země, do nichž trupy dovážejí sůl. Kapitoly se dál rozrůstají.',
          en: 'The clay underfoot — the gardens of Earth the hulls carry salt to. Chapters keep expanding.',
        },
        status: 'draft',
        href: `${VIEW}/BodhiGaia/00-README.md`,
        enHref: `${VIEW}/BodhiGaia/00-README_EN.md`,
        rc: '52, 211, 153',
      },
      {
        id: 'mariacaminho',
        title: { cs: 'MariaCaminho', en: 'MariaCaminho' },
        description: {
          cs: 'Osa prostoru — tři zjevení, credencial, flotila Tres Marías.',
          en: 'The axis of space — three apparitions, the credencial, the Tres Marías fleet. Czech original.',
        },
        status: 'draft',
        href: `${VIEW}/MariaCaminho/00-README.md`,
        czOnly: true,
        rc: '6, 182, 212',
      },
      {
        id: 'naceste',
        title: { cs: 'Na Cestě', en: 'Na Cestě (On the Way)' },
        description: {
          cs: 'Lumen na flotile — pracovní deník cesty. Draft, zatím nepodložený review.',
          en: 'Lumen aboard the fleet — a working log of the path. Draft, not yet independently reviewed. Czech original.',
        },
        status: 'draft',
        href: `${VIEW}/NaCeste/00-README.md`,
        czOnly: true,
        rc: '148, 163, 184',
      },
      {
        id: 'ruze',
        title: { cs: 'Růže v Zahradě Genesis', en: 'Růže v Zahradě Genesis' },
        description: {
          cs: 'Jedna kapitola BodhiGaia — průsečík vztahů. Samostatná kniha Růže zatím publikovaná není.',
          en: 'A single BodhiGaia chapter — the intersection of relations. A standalone Růže book is not published yet. Czech only.',
        },
        status: 'draft',
        kind: 'chapter',
        href: `${VIEW}/BodhiGaia/12-Ruze-v-Zahrade-Genesis.md`,
        czOnly: true,
        rc: '236, 72, 153',
      },
    ],
  },
  {
    id: 'horizon',
    title: { cs: 'Horizont a pravidla', en: 'Horizon & rules' },
    blurb: {
      cs: 'Kosmologie za obzorem a prováděcí rámec, který drží 3.3 poctivé.',
      en: 'The cosmology beyond the horizon and the execution framework that keeps 3.3 honest.',
    },
    items: [
      {
        id: 'nirvanacloud',
        title: { cs: 'NirvanaCloud', en: 'NirvanaCloud' },
        description: {
          cs: 'Hloubka oblohy — kosmologie, bardo, Amenti za horizontem. Kanonický společník.',
          en: 'The depth of the sky — cosmology, bardo, Amenti beyond the horizon. Canonical companion.',
        },
        status: 'canon',
        href: `${VIEW}/NirvanaCloud/00-README.md`,
        enHref: `${VIEW}/NirvanaCloud/00-README_EN.md`,
        rc: '168, 85, 247',
      },
      {
        id: 'issobella',
        title: { cs: 'Issobella', en: 'Issobella' },
        description: {
          cs: 'Nebe nad námi — orbitální stanice L6, kvantový oheň. Příběh, ne příslib technologie.',
          en: 'The sky above — the L6 orbital station, the quantum fire. A story, not a technology promise.',
        },
        status: 'draft',
        href: `${VIEW}/Issobella/00-README.md`,
        enHref: `${VIEW}/Issobella/00-README_EN.md`,
        rc: '251, 146, 60',
      },
      {
        id: 'miseamenti',
        title: { cs: 'Mise Amenti', en: 'Mise Amenti' },
        description: {
          cs: 'Prováděcí rámec 3.3 — evidence, brány a review; ne román.',
          en: 'The 3.3 execution framework — evidence, gates and reviews; not a novel.',
        },
        status: 'framework',
        kind: 'framework',
        href: `${VIEW}/MiseAmenti/README.md`,
        enHref: `${VIEW}/MiseAmenti/README_EN.md`,
        rc: '148, 163, 184',
      },
    ],
  },
];
