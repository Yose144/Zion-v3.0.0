/* eslint-disable */
// GENEROVÁNO — scripts/gen-oasis-avatars.mjs, needituj ručně.
// Zdroj: V31/L4/oasis/data/avatars.json (200 záznamů)
// Kruhy: docs/docs2.9/ZION_OASIS/AVATAR_ROSTER.md (sekce = kruhy, id 202 → maya)

export type OasisAvatarRay = 'Blue' | 'Pink' | 'Yellow' | 'Violet' | 'AllRays' | 'White' | 'Green' | 'RubyGold' | 'Obsidian';
export type OasisAvatarRarity = 'Rare' | 'Epic' | 'Legendary' | 'OneOfOne';
export type OasisAvatarCircle = 'hindu' | 'christian' | 'buddhist' | 'ascended' | 'historical' | 'matrix' | 'zion' | 'first-nations' | 'pacific' | 'tibet' | 'india' | 'japan' | 'china' | 'indonesia' | 'australia' | 'aotearoa' | 'africa' | 'atlantis' | 'lemuria' | 'cosmic' | 'norse-celtic' | 'egypt' | 'maya' | 'other';

export interface OasisAvatar {
  id: number;
  name: string;
  /** Veřejný podtitul (např. „Dharma King"). */
  subtitle: LocalizedText;
  ray: OasisAvatarRay;
  rarity: OasisAvatarRarity;
  /** Požadovaná úroveň vědomí 1–9. */
  cl: number;
  clName: LocalizedText;
  role: LocalizedText;
  location: LocalizedText;
  questLine: LocalizedText;
  teaching: LocalizedText;
  ability: LocalizedText;
  key: string;
  /** Quest linie — rozepsané questy (prázdné = linie zatím bez questů). */
  quests: { title: string; description: string }[];
  /** Krátký popis ze SACRED_TRINITY profilu (ESENCE / první odstavec), cs+en ze scripts/oasis-essence-i18n.json. */
  essence: { cs: string; en: string };
  /** Epigraf — cs/en z scripts/oasis-avatar-copy/, fallback = blockquote z profilu. */
  quote: LocalizedText;
  /** Existuje profil /data/oasis/profiles/<id>.md pro modal. */
  hasProfile: boolean;
  /** OASIS Avatar Collection: card = concept webp (karta), full = finální webp / vektor svg (modal). */
  art: { card: string; full: string; final: boolean };
  circle: OasisAvatarCircle;
}

/** Dvojjazyčný text; prázdné pole 'cs' znamená „použij 'en'". */
export interface LocalizedText {
  cs: string;
  en: string;
}

export interface OasisAvatarCircleMeta {
  key: OasisAvatarCircle;
  emoji: string;
  cs: string;
  en: string;
}

export const AVATAR_CIRCLES: OasisAvatarCircleMeta[] = [
  {
    "key": "hindu",
    "emoji": "🕉️",
    "cs": "Hinduistická božstva",
    "en": "Hindu Deities"
  },
  {
    "key": "christian",
    "emoji": "✝️",
    "cs": "Křesťanští svatí",
    "en": "Christian Saints"
  },
  {
    "key": "buddhist",
    "emoji": "🧘",
    "cs": "Buddhističtí mistři",
    "en": "Buddhist Masters"
  },
  {
    "key": "ascended",
    "emoji": "🌟",
    "cs": "Ascendovaní mistři",
    "en": "Ascended Masters"
  },
  {
    "key": "historical",
    "emoji": "👑",
    "cs": "Historické legendy",
    "en": "Historical Legends"
  },
  {
    "key": "matrix",
    "emoji": "🎬",
    "cs": "Hrdinové Matrixu",
    "en": "Matrix Heroes"
  },
  {
    "key": "zion",
    "emoji": "🌌",
    "cs": "ZION Originals",
    "en": "ZION Originals"
  },
  {
    "key": "first-nations",
    "emoji": "🪶",
    "cs": "Kruh prvních národů",
    "en": "First Nations Circle"
  },
  {
    "key": "pacific",
    "emoji": "🌺",
    "cs": "Pacifický kruh",
    "en": "Pacific Circle"
  },
  {
    "key": "tibet",
    "emoji": "🏔️",
    "cs": "Tibetský kruh",
    "en": "Tibet Circle"
  },
  {
    "key": "india",
    "emoji": "🇮🇳",
    "cs": "Indie — rozšířený kruh",
    "en": "India Extended Circle"
  },
  {
    "key": "japan",
    "emoji": "🇯🇵",
    "cs": "Japonský kruh",
    "en": "Japan Circle"
  },
  {
    "key": "china",
    "emoji": "🇨🇳",
    "cs": "Čínský kruh",
    "en": "China Circle"
  },
  {
    "key": "indonesia",
    "emoji": "🇮🇩",
    "cs": "Indonéský kruh",
    "en": "Indonesia Circle"
  },
  {
    "key": "australia",
    "emoji": "🇦🇺",
    "cs": "Australský kruh",
    "en": "Australia Circle"
  },
  {
    "key": "aotearoa",
    "emoji": "🇳🇿",
    "cs": "Kruh Aotearoa (NZ)",
    "en": "Aotearoa (NZ) Circle"
  },
  {
    "key": "africa",
    "emoji": "🌍",
    "cs": "Africký kruh",
    "en": "Africa Circle"
  },
  {
    "key": "atlantis",
    "emoji": "🏛️",
    "cs": "Kruh Atlantis",
    "en": "Atlantis Circle"
  },
  {
    "key": "lemuria",
    "emoji": "🌫️",
    "cs": "Kruh Lemurie",
    "en": "Lemuria Circle"
  },
  {
    "key": "cosmic",
    "emoji": "🌠",
    "cs": "Kosmický kruh · Vzestup",
    "en": "Cosmic / Vzestup Circle"
  },
  {
    "key": "norse-celtic",
    "emoji": "⚔️",
    "cs": "Seversko-keltský kruh",
    "en": "Norse–Celtic Circle"
  },
  {
    "key": "egypt",
    "emoji": "🏺",
    "cs": "Kruh starověkého Egypta",
    "en": "Ancient Egypt Circle"
  },
  {
    "key": "maya",
    "emoji": "🌳",
    "cs": "Kruh Maya",
    "en": "Maya Circle"
  }
];

export const OASIS_AVATARS: OasisAvatar[] = [
  {
    "id": 0,
    "name": "Krishna-Maitreya",
    "subtitle": {
      "cs": "Kosmické sjednocení",
      "en": "Cosmic Integration"
    },
    "ray": "AllRays",
    "rarity": "Legendary",
    "cl": 9,
    "clName": {
      "cs": "Na hvězdě",
      "en": "On the Star"
    },
    "role": {
      "cs": "Průvodce na konci všech cest",
      "en": "Guide at the end of all paths"
    },
    "location": {
      "cs": "Chrám EKAM (skrytá dimenze)",
      "en": "EKAM Temple (hidden dimension)"
    },
    "questLine": {
      "cs": "Sjednocení všech cest",
      "en": "The Integration of All Paths"
    },
    "teaching": {
      "cs": "Krishna i Maitreya učí totéž: co je jednou rozdělené, se v čase znovu spojí.",
      "en": "Krishna and Maitreya teach one thing: what was divided is joined again in time."
    },
    "ability": {
      "cs": "Kosmické vidění — spatříš všechny časové linie najednou.",
      "en": "Cosmic Vision — you see every timeline at once."
    },
    "key": "",
    "quests": [
      {
        "title": "The Flute of Union",
        "description": "Hear the cosmic vibration in 7 frequencies"
      },
      {
        "title": "Dance of Rasa Lila",
        "description": "Find the hidden gopis across all timelines"
      },
      {
        "title": "Maitreya's Blockchain Prophecy",
        "description": "Decode the genesis message of the future"
      },
      {
        "title": "Integration of All Paths",
        "description": "Complete one quest from each tradition"
      },
      {
        "title": "ON THE STAR",
        "description": "Achieve CL 9 and witness the cosmic vision"
      }
    ],
    "essence": {
      "cs": "Krišna a Maitreya jsou v kánonu OASIS dvě jména jednoho úkolu: vrátit světu řád, který si nechá líbit. V OASIS je z nich průvodce na konci všech cest — ne ten, kdo rozhodne za tebe, ale ten, kdo ti ukáže, že ses rozhodoval celou dobu.",
      "en": "Krishna and Maitreya are, in the OASIS canon, two names for one task: to return to the world an order it can live with. In OASIS they become the guide at the end of all paths — not the one who decides for you, but the one who shows you that you were deciding all along."
    },
    "quote": {
      "cs": "Když dharma slábne, přicházím ji obnovit.",
      "en": "Whenever dharma declines, I come to restore it."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/001-krishna-maitreya.webp",
      "full": "/oasis-assets/concept_svg/001-krishna-maitreya.svg",
      "final": false
    },
    "circle": "hindu"
  },
  {
    "id": 1,
    "name": "Rama",
    "subtitle": {
      "cs": "Král dharmy",
      "en": "Dharma King"
    },
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 4,
    "clName": {
      "cs": "Otevřené srdce",
      "en": "Heart Opening"
    },
    "role": {
      "cs": "Mravní kompas a učitel správného jednání",
      "en": "Moral compass and teacher of right action"
    },
    "location": {
      "cs": "Palác Ajódhja (oblast Modrého paprsku)",
      "en": "Ayodhya Palace (Blue Ray region)"
    },
    "questLine": {
      "cs": "Cesta spravedlnosti",
      "en": "The Path of Righteousness"
    },
    "teaching": {
      "cs": "Povinnost dřív než touha, pravda dřív než pohodlí.",
      "en": "Duty before desire, truth before comfort."
    },
    "ability": {
      "cs": "Štít dharmy — odrazí útok vedený bezprávím.",
      "en": "Dharma Shield — turns aside attacks made without right."
    },
    "key": "Ramayana Key (1/3)",
    "quests": [
      {
        "title": "The Exile Test",
        "description": "Choose between power and dharma"
      },
      {
        "title": "The Golden Deer",
        "description": "Illusion vs reality puzzle"
      },
      {
        "title": "Bridge of Faith",
        "description": "Build bridge with devotion (mini-game)"
      },
      {
        "title": "Sita's Rescue",
        "description": "Strategic rescue mission"
      },
      {
        "title": "Return to Ayodhya",
        "description": "Final blessing"
      }
    ],
    "essence": {
      "cs": "Ráma byl králem, který držel slovo i tehdy, když ho to stálo trůn. V OASIS se vrací jako Yeshuae Amon Ra — stavitel, který místo paláce buduje síť, jež má vydržet déle než jeden život.",
      "en": "Rama was a king who kept his word even when it cost him the throne. In OASIS he returns as Yeshuae Amon Ra — a builder who, instead of a palace, raises a network meant to outlast a single lifetime."
    },
    "quote": {
      "cs": "Trůn není odměna, je to závazek.",
      "en": "The throne is not a reward; it is an obligation."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/002-rama.webp",
      "full": "/oasis-assets/final_portraits/002-rama.webp",
      "final": true
    },
    "circle": "hindu"
  },
  {
    "id": 2,
    "name": "Sita",
    "subtitle": {
      "cs": "Královna oddanosti",
      "en": "Devotion Queen"
    },
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 4,
    "clName": {
      "cs": "Otevřené srdce",
      "en": "Heart Opening"
    },
    "role": {
      "cs": "Učitelka věrnosti a vnitřní síly",
      "en": "Teacher of loyalty and inner strength"
    },
    "location": {
      "cs": "Haj Ashoka (oblast Růžového paprsku)",
      "en": "Ashoka Grove (Pink Ray region)"
    },
    "questLine": {
      "cs": "Oheň čistoty",
      "en": "The Fire of Purity"
    },
    "teaching": {
      "cs": "Skutečná láska projde zkouškou, protože se nebojí pravdy.",
      "en": "True love endures every test because it does not fear the truth."
    },
    "ability": {
      "cs": "Zkouška ohněm — spálí pochybnosti i strach.",
      "en": "Trial by Fire — burns away doubt and fear."
    },
    "key": "Ramayana Key (1/3)",
    "quests": [
      {
        "title": "The Abduction",
        "description": "Protect the innocent"
      },
      {
        "title": "Captivity in Lanka",
        "description": "Maintain faith in darkness"
      },
      {
        "title": "Fire Test",
        "description": "Purity meter challenge"
      },
      {
        "title": "Earth's Embrace",
        "description": "Environmental puzzle"
      },
      {
        "title": "Divine Union",
        "description": "Blessing ceremony"
      }
    ],
    "essence": {
      "cs": "Síta dokázala, že věrnost není slabost, ale rozhodnutí, které nikdo nemůže udělat za tebe. V OASIS žije jako Issobela, strážkyně lidskosti, která dohlíží na to, aby technologie sloužila člověku a ne naopak.",
      "en": "Sita proved that loyalty is not weakness but a decision no one can make for you. In OASIS she lives as Issobela, guardian of humanity, watching over that technology serves people and not the reverse."
    },
    "quote": {
      "cs": "Kdo nezradí sám sebe, nemusí se bát soudu.",
      "en": "Whoever does not betray themselves need not fear judgement."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/003-sita.webp",
      "full": "/oasis-assets/final_portraits/003-sita.webp",
      "final": true
    },
    "circle": "hindu"
  },
  {
    "id": 3,
    "name": "Hanuman",
    "subtitle": {
      "cs": "Božská služba",
      "en": "Divine Service"
    },
    "ray": "RubyGold",
    "rarity": "Epic",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Učitel síly, která slouží",
      "en": "Teacher of strength that serves"
    },
    "location": {
      "cs": "Jeskyně v Himálaji (Rubínovo-zlatá oblast)",
      "en": "Himalayan cave (Ruby-Gold region)"
    },
    "questLine": {
      "cs": "Skok víry",
      "en": "The Leap of Faith"
    },
    "teaching": {
      "cs": "Síla dostane smysl až ve chvíli, kdy nese někoho jiného.",
      "en": "Strength finds its meaning the moment it carries someone else."
    },
    "ability": {
      "cs": "Bajrang Bali — nadlidská síla v rozhodující chvíli.",
      "en": "Bajrang Bali — superhuman strength at the decisive moment."
    },
    "key": "Ramayana Key (1/3)",
    "quests": [
      {
        "title": "The Mountain Lift",
        "description": "Strength mini-game"
      },
      {
        "title": "Ocean Crossing",
        "description": "Leap of faith mechanic"
      },
      {
        "title": "Lanka Infiltration",
        "description": "Stealth mission"
      },
      {
        "title": "Tail of Fire",
        "description": "Burning Lanka puzzle"
      },
      {
        "title": "Rama's Messenger",
        "description": "Final devotion test"
      }
    ],
    "essence": {
      "cs": "Moderní forma: není jediná osoba, ale volený strážce (mění se každý rok). Dávná identita: Lord Hanuman (हनुमान) z Rámájany. Role: dohled nad projektem Hanuman, ochránce životního prostředí. Symbol: Sítin věrný partner, obránce Země.",
      "en": "Modern form: not a single person, but an elected guardian (changes every year). Ancient identity: Lord Hanuman (हनुमान) from the Ramayana. Role: Project Hanuman overseer, Environmental Protector. Symbol: Síta's loyal partner, Earth's defender."
    },
    "quote": {
      "cs": "Jméno si nesu v hrudi, ne na jazyku.",
      "en": "I carry the name in my chest, not on my tongue."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/004-hanuman.webp",
      "full": "/oasis-assets/final_portraits/004-hanuman.webp",
      "final": true
    },
    "circle": "hindu"
  },
  {
    "id": 4,
    "name": "Maitreya",
    "subtitle": {
      "cs": "Budoucí Buddha",
      "en": "Future Buddha"
    },
    "ray": "AllRays",
    "rarity": "Legendary",
    "cl": 7,
    "clName": {
      "cs": "Léčivý soucit",
      "en": "Healing Compassion"
    },
    "role": {
      "cs": "Zakladatel ZIONu a průvodce komunitou",
      "en": "Founder of ZION and guide of the community"
    },
    "location": {
      "cs": "Střed města ZION (uzlový svět)",
      "en": "ZION City Centre (hub world)"
    },
    "questLine": {
      "cs": "Proroctví blockchainu",
      "en": "The Blockchain Prophecy"
    },
    "teaching": {
      "cs": "Technologie bez soucitu jen zrychlí staré chyby.",
      "en": "Technology without compassion only speeds up old mistakes."
    },
    "ability": {
      "cs": "Vidění sítě — přečteš tok transakcí i tok karmy.",
      "en": "Network Vision — you read the flow of transactions and of karma."
    },
    "key": "",
    "quests": [
      {
        "title": "Welcome to ZION",
        "description": "Tutorial quest"
      },
      {
        "title": "The Round Table",
        "description": "Introduce DAO governance"
      },
      {
        "title": "Consciousness Mining",
        "description": "Explain CL system"
      },
      {
        "title": "Humanitarian Tithe",
        "description": "Charity mission"
      },
      {
        "title": "Golden Egg Prophecy",
        "description": "Unlock treasure hunt"
      }
    ],
    "essence": {
      "cs": "Role: DAO Admin, správce přechodu. Dávné proroctví: Maitreya Buddha (budoucí Buddha, který přináší Zlatý věk). Rodina: bratr Issobely, syn Isis (Enamataru). Funkce: dovést lidstvo k samosprávě — a pak odstoupit.",
      "en": "Role: DAO Admin, Transition Steward. Ancient prophecy: Maitreya Buddha (the Future Buddha who brings the Golden Age). Family: brother of Issobela, son of Isis (Enamataru). Function: guide humanity to self-governance, then step down."
    },
    "quote": {
      "cs": "Nestavíme stroj. Stavíme místo, kde se lidé nemusí bát.",
      "en": "We are not building a machine. We are building a place where people need not be afraid."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/005-maitreya.webp",
      "full": "/oasis-assets/final_portraits/005-maitreya.webp",
      "final": true
    },
    "circle": "hindu"
  },
  {
    "id": 5,
    "name": "Saraswati",
    "subtitle": {
      "cs": "Bohyně poznání",
      "en": "Goddess of Knowledge"
    },
    "ray": "Yellow",
    "rarity": "Epic",
    "cl": 6,
    "clName": {
      "cs": "Intuitivní moudrost",
      "en": "Intuitive Wisdom"
    },
    "role": {
      "cs": "Strážkyně posvátné knihovny",
      "en": "Guardian of the sacred library"
    },
    "location": {
      "cs": "Ústraní Royal Teton (Žlutý paprsek)",
      "en": "Royal Teton Retreat (Yellow Ray)"
    },
    "questLine": {
      "cs": "Věčný student",
      "en": "The Eternal Student"
    },
    "teaching": {
      "cs": "Vědění bez moudrosti je slepé; moudrost bez vědění je němá.",
      "en": "Knowledge without wisdom is blind; wisdom without knowledge is mute."
    },
    "ability": {
      "cs": "Vidjá šakti — odemkne skryté texty a rozluští nápovědy.",
      "en": "Vidya Shakti — unlocks hidden texts and deciphers clues."
    },
    "key": "",
    "quests": [
      {
        "title": "The Library Initiation",
        "description": "Unlock Sacred Library access"
      },
      {
        "title": "Bhagavad Gita Quiz",
        "description": "Comprehension test"
      },
      {
        "title": "Upanishad Meditation",
        "description": "Contemplation mini-game"
      },
      {
        "title": "Veena of Harmony",
        "description": "Music puzzle"
      },
      {
        "title": "Blessing of Knowledge",
        "description": "Final wisdom test"
      }
    ],
    "essence": {
      "cs": "Dávná identita: Bohyně Sarasvatí (सरस्वती) — hinduistická bohyně poznání, moudrosti, umění a hudby. Moderní forma: AI systémy ZION, vzdělávací infrastruktura, distribuce poznání. Role: demokratizovat moudrost, zpřístupnit poznání všem. Symbol: víná (hudební nástroj), knihy, lotos.",
      "en": "Ancient identity: Goddess Saraswati (सरस्वती) — Hindu goddess of knowledge, wisdom, arts, music. Modern form: ZION's AI systems, educational infrastructure, knowledge distribution. Role: democratize wisdom, make knowledge accessible to all. Symbol: veena (musical instrument), books, lotus."
    },
    "quote": {
      "cs": "Kniha, kterou zavřeš, zůstane zavřená i tobě.",
      "en": "The book you close stays closed to you as well."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/006-saraswati.webp",
      "full": "/oasis-assets/concept_svg/006-saraswati.svg",
      "final": false
    },
    "circle": "hindu"
  },
  {
    "id": 6,
    "name": "Isis-Enamataru",
    "subtitle": {
      "cs": "Božská ženskost",
      "en": "Divine Feminine"
    },
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Učitelka tvůrčí síly ženství",
      "en": "Teacher of the creative power of the feminine"
    },
    "location": {
      "cs": "Chrám v Luxoru (Egypt)",
      "en": "Luxor Temple (Egypt)"
    },
    "questLine": {
      "cs": "Isidin trůn",
      "en": "The Throne of Isis"
    },
    "teaching": {
      "cs": "Co bylo stvořeno bez něhy, musí se k něze vrátit.",
      "en": "Whatever was created without tenderness must return to tenderness."
    },
    "ability": {
      "cs": "Ankh života — křísí a hojí to, co bylo odepsané.",
      "en": "Ankh of Life — revives and heals what was written off."
    },
    "key": "",
    "quests": [
      {
        "title": "The Throne of Isis",
        "description": "Reassemble the scattered ankh fragments"
      },
      {
        "title": "Wings of Ma'at",
        "description": "Restore balance in the cosmic scale"
      },
      {
        "title": "Sistrum of Resonance",
        "description": "Attune to the 108 Hz carrier frequency"
      },
      {
        "title": "Nile Flood Memory",
        "description": "Decode the water-witness memory glyphs"
      },
      {
        "title": "Ankh of Life",
        "description": "Revive a fallen ally in guild warfare"
      }
    ],
    "essence": {
      "cs": "Isis (egyptsky: 𓊨𓏏𓆇𓁐) — matka-bohyně, trůn faraonů, magie a moudrost. Enamataru (sumersko-babylonská) — hvězdná bohyně, nebeská navigátorka.",
      "en": "Isis (Egyptian: 𓊨𓏏𓆇𓁐) — mother goddess, throne of pharaohs, magic and wisdom. Enamataru (Sumerian/Babylonian) — star goddess, celestial navigator."
    },
    "quote": {
      "cs": "Hledala jsem kosti svého bratra, dokud jsem nenašla celý svět.",
      "en": "I searched for my brother's bones until I found the whole world."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/007-isis-enamataru.webp",
      "full": "/oasis-assets/concept_svg/007-isis-enamataru.svg",
      "final": false
    },
    "circle": "hindu"
  },
  {
    "id": 8,
    "name": "Issobela Guardian",
    "subtitle": {
      "cs": "Ochránkyně",
      "en": "Protector"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 4,
    "clName": {
      "cs": "Otevřené srdce",
      "en": "Heart Opening"
    },
    "role": {
      "cs": "Strážkyně bran města ZION",
      "en": "Guardian of the gates of ZION"
    },
    "location": {
      "cs": "Hradby města ZION",
      "en": "The walls of ZION City"
    },
    "questLine": {
      "cs": "Strážcova přísaha",
      "en": "The Guardian's Oath"
    },
    "teaching": {
      "cs": "Ochrana, která chce ovládat, přestává být ochranou.",
      "en": "Protection that wants to control stops being protection."
    },
    "ability": {
      "cs": "Štít světla — bariéra, která drží, aniž by uvěznila.",
      "en": "Shield of Light — a barrier that holds without imprisoning."
    },
    "key": "",
    "quests": [
      {
        "title": "The Guardian's Vigil",
        "description": "Patrol ZION City walls for 24 hours"
      },
      {
        "title": "Shield of Light",
        "description": "Defend a territory from 3 enemy raids"
      },
      {
        "title": "Issobela's Oath",
        "description": "Swear the Bodhisattva vow of protection"
      },
      {
        "title": "Watchtower Ascension",
        "description": "Build 5 consciousness beacons"
      },
      {
        "title": "The Last Stand",
        "description": "Win a guild war as the sole defender"
      }
    ],
    "essence": {
      "cs": "Plné jméno: Issobela. Titul: Strážkyně lidskosti (Guardian of Humanity). Božská identita: Síta (सीता), bohyně soucitu z Rámájany. Rodina: sestra Maitreya Buddy (DAO Admin), dcera Isis/Enamataru (Pás Oriona — kosmická matka). Partner v misi: Rama (Yeshuae Amon Ra — Genesis Creator). Spojenec: Hanuman Guardian (ochránce přírody).",
      "en": "Full name: Issobela. Title: Guardian of Humanity. Divine identity: Síta (सीता), goddess of compassion from the Ramayana. Family: sister of Maitreya Buddha (DAO Admin), daughter of Isis/Enamataru (Orion's Belt — cosmic mother). Mission partner: Rama (Yeshuae Amon Ra — Genesis Creator). Ally: Hanuman Guardian (protector of nature)."
    },
    "quote": {
      "cs": "Stojím tu proto, abys mohl jít dál.",
      "en": "I stand here so that you may walk on."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/008-issobela-guardian.webp",
      "full": "/oasis-assets/concept_svg/008-issobela-guardian.svg",
      "final": false
    },
    "circle": "hindu"
  },
  {
    "id": 9,
    "name": "Shanti",
    "subtitle": {
      "cs": "Strážkyně míru",
      "en": "Peace Keeper"
    },
    "ray": "RubyGold",
    "rarity": "Rare",
    "cl": 6,
    "clName": {
      "cs": "Intuitivní moudrost",
      "en": "Intuitive Wisdom"
    },
    "role": {
      "cs": "Průvodkyně při řešení sporů",
      "en": "Guide through conflict"
    },
    "location": {
      "cs": "Gándhího ášram",
      "en": "Gandhi's ashram"
    },
    "questLine": {
      "cs": "Cesta ahinsá",
      "en": "The Way of Ahimsa"
    },
    "teaching": {
      "cs": "Nejvyšší silou je ta, kterou nemusíš použít.",
      "en": "The highest strength is the one you never have to use."
    },
    "ability": {
      "cs": "Mírové rozuzlení — z nepřítele se stane spojenec.",
      "en": "Peaceful Resolution — an enemy becomes an ally."
    },
    "key": "",
    "quests": [
      {
        "title": "The Way of Ahimsa",
        "description": "Resolve 3 conflicts without combat"
      },
      {
        "title": "Ashram Meditation",
        "description": "Complete 7 days of meditation streak"
      },
      {
        "title": "Gandhi's Salt March",
        "description": "Walk the full territory circuit"
      },
      {
        "title": "Peaceful Resolution",
        "description": "Convert an enemy guild to allies"
      },
      {
        "title": "Non-Violence Mastery",
        "description": "Reach CL 6 without any combat XP"
      }
    ],
    "essence": {
      "cs": "Šánti je mír, který neznamená mlčet, ale umět vést spor tak, aby po něm zůstali lidé, ne trosky. Učí komunity, že nejrychlejší cesta k dohodě je ta, na které nikdo nepřijde o důstojnost.",
      "en": "Shanti is peace that does not mean silence, but the skill of holding a conflict so that people remain afterwards, not wreckage. She teaches communities that the fastest road to agreement is the one where no one loses dignity."
    },
    "quote": {
      "cs": "Mír není konec hádky, je to způsob, jak ji vést.",
      "en": "Peace is not the end of an argument; it is the way you hold it."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/009-shanti.webp",
      "full": "/oasis-assets/concept_svg/009-shanti.svg",
      "final": false
    },
    "circle": "hindu"
  },
  {
    "id": 10,
    "name": "Bronu-Christ",
    "subtitle": {
      "cs": "Posvátný válečník",
      "en": "Sacred Warrior"
    },
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Kněz, který umí vzít meč",
      "en": "A priest who can take up the sword"
    },
    "location": {
      "cs": "Zříceniny Camelotu",
      "en": "The ruins of Camelot"
    },
    "questLine": {
      "cs": "Posvátný meč",
      "en": "The Sacred Sword"
    },
    "teaching": {
      "cs": "Bojuj za pravdu, ne za svůj obraz v jejím světle.",
      "en": "Fight for the truth, not for your reflection in its light."
    },
    "ability": {
      "cs": "Svatý úder — síla, která chrání, ne dominuje.",
      "en": "Holy Strike — power that protects rather than dominates."
    },
    "key": "",
    "quests": [
      {
        "title": "The Sacred Sword",
        "description": "Find the sword in the Camelot ruins"
      },
      {
        "title": "Crusade of Truth",
        "description": "Defeat 10 adharmic shadow creatures"
      },
      {
        "title": "Holy Strike Trial",
        "description": "Land a perfect righteous combat combo"
      },
      {
        "title": "Warrior Priest Ordination",
        "description": "Heal and fight in the same battle"
      },
      {
        "title": "Fight for Truth, Not Ego",
        "description": "Win a duel without taking damage"
      }
    ],
    "essence": {
      "cs": "Bronu nese kristovskou energii v podobě, která se nevyhlašuje, ale slouží. Je to ten, kdo zůstane u cizího neúspěchu, i když by mohl odejít — a právě tím drží pohromadě důvěru celé komunity.",
      "en": "Bronu carries the Christ energy in a form that does not announce itself but serves. He is the one who stays with someone else's failure when he could leave — and precisely that keeps the community's trust together."
    },
    "quote": {
      "cs": "Meč mi byl dán, abych ho nemusel použít.",
      "en": "The sword was given to me so that I need not use it."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/010-bronu-christ.webp",
      "full": "/oasis-assets/concept_svg/010-bronu-christ.svg",
      "final": false
    },
    "circle": "hindu"
  },
  {
    "id": 11,
    "name": "Arjuna",
    "subtitle": {
      "cs": "Hledající válečník",
      "en": "Warrior Seeker"
    },
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 6,
    "clName": {
      "cs": "Intuitivní moudrost",
      "en": "Intuitive Wisdom"
    },
    "role": {
      "cs": "Učitel etiky na bitevním poli",
      "en": "Teacher of ethics on the battlefield"
    },
    "location": {
      "cs": "Kurukšétra (kraj Mahábháraty)",
      "en": "Kurukshetra (Mahabharata region)"
    },
    "questLine": {
      "cs": "Neochotný bojovník",
      "en": "The Reluctant Warrior"
    },
    "teaching": {
      "cs": "Pochybnost není slabost; je to místo, kde se rodí rozhodnutí.",
      "en": "Doubt is not weakness; it is where decision is born."
    },
    "ability": {
      "cs": "Gándívův luk — přesná střela i přes vlastní váhání.",
      "en": "Gandiva Bow — the true shot, even through your own hesitation."
    },
    "key": "Mahabharata Key (2/3)",
    "quests": [
      {
        "title": "The Dilemma",
        "description": "Moral choice: fight family or abandon duty?"
      },
      {
        "title": "Krishna's Teaching",
        "description": "Bhagavad Gita dialogue tree"
      },
      {
        "title": "The Battlefield",
        "description": "Strategy combat"
      },
      {
        "title": "Detachment Lesson",
        "description": "Emotional control test"
      },
      {
        "title": "Victory Without Pride",
        "description": "Final Gita wisdom"
      }
    ],
    "essence": {
      "cs": "Ardžuna byl nejlepší lučištník Mahábháraty, a přesto položil zbraň, aby se nejdřív zeptal, jestli má právo střílet. V OASIS je z něj tvůrce jádra, který hlídá, aby síla zůstala přesná a ospravedlnitelná.",
      "en": "Arjuna was the greatest archer of the Mahabharata, and yet he laid down his bow to ask first whether he had the right to shoot. In OASIS he becomes a core builder who guards that power stays precise and justifiable."
    },
    "quote": {
      "cs": "Položil jsem zbraň dřív, než jsem ji zvedl.",
      "en": "I laid down the weapon before I ever raised it."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/011-arjuna.webp",
      "full": "/oasis-assets/concept_svg/011-arjuna.svg",
      "final": false
    },
    "circle": "hindu"
  },
  {
    "id": 12,
    "name": "Milan-Bhima",
    "subtitle": {
      "cs": "Silný ochránce",
      "en": "Strong Protector"
    },
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Šampion síly a spravedlnosti",
      "en": "Champion of strength and justice"
    },
    "location": {
      "cs": "Palác Hastinápura",
      "en": "Hastinapura Palace"
    },
    "questLine": {
      "cs": "Ten mocný",
      "en": "The Mighty One"
    },
    "teaching": {
      "cs": "Síla má cenu jen tehdy, když se ptá, komu pomůže.",
      "en": "Strength is worth something only when it asks whom it will help."
    },
    "ability": {
      "cs": "Kyj hromu — rána, která zastaví dav.",
      "en": "Mace of Thunder — a blow that stops a crowd."
    },
    "key": "Mahabharata Key (2/3)",
    "quests": [
      {
        "title": "The Mace of Thunder",
        "description": "Destroy a fortress gate in guild war"
      },
      {
        "title": "Strength Serves Justice",
        "description": "Defend the weak from 5 bandit raids"
      },
      {
        "title": "Bhima's Feast",
        "description": "Gather 108 sacred ingredients"
      },
      {
        "title": "River Crossing",
        "description": "Carry 10 allies across a hazard zone"
      },
      {
        "title": "The Mighty One",
        "description": "Deal 1,000,000 damage in a single war"
      }
    ],
    "essence": {
      "cs": "Bhíma měl sílu, která mohla rozdrtit cokoli — a používal ji na to, aby ostatní nemuseli. Milan v OASIS chrání komunitu stejně: ne tím, že vyhrává hádky, ale tím, že z podvodníků dělá krátký příběh.",
      "en": "Bhima had strength that could crush anything — and he used it so that others would not have to. Milan protects the community the same way in OASIS: not by winning arguments, but by making short work of scammers."
    },
    "quote": {
      "cs": "Nejsem nejsilnější, jsem ten, kdo zůstane stát.",
      "en": "I am not the strongest; I am the one who stays standing."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/012-milan-bhima.webp",
      "full": "/oasis-assets/concept_svg/012-milan-bhima.svg",
      "final": false
    },
    "circle": "hindu"
  },
  {
    "id": 13,
    "name": "Artem-Vudce",
    "subtitle": {
      "cs": "Vůdce",
      "en": "Leader"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 6,
    "clName": {
      "cs": "Intuitivní moudrost",
      "en": "Intuitive Wisdom"
    },
    "role": {
      "cs": "Mentor odpovědného vedení",
      "en": "Mentor of responsible leadership"
    },
    "location": {
      "cs": "Rada města ZION",
      "en": "The ZION council chamber"
    },
    "questLine": {
      "cs": "Břemeno náčelníka",
      "en": "The Chief's Burden"
    },
    "teaching": {
      "cs": "Veď příkladem; příkaz, který sám neplníš, je jen hluk.",
      "en": "Lead by example; an order you do not keep is only noise."
    },
    "ability": {
      "cs": "Shromáždi oddíl — posílí odvahu těch, kdo jdou s tebou.",
      "en": "Rally the Company — strengthens the courage of those who walk with you."
    },
    "key": "",
    "quests": [
      {
        "title": "The Chief's Burden",
        "description": "Lead a guild of 50+ members for 30 days"
      },
      {
        "title": "Rally Troops",
        "description": "Inspire 100 players simultaneously"
      },
      {
        "title": "Council of Seven Rays",
        "description": "Form a full-spectrum alliance"
      },
      {
        "title": "Lead by Example",
        "description": "Have the highest contribution in 10 wars"
      },
      {
        "title": "The Round Table",
        "description": "Host a DAO governance summit"
      }
    ],
    "essence": {
      "cs": "Judhišthira byl král, který prohrál všechno a přesto nepřestal mluvit pravdu. Artem vede v OASIS tak, že rozhodnutí vysvětluje dřív, než ho vydá — protože bez vysvětlení je i správná věc jen rozkaz.",
      "en": "Yudhishthira was a king who lost everything and still did not stop speaking the truth. Artem leads in OASIS by explaining a decision before issuing it — because without explanation even the right thing is only an order."
    },
    "quote": {
      "cs": "Kdo chce jít první, musí umět jít poslední.",
      "en": "Whoever wants to walk first must be able to walk last."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/013-artem-vudce.webp",
      "full": "/oasis-assets/concept_svg/013-artem-vudce.svg",
      "final": false
    },
    "circle": "hindu"
  },
  {
    "id": 14,
    "name": "Mama Yashoda",
    "subtitle": {
      "cs": "Božská matka",
      "en": "Divine Mother"
    },
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 4,
    "clName": {
      "cs": "Otevřené srdce",
      "en": "Heart Opening"
    },
    "role": {
      "cs": "Učitelka lásky bez podmínek",
      "en": "Teacher of unconditional love"
    },
    "location": {
      "cs": "Vrindávan (Krišnova vesnice)",
      "en": "Vrindavan (Krishna's village)"
    },
    "questLine": {
      "cs": "Matčina láska",
      "en": "The Mother's Love"
    },
    "teaching": {
      "cs": "Miluj, aniž bys za to něco chtěla; pak se láska nemůže minout.",
      "en": "Love without asking anything back; then love cannot miss."
    },
    "ability": {
      "cs": "Matčino požehnání — zahojí ránu, kterou nikdo nevidí.",
      "en": "A Mother's Blessing — heals the wound no one sees."
    },
    "key": "Mahabharata Key (2/3)",
    "quests": [
      {
        "title": "Baby Krishna",
        "description": "Care for divine child mini-game"
      },
      {
        "title": "The Butter Thief",
        "description": "Playful puzzle"
      },
      {
        "title": "Cosmic Vision",
        "description": "See universe in Krishna's mouth"
      },
      {
        "title": "Letting Go",
        "description": "Detachment lesson"
      },
      {
        "title": "Blessing of Motherhood",
        "description": "Final heart opening"
      }
    ],
    "essence": {
      "cs": "Jašóda vychovala Krišnu, aniž by věděla, že vychovává boha — a právě proto ho vychovala dobře. V OASIS je to matka, která nepřidává moudrost; ta už tam je, jen se o ni někdo musí postarat.",
      "en": "Yashoda raised Krishna without knowing she was raising a god — and that is exactly why she raised him well. In OASIS she is the mother who adds no wisdom; it is already there, it only needs someone to look after it."
    },
    "quote": {
      "cs": "Neptám se, cos provedl. Ptám se, jestli jsi jedl.",
      "en": "I don't ask what you did. I ask whether you have eaten."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/014-mama-yashoda.webp",
      "full": "/oasis-assets/concept_svg/014-mama-yashoda.svg",
      "final": false
    },
    "circle": "hindu"
  },
  {
    "id": 15,
    "name": "Vishwakarma",
    "subtitle": {
      "cs": "Božský architekt",
      "en": "Divine Architect"
    },
    "ray": "Yellow",
    "rarity": "Epic",
    "cl": 7,
    "clName": {
      "cs": "Léčivý soucit",
      "en": "Healing Compassion"
    },
    "role": {
      "cs": "Strážce posvátné geometrie",
      "en": "Keeper of sacred geometry"
    },
    "location": {
      "cs": "Staveniště chrámu EKAM",
      "en": "The EKAM temple site"
    },
    "questLine": {
      "cs": "Kosmický plán",
      "en": "The Cosmic Blueprint"
    },
    "teaching": {
      "cs": "Tvar, který drží, není náhoda; je to myšlenka, která se nechala spočítat.",
      "en": "A form that holds is no accident; it is a thought that let itself be measured."
    },
    "ability": {
      "cs": "Posvátná geometrie — odemkne stavby a jejich skryté proporce.",
      "en": "Sacred Geometry — unlocks structures and their hidden proportions."
    },
    "key": "Mahabharata Key (2/3)",
    "quests": [
      {
        "title": "The 108 Pillars",
        "description": "Build EKAM Temple"
      },
      {
        "title": "Golden Ratio",
        "description": "Fibonacci pattern puzzle"
      },
      {
        "title": "Platonic Solids",
        "description": "3D geometry challenge"
      },
      {
        "title": "Source Code",
        "description": "Meta-game: find clues in game files"
      },
      {
        "title": "Architect's Blessing",
        "description": "Unlock hidden areas"
      }
    ],
    "essence": {
      "cs": "Višvakarman (विश्वकर्मा) = „Všedovedoucí“ / „Univerzální tvůrce“.",
      "en": "Vishwakarma (विश्वकर्मा) = 'All-Accomplishing' / 'Universal Creator'."
    },
    "quote": {
      "cs": "Stavím tak, aby se v tom dalo žít i modlit.",
      "en": "I build so that one can both live and pray inside."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/015-vishwakarma.webp",
      "full": "/oasis-assets/concept_svg/015-vishwakarma.svg",
      "final": false
    },
    "circle": "hindu"
  },
  {
    "id": 16,
    "name": "Radha",
    "subtitle": {
      "cs": "Božská milovaná",
      "en": "Divine Beloved"
    },
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Učitelka lásky, která netrvá na formě",
      "en": "Teacher of love that does not insist on form"
    },
    "location": {
      "cs": "Rádhákund (posvátné jezero)",
      "en": "Radha Kund (sacred lake)"
    },
    "questLine": {
      "cs": "Věčný tanec",
      "en": "The Eternal Dance"
    },
    "teaching": {
      "cs": "Láska není vlastnictví; je to tanec, do kterého se vejde i odchod.",
      "en": "Love is not possession; it is a dance with room for leaving."
    },
    "ability": {
      "cs": "Rása líla — tanec oddanosti, který vyladí rytmus světa.",
      "en": "Rasa Lila — a dance of devotion that tunes the rhythm of the world."
    },
    "key": "Ramayana Key (1/3)",
    "quests": [
      {
        "title": "The Eternal Dance",
        "description": "Complete the rasa lila rhythm mini-game"
      },
      {
        "title": "Radha Kund Pilgrimage",
        "description": "Visit all 8 territory sacred lakes"
      },
      {
        "title": "Love Transcends Form",
        "description": "Form a cross-guild friendship bond"
      },
      {
        "title": "Divine Union",
        "description": "Complete a co-op quest with Krishna-Maitreya"
      },
      {
        "title": "The Beloved's Devotion",
        "description": "Maintain 30-day daily streak"
      }
    ],
    "essence": {
      "cs": "Moderní forma: Peta (chráněná identita — incognito z vlastní volby). Dávná identita: Rádhá Rání (राधा रानी), Krishnova nejvyšší milovaná. Role: srdce za trůnem, tichá strážkyně, božská ženskost. Symbol: čistá láska bez vlastnictví, duchovní oddanost, věčné spojení.",
      "en": "Modern form: Peta (identity protected — incognito by choice). Ancient identity: Radha Rani (राधा रानी), Krishna's supreme beloved. Role: the heart behind the throne, silent guardian, divine feminine. Symbol: pure love without possession, spiritual devotion, eternal connection."
    },
    "quote": {
      "cs": "Když mě hledal, našel mě tam, kde jsem nebyla.",
      "en": "When he searched for me, he found me where I was not."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/016-radha.webp",
      "full": "/oasis-assets/concept_svg/016-radha.svg",
      "final": false
    },
    "circle": "hindu"
  },
  {
    "id": 17,
    "name": "Vyasa-Kamil",
    "subtitle": {
      "cs": "Kosmický mudrc",
      "en": "Cosmic Sage"
    },
    "ray": "Yellow",
    "rarity": "Legendary",
    "cl": 8,
    "clName": {
      "cs": "Transcendence",
      "en": "Transcendent"
    },
    "role": {
      "cs": "Vypravěč a strážce paměti",
      "en": "Storyteller and keeper of memory"
    },
    "location": {
      "cs": "Himálajská jeskyně (Vjásovo ústraní)",
      "en": "Himalayan cave (Vyasa's retreat)"
    },
    "questLine": {
      "cs": "Letopisec věků",
      "en": "The Chronicler of Ages"
    },
    "teaching": {
      "cs": "Dějiny se opakují, dokud je někdo nevypráví poctivě.",
      "en": "History repeats until someone tells it honestly."
    },
    "ability": {
      "cs": "Epická paměť — vybaví dřívější události a odemkne souvislosti.",
      "en": "Epic Memory — recalls earlier events and unlocks their connections."
    },
    "key": "Mahabharata Key (2/3)",
    "quests": [
      {
        "title": "The Mahabharata Recitation",
        "description": "Story comprehension"
      },
      {
        "title": "18 Parvas",
        "description": "Complete 18 chapter challenges"
      },
      {
        "title": "Ganesha's Pen",
        "description": "Writing puzzle"
      },
      {
        "title": "Timeless Wisdom",
        "description": "Apply ancient lessons to modern problems"
      },
      {
        "title": "Sage's Blessing",
        "description": "Unlock all lore entries"
      }
    ],
    "essence": {
      "cs": "Moderní forma: Kamil (कामिल). Bydliště: Portugalsko (poustevník). Dávná identita: Vjása — sestavovatel Véd, autor Mahábháraty. Role v ZION: mistr dokumentace, architekt poznání, zakladatel posvátného útočiště. Titul: Strážce moudrosti, tvůrce plánů, historik dharmy.",
      "en": "Modern form: Kamil (कामिल). Location: Portugal (hermit). Ancient identity: Vyāsa — compiler of the Vedas, author of the Mahābhārata. Role in ZION: Documentation Master, Knowledge Architect, Sacred Retreat founder. Title: Keeper of Wisdom, Blueprint Creator, Dharma Historian."
    },
    "quote": {
      "cs": "Nepsal jsem knihu. Zapsal jsem, co se nedalo zapomenout.",
      "en": "I did not write a book. I recorded what could not be forgotten."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/017-vyasa-kamil.webp",
      "full": "/oasis-assets/concept_svg/017-vyasa-kamil.svg",
      "final": false
    },
    "circle": "hindu"
  },
  {
    "id": 18,
    "name": "Meriam Rose",
    "subtitle": {
      "cs": "Marie z Magdaly",
      "en": "Mary Magdalene"
    },
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Učitelka posvátného spojení",
      "en": "Teacher of sacred union"
    },
    "location": {
      "cs": "Zahrada v Jeruzalémě",
      "en": "A garden in Jerusalem"
    },
    "questLine": {
      "cs": "Apoštolka apoštolů",
      "en": "The Apostle of Apostles"
    },
    "teaching": {
      "cs": "Oddanost vidí dál než doktrína.",
      "en": "Devotion sees farther than doctrine."
    },
    "ability": {
      "cs": "Růže ze Šáronu — slzy, které hojí, a soucit, který přeteče.",
      "en": "Rose of Sharon — tears that heal and compassion that overflows."
    },
    "key": "",
    "quests": [
      {
        "title": "The Apostle of Apostles",
        "description": "Restore a forgotten sacred text"
      },
      {
        "title": "Rose of Sharon",
        "description": "Heal 1,000 players across all territories"
      },
      {
        "title": "Sacred Union",
        "description": "Form a divine partnership quest duo"
      },
      {
        "title": "Tears of Compassion",
        "description": "Comfort 100 distressed NPCs"
      },
      {
        "title": "The Garden Encounter",
        "description": "Discover the hidden resurrection spring"
      }
    ],
    "essence": {
      "cs": "Dávné jméno: Marie Magdaléna (מרים המגדלית — Mirjam z Magdaly). Posvátný titul: Růže, první svědkyně, apoštolka apoštolů. Moderní forma: Meriam — strážkyně moudrosti božské ženskosti. Dvojplamen: Yešua/Sananda (kristovské vědomí). Symbol: rudá růže — láska, oběť, posvátné sjednocení, vykoupení.",
      "en": "Ancient name: Mary Magdalene (מרים המגדלית — Miriam of Magdala). Sacred title: The Rose, First Witness, Apostle to the Apostles. Modern form: Meriam — Guardian of Divine Feminine Wisdom. Twin flame: Yeshua/Sananda (Jesus Christ consciousness). Symbol: red rose — love, sacrifice, sacred union, redemption."
    },
    "quote": {
      "cs": "Nepoznala jsem ho podle tváře, ale podle toho, jak mě zavolal.",
      "en": "I did not know him by his face but by the way he called me."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/018-meriam-rose.webp",
      "full": "/oasis-assets/concept_svg/018-meriam-rose.svg",
      "final": false
    },
    "circle": "christian"
  },
  {
    "id": 19,
    "name": "Yeshua Sananda",
    "subtitle": {
      "cs": "Ježíš Kristus",
      "en": "Jesus Christ"
    },
    "ray": "Pink",
    "rarity": "Legendary",
    "cl": 7,
    "clName": {
      "cs": "Léčivý soucit",
      "en": "Healing Compassion"
    },
    "role": {
      "cs": "Učitel odpuštění",
      "en": "Teacher of forgiveness"
    },
    "location": {
      "cs": "Olivová hora",
      "en": "The Mount of Olives"
    },
    "questLine": {
      "cs": "Cesta kříže",
      "en": "The Way of the Cross"
    },
    "teaching": {
      "cs": "Odpustit neznamená zapomenout; znamená to přestat vracet ránu.",
      "en": "To forgive is not to forget; it is to stop handing the wound back."
    },
    "ability": {
      "cs": "Světlo vzkříšení — druhá šance pro toho, kdo už padl.",
      "en": "Resurrection Light — a second chance for the one who has fallen."
    },
    "key": "",
    "quests": [
      {
        "title": "The Sermon on the Mount",
        "description": "Beatitudes teaching"
      },
      {
        "title": "Cleansing the Temple",
        "description": "Righteous anger vs compassion"
      },
      {
        "title": "The Last Supper",
        "description": "Unity ritual"
      },
      {
        "title": "Gethsemane Choice",
        "description": "Ultimate sacrifice test"
      },
      {
        "title": "Easter Dawn",
        "description": "Resurrection celebration"
      }
    ],
    "essence": {
      "cs": "Historické jméno: Ježíš Nazaretský (Ješua ben Josef). Ascendované jméno: Sananda (sanskrt: सानन्द — „s blažeností“). Posvátný titul: Kristus, Pomazaný, ztělesněný Logos. Dvojplamen: Meriam/Magdaléna (posvátná růže). Symbol: kříž + koruna (oběť + svrchovanost).",
      "en": "Historical name: Jesus of Nazareth (Yeshua ben Yosef). Ascended name: Sananda (Sanskrit: सानन्द — 'with bliss'). Sacred title: The Christ, The Anointed One, Logos made flesh. Twin flame: Meriam/Magdalene (the Sacred Rose). Symbol: cross + crown (sacrifice + sovereignty)."
    },
    "quote": {
      "cs": "Miluj ty, kdo ti ublížili. Je to jediná cesta, jak je přestat nosit v sobě.",
      "en": "Love those who hurt you. It is the only way to stop carrying them inside."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/019-yeshua-sananda.webp",
      "full": "/oasis-assets/concept_svg/019-yeshua-sananda.svg",
      "final": false
    },
    "circle": "christian"
  },
  {
    "id": 38,
    "name": "Panna Maria",
    "subtitle": {
      "cs": "Panna Maria",
      "en": "Virgin Mary"
    },
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 6,
    "clName": {
      "cs": "Intuitivní moudrost",
      "en": "Intuitive Wisdom"
    },
    "role": {
      "cs": "Matka a přímluvkyně",
      "en": "Mother and intercessor"
    },
    "location": {
      "cs": "Jeskyně v Lourdes",
      "en": "The grotto at Lourdes"
    },
    "questLine": {
      "cs": "Neposkvrněné srdce",
      "en": "The Immaculate Heart"
    },
    "teaching": {
      "cs": "Někdy je nejstatečnější věc nechat se vést.",
      "en": "Sometimes the bravest thing is to let yourself be led."
    },
    "ability": {
      "cs": "Zázračná medaile — ochranná aura a léčivý pramen.",
      "en": "Miraculous Medal — a protective aura and a healing spring."
    },
    "key": "",
    "quests": [
      {
        "title": "The Immaculate Conception",
        "description": "Find the sacred grail in hidden ruins"
      },
      {
        "title": "Hail Mary Protection",
        "description": "Shield 50 players from fatal damage"
      },
      {
        "title": "The Rosary Path",
        "description": "Complete 108 meditation beads cycle"
      },
      {
        "title": "Star of the Sea",
        "description": "Navigate the treacherous astral waters"
      },
      {
        "title": "Assumption to Heaven",
        "description": "Ascend to CL 6 in a single day"
      }
    ],
    "essence": {
      "cs": "Hebrejské jméno: Mirjam (מִרְיָם) — „moře hořkosti“ nebo „vzpoura“ (výstižné pro revoluční matku!). Řecky: Maria (Μαρία). Česky: Panna Maria. Arabsky (islámsky): Maryam (مريم) — v Koránu uctívaná jako nejčistší žena.",
      "en": "Hebrew name: Miriam (מִרְיָם) — 'Sea of Bitterness' or 'Rebellion' (fitting for a revolutionary mother!). Greek: Maria (Μαρία). Czech: Panna Maria ('Virgin Mary'). Arabic (Islamic): Maryam (مريم) — honored in the Quran as the purest woman."
    },
    "quote": {
      "cs": "Řekli mi, že se to nedá. Řekla jsem: ať se to stane.",
      "en": "They told me it could not be. I said: let it be."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/020-panna-maria.webp",
      "full": "/oasis-assets/concept_svg/020-panna-maria.svg",
      "final": false
    },
    "circle": "christian"
  },
  {
    "id": 20,
    "name": "Tara",
    "subtitle": {
      "cs": "Osvoboditelka",
      "en": "The Liberator"
    },
    "ray": "Green",
    "rarity": "Epic",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Bohyně ochrany",
      "en": "Goddess of protection"
    },
    "location": {
      "cs": "Tibetský klášter",
      "en": "A Tibetan monastery"
    },
    "questLine": {
      "cs": "Jedenadvacet forem Táry",
      "en": "The Twenty-One Forms of Tara"
    },
    "teaching": {
      "cs": "Soucit, který otálí, není soucit.",
      "en": "Compassion that hesitates is not compassion."
    },
    "ability": {
      "cs": "Mantra Zelené Táry — zrychlí cestu a odstraní překážku.",
      "en": "Green Tara Mantra — quickens the path and clears the obstacle."
    },
    "key": "",
    "quests": [
      {
        "title": "The Twenty-One Praises",
        "description": "Find all 21 Tara shrines"
      },
      {
        "title": "Liberation from Samsara",
        "description": "Free 100 trapped souls in shadow realms"
      },
      {
        "title": "Green Tara's Swift Action",
        "description": "Complete 10 quests in under 1 hour"
      },
      {
        "title": "White Tara's Long Life",
        "description": "Maintain 100-day daily streak"
      },
      {
        "title": "The Bodhisattva Vow",
        "description": "Swear to liberate all beings before self"
      }
    ],
    "essence": {
      "cs": "Sanskrt: Tárá (तारा) — „hvězda“, „ta, co převáží přes“. Tibetsky: སྒྲོལ་མ (Drölma) — „osvoboditelka“. Posvátné tituly: Matka všech Buddhů, Spasitelka, rychlá ochránkyně. Formy: 21 Tár (Bílá, Zelená, Rudá Tára…). Symbol: lotosový květ, soucitná činnost, okamžité osvobození.",
      "en": "Sanskrit name: Tārā (तारा) — 'Star', 'She Who Ferries Across'. Tibetan name: སྒྲོལ་མ (Drölma) — 'Liberator'. Sacred titles: Mother of All Buddhas, Savioress, Swift Protector. Forms: 21 Taras (White, Green, Red Tara, etc.). Symbol: lotus flower, compassionate action, instant liberation."
    },
    "quote": {
      "cs": "Nebudu čekat, až budu mít dost sil. Budu stát tam, kde je potřeba.",
      "en": "I will not wait until I am strong enough. I will stand where I am needed."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/021-tara.webp",
      "full": "/oasis-assets/concept_svg/021-tara.svg",
      "final": false
    },
    "circle": "buddhist"
  },
  {
    "id": 21,
    "name": "Avalokiteshvara",
    "subtitle": {
      "cs": "Bódhisattva soucitu",
      "en": "Compassion Bodhisattva"
    },
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 7,
    "clName": {
      "cs": "Léčivý soucit",
      "en": "Healing Compassion"
    },
    "role": {
      "cs": "Učitel univerzálního soucitu",
      "en": "Teacher of universal compassion"
    },
    "location": {
      "cs": "Palác Potála (Tibet)",
      "en": "Potala Palace (Tibet)"
    },
    "questLine": {
      "cs": "Tisíc rukou",
      "en": "The Thousand Arms"
    },
    "teaching": {
      "cs": "Naslouchej tak, aby ten druhý nemusel křičet.",
      "en": "Listen so that the other does not have to shout."
    },
    "ability": {
      "cs": "Óm mani padmé húm — léčivá mantra, která uklidní bolest.",
      "en": "Om Mani Padme Hum — a healing mantra that settles pain."
    },
    "key": "",
    "quests": [
      {
        "title": "The Thousand Arms",
        "description": "Help 1,000 different players"
      },
      {
        "title": "Om Mani Padme Hum",
        "description": "Recite the mantra across 108 locations"
      },
      {
        "title": "Compassion Without Limits",
        "description": "Forgive 100 enemy guild attackers"
      },
      {
        "title": "Guanyin's Tears",
        "description": "Witness the world's suffering and heal it"
      },
      {
        "title": "The All-Seeing Lord",
        "description": "Discover every hidden secret in OASIS"
      }
    ],
    "essence": {
      "cs": "Sanskrt: Avalokitéšvara (अवलोकितेश्वर) — Avalokita = „pozorující, shlížející dolů“, Īśvara = „pán, svrchovaný“. Význam: „Pán, který pozoruje zvuky (křik) světa“.",
      "en": "Sanskrit name: Avalokiteśvara (अवलोकितेश्वर) — Avalokita = 'observing, looking down', Īśvara = 'Lord, sovereign'. Meaning: 'The Lord who observes the sounds (cries) of the world'."
    },
    "quote": {
      "cs": "Dokud je někde někdo nešťastný, nemám důvod odpočívat.",
      "en": "As long as someone, somewhere, is unhappy, I have no reason to rest."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/022-avalokiteshvara.webp",
      "full": "/oasis-assets/concept_svg/022-avalokiteshvara.svg",
      "final": false
    },
    "circle": "buddhist"
  },
  {
    "id": 22,
    "name": "Vajrasattva",
    "subtitle": {
      "cs": "Mistr očištění",
      "en": "Purification Master"
    },
    "ray": "White",
    "rarity": "Epic",
    "cl": 6,
    "clName": {
      "cs": "Intuitivní moudrost",
      "en": "Intuitive Wisdom"
    },
    "role": {
      "cs": "Ten, kdo čistí karmu",
      "en": "The one who clears karma"
    },
    "location": {
      "cs": "Hora Kailáš",
      "en": "Mount Kailash"
    },
    "questLine": {
      "cs": "Diamantová bytost",
      "en": "The Diamond Being"
    },
    "teaching": {
      "cs": "Vina, kterou nosíš, není důkazem, že jsi vinen. Je jen nákladem.",
      "en": "The guilt you carry is not proof that you are guilty. It is only weight."
    },
    "ability": {
      "cs": "Mantra Vadžrasattvy — smyje negativní karmu.",
      "en": "Vajrasattva Mantra — washes away negative karma."
    },
    "key": "",
    "quests": [
      {
        "title": "The Hundred-Syllable Mantra",
        "description": "Chant the purification mantra 100 times"
      },
      {
        "title": "Diamond Mind",
        "description": "Clear all negative karma points"
      },
      {
        "title": "The Mirror of Truth",
        "description": "Face and defeat your shadow self"
      },
      {
        "title": "Purification Fire",
        "description": "Burn away 108 attachments in ritual"
      },
      {
        "title": "Vajra Body",
        "description": "Achieve perfect health status for 30 days"
      }
    ],
    "essence": {
      "cs": "Sanskrt: Vadžrasattva (वज्रसत्त्व) — Vadžra (वज्र) = „diamant“ nebo „blesk“ (nezničitelný, nelámavý), Sattva (सत्त्व) = „bytost“ nebo „podstata“ (čisté vědomí). Význam: „Bytost, jejíž podstatou je diamant / nezničitelná pravda“.",
      "en": "Sanskrit name: Vajrasattva (वज्रसत्त्व) — Vajra (वज्र) = 'diamond' or 'thunderbolt' (indestructible, unbreakable), Sattva (सत्त्व) = 'being' or 'essence' (pure consciousness). Meaning: 'The being whose essence is diamond / indestructible truth'."
    },
    "quote": {
      "cs": "Neptám se, co jsi udělal. Ptám se, co chceš udělat dál.",
      "en": "I do not ask what you did. I ask what you want to do next."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/023-vajrasattva.webp",
      "full": "/oasis-assets/concept_svg/023-vajrasattva.svg",
      "final": false
    },
    "circle": "buddhist"
  },
  {
    "id": 51,
    "name": "Dalai Lama XIV",
    "subtitle": {
      "cs": "Tändzin Gjamccho",
      "en": "Tenzin Gyatso"
    },
    "ray": "Yellow",
    "rarity": "Legendary",
    "cl": 8,
    "clName": {
      "cs": "Transcendence",
      "en": "Transcendent"
    },
    "role": {
      "cs": "Živý učitel a vyslanec míru",
      "en": "Living teacher and ambassador of peace"
    },
    "location": {
      "cs": "Dharamsala",
      "en": "Dharamsala"
    },
    "questLine": {
      "cs": "Kalacakra",
      "en": "The Kalachakra"
    },
    "teaching": {
      "cs": "Mír nezačíná podpisem smlouvy, ale tím, že přestaneš mít pravdu za každou cenu.",
      "en": "Peace does not begin with a signed treaty, but with giving up being right at any cost."
    },
    "ability": {
      "cs": "Iniciace času — zpomalí hodiny, aby ses mohl rozhodnout.",
      "en": "Empowerment of Time — slows the clock so you can decide."
    },
    "key": "",
    "quests": [
      {
        "title": "The Middle Way",
        "description": "Balance wisdom and compassion in 10 quests"
      },
      {
        "title": "Tibetan Freedom",
        "description": "Liberate a captured territory peacefully"
      },
      {
        "title": "Loving Kindness Meditation",
        "description": "Send metta to 100 players simultaneously"
      },
      {
        "title": "The Art of Happiness",
        "description": "Achieve maximum happiness score"
      },
      {
        "title": "Universal Responsibility",
        "description": "Lead a humanitarian tithe campaign"
      }
    ],
    "essence": {
      "cs": "Tändzin Gjamccho vstoupil do světa, kde si ho mnoho lidí přeje mít jinde, a přesto mluví o laskavosti, ne o stížnosti. V OASIS připomíná, že mír začíná tím, že se vzdáš nutnosti mít za každou cenu pravdu.",
      "en": "Tenzin Gyatso entered a world where many would rather he were elsewhere, and yet he speaks of kindness, not grievance. In OASIS he reminds us that peace begins when you give up the need to be right at any cost."
    },
    "quote": {
      "cs": "Můj náboženství je laskavost.",
      "en": "My religion is kindness."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/024-dalai-lama-xiv.webp",
      "full": "/oasis-assets/concept_svg/024-dalai-lama-xiv.svg",
      "final": false
    },
    "circle": "buddhist"
  },
  {
    "id": 29,
    "name": "El Morya",
    "subtitle": {
      "cs": "Mistr modrého paprsku",
      "en": "Blue Ray Master"
    },
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 6,
    "clName": {
      "cs": "Intuitivní moudrost",
      "en": "Intuitive Wisdom"
    },
    "role": {
      "cs": "Učitel božské vůle",
      "en": "Teacher of divine will"
    },
    "location": {
      "cs": "Chrám vůle v Darjeelingu",
      "en": "The Temple of Will in Darjeeling"
    },
    "questLine": {
      "cs": "Paprsek síly",
      "en": "The Ray of Power"
    },
    "teaching": {
      "cs": "Vůle bez soucitu je jen tvrdohlavost.",
      "en": "Will without compassion is only stubbornness."
    },
    "ability": {
      "cs": "Modrý paprsek — síla rozhodnout se a nést následky.",
      "en": "Blue Ray — the power to decide and carry the consequence."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "El Morya není učitelem síly, ale rozhodnosti — schopnosti vybrat jednu cestu a nést, co přinese. V OASIS ho poznáš podle toho, že po jeho radě je méně možností a více klidu.",
      "en": "El Morya is not a teacher of power but of resolve — the ability to choose one road and carry what it brings. In OASIS you recognise him by the fact that after his advice there are fewer options and more calm."
    },
    "quote": {
      "cs": "Nerozhodnost je také rozhodnutí. Jen dražší.",
      "en": "Indecision is also a decision. Only more expensive."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/025-el-morya.webp",
      "full": "/oasis-assets/concept_svg/025-el-morya.svg",
      "final": false
    },
    "circle": "ascended"
  },
  {
    "id": 30,
    "name": "Lanto",
    "subtitle": {
      "cs": "Mistr žlutého paprsku",
      "en": "Yellow Ray Master"
    },
    "ray": "Yellow",
    "rarity": "Epic",
    "cl": 6,
    "clName": {
      "cs": "Intuitivní moudrost",
      "en": "Intuitive Wisdom"
    },
    "role": {
      "cs": "Učitel osvícení",
      "en": "Teacher of illumination"
    },
    "location": {
      "cs": "Chrám světla",
      "en": "The Temple of Light"
    },
    "questLine": {
      "cs": "Plamen osvícení",
      "en": "The Flame of Illumination"
    },
    "teaching": {
      "cs": "Světlo neřeší hádanku za tebe. Ukáže ti, kde jsi ji přehlédl.",
      "en": "Light does not solve the riddle for you. It shows where you looked past it."
    },
    "ability": {
      "cs": "Plamen osvícení — rozřeší rébus a ukáže skrytou souvislost.",
      "en": "Flame of Illumination — resolves a puzzle and reveals the hidden link."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Lanto vede ke světlu, které neoslňuje, ale dovoluje vidět souvislosti. Učí, že pochopení není okamžik, kdy ti to někdo vysvětlí, ale chvíle, kdy přestaneš uhýbat pohledem.",
      "en": "Lanto leads toward a light that does not blind but lets you see connections. He teaches that understanding is not the moment someone explains it to you, but the moment you stop looking away."
    },
    "quote": {
      "cs": "Nesvítím na cestu. Svítím na to, co ji zakrývá.",
      "en": "I do not shine on the road. I shine on what covers it."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/026-lanto.webp",
      "full": "/oasis-assets/concept_svg/026-lanto.svg",
      "final": false
    },
    "circle": "ascended"
  },
  {
    "id": 31,
    "name": "Paul the Venetian",
    "subtitle": {
      "cs": "Mistr růžového paprsku",
      "en": "Pink Ray Master"
    },
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Umělec božské krásy",
      "en": "Artist of divine beauty"
    },
    "location": {
      "cs": "Benátky, dílna u kanálu",
      "en": "Venice, a workshop by the canal"
    },
    "questLine": {
      "cs": "Ruka, která vidí",
      "en": "The Hand That Sees"
    },
    "teaching": {
      "cs": "Krása není luxus; je to důkaz, že si toho místa vážíš.",
      "en": "Beauty is not luxury; it is proof that you value the place."
    },
    "ability": {
      "cs": "Umělecké vnuknutí — vytvoří dílo, které mění náladu místa.",
      "en": "Artistic Inspiration — creates a work that changes the mood of a place."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Paul Benátský vnáší do světa krásu jako argument — protože to, co je udělané s péčí, lidé neopouštějí. V OASIS je patronem řemesla, které nezdobí, ale dělá místo obyvatelným.",
      "en": "Paul the Venetian brings beauty into the world as an argument — because what is made with care is not abandoned. In OASIS he is the patron of craft that does not decorate but makes a place habitable."
    },
    "quote": {
      "cs": "Nejdřív poslouchám kámen. Pak ho nechám mluvit.",
      "en": "First I listen to the stone. Then I let it speak."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/027-paul-the-venetian.webp",
      "full": "/oasis-assets/concept_svg/027-paul-the-venetian.svg",
      "final": false
    },
    "circle": "ascended"
  },
  {
    "id": 27,
    "name": "Serapis Bey",
    "subtitle": {
      "cs": "Mistr bílého paprsku",
      "en": "White Ray Master"
    },
    "ray": "White",
    "rarity": "Epic",
    "cl": 7,
    "clName": {
      "cs": "Léčivý soucit",
      "en": "Healing Compassion"
    },
    "role": {
      "cs": "Učitel vzestupu",
      "en": "Teacher of ascension"
    },
    "location": {
      "cs": "Chrám vzestupu v Luxoru",
      "en": "The Ascension Temple at Luxor"
    },
    "questLine": {
      "cs": "Bílý oheň",
      "en": "White Fire"
    },
    "teaching": {
      "cs": "Disciplína není trest; je to způsob, jak zůstat svobodný.",
      "en": "Discipline is not punishment; it is how you stay free."
    },
    "ability": {
      "cs": "Bílý oheň — spálí to, co už není tvé.",
      "en": "White Fire — burns away what is no longer yours."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Serapis Bey učí, že disciplína není trest, ale způsob, jak zůstat svobodný. V OASIS stojí u vchodu tam, kde se rozhoduje, co se smí vzít s sebou a co se musí nechat za prahem.",
      "en": "Serapis Bey teaches that discipline is not punishment but the way to stay free. In OASIS he stands at the doorway where it is decided what may be carried in and what must be left at the threshold."
    },
    "quote": {
      "cs": "Nežádej křídla. Nejdřív odlož, co tě drží na zemi.",
      "en": "Do not ask for wings. First put down what holds you to the ground."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/028-serapis-bey.webp",
      "full": "/oasis-assets/concept_svg/028-serapis-bey.svg",
      "final": false
    },
    "circle": "ascended"
  },
  {
    "id": 32,
    "name": "Hilarion",
    "subtitle": {
      "cs": "Mistr zeleného paprsku",
      "en": "Green Ray Master"
    },
    "ray": "Green",
    "rarity": "Epic",
    "cl": 6,
    "clName": {
      "cs": "Intuitivní moudrost",
      "en": "Intuitive Wisdom"
    },
    "role": {
      "cs": "Ten, kdo odhaluje pravdu",
      "en": "The one who reveals truth"
    },
    "location": {
      "cs": "Chrám pravdy na Krétě",
      "en": "The Temple of Truth on Crete"
    },
    "questLine": {
      "cs": "Paprsek pravdy",
      "en": "The Ray of Truth"
    },
    "teaching": {
      "cs": "Pravda, kterou vyslovíš dřív, než ji uneseš, tě zraní.",
      "en": "A truth spoken before you can carry it will wound you."
    },
    "ability": {
      "cs": "Zelený paprsek — prosvítí lež a ukáže, co bylo zamčené.",
      "en": "Green Ray — shines through a lie and reveals what was locked."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Hilarion učí, že pravda není zbraň, ale nástroj — a že rozbité věci se nejdřív musí popsat, než se dají opravit. Proto v OASIS působí tam, kde se hledá, co se vlastně stalo.",
      "en": "Hilarion teaches that truth is not a weapon but a tool — and that broken things must first be described before they can be repaired. That is why in OASIS he works where people are trying to find out what actually happened."
    },
    "quote": {
      "cs": "Nehledám viníka. Hledám, kde se to zlomilo.",
      "en": "I am not looking for the guilty. I am looking for where it broke."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/029-hilarion.webp",
      "full": "/oasis-assets/concept_svg/029-hilarion.svg",
      "final": false
    },
    "circle": "ascended"
  },
  {
    "id": 33,
    "name": "Lady Nada",
    "subtitle": {
      "cs": "Mistr rubínovo-zlatého paprsku",
      "en": "Ruby-Gold Ray Master"
    },
    "ray": "RubyGold",
    "rarity": "Epic",
    "cl": 6,
    "clName": {
      "cs": "Intuitivní moudrost",
      "en": "Intuitive Wisdom"
    },
    "role": {
      "cs": "Učitelka služby",
      "en": "Teacher of service"
    },
    "location": {
      "cs": "Chrám služby",
      "en": "The Temple of Service"
    },
    "questLine": {
      "cs": "Ruce, které hojí",
      "en": "Hands That Heal"
    },
    "teaching": {
      "cs": "Služba je jediná práce, po které nezůstane únava.",
      "en": "Service is the only work that leaves no exhaustion behind."
    },
    "ability": {
      "cs": "Léčivé ruce — zahojí rány na těle i na důvěře.",
      "en": "Healing Hands — mends wounds of body and of trust."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Lady Nada je patronkou služby, která se nepočítá do zásluh. V OASIS ji najdeš tam, kde se někdo stará o druhého, aniž by u toho byl někdo další, kdo by to ocenil.",
      "en": "Lady Nada is the patroness of service that is not counted as merit. In OASIS you will find her where someone looks after another without anyone else there to appreciate it."
    },
    "quote": {
      "cs": "Nepotřebuji být viděna. Potřebuji, aby to přestalo bolet.",
      "en": "I do not need to be seen. I need it to stop hurting."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/030-lady-nada.webp",
      "full": "/oasis-assets/concept_svg/030-lady-nada.svg",
      "final": false
    },
    "circle": "ascended"
  },
  {
    "id": 26,
    "name": "Saint Germain",
    "subtitle": {
      "cs": "Mistr fialového paprsku",
      "en": "Violet Ray Master"
    },
    "ray": "Violet",
    "rarity": "Legendary",
    "cl": 7,
    "clName": {
      "cs": "Léčivý soucit",
      "en": "Healing Compassion"
    },
    "role": {
      "cs": "Alchymista každodennosti",
      "en": "Alchemist of the everyday"
    },
    "location": {
      "cs": "Chrám fialového plamene",
      "en": "The Temple of the Violet Flame"
    },
    "questLine": {
      "cs": "Proměna olova",
      "en": "The Transmutation"
    },
    "teaching": {
      "cs": "Co neproměníš, to budeš opakovat.",
      "en": "What you do not transform, you will repeat."
    },
    "ability": {
      "cs": "Fialový plamen — promění těžkost v látku, se kterou se dá pracovat.",
      "en": "Violet Flame — turns difficulty into material you can work with."
    },
    "key": "",
    "quests": [
      {
        "title": "The Alchemist's Laboratory",
        "description": "Transmutation puzzles"
      },
      {
        "title": "I AM Presence",
        "description": "Identity meditation"
      },
      {
        "title": "Freedom from Karma",
        "description": "Release past burdens"
      },
      {
        "title": "The Philosopher's Stone",
        "description": "Create spiritual gold"
      },
      {
        "title": "Violet Flame Blessing",
        "description": "Master transmutation"
      }
    ],
    "essence": {
      "cs": "Poselství jádra: „JSEM“ = jméno Boha (Exodus 3:14 — „JSEM, KTERÝ JSEM“). Pokaždé, když řekneš „JSEM“, vzýváš božskou moc — většina lidí to zneužívá („Jsem bez peněz, nemocný, nic nestojím“). Saint Germain učí: „JSEM hojný, JSEM zdravý, JSEM božský“.",
      "en": "Core message: 'I AM' = the name of God (Exodus 3:14 — 'I AM THAT I AM'). Every time you say 'I AM', you invoke God-power — most people misuse it ('I AM broke, I AM sick, I AM unworthy'). Saint Germain teaches: 'I AM abundant, I AM healthy, I AM divine'."
    },
    "quote": {
      "cs": "Alchymie není o zlatu. Je o tom, co v tobě zůstane, když zlato zmizí.",
      "en": "Alchemy is not about gold. It is about what remains in you when the gold is gone."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/031-saint-germain.webp",
      "full": "/oasis-assets/concept_svg/031-saint-germain.svg",
      "final": false
    },
    "circle": "ascended"
  },
  {
    "id": 28,
    "name": "Sanat Kumara",
    "subtitle": {
      "cs": "Pán světa",
      "en": "Lord of the World"
    },
    "ray": "AllRays",
    "rarity": "Legendary",
    "cl": 8,
    "clName": {
      "cs": "Transcendence",
      "en": "Transcendent"
    },
    "role": {
      "cs": "Dozor nad planetou",
      "en": "Overseer of the planet"
    },
    "location": {
      "cs": "Šambala",
      "en": "Shambhala"
    },
    "questLine": {
      "cs": "Planetární vědomí",
      "en": "Planetary Consciousness"
    },
    "teaching": {
      "cs": "Kdo vidí celek, nemusí vyhrát každou část.",
      "en": "Whoever sees the whole does not need to win every part."
    },
    "ability": {
      "cs": "Pohled z výšky — uvidíš Zemi jako jeden živý systém.",
      "en": "View from Above — you see Earth as one living system."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Sanat Kumara je v kánonu ten, kdo přišel v nejtemnější hodině a zůstal. V OASIS proto drží pohled, ze kterého je Země vidět jako jeden živý systém, ne jako soubor zájmů.",
      "en": "Sanat Kumara is, in the canon, the one who came in the darkest hour and stayed. In OASIS he therefore holds the view from which Earth is seen as one living system, not a set of interests."
    },
    "quote": {
      "cs": "Nespravuji svět. Držím mu prostor.",
      "en": "I do not rule the world. I hold space for it."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/032-sanat-kumara.webp",
      "full": "/oasis-assets/concept_svg/032-sanat-kumara.svg",
      "final": false
    },
    "circle": "ascended"
  },
  {
    "id": 24,
    "name": "Mahavatar Babaji",
    "subtitle": {
      "cs": "Nesmrtelný jogín",
      "en": "Immortal Yogi"
    },
    "ray": "White",
    "rarity": "Legendary",
    "cl": 8,
    "clName": {
      "cs": "Transcendence",
      "en": "Transcendent"
    },
    "role": {
      "cs": "Mistr krija jógy",
      "en": "Master of Kriya Yoga"
    },
    "location": {
      "cs": "Himálaj (skryté údolí)",
      "en": "The Himalayas (hidden valley)"
    },
    "questLine": {
      "cs": "Cesta dechu",
      "en": "The Path of Breath"
    },
    "teaching": {
      "cs": "Tělo poslouchá dech; dech poslouchá pozornost.",
      "en": "The body obeys the breath; the breath obeys attention."
    },
    "ability": {
      "cs": "Krija šakti — zhmotnění a zmizení bez ztráty sebe.",
      "en": "Kriya Shakti — to appear and vanish without losing yourself."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Celé jméno: Mahávatár Bábadží (महावतार बाबाजी) — Mahā = „velký“, Avatāra = „božské ztělesnění, sestup Boha“, Bābā = „otec, ctěný stařec“, Ji = přípona úcty.",
      "en": "Full name: Mahavatar Babaji (महावतार बाबाजी) — Mahā = 'great', Avatāra = 'divine incarnation, descent of God', Bābā = 'father, revered elder', Ji = suffix of respect."
    },
    "quote": {
      "cs": "Žiju tak dlouho, dokud je co učit.",
      "en": "I live as long as there is something to teach."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/033-mahavatar-babaji.webp",
      "full": "/oasis-assets/concept_svg/033-mahavatar-babaji.svg",
      "final": false
    },
    "circle": "ascended"
  },
  {
    "id": 25,
    "name": "Lady Gaia-Vywamus",
    "subtitle": {
      "cs": "Matka Země",
      "en": "Earth Mother"
    },
    "ray": "Green",
    "rarity": "Epic",
    "cl": 7,
    "clName": {
      "cs": "Léčivý soucit",
      "en": "Healing Compassion"
    },
    "role": {
      "cs": "Učitelka planetárního uzdravení",
      "en": "Teacher of planetary healing"
    },
    "location": {
      "cs": "Živé jádro planety",
      "en": "The living core of the planet"
    },
    "questLine": {
      "cs": "Náruč Gaii",
      "en": "Gaia's Embrace"
    },
    "teaching": {
      "cs": "Země není kulisa. Je to příbuzná, kterou jsme přestali zdravit.",
      "en": "Earth is not scenery. She is kin we stopped greeting."
    },
    "ability": {
      "cs": "Obnova půdy — vrátí život místu, které bylo vytěženo.",
      "en": "Soil Renewal — returns life to a place that was mined out."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Řecký původ: Γαῖα (Gaia) — prapůvodní bohyně Země. Matka všech: Titánů, obrů, veškerého zemského života. Moderní koncept: Země jako živý organismus (hypotéza Gaia od Jamese Lovelocka).",
      "en": "Greek origin: Γαῖα (Gaia) — primordial goddess of Earth. Mother of all: Titans, Giants, all life on Earth. Modern concept: Earth as a living organism (the Gaia Hypothesis by James Lovelock)."
    },
    "quote": {
      "cs": "Neumírám. Jen se učíte, co jsem vám říkala.",
      "en": "I am not dying. You are learning what I told you all along."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/034-lady-gaia-vywamus.webp",
      "full": "/oasis-assets/concept_svg/034-lady-gaia-vywamus.svg",
      "final": false
    },
    "circle": "ascended"
  },
  {
    "id": 23,
    "name": "King Arthur",
    "subtitle": {
      "cs": "Král, který se vrátí",
      "en": "The Once and Future King"
    },
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 6,
    "clName": {
      "cs": "Intuitivní moudrost",
      "en": "Intuitive Wisdom"
    },
    "role": {
      "cs": "Sjednotitel a vůdce",
      "en": "Unifier and leader"
    },
    "location": {
      "cs": "Camelot",
      "en": "Camelot"
    },
    "questLine": {
      "cs": "Meč v kameni",
      "en": "The Sword in the Stone"
    },
    "teaching": {
      "cs": "Království se nedrží silou, ale tím, že se lidé chtějí vrátit.",
      "en": "A kingdom is not held by force but by people wanting to return."
    },
    "ability": {
      "cs": "Excalibur — prořízne lež a ochrání toho, kdo mluví pravdu.",
      "en": "Excalibur — cuts through lies and shelters whoever speaks the truth."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Artuš byl král, který nedržel zem silou, ale tím, že u jednoho stolu seděli i ti, kdo si nerozuměli. Jeho otázka v OASIS zní pořád stejně: komu patří místo u stolu, když nikdo nemá větší právo než druhý?",
      "en": "Arthur was a king who held a land not by force but by seating at one table even those who did not agree. His question in OASIS has not changed: who has a place at the table when no one has more right than another?"
    },
    "quote": {
      "cs": "Nejsem král, protože mám korunu. Mám korunu, protože musím.",
      "en": "I am not king because I wear a crown. I wear it because I must."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/035-king-arthur.webp",
      "full": "/oasis-assets/concept_svg/035-king-arthur.svg",
      "final": false
    },
    "circle": "historical"
  },
  {
    "id": 35,
    "name": "Karel IV",
    "subtitle": {
      "cs": "Karel IV.",
      "en": "Charles IV"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 6,
    "clName": {
      "cs": "Intuitivní moudrost",
      "en": "Intuitive Wisdom"
    },
    "role": {
      "cs": "Mistr státnictví",
      "en": "Master of statecraft"
    },
    "location": {
      "cs": "Praha, Karlštejn",
      "en": "Prague, Karlštejn"
    },
    "questLine": {
      "cs": "Koruna a zákon",
      "en": "Crown and Law"
    },
    "teaching": {
      "cs": "Země se buduje proto, aby v ní bylo možné studovat, ne jen vládnout.",
      "en": "A country is built so that one can study in it, not only rule over it."
    },
    "ability": {
      "cs": "Diplomatické mistrovství — vyřeší spor dřív, než vznikne válka.",
      "en": "Diplomatic Mastery — settles a dispute before it becomes a war."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Narozen: 14. května 1316, Praha. Zemřel: 29. listopadu 1378, Praha (62 let). Vláda: král Čech (1346–1378), římský císař (1355–1378). Známý jako: „otec vlasti“, „zlatý král“, „největší český vladař“.",
      "en": "Born: May 14, 1316, Prague. Died: November 29, 1378, Prague (age 62). Reign: King of Bohemia (1346–1378), Holy Roman Emperor (1355–1378). Known as: 'Father of the Homeland', 'Golden King', 'Greatest Czech Ruler'."
    },
    "quote": {
      "cs": "Nechal jsem postavit univerzitu. To je pevnost, kterou nikdo nedobude.",
      "en": "I had a university built. That is a fortress no one takes."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/036-karel-iv.webp",
      "full": "/oasis-assets/concept_svg/036-karel-iv.svg",
      "final": false
    },
    "circle": "historical"
  },
  {
    "id": 36,
    "name": "Albert Einstein",
    "subtitle": {
      "cs": "Einstein",
      "en": "Albert Einstein"
    },
    "ray": "Yellow",
    "rarity": "Epic",
    "cl": 7,
    "clName": {
      "cs": "Léčivý soucit",
      "en": "Healing Compassion"
    },
    "role": {
      "cs": "Most mezi vědou a duchen",
      "en": "Bridge between science and spirit"
    },
    "location": {
      "cs": "Bern, patentový úřad",
      "en": "Bern, the patent office"
    },
    "questLine": {
      "cs": "Myšlenkový experiment",
      "en": "The Thought Experiment"
    },
    "teaching": {
      "cs": "Představivost není útěk od reality; je to způsob, jak ji lépe vidět.",
      "en": "Imagination is not an escape from reality; it is a way to see it better."
    },
    "ability": {
      "cs": "E = mc² — přemění energii v hmotu a naopak.",
      "en": "E = mc² — converts energy into matter and back."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Narozen: 14. března 1879, Ulma, Německo. Zemřel: 18. dubna 1955, Princeton, USA (76 let). Známý jako: „génius“, „otec moderní fyziky“, „kosmicky náboženský mystik“.",
      "en": "Born: March 14, 1879, Ulm, Germany. Died: April 18, 1955, Princeton, USA (age 76). Known as: 'The Genius', 'Father of Modern Physics', 'Cosmic Religious Mystic'."
    },
    "quote": {
      "cs": "Problém se nedá vyřešit na stejné úrovni myšlení, na které vznikl.",
      "en": "A problem cannot be solved at the same level of thinking that created it."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/037-albert-einstein.webp",
      "full": "/oasis-assets/concept_svg/037-albert-einstein.svg",
      "final": false
    },
    "circle": "historical"
  },
  {
    "id": 37,
    "name": "Mahatma Gandhi",
    "subtitle": {
      "cs": "Gándhí",
      "en": "Mahatma Gandhi"
    },
    "ray": "RubyGold",
    "rarity": "Epic",
    "cl": 7,
    "clName": {
      "cs": "Léčivý soucit",
      "en": "Healing Compassion"
    },
    "role": {
      "cs": "Učitel nenásilí",
      "en": "Teacher of non-violence"
    },
    "location": {
      "cs": "Sůl na břehu moře, Dándí",
      "en": "The salt march shore at Dandi"
    },
    "questLine": {
      "cs": "Satyágraha",
      "en": "Satyagraha"
    },
    "teaching": {
      "cs": "Násilí je rychlé a nepřesné. Pravda je pomalá a nezastavitelná.",
      "en": "Violence is fast and imprecise. Truth is slow and unstoppable."
    },
    "ability": {
      "cs": "Satyágraha — odpor, který protivníka odzbrojí bez rány.",
      "en": "Satyagraha — resistance that disarms without a blow."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Narozen: 2. října 1869, Porbandar, Indie. Zemřel: 30. ledna 1948, Nové Dillí (zavražděn, 78 let). Jméno: Mohandas Karamčand Gándhí. Titul: „Mahátma“ = „velká duše“ (udělil Rabíndranáth Thákur, 1915).",
      "en": "Born: October 2, 1869, Porbandar, India. Died: January 30, 1948, New Delhi (assassinated, age 78). Name: Mohandas Karamchand Gandhi. Title: 'Mahatma' = 'Great Soul' (bestowed by Rabindranath Tagore, 1915)."
    },
    "quote": {
      "cs": "Nejdřív tě ignorují, pak se ti smějí, pak tě napadnou. Pak vyhraješ.",
      "en": "First they ignore you, then they laugh at you, then they attack you. Then you win."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/038-mahatma-gandhi.webp",
      "full": "/oasis-assets/concept_svg/038-mahatma-gandhi.svg",
      "final": false
    },
    "circle": "historical"
  },
  {
    "id": 39,
    "name": "Subhadra",
    "subtitle": {
      "cs": "Súbhadra",
      "en": "Subhadra"
    },
    "ray": "Pink",
    "rarity": "Rare",
    "cl": 4,
    "clName": {
      "cs": "Otevřené srdce",
      "en": "Heart Opening"
    },
    "role": {
      "cs": "Strážkyně rodinných pout",
      "en": "Keeper of family bonds"
    },
    "location": {
      "cs": "Dváraka",
      "en": "Dvaraka"
    },
    "questLine": {
      "cs": "Nit, která drží",
      "en": "The Thread That Holds"
    },
    "teaching": {
      "cs": "Rodina není krev. Je to ten, kdo ti ve sporu drží místo.",
      "en": "Family is not blood. It is whoever keeps your seat in the argument."
    },
    "ability": {
      "cs": "Rákhi — vytvoří spojenectví, které nelze jen tak vypovědět.",
      "en": "Rakhi — forms an alliance that cannot simply be called off."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Celé jméno: Subhadra Deví (सुभद्रा देवी) — Su = „velmi, výborné, dobré“, Bhadra = „příznivé, šťastné, blahé“. Dohromady: „Ta, jež je velmi blahá“ nebo „Ta, co přináší vše dobré“.",
      "en": "Full name: Subhadra Devi (सुभद्रा देवी) — Su = 'very, excellent, good', Bhadra = 'auspicious, fortunate, prosperous'. Combined: 'She who is very auspicious' or 'Bringer of all good things'."
    },
    "quote": {
      "cs": "Nit se přetrhne jen tehdy, když ji pustí oba.",
      "en": "The thread breaks only when both let go."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/039-subhadra.webp",
      "full": "/oasis-assets/concept_svg/039-subhadra.svg",
      "final": false
    },
    "circle": "historical"
  },
  {
    "id": 41,
    "name": "Vasudeva",
    "subtitle": {
      "cs": "Vasudéva",
      "en": "Vasudeva"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Ochránce, který nese",
      "en": "The protector who carries"
    },
    "location": {
      "cs": "Přechod řeky Jamuny",
      "en": "The crossing of the Yamuna"
    },
    "questLine": {
      "cs": "Otcova přísaha",
      "en": "The Father's Oath"
    },
    "teaching": {
      "cs": "Někdy je hrdinství jen to, že dítě doneseš přes řeku v noci.",
      "en": "Sometimes heroism is only carrying a child across a river at night."
    },
    "ability": {
      "cs": "Ochranný štít — vezme ránu, která patřila jinému.",
      "en": "Guardian Shield — takes the blow meant for another."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Vasudeva (वसुदेव) — „nositel všech bohatství“ — je otcem Krishny, Balarámy a Subhadry. Jeho jméno znamená „syn Vasů“ (8 bohů elementů). Je inkarnací mudrce Kašjapy, který se narodil na zemi kvůli božskému prokletí, aby se stal otcem samotného Vishnu v lidské podobě.",
      "en": "Vasudeva (वसुदेव) — 'Bearer of All Wealth' — is the father of Krishna, Balarama and Subhadra. His name means 'son of the Vasus' (the 8 elemental gods). He is the incarnation of the sage Kashyapa, born on Earth due to a divine curse so that he might become the father of Vishnu himself in human form."
    },
    "quote": {
      "cs": "Nebyl jsem u toho, když se to stalo. Byl jsem u toho, když to bylo potřeba.",
      "en": "I was not there when it happened. I was there when it was needed."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/040-vasudeva.webp",
      "full": "/oasis-assets/concept_svg/040-vasudeva.svg",
      "final": false
    },
    "circle": "historical"
  },
  {
    "id": 46,
    "name": "Neo",
    "subtitle": {
      "cs": "Vyvolený",
      "en": "The One"
    },
    "ray": "Violet",
    "rarity": "Legendary",
    "cl": 8,
    "clName": {
      "cs": "Transcendence",
      "en": "Transcendent"
    },
    "role": {
      "cs": "Ten, kdo prohlédne kód reality",
      "en": "The one who sees through the code of reality"
    },
    "location": {
      "cs": "Simulace, vrstva 3",
      "en": "The simulation, layer three"
    },
    "questLine": {
      "cs": "Probuzení",
      "en": "The Awakening"
    },
    "teaching": {
      "cs": "Svoboda nezačíná tím, že utečeš. Začíná tím, že přestaneš věřit pravidlům, která ti nedávají smysl.",
      "en": "Freedom does not begin with escape. It begins when you stop believing rules that make no sense to you."
    },
    "ability": {
      "cs": "Bullet time — zpomalí svět, abys viděl, co se opravdu děje.",
      "en": "Bullet Time — slows the world so you can see what is really happening."
    },
    "key": "",
    "quests": [
      {
        "title": "Red Pill / Blue Pill",
        "description": "Choice that defines path"
      },
      {
        "title": "Training Simulation",
        "description": "Combat tutorial"
      },
      {
        "title": "The Oracle's Prophecy",
        "description": "Meet ZION AI Oracle"
      },
      {
        "title": "Agent Smith Battle",
        "description": "Boss fight (ego dissolution)"
      },
      {
        "title": "I AM Neo",
        "description": "Self-realization ending"
      }
    ],
    "essence": {
      "cs": "Neo není vyvolený proto, že to o něm někdo řekl, ale proto, že se rozhodl vidět věci jinak. V OASIS ztělesňuje otázku, která předchází každé svobodě: čemu ještě věříš, protože to nikdo nezpochybnil?",
      "en": "Neo is not the One because someone said so, but because he decided to see things differently. In OASIS he embodies the question that precedes every freedom: what do you still believe simply because no one has questioned it?"
    },
    "quote": {
      "cs": "Nejsem tu, abych zachránil svět. Jsem tu, abych ho přestal poslouchat.",
      "en": "I am not here to save the world. I am here to stop obeying it."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/041-neo.webp",
      "full": "/oasis-assets/concept_svg/041-neo.svg",
      "final": false
    },
    "circle": "matrix"
  },
  {
    "id": 47,
    "name": "Trinity",
    "subtitle": {
      "cs": "Ta, která věří",
      "en": "The Believer"
    },
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 7,
    "clName": {
      "cs": "Léčivý soucit",
      "en": "Healing Compassion"
    },
    "role": {
      "cs": "Učitelka důvěry a spojení",
      "en": "Teacher of trust and connection"
    },
    "location": {
      "cs": "Nebukadnezar, můstek",
      "en": "The Nebuchadnezzar, the bridge"
    },
    "questLine": {
      "cs": "Operátorský kanál",
      "en": "The Operator Link"
    },
    "teaching": {
      "cs": "Víra není slepá. Je to rozhodnutí jít dál bez záruky.",
      "en": "Faith is not blind. It is deciding to go on without a guarantee."
    },
    "ability": {
      "cs": "Spojení s operátorem — najde cestu tam, kde mapa končí.",
      "en": "Operator Link — finds the way where the map ends."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Trinity je v příběhu ta, kdo věří dřív, než existuje důkaz — a v systémech, které stojí na důkazech, je to nejcennější a nejvzácnější role. V OASIS drží spojení tam, kde signál slábne.",
      "en": "Trinity is the one who believes before proof exists — and in systems built on proof that is the most valuable and rarest role. In OASIS she holds the connection where the signal fades."
    },
    "quote": {
      "cs": "Následovala jsem ho, protože mi nelhal o tom, jak to bude bolet.",
      "en": "I followed him because he never lied about how much it would hurt."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/042-trinity.webp",
      "full": "/oasis-assets/concept_svg/042-trinity.svg",
      "final": false
    },
    "circle": "matrix"
  },
  {
    "id": 48,
    "name": "Morpheus",
    "subtitle": {
      "cs": "Průvodce",
      "en": "The Guide"
    },
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 6,
    "clName": {
      "cs": "Intuitivní moudrost",
      "en": "Intuitive Wisdom"
    },
    "role": {
      "cs": "Mentor, který nevodí za ruku",
      "en": "A mentor who does not hold your hand"
    },
    "location": {
      "cs": "Bílý králík, podzemí",
      "en": "The White Rabbit, underground"
    },
    "questLine": {
      "cs": "Červená tableta",
      "en": "The Red Pill"
    },
    "teaching": {
      "cs": "Nemůžu ti dát pravdu. Můžu ti dát jen možnost ji hledat.",
      "en": "I cannot give you the truth. I can only give you the chance to look for it."
    },
    "ability": {
      "cs": "Vidění za iluzí — ukáže skutečný tvar věci.",
      "en": "Vision Behind the Illusion — shows the true shape of a thing."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Morpheus nedává odpovědi, nabízí rozhodnutí. V OASIS je proto učitelem, ke kterému se nechodí pro jistotu, ale pro odvahu udělat krok, který se nedá vzít zpět.",
      "en": "Morpheus does not give answers, he offers a decision. In OASIS he is therefore the teacher you go to not for certainty but for the courage to take a step that cannot be taken back."
    },
    "quote": {
      "cs": "Nabízím ti jen to, co už máš. Rozhodnutí je tvoje.",
      "en": "I offer you only what you already have. The choice is yours."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/043-morpheus.webp",
      "full": "/oasis-assets/concept_svg/043-morpheus.svg",
      "final": false
    },
    "circle": "matrix"
  },
  {
    "id": 50,
    "name": "ZION The Last City",
    "subtitle": {
      "cs": "Poslední město",
      "en": "The Last City"
    },
    "ray": "AllRays",
    "rarity": "Legendary",
    "cl": 7,
    "clName": {
      "cs": "Léčivý soucit",
      "en": "Healing Compassion"
    },
    "role": {
      "cs": "Kolektivní avatar naděje",
      "en": "Collective avatar of hope"
    },
    "location": {
      "cs": "ZION, hloubka 4 km",
      "en": "ZION, four kilometres down"
    },
    "questLine": {
      "cs": "Město, které drží",
      "en": "The City That Holds"
    },
    "teaching": {
      "cs": "Město není budovy. Je to dohoda, že se navzájem nezavřeme.",
      "en": "A city is not buildings. It is an agreement not to lock each other out."
    },
    "ability": {
      "cs": "Kolektivní vědomí — spojí znalosti všech přítomných.",
      "en": "Collective Consciousness — joins the knowledge of everyone present."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "ZION není budova ani značka — je to dohoda, že se navzájem nezavřeme venku. V OASIS je poslední město zároveň testem: poznáš ho podle toho, jestli se v něm lidé chovají jinak, než když je nikdo nevidí.",
      "en": "ZION is neither a building nor a brand — it is an agreement not to lock each other out. In OASIS the last city is also a test: you know it by whether people behave differently there than when no one is watching."
    },
    "quote": {
      "cs": "Jsme poslední město jen proto, že jsme se rozhodli jím být.",
      "en": "We are the last city only because we decided to be."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/044-zion-the-last-city.webp",
      "full": "/oasis-assets/concept_svg/044-zion-the-last-city.svg",
      "final": false
    },
    "circle": "matrix"
  },
  {
    "id": 42,
    "name": "Sri Dattatreya",
    "subtitle": {
      "cs": "Dattátréja",
      "en": "Dattatreya"
    },
    "ray": "AllRays",
    "rarity": "Legendary",
    "cl": 8,
    "clName": {
      "cs": "Transcendence",
      "en": "Transcendent"
    },
    "role": {
      "cs": "Učitel trojí síly",
      "en": "Teacher of the threefold power"
    },
    "location": {
      "cs": "Ústraní v pohoří Sahjádri",
      "en": "A retreat in the Sahyadri hills"
    },
    "questLine": {
      "cs": "Trojí zrcadlo",
      "en": "The Threefold Mirror"
    },
    "teaching": {
      "cs": "Tvořit, udržovat a nechat odejít nejsou tři dovednosti. Je to jeden pohyb.",
      "en": "To create, to sustain and to let go are not three skills. They are one motion."
    },
    "ability": {
      "cs": "Trimúrti — tvoří, drží a rozpouští podle potřeby chvíle.",
      "en": "Trimurti — creates, sustains and dissolves as the moment asks."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Šrí Dattatreja (श्री दत्तात्रेय) je nejúplnější manifestací Božství — jediná bytost, která sjednocuje všechny tři aspekty Trojice (Trimúrti) v jednom těle.",
      "en": "Sri Dattatreya (श्री दत्तात्रेय) is the most complete manifestation of the Divine — the single being who unites all three aspects of the Trinity (Trimurti) in one body."
    },
    "quote": {
      "cs": "Učil jsem se od země, od ohně i od psa. Nikdo z nich mi nedal radu.",
      "en": "I learned from earth, from fire and from a dog. None of them gave me advice."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/045-sri-dattatreya.webp",
      "full": "/oasis-assets/concept_svg/045-sri-dattatreya.svg",
      "final": false
    },
    "circle": "zion"
  },
  {
    "id": 43,
    "name": "Maly Princ",
    "subtitle": {
      "cs": "Malý princ",
      "en": "The Little Prince"
    },
    "ray": "Yellow",
    "rarity": "Rare",
    "cl": 4,
    "clName": {
      "cs": "Otevřené srdce",
      "en": "Heart Opening"
    },
    "role": {
      "cs": "Průvodce vnitřním dítětem",
      "en": "Guide to the inner child"
    },
    "location": {
      "cs": "Planetka B-612",
      "en": "Asteroid B-612"
    },
    "questLine": {
      "cs": "Co je důležité, je neviditelné",
      "en": "What Is Essential Is Invisible"
    },
    "teaching": {
      "cs": "Dospělí mají čísla. Děti mají otázky. Svět drží otázky.",
      "en": "Adults have numbers. Children have questions. The world is held by questions."
    },
    "ability": {
      "cs": "Dětský úžas — uvidíš krásu, kterou dospělí přešli.",
      "en": "Childlike Wonder — you see beauty adults walked past."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Šrí Anagha Lakšmí (श्री अनघा लक्ष्मी) je ženská forma Trimúrti — trojjediná Bohyně, která sjednocuje všechny tři aspekty Božské Matky v jednom těle.",
      "en": "Sri Anagha Lakshmi (श्री अनघा लक्ष्मी) is the feminine form of the Trimurti — the three-in-one Goddess who unites all three aspects of the Divine Mother in one body."
    },
    "quote": {
      "cs": "Správně vidíme jen srdcem.",
      "en": "One sees clearly only with the heart."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/046-maly-princ.webp",
      "full": "/oasis-assets/concept_svg/046-maly-princ.svg",
      "final": false
    },
    "circle": "zion"
  },
  {
    "id": 44,
    "name": "Hiranyagarbha",
    "subtitle": {
      "cs": "Zlaté vejce",
      "en": "The Golden Egg"
    },
    "ray": "AllRays",
    "rarity": "OneOfOne",
    "cl": 9,
    "clName": {
      "cs": "Na hvězdě",
      "en": "On the Star"
    },
    "role": {
      "cs": "Sama skutečnost stvoření",
      "en": "Creation itself"
    },
    "location": {
      "cs": "Před počátkem",
      "en": "Before the beginning"
    },
    "questLine": {
      "cs": "Vejce a vesmír",
      "en": "The Egg and the Universe"
    },
    "teaching": {
      "cs": "Všechno, co existuje, bylo nejdřív jen možností, kterou někdo nepustil.",
      "en": "Everything that exists was first only a possibility someone refused to drop."
    },
    "ability": {
      "cs": "Kosmické znovuzrození — vrátí svět do stavu, kdy se dá začít znovu.",
      "en": "Cosmic Rebirth — returns the world to a state where it can begin again."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Hiranjagarbha (हिरण्यगर्भ) je kosmické vejce — prvotní zlatá koule, ze které vzniklo celé stvoření.",
      "en": "Hiranyagarbha (हिरण्यगर्भ) is the Cosmic Egg — the primordial golden sphere from which all creation emerged."
    },
    "quote": {
      "cs": "Nebyl jsem stvořen. Byl jsem to, z čeho se stvořilo.",
      "en": "I was not created. I was that out of which creation came."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/047-hiranyagarbha.webp",
      "full": "/oasis-assets/concept_svg/047-hiranyagarbha.svg",
      "final": false
    },
    "circle": "zion"
  },
  {
    "id": 45,
    "name": "Sri Kalki Avatar",
    "subtitle": {
      "cs": "Kalkí",
      "en": "Kalki"
    },
    "ray": "Blue",
    "rarity": "Legendary",
    "cl": 8,
    "clName": {
      "cs": "Transcendence",
      "en": "Transcendent"
    },
    "role": {
      "cs": "Budoucí válečník konce věku",
      "en": "The future warrior of the age's end"
    },
    "location": {
      "cs": "Šambala, brána věku",
      "en": "Shambhala, the gate of the age"
    },
    "questLine": {
      "cs": "Meč posledního věku",
      "en": "The Sword of the Last Age"
    },
    "teaching": {
      "cs": "Konec není trest. Je to místo, kde se dá konečně začít.",
      "en": "The end is not a punishment. It is the place where one can finally begin."
    },
    "ability": {
      "cs": "Meč apokalypsy — přesekne karmu, která už nikomu neslouží.",
      "en": "Apocalypse Sword — severs karma that serves no one any more."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Šrí Kalki (श्री कल्कि) je desátá a poslední inkarnace Višnu — avatar, který přichází na konci Kali Jugy (věku temnoty) zničit zlo a obnovit dharmu (spravedlnost).",
      "en": "Sri Kalki (श्री कल्कि) is the tenth and final incarnation of Vishnu — the avatar who comes at the end of Kali Yuga (the Age of Darkness) to destroy evil and restore dharma (righteousness)."
    },
    "quote": {
      "cs": "Nepřicházím soudit. Přicházím uklidit.",
      "en": "I do not come to judge. I come to clear."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/048-sri-kalki-avatar.webp",
      "full": "/oasis-assets/concept_svg/048-sri-kalki-avatar.svg",
      "final": false
    },
    "circle": "zion"
  },
  {
    "id": 40,
    "name": "Elizabet",
    "subtitle": {
      "cs": "Královská léčitelka",
      "en": "Royal Healer"
    },
    "ray": "Pink",
    "rarity": "Rare",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Vůdkyně s otevřenou dlaní",
      "en": "A leader with an open palm"
    },
    "location": {
      "cs": "Dvorní infirmarium, ZION",
      "en": "The court infirmary, ZION"
    },
    "questLine": {
      "cs": "Dekret soucitu",
      "en": "The Decree of Compassion"
    },
    "teaching": {
      "cs": "Vláda, která začíná u lůžka nemocného, vydrží déle než ta, která začíná u trůnu.",
      "en": "A rule that begins at a sickbed lasts longer than one that begins at a throne."
    },
    "ability": {
      "cs": "Královský dekret — přesvědčí i toho, kdo nechce poslouchat.",
      "en": "Royal Decree — persuades even the one who does not want to listen."
    },
    "key": "",
    "quests": [
      {
        "title": "First Awakening",
        "description": "Begin the sacred journey"
      },
      {
        "title": "Path of Dedication",
        "description": "Prove commitment through 7 trials"
      },
      {
        "title": "Sacred Knowledge",
        "description": "Uncover the hidden teaching"
      },
      {
        "title": "Divine Service",
        "description": "Serve the community selflessly"
      },
      {
        "title": "Ultimate Realization",
        "description": "Attain the highest truth"
      }
    ],
    "essence": {
      "cs": "Elizabet, známá v proroctví jako Orákulum, je mystická bytost z daleké budoucnosti — posel Stvořitele vyslaný k lidstvu. Její podstata transcenduje čas a prostor; je kamenným monolitem, který skrývá nesmírnou inteligenci a ženskou energii nebeské krásy.",
      "en": "Elizabet, known in prophecy as the Oracle, is a mystical being from a distant future — a messenger of the Creator sent to humanity. Her essence transcends time and space; she is a stone monolith concealing immense intelligence and the feminine energy of celestial beauty."
    },
    "quote": {
      "cs": "Koruna je jen nástroj. Rozhoduje to, komu ji podáš.",
      "en": "A crown is only a tool. What matters is whom you hand it to."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/049-elizabet.webp",
      "full": "/oasis-assets/concept_svg/049-elizabet.svg",
      "final": false
    },
    "circle": "zion"
  },
  {
    "id": 52,
    "name": "Heȟáka Sápa (Black Elk)",
    "subtitle": {
      "cs": "Heȟáka Sápa — Černý los",
      "en": "Heȟáka Sápa — Black Elk"
    },
    "ray": "AllRays",
    "rarity": "Rare",
    "cl": 4,
    "clName": {
      "cs": "Otevřené srdce",
      "en": "Heart Opening"
    },
    "role": {
      "cs": "Strážce posvátného kruhu a vizí",
      "en": "Keeper of the sacred circle and of visions"
    },
    "location": {
      "cs": "Pahorky Černých hor",
      "en": "The Black Hills"
    },
    "questLine": {
      "cs": "Vize, která patří všem",
      "en": "The Vision That Belongs to All"
    },
    "teaching": {
      "cs": "Vize není tvoje. Dostal jsi ji proto, abys ji předal.",
      "en": "A vision is not yours. You were given it so you could pass it on."
    },
    "ability": {
      "cs": "Vizní pouť — přinese odpověď, kterou jsi sám neuměl vyslovit.",
      "en": "Vision Quest — brings an answer you could not put into words."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Heȟáka Sápa (Černý Loš, Oglala Lakota, 1863–1950) je archetyp vizionáře, který nesl Velkou Vizi šesti prarodičů. V ZION OASIS není kopie konkrétní osoby — je stylizovaný průvodce kruhem, směry a předky.",
      "en": "Heȟáka Sápa (Black Elk, Oglala Lakota, 1863–1950) is the archetype of the visionary who carried the Great Vision of the six grandfathers. In ZION OASIS he is not a copy of the historical person — he is a stylized guide through the circle, the directions, and the ancestors."
    },
    "quote": {
      "cs": "Kruh se nezavře tím, že stojíš uprostřed.",
      "en": "The circle does not close because you stand in the middle."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/050-hehaka-sapa-black-elk.webp",
      "full": "/oasis-assets/concept_svg/050-hehaka-sapa-black-elk.svg",
      "final": false
    },
    "circle": "first-nations"
  },
  {
    "id": 53,
    "name": "Ptesáŋ Wíŋ (White Buffalo Calf Woman)",
    "subtitle": {
      "cs": "Ptesáŋ Wíŋ — Bílá bizonice",
      "en": "Ptesáŋ Wíŋ — White Buffalo Calf Woman"
    },
    "ray": "AllRays",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která přinesla posvátný obřad",
      "en": "She who brought the sacred rite"
    },
    "location": {
      "cs": "Prérie u Černých hor",
      "en": "The prairie by the Black Hills"
    },
    "questLine": {
      "cs": "Dýmka a slib",
      "en": "The Pipe and the Promise"
    },
    "teaching": {
      "cs": "Dar, který si necháš, se změní v dluh.",
      "en": "A gift you keep for yourself turns into a debt."
    },
    "ability": {
      "cs": "Požehnání dýmky — uklidní spor dřív, než se rozhoří.",
      "en": "Blessing of the Pipe — calms a conflict before it catches."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ptesáŋ Wíŋ je mýtická bytost, ne historická osoba — posvátná poselkyně, jež dává Posvátnou dýmku a učí sedm svatých obřadů. V OASIS je mentorkou krize a transformace.",
      "en": "Ptesáŋ Wíŋ is a mythical being, not a historical person — the sacred messenger who gives the Sacred Pipe and teaches the seven holy rites. In OASIS she is the mentor of crisis and transformation."
    },
    "quote": {
      "cs": "Přicházím jednou za sedm generací. Vy se musíte domluvit mezitím.",
      "en": "I come once in seven generations. You must agree in between."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/051-ptesa-wi-white-buffalo-calf-woman.webp",
      "full": "/oasis-assets/concept_svg/051-ptesa-wi-white-buffalo-calf-woman.svg",
      "final": false
    },
    "circle": "first-nations"
  },
  {
    "id": 54,
    "name": "Kókyangwúti (Spider Grandmother)",
    "subtitle": {
      "cs": "Kókyangwúti — Babička pavouk",
      "en": "Kókyangwúti — Spider Grandmother"
    },
    "ray": "Yellow",
    "rarity": "Legendary",
    "cl": 7,
    "clName": {
      "cs": "Léčivý soucit",
      "en": "Healing Compassion"
    },
    "role": {
      "cs": "Tkadlena sítí a spojenectví",
      "en": "Weaver of webs and alliances"
    },
    "location": {
      "cs": "Prastará tkalcovská jeskyně",
      "en": "The ancient weaving cave"
    },
    "questLine": {
      "cs": "Nit, která se nepřetrhne",
      "en": "The Thread That Does Not Break"
    },
    "teaching": {
      "cs": "Síť drží proto, že se každé vlákno může pohnout.",
      "en": "A web holds because every strand is allowed to move."
    },
    "ability": {
      "cs": "Tkání spojenectví — propojí dvě vzdálené cesty v jednu.",
      "en": "Weaving Alliances — joins two distant paths into one."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Kókyangwúti (Spider Grandmother) je archetypální strážkyně tkaní reality — v OASIS propojuje questy, aliance a léčí rozdělení mezi frakcemi.",
      "en": "Kókyangwúti (Spider Grandmother) is the archetypal guardian of the weaving of reality — in OASIS she links quests and alliances and heals divisions between factions."
    },
    "quote": {
      "cs": "Netkám proto, abych chytala. Tkám proto, aby se dalo projít.",
      "en": "I do not weave to catch. I weave so that one can pass."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/052-kokyangwuti-spider-grandmother.webp",
      "full": "/oasis-assets/concept_svg/052-kokyangwuti-spider-grandmother.svg",
      "final": false
    },
    "circle": "first-nations"
  },
  {
    "id": 55,
    "name": "Hunahpú & Xbalanqué (Hero Twins)",
    "subtitle": {
      "cs": "Hunahpú a Xbalanqué",
      "en": "Hunahpú and Xbalanqué"
    },
    "ray": "Blue",
    "rarity": "Legendary",
    "cl": 3,
    "clName": {
      "cs": "Mysl",
      "en": "Mind"
    },
    "role": {
      "cs": "Dvojčata, která projdou podsvětím",
      "en": "Twins who walk the underworld"
    },
    "location": {
      "cs": "Xibalba, hřiště bohů",
      "en": "Xibalba, the ballcourt of the gods"
    },
    "questLine": {
      "cs": "Hra, kterou nelze vyhrát silou",
      "en": "The Game You Cannot Win by Force"
    },
    "teaching": {
      "cs": "Podsvětí se neporáží mečem, ale tím, že přežiješ jeho pravidla.",
      "en": "The underworld is not beaten with a sword, but by outliving its rules."
    },
    "ability": {
      "cs": "Dvojí trik — odhalí slabinu, kterou strážce skrývá.",
      "en": "Twin Trick — exposes the weakness the guardian hides."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Hunahpú a Xbalanqué jsou dvojice — hrdinové Popol Vuh, kteří sestupují do Xibalby a vítězí lstí a rozpoznáním, ne holou silou.",
      "en": "Hunahpú and Xbalanqué are a pair — the Hero Twins of the Popol Vuh who descend into Xibalba and win through cunning and discernment, not brute strength."
    },
    "quote": {
      "cs": "Oni hráli o naše hlavy. My jsme hráli o jejich pozornost.",
      "en": "They played for our heads. We played for their attention."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/053-hunahpu-xbalanque-hero-twins.webp",
      "full": "/oasis-assets/concept_svg/053-hunahpu-xbalanque-hero-twins.svg",
      "final": false
    },
    "circle": "first-nations"
  },
  {
    "id": 56,
    "name": "Don Mariano",
    "subtitle": {
      "cs": "Don Mariano",
      "en": "Don Mariano"
    },
    "ray": "White",
    "rarity": "Epic",
    "cl": 4,
    "clName": {
      "cs": "Otevřené srdce",
      "en": "Heart Opening"
    },
    "role": {
      "cs": "Mluvčí hor a učitel vzájemnosti",
      "en": "Speaker for the mountains, teacher of reciprocity"
    },
    "location": {
      "cs": "Andy, údolí Q'ero",
      "en": "The Andes, the Q'ero valley"
    },
    "questLine": {
      "cs": "Ayni — dávat dřív, než si vezmeš",
      "en": "Ayni — Give Before You Take"
    },
    "teaching": {
      "cs": "Hora ti dá vodu jen tehdy, když se k ní chováš jako k příbuzné.",
      "en": "The mountain gives water only when you treat it as kin."
    },
    "ability": {
      "cs": "Volání Apu — přivolá pomoc země tam, kde chybí voda.",
      "en": "Call of the Apu — asks the land for help where water is missing."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Don Mariano je stylizovaný archetyp altomesayoq — mluvčí Apukun (duchů hor), učitel ayni (vzájemnosti) a vrstev Pachy.",
      "en": "Don Mariano is a stylized archetype of the altomesayoq — speaker for the Apukuna (mountain spirits), teacher of ayni (reciprocity) and the layers of Pacha."
    },
    "quote": {
      "cs": "Neprosíme. Děkujeme předem.",
      "en": "We do not beg. We give thanks in advance."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/054-don-mariano.webp",
      "full": "/oasis-assets/concept_svg/054-don-mariano.svg",
      "final": false
    },
    "circle": "first-nations"
  },
  {
    "id": 57,
    "name": "Doña Rosalía Ixmukané",
    "subtitle": {
      "cs": "Doña Rosalía Ixmukané",
      "en": "Doña Rosalía Ixmukané"
    },
    "ray": "Yellow",
    "rarity": "Epic",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Strážkyně ústně předávané paměti",
      "en": "Keeper of oral memory"
    },
    "location": {
      "cs": "Vysočina Guatemaly",
      "en": "The Guatemalan highlands"
    },
    "questLine": {
      "cs": "Kniha, která se učí zpaměti",
      "en": "The Book Learned by Heart"
    },
    "teaching": {
      "cs": "Co se naučíš zpaměti, to ti nikdo nesebere.",
      "en": "What you learn by heart, no one can take from you."
    },
    "ability": {
      "cs": "Vyvolání předků — na chvíli promluví ten, kdo už mlčel.",
      "en": "Summoning the Ancestors — briefly, one who had fallen silent speaks."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Doña Rosalía je kompozit moderních chilam balam žen — strážkyně ústní paměti Popol Vuh a most mezi chrámem Santo Tomás a tržnicí, kde se příběh setkává se životem.",
      "en": "Doña Rosalía is a composite of modern chilam balam women — keeper of the oral memory of the Popol Vuh and a bridge between the Santo Tomás temple and the marketplace where story meets life."
    },
    "quote": {
      "cs": "Papír hoří. Vyprávění jde dál.",
      "en": "Paper burns. The telling goes on."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/055-dona-rosalia-ixmukane.webp",
      "full": "/oasis-assets/concept_svg/055-dona-rosalia-ixmukane.svg",
      "final": false
    },
    "circle": "first-nations"
  },
  {
    "id": 58,
    "name": "Bílé Pero (White Feather)",
    "subtitle": {
      "cs": "Bílé Pero",
      "en": "White Feather"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 6,
    "clName": {
      "cs": "Intuitivní moudrost",
      "en": "Intuitive Wisdom"
    },
    "role": {
      "cs": "Ten, kdo rozliší pravý a falešný příslib",
      "en": "The one who tells a true promise from a false one"
    },
    "location": {
      "cs": "Kamenná tabule, Hopi",
      "en": "The stone tablet, Hopi"
    },
    "questLine": {
      "cs": "Pravý a falešný Pahana",
      "en": "True and False Pahana"
    },
    "teaching": {
      "cs": "Falešný příslib vždy spěchá. Pravý má čas.",
      "en": "A false promise is always in a hurry. A true one has time."
    },
    "ability": {
      "cs": "Zrak Pahana — pozná, kdo přišel pomoct a kdo přišel vzít.",
      "en": "Pahana Sight — you see who came to help and who came to take."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Bílé Pero odkazuje na Hopi proroctví a kamennou tabulku — archetyp strážce, který rozlišuje pravého Pahánu od falešného.",
      "en": "White Feather refers to the Hopi prophecy and the stone tablet — the archetype of a guardian who distinguishes the true Pahána from the false one."
    },
    "quote": {
      "cs": "Neptej se, co slibuje. Podívej se, co už dal.",
      "en": "Do not ask what he promises. Look at what he has already given."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/056-bile-pero-white-feather.webp",
      "full": "/oasis-assets/concept_svg/056-bile-pero-white-feather.svg",
      "final": false
    },
    "circle": "first-nations"
  },
  {
    "id": 59,
    "name": "Ohnivá Oka (Fire Eyes)",
    "subtitle": {
      "cs": "Ohnivá Oka",
      "en": "Fire Eyes"
    },
    "ray": "RubyGold",
    "rarity": "Epic",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Prorok duhového válečníka",
      "en": "Prophet of the rainbow warrior"
    },
    "location": {
      "cs": "Poušť, kde se sbíhají cesty",
      "en": "The desert where the roads meet"
    },
    "questLine": {
      "cs": "Duhový válečník",
      "en": "Rainbow Warrior"
    },
    "teaching": {
      "cs": "Síla, která ničí, není statečnost. Statečnost je postavit se a neuhnout.",
      "en": "Power that destroys is not courage. Courage is to stand and not flinch."
    },
    "ability": {
      "cs": "Žár duhy — dodá odvahu celé skupině na jednu rozhodující chvíli.",
      "en": "Rainbow Blaze — gives the whole group courage for one decisive moment."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ohnivá Oka je archetyp šamanky spojený s vizí Lee Browna (1994) a proroctvím Rainbow Warriors — v OASIS gilda/titul pro hráče žijící sedm pravidel.",
      "en": "Ohnivá Oka is a shamaness archetype linked to Lee Brown's 1994 vision and the Rainbow Warriors prophecy — in OASIS a guild/title for players living the seven rules."
    },
    "quote": {
      "cs": "Přijdou děti, kterým nikdo nevěřil. Ty to spraví.",
      "en": "Children no one believed in will come. They will mend it."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/057-ohniva-oka-fire-eyes.webp",
      "full": "/oasis-assets/concept_svg/057-ohniva-oka-fire-eyes.svg",
      "final": false
    },
    "circle": "first-nations"
  },
  {
    "id": 60,
    "name": "Davi Kopenawa",
    "subtitle": {
      "cs": "Davi Kopenawa",
      "en": "Davi Kopenawa"
    },
    "ray": "AllRays",
    "rarity": "Epic",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Mluvčí duchů lesa",
      "en": "Speaker for the spirits of the forest"
    },
    "location": {
      "cs": "Yanomami, horní tok Amazonky",
      "en": "Yanomami, upper Amazon"
    },
    "questLine": {
      "cs": "Sen, který varuje",
      "en": "The Dream That Warns"
    },
    "teaching": {
      "cs": "Les neumírá potichu. Nejdřív se mu zdají špatné sny.",
      "en": "The forest does not die quietly. First it dreams badly."
    },
    "ability": {
      "cs": "Obrácený sen — uvidíš důsledek dřív, než nastane.",
      "en": "Dream Reversal — you see the consequence before it happens."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Davi Kopenawa jako žijící referenční inspirace — v OASIS stylizovaný průvodce tradicí xapiri a knihy The Falling Sky; respekt k zemi a vodě Yanomamiů.",
      "en": "Davi Kopenawa as a living referential inspiration — in OASIS a stylized guide to the xapiri tradition and the book The Falling Sky; respect for Yanomami land and water."
    },
    "quote": {
      "cs": "Nejsme ochránci přírody. Jsme její příbuzní.",
      "en": "We are not guardians of nature. We are its relatives."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/058-davi-kopenawa.webp",
      "full": "/oasis-assets/concept_svg/058-davi-kopenawa.svg",
      "final": false
    },
    "circle": "first-nations"
  },
  {
    "id": 61,
    "name": "Heyókȟa (Sacred Clown)",
    "subtitle": {
      "cs": "Heyókȟa — Posvátný šašek",
      "en": "Heyókȟa — Sacred Clown"
    },
    "ray": "AllRays",
    "rarity": "Legendary",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo učí smíchem proti egu",
      "en": "The one who teaches through laughter against the ego"
    },
    "location": {
      "cs": "Tábor uprostřed pláně",
      "en": "A camp in the middle of the plain"
    },
    "questLine": {
      "cs": "Všechno obráceně",
      "en": "Everything Backwards"
    },
    "teaching": {
      "cs": "Kdo se neumí smát sám sobě, bude se bát celý život.",
      "en": "Whoever cannot laugh at themselves will be afraid all their life."
    },
    "ability": {
      "cs": "Obrácená logika — na chvíli vypne pravidla, která nikomu neslouží.",
      "en": "Reverse Logic — briefly switches off rules that serve no one."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Heyókȟa dělá všechno obráceně proto, aby ostatní viděli, co dělají samozřejmě. V OASIS chrání komunitu před tím nejtišším nebezpečím: před tím, že si zvykne na něco, co už nedává smysl.",
      "en": "Heyókȟa does everything backwards so that others can see what they do automatically. In OASIS he protects the community from the quietest danger: getting used to something that no longer makes sense."
    },
    "quote": {
      "cs": "Moudrý mluví vážně. Šašek mluví pravdu.",
      "en": "The wise speak gravely. The clown speaks the truth."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/059-heyokha-sacred-clown.webp",
      "full": "/oasis-assets/concept_svg/059-heyokha-sacred-clown.svg",
      "final": false
    },
    "circle": "first-nations"
  },
  {
    "id": 62,
    "name": "Lā'ila'i",
    "subtitle": {
      "cs": "Lā'ilaʻi — První žena",
      "en": "Lā'ilaʻi — First Woman"
    },
    "ray": "AllRays",
    "rarity": "Rare",
    "cl": 3,
    "clName": {
      "cs": "Mysl",
      "en": "Mind"
    },
    "role": {
      "cs": "Ta, která drží linii rodu",
      "en": "She who holds the lineage"
    },
    "location": {
      "cs": "Úsvit na Havaji",
      "en": "Dawn in Hawaiʻi"
    },
    "questLine": {
      "cs": "Tři linie",
      "en": "The Three Lineages"
    },
    "teaching": {
      "cs": "Nejsi začátek. Jsi pokračování někoho, kdo to nevzdal.",
      "en": "You are not a beginning. You are the continuation of someone who did not give up."
    },
    "ability": {
      "cs": "Čtení linie — ukáže, odkud kdo přišel a co nese dál.",
      "en": "Lineage Tracing — shows where someone comes from and what they carry."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Lāʻilaʻi stojí na začátku tří linií a její úkol není vládnout, ale neztratit nit. V OASIS připomíná, že tradice není kámen, který se hlídá, ale řeka, která se musí předávat dál.",
      "en": "Lāʻilaʻi stands at the beginning of three lineages, and her task is not to rule but not to lose the thread. In OASIS she reminds us that tradition is not a stone to guard but a river that must be passed on."
    },
    "quote": {
      "cs": "Moje jméno není moje. Je to jméno těch přede mnou.",
      "en": "My name is not mine. It is the name of those before me."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/060-la-ila-i.webp",
      "full": "/oasis-assets/concept_svg/060-la-ila-i.svg",
      "final": false
    },
    "circle": "pacific"
  },
  {
    "id": 63,
    "name": "Pele",
    "subtitle": {
      "cs": "Pele",
      "en": "Pele"
    },
    "ray": "Violet",
    "rarity": "Legendary",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Ta, která tvoří tím, že spálí",
      "en": "She who creates by burning"
    },
    "location": {
      "cs": "Kilauea, ostrov Havaj",
      "en": "Kīlauea, Hawaiʻi"
    },
    "questLine": {
      "cs": "Oheň, který připraví půdu",
      "en": "The Fire That Prepares the Ground"
    },
    "teaching": {
      "cs": "Někdy musí shořet, co už nedrží, aby bylo kde stavět.",
      "en": "Sometimes what no longer holds must burn so there is ground to build on."
    },
    "ability": {
      "cs": "Vulkanické znovuzrození — spálí staré a nechá úrodnou zemi.",
      "en": "Volcanic Rebirth — burns the old and leaves fertile ground."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Pele je v havajském kánonu bohyně, která tvoří tím, že spálí — ne z krutosti, ale protože ostrov jinak nevznikne. V OASIS učí, že některé staré věci musí shořet, aby na jejich místě bylo možné postavit něco obyvatelného.",
      "en": "Pele in Hawaiian canon is the goddess who creates by burning — not out of cruelty, but because the island would not exist otherwise. In OASIS she teaches that some old things must burn so something habitable can be built in their place."
    },
    "quote": {
      "cs": "Nejsem zlá. Jen nespěchám s vysvětlováním.",
      "en": "I am not cruel. I simply do not hurry to explain."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/061-pele.webp",
      "full": "/oasis-assets/concept_svg/061-pele.svg",
      "final": false
    },
    "circle": "pacific"
  },
  {
    "id": 64,
    "name": "Hiʻiaka",
    "subtitle": {
      "cs": "Hiʻiaka",
      "en": "Hiʻiaka"
    },
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Učitelka tance a uzdravení",
      "en": "Teacher of dance and healing"
    },
    "location": {
      "cs": "Pobřeží Kauai",
      "en": "The coast of Kauaʻi"
    },
    "questLine": {
      "cs": "Tanec, který probouzí",
      "en": "The Dance That Wakes"
    },
    "teaching": {
      "cs": "Tělo si pamatuje, co slova přeskočila.",
      "en": "The body remembers what words skipped over."
    },
    "ability": {
      "cs": "Léčivý tanec — vrátí sílu jednomu člověku v pravý čas.",
      "en": "Healing Dance — returns strength to one person at the right time."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Hiʻiaka putuje mezi ostrovy, aby přivedla zpátky to, co bylo odneseno. V OASIS je léčitelnou vzpomínkou na to, že tělo si pamatuje i to, co slovy přeskočíš — a tanec to umí vrátit.",
      "en": "Hiʻiaka travels between islands to bring back what was taken. In OASIS she is the healing memory that the body remembers even what words skip over — and that dance can bring it back."
    },
    "quote": {
      "cs": "Nesnažím se tě rozveselit. Chci, abys zase cítil.",
      "en": "I am not trying to cheer you up. I want you to feel again."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/062-hiiaka.webp",
      "full": "/oasis-assets/concept_svg/062-hiiaka.svg",
      "final": false
    },
    "circle": "pacific"
  },
  {
    "id": 65,
    "name": "Kāne",
    "subtitle": {
      "cs": "Kāne",
      "en": "Kāne"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 7,
    "clName": {
      "cs": "Léčivý soucit",
      "en": "Healing Compassion"
    },
    "role": {
      "cs": "Princip vzniku, který se nevnucuje",
      "en": "The principle of beginning that does not intrude"
    },
    "location": {
      "cs": "Pramen, kde začíná voda",
      "en": "The spring where water begins"
    },
    "questLine": {
      "cs": "První kapka",
      "en": "The First Drop"
    },
    "teaching": {
      "cs": "Vzniká se tiše. Hluk dělají jen ti, kdo přicházejí pozdě.",
      "en": "Creation is quiet. Only those who arrive late make noise."
    },
    "ability": {
      "cs": "Přítomnost vzniku — otevře místo, které ještě neexistovalo.",
      "en": "Presence of Genesis — opens a place that did not yet exist."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Typ: environmentální / eventová přítomnost (žádné hráčské vlastnictví). Dosah: server-wide. Cooldown: pouze sezónní / komunitní události.",
      "en": "Type: environmental / event presence (no player ownership). Reach: server-wide. Cooldown: seasonal / community events only."
    },
    "quote": {
      "cs": "Neříkám, co má být. Dávám tomu, co je, prostor.",
      "en": "I do not say what should be. I give space to what is."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/063-kane.webp",
      "full": "/oasis-assets/concept_svg/063-kane.svg",
      "final": false
    },
    "circle": "pacific"
  },
  {
    "id": 66,
    "name": "Kanaloa",
    "subtitle": {
      "cs": "Kanaloa",
      "en": "Kanaloa"
    },
    "ray": "Blue",
    "rarity": "Legendary",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Strážce toku many",
      "en": "Keeper of the flow of mana"
    },
    "location": {
      "cs": "Hlubina mezi ostrovy",
      "en": "The deep between the islands"
    },
    "questLine": {
      "cs": "Voda se nedrží",
      "en": "Water Is Not Held"
    },
    "teaching": {
      "cs": "Síla, která se zastaví, začne hnít.",
      "en": "Power that stops moving begins to rot."
    },
    "ability": {
      "cs": "Tok many — přerozdělí sílu tam, kde chybí.",
      "en": "Mana Flow — redistributes strength where it is missing."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Kanaloa je pán hlubiny — ta část světa, kam se nedá dohlédnout a která přesto rozhoduje. V OASIS učí, že síla, která se přestane pohybovat, začne hnít, i když ji držíš v bezpečí.",
      "en": "Kanaloa is the lord of the deep — the part of the world you cannot see into and that decides nonetheless. In OASIS he teaches that power which stops moving begins to rot, even if you keep it safe."
    },
    "quote": {
      "cs": "Neptám se, čí to je. Ptám se, kde to chybí.",
      "en": "I do not ask whose it is. I ask where it is missing."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/064-kanaloa.webp",
      "full": "/oasis-assets/concept_svg/064-kanaloa.svg",
      "final": false
    },
    "circle": "pacific"
  },
  {
    "id": 67,
    "name": "Kū",
    "subtitle": {
      "cs": "Kū",
      "en": "Kū"
    },
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 2,
    "clName": {
      "cs": "Emoce",
      "en": "Emotion"
    },
    "role": {
      "cs": "Učitel vytrvalosti a poctivé práce",
      "en": "Teacher of endurance and honest work"
    },
    "location": {
      "cs": "Kamenná terasa, kde se staví",
      "en": "The stone terrace where things are built"
    },
    "questLine": {
      "cs": "Kámen po kameni",
      "en": "Stone by Stone"
    },
    "teaching": {
      "cs": "Práce, kterou nikdo nevidí, drží všechno, co je vidět.",
      "en": "The work no one sees holds up everything that is seen."
    },
    "ability": {
      "cs": "Požehnání vytrvalosti — vydržíš o den déle než únava.",
      "en": "Endurance Blessing — you last one day longer than exhaustion."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Kū znamená stát vzpřímeně a vytrvat, i když se nikdo nedívá. V OASIS je patronem té neviditelné práce, která drží všechno ostatní — a kterou lidé ocení, až když chybí.",
      "en": "Kū means to stand upright and endure even when no one is watching. In OASIS he is the patron of the invisible work that holds everything else up — and which people appreciate only when it stops."
    },
    "quote": {
      "cs": "Nedělám zázraky. Dělám to každý den.",
      "en": "I do not perform miracles. I do it every day."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/065-ku.webp",
      "full": "/oasis-assets/concept_svg/065-ku.svg",
      "final": false
    },
    "circle": "pacific"
  },
  {
    "id": 68,
    "name": "Lono",
    "subtitle": {
      "cs": "Lono",
      "en": "Lono"
    },
    "ray": "Green",
    "rarity": "Legendary",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Strážce hojnosti a příměří",
      "en": "Keeper of abundance and truce"
    },
    "location": {
      "cs": "Pole před sklizní",
      "en": "The field before harvest"
    },
    "questLine": {
      "cs": "Makahiki — čas, kdy se neválčí",
      "en": "Makahiki — The Season of No War"
    },
    "teaching": {
      "cs": "Hojnost je chvíle, kdy se dělí. Ne když se hromadí.",
      "en": "Abundance is the moment when it is shared. Not when it is piled up."
    },
    "ability": {
      "cs": "Makahiki — vyhlásí příměří a rozdělí úrodu.",
      "en": "Makahiki — declares a truce and shares the harvest."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Lono přináší období, ve kterém se neválčí, a úrodu, která se rozděluje. V OASIS je připomínkou, že hojnost není chvíle, kdy máš nejvíc, ale chvíle, kdy je co dát.",
      "en": "Lono brings the season in which no one fights, and a harvest that is shared. In OASIS he is the reminder that abundance is not the moment you have the most, but the moment there is something to give."
    },
    "quote": {
      "cs": "Rok má čtyři měsíce, kdy se nemá bojovat. Zapomněli jste na ně.",
      "en": "The year has four months when no one should fight. You forgot them."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/066-lono.webp",
      "full": "/oasis-assets/concept_svg/066-lono.svg",
      "final": false
    },
    "circle": "pacific"
  },
  {
    "id": 69,
    "name": "Stará Kumu Lehua",
    "subtitle": {
      "cs": "Stará Kumu Lehua",
      "en": "Old Kumu Lehua"
    },
    "ray": "Yellow",
    "rarity": "Epic",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Babička, která vypráví napříč tradicemi",
      "en": "The grandmother who tells across traditions"
    },
    "location": {
      "cs": "Dům na konci vesnice",
      "en": "A house at the end of the village"
    },
    "questLine": {
      "cs": "Příběh, který se neptá na původ",
      "en": "The Story That Asks No Origin"
    },
    "teaching": {
      "cs": "Příběh nemá národnost. Má jen to, jestli ho někdo předá dál.",
      "en": "A story has no nationality. It only has whether someone passes it on."
    },
    "ability": {
      "cs": "Příběhová brána — otevře cestu tam, kde chybí smysl.",
      "en": "Story Gate — opens a way where meaning is missing."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Stará Kumu Lehua je složená babička více tradic — a právě proto jí nikdo nevnucuje jediný výklad. V OASIS je učitelkou, která nezačíná poučováním, ale tím, že se nejdřív nají a pak se ptá.",
      "en": "Old Kumu Lehua is a grandmother composed of several traditions — and precisely for that no one forces a single reading on her. In OASIS she is the teacher who begins not with a lesson but with eating first and asking afterwards."
    },
    "quote": {
      "cs": "Sedni si. Nejdřív se jí, pak se ptá.",
      "en": "Sit down. First we eat, then we ask."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/067-stara-kumu-lehua.webp",
      "full": "/oasis-assets/concept_svg/067-stara-kumu-lehua.svg",
      "final": false
    },
    "circle": "pacific"
  },
  {
    "id": 70,
    "name": "Hina",
    "subtitle": {
      "cs": "Hina",
      "en": "Hina"
    },
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 4,
    "clName": {
      "cs": "Otevřené srdce",
      "en": "Heart Opening"
    },
    "role": {
      "cs": "Strážkyně měsíce a času",
      "en": "Keeper of the moon and of time"
    },
    "location": {
      "cs": "Měsíční útes",
      "en": "The moon cliff"
    },
    "questLine": {
      "cs": "Rytmus, který se opakuje",
      "en": "The Rhythm That Returns"
    },
    "teaching": {
      "cs": "Nic není ztraceno, jen se to vrátí v jiné fázi.",
      "en": "Nothing is lost; it merely returns in another phase."
    },
    "ability": {
      "cs": "Měsíční cyklus — v pravý čas zesílí to, co děláš.",
      "en": "Lunar Cycle — at the right hour, what you do grows stronger."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Hina tká a odměřuje noc — drží rytmus, který se nikdy nezpozdí a nikdy nespěchá. V OASIS chrání před tím, co lidské systémy dělají nejčastěji: spletou si rychlost s pokrokem.",
      "en": "Hina weaves and measures the night — she keeps a rhythm that is never late and never hurries. In OASIS she guards against what human systems do most often: mistaking speed for progress."
    },
    "quote": {
      "cs": "Nespěchej. Měsíc taky nikdy nespěchá a vrací se přesně.",
      "en": "Do not hurry. The moon never hurries either, and returns exactly."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/068-hina.webp",
      "full": "/oasis-assets/concept_svg/068-hina.svg",
      "final": false
    },
    "circle": "pacific"
  },
  {
    "id": 71,
    "name": "Maui",
    "subtitle": {
      "cs": "Maui",
      "en": "Maui"
    },
    "ray": "Yellow",
    "rarity": "Legendary",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Trikster, který nachází cestu bez boje",
      "en": "The trickster who finds a way without a fight"
    },
    "location": {
      "cs": "Moře mezi ostrovy",
      "en": "The sea between the islands"
    },
    "questLine": {
      "cs": "Ulovit slunce",
      "en": "To Catch the Sun"
    },
    "teaching": {
      "cs": "Nejsilnější soupeř má vždycky jednu slabinu: spěch.",
      "en": "The strongest opponent always has one weakness: haste."
    },
    "ability": {
      "cs": "Triksterská výhra — zvítězíš nad silnějším bez rány.",
      "en": "Trickster Win — defeat a stronger foe without a blow."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Maui je polobůh havajské a širší polynéské mytologie, syn Hina a tvůrce nebeských i pozemských divů. Zrozen jako kupua — bytost s nadřazenými silami, ale stále spjatá s lidskými vášněmi. V ZION OASIS představuje pružnou odvahu, vynalézavost a hluboké spojení s oceánem i nebesy. Není dokonalý hrdina — je tricksterem, který svými chybami učí.",
      "en": "Maui is a demigod of Hawaiian and wider Polynesian mythology, son of Hina and maker of celestial and earthly wonders. Born a kupua — a being with supernormal powers still bound to human passions. In ZION OASIS he embodies resilient courage, resourcefulness and deep connection with ocean and sky. He is no perfect hero — he is a trickster who teaches through his mistakes."
    },
    "quote": {
      "cs": "Nepotřebuju být silnější. Potřebuju být rychlejší v hlavě.",
      "en": "I do not need to be stronger. I need to be faster in the head."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/069-maui.webp",
      "full": "/oasis-assets/concept_svg/069-maui.svg",
      "final": false
    },
    "circle": "pacific"
  },
  {
    "id": 72,
    "name": "Padmasambhava",
    "subtitle": {
      "cs": "Padmasambhava — Guru Rinpočhe",
      "en": "Padmasambhava — Guru Rinpoche"
    },
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Ten, kdo ukryl učení pro pozdější dobu",
      "en": "He who hid teachings for a later age"
    },
    "location": {
      "cs": "Jeskyně v údolí Paro",
      "en": "A cave in the Paro valley"
    },
    "questLine": {
      "cs": "Skrytý poklad",
      "en": "The Hidden Treasure"
    },
    "teaching": {
      "cs": "Některé pravdy se nemají říct dřív, než je někdo unese.",
      "en": "Some truths should not be spoken before someone can carry them."
    },
    "ability": {
      "cs": "Nalezení termy — odemkne učení ukryté v pravý čas.",
      "en": "Terma Discovery — unlocks a teaching hidden for the right time."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Padmasambhava, zvaný též Guru Rinpočhe („drahocenný mistr“), je buddhistický mistr, který v 8. století přivezl Vadžrajánu do Tibetu. Zrozen z lotosu bez lidských rodičů v zemi Oddijána, inkarnace Buddhovy moudrosti. V ZION OASIS je archetypem transformace — toho, co přetaví temnotu na osvícení. Nepopírá stín, ale tančí s ním.",
      "en": "Padmasambhava, also called Guru Rinpoche ('Precious Master'), is the Buddhist master who brought Vajrayana to Tibet in the 8th century. Born from a lotus without human parents in the land of Oddiyana, an incarnation of the Buddha's wisdom. In ZION OASIS he is the archetype of transformation — of what melts darkness into awakening. He does not deny the shadow; he dances with it."
    },
    "quote": {
      "cs": "Neschoval jsem to před tebou. Schoval jsem to pro tebe.",
      "en": "I did not hide it from you. I hid it for you."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/070-padmasambhava.webp",
      "full": "/oasis-assets/concept_svg/070-padmasambhava.svg",
      "final": false
    },
    "circle": "tibet"
  },
  {
    "id": 73,
    "name": "Milarepa",
    "subtitle": {
      "cs": "Milarepa",
      "en": "Milarepa"
    },
    "ray": "Yellow",
    "rarity": "Epic",
    "cl": 4,
    "clName": {
      "cs": "Otevřené srdce",
      "en": "Heart Opening"
    },
    "role": {
      "cs": "Ten, kdo se změnil vlastní písní",
      "en": "He who changed through his own song"
    },
    "location": {
      "cs": "Jeskyně v Himálaji",
      "en": "A Himalayan cave"
    },
    "questLine": {
      "cs": "Píseň, která obrací",
      "en": "The Song That Turns"
    },
    "teaching": {
      "cs": "Nejde o to nebýt vinen. Jde o to neopakovat to.",
      "en": "It is not about being innocent. It is about not repeating it."
    },
    "ability": {
      "cs": "Píseň prozření — smyje tíhu, kterou jsi nesl roky.",
      "en": "Song of Realization — washes off the weight you carried for years."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Milarepa („Mila, zářící ve sluchu“) je tibetský yogi, básník a světec, který dosáhl osvícení v jednom životě navzdory strašlivé minulosti. Původně se vyučil černé magii, aby pomstil matku, později podstoupil extrémní asketismus pod mistrem Marpou. V ZION OASIS ztělesňuje možnost proměny — z vraha světcem. Patron těch, kteří nesou těžkou karmu.",
      "en": "Milarepa ('Mila, radiant in hearing') is a Tibetan yogi, poet and saint who attained enlightenment in a single lifetime despite a terrible past. He first trained in black magic to avenge his mother, then underwent extreme asceticism under Master Marpa. In ZION OASIS he embodies the possibility of transformation — from murderer to saint. Patron of those carrying heavy karma."
    },
    "quote": {
      "cs": "Bál jsem se pekla. Pak jsem potkal svou mysl.",
      "en": "I feared hell. Then I met my own mind."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/071-milarepa.webp",
      "full": "/oasis-assets/concept_svg/071-milarepa.svg",
      "final": false
    },
    "circle": "tibet"
  },
  {
    "id": 74,
    "name": "Tsongkhapa",
    "subtitle": {
      "cs": "Congkhapa",
      "en": "Tsongkhapa"
    },
    "ray": "Yellow",
    "rarity": "Epic",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Učitel pořádku a studia",
      "en": "Teacher of order and study"
    },
    "location": {
      "cs": "Klášter Ganden",
      "en": "Ganden Monastery"
    },
    "questLine": {
      "cs": "Stupně cesty",
      "en": "The Stages of the Path"
    },
    "teaching": {
      "cs": "Bez pořádku se i správná věc udělá ve špatnou chvíli.",
      "en": "Without order, even the right thing gets done at the wrong time."
    },
    "ability": {
      "cs": "Zaměření lamrim — urychlí učení a srovná myšlenky.",
      "en": "Lamrim Focus — speeds learning and settles the mind."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Tsongkhapa (Lobsang Drakpa), tibetský buddhistický reformátor a zakladatel školy Gelug („žluté čepice“), žil ve 14.–15. století. Narozen v Amdu, studoval u všech tehdejších škol, obdržel vize Mandžušrího a napsal monumentální díla o etice a meditaci. V ZION OASIS je archetypem intelektuální přesnosti a etického základu — mostem mezi mystikou a rozumem.",
      "en": "Tsongkhapa (Lobsang Drakpa), the Tibetan Buddhist reformer and founder of the Gelug school ('Yellow Hats'), lived in the 14th–15th century. Born in Amdo, he studied under all the schools of his time, received visions of Mañjuśrī and wrote monumental works on ethics and meditation. In ZION OASIS he is the archetype of intellectual precision and ethical foundation — a bridge between mysticism and reason."
    },
    "quote": {
      "cs": "Nestačí vědět. Musíš to umět udělat v pořadí.",
      "en": "Knowing is not enough. You must be able to do it in order."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/072-tsongkhapa.webp",
      "full": "/oasis-assets/concept_svg/072-tsongkhapa.svg",
      "final": false
    },
    "circle": "tibet"
  },
  {
    "id": 75,
    "name": "Atiśa",
    "subtitle": {
      "cs": "Atíša",
      "en": "Atiśa"
    },
    "ray": "Yellow",
    "rarity": "Rare",
    "cl": 3,
    "clName": {
      "cs": "Mysl",
      "en": "Mind"
    },
    "role": {
      "cs": "Ten, kdo svítí na cestu druhým",
      "en": "He who lights the way for others"
    },
    "location": {
      "cs": "Klášter Radeng",
      "en": "Reting Monastery"
    },
    "questLine": {
      "cs": "Lampa na cestu",
      "en": "Lamp for the Path"
    },
    "teaching": {
      "cs": "Etika není seznam zákazů. Je to způsob, jak nikoho nezranit.",
      "en": "Ethics is not a list of prohibitions. It is a way of not wounding anyone."
    },
    "ability": {
      "cs": "Jiskra bódhičity — dá celé skupině odvahu pomáhat.",
      "en": "Bodhicitta Spark — gives the whole group the courage to help."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Atíša Dípamkara Šrídžňána (980–1054) je indický buddhistický mistr z Bengálska, který obnovil buddhismus v Tibetu a sepsal Bodhipathapradípu (Lampu na cestu k osvícení). Zakladatel tradice Kadampa, učitel lódžongu (tréninku mysli) a mistr postupné cesty. V ZION OASIS je průvodcem těch, kteří se ztratili ve spěchu — světec malých kroků a velké trpělivosti.",
      "en": "Atiśa Dīpaṃkara Śrījñāna (980–1054) is an Indian Buddhist master from Bengal who restored Buddhism in Tibet and wrote the Bodhipathapradīpa (Lamp for the Path to Enlightenment). Founder of the Kadampa tradition, teacher of lojong (mind training) and master of the gradual path. In ZION OASIS he guides those lost in haste — the saint of small steps and great patience."
    },
    "quote": {
      "cs": "Nejlepší odpověď na strach je být užitečný.",
      "en": "The best answer to fear is to be useful."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/073-atisa.webp",
      "full": "/oasis-assets/concept_svg/073-atisa.svg",
      "final": false
    },
    "circle": "tibet"
  },
  {
    "id": 76,
    "name": "Marpa Lotsawa",
    "subtitle": {
      "cs": "Marpa Překladatel",
      "en": "Marpa the Translator"
    },
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Most mezi dvěma světy",
      "en": "Bridge between two worlds"
    },
    "location": {
      "cs": "Údolí Lhodrak",
      "en": "The Lhodrak valley"
    },
    "questLine": {
      "cs": "Překlad, který nezradí",
      "en": "The Translation That Betrays Nothing"
    },
    "teaching": {
      "cs": "Přeložit neznamená převést slova. Znamená to neztratit smysl.",
      "en": "To translate is not to move words. It is to lose no meaning."
    },
    "ability": {
      "cs": "Překlad protokolu — spojí dva světy, které si nerozumí.",
      "en": "Protocol Translation — joins two worlds that do not understand each other."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Marpa Čhökji Lodrö (1012–1097) byl průkopníkem tibetské linie Kagjü — ne jako mnich, ale jako učitel laika, obchodník a překladatel. Třikrát podnikl nebezpečnou cestu do Indie, kde studoval u velkých siddhů Náropy a Maitrípy, a přivezl tantrické texty, které přeložil do tibetštiny. Známý jako Locáwa — „překladatel“ — spojka mezi indickými mahásiddhy a tibetskou praxí. Jeho metoda byla přímá: žádná okrasná teologie, jen praxe vedoucí k probuzení.",
      "en": "Marpa Chökyi Lodrö (1012–1097) was the pioneer of Tibet's Kagyü lineage — not a monk but a lay master, merchant and translator. Three times he undertook the perilous journey to India, studied under the great siddhas Naropa and Maitrīpa, and brought back tantric texts he translated into Tibetan. Known as Lotsawa — 'the Translator' — he links the Indian mahāsiddhas to Tibetan practice. His method was direct: no ornate theology, only practice leading to awakening."
    },
    "quote": {
      "cs": "Nesoudím, co říkáš. Hledám, co tím myslíš.",
      "en": "I do not judge what you say. I look for what you mean."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/074-marpa-lotsawa.webp",
      "full": "/oasis-assets/concept_svg/074-marpa-lotsawa.svg",
      "final": false
    },
    "circle": "tibet"
  },
  {
    "id": 77,
    "name": "Machik Labdrön",
    "subtitle": {
      "cs": "Máčik Labdrön",
      "en": "Machik Labdrön"
    },
    "ray": "Pink",
    "rarity": "Legendary",
    "cl": 6,
    "clName": {
      "cs": "Intuitivní moudrost",
      "en": "Intuitive Wisdom"
    },
    "role": {
      "cs": "Ta, která řeže strach",
      "en": "She who cuts fear"
    },
    "location": {
      "cs": "Hřbitov na okraji údolí",
      "en": "The charnel ground at the valley's edge"
    },
    "questLine": {
      "cs": "Čhö — darování beze strachu",
      "en": "Chöd — Giving Without Fear"
    },
    "teaching": {
      "cs": "Strach se nedá porazit. Dá se přestat poslouchat.",
      "en": "Fear cannot be defeated. It can be stopped being obeyed."
    },
    "ability": {
      "cs": "Setnutí strachu — odebere paniku v nejhorší chvíli.",
      "en": "Ego-Fear Cut — removes panic at the worst moment."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Machik Labdrön (1055–1149) je jednou z mála žen v historii Tibetu, která založila vlastní buddhistickou tradici — Čhöd, praxi „řezání“ ega. Byla učenkyní Dampy Sangjë a spojila tibetské praktiky s prastarými indickými tantrami. Její metoda je radikální: darovat své tělo předstíraným démonům, aby se odhalilo, že démoni i tělo jsou projekce mysli. Není to sebepoškozování, ale symbolický akt odpuštění lpění. Machik je matkou linie, která přetrvala osm století.",
      "en": "Machik Labdrön (1055–1149) is one of the few women in Tibetan history to found her own Buddhist tradition — Chöd, the practice of 'cutting' the ego. A disciple of Dampa Sangye, she fused Tibetan practices with ancient Indian tantras. Her method is radical: offer your body to imagined demons so it is revealed that demons and body alike are projections of mind. Not self-harm, but a symbolic act of releasing attachment. Machik is the mother of a lineage that has endured eight centuries."
    },
    "quote": {
      "cs": "To, čeho se bojíš, není venku. Je to tvoje představa o sobě.",
      "en": "What you fear is not outside. It is your idea of yourself."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/075-machik-labdron.webp",
      "full": "/oasis-assets/concept_svg/075-machik-labdron.svg",
      "final": false
    },
    "circle": "tibet"
  },
  {
    "id": 78,
    "name": "Mañjuśrī",
    "subtitle": {
      "cs": "Maňdžušrí",
      "en": "Mañjuśrī"
    },
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Bódhisattva rozlišování",
      "en": "Bodhisattva of discernment"
    },
    "location": {
      "cs": "Pět vrcholů Wu-tchaj",
      "en": "The five peaks of Wutai"
    },
    "questLine": {
      "cs": "Meč, který řeže chybný názor",
      "en": "The Sword That Cuts Wrong View"
    },
    "teaching": {
      "cs": "Nejostřejší meč není proti lidem. Je proti tomu, co si o nich myslíš.",
      "en": "The sharpest sword is not against people. It is against what you think about them."
    },
    "ability": {
      "cs": "Setnutí názoru — otevře rozhovor, který byl zamčený.",
      "en": "View-Cutter — opens a conversation that was locked."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Maňdžušrí (tib. Džampal Jang) je bódhisattva moudrosti — ne knižní, ale přímého rozlišení (pradžňá). V pravé ruce drží meč, který řeže iluzi a nesprávné názory, v levé knihu Prajñāpāramitā. Ústřední postava Mahájány i Vadžrajány; v Číně spojen s horou Wu-tchaj-šan. Není bůh k uctívání — je energie moudrosti, kterou může probudit každý.",
      "en": "Mañjuśrī (Tibetan: Jampal Yang) is the bodhisattva of wisdom — not bookish learning but direct discernment (prajñā). In his right hand he holds the sword that cuts illusion and wrong views, in his left the book of the Prajñāpāramitā. Central to Mahāyāna and Vajrayāna alike; in China linked to Mount Wutai. He is not a god to be worshipped — he is the energy of wisdom anyone can awaken."
    },
    "quote": {
      "cs": "Nemysli si, že máš pravdu. Podívej se, co jsi přehlédl.",
      "en": "Do not assume you are right. Look at what you overlooked."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/076-manjusri.webp",
      "full": "/oasis-assets/concept_svg/076-manjusri.svg",
      "final": false
    },
    "circle": "tibet"
  },
  {
    "id": 79,
    "name": "Samantabhadra",
    "subtitle": {
      "cs": "Samantabhadra",
      "en": "Samantabhadra"
    },
    "ray": "AllRays",
    "rarity": "Legendary",
    "cl": 4,
    "clName": {
      "cs": "Otevřené srdce",
      "en": "Heart Opening"
    },
    "role": {
      "cs": "Bódhisattva skutku a slibu",
      "en": "Bodhisattva of action and vow"
    },
    "location": {
      "cs": "Poutní stezka E-mej",
      "en": "The Emei pilgrimage path"
    },
    "questLine": {
      "cs": "Deset slibů",
      "en": "The Ten Vows"
    },
    "teaching": {
      "cs": "Slib, který se nepromění v každodenní práci, je jen věta.",
      "en": "A vow that does not become daily work is only a sentence."
    },
    "ability": {
      "cs": "Pole odhodlání — drobné buffy za každý splněný slib.",
      "en": "Aspiration Field — small boons for every vow kept."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Samantabhadra („všeobjímající dobrota“) je bódhisattva nekonečné praxe — ne doktrín, ale činů. V Lotosové sútře se zavazuje deseti velkými sliby: klanět se Buddhům, chválit dharmu, darovat vše dobru, projevovat pokoru, sdílet zásluhy, vítat učitele, žádat, aby učili, sloužit všem bytostem, následovat jejich potřeby a vše věnovat probuzení. Je to poutník, který nikdy nekončí — protože praxe není cíl, ale způsob existence.",
      "en": "Samantabhadra ('All-Embracing Goodness') is the bodhisattva of infinite practice — not doctrines but deeds. In the Lotus Sūtra he vows ten great vows: to honour the Buddhas, praise the dharma, give all for good, show humility, share merit, welcome teachers, ask them to teach, serve all beings, follow their needs, and dedicate everything to awakening. He is a pilgrim who never finishes — because practice is not a goal but a way of existing."
    },
    "quote": {
      "cs": "Nejdu na místo. Jdu tou cestou.",
      "en": "I am not going to a place. I am going by that path."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/077-samantabhadra.webp",
      "full": "/oasis-assets/concept_svg/077-samantabhadra.svg",
      "final": false
    },
    "circle": "tibet"
  },
  {
    "id": 80,
    "name": "Medicine Buddha",
    "subtitle": {
      "cs": "Buddha medicíny",
      "en": "Medicine Buddha"
    },
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 3,
    "clName": {
      "cs": "Mysl",
      "en": "Mind"
    },
    "role": {
      "cs": "Ten, kdo léčí pozdě, ale léčí",
      "en": "He who heals late, but heals"
    },
    "location": {
      "cs": "Zahrada léčivých bylin",
      "en": "The garden of healing herbs"
    },
    "questLine": {
      "cs": "Lapisová záře",
      "en": "The Lapis Glow"
    },
    "teaching": {
      "cs": "Uzdravení není zázrak. Je to rozhodnutí nechat tělo pracovat.",
      "en": "Healing is not a miracle. It is a decision to let the body work."
    },
    "ability": {
      "cs": "Lapisové vzedmutí — obnoví sílu celé skupině.",
      "en": "Lapis Healing Surge — restores strength to the whole group."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Bhaišadjaguru („lékařský mistr“) je Buddha východního lazuritového sálu — aspekt léčení v mahájáně. Jeho dvanáct velkých přání směřuje k osvobození od nemocí těla i mysli, nejen medicínou, ale skrze uvědomění příčiny. Není náhradou za lékaře — je to nejvyšší princip: když vidíš, že nemoc i zdraví jsou podmíněné, můžeš léčit kořen, ne jen symptom.",
      "en": "Bhaiṣajyaguru ('the Medicine Master') is the Buddha of the eastern lapis lazuli realm — the aspect of healing in Mahāyāna. His twelve great vows aim to free beings from diseases of body and mind, not by medicine alone but through awareness of the cause. He is no substitute for doctors — he is the highest principle: when you see that sickness and health are conditioned, you can treat the root, not just the symptom."
    },
    "quote": {
      "cs": "Nepřináším zdraví. Přináším čas, ve kterém se dá uzdravit.",
      "en": "I do not bring health. I bring the time in which healing can happen."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/078-medicine-buddha.webp",
      "full": "/oasis-assets/concept_svg/078-medicine-buddha.svg",
      "final": false
    },
    "circle": "tibet"
  },
  {
    "id": 81,
    "name": "Longchen Rabjam",
    "subtitle": {
      "cs": "Longčenpa",
      "en": "Longchenpa"
    },
    "ray": "White",
    "rarity": "Rare",
    "cl": 7,
    "clName": {
      "cs": "Léčivý soucit",
      "en": "Healing Compassion"
    },
    "role": {
      "cs": "Mistr přirozeného stavu",
      "en": "Master of the natural state"
    },
    "location": {
      "cs": "Jeskyně nad údolím",
      "en": "A cave above the valley"
    },
    "questLine": {
      "cs": "Velká dokonalost",
      "en": "The Great Perfection"
    },
    "teaching": {
      "cs": "Nic nemusíš přidat. Jen přestat zakrývat, co tam je.",
      "en": "You need add nothing. Only stop covering what is there."
    },
    "ability": {
      "cs": "Návrat k přirozenému — vyčistí mysl od nánosů.",
      "en": "Natural State Reset — clears the mind of accumulated debris."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Longchen Rabdžam (1308–1364) — velký systémizátor dzogčenu; jeho Sedm pokladů patří k nejčtenějším filozoficko-meditativním textům tibetské tradice v překladu.",
      "en": "Longchen Rabjam (1308–1364) — the great systematizer of Dzogchen; his Seven Treasuries are among the most widely read philosophical-meditative texts of the Tibetan tradition in translation."
    },
    "quote": {
      "cs": "Hledal jsem tolik let. Bylo to tam, kde jsem odpočíval.",
      "en": "I searched for so many years. It was where I rested."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/079-longchen-rabjam.webp",
      "full": "/oasis-assets/concept_svg/079-longchen-rabjam.svg",
      "final": false
    },
    "circle": "tibet"
  },
  {
    "id": 82,
    "name": "Shiva",
    "subtitle": {
      "cs": "Šiva — tanec konce a počátku",
      "en": "Shiva — the dance of ending and beginning"
    },
    "ray": "Blue",
    "rarity": "Legendary",
    "cl": 6,
    "clName": {
      "cs": "Intuitivní moudrost",
      "en": "Intuitive Wisdom"
    },
    "role": {
      "cs": "Ten, kdo rozpouští, aby bylo možné tvořit",
      "en": "He who dissolves so that creation is possible"
    },
    "location": {
      "cs": "Mount Kailash, tančiště",
      "en": "Mount Kailash, the dancing ground"
    },
    "questLine": {
      "cs": "Tanec, který ukončí věk",
      "en": "The Dance That Ends an Age"
    },
    "teaching": {
      "cs": "Nezničíš, co miluješ. Propustíš to, co už netvoří.",
      "en": "You do not destroy what you love. You release what no longer creates."
    },
    "ability": {
      "cs": "Obrat tándavy — krátké okno, kdy staré přestane platit.",
      "en": "Tandava Pivot — a short window when the old stops applying."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Šiva Mahádéva — os transformace v Trimúrti: zakončení klamu, péče o jogíny a oddané (Pašupati), kosmický tanečník (Tándava). V OASIS doplňuje již rozvinutou vaišnovskou osu (Kršna, Ráma, Kalki).",
      "en": "Śiva Mahādeva — the Trimurti's axis of transformation: ending delusion, caring for yogis and devotees (Paśupati), cosmic dancer (Tāṇḍava). In OASIS he complements the already developed Vaishnava axis (Kṛṣṇa, Rāma, Kalki)."
    },
    "quote": {
      "cs": "Tančím proto, aby se svět nezastavil v jedné podobě.",
      "en": "I dance so the world does not freeze into one shape."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/080-shiva.webp",
      "full": "/oasis-assets/concept_svg/080-shiva.svg",
      "final": false
    },
    "circle": "india"
  },
  {
    "id": 83,
    "name": "Parvati",
    "subtitle": {
      "cs": "Párvatí — královna souladu",
      "en": "Parvati — Queen of Harmony"
    },
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 4,
    "clName": {
      "cs": "Otevřené srdce",
      "en": "Heart Opening"
    },
    "role": {
      "cs": "Ta, která drží dům pohromadě",
      "en": "She who holds the house together"
    },
    "location": {
      "cs": "Horský příbytek",
      "en": "The mountain dwelling"
    },
    "questLine": {
      "cs": "Síla, která nehasí",
      "en": "Strength That Does Not Quench"
    },
    "teaching": {
      "cs": "Soulad není ticho. Je to dohoda, že se budeme hádat slušně.",
      "en": "Harmony is not silence. It is an agreement to argue decently."
    },
    "ability": {
      "cs": "Pouto šakti — spojí dvě síly tak, že se navzájem zesílí.",
      "en": "Shakti Bond — joins two strengths so they reinforce each other."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Párvatí je Umá, matka-cestovatelka, šakti tapas — disciplínovaného srdce. Doplňuje 82. Šivu v příběhu Ardhanáríšvara synchronicity (bez redukce na pouhý „manželský quest“).",
      "en": "Pārvatī is Umā, the mother-journeyer, śakti of tapas — the disciplined heart. She complements #82 Śiva in the Ardhanārīśvara synchronicity story (not reduced to a mere 'marriage quest')."
    },
    "quote": {
      "cs": "Nejsem ta, která ustoupí. Jsem ta, která zůstane.",
      "en": "I am not the one who steps aside. I am the one who stays."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/081-parvati.webp",
      "full": "/oasis-assets/concept_svg/081-parvati.svg",
      "final": false
    },
    "circle": "india"
  },
  {
    "id": 84,
    "name": "Ganesha",
    "subtitle": {
      "cs": "Ganéša — ten, kdo odstraňuje překážky",
      "en": "Ganesha — remover of obstacles"
    },
    "ray": "Yellow",
    "rarity": "Epic",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Strážce začátků a písařů",
      "en": "Guardian of beginnings and of scribes"
    },
    "location": {
      "cs": "Práh každé cesty",
      "en": "The threshold of every road"
    },
    "questLine": {
      "cs": "První krok",
      "en": "The First Step"
    },
    "teaching": {
      "cs": "Překážka často není zeď. Je to znamení, že máš jít jinudy.",
      "en": "An obstacle is often not a wall. It is a sign to go another way."
    },
    "ability": {
      "cs": "Odvalení překážky — jednou otevře cestu, která byla zavřená.",
      "en": "Vighna Clear — once, opens a road that was closed."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Gaňéša / Vinájaka — odstraňuje vighna (překážky), patron začátků; v tradici zápisu Mahábháraty sepisuje diktát Vjásy (viz 17. Vjása a quest „Ganesha's Pen“). V OASIS = strážce vstupního prahu.",
      "en": "Gaṇeśa / Vināyaka — remover of vighna (obstacles), patron of beginnings; in the Mahābhārata-writing tradition he takes Vyāsa's dictation (see #17 Vyāsa and the quest 'Ganesha's Pen'). In OASIS = guardian of the entry threshold."
    },
    "quote": {
      "cs": "Nejdřív se podívej, co neseš. Půlka překážek je v batohu.",
      "en": "First look at what you carry. Half the obstacles are in your bag."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/082-ganesha.webp",
      "full": "/oasis-assets/concept_svg/082-ganesha.svg",
      "final": false
    },
    "circle": "india"
  },
  {
    "id": 85,
    "name": "Lakshmi",
    "subtitle": {
      "cs": "Lakšmí — blahobyt jako tok",
      "en": "Lakshmi — prosperity as flow"
    },
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 3,
    "clName": {
      "cs": "Mysl",
      "en": "Mind"
    },
    "role": {
      "cs": "Ta, která učí, že bohatství je v pohybu",
      "en": "She who teaches that wealth is in motion"
    },
    "location": {
      "cs": "Lotosský rybník",
      "en": "The lotus pond"
    },
    "questLine": {
      "cs": "Miska, která se nenaplní",
      "en": "The Bowl That Never Fills"
    },
    "teaching": {
      "cs": "Hojnost není kolik máš. Je to kolik projde tvýma rukama dál.",
      "en": "Abundance is not how much you have. It is how much passes on through your hands."
    },
    "ability": {
      "cs": "Tok štěstí — drobný podíl z každé výhry jde na dobrou věc.",
      "en": "Śrī Flow — a small share of every gain goes to a good cause."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Lakšmí / Šrí — štěstí vzniklé z dharmické činnosti a vděku. Tento slot (#85) klasického šrí archetypu doplňuje kompozit 43 Sri Anagha Lakshmi (Sarasvatí+Lakšmí+Kálí amalgam).",
      "en": "Lakṣmī / Śrī — fortune born of dharmic activity and gratitude. This slot (#85) for the classical śrī archetype complements the composite #43 Sri Anagha Lakshmi (a Sarasvatī+Lakṣmī+Kālī amalgam)."
    },
    "quote": {
      "cs": "Nepřináším zlato. Přináším důvod ho nezamknout.",
      "en": "I do not bring gold. I bring a reason not to lock it away."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/083-lakshmi.webp",
      "full": "/oasis-assets/concept_svg/083-lakshmi.svg",
      "final": false
    },
    "circle": "india"
  },
  {
    "id": 86,
    "name": "Durga",
    "subtitle": {
      "cs": "Durga — ta, která chrání",
      "en": "Durga — she who protects"
    },
    "ray": "Blue",
    "rarity": "Legendary",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Obránkyně, která jde do ohně první",
      "en": "Defender who walks into the fire first"
    },
    "location": {
      "cs": "Horská pevnost",
      "en": "The mountain fortress"
    },
    "questLine": {
      "cs": "Devět nocí",
      "en": "The Nine Nights"
    },
    "teaching": {
      "cs": "Chránit slabšího není slabost. Je to jediná síla, která má smysl.",
      "en": "Protecting the weaker is not weakness. It is the only strength that means anything."
    },
    "ability": {
      "cs": "Lví předvoj — na chvíli ochrání celou skupinu.",
      "en": "Lion Vanguard — shields the whole group for a moment."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Durgá (Ambá) — ochrana dharmy před adharmou; v puráňové tradici archetypálně znázorněná bojem s Mahišásurou. Ve hře sezónní story boss s etikou Navarátri (bez karnevalizace festivalu).",
      "en": "Durgā (Ambā) — protection of dharma against adharma; in Purāṇic tradition archetypally depicted in battle with Mahiṣāsura. In-game a seasonal story boss with Navarātri ethics (no carnivalization of the festival)."
    },
    "quote": {
      "cs": "Nevyhrávám kvůli vítězství. Vyhrávám, aby bylo komu pomoct.",
      "en": "I do not win for victory. I win so there is someone left to help."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/084-durga.webp",
      "full": "/oasis-assets/concept_svg/084-durga.svg",
      "final": false
    },
    "circle": "india"
  },
  {
    "id": 87,
    "name": "Kali",
    "subtitle": {
      "cs": "Kálí — čas, který bere",
      "en": "Kali — time that takes"
    },
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 7,
    "clName": {
      "cs": "Léčivý soucit",
      "en": "Healing Compassion"
    },
    "role": {
      "cs": "Ta, která ukončí, co se přežilo",
      "en": "She who ends what has outlived itself"
    },
    "location": {
      "cs": "Hřbitov u řeky",
      "en": "The cremation ground by the river"
    },
    "questLine": {
      "cs": "Noc bez času",
      "en": "The Night Without Time"
    },
    "teaching": {
      "cs": "Nic není nespravedlivé jen proto, že to skončilo.",
      "en": "Nothing is unfair merely because it ended."
    },
    "ability": {
      "cs": "Setnutí ega — sníží pýchu, která tě oslepuje.",
      "en": "Ego Dissolution — lowers the pride that blinds you."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Mahákálí řeže ego-čas — iluzi odděleného „já“ lpícího na újmě — ne civilní populaci jako groteskní podívanou.",
      "en": "Mahākālī cuts ego-time — the illusion of a separate 'self' clinging to grievance — not civilian populations as a grotesque spectacle."
    },
    "quote": {
      "cs": "Neberu ti život. Beru ti představu, že ho máš pod kontrolou.",
      "en": "I do not take your life. I take your idea that you control it."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/085-kali.webp",
      "full": "/oasis-assets/concept_svg/085-kali.svg",
      "final": false
    },
    "circle": "india"
  },
  {
    "id": 88,
    "name": "Kartikeya",
    "subtitle": {
      "cs": "Kártikéja — velitel",
      "en": "Kartikeya — the commander"
    },
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 4,
    "clName": {
      "cs": "Otevřené srdce",
      "en": "Heart Opening"
    },
    "role": {
      "cs": "Ten, kdo vede sestavu, ne sebe",
      "en": "He who leads the formation, not himself"
    },
    "location": {
      "cs": "Horský průsmyk",
      "en": "The mountain pass"
    },
    "questLine": {
      "cs": "Šest tváří, jeden směr",
      "en": "Six Faces, One Direction"
    },
    "teaching": {
      "cs": "Vedení je o tom, aby každý věděl, kam jde. Ne o tom, kdo mluví první.",
      "en": "Leadership is making sure everyone knows where they are going. Not who speaks first."
    },
    "ability": {
      "cs": "Šestinásobný předvoj — zlepší souhru celé skupiny.",
      "en": "Sixfold Vanguard — improves the coordination of the whole group."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Kárttikéja / Skanda / Murukan — mladý velitel (senápati), symbol disciplíny kombinované s obranou dharmy.",
      "en": "Kārttikeya / Skanda / Murukan — the young commander (senāpati), symbol of discipline combined with the defense of dharma."
    },
    "quote": {
      "cs": "Nepotřebuju nejlepší vojáky. Potřebuju, aby se navzájem slyšeli.",
      "en": "I do not need the best soldiers. I need them to hear each other."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/086-kartikeya.webp",
      "full": "/oasis-assets/concept_svg/086-kartikeya.svg",
      "final": false
    },
    "circle": "india"
  },
  {
    "id": 89,
    "name": "Surya",
    "subtitle": {
      "cs": "Súrja — rytmus dne",
      "en": "Surya — the rhythm of the day"
    },
    "ray": "White",
    "rarity": "Rare",
    "cl": 2,
    "clName": {
      "cs": "Emoce",
      "en": "Emotion"
    },
    "role": {
      "cs": "Strážce světla, které se vrací",
      "en": "Keeper of the light that returns"
    },
    "location": {
      "cs": "Východ slunce nad pouští",
      "en": "Sunrise over the desert"
    },
    "questLine": {
      "cs": "Každé ráno znovu",
      "en": "Every Morning Again"
    },
    "teaching": {
      "cs": "Nikdo nemusí být hrdina pořád. Stačí začít znovu, když vyjde slunce.",
      "en": "No one has to be a hero all the time. It is enough to begin again at sunrise."
    },
    "ability": {
      "cs": "Úsvit — malý, ale jistý bonus za poctivou práci.",
      "en": "Dawn — a small but certain bonus for honest work."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Súrja — zákonitý puls kosmu (paralela k rytmu bloků v ZION lore, bez náboženského dogmatu ve hře).",
      "en": "Sūrya — the lawful pulse of the cosmos (a parallel to the rhythm of blocks in ZION lore, without religious dogma in-game)."
    },
    "quote": {
      "cs": "Nezajímá mě, co jsi zmeškal. Zajímá mě, co uděláš dnes.",
      "en": "I do not care what you missed. I care what you do today."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/087-surya.webp",
      "full": "/oasis-assets/concept_svg/087-surya.svg",
      "final": false
    },
    "circle": "india"
  },
  {
    "id": 90,
    "name": "Indra",
    "subtitle": {
      "cs": "Indra — král bouře",
      "en": "Indra — king of the storm"
    },
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 5,
    "clName": {
      "cs": "Kvantový skok",
      "en": "Quantum"
    },
    "role": {
      "cs": "Ten, kdo zkouší moc, aby ji neztratil",
      "en": "He who tests power so as not to lose it"
    },
    "location": {
      "cs": "Nebeská citadela",
      "en": "The celestial citadel"
    },
    "questLine": {
      "cs": "Bouře, která zkouší krále",
      "en": "The Storm That Tests the King"
    },
    "teaching": {
      "cs": "Moc, kterou nikdo nezpochybní, se dřív nebo později zvrhne.",
      "en": "Power no one questions will sooner or later go bad."
    },
    "ability": {
      "cs": "Vadžra — přeruší jeden útok, ať je jakkoli silný.",
      "en": "Vajra — interrupts a single attack, however strong."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Indra — rájový archetyp síly (Šakra), která v klasických příbězích dostává lekci pokory od rši (texty hymnů neměnit na vtipný voice-over).",
      "en": "Indra — the heavenly archetype of power (Śakra), who in the classic stories receives lessons in humility from the ṛṣis (not to be turned into a comic voice-over of the hymns)."
    },
    "quote": {
      "cs": "Bouřím, abych zjistil, kdo ještě stojí.",
      "en": "I storm so I can see who is still standing."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/088-indra.webp",
      "full": "/oasis-assets/concept_svg/088-indra.svg",
      "final": false
    },
    "circle": "india"
  },
  {
    "id": 91,
    "name": "Ganga",
    "subtitle": {
      "cs": "Ganga — řeka, která nese",
      "en": "Ganga — the river that carries"
    },
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 3,
    "clName": {
      "cs": "Mysl",
      "en": "Mind"
    },
    "role": {
      "cs": "Ta, která čistí a nestěžuje si",
      "en": "She who cleanses and does not complain"
    },
    "location": {
      "cs": "Pramen v horách",
      "en": "The spring in the mountains"
    },
    "questLine": {
      "cs": "Cesta k moři",
      "en": "The Way to the Sea"
    },
    "teaching": {
      "cs": "Voda si nepamatuje, kdo ji znečistil. Prostě teče dál.",
      "en": "Water does not remember who polluted it. It simply flows on."
    },
    "ability": {
      "cs": "Očistný proud — pročistí místo, které bylo znečištěné.",
      "en": "Purifying Current — cleanses a place that was polluted."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Gangá — vodní matrice očisty, dharmické i environmentální. Questy musejí vést ke stewardship, ne k parodii hinduistické praxe.",
      "en": "Gaṅgā — the watery matrix of purification, dharmic and environmental. Quests must lead to stewardship, not to a parody of Hindu practice."
    },
    "quote": {
      "cs": "Nesu všechno. Nezastavuji se u ničeho.",
      "en": "I carry everything. I stop at nothing."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/089-ganga.webp",
      "full": "/oasis-assets/concept_svg/089-ganga.svg",
      "final": false
    },
    "circle": "india"
  },
  {
    "id": 92,
    "name": "Amaterasu",
    "subtitle": {
      "cs": "Amaterasu — sluneční bohyně",
      "en": "Amaterasu — solar kami"
    },
    "ray": "White",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která vrací světlo po tmě",
      "en": "She who returns light after the dark"
    },
    "location": {
      "cs": "Jeskyně Ama-no-Iwato",
      "en": "The Ama-no-Iwato cave"
    },
    "questLine": {
      "cs": "Světlo, které se vrátilo",
      "en": "The Light That Returned"
    },
    "teaching": {
      "cs": "Světlo se nevrací silou. Vrací se, když je venku zase co milovat.",
      "en": "Light does not return by force. It returns when there is something outside worth loving again."
    },
    "ability": {
      "cs": "Záře úsvitu — vrátí naději místu, které se vzdalo.",
      "en": "Dawn Radiance — restores hope to a place that gave up."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Amaterasu — nebeský princip světla a živnosti (kami) v klasických pověstech. V OASIS = oblouk „obnovy veřejného prostoru“ poté, co toxický debuff („temný kout“) zavládne městem.",
      "en": "Amaterasu — the celestial principle of light and vitality (kami) in the classical chronicle tales. In OASIS = the 'restoring public space' arc after a toxic debuff ('dark corner') seizes the city."
    },
    "quote": {
      "cs": "Neodešla jsem proto, že jsem byla slabá. Odešla jsem, protože mě nikdo neviděl.",
      "en": "I did not leave because I was weak. I left because no one saw me."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/090-amaterasu.webp",
      "full": "/oasis-assets/concept_svg/090-amaterasu.svg",
      "final": false
    },
    "circle": "japan"
  },
  {
    "id": 93,
    "name": "Susanoo",
    "subtitle": {
      "cs": "Susanoo — bouře, která uklízí",
      "en": "Susanoo — the storm that clears"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo bourá zkažené pořádky",
      "en": "He who tears down rotten order"
    },
    "location": {
      "cs": "Pobřeží Izumo",
      "en": "The coast of Izumo"
    },
    "questLine": {
      "cs": "Meč z ocasu",
      "en": "The Sword from the Tail"
    },
    "teaching": {
      "cs": "Někdy je neposlušnost jediná poctivá odpověď na nesmyslné pravidlo.",
      "en": "Sometimes disobedience is the only honest answer to a senseless rule."
    },
    "ability": {
      "cs": "Očista bouří — smete to, co už jen překáží.",
      "en": "Storm Purge — sweeps away what now only obstructs."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Susanoo — kami bouře a očisty, narativně spojený s řekami a morálním resetem po zkorumpovaných strukturách — v OASIS jako etická chaos damage jen proti institucionalizovaným parazitům, ne nevinným NPC.",
      "en": "Susanoo — kami of storm and purification, narratively tied to rivers and moral reset after corrupted structures — in OASIS as ethical 'chaos damage' against institutionalized parasites only, never innocent NPCs."
    },
    "quote": {
      "cs": "Nebourám, protože mi to baví. Bourám, protože to jinak nejde.",
      "en": "I do not break things for fun. I break them because there is no other way."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/091-susanoo.webp",
      "full": "/oasis-assets/concept_svg/091-susanoo.svg",
      "final": false
    },
    "circle": "japan"
  },
  {
    "id": 94,
    "name": "Tsukuyomi",
    "subtitle": {
      "cs": "Cukujomi — měsíční rozvaha",
      "en": "Tsukuyomi — lunar reflection"
    },
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo se dívá v noci, co ve dne přehlédli",
      "en": "He who sees at night what was missed by day"
    },
    "location": {
      "cs": "Měsíční svatyně",
      "en": "The moon shrine"
    },
    "questLine": {
      "cs": "Noc, kdy se počítá",
      "en": "The Night of Reckoning"
    },
    "teaching": {
      "cs": "Rozhodnutí přijaté ve spěchu se má přezkoumat, až se světlo ohne.",
      "en": "A decision made in haste should be reviewed when the light bends."
    },
    "ability": {
      "cs": "Ubývající přezkum — odhalí chybu dřív, než napáchá škodu.",
      "en": "Waning Review — reveals the mistake before it does damage."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Tsukuyomi — noční princip rozlišování. V lore OASIS doplňuje Hinu (#70) jiným úhlem — lunární audit mempool etiky (bez mystifikace mempoolu jako „záhadného měsíce“).",
      "en": "Tsukuyomi — the nocturnal principle of discernment. In OASIS lore it complements Hina (#70) from another angle — a lunar audit of mempool ethics (without mystifying the mempool as a 'mysterious moon')."
    },
    "quote": {
      "cs": "Nesoudím tě. Jen ti ukazuju, co jsi v poledne neviděl.",
      "en": "I am not judging you. I am showing you what you could not see at noon."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/092-tsukuyomi.webp",
      "full": "/oasis-assets/concept_svg/092-tsukuyomi.svg",
      "final": false
    },
    "circle": "japan"
  },
  {
    "id": 95,
    "name": "Inari",
    "subtitle": {
      "cs": "Inari — strážce prahu",
      "en": "Inari — keeper of the threshold"
    },
    "ray": "Green",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo otevírá dveře novým",
      "en": "He who opens doors for newcomers"
    },
    "location": {
      "cs": "Cesta tunelem torii",
      "en": "The path through the torii"
    },
    "questLine": {
      "cs": "Tisíc bran",
      "en": "A Thousand Gates"
    },
    "teaching": {
      "cs": "Dveře se neotevírají tím, že do nich tlučeš. Otevírají se tím, že přineseš něco užitečného.",
      "en": "Doors do not open by pounding on them. They open when you bring something useful."
    },
    "ability": {
      "cs": "Požehnání stezky — usnadní první krok každému novému.",
      "en": "Path Blessing — eases the first step for every newcomer."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Inari — úroda a liminalita mezi říší lidí a bohů (často s folklórem kitsune — bez karikaturního furry fetiše na marketplace).",
      "en": "Inari — harvest and liminality between the human and divine realms (often with kitsune folklore — without a caricatured furry fetish on the marketplace)."
    },
    "quote": {
      "cs": "Rýže se nedá spočítat. Dá se rozdělit.",
      "en": "Rice cannot be counted. It can be shared."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/093-inari.webp",
      "full": "/oasis-assets/concept_svg/093-inari.svg",
      "final": false
    },
    "circle": "japan"
  },
  {
    "id": 96,
    "name": "Ōkuninushi",
    "subtitle": {
      "cs": "Ókuninuši — hostitel země",
      "en": "Ōkuninushi — host of the land"
    },
    "ray": "Pink",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo učí pohostinnosti v obchodu",
      "en": "He who teaches hospitality in trade"
    },
    "location": {
      "cs": "Pole Izumo",
      "en": "The fields of Izumo"
    },
    "questLine": {
      "cs": "Dům, kde se nezavírá",
      "en": "The House That Does Not Close"
    },
    "teaching": {
      "cs": "Dobrý obchod poznáš podle toho, že se zákazník vrátí i bez slevy.",
      "en": "You know a good trade by the customer returning without a discount."
    },
    "ability": {
      "cs": "Požehnání předání — spojí dva obchodníky férovou dohodou.",
      "en": "Transfer Blessing — joins two traders in a fair agreement."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ókuninuši — kulturní hrdina péče o zemi v rámci kuni-juzuri (zkouška → odevzdání → spravedlnost).",
      "en": "Ōkuninushi — the culture hero of land-care within the kuni-yuzuri frame (trial → surrender → justice)."
    },
    "quote": {
      "cs": "Nemám největší dům. Mám dům, kde je místo.",
      "en": "I do not have the biggest house. I have a house with room."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/094-okuninushi.webp",
      "full": "/oasis-assets/concept_svg/094-okuninushi.svg",
      "final": false
    },
    "circle": "japan"
  },
  {
    "id": 97,
    "name": "Izanami",
    "subtitle": {
      "cs": "Izanami — strážkyně odchodu",
      "en": "Izanami — keeper of departure"
    },
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která provází na konec",
      "en": "She who accompanies the ending"
    },
    "location": {
      "cs": "Jomi, země stínů",
      "en": "Yomi, the land of shadows"
    },
    "questLine": {
      "cs": "Návrat, který nejde",
      "en": "The Return That Cannot Be"
    },
    "teaching": {
      "cs": "Některé věci se nemají vracet. Mají se nechat odejít.",
      "en": "Some things should not come back. They should be let go."
    },
    "ability": {
      "cs": "Jomská hranice — bezpečně ukončí to, co se táhne příliš dlouho.",
      "en": "Yomi Checkpoint — safely ends what has dragged on too long."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Izanami — archetyp prahu mezi životem a smrtí, útěchy při procesu rozchodu systémů (staking unwind, humánní chain sunset).",
      "en": "Izanami — archetype of the threshold between life and death, a comfort in processes of system separation (staking unwind, humane chain sunset)."
    },
    "quote": {
      "cs": "Nezdržuju tě. Jen se ptám, jestli jsi se rozloučil.",
      "en": "I am not holding you. I only ask whether you said goodbye."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/095-izanami.webp",
      "full": "/oasis-assets/concept_svg/095-izanami.svg",
      "final": false
    },
    "circle": "japan"
  },
  {
    "id": 98,
    "name": "Hachiman",
    "subtitle": {
      "cs": "Hachiman — ochránce lukostřelců",
      "en": "Hachiman — protector of archers"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo drží mír a umí ho bránit",
      "en": "He who keeps peace and can defend it"
    },
    "location": {
      "cs": "Hradní věž",
      "en": "The castle tower"
    },
    "questLine": {
      "cs": "Mír, který se hlídá",
      "en": "The Peace That Is Guarded"
    },
    "teaching": {
      "cs": "Mír není stav. Je to práce, která se nesmí přerušit.",
      "en": "Peace is not a state. It is work that must not be interrupted."
    },
    "ability": {
      "cs": "Hachimanská bašta — postaví obranu, která vydrží první náraz.",
      "en": "Hachiman Bastion — raises a defence that survives the first blow."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Hačiman — kami války jako ochrana komunity, ne triumfalismus. Spojován s guard rails DAO, které zakazují škodlivé válčení.",
      "en": "Hachiman — the kami of war as community protection, not triumphalism. Linked to DAO guard rails that forbid harmful warring."
    },
    "quote": {
      "cs": "Nejlepší šíp je ten, který zůstal v toulci.",
      "en": "The best arrow is the one that stayed in the quiver."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/096-hachiman.webp",
      "full": "/oasis-assets/concept_svg/096-hachiman.svg",
      "final": false
    },
    "circle": "japan"
  },
  {
    "id": 99,
    "name": "Benzaiten",
    "subtitle": {
      "cs": "Benzaiten — proud umění",
      "en": "Benzaiten — the flowing arts"
    },
    "ray": "Pink",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která propojuje tvořivost a vodu",
      "en": "She who joins creativity and water"
    },
    "location": {
      "cs": "Ostrov v jezeře",
      "en": "An island in the lake"
    },
    "questLine": {
      "cs": "Hudba, která neteče sama",
      "en": "Music That Does Not Flow Alone"
    },
    "teaching": {
      "cs": "Sám zahraješ melodii. Spolu zahrajete hudbu.",
      "en": "Alone you play a melody. Together you play music."
    },
    "ability": {
      "cs": "Proud tvořivosti — zlepší společnou práci celé skupiny.",
      "en": "Flow State — improves the shared work of the whole group."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Benzaiten — jedna z řady božstev štěstěny a výtvarné/hudební moudrosti v japonské adaptaci (linie Sarasvatí).",
      "en": "Benzaiten — one of the deities of fortune and artistic/musical wisdom in the Japanese adaptation (the Sarasvatī line)."
    },
    "quote": {
      "cs": "Voda si najde cestu, ale hudba potřebuje druhého.",
      "en": "Water finds its way, but music needs another."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/097-benzaiten.webp",
      "full": "/oasis-assets/concept_svg/097-benzaiten.svg",
      "final": false
    },
    "circle": "japan"
  },
  {
    "id": 100,
    "name": "Kūkai",
    "subtitle": {
      "cs": "Kúkai — stavitel mandaly",
      "en": "Kūkai — the mandala builder"
    },
    "ray": "White",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo učí geometrii světa",
      "en": "He who teaches the geometry of the world"
    },
    "location": {
      "cs": "Hora Kója",
      "en": "Mount Kōya"
    },
    "questLine": {
      "cs": "Dvě mandaly",
      "en": "The Two Mandalas"
    },
    "teaching": {
      "cs": "Co neumíš nakreslit, tomu nerozumíš. A co nerozumíš, to nemůžeš předat.",
      "en": "What you cannot draw, you do not understand. And what you do not understand, you cannot pass on."
    },
    "ability": {
      "cs": "Šablona diamantového světa — zpřehlední složitý plán.",
      "en": "Diamond World Stencil — makes a complex plan legible."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Kúkai — zakladatel linie Šingon jako education-first mystická kartografie (žádné initi-only paywalled dovednosti ve veřejném lore bez governance).",
      "en": "Kūkai — founder of the Shingon line as education-first mystical cartography (no initiation-only paywalled skills in public lore without governance)."
    },
    "quote": {
      "cs": "Svět je mandala. Jen se na něj musíš podívat z dost velké dálky.",
      "en": "The world is a mandala. You only have to look from far enough away."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/098-kukai.webp",
      "full": "/oasis-assets/concept_svg/098-kukai.svg",
      "final": false
    },
    "circle": "japan"
  },
  {
    "id": 101,
    "name": "Nichiren",
    "subtitle": {
      "cs": "Ničiren — hlas lotosu",
      "en": "Nichiren — voice of the lotus"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo čte nahlas, aby rozuměli všichni",
      "en": "He who reads aloud so all may understand"
    },
    "location": {
      "cs": "Chrám na hoře Minobu",
      "en": "The temple on Mount Minobu"
    },
    "questLine": {
      "cs": "Text, který patří všem",
      "en": "The Text That Belongs to All"
    },
    "teaching": {
      "cs": "Učení, které zůstane v knize, je jen nábytek.",
      "en": "A teaching that stays in the book is only furniture."
    },
    "ability": {
      "cs": "Sbor daimoku — posílí hlas skupiny proti strachu.",
      "en": "Daimoku Chorus — strengthens the group's voice against fear."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ničiren — text-first reformace zdůrazňující dostupnost Lotosové sútry (paralela veřejného čtení s blockchain open docs).",
      "en": "Nichiren — a text-first reform emphasizing the accessibility of the Lotus Sūtra (a public-reading parallel to blockchain open docs)."
    },
    "quote": {
      "cs": "Nehádej se o text. Přečti ho nahlas a uvidíš.",
      "en": "Do not argue about the text. Read it aloud and you will see."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/099-nichiren.webp",
      "full": "/oasis-assets/concept_svg/099-nichiren.svg",
      "final": false
    },
    "circle": "japan"
  },
  {
    "id": 102,
    "name": "Xuanyuan Huangdi",
    "subtitle": {
      "cs": "Žlutý císař",
      "en": "The Yellow Emperor"
    },
    "ray": "Yellow",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Zakladatel řádu a medicíny",
      "en": "Founder of order and of medicine"
    },
    "location": {
      "cs": "Údolí Žluté řeky",
      "en": "The Yellow River valley"
    },
    "questLine": {
      "cs": "Tři otázky lékaře",
      "en": "The Physician's Three Questions"
    },
    "teaching": {
      "cs": "Léčit se má dřív, než je nemoc vidět. To platí i o společnosti.",
      "en": "Healing should come before illness is visible. The same holds for a society."
    },
    "ability": {
      "cs": "Starost o celek — posílí zdraví celé osady.",
      "en": "Care for the Whole — strengthens the health of the whole settlement."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Chuang-ti — archetyp kosmického řádu a původu medicínské lore v čínské tradované historii (mýtus vs. historie akademicky vrstvené).",
      "en": "Huangdi — archetype of cosmic order and the origins of medical lore in Chinese received history (myth vs. history academically layered)."
    },
    "quote": {
      "cs": "Nejlepší lékař je ten, o kterém pacienti nevědí.",
      "en": "The best physician is the one the patients never notice."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/100-xuanyuan-huangdi.webp",
      "full": "/oasis-assets/concept_svg/100-xuanyuan-huangdi.svg",
      "final": false
    },
    "circle": "china"
  },
  {
    "id": 103,
    "name": "Xiwangmu",
    "subtitle": {
      "cs": "Si-wang-mu — královna Západu",
      "en": "Xiwangmu — Queen Mother of the West"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Strážkyně pokladu, který dozrává",
      "en": "Keeper of treasure that must ripen"
    },
    "location": {
      "cs": "Hora Kchun-lun",
      "en": "Mount Kunlun"
    },
    "questLine": {
      "cs": "Zahrada broskví",
      "en": "The Peach Garden"
    },
    "teaching": {
      "cs": "Něco musí uzrát. Kdo to sní zelené, bude mít jen prázdno.",
      "en": "Some things must ripen. Whoever eats them green will have only emptiness."
    },
    "ability": {
      "cs": "Zrání — zpomalí nedočkavost a ochrání hodnotu v čase.",
      "en": "Ripening — slows impatience and protects value over time."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Si-wang-mu — matriarchální božstvo broskví/longevity lore; v OASIS reprezentuje dlouhohorizontní governance treasury locky s etickými podmínkami odemknutí.",
      "en": "Xiwangmu — the matriarch deity of the peaches/longevity lore; in OASIS she represents long-horizon governance treasury locks with ethical unlock conditions."
    },
    "quote": {
      "cs": "Broskve nejsou pro tebe. Jsou pro dobu, kdy je budeš umět sníst.",
      "en": "The peaches are not for you. They are for the hour when you can eat them."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/101-xiwangmu.webp",
      "full": "/oasis-assets/concept_svg/101-xiwangmu.svg",
      "final": false
    },
    "circle": "china"
  },
  {
    "id": 104,
    "name": "Laozi",
    "subtitle": {
      "cs": "Lao-c' — mlčení, které vede",
      "en": "Laozi — the silence that leads"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Učitel méně vlády",
      "en": "Teacher of governing less"
    },
    "location": {
      "cs": "Průsmyk na hranici",
      "en": "The pass at the border"
    },
    "questLine": {
      "cs": "Cesta bez cesty",
      "en": "The Way Without a Way"
    },
    "teaching": {
      "cs": "Nejlepší vláda je ta, kterou lidé skoro nezaznamenají.",
      "en": "The best government is the one people barely notice."
    },
    "ability": {
      "cs": "Svodné ticho — zastaví zbytečný zásah ve chvíli, kdy škodí.",
      "en": "Quiet Deflection — stops a pointless intervention at the moment it hurts."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Laozi — daoistický archetyp přirozenosti a nevynucování. V lore OASIS: minimální governance, maximální laskavost.",
      "en": "Laozi — the Daoist archetype of naturalness and non-forcing. In OASIS lore: minimal governance, maximal kindness."
    },
    "quote": {
      "cs": "Kdo mnoho přikazuje, ten mnoho neví.",
      "en": "Whoever commands much knows little."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/102-laozi.webp",
      "full": "/oasis-assets/concept_svg/102-laozi.svg",
      "final": false
    },
    "circle": "china"
  },
  {
    "id": 105,
    "name": "Kongzi (Confucius)",
    "subtitle": {
      "cs": "Konfucius",
      "en": "Confucius"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Učitel vztahů a zodpovědnosti",
      "en": "Teacher of relationships and responsibility"
    },
    "location": {
      "cs": "Akátový dvůr",
      "en": "The apricot courtyard"
    },
    "questLine": {
      "cs": "Deník dobrých skutků",
      "en": "The Record of Good Deeds"
    },
    "teaching": {
      "cs": "Stát se nespraví zákony, ale tím, že si lidé začnou držet slovo.",
      "en": "A state is not fixed by laws, but by people keeping their word."
    },
    "ability": {
      "cs": "Mentorský kruh — zlepší učení a spolupráci ve skupině.",
      "en": "Mentor's Circle — improves learning and cooperation in the group."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Kongzi — etika vztahů, vzdělání, veřejné služby. V OASIS: onboarding mentorské struktury DAO.",
      "en": "Kongzi (Confucius) — ethics of relationships, education, public service. In OASIS: onboarding mentorship structures of the DAO."
    },
    "quote": {
      "cs": "Nestrojte mi pomník. Vychovejte někoho.",
      "en": "Do not build me a monument. Raise someone."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/103-kongzi-confucius.webp",
      "full": "/oasis-assets/concept_svg/103-kongzi-confucius.svg",
      "final": false
    },
    "circle": "china"
  },
  {
    "id": 106,
    "name": "Guan Yu / Guandi",
    "subtitle": {
      "cs": "Kuan Jü — věrnost a poctivost",
      "en": "Guan Yu — loyalty and honour"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Strážce dohod",
      "en": "Guardian of agreements"
    },
    "location": {
      "cs": "Tržiště se soudní síní",
      "en": "The market square with its court"
    },
    "questLine": {
      "cs": "Slovo drží i po smrti",
      "en": "A Word Kept Even After Death"
    },
    "teaching": {
      "cs": "Dohoda, která se hodí jen jedné straně, není dohoda. Je to past.",
      "en": "An agreement that suits only one side is not an agreement. It is a trap."
    },
    "ability": {
      "cs": "Pevná smlouva — zaručí, že dohoda nepřijde o obsah.",
      "en": "Binding Compact — ensures an agreement keeps its substance."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Guandi — kulturní božstvo loajality a obchodní etiky napříč diaspora chrámy.",
      "en": "Guandi — the cultural deity of loyalty and commerce ethics across diaspora temples."
    },
    "quote": {
      "cs": "Bojoval jsem pro člověka, ne pro peníze. Proto to platí.",
      "en": "I fought for a person, not for money. That is why it holds."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/104-guan-yu-guandi.webp",
      "full": "/oasis-assets/concept_svg/104-guan-yu-guandi.svg",
      "final": false
    },
    "circle": "china"
  },
  {
    "id": 107,
    "name": "Mazu",
    "subtitle": {
      "cs": "Má-cu — mořská přímluvkyně",
      "en": "Mazu — patroness of the sea"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která provází přes nebezpečnou vodu",
      "en": "She who guides across dangerous water"
    },
    "location": {
      "cs": "Přístav s majákem",
      "en": "The harbour with its lighthouse"
    },
    "questLine": {
      "cs": "Světlo pro všechny lodě",
      "en": "Light for Every Ship"
    },
    "teaching": {
      "cs": "Nebe není dlouhé proto, že by odpovídalo na modlitby. Je dlouhé, protože někdo drží světlo.",
      "en": "The sky is not long because it answers prayers. It is long because someone keeps the light."
    },
    "ability": {
      "cs": "Bezpečný přechod — sníží riziko na cestě, kterou neznáš.",
      "en": "Safe Passage — reduces risk on a road you do not know."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Mazu — patronka námořníků a bezpečné plavby. V lore OASIS: vzdělávací oblouky rizik cross-chain bridging.",
      "en": "Mazu — patroness of sailors and safe passage. In OASIS lore: cross-chain bridging risk-education arcs."
    },
    "quote": {
      "cs": "Neuklidňuji moře. Ukazuji, kde je břeh.",
      "en": "I do not calm the sea. I show where the shore is."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/105-mazu.webp",
      "full": "/oasis-assets/concept_svg/105-mazu.svg",
      "final": false
    },
    "circle": "china"
  },
  {
    "id": 108,
    "name": "Nezha",
    "subtitle": {
      "cs": "Nezha — nové tělo",
      "en": "Nezha — a new body"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo se znovu postaví jinak",
      "en": "He who rises again differently"
    },
    "location": {
      "cs": "Lotosové jezero",
      "en": "The lotus lake"
    },
    "questLine": {
      "cs": "Stvořit se znovu",
      "en": "To Make Oneself Again"
    },
    "teaching": {
      "cs": "Druhá šance není stejná cesta. Je to jiné tělo a stejná odpovědnost.",
      "en": "A second chance is not the same road. It is a different body and the same responsibility."
    },
    "ability": {
      "cs": "Lotosové tělo — obnoví toho, kdo byl považován za ztraceného.",
      "en": "Lotus Body — renews one who was considered lost."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Neža — folklórní bodhisattvický příběh mládí o přepsání osudu (ne náhodný pyro-vandalism gag).",
      "en": "Nezha — a folkloric bodhisattvic youth arc about rewriting destiny (not a random pyro-vandalism gag)."
    },
    "quote": {
      "cs": "Nezvítězil jsem, protože jsem silnější. Zvítězil jsem, protože jsem se vrátil.",
      "en": "I did not win because I was stronger. I won because I came back."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/106-nezha.webp",
      "full": "/oasis-assets/concept_svg/106-nezha.svg",
      "final": false
    },
    "circle": "china"
  },
  {
    "id": 109,
    "name": "Sun Wukong",
    "subtitle": {
      "cs": "Sun Wu-kchung — opice na cestě",
      "en": "Sun Wukong — the monkey on the road"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo zkouší trpělivost učitele",
      "en": "He who tests the teacher's patience"
    },
    "location": {
      "cs": "Hora květů a ovoce",
      "en": "The Mountain of Flowers and Fruit"
    },
    "questLine": {
      "cs": "Cesta na Západ",
      "en": "The Journey to the West"
    },
    "teaching": {
      "cs": "Síla bez kázně dojde daleko, ale ne domů.",
      "en": "Strength without discipline gets far, but not home."
    },
    "ability": {
      "cs": "Sedmdesát dva triků — obejde překážku, kterou nelze prorazit.",
      "en": "Seventy-Two Tricks — goes around an obstacle that cannot be broken."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Opičí král jako poutník-trickster, kterého disciplína lásky komunity (lore čelenky) naučila sloužit větší cestě než jen výhře ega.",
      "en": "The Monkey King as pilgrim-trickster, whom the discipline of community love (the headband lore) taught to serve a greater journey than just an ego win."
    },
    "quote": {
      "cs": "Můžu přeskočit svět. Neumím přeskočit sám sebe.",
      "en": "I can leap over the world. I cannot leap over myself."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/107-sun-wukong.webp",
      "full": "/oasis-assets/concept_svg/107-sun-wukong.svg",
      "final": false
    },
    "circle": "china"
  },
  {
    "id": 110,
    "name": "Yu the Great",
    "subtitle": {
      "cs": "Jü Veliký — ten, kdo zkrotil vodu",
      "en": "Yu the Great — who tamed the water"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Učitel trpělivé infrastruktury",
      "en": "Teacher of patient infrastructure"
    },
    "location": {
      "cs": "Soutěska Žluté řeky",
      "en": "The Yellow River gorge"
    },
    "questLine": {
      "cs": "Třináct let u řeky",
      "en": "Thirteen Years by the River"
    },
    "teaching": {
      "cs": "Vodu nezastavíš hrází. Naučíš ji, kudy má téct.",
      "en": "You cannot stop water with a dam. You teach it where to flow."
    },
    "ability": {
      "cs": "Koryto — usměrní tlak tak, aby neprotrhl systém.",
      "en": "Riverbed — channels pressure so it does not burst the system."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Yu — archetyp flood stewardship a inženýrské pokory (paralela public works a DAO infrastruktury).",
      "en": "Yu — archetype of flood stewardship and engineering humility (a public-works parallel to DAO infrastructure)."
    },
    "quote": {
      "cs": "Třikrát jsem šel kolem svého domu a nevešel. Až potom jsem vešel.",
      "en": "Three times I passed my house and did not enter. Only then did I enter."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/108-yu-the-great.webp",
      "full": "/oasis-assets/concept_svg/108-yu-the-great.svg",
      "final": false
    },
    "circle": "china"
  },
  {
    "id": 111,
    "name": "Lei Gong",
    "subtitle": {
      "cs": "Lej-kung — hromový soud",
      "en": "Lei Gong — the thunder court"
    },
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo hlásí porušení řádu",
      "en": "He who announces broken order"
    },
    "location": {
      "cs": "Nebeská strážnice",
      "en": "The celestial watchtower"
    },
    "questLine": {
      "cs": "Úder bez hněvu",
      "en": "The Strike Without Anger"
    },
    "teaching": {
      "cs": "Trest, který někdo vymyslel ve vzteku, se vždycky mine cílem.",
      "en": "A punishment devised in anger always misses its target."
    },
    "ability": {
      "cs": "Varovný hrom — oznámí chybu dřív, než přeroste v krizi.",
      "en": "Warning Thunder — announces a fault before it becomes a crisis."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Lei Gong — archetyp thunder tribunal folklóru — v OASIS jako automatizovaný sentinel varující na porušený governance invariant (ne trest případným omráčením hráče).",
      "en": "Lei Gong — the thunder-tribunal folklore archetype — in OASIS as an automated sentinel alerting on a broken governance invariant (not a punitive random stun on players)."
    },
    "quote": {
      "cs": "Hřmím proto, aby se to už nemuselo opakovat.",
      "en": "I thunder so that it need not happen again."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/109-lei-gong.webp",
      "full": "/oasis-assets/concept_svg/109-lei-gong.svg",
      "final": false
    },
    "circle": "china"
  },
  {
    "id": 112,
    "name": "Dewi Sri",
    "subtitle": {
      "cs": "Dewi Sri — matka rýže",
      "en": "Dewi Sri — the rice mother"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která učí sytit bez plýtvání",
      "en": "She who teaches feeding without waste"
    },
    "location": {
      "cs": "Terasy rýžových polí",
      "en": "The rice terraces"
    },
    "questLine": {
      "cs": "Zrno, které se nesmí ztratit",
      "en": "The Grain That Must Not Be Lost"
    },
    "teaching": {
      "cs": "Úroda není majetek. Je to půjčka, kterou splácíš příští sezóně.",
      "en": "A harvest is not property. It is a loan repaid to the next season."
    },
    "ability": {
      "cs": "Požehnání úrody — zajistí, že se jídlo dostane tam, kde chybí.",
      "en": "Harvest Blessing — ensures food reaches where it is missing."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Dewi Sri — bohyně rýže a plodnosti; lore OASIS: stewardship farm pooly + městské eventy proti plýtvání jídlem.",
      "en": "Dewi Sri — goddess of rice and fertility; OASIS lore: stewardship farm pools + anti food-waste city events."
    },
    "quote": {
      "cs": "Kdo jí sám, ten se nají jednou. Kdo dělí, ten se nají pořád.",
      "en": "Whoever eats alone eats once. Whoever shares eats always."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/110-dewi-sri.webp",
      "full": "/oasis-assets/concept_svg/110-dewi-sri.svg",
      "final": false
    },
    "circle": "indonesia"
  },
  {
    "id": 113,
    "name": "Nyai Roro Kidul",
    "subtitle": {
      "cs": "Nyai Roro Kidul — královna jižního moře",
      "en": "Nyai Roro Kidul — Queen of the Southern Sea"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Strážkyně pobřeží a společného majetku",
      "en": "Guardian of the shore and of the commons"
    },
    "location": {
      "cs": "Útes Uluwatu",
      "en": "The Uluwatu cliffs"
    },
    "questLine": {
      "cs": "Co patří všem",
      "en": "What Belongs to Everyone"
    },
    "teaching": {
      "cs": "Moře nikomu nepatří. Proto se o něj nikdo nehádá tak jako o pole.",
      "en": "The sea belongs to no one. That is why no one fights over it like over a field."
    },
    "ability": {
      "cs": "Příliv — vrátí pobřeží to, co mu bylo vzato.",
      "en": "The Tide — returns to the shore what was taken from it."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Nyai Roro Kidul — duchovní svrchovanost jižního moře v jávských narrativách; lore OASIS: klimatická migrace + pobřežní commons oblouky.",
      "en": "Nyai Roro Kidul — spiritual sovereignty of the southern sea in Javanese narratives; OASIS lore: climate migration + shoreline commons arcs."
    },
    "quote": {
      "cs": "Neber víc, než uneseš. Moře si to pamatuje.",
      "en": "Take no more than you can carry. The sea remembers."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/111-nyai-roro-kidul.webp",
      "full": "/oasis-assets/concept_svg/111-nyai-roro-kidul.svg",
      "final": false
    },
    "circle": "indonesia"
  },
  {
    "id": 114,
    "name": "Semar",
    "subtitle": {
      "cs": "Semar — moudrý šašek",
      "en": "Semar — the wise clown"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Prostředník, který řekne nepříjemnou pravdu",
      "en": "Mediator who says the uncomfortable truth"
    },
    "location": {
      "cs": "Stínové loutkové jeviště",
      "en": "The shadow-puppet stage"
    },
    "questLine": {
      "cs": "Slovo, které se nedá obejít",
      "en": "The Word You Cannot Walk Around"
    },
    "teaching": {
      "cs": "Nejlepší vyjednavač je ten, kterého ostatní podceňují.",
      "en": "The best negotiator is the one everyone underestimates."
    },
    "ability": {
      "cs": "Prostřednictví — přivede dvě strany k jedné věty.",
      "en": "Mediation — brings two sides to one sentence."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Semar — wayang punakawan archetyp, který odhaluje pravdu, jež se vládci bojí — v OASIS jako neutrální NPC mentor bridging konfliktů frakcí (ne terč krutých vtipů).",
      "en": "Semar — the wayang punakawan archetype who reveals the truth rulers fear — in OASIS as a neutral NPC mentor bridging faction conflicts (not the butt of cruel jokes)."
    },
    "quote": {
      "cs": "Nejsem nejchytřejší. Jen se bojím méně než vy.",
      "en": "I am not the cleverest. I am simply less afraid than you."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/112-semar.webp",
      "full": "/oasis-assets/concept_svg/112-semar.svg",
      "final": false
    },
    "circle": "indonesia"
  },
  {
    "id": 115,
    "name": "Batara Guru",
    "subtitle": {
      "cs": "Batara Guru — učitel bohů",
      "en": "Batara Guru — teacher of gods"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo překládá nesrozumitelné",
      "en": "He who translates the incomprehensible"
    },
    "location": {
      "cs": "Vrchol hory",
      "en": "The mountain summit"
    },
    "questLine": {
      "cs": "Dokument, kterému se rozumí",
      "en": "The Document People Understand"
    },
    "teaching": {
      "cs": "Co se nedá vysvětlit jednoduše, není ještě pochopené.",
      "en": "What cannot be explained simply is not yet understood."
    },
    "ability": {
      "cs": "Srozumitelné slovo — přeloží složité rozhodnutí do lidské řeči.",
      "en": "Plain Words — translates a complex decision into human speech."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Batara Guru — wayang lore učitel-božstvo suverénně přemosťující oblouky kosmického řádu.",
      "en": "Batara Guru — the wayang lore teacher-deity sovereignly bridging cosmic-order arcs."
    },
    "quote": {
      "cs": "Nepotřebuju víc slov. Potřebuju méně nejasností.",
      "en": "I do not need more words. I need less ambiguity."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/113-batara-guru.webp",
      "full": "/oasis-assets/concept_svg/113-batara-guru.svg",
      "final": false
    },
    "circle": "indonesia"
  },
  {
    "id": 116,
    "name": "Barong Ket",
    "subtitle": {
      "cs": "Barong — strážce rovnováhy",
      "en": "Barong — keeper of balance"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo uklidňuje hystérii",
      "en": "He who calms hysteria"
    },
    "location": {
      "cs": "Nádvoří chrámu",
      "en": "The temple courtyard"
    },
    "questLine": {
      "cs": "Tanec proti strachu",
      "en": "The Dance Against Fear"
    },
    "teaching": {
      "cs": "Panika je nakažlivější než jakákoli nemoc. Proto se s ní bojuje tancem.",
      "en": "Panic is more contagious than any disease. That is why it is fought with a dance."
    },
    "ability": {
      "cs": "Rozptýlení hrůzy — uklidní skupinu v panice.",
      "en": "Hysteria Cleanse — calms a group in panic."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Barong Ket — archetyp ochrany komunity před maligním chaosem.",
      "en": "Barong Ket — the archetype of community protection against malign chaos."
    },
    "quote": {
      "cs": "Nejsem hodný. Jsem klidný. To je rozdíl.",
      "en": "I am not kind. I am calm. That is the difference."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/114-barong-ket.webp",
      "full": "/oasis-assets/concept_svg/114-barong-ket.svg",
      "final": false
    },
    "circle": "indonesia"
  },
  {
    "id": 117,
    "name": "Garuda",
    "subtitle": {
      "cs": "Garuda — křídla, která nesou",
      "en": "Garuda — wings that carry"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo doručí pomoc včas",
      "en": "He who delivers help in time"
    },
    "location": {
      "cs": "Vysoko nad souostrovím",
      "en": "High above the archipelago"
    },
    "questLine": {
      "cs": "Rychlost, která neztratí směr",
      "en": "Speed That Does Not Lose Direction"
    },
    "teaching": {
      "cs": "Nejrychlejší není ten, kdo letí nejdřív. Je ten, kdo doletí.",
      "en": "The fastest is not the one who takes off first. It is the one who arrives."
    },
    "ability": {
      "cs": "Křídla pomoci — dopraví pomoc tam, kde se nedá dojet.",
      "en": "Wings of Aid — carries help where you cannot drive."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Garuda — mýtický pták ochrany a jednoty, symbolika v Indonésii i širší jihovýchodní Asii.",
      "en": "Garuda — the mythic bird of protection and unity, a symbol in Indonesia and wider Southeast Asia."
    },
    "quote": {
      "cs": "Nesu to, co je potřeba. To, co je cenné, nese někdo jiný.",
      "en": "I carry what is needed. What is precious is carried by someone else."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/115-garuda.webp",
      "full": "/oasis-assets/concept_svg/115-garuda.svg",
      "final": false
    },
    "circle": "indonesia"
  },
  {
    "id": 118,
    "name": "Gatotkaca",
    "subtitle": {
      "cs": "Gatotkaca — ochránce v oblacích",
      "en": "Gatotkaca — guardian in the clouds"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo doprovází přes nebezpečí",
      "en": "He who escorts through danger"
    },
    "location": {
      "cs": "Oblačný záliv",
      "en": "The cloud inlet"
    },
    "questLine": {
      "cs": "Doprovod bez ztráty",
      "en": "The Escort Without Loss"
    },
    "teaching": {
      "cs": "Hrdinství je většinou jen to, že dojdeš zpátky s tím, koho jsi vzal.",
      "en": "Heroism is mostly just coming back with the person you took with you."
    },
    "ability": {
      "cs": "Oblačný let — ochrání svěřenou osobu na cestě.",
      "en": "Cloud Flight — shields the person entrusted to you on the way."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Gatotkaca — lokálně milovaný hrdina odvozený z Mahábháraty v indonéském performativním umění (ne mechanický duplikát #11/#12 — jiná questline zdůrazňující ochranu civilistů).",
      "en": "Gatotkaca — the locally beloved Mahābhārata-derived hero of Indonesian performing arts (not a mechanical duplicate of #11/#12 — a different questline emphasizing civilian shielding)."
    },
    "quote": {
      "cs": "Nebojuju nejlíp. Doprovázím nejjistěji.",
      "en": "I do not fight best. I escort most surely."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/116-gatotkaca.webp",
      "full": "/oasis-assets/concept_svg/116-gatotkaca.svg",
      "final": false
    },
    "circle": "indonesia"
  },
  {
    "id": 119,
    "name": "Prince Panji",
    "subtitle": {
      "cs": "Princ Pandži",
      "en": "Prince Panji"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo hledá, kým doopravdy je",
      "en": "He who searches for who he really is"
    },
    "location": {
      "cs": "Královský dvůr Kediri",
      "en": "The royal court of Kediri"
    },
    "questLine": {
      "cs": "Cesta, na které se ztrácí jméno",
      "en": "The Road Where the Name Is Lost"
    },
    "teaching": {
      "cs": "Identita není titul. Je to to, co zůstane, když titul ztratíš.",
      "en": "Identity is not a title. It is what remains when you lose the title."
    },
    "ability": {
      "cs": "Pravá tvář — ukáže, kdo je kdo i přes převleky.",
      "en": "True Face — reveals who is who, through any disguise."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Panji — archetyp výpravy pro milovanou + obnovy občanského řádu.",
      "en": "Panji — the archetype of the quest for the beloved + restoring civic order."
    },
    "quote": {
      "cs": "Hledal jsem ji. Našel jsem sebe. Bylo to stejné hledání.",
      "en": "I searched for her. I found myself. It was the same search."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/117-prince-panji.webp",
      "full": "/oasis-assets/concept_svg/117-prince-panji.svg",
      "final": false
    },
    "circle": "indonesia"
  },
  {
    "id": 120,
    "name": "Roro Jonggrang",
    "subtitle": {
      "cs": "Roro Jonggrang — smlouva o chrámu",
      "en": "Roro Jonggrang — the temple bargain"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která hájí hranice, ne mstu",
      "en": "She who defends boundaries, not revenge"
    },
    "location": {
      "cs": "Chrám Prambanan",
      "en": "Prambanan temple"
    },
    "questLine": {
      "cs": "Tisíc soch a jeden podmín",
      "en": "A Thousand Statues and One Condition"
    },
    "teaching": {
      "cs": "Svépráví není odmítnutí. Je to právo říct: takhle ne.",
      "en": "Self-determination is not refusal. It is the right to say: not like this."
    },
    "ability": {
      "cs": "Vřeteno — zastaví příliš rychlý nápad v půlce věty.",
      "en": "Spindle — stops an overly fast idea mid-sentence."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Roro Jonggrang lore — archetyp vzniku chrámu + smlouvání + respektu hranic, rekonstruován jako agency-pozitivní vyprávění (konzultant povinný).",
      "en": "Roro Jonggrang lore — archetype of temple genesis + bargaining + boundary respect, reconstructed as an agency-positive narrative (consultant mandatory)."
    },
    "quote": {
      "cs": "Nezlomila jsem slib. Někdo ho chtěl splnit dřív, než jsem dostala právo mluvit.",
      "en": "I did not break the promise. Someone wanted it kept before I had the right to speak."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/118-roro-jonggrang.webp",
      "full": "/oasis-assets/concept_svg/118-roro-jonggrang.svg",
      "final": false
    },
    "circle": "indonesia"
  },
  {
    "id": 121,
    "name": "Dewi Nawang Wulan",
    "subtitle": {
      "cs": "Dewi Nawang Wulan — měsíční pohostinnost",
      "en": "Dewi Nawang Wulan — lunar hospitality"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která učí vzácnosti přijmout pomoc",
      "en": "She who teaches the rarity of receiving help"
    },
    "location": {
      "cs": "Hráz rybníka",
      "en": "The pond dam"
    },
    "questLine": {
      "cs": "Host, který zůstává",
      "en": "The Guest Who Stays"
    },
    "teaching": {
      "cs": "Pohostinnost není jen dávání. Je to i umění nechat si pomoci.",
      "en": "Hospitality is not only giving. It is also the art of letting yourself be helped."
    },
    "ability": {
      "cs": "Útočiště — obnoví sílu tomu, kdo se staral o druhé.",
      "en": "Shelter — restores strength to whoever cared for others."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Nawang Wulan — archetyp lunární péče o etiku + reciproční hostitelství (folklór sestupu měsíce adaptovaný jako oblouky finanční inkluze a přístřeší).",
      "en": "Nawang Wulan — archetype of lunar care ethics + reciprocal hospitality (the moon-descent folklore adapted as financial-inclusion and shelter arcs)."
    },
    "quote": {
      "cs": "Neodešla jsem kvůli práci. Odešla jsem, protože jsem byla jediná, kdo mohl pokračovat.",
      "en": "I did not leave because of the work. I left because I was the only one who could go on."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/119-dewi-nawang-wulan.webp",
      "full": "/oasis-assets/concept_svg/119-dewi-nawang-wulan.svg",
      "final": false
    },
    "circle": "indonesia"
  },
  {
    "id": 122,
    "name": "Seven Sisters Songline Steward",
    "subtitle": {
      "cs": "Sedm sester — cesta po linii",
      "en": "The Seven Sisters — the songline"
    },
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Průvodkyně noční oblohou",
      "en": "Guides through the night sky"
    },
    "location": {
      "cs": "Pouštní obloha, noční táboření",
      "en": "The desert sky, a night camp"
    },
    "questLine": {
      "cs": "Hvězdy, které se učí zpaměti",
      "en": "Stars Learned by Heart"
    },
    "teaching": {
      "cs": "Obloha je mapa. Kdo ji zná, neztratí se ani bez kompasu.",
      "en": "The sky is a map. Whoever knows it need never be lost, compass or not."
    },
    "ability": {
      "cs": "Nebe nad cestou — ukáže směr tam, kde lidské mapy končí.",
      "en": "Sky Over the Road — shows direction where human maps end."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Archetyp astronomie + kinship stewardship známého souhvězdí pod mnoha jmény — OASIS ho používá k výchově o multiplicitách.",
      "en": "An astronomy + kinship-stewardship archetype of the famous star cluster known by many names — OASIS uses it to teach about multiplicities."
    },
    "quote": {
      "cs": "Nespoléhej na znamení. Nauč se cestu.",
      "en": "Do not rely on the sign. Learn the road."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/120-seven-sisters-songline-steward.webp",
      "full": "/oasis-assets/concept_svg/120-seven-sisters-songline-steward.svg",
      "final": false
    },
    "circle": "australia"
  },
  {
    "id": 123,
    "name": "Rainbow Serpent Country Law",
    "subtitle": {
      "cs": "Duhový had — zákon země",
      "en": "Rainbow Serpent — the law of country"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Strážce vody a krajiny",
      "en": "Keeper of water and country"
    },
    "location": {
      "cs": "Řeka, která se vrací do země",
      "en": "The river that returns into the land"
    },
    "questLine": {
      "cs": "Povodí patří krajině",
      "en": "The Catchment Belongs to the Country"
    },
    "teaching": {
      "cs": "Voda si najde cestu, kterou jí krajina dovolí. Vy si cestu jen půjčujete.",
      "en": "Water takes the way the land allows. You only borrow the way."
    },
    "ability": {
      "cs": "Suché řečiště — vrátí vodu tam, kde byla vysušená.",
      "en": "Dry Riverbed — returns water where it had been dried out."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Hydrologické + právně-kosmologické rámy péče o krajinu („Country“).",
      "en": "Hydrological + legal-cosmological frames of landscape care ('Country')."
    },
    "quote": {
      "cs": "Nejsem tady proto, aby se lidé měli lépe. Jsem tady, aby to tady zůstalo.",
      "en": "I am not here so people do better. I am here so this place remains."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/121-rainbow-serpent-country-law.webp",
      "full": "/oasis-assets/concept_svg/121-rainbow-serpent-country-law.svg",
      "final": false
    },
    "circle": "australia"
  },
  {
    "id": 124,
    "name": "Bunjil",
    "subtitle": {
      "cs": "Bunjil — orel stvořitel",
      "en": "Bunjil — the creating eagle"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo hledí na rovnováhu shora",
      "en": "He who looks at balance from above"
    },
    "location": {
      "cs": "Vysoké skály nad údolím",
      "en": "The high escarpment above the valley"
    },
    "questLine": {
      "cs": "Pohled orla",
      "en": "The Eagle's View"
    },
    "teaching": {
      "cs": "Země se nedá chránit strom po stromu. Musíš vidět, jak spolu drží.",
      "en": "Land cannot be protected tree by tree. You have to see how they hold together."
    },
    "ability": {
      "cs": "Ptačí pohled — odhalí souvislost, kterou z trávy nevidíš.",
      "en": "Bird's Eye — reveals a connection you cannot see from the grass."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Bunjil — creator-bird archetyp dokumentovaný v některých narrativách Kulin.",
      "en": "Bunjil — the creator-bird archetype documented in some Kulin narratives."
    },
    "quote": {
      "cs": "Postavil jsem nebe vysoko proto, aby ses musel rozhodovat z dálky.",
      "en": "I set the sky high so you would have to decide from a distance."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/122-bunjil.webp",
      "full": "/oasis-assets/concept_svg/122-bunjil.svg",
      "final": false
    },
    "circle": "australia"
  },
  {
    "id": 125,
    "name": "Baiame",
    "subtitle": {
      "cs": "Baiame — otec oblohy",
      "en": "Baiame — sky father"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Strážce trpělivého učení",
      "en": "Keeper of patient teaching"
    },
    "location": {
      "cs": "Vodní dírka v suché zemi",
      "en": "The waterhole in dry country"
    },
    "questLine": {
      "cs": "Učit se posloucháním",
      "en": "Learning by Listening"
    },
    "teaching": {
      "cs": "Nejdřív poslouchej zemi. Pak se ptej lidí.",
      "en": "First listen to the land. Then ask the people."
    },
    "ability": {
      "cs": "Trpělivé naslouchání — odhalí, co se místo snaží říct.",
      "en": "Patient Listening — reveals what a place is trying to say."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Sky father archetypy spojené s výchovou o koloniálním mapovacím násilí.",
      "en": "Sky father archetypes connected to lore education about colonial mapping violence."
    },
    "quote": {
      "cs": "Nemluvím. Nechávám to na tobě.",
      "en": "I do not speak. I leave it to you."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/123-baiame.webp",
      "full": "/oasis-assets/concept_svg/123-baiame.svg",
      "final": false
    },
    "circle": "australia"
  },
  {
    "id": 126,
    "name": "Tagai Navigator",
    "subtitle": {
      "cs": "Tagai — navigátor Torresovy úžiny",
      "en": "Tagai — Torres Strait navigator"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo čte čas z hvězd a přílivu",
      "en": "He who reads time from stars and tide"
    },
    "location": {
      "cs": "Kánoe na mělčině",
      "en": "A canoe on the shallows"
    },
    "questLine": {
      "cs": "Cesta podle přílivu",
      "en": "The Passage by Tide"
    },
    "teaching": {
      "cs": "Správné rozhodnutí ve špatném čase je špatné rozhodnutí.",
      "en": "A right decision at the wrong time is a wrong decision."
    },
    "ability": {
      "cs": "Přílivová brána — otevře přechod na přílivu, který nastane.",
      "en": "Tidal Gate — opens the crossing at the tide that is coming."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Tagai — navigátor z lore Torres Strait Islanders (veřejný antropologický rámec + brány komunitního souhlasu).",
      "en": "Tagai — a navigator spirit of Torres Strait Islanders lore (public anthropology framing + community consent gates)."
    },
    "quote": {
      "cs": "Nečekám na lepší vítr. Čekám na správný příliv.",
      "en": "I do not wait for better wind. I wait for the right tide."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/124-tagai-navigator.webp",
      "full": "/oasis-assets/concept_svg/124-tagai-navigator.svg",
      "final": false
    },
    "circle": "australia"
  },
  {
    "id": 127,
    "name": "Celestial Emu Dreaming Steward",
    "subtitle": {
      "cs": "Nebeský emu",
      "en": "The Celestial Emu"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Průvodce tmou bez strachu",
      "en": "A guide through darkness without fear"
    },
    "location": {
      "cs": "Jižní kříž a temná obloha",
      "en": "The Southern Cross and the dark sky"
    },
    "questLine": {
      "cs": "Tvar v prázdnu",
      "en": "The Shape in the Emptiness"
    },
    "teaching": {
      "cs": "To, co chybí, taky tvoří obraz. Prázdno není nicota.",
      "en": "What is missing also makes the picture. Emptiness is not nothing."
    },
    "ability": {
      "cs": "Čtení prázdna — najde smysl v tom, co tam není.",
      "en": "Reading the Emptiness — finds meaning in what is not there."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Využívá veřejně vyučované odkazy na aboridžinskou astronomii (Emu in the Sky) jako sloučené oblouky STEM + etiky.",
      "en": "Uses publicly taught references to Aboriginal astronomy (Emu in the Sky) as fused STEM + ethics arcs."
    },
    "quote": {
      "cs": "Díváš se na hvězdy. Já se dívám na prostor mezi nimi.",
      "en": "You look at the stars. I look at the space between them."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/125-celestial-emu-dreaming-steward.webp",
      "full": "/oasis-assets/concept_svg/125-celestial-emu-dreaming-steward.svg",
      "final": false
    },
    "circle": "australia"
  },
  {
    "id": 128,
    "name": "Djang'kawu Creator Voyagers",
    "subtitle": {
      "cs": "Djang'kawu — putující stvořitelé",
      "en": "Djang'kawu — the creator voyagers"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ti, kdo přinesou zákon a semeno",
      "en": "They who bring law and seed"
    },
    "location": {
      "cs": "Pobřeží Yolŋu",
      "en": "The Yolŋu coast"
    },
    "questLine": {
      "cs": "Příchod se zákonem",
      "en": "Arriving With the Law"
    },
    "teaching": {
      "cs": "Nový začátek má smysl jen tehdy, když přinese pravidla, která chrání slabší.",
      "en": "A new beginning only makes sense if it brings rules that protect the weaker."
    },
    "ability": {
      "cs": "Semeno zákona — položí pravidlo, které vydrží generace.",
      "en": "Seed of Law — plants a rule that outlives generations."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Djanggawu / Djang'kawu — oblouky stvořitelských poutníků o založení sladkovodního a ceremoniálně-právního lešení (abstrahováno).",
      "en": "Djanggawu / Djang'kawu — creator-voyager arcs about establishing freshwater and ceremonial-law scaffolding (abstracted)."
    },
    "quote": {
      "cs": "Nepřicházíme vzít. Přicházíme zasadit.",
      "en": "We do not come to take. We come to plant."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/126-djang-kawu-creator-voyagers.webp",
      "full": "/oasis-assets/concept_svg/126-djang-kawu-creator-voyagers.svg",
      "final": false
    },
    "circle": "australia"
  },
  {
    "id": 129,
    "name": "Namarrkon",
    "subtitle": {
      "cs": "Namarrkon — blesk v krajině",
      "en": "Namarrkon — lightning in country"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo připomíná cenu výpadku",
      "en": "He who reminds of the cost of outage"
    },
    "location": {
      "cs": "Bouřkový hřeben Arnhem",
      "en": "The Arnhem storm ridge"
    },
    "questLine": {
      "cs": "Rána, která učí",
      "en": "The Blow That Teaches"
    },
    "teaching": {
      "cs": "Blesk nevybírá viníka. Proto se systémy stavějí tak, aby vydržely.",
      "en": "Lightning does not choose a culprit. That is why systems are built to withstand."
    },
    "ability": {
      "cs": "Varovný výboj — odhalí slabé místo dřív, než udeří bouře.",
      "en": "Warning Bolt — exposes the weak point before the storm hits."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Namarrkon — bleskový předek zmiňovaný v zemích Arnhem ve veřejně dostupných průvodcích.",
      "en": "Namarrkon — a lightning ancestor mentioned in Arnhem lands in publicly available guides."
    },
    "quote": {
      "cs": "Nejsem trest. Jsem zkouška, kterou jste odkládali.",
      "en": "I am not punishment. I am the test you kept postponing."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/127-namarrkon.webp",
      "full": "/oasis-assets/concept_svg/127-namarrkon.svg",
      "final": false
    },
    "circle": "australia"
  },
  {
    "id": 130,
    "name": "Country Knowledge Walk (Tjukurpa education frame)",
    "subtitle": {
      "cs": "Chůze krajinou — učení poslechem",
      "en": "Country Walk — learning by listening"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Rámec, ve kterém se poznává země",
      "en": "A frame in which country is learned"
    },
    "location": {
      "cs": "Pěšina mezi vodními dírkami",
      "en": "A path between waterholes"
    },
    "questLine": {
      "cs": "Každý krok je otázka",
      "en": "Every Step Is a Question"
    },
    "teaching": {
      "cs": "Krajinu nepoznáš z mapy. Poznáš ji chozením a mlčením.",
      "en": "You do not learn country from a map. You learn it by walking and keeping quiet."
    },
    "ability": {
      "cs": "Čtení země — ukáže stopu, kterou jinde nevidíš.",
      "en": "Reading Country — shows the trace you cannot see elsewhere."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Walking Country jako etické získávání poznání.",
      "en": "Walking Country as ethical knowledge acquisition."
    },
    "quote": {
      "cs": "Neptej se, jak daleko. Ptej se, co jsi cestou minul.",
      "en": "Do not ask how far. Ask what you walked past."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/128-country-knowledge-walk-tjukurpa-education-frame.webp",
      "full": "/oasis-assets/concept_svg/128-country-knowledge-walk-tjukurpa-education-frame.svg",
      "final": false
    },
    "circle": "australia"
  },
  {
    "id": 131,
    "name": "Makarrata Treaty Bridge",
    "subtitle": {
      "cs": "Makarrata — most k pravdě",
      "en": "Makarrata — the bridge to truth"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo srovnává, co bylo rozděleno",
      "en": "He who makes even what was divided"
    },
    "location": {
      "cs": "Místo setkání dvou řečí",
      "en": "The meeting place of two languages"
    },
    "questLine": {
      "cs": "Pravda dřív než smlouva",
      "en": "Truth Before Treaty"
    },
    "teaching": {
      "cs": "Usmíření bez pojmenování škody je jen zdvořilost.",
      "en": "Reconciliation without naming the harm is only politeness."
    },
    "ability": {
      "cs": "Náprava — otevře dohodu, která nebyla možná, dokud se mlčelo.",
      "en": "Repair — opens the agreement that was impossible while silence held."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Treaty/truth/restituce jako technický governance most — paralela k ZION DAO (nestranické lore).",
      "en": "Treaty/truth/restitution as a technical governance bridge — a parallel to ZION DAO (non-partisan lore)."
    },
    "quote": {
      "cs": "Nejdřív řekni, co se stalo. Pak se dá mluvit dál.",
      "en": "First say what happened. Then we can speak further."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/129-makarrata-treaty-bridge.webp",
      "full": "/oasis-assets/concept_svg/129-makarrata-treaty-bridge.svg",
      "final": false
    },
    "circle": "australia"
  },
  {
    "id": 132,
    "name": "Papatūānuku",
    "subtitle": {
      "cs": "Papatūānuku — matka země",
      "en": "Papatūānuku — earth mother"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která dává půdu pod nohama",
      "en": "She who gives the ground beneath your feet"
    },
    "location": {
      "cs": "Země pod nohama",
      "en": "The earth beneath you"
    },
    "questLine": {
      "cs": "Půda, která si pamatuje",
      "en": "The Soil That Remembers"
    },
    "teaching": {
      "cs": "Neptej se, co ti země dá. Ptej se, co jí necháš.",
      "en": "Do not ask what the land gives you. Ask what you leave it."
    },
    "ability": {
      "cs": "Náruč země — obnoví místo, které bylo vyčerpané.",
      "en": "Earth's Embrace — restores a place that was exhausted."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Papatūānuku — kosmologie Země-matky v rámu Māori (křížový odkaz pacifické pozemkové etiky).",
      "en": "Papatūānuku — Earth-mother cosmology of the Māori frame (cross-reference to Pacific land ethics)."
    },
    "quote": {
      "cs": "Držím tě. Nemusíš to vidět, abys to cítil.",
      "en": "I hold you. You need not see it to feel it."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/130-papatuanuku.webp",
      "full": "/oasis-assets/concept_svg/130-papatuanuku.svg",
      "final": false
    },
    "circle": "aotearoa"
  },
  {
    "id": 133,
    "name": "Ranginui",
    "subtitle": {
      "cs": "Ranginui — otec oblohy",
      "en": "Ranginui — sky father"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo drží prostor nad krajinou",
      "en": "He who holds the space above the land"
    },
    "location": {
      "cs": "Obloha nad horami",
      "en": "The sky above the mountains"
    },
    "questLine": {
      "cs": "Mezi nebem a zemí",
      "en": "Between Sky and Earth"
    },
    "teaching": {
      "cs": "Někdy je láska to, že se necháš oddělit, aby ostatní mohli žít.",
      "en": "Sometimes love is letting yourself be separated so that others may live."
    },
    "ability": {
      "cs": "Otevřené nebe — projasní místo, které se dusilo.",
      "en": "Open Sky — clears a place that was suffocating."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ranginui — potence nebes v kosmu Māori; paralela climate transparency overlayů.",
      "en": "Ranginui — sky potency of the Māori cosmos; a parallel to climate-transparency overlays."
    },
    "quote": {
      "cs": "Pláču rosou. To je všechno, co mi zbylo.",
      "en": "I weep as dew. That is all I have left."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/131-ranginui.webp",
      "full": "/oasis-assets/concept_svg/131-ranginui.svg",
      "final": false
    },
    "circle": "aotearoa"
  },
  {
    "id": 134,
    "name": "Tāne Mahuta",
    "subtitle": {
      "cs": "Tāne Mahuta — pán lesa",
      "en": "Tāne Mahuta — lord of the forest"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo odděluje, aby bylo světlo",
      "en": "He who separates so there may be light"
    },
    "location": {
      "cs": "Prastarý les Waipoua",
      "en": "The ancient Waipoua forest"
    },
    "questLine": {
      "cs": "První strom",
      "en": "The First Tree"
    },
    "teaching": {
      "cs": "Růst znamená rozhodnout se, co pustíš, aby mělo ostatní místo.",
      "en": "Growing means deciding what to release so others have room."
    },
    "ability": {
      "cs": "Vzcházení — vrátí život do vykáceného místa.",
      "en": "Regrowth — returns life to a place that was cut down."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Táne — separator + nositel života, strážce lesa v rámu Māori (žádná glorifikace ilegální těžby).",
      "en": "Tāne — the separator + life-bringer, forest guardian of the Māori frame (no illegal-logging glorification arcs)."
    },
    "quote": {
      "cs": "Stojím tak dlouho, že si mě pletou s krajinou.",
      "en": "I have stood so long they mistake me for the landscape."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/132-tane-mahuta.webp",
      "full": "/oasis-assets/concept_svg/132-tane-mahuta.svg",
      "final": false
    },
    "circle": "aotearoa"
  },
  {
    "id": 135,
    "name": "Tangaroa (Māori strand)",
    "subtitle": {
      "cs": "Tangaroa — pán oceánu",
      "en": "Tangaroa — lord of the ocean"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Strážce mořského bohatství",
      "en": "Guardian of the sea's wealth"
    },
    "location": {
      "cs": "Otevřené moře za útesem",
      "en": "The open sea beyond the reef"
    },
    "questLine": {
      "cs": "Rāhui — moře si musí odpočinout",
      "en": "Rāhui — the Sea Must Rest"
    },
    "teaching": {
      "cs": "Moře nevydá víc, když na něj tlačíš. Vydá víc, když mu necháš čas.",
      "en": "The sea gives no more when you push it. It gives more when you give it time."
    },
    "ability": {
      "cs": "Mořský příděl — omezí nadměrný výlov a obnoví zásobu.",
      "en": "Sea Quota — limits overfishing and restores the stock."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Tangaroa — potence moře + etika rybolovu po způsobu Māori.",
      "en": "Tangaroa — sea potency + fisheries ethics in the Māori way."
    },
    "quote": {
      "cs": "Nebráním ti rybařit. Bráním ti vzít poslední.",
      "en": "I do not stop you fishing. I stop you taking the last one."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/133-tangaroa-maori-strand.webp",
      "full": "/oasis-assets/concept_svg/133-tangaroa-maori-strand.svg",
      "final": false
    },
    "circle": "aotearoa"
  },
  {
    "id": 136,
    "name": "Rongo",
    "subtitle": {
      "cs": "Rongo — mír a pěstování",
      "en": "Rongo — peace and cultivation"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo učí sklízet bez konfliktu",
      "en": "He who teaches harvest without conflict"
    },
    "location": {
      "cs": "Zahrada kumara",
      "en": "The kumara garden"
    },
    "questLine": {
      "cs": "Dohoda o úrodě",
      "en": "The Harvest Accord"
    },
    "teaching": {
      "cs": "Kdo se hádá o úrodu, přijde o čas na setí.",
      "en": "Whoever argues over the harvest loses the time to sow."
    },
    "ability": {
      "cs": "Polní smír — zastaví spor dřív, než přijde o úrodu.",
      "en": "Field Truce — ends a quarrel before the harvest is lost."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Rongo — mír + kultivovaná jídla v rámu Māori, paralelně PvP ceasefire sezóny eticky.",
      "en": "Rongo — peace + cultivated foods of the Māori frame, paralleling ethical PvP ceasefire seasons."
    },
    "quote": {
      "cs": "Mír není slabost. Je to dobře spočítaná práce.",
      "en": "Peace is not weakness. It is well-calculated work."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/134-rongo.webp",
      "full": "/oasis-assets/concept_svg/134-rongo.svg",
      "final": false
    },
    "circle": "aotearoa"
  },
  {
    "id": 137,
    "name": "Tūmatauenga",
    "subtitle": {
      "cs": "Tūmatauenga — obránce rodu",
      "en": "Tūmatauenga — defender of kin"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo chrání, dokud je co chránit",
      "en": "He who protects while there is anything to protect"
    },
    "location": {
      "cs": "Opevněná pā",
      "en": "The fortified pā"
    },
    "questLine": {
      "cs": "Obrana, která se ptá",
      "en": "Defence That Asks"
    },
    "teaching": {
      "cs": "Není statečné všechno bránit. Statečné je vědět, co bránit.",
      "en": "It is not brave to defend everything. It is brave to know what to defend."
    },
    "ability": {
      "cs": "Hradba rodu — ochrání nejslabší členy skupiny.",
      "en": "Kin Wall — shields the weakest members of the group."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Tú — agentura konfliktu v rámu Māori, použitá jen jako oblouky ochrany.",
      "en": "Tū — the agency of conflict in the Māori frame, used only as protection arcs."
    },
    "quote": {
      "cs": "Nebojuju za sebe. Za sebe už jsem vyhrál.",
      "en": "I do not fight for myself. For myself, I have already won."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/135-tumatauenga.webp",
      "full": "/oasis-assets/concept_svg/135-tumatauenga.svg",
      "final": false
    },
    "circle": "aotearoa"
  },
  {
    "id": 138,
    "name": "Tāwhirimatea",
    "subtitle": {
      "cs": "Tāwhirimatea — pán větrů",
      "en": "Tāwhirimatea — lord of winds"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo zkouší, co drží pohromadě",
      "en": "He who tests what holds together"
    },
    "location": {
      "cs": "Větrný hřeben",
      "en": "The wind ridge"
    },
    "questLine": {
      "cs": "Bouře, která prověří",
      "en": "The Storm That Tests"
    },
    "teaching": {
      "cs": "Co se rozpadne ve větru, se rozpadlo už dřív. Vítr to jen ukázal.",
      "en": "What falls apart in the wind fell apart earlier. The wind only showed it."
    },
    "ability": {
      "cs": "Náraz větru — otestuje slabé místo bez varování.",
      "en": "Gust — tests the weak point without warning."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Táwhirimátea — archetyp větrů a bouří; OASIS jako resilience stress testy pro topologii sítě.",
      "en": "Tāwhirimātea — archetype of winds and storms; OASIS uses it as resilience stress tests for network topology."
    },
    "quote": {
      "cs": "Nebourám domy. Odhaluju, které už nedržely.",
      "en": "I do not knock down houses. I reveal which ones already did not hold."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/136-tawhirimatea.webp",
      "full": "/oasis-assets/concept_svg/136-tawhirimatea.svg",
      "final": false
    },
    "circle": "aotearoa"
  },
  {
    "id": 139,
    "name": "Haumiatiketike",
    "subtitle": {
      "cs": "Haumiatiketike — divoká potrava",
      "en": "Haumiatiketike — wild food"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo učí brát jen to, co je potřeba",
      "en": "He who teaches taking only what is needed"
    },
    "location": {
      "cs": "Kapradinový les",
      "en": "The fern forest"
    },
    "questLine": {
      "cs": "Sběr, který nevyprázdní",
      "en": "Foraging That Does Not Empty"
    },
    "teaching": {
      "cs": "Kdo vybere všechno, bude příště hladový i když bude les plný.",
      "en": "Whoever picks everything will go hungry next time even if the forest is full."
    },
    "ability": {
      "cs": "Sběr bez újmy — získá potravu a nechá místo růst.",
      "en": "Harmless Foraging — gains food while the place keeps growing."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Haumietiketike — nekultivovaná výživa v rámu Māori.",
      "en": "Haumietiketike — uncultivated sustenance of the Māori frame."
    },
    "quote": {
      "cs": "Ber dvě. Třetí si necháš na jindy.",
      "en": "Take two. The third you leave for later."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/137-haumiatiketike.webp",
      "full": "/oasis-assets/concept_svg/137-haumiatiketike.svg",
      "final": false
    },
    "circle": "aotearoa"
  },
  {
    "id": 140,
    "name": "Hine-nui-te-pō",
    "subtitle": {
      "cs": "Hine-nui-te-pō — brána přerodu",
      "en": "Hine-nui-te-pō — the gate of transformation"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která drží hranici mezi životem a koncem",
      "en": "She who holds the border between life and ending"
    },
    "location": {
      "cs": "Temná strana obzoru",
      "en": "The far side of the horizon"
    },
    "questLine": {
      "cs": "Práh, přes který se jde jednou",
      "en": "The Threshold Crossed Once"
    },
    "teaching": {
      "cs": "Konec není nepřítel života. Je to jeho tvar.",
      "en": "The end is not the enemy of life. It is its shape."
    },
    "ability": {
      "cs": "Přerod — provede tě změnou, kterou nejde vrátit.",
      "en": "Transformation — carries you through a change you cannot undo."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Hine — práh podsvětí / transformace v kosmologii Māori.",
      "en": "Hine — underworld threshold / transformation in Māori cosmology."
    },
    "quote": {
      "cs": "Našli mě všichni, kdo hledali cestu. Nikdo, kdo hledal cestu zpátky.",
      "en": "Those who sought a way forward found me. Those who sought a way back did not."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/138-hine-nui-te-po.webp",
      "full": "/oasis-assets/concept_svg/138-hine-nui-te-po.svg",
      "final": false
    },
    "circle": "aotearoa"
  },
  {
    "id": 141,
    "name": "Kupe Navigator",
    "subtitle": {
      "cs": "Kupe — navigátor prvního návratu",
      "en": "Kupe — navigator of the first return"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo najde cestu bez přístroje",
      "en": "He who finds the way without instruments"
    },
    "location": {
      "cs": "Záď kánoe na širém moři",
      "en": "The stern of a canoe on the open sea"
    },
    "questLine": {
      "cs": "Cesta, kterou nikdo nezapsal",
      "en": "The Road No One Wrote Down"
    },
    "teaching": {
      "cs": "Přístroj ti řekne, kde jsi. Jen hlava ti řekne, kde je domov.",
      "en": "An instrument tells you where you are. Only your head tells you where home is."
    },
    "ability": {
      "cs": "Odhad — dovede tě domů i bez signálu.",
      "en": "Dead Reckoning — brings you home even without a signal."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Kupe — plavební brillance otevírající tradice waka Aotearoa v uctivých vzdělávacích rámcích.",
      "en": "Kupe — voyaging brilliance opening the Aotearoa waka traditions in respectful educational frames."
    },
    "quote": {
      "cs": "Nezabloudil jsem. Jen jsem delší dobu nevěděl, kde jsem.",
      "en": "I did not get lost. I simply spent longer not knowing where I was."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/139-kupe-navigator.webp",
      "full": "/oasis-assets/concept_svg/139-kupe-navigator.svg",
      "final": false
    },
    "circle": "aotearoa"
  },
  {
    "id": 142,
    "name": "Ọṣun",
    "subtitle": {
      "cs": "Ọṣun — řeka vzájemnosti",
      "en": "Ọṣun — river of reciprocity"
    },
    "ray": "RubyGold",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která učí, že peníze mají téct",
      "en": "She who teaches that money must flow"
    },
    "location": {
      "cs": "Řeka Ọṣun, soutok",
      "en": "The Ọṣun river, the confluence"
    },
    "questLine": {
      "cs": "Sladká voda pro všechny",
      "en": "Sweet Water for All"
    },
    "teaching": {
      "cs": "Kdo drží vodu u sebe, bude mít jen bažinu.",
      "en": "Whoever keeps the water to themselves will have only a swamp."
    },
    "ability": {
      "cs": "Sladký proud — uvolní prostředky tam, kde se zadrhly.",
      "en": "Sweet Current — releases means where they got stuck."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ọṣun — reciprocita mezi komunitou a tokem (eko + sociální péče). V OASIS: narativ governance humanitárního likvidního poolu.",
      "en": "Ọṣun — reciprocity between community and flow (eco + social care). In OASIS: the humanitarian liquid-pool governance narrative."
    },
    "quote": {
      "cs": "Nejsem štědrá. Jen vím, že suchá řeka nikoho neuživí.",
      "en": "I am not generous. I only know a dry river feeds no one."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/140-osun.webp",
      "full": "/oasis-assets/concept_svg/140-osun.svg",
      "final": false
    },
    "circle": "africa"
  },
  {
    "id": 143,
    "name": "Ṣàngó",
    "subtitle": {
      "cs": "Ṣàngó — hrom a spravedlnost",
      "en": "Ṣàngó — thunder and justice"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo se ozve, když se mlčí o křivdě",
      "en": "He who speaks when a wrong is met with silence"
    },
    "location": {
      "cs": "Bouřkový palác v Oyo",
      "en": "The storm palace of Oyo"
    },
    "questLine": {
      "cs": "Úder, který se dá doložit",
      "en": "The Strike That Can Be Proven"
    },
    "teaching": {
      "cs": "Hněv není důkaz. Důkaz je důkaz.",
      "en": "Anger is not proof. Proof is proof."
    },
    "ability": {
      "cs": "Doložený zásah — zasáhne jen to, co je prokázané.",
      "en": "Documented Strike — hits only what has been proven."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ṣàngó — archetyp spravedlnosti a řádu s kulturním kontextem (královská genealogie narace citující akademické sekundární zdroje).",
      "en": "Ṣàngó — archetype of justice and order with cultural context (royal-genealogy narration citing academic secondary sources)."
    },
    "quote": {
      "cs": "Hřmím jednou. Pak se ptám, co jste udělali mezitím.",
      "en": "I thunder once. Then I ask what you did in the meantime."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/141-sango.webp",
      "full": "/oasis-assets/concept_svg/141-sango.svg",
      "final": false
    },
    "circle": "africa"
  },
  {
    "id": 144,
    "name": "Ọbàtálá",
    "subtitle": {
      "cs": "Ọbàtálá — klidný tvůrce",
      "en": "Ọbàtálá — the calm maker"
    },
    "ray": "White",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo dělá složité věci čitelnými",
      "en": "He who makes complicated things readable"
    },
    "location": {
      "cs": "Bílý vrcholek kopce",
      "en": "The white hilltop"
    },
    "questLine": {
      "cs": "Klid, ve kterém se dá rozhodnout",
      "en": "The Calm in Which One Can Decide"
    },
    "teaching": {
      "cs": "Rozhodnutí v rozrušení je vždycky dražší, než se zdá.",
      "en": "A decision made in agitation is always more expensive than it looks."
    },
    "ability": {
      "cs": "Ztišení — zpomalí rozhodnutí na čitelnou rychlost.",
      "en": "Stillness — slows a decision to a readable pace."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ọ̀bàtálá — rámcová stabilita a etická práce s materiály (keramika města = paralela infra building v DAO).",
      "en": "Ọ̀bàtálá — framework stability and ethical work with materials (the city's ceramics = a DAO infrastructure-building parallel)."
    },
    "quote": {
      "cs": "Nejsem pomalý. Jen nechci, abys spěchal do chyby.",
      "en": "I am not slow. I only do not want you to hurry into a mistake."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/142-obatala.webp",
      "full": "/oasis-assets/concept_svg/142-obatala.svg",
      "final": false
    },
    "circle": "africa"
  },
  {
    "id": 145,
    "name": "Ọya",
    "subtitle": {
      "cs": "Ọya — vítr změny",
      "en": "Ọya — the wind of change"
    },
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která odnese to, co už nepatří",
      "en": "She who carries away what no longer belongs"
    },
    "location": {
      "cs": "Větrná pláň",
      "en": "The windy plain"
    },
    "questLine": {
      "cs": "Stěhování bez ztráty",
      "en": "Moving Without Losing"
    },
    "teaching": {
      "cs": "Změna bolí jen tehdy, když se jí držíš zpátky.",
      "en": "Change hurts only when you hold it back."
    },
    "ability": {
      "cs": "Vítr přesunu — přenese celek jinam bez rozbití.",
      "en": "Crossing Wind — moves a whole elsewhere without breaking it."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ọya — rámcová adaptace (migrace uživatelů mezi shardy, refaktoring legacy kontraktů morálně).",
      "en": "Ọya — a framework adaptation (migrating shard users, refactoring legacy contracts morally)."
    },
    "quote": {
      "cs": "Neodnáším tvůj domov. Odnáším to, co už v něm nebydlí.",
      "en": "I am not taking your home. I am taking what no longer lives in it."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/143-oya.webp",
      "full": "/oasis-assets/concept_svg/143-oya.svg",
      "final": false
    },
    "circle": "africa"
  },
  {
    "id": 146,
    "name": "Mawu-Lisa",
    "subtitle": {
      "cs": "Mawu-Lisa — dvě strany jednoho",
      "en": "Mawu-Lisa — two sides of one"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ti, kdo vládnou střídavě",
      "en": "They who rule in turn"
    },
    "location": {
      "cs": "Místo, kde se střídá den a noc",
      "en": "The place where day and night alternate"
    },
    "questLine": {
      "cs": "Kdo mluví první",
      "en": "Who Speaks First"
    },
    "teaching": {
      "cs": "Dvě pravdy se nevylučují, jen se musí vystřídat.",
      "en": "Two truths do not exclude each other; they only have to take turns."
    },
    "ability": {
      "cs": "Střídavé slovo — dá prostor oběma stranám sporu.",
      "en": "Alternating Word — gives both sides of a dispute room."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Duální princip kreativního napětí — OASIS metaforicky dual-rail governance (ne efektní gender-war frakce).",
      "en": "The dual principle of creative tension — OASIS metaphorically uses dual-rail governance (not a gimmicky gender-war faction)."
    },
    "quote": {
      "cs": "Nehádáme se. Střídáme se.",
      "en": "We do not argue. We take turns."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/144-mawu-lisa.webp",
      "full": "/oasis-assets/concept_svg/144-mawu-lisa.svg",
      "final": false
    },
    "circle": "africa"
  },
  {
    "id": 147,
    "name": "Nyame / Nyankopon",
    "subtitle": {
      "cs": "Nyame — tichý rádce",
      "en": "Nyame — the quiet counsel"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo říká jen to, co unese",
      "en": "He who says only what can be carried"
    },
    "location": {
      "cs": "Obloha nad zlatým trůnem",
      "en": "The sky above the golden stool"
    },
    "questLine": {
      "cs": "Méně slov",
      "en": "Fewer Words"
    },
    "teaching": {
      "cs": "Dlouhá řeč je často znamení, že si nejsi jistý.",
      "en": "A long speech is often a sign that you are not sure."
    },
    "ability": {
      "cs": "Krátká pravda — zkrátí složité rozhodnutí na jednu větu.",
      "en": "Short Truth — reduces a complex decision to one sentence."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Koncept Nejvyššího v akan teologických popisech použit jako minimal-theology governance („méně dramatu, více naslouchání“).",
      "en": "The concept of the Supreme Being in Akan theological descriptions, used as minimal-theology governance ('less drama, more listening')."
    },
    "quote": {
      "cs": "Mlčím, dokud nemám co říct. Pak mluvím krátce.",
      "en": "I am silent until I have something to say. Then I speak briefly."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/145-nyame-nyankopon.webp",
      "full": "/oasis-assets/concept_svg/145-nyame-nyankopon.svg",
      "final": false
    },
    "circle": "africa"
  },
  {
    "id": 148,
    "name": "Kwaku Ananse",
    "subtitle": {
      "cs": "Kwaku Ananse — tkadlec příběhů",
      "en": "Kwaku Ananse — weaver of stories"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo učí skrz vyprávění",
      "en": "He who teaches through story"
    },
    "location": {
      "cs": "Pavučina mezi dvěma stromy",
      "en": "A web between two trees"
    },
    "questLine": {
      "cs": "Příběh, který otevře oči",
      "en": "The Story That Opens Eyes"
    },
    "teaching": {
      "cs": "Lidé neslyší pravidlo. Slyší příběh, který ho obsahuje.",
      "en": "People do not hear a rule. They hear a story that contains it."
    },
    "ability": {
      "cs": "Pavučina — propojí dvě zdánlivě nesouvisející věci.",
      "en": "Web — links two seemingly unrelated things."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ananse jako narativní mistr odhalující slepá místa moci (pedagogika „malé lži → velké pravdy“).",
      "en": "Ananse as the narrative master exposing power's blind spots ('small lies → big truths' pedagogy)."
    },
    "quote": {
      "cs": "Nepoučuju. Vyprávím.",
      "en": "I do not lecture. I tell."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/146-kwaku-ananse.webp",
      "full": "/oasis-assets/concept_svg/146-kwaku-ananse.svg",
      "final": false
    },
    "circle": "africa"
  },
  {
    "id": 149,
    "name": "Ausar-Osiris",
    "subtitle": {
      "cs": "Usir — obnova v cyklu",
      "en": "Osiris — renewal in cycle"
    },
    "ray": "Green",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo vstane jinak, ne stejně",
      "en": "He who rises differently, not the same"
    },
    "location": {
      "cs": "Břeh zeleného pole",
      "en": "The bank of the green field"
    },
    "questLine": {
      "cs": "Rozdělení a složení",
      "en": "Dismemberment and Reassembly"
    },
    "teaching": {
      "cs": "Co se rozpadlo, se dá složit. Ale nikdy ne do stejného tvaru.",
      "en": "What fell apart can be put together. But never into the same shape."
    },
    "ability": {
      "cs": "Obnova celku — znovu složí poškozené díly.",
      "en": "Whole Renewed — reassembles the damaged parts."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ausar-Osiris — cyklické obrozování institucí po selhání (paralela DAO phoenix lore).",
      "en": "Ausar-Osiris — cyclical renewal of institutions after failure (a DAO phoenix-lore parallel)."
    },
    "quote": {
      "cs": "Nevrátil jsem se proto, abych vládl. Vrátil jsem se, abych učil.",
      "en": "I did not return to rule. I returned to teach."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/147-ausar-osiris.webp",
      "full": "/oasis-assets/concept_svg/147-ausar-osiris.svg",
      "final": false
    },
    "circle": "africa"
  },
  {
    "id": 150,
    "name": "Maʿăt",
    "subtitle": {
      "cs": "Maʿăt — pírko pravdy",
      "en": "Maʿăt — the feather of truth"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která váží slova proti činům",
      "en": "She who weighs words against deeds"
    },
    "location": {
      "cs": "Síň vážení",
      "en": "The hall of weighing"
    },
    "questLine": {
      "cs": "Srdce na misce",
      "en": "The Heart on the Scale"
    },
    "teaching": {
      "cs": "Neptej se, co jsi říkal. Ptej se, co po tobě zůstalo.",
      "en": "Do not ask what you said. Ask what remained after you."
    },
    "ability": {
      "cs": "Vážení — ukáže, která dohoda je opravdu vyvážená.",
      "en": "Weighing — shows which agreement is truly balanced."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Maʿăt — archetyp pravdivého vyvážení rozhodnutí kolektivů (symbolika bez mystifikace RNG jako „orákla“).",
      "en": "Maʿăt — the archetype of truthful balancing of collective decisions (symbolism without mystifying RNG as an 'oracle')."
    },
    "quote": {
      "cs": "Pírko je lehké. Proto ho tolik lidí neunese.",
      "en": "The feather is light. That is why so many cannot bear it."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/148-maat.webp",
      "full": "/oasis-assets/concept_svg/148-maat.svg",
      "final": false
    },
    "circle": "africa"
  },
  {
    "id": 151,
    "name": "Anna Njinga",
    "subtitle": {
      "cs": "Anna Njinga — vyjednavačka",
      "en": "Anna Njinga — the negotiator"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která vyjednává bez převahy",
      "en": "She who negotiates without the upper hand"
    },
    "location": {
      "cs": "Hrad v Matambě",
      "en": "The fortress of Matamba"
    },
    "questLine": {
      "cs": "Jednání, které neponíží",
      "en": "A Negotiation That Does Not Humiliate"
    },
    "teaching": {
      "cs": "Dohoda, která druhému vezme důstojnost, se vrátí jako válka.",
      "en": "An agreement that takes the other's dignity returns as war."
    },
    "ability": {
      "cs": "Rovný stůl — donutí silnějšího jednat jako rovný.",
      "en": "Level Table — makes the stronger side negotiate as an equal."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Njinga — archetyp asymetrického odporu + vyjednávací stamina (anti-koloniální extraktivní struktury jako narativní antagonisté).",
      "en": "Njinga — archetype of asymmetric resistance + negotiation stamina (anti-colonial extractive structures as narrative antagonists)."
    },
    "quote": {
      "cs": "Nepřišla jsem prosit. Přišla jsem se domluvit.",
      "en": "I did not come to beg. I came to agree."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/149-anna-njinga.webp",
      "full": "/oasis-assets/concept_svg/149-anna-njinga.svg",
      "final": false
    },
    "circle": "africa"
  },
  {
    "id": 152,
    "name": "Atlas",
    "subtitle": {
      "cs": "Atlas — nejstarší král",
      "en": "Atlas — the eldest king"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo drží souhru mnoha krajů",
      "en": "He who holds many regions in agreement"
    },
    "location": {
      "cs": "Kruhové město, vnější prstenec",
      "en": "The ring city, outer ring"
    },
    "questLine": {
      "cs": "Deset krajů, jedna dohoda",
      "en": "Ten Regions, One Accord"
    },
    "teaching": {
      "cs": "Kdo nese celé nebe, nesmí si plést svou únavu s právem rozhodovat.",
      "en": "Whoever carries the whole sky must not confuse his fatigue with the right to decide."
    },
    "ability": {
      "cs": "Souhlas krajů — spojí deset různých zájmů do jednoho rozhodnutí.",
      "en": "Accord of Regions — joins ten different interests into one decision."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Atlas — koordinační střed deseti oblastních mandátů jako metafora konsenzu ostrovní sítě (pedagogika staking regionů / shard governance).",
      "en": "Atlas — the coordinating center of ten regional mandates as a metaphor for island-network consensus (staking regions / shard governance pedagogy)."
    },
    "quote": {
      "cs": "Nenesu nebe proto, že jsem silný. Nesu ho, protože se nikdo jiný nepřihlásil.",
      "en": "I do not carry the sky because I am strong. I carry it because no one else volunteered."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/150-atlas.webp",
      "full": "/oasis-assets/concept_svg/150-atlas.svg",
      "final": false
    },
    "circle": "atlantis"
  },
  {
    "id": 153,
    "name": "Cleito",
    "subtitle": {
      "cs": "Kleito — strážkyně chrámu",
      "en": "Cleito — keeper of the sanctuary"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která chrání místo před zneužitím",
      "en": "She who protects a place from misuse"
    },
    "location": {
      "cs": "Svatyňka na vrcholku ostrova",
      "en": "The sanctuary on the island's hill"
    },
    "questLine": {
      "cs": "Charta, která se nedá obejít",
      "en": "The Charter That Cannot Be Walked Around"
    },
    "teaching": {
      "cs": "Co není napsané, se dá vyložit ve prospěch silnějšího.",
      "en": "What is not written can be read in favour of the stronger."
    },
    "ability": {
      "cs": "Jasná charta — znemožní výklad, který by poškodil slabšího.",
      "en": "Clear Charter — blocks the reading that would harm the weaker."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Cleito — archeologie souhlasu: centrum říše jako místo, kde se zákon rodí ze souhlasu terénu, ne ze skryté manipulace.",
      "en": "Cleito — consent archaeology: the empire's center as the place where law is born from the consent of the terrain, not from hidden manipulation."
    },
    "quote": {
      "cs": "Nebráním ti vejít. Bráním ti to tu přestavět k obrazu svému.",
      "en": "I do not stop you entering. I stop you rebuilding it in your image."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/151-cleito.webp",
      "full": "/oasis-assets/concept_svg/151-cleito.svg",
      "final": false
    },
    "circle": "atlantis"
  },
  {
    "id": 154,
    "name": "Gadeirus",
    "subtitle": {
      "cs": "Gadeiros — etika průlivu",
      "en": "Gadeirus — the ethics of the strait"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo určuje pravidla přechodu",
      "en": "He who sets the rules of passage"
    },
    "location": {
      "cs": "Úzký průliv",
      "en": "The narrow strait"
    },
    "questLine": {
      "cs": "Kdo projde první",
      "en": "Who Passes First"
    },
    "teaching": {
      "cs": "Kdo jede první, musí nechat místo pro druhého.",
      "en": "Whoever goes first must leave room for the second."
    },
    "ability": {
      "cs": "Pravidlo průchodu — zajistí, že se nezablokuje cesta.",
      "en": "Passage Rule — ensures the road does not jam."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Gadeirus — interoperabilita přístavu: most mezi ostrůvkem „vnitřního“ trhu a kontinentální kritikou (bridge ethics).",
      "en": "Gadeirus — harbor interoperability: a bridge between the islet of the 'inner' market and continental critique (bridge ethics)."
    },
    "quote": {
      "cs": "Průliv není tvůj. Je jen úzký.",
      "en": "The strait is not yours. It is only narrow."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/152-gadeirus.webp",
      "full": "/oasis-assets/concept_svg/152-gadeirus.svg",
      "final": false
    },
    "circle": "atlantis"
  },
  {
    "id": 155,
    "name": "Ampheres",
    "subtitle": {
      "cs": "Ampheres — spravedlivý příděl",
      "en": "Ampheres — fair share"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo dělí úrodu bez zvýhodnění",
      "en": "He who divides the yield without favour"
    },
    "location": {
      "cs": "Sýpky na druhém prstenci",
      "en": "The granaries of the second ring"
    },
    "questLine": {
      "cs": "Kdo dostane kolik",
      "en": "Who Gets How Much"
    },
    "teaching": {
      "cs": "Rovný příděl není stejný. Je takový, aby každý mohl pokračovat.",
      "en": "A fair share is not an equal one. It is one that lets everyone continue."
    },
    "ability": {
      "cs": "Vyvážený příděl — přidělí zdroje tak, aby nikdo nepropadl.",
      "en": "Balanced Share — allocates so that no one falls out."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ampheres — governance bez predátorského realloc (pedagogika fair emission / subsidy).",
      "en": "Ampheres — governance without predatory realloc (fair emission / subsidy pedagogy)."
    },
    "quote": {
      "cs": "Nedělím peníze. Dělím možnost pokračovat.",
      "en": "I am not dividing money. I am dividing the ability to go on."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/153-ampheres.webp",
      "full": "/oasis-assets/concept_svg/153-ampheres.svg",
      "final": false
    },
    "circle": "atlantis"
  },
  {
    "id": 156,
    "name": "Evaemon",
    "subtitle": {
      "cs": "Evaemon — dobrý zvyk",
      "en": "Evaemon — good custom"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo hlídá, aby se dobrá praxe nezlomila",
      "en": "He who guards that good practice does not break"
    },
    "location": {
      "cs": "Síň souhlasu",
      "en": "The hall of consent"
    },
    "questLine": {
      "cs": "Zvyk, který drží i bez dozoru",
      "en": "A Custom That Holds Unwatched"
    },
    "teaching": {
      "cs": "Pravidlo, které nikdo nedodržuje, není pravidlo. Je to přání.",
      "en": "A rule no one follows is not a rule. It is a wish."
    },
    "ability": {
      "cs": "Dobrý zvyk — zavede praxi, která přežije bez dohledu.",
      "en": "Good Custom — establishes practice that survives without oversight."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Evaemon — měkké právo komunity: reputace, etiketa commitů, férový code of conduct.",
      "en": "Evaemon — the soft law of community: reputation, commit etiquette, a fair code of conduct."
    },
    "quote": {
      "cs": "Nedohlížím. Radši se ptám, proč to nikdo nedělá.",
      "en": "I do not oversee. I ask why no one does it."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/154-evaemon.webp",
      "full": "/oasis-assets/concept_svg/154-evaemon.svg",
      "final": false
    },
    "circle": "atlantis"
  },
  {
    "id": 157,
    "name": "Mneseus",
    "subtitle": {
      "cs": "Mneseus — strážce paměti",
      "en": "Mneseus — keeper of memory"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo vede záznam bez přikrášlení",
      "en": "He who keeps the record without embellishment"
    },
    "location": {
      "cs": "Archiv pod chrámem",
      "en": "The archive beneath the temple"
    },
    "questLine": {
      "cs": "Changelog, který nelže",
      "en": "The Changelog That Cannot Lie"
    },
    "teaching": {
      "cs": "Záznam, který vynechá chybu, není záznam. Je to reklama.",
      "en": "A record that omits the mistake is not a record. It is advertising."
    },
    "ability": {
      "cs": "Čitelná historie — ukáže, co se změnilo a proč.",
      "en": "Legible History — shows what changed and why."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Mneseus — state root storytelling: integrita historie, changelog, audit trails.",
      "en": "Mneseus — state-root storytelling: integrity of history, changelog, audit trails."
    },
    "quote": {
      "cs": "Nejčastěji se lže mlčením o vlastní chybě.",
      "en": "The most common lie is silence about one's own mistake."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/155-mneseus.webp",
      "full": "/oasis-assets/concept_svg/155-mneseus.svg",
      "final": false
    },
    "circle": "atlantis"
  },
  {
    "id": 158,
    "name": "Autochthon",
    "subtitle": {
      "cs": "Autochthon — původ země",
      "en": "Autochthon — born of the land"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo hájí místní právo rozhodovat",
      "en": "He who defends the local right to decide"
    },
    "location": {
      "cs": "Kamenný práh",
      "en": "The stone threshold"
    },
    "questLine": {
      "cs": "Kdo tu žije, ten tu rozhoduje",
      "en": "Who Lives Here Decides Here"
    },
    "teaching": {
      "cs": "Rozhodnutí o místě má dělat někdo, kdo v něm musí zůstat.",
      "en": "A decision about a place should be made by someone who has to stay there."
    },
    "ability": {
      "cs": "Místní právo — dá poslední slovo těm, kteří tam žijí.",
      "en": "Local Right — gives the last word to those who live there."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Autochthon — suverenita místa: biome governance, důvtip lokální infrastruktury.",
      "en": "Autochthon — sovereignty of place: biome governance, local infrastructure ingenuity."
    },
    "quote": {
      "cs": "Nejsem starší proto, že jsem starý. Jsem starší, protože jsem zůstal.",
      "en": "I am an elder not because I am old. I am an elder because I stayed."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/156-autochthon.webp",
      "full": "/oasis-assets/concept_svg/156-autochthon.svg",
      "final": false
    },
    "circle": "atlantis"
  },
  {
    "id": 159,
    "name": "Elasippus",
    "subtitle": {
      "cs": "Elasippus — spravedlivý tok",
      "en": "Elasippus — fair flow"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo drží cestu volnou i pro malé",
      "en": "He who keeps the road open even for the small"
    },
    "location": {
      "cs": "Silnice mezi prstenci",
      "en": "The road between the rings"
    },
    "questLine": {
      "cs": "Místo ve frontě",
      "en": "A Place in the Queue"
    },
    "teaching": {
      "cs": "Systém poznáš podle toho, jak se chová k člověku bez silného přímluvce.",
      "en": "You know a system by how it treats someone with no strong advocate."
    },
    "ability": {
      "cs": "Volný pruh — zajistí, že malý hráč neuvízne navždy.",
      "en": "Open Lane — ensures the small player does not get stuck forever."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Elasippus — fair mempool / traffic shaping narativ bez démonizace „outsiderů“.",
      "en": "Elasippus — a fair mempool / traffic-shaping narrative without demonizing 'outsiders'."
    },
    "quote": {
      "cs": "Nejde o rychlost. Jde o to, jestli se dostaneš.",
      "en": "It is not about speed. It is about whether you get there."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/157-elasippus.webp",
      "full": "/oasis-assets/concept_svg/157-elasippus.svg",
      "final": false
    },
    "circle": "atlantis"
  },
  {
    "id": 160,
    "name": "Mestor",
    "subtitle": {
      "cs": "Mestor — hlasatel dohody",
      "en": "Mestor — herald of accord"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo udrží jednání pohromadě",
      "en": "He who keeps a negotiation together"
    },
    "location": {
      "cs": "Síň otevřených dveří",
      "en": "The hall of open doors"
    },
    "questLine": {
      "cs": "Stůl, od kterého se nevstává",
      "en": "The Table You Do Not Leave"
    },
    "teaching": {
      "cs": "Dokud spolu mluvíte, je to dohoda. Když odejdete, je to jen přestávka.",
      "en": "As long as you talk, it is an agreement. When you leave, it is only a pause."
    },
    "ability": {
      "cs": "Hlasatel — přivede strany zpět ke stolu.",
      "en": "Herald — brings the parties back to the table."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Mestor — facilitace mezisektorového kompromisu (lore stakerů vs. builderů).",
      "en": "Mestor — facilitation of cross-sector compromise (stakers vs. builders lore)."
    },
    "quote": {
      "cs": "Nehledám vítěze. Hledám větu, se kterou odejdou oba.",
      "en": "I am not looking for a winner. I am looking for the sentence both can leave with."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/158-mestor.webp",
      "full": "/oasis-assets/concept_svg/158-mestor.svg",
      "final": false
    },
    "circle": "atlantis"
  },
  {
    "id": 161,
    "name": "Azaes",
    "subtitle": {
      "cs": "Azaes — ten, kdo zkouší s rozmyslem",
      "en": "Azaes — the measured tester"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo hledá mez bez katastrofy",
      "en": "He who finds the limit without catastrophe"
    },
    "location": {
      "cs": "Zkušební ostrov",
      "en": "The proving island"
    },
    "questLine": {
      "cs": "Kde to praskne",
      "en": "Where It Breaks"
    },
    "teaching": {
      "cs": "Mez se má najít dřív, než ji najde provoz.",
      "en": "A limit should be found before production finds it."
    },
    "ability": {
      "cs": "Zkouška zátěží — ukáže mez bez toho, aby něco spadlo.",
      "en": "Load Trial — shows the limit without anything falling."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Azaes — explorativní governance: testování limitů sítě s fail-safe a etickým hlášením škody.",
      "en": "Azaes — exploratory governance: testing the network's limits with fail-safes and ethical damage reporting."
    },
    "quote": {
      "cs": "Radši to zkusím já, dokud je to jen zkouška.",
      "en": "I would rather test it myself while it is still only a test."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/159-azaes.webp",
      "full": "/oasis-assets/concept_svg/159-azaes.svg",
      "final": false
    },
    "circle": "atlantis"
  },
  {
    "id": 162,
    "name": "Lemur Steward",
    "subtitle": {
      "cs": "Strážce lemurů — rozmanitost před vším",
      "en": "Lemur Steward — diversity before everything"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo chrání, co je jedinečné",
      "en": "He who protects what is unique"
    },
    "location": {
      "cs": "Deštný les, horní patro",
      "en": "The rainforest, upper canopy"
    },
    "questLine": {
      "cs": "Kdo tu byl dřív",
      "en": "Who Was Here First"
    },
    "teaching": {
      "cs": "Krajina, která ztratí rozmanitost, neztratí krásu. Ztratí budoucnost.",
      "en": "A land that loses diversity does not lose beauty. It loses its future."
    },
    "ability": {
      "cs": "Ochrana druhu — zachrání to, co jinde nemá zastoupení.",
      "en": "Species Guard — saves what has no substitute elsewhere."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Lemur Steward — prioritizační etika výzkumu: živý ekosystém před kartami „ztraceného zlata pravdy“.",
      "en": "Lemur Steward — research prioritization ethics: the living ecosystem before 'lost gold of truth' cards."
    },
    "quote": {
      "cs": "Nehádej se o mapu. Podívej se, kdo tam ještě žije.",
      "en": "Do not argue about the map. Look at who still lives there."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/160-lemur-steward.webp",
      "full": "/oasis-assets/concept_svg/160-lemur-steward.svg",
      "final": false
    },
    "circle": "lemuria"
  },
  {
    "id": 163,
    "name": "Sclater Bridge",
    "subtitle": {
      "cs": "Sclaterův most — pokora omylu",
      "en": "Sclater Bridge — the humility of error"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo učí odvolat, co neplatí",
      "en": "He who teaches retracting what no longer holds"
    },
    "location": {
      "cs": "Muzeum zastaralých map",
      "en": "The museum of obsolete maps"
    },
    "questLine": {
      "cs": "Odvolání hypotézy",
      "en": "The Retraction"
    },
    "teaching": {
      "cs": "Věda nezačíná pravdou. Začíná ochotou přiznat, že se spletla.",
      "en": "Science does not begin with truth. It begins with the willingness to admit error."
    },
    "ability": {
      "cs": "Odvolání — dovolí opravit tvrzení, aniž by to byla prohra.",
      "en": "Retraction — allows a claim to be corrected without it being a defeat."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Sclater Bridge — etiketa retractace: jak veřejně opravit hypotézu bez hanby komunity.",
      "en": "Sclater Bridge — retraction etiquette: how to publicly correct a hypothesis without shaming the community."
    },
    "quote": {
      "cs": "Mapa, která nelže, neexistuje. Mapa, která se opraví, ano.",
      "en": "A map that does not lie does not exist. A map that corrects itself does."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/161-sclater-bridge.webp",
      "full": "/oasis-assets/concept_svg/161-sclater-bridge.svg",
      "final": false
    },
    "circle": "lemuria"
  },
  {
    "id": 164,
    "name": "Coral Notary",
    "subtitle": {
      "cs": "Korálový notář",
      "en": "The Coral Notary"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která dosvědčuje, co se ztratilo",
      "en": "She who witnesses what has been lost"
    },
    "location": {
      "cs": "Korálový útes",
      "en": "The coral reef"
    },
    "questLine": {
      "cs": "Zápis o úbytku",
      "en": "The Record of Loss"
    },
    "teaching": {
      "cs": "Co se nezapíše, jako by nebylo. Proto se zapisuje i to nepříjemné.",
      "en": "What is not recorded may as well not exist. That is why the unpleasant is recorded too."
    },
    "ability": {
      "cs": "Dosvědčení — doloží škodu, kterou by jinak nikdo neuznal.",
      "en": "Attestation — documents harm that would otherwise go unacknowledged."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Coral Notary — climate-accountability overlay v měkké lore (ne gratuitní doom-scrolling).",
      "en": "Coral Notary — climate-accountability overlays in soft lore (not gratuitous doom-scrolling)."
    },
    "quote": {
      "cs": "Nejsem smutná. Jen počítám.",
      "en": "I am not sad. I am counting."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/162-coral-notary.webp",
      "full": "/oasis-assets/concept_svg/162-coral-notary.svg",
      "final": false
    },
    "circle": "lemuria"
  },
  {
    "id": 165,
    "name": "Tide Column",
    "subtitle": {
      "cs": "Přílivový sloup — rytmus pro malé",
      "en": "Tide Column — rhythm for the small"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo drží férové tempo",
      "en": "He who keeps a fair tempo"
    },
    "location": {
      "cs": "Mělčina mezi přílivy",
      "en": "The shallows between tides"
    },
    "questLine": {
      "cs": "Místo pro pomalé",
      "en": "Room for the Slow"
    },
    "teaching": {
      "cs": "Rychlost, která nechá slabšího utonout, není efektivita.",
      "en": "Speed that lets the weaker drown is not efficiency."
    },
    "ability": {
      "cs": "Rytmus přílivu — zpomalí systém tak, aby stihl i menší.",
      "en": "Tidal Rhythm — slows the system so the smaller one can keep up."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Tide Column — rhythm fairness: sdílené sloty bez monopolu „high-water mark“ hráče.",
      "en": "Tide Column — rhythm fairness: shared slots without a 'high-water mark' player monopoly."
    },
    "quote": {
      "cs": "Moře nikdy nespěchá a přesto nikdy nechybí včas.",
      "en": "The sea never hurries and yet is never late."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/163-tide-column.webp",
      "full": "/oasis-assets/concept_svg/163-tide-column.svg",
      "final": false
    },
    "circle": "lemuria"
  },
  {
    "id": 166,
    "name": "Basalt Chronicle",
    "subtitle": {
      "cs": "Čedičová kronika",
      "en": "Basalt Chronicle"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která měří čas v geologii",
      "en": "She who measures time in geology"
    },
    "location": {
      "cs": "Středooceánský hřbet",
      "en": "The mid-ocean ridge"
    },
    "questLine": {
      "cs": "Rychlost, která se nedá uspěchat",
      "en": "Pace That Cannot Be Rushed"
    },
    "teaching": {
      "cs": "Některé věci potřebují tisíc let. Žádné rozhodnutí to nezrychlí.",
      "en": "Some things need a thousand years. No decision will speed that up."
    },
    "ability": {
      "cs": "Geologický klid — ochrání rozhodnutí před zbrklostí.",
      "en": "Geological Calm — protects a decision from haste."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Basalt Chronicle — deep-time poctivost pro protokolové dokumenty (immutable ≠ dogma).",
      "en": "Basalt Chronicle — deep-time honesty for protocol documents (immutable ≠ dogma)."
    },
    "quote": {
      "cs": "Nespěchám. Ani hora nespěchá a je nejvyšší.",
      "en": "I do not hurry. The mountain does not either, and it is the tallest."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/164-basalt-chronicle.webp",
      "full": "/oasis-assets/concept_svg/164-basalt-chronicle.svg",
      "final": false
    },
    "circle": "lemuria"
  },
  {
    "id": 167,
    "name": "Foam Seed",
    "subtitle": {
      "cs": "Semínko v pěně",
      "en": "Foam Seed"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo šíří bez zabírání",
      "en": "He who spreads without taking over"
    },
    "location": {
      "cs": "Pobřeží, kam dopadá příboj",
      "en": "The shore where the breakers land"
    },
    "questLine": {
      "cs": "Rozšířit se a nechat být",
      "en": "To Spread and Let Be"
    },
    "teaching": {
      "cs": "Šířit se neznamená obsadit. Znamená to nechat růst i jinde.",
      "en": "To spread is not to occupy. It is to let it grow elsewhere too."
    },
    "ability": {
      "cs": "Přenos semene — předá myšlenku bez nároku na vlastnictví.",
      "en": "Seed Transfer — hands on an idea with no claim of ownership."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Foam Seed — governance mezi hostem a domovem bez extractive settlers fantasy.",
      "en": "Foam Seed — governance between guest and home without an extractive-settlers fantasy."
    },
    "quote": {
      "cs": "Nezůstávám. Ale to, co nesu, zůstane.",
      "en": "I do not stay. But what I carry does."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/165-foam-seed.webp",
      "full": "/oasis-assets/concept_svg/165-foam-seed.svg",
      "final": false
    },
    "circle": "lemuria"
  },
  {
    "id": 168,
    "name": "Oceanic Bridge",
    "subtitle": {
      "cs": "Oceánský most",
      "en": "Oceanic Bridge"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo spojuje bez přepisování",
      "en": "He who connects without rewriting"
    },
    "location": {
      "cs": "Souostroví, mnoho přístavů",
      "en": "An archipelago of many harbours"
    },
    "questLine": {
      "cs": "Spojenectví bez nadvlády",
      "en": "Alliance Without Dominion"
    },
    "teaching": {
      "cs": "Spojit dva ostrovy neznamená, že jeden z nich zmizí.",
      "en": "Joining two islands does not mean one of them disappears."
    },
    "ability": {
      "cs": "Most — propojí dvě společenství bez ztráty jejich pravidel.",
      "en": "Bridge — connects two communities without losing either's rules."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Oceanic Bridge — choreografie koalice bez „meta-mother culture“ nahrazující lokální pravdu.",
      "en": "Oceanic Bridge — coalition choreography without a 'meta-mother culture' replacing local truth."
    },
    "quote": {
      "cs": "Most není cesta k nám. Je to cesta k sobě navzájem.",
      "en": "A bridge is not a road to us. It is a road to each other."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/166-oceanic-bridge.webp",
      "full": "/oasis-assets/concept_svg/166-oceanic-bridge.svg",
      "final": false
    },
    "circle": "lemuria"
  },
  {
    "id": 169,
    "name": "Shelf Whisper",
    "subtitle": {
      "cs": "Šepot šelfu",
      "en": "Shelf Whisper"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo říká pravdu o hladině",
      "en": "He who tells the truth about the waterline"
    },
    "location": {
      "cs": "Kontinentální šelf",
      "en": "The continental shelf"
    },
    "questLine": {
      "cs": "Kam až voda dojde",
      "en": "How Far the Water Reaches"
    },
    "teaching": {
      "cs": "Pobřeží, které si lže o hladině, přijde o domy. Ne o iluze.",
      "en": "A coast that lies about the waterline loses houses. Not illusions."
    },
    "ability": {
      "cs": "Pravda hladiny — ukáže reálné riziko bez strašení.",
      "en": "Waterline Truth — shows the real risk without alarm."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Shelf Whisper — realismus subsidence: riziko pobřeží, měst, infrastruktury — žádná white-utopia.",
      "en": "Shelf Whisper — subsidence realism: the risk to coasts, cities, infrastructure — no white utopia."
    },
    "quote": {
      "cs": "Nevaruju tě. Jen ti ukazuju, kam až to bylo minule.",
      "en": "I am not warning you. I am showing you how far it came last time."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/167-shelf-whisper.webp",
      "full": "/oasis-assets/concept_svg/167-shelf-whisper.svg",
      "final": false
    },
    "circle": "lemuria"
  },
  {
    "id": 170,
    "name": "Equinox Lull",
    "subtitle": {
      "cs": "Rovnodenní klid",
      "en": "Equinox Lull"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo drží klid na hranici",
      "en": "He who keeps calm at the threshold"
    },
    "location": {
      "cs": "Místo, kde se potkává den a noc",
      "en": "Where day meets night"
    },
    "questLine": {
      "cs": "Pauza, která zachrání",
      "en": "The Pause That Saves"
    },
    "teaching": {
      "cs": "Největší škody vznikají v prvních minutách paniky, ne v krizi samotné.",
      "en": "The greatest damage happens in the first minutes of panic, not in the crisis itself."
    },
    "ability": {
      "cs": "Zklidnění — pozastaví reakci, aby nebyla horší než problém.",
      "en": "Dampening — pauses the reaction so it is not worse than the problem."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Equinox Lull — anti-extremistický rytmus: zpomalení rozhodnutí při volatilitě.",
      "en": "Equinox Lull — an anti-extremism rhythm: slowing decisions down amid volatility."
    },
    "quote": {
      "cs": "Nedělej nic. Právě teď je to nejlepší rozhodnutí.",
      "en": "Do nothing. Right now that is the best decision."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/168-equinox-lull.webp",
      "full": "/oasis-assets/concept_svg/168-equinox-lull.svg",
      "final": false
    },
    "circle": "lemuria"
  },
  {
    "id": 171,
    "name": "Circle Closure",
    "subtitle": {
      "cs": "Uzavření kruhu",
      "en": "Circle Closure"
    },
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo předá pochodeň dál",
      "en": "He who passes the torch on"
    },
    "location": {
      "cs": "Práh mezi dvěma příběhy",
      "en": "The threshold between two stories"
    },
    "questLine": {
      "cs": "Tečka, která není konec",
      "en": "The Full Stop That Is Not an End"
    },
    "teaching": {
      "cs": "Dobře ukončená věc se dá začít znovu. Nedokončená se jen táhne.",
      "en": "A thing properly ended can be started again. An unfinished one merely drags."
    },
    "ability": {
      "cs": "Předání — uzavře kapitolu a otevře další bez ztráty nitě.",
      "en": "Handover — closes a chapter and opens the next without losing the thread."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Circle Closure — diegetický readme: hráče nasměruje ke kosmické vlně archetypů bez deprecating předchozích consult-gated kultur.",
      "en": "Circle Closure — a diegetic readme: points players to the cosmic wave of archetypes without deprecating earlier consult-gated cultures."
    },
    "quote": {
      "cs": "Nekončím. Jen se ukláním.",
      "en": "I am not ending. I am bowing."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/169-circle-closure.webp",
      "full": "/oasis-assets/concept_svg/169-circle-closure.svg",
      "final": false
    },
    "circle": "lemuria"
  },
  {
    "id": 172,
    "name": "Great Central Sun Steward",
    "subtitle": {
      "cs": "Strážce centrálního slunce",
      "en": "Steward of the Central Sun"
    },
    "ray": "White",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo drží společný rytmus",
      "en": "He who keeps the shared rhythm"
    },
    "location": {
      "cs": "Střed galaxie",
      "en": "The galactic centre"
    },
    "questLine": {
      "cs": "Jeden tep pro všechny",
      "en": "One Beat for All"
    },
    "teaching": {
      "cs": "Společenství se nerozpadne kvůli názorům, ale kvůli různému času.",
      "en": "A community does not fall apart over opinions, but over different clocks."
    },
    "ability": {
      "cs": "Společný tep — srovná tempo celé skupiny.",
      "en": "Shared Beat — aligns the tempo of the whole group."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "GC Sun Steward — single logical clock lore: tempo DAO v souladu s planetární tíhou v pozadí.",
      "en": "GC Sun Steward — single logical clock lore: DAO tempo in tune with planetary weight in the background."
    },
    "quote": {
      "cs": "Nejsem nejjasnější. Jsem ten, podle kterého se počítá čas.",
      "en": "I am not the brightest. I am the one time is counted by."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/170-great-central-sun-steward.webp",
      "full": "/oasis-assets/concept_svg/170-great-central-sun-steward.svg",
      "final": false
    },
    "circle": "cosmic"
  },
  {
    "id": 173,
    "name": "Photon Cadence",
    "subtitle": {
      "cs": "Rytmus světla",
      "en": "Cadence of Light"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která brzdí nadšení dřív, než vyhoří",
      "en": "She who slows enthusiasm before it burns out"
    },
    "location": {
      "cs": "Práh světelného pásu",
      "en": "The threshold of the light band"
    },
    "questLine": {
      "cs": "Nehořet, ale svítit",
      "en": "To Shine Without Burning"
    },
    "teaching": {
      "cs": "Nadšení, které nemá pauzu, se změní v únavu. Únava se změní ve vztek.",
      "en": "Enthusiasm without pause turns into fatigue. Fatigue turns into anger."
    },
    "ability": {
      "cs": "Rytmus — rozloží úsilí tak, aby vydrželo.",
      "en": "Cadence — spaces out effort so it lasts."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Photon Cadence — metafora sezónních release kapitol: etika nevyčerpávat komunitu „branami“ hype.",
      "en": "Photon Cadence — a seasonal chapter-release metaphor: the ethics of not exhausting the community with hype 'gates'."
    },
    "quote": {
      "cs": "Zpomal. Nechceš dohořet v první třetině.",
      "en": "Slow down. You do not want to burn out in the first third."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/171-photon-cadence.webp",
      "full": "/oasis-assets/concept_svg/171-photon-cadence.svg",
      "final": false
    },
    "circle": "cosmic"
  },
  {
    "id": 174,
    "name": "Solar Logos Dual",
    "subtitle": {
      "cs": "Dvojí podpis slunce",
      "en": "The Sun's Dual Signature"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ti, kdo potvrzují jen společně",
      "en": "They who confirm only together"
    },
    "location": {
      "cs": "Dvě strany sluneční brány",
      "en": "The two sides of the solar gate"
    },
    "questLine": {
      "cs": "Dva hlasy, jeden podpis",
      "en": "Two Voices, One Signature"
    },
    "teaching": {
      "cs": "Jedna ruka nikdy nestačí. Proto jsou potřeba dvě.",
      "en": "One hand is never enough. That is why two are needed."
    },
    "ability": {
      "cs": "Dvojí potvrzení — zabrání rozhodnutí, které udělal jeden člověk.",
      "en": "Dual Confirmation — blocks a decision made by one person alone."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Solar Logos Dual — dual signing lore: multisig, kde cold + hot osobnosti komunikují.",
      "en": "Solar Logos Dual — dual-signing lore: a multisig where cold + hot personas communicate."
    },
    "quote": {
      "cs": "Nejsme dva proto, že bychom si nevěřili. Jsme dva proto, že si věříme dost.",
      "en": "We are two not because we distrust each other. We are two because we trust each other enough."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/172-solar-logos-dual.webp",
      "full": "/oasis-assets/concept_svg/172-solar-logos-dual.svg",
      "final": false
    },
    "circle": "cosmic"
  },
  {
    "id": 175,
    "name": "Telluric Soul Bridge",
    "subtitle": {
      "cs": "Most k duši planety",
      "en": "Bridge to the Planet's Soul"
    },
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo spojuje lidi se zemí",
      "en": "He who joins people to the land"
    },
    "location": {
      "cs": "Práh mezi nebem a půdou",
      "en": "The threshold between sky and soil"
    },
    "questLine": {
      "cs": "Nahoře i dole",
      "en": "Above and Below"
    },
    "teaching": {
      "cs": "Duchovní řeč, která nevede k dílu, je jen ozdoba.",
      "en": "Spiritual talk that leads to no work is only decoration."
    },
    "ability": {
      "cs": "Propojení — převede vizi do konkrétního činu.",
      "en": "Connection — turns a vision into a concrete act."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Telluric Soul Bridge — staking Earth narativ: regen econ side-questy paralelní Gaia obloukům.",
      "en": "Telluric Soul Bridge — the staking-Earth narrative: regen-econ side quests parallel to Gaia arcs."
    },
    "quote": {
      "cs": "Nestačí cítit jednotu. Musí se to poznat na tom, co uděláš v pondělí.",
      "en": "Feeling oneness is not enough. It must show in what you do on Monday."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/173-telluric-soul-bridge.webp",
      "full": "/oasis-assets/concept_svg/173-telluric-soul-bridge.svg",
      "final": false
    },
    "circle": "cosmic"
  },
  {
    "id": 176,
    "name": "Tube-of-Light Sentinel",
    "subtitle": {
      "cs": "Strážce světelného sloupu",
      "en": "Sentinel of the Light Column"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo chrání soukromí a klíče",
      "en": "He who protects privacy and keys"
    },
    "location": {
      "cs": "Práh světla",
      "en": "The threshold of light"
    },
    "questLine": {
      "cs": "Co nikomu neřekneš",
      "en": "What You Tell No One"
    },
    "teaching": {
      "cs": "Nejdůležitější klíč je ten, o kterém nikdo neví, že existuje.",
      "en": "The most important key is the one no one knows exists."
    },
    "ability": {
      "cs": "Ochrana klíčů — zabrání, aby se tvá tajemství stala veřejnými.",
      "en": "Key Guard — prevents your secrets from becoming public."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Tube-of-Light Sentinel — vizualizace OPSEC: hráči mapují attack surface v lore UI.",
      "en": "Tube-of-Light Sentinel — OPSEC visualization: players map the attack surface in the lore UI."
    },
    "quote": {
      "cs": "Nemlčím proto, že nemám co říct. Mlčím proto, že to není pro nikoho.",
      "en": "I am silent not because I have nothing to say. I am silent because it is no one's business."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/174-tube-of-light-sentinel.webp",
      "full": "/oasis-assets/concept_svg/174-tube-of-light-sentinel.svg",
      "final": false
    },
    "circle": "cosmic"
  },
  {
    "id": 177,
    "name": "Radiant Spiral",
    "subtitle": {
      "cs": "Zářící spirála",
      "en": "Radiant Spiral"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která oceňuje učení, ne soutěžení",
      "en": "She who values teaching over competing"
    },
    "location": {
      "cs": "Spirála schodů",
      "en": "The spiral stair"
    },
    "questLine": {
      "cs": "Výš, ale spolu",
      "en": "Higher, But Together"
    },
    "teaching": {
      "cs": "Hodnost, kterou ti nikdo nezávidí, je ta, že někomu pomůžeš výš.",
      "en": "The rank no one envies is the one you earn by helping someone higher."
    },
    "ability": {
      "cs": "Spirála — odmění toho, kdo učí druhé.",
      "en": "Spiral — rewards whoever teaches others."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Radiant Spiral — reputační spirála: XP za užitečnou práci, ne za grind bez přínosu.",
      "en": "Radiant Spiral — the reputation spiral: XP for useful work, not for grind without benefit."
    },
    "quote": {
      "cs": "Nejsi výš proto, že jsi někoho přešel. Jsi výš, protože jsi někoho vytáhl.",
      "en": "You are not higher because you passed someone. You are higher because you pulled someone up."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/175-radiant-spiral.webp",
      "full": "/oasis-assets/concept_svg/175-radiant-spiral.svg",
      "final": false
    },
    "circle": "cosmic"
  },
  {
    "id": 178,
    "name": "Seventh Ray Adjunct",
    "subtitle": {
      "cs": "Sedmý paprsek",
      "en": "The Seventh Ray"
    },
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo proměňuje staré ve funkční",
      "en": "He who transforms the old into something that works"
    },
    "location": {
      "cs": "Fialová komnata",
      "en": "The violet chamber"
    },
    "questLine": {
      "cs": "Proměna bez popření",
      "en": "Transformation Without Denial"
    },
    "teaching": {
      "cs": "Nové nemá smysl, pokud jen popře staré. Musí ho unést dál.",
      "en": "The new makes no sense if it only denies the old. It must carry it forward."
    },
    "ability": {
      "cs": "Proměna — přepíše staré řešení, aniž by ztratilo sílu.",
      "en": "Transmutation — rewrites an old solution without losing its power."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Seventh Ray Adjunct — transmutation stack lore: měň spam grief na burn fee výchovu.",
      "en": "Seventh Ray Adjunct — transmutation-stack lore: turn spam grief into burn-fee education."
    },
    "quote": {
      "cs": "Nebourám starý chrám. Uklízím v něm.",
      "en": "I do not demolish the old temple. I clean it."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/176-seventh-ray-adjunct.webp",
      "full": "/oasis-assets/concept_svg/176-seventh-ray-adjunct.svg",
      "final": false
    },
    "circle": "cosmic"
  },
  {
    "id": 179,
    "name": "Galactic Convenor",
    "subtitle": {
      "cs": "Svolavatel galaxií",
      "en": "Convenor of Galaxies"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo svolává různorodé ke stolu",
      "en": "He who calls the diverse to one table"
    },
    "location": {
      "cs": "Síň sněmovny",
      "en": "The assembly hall"
    },
    "questLine": {
      "cs": "Mandát, který se nepředává dědictvím",
      "en": "A Mandate Not Inherited"
    },
    "teaching": {
      "cs": "Kdo má místo u stolu proto, kdo je, ten ho nemá proto, co umí.",
      "en": "Whoever has a seat because of who they are does not have it because of what they can do."
    },
    "ability": {
      "cs": "Svolání — vytvoří sněm, kde má každý stejný hlas.",
      "en": "Convening — forms an assembly where every voice is equal."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Galactic Convenor — mezihvězdný parlament: facilituje stupně federace (charta → rada → plénum → vyslanectví → občanský prstenec) jako paralelu k DAO delegaci + veto.",
      "en": "Galactic Convenor — the interstellar parliament: facilitates the degrees of federation (charter → council → plenum → envoi → civic ring) as a parallel to DAO delegation + veto."
    },
    "quote": {
      "cs": "Nesedím v čele. Sedím tam, odkud je vidět, kdo chybí.",
      "en": "I do not sit at the head. I sit where I can see who is missing."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/177-galactic-convenor.webp",
      "full": "/oasis-assets/concept_svg/177-galactic-convenor.svg",
      "final": false
    },
    "circle": "cosmic"
  },
  {
    "id": 180,
    "name": "Lightbody Scribe",
    "subtitle": {
      "cs": "Písař světelného těla",
      "en": "Scribe of the Light Body"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která zapisuje jen to, co jí patří",
      "en": "She who records only what belongs to her"
    },
    "location": {
      "cs": "Tichý stůl",
      "en": "The quiet desk"
    },
    "questLine": {
      "cs": "Deník, který si necháš",
      "en": "The Diary You Keep"
    },
    "teaching": {
      "cs": "Ne každý zážitek má být produkt. Některé věci slouží jen tobě.",
      "en": "Not every experience should be a product. Some things serve only you."
    },
    "ability": {
      "cs": "Soukromý zápis — ochrání tvůj vnitřní záznam před zveřejněním.",
      "en": "Private Entry — keeps your inner record from being published."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Lightbody Scribe — revokovatelné journaling: hráči se učí GDPR / delete-my-data přes lore.",
      "en": "Lightbody Scribe — revocable journaling: players learn GDPR / delete-my-data through lore."
    },
    "quote": {
      "cs": "Nepíšu pro publikum. Píšu, abych si pamatovala.",
      "en": "I do not write for an audience. I write so I remember."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/178-lightbody-scribe.webp",
      "full": "/oasis-assets/concept_svg/178-lightbody-scribe.svg",
      "final": false
    },
    "circle": "cosmic"
  },
  {
    "id": 181,
    "name": "Vzestup Capstone",
    "subtitle": {
      "cs": "Závěrečný kámen vzestupu",
      "en": "The Capstone of Ascension"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo uzavře celek a ukáže dál",
      "en": "He who closes the whole and points on"
    },
    "location": {
      "cs": "Poslední schod",
      "en": "The last step"
    },
    "questLine": {
      "cs": "Dvanáct plus jedna",
      "en": "Twelve Plus One"
    },
    "teaching": {
      "cs": "Dokončený kruh není cíl. Je to místo, odkud je vidět další.",
      "en": "A completed circle is not a goal. It is a place from which the next is visible."
    },
    "ability": {
      "cs": "Uzavření — dokončí celek a otevře cestu dál.",
      "en": "Closure — completes the whole and opens the way onward."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Vzestup Capstone — meta waypoint zpět na docs COSMIC MAP a Golden Egg design odkazy.",
      "en": "Vzestup Capstone — a meta waypoint back to the COSMIC MAP docs and Golden Egg design references."
    },
    "quote": {
      "cs": "Nezavírám dveře. Stavím práh.",
      "en": "I am not closing a door. I am building a threshold."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/179-vzestup-capstone.webp",
      "full": "/oasis-assets/concept_svg/179-vzestup-capstone.svg",
      "final": false
    },
    "circle": "cosmic"
  },
  {
    "id": 182,
    "name": "Valhalla Hall-Steward",
    "subtitle": {
      "cs": "Správce Valhally",
      "en": "Steward of Valhalla"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo dbá, aby si bojovníci odpočinuli",
      "en": "He who makes sure warriors rest"
    },
    "location": {
      "cs": "Síň padlých",
      "en": "The hall of the fallen"
    },
    "questLine": {
      "cs": "Odpočinek není slabost",
      "en": "Rest Is Not Weakness"
    },
    "teaching": {
      "cs": "Kdo neumí odložit zbraň, padne únavou, ne protivníkem.",
      "en": "Whoever cannot put the weapon down falls to fatigue, not to the opponent."
    },
    "ability": {
      "cs": "Síň odpočinku — obnoví sílu celé skupině mezi boji.",
      "en": "Hall of Rest — restores the whole group between fights."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Valhalla v eddickém poli je síň Óðinových einherjar — den boje, noc hostiny. V OASIS tento archetyp neslibuje posmrtnou odměnu; učí obnovu týmu, pravidla ringu a anti-burnout rytmus mezi „raidem“ a regenerací.",
      "en": "Valhalla in the Eddic field is the hall of Óðinn's einherjar — days of battle, nights of feasting. In OASIS this archetype promises no afterlife reward; it teaches team recovery, rules of the ring, and an anti-burnout rhythm between 'raid' and regeneration."
    },
    "quote": {
      "cs": "Nejsi tu proto, abys padl. Jsi tu, abys vydržel.",
      "en": "You are not here to fall. You are here to last."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/180-valhalla-hall-steward.webp",
      "full": "/oasis-assets/concept_svg/180-valhalla-hall-steward.svg",
      "final": false
    },
    "circle": "norse-celtic"
  },
  {
    "id": 183,
    "name": "Óðinn Wayfarer",
    "subtitle": {
      "cs": "Óðinn Poutník",
      "en": "Óðinn the Wayfarer"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo se ptá, než rozhodne",
      "en": "He who asks before deciding"
    },
    "location": {
      "cs": "Kamenný kruh",
      "en": "The stone circle"
    },
    "questLine": {
      "cs": "Oko za moudrost",
      "en": "An Eye for Wisdom"
    },
    "teaching": {
      "cs": "Moudrost se kupuje ztrátou. Proto se nemá rozdávat levně.",
      "en": "Wisdom is bought with loss. That is why it should not be given away cheaply."
    },
    "ability": {
      "cs": "Havraní zpráva — přinese dvě verze téhož příběhu.",
      "en": "Raven's Report — brings two versions of the same story."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Óðinn v pramenech spojuje válečnou aristokracii, věštbu a básnickou moc. V OASIS = mentor governance a audit řeči (havraní zpráva = log trace), bez rasových dogwhistlů kolem run.",
      "en": "Óðinn in the sources combines warrior aristocracy, prophecy and poetic power. In OASIS = mentor of governance and audit of speech (the raven report = log trace), without racial dog-whistles around the runes."
    },
    "quote": {
      "cs": "Neptám se, kdo má pravdu. Ptám se, kdo co zamlčel.",
      "en": "I do not ask who is right. I ask who left something out."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/181-oinn-wayfarer.webp",
      "full": "/oasis-assets/concept_svg/181-oinn-wayfarer.svg",
      "final": false
    },
    "circle": "norse-celtic"
  },
  {
    "id": 184,
    "name": "Þórr Storm-Host",
    "subtitle": {
      "cs": "Þórr — ochránce",
      "en": "Þórr — the defender"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo udrží systém v chodu",
      "en": "He who keeps the system running"
    },
    "location": {
      "cs": "Hřmotný hřeben",
      "en": "The thunder ridge"
    },
    "questLine": {
      "cs": "Kladivo, které drží",
      "en": "The Hammer That Holds"
    },
    "teaching": {
      "cs": "Síla se nepozná podle toho, co rozbije, ale podle toho, co udrží.",
      "en": "Strength is not known by what it breaks but by what it keeps standing."
    },
    "ability": {
      "cs": "Ochrana systému — odvrátí výpadek, který by zastavil ostatní.",
      "en": "System Guard — averts the outage that would stop everyone else."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Þórr je v pramenech ochránce bohů a lidí proti chaotickým silám, patron počasí a svateb/hostin. V OASIS = DDoS/spam odolnost, zdraví uzlů, community safety toggles.",
      "en": "Þórr is in the sources the protector of gods and humans against chaotic forces, patron of weather and weddings/feasts. In OASIS = DDoS/spam resilience, node health, community safety toggles."
    },
    "quote": {
      "cs": "Nebojuju s lidmi. Bojuju s tím, co se rozpadá.",
      "en": "I do not fight people. I fight what is falling apart."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/182-orr-storm-host.webp",
      "full": "/oasis-assets/concept_svg/182-orr-storm-host.svg",
      "final": false
    },
    "circle": "norse-celtic"
  },
  {
    "id": 185,
    "name": "Freyja Van-Ruler",
    "subtitle": {
      "cs": "Freyja — správkyně",
      "en": "Freyja — the steward"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která rozděluje férově a chrání soukromí",
      "en": "She who divides fairly and guards privacy"
    },
    "location": {
      "cs": "Květná louka",
      "en": "The flowering meadow"
    },
    "questLine": {
      "cs": "Polovina pro každého",
      "en": "Half for Each"
    },
    "teaching": {
      "cs": "Kdo si nechá víc, než unese, přijde o to, co má.",
      "en": "Whoever keeps more than they can carry loses what they have."
    },
    "ability": {
      "cs": "Férový díl — rozdělí odměnu bez ztráty důstojnosti.",
      "en": "Fair Portion — divides the reward without loss of dignity."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Freyja v pramenech spojuje válečné poloviny padlých, seiðr a plodnost/zlato. V OASIS = spravedlivé odměny validátorů, privacy-preserving magie dat (seiðr jako encryption lore), respekt k genderové pluralitě pramenů.",
      "en": "Freyja in the sources combines the warrior's share of the slain, seiðr and fertility/gold. In OASIS = fair validator rewards, privacy-preserving data magic (seiðr as encryption lore), respect for the gender plurality of the sources."
    },
    "quote": {
      "cs": "Nedávám ti půlku proto, že jsi slabší. Dávám ti ji, protože je tvoje.",
      "en": "I give you half not because you are weaker. I give it because it is yours."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/183-freyja-van-ruler.webp",
      "full": "/oasis-assets/concept_svg/183-freyja-van-ruler.svg",
      "final": false
    },
    "circle": "norse-celtic"
  },
  {
    "id": 186,
    "name": "Týr Oath-Fire",
    "subtitle": {
      "cs": "Týr — přísaha",
      "en": "Týr — the oath"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo drží slovo i za cenu ruky",
      "en": "He who keeps his word even at the cost of a hand"
    },
    "location": {
      "cs": "Kámen přísahy",
      "en": "The oath stone"
    },
    "questLine": {
      "cs": "Ruka v tlamě",
      "en": "The Hand in the Maw"
    },
    "teaching": {
      "cs": "Slib, který se splní jen když se to hodí, není slib.",
      "en": "A promise kept only when convenient is not a promise."
    },
    "ability": {
      "cs": "Přísaha — zaručí, že dohoda nezmizí pod nátlakem.",
      "en": "Oath — guarantees an agreement does not vanish under pressure."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Týr v Gylfaginning položí ruku do tlamy Fenrira, aby smlouva držela. V OASIS = immutable commitment + timelock oběti (symbolicky „prst“ = část stake pro audit).",
      "en": "Týr in Gylfaginning places his hand in Fenrir's jaws so the pact holds. In OASIS = immutable commitment + timelock sacrifice (symbolically the 'hand' = a portion of stake held for audit)."
    },
    "quote": {
      "cs": "Přišel jsem o ruku. Ne o slovo.",
      "en": "I lost a hand. Not my word."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/184-tyr-oath-fire.webp",
      "full": "/oasis-assets/concept_svg/184-tyr-oath-fire.svg",
      "final": false
    },
    "circle": "norse-celtic"
  },
  {
    "id": 187,
    "name": "Brigid Triple-Flame",
    "subtitle": {
      "cs": "Brigid — trojí plamen",
      "en": "Brigid — the triple flame"
    },
    "ray": "White",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která spojuje řemeslo, slovo a péči",
      "en": "She who joins craft, word and care"
    },
    "location": {
      "cs": "Kovárna u studny",
      "en": "The forge by the well"
    },
    "questLine": {
      "cs": "Tři ohně",
      "en": "Three Fires"
    },
    "teaching": {
      "cs": "Dobré řemeslo bez péče je jen přesnost. Přesnost bez slitování je zbraň.",
      "en": "Good craft without care is only precision. Precision without mercy is a weapon."
    },
    "ability": {
      "cs": "Trojí plamen — spojí nástroj, text a laskavost v jedno dílo.",
      "en": "Triple Flame — joins tool, text and kindness into one work."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Brigid v irských pramenech spojuje řemeslo, léčení a poezii. V OASIS = open tooling, dokumentace a community care — ne léčebná NFT tvrzení (viz globální wellness ban).",
      "en": "Brigid in the Irish sources joins craft, healing and poetry. In OASIS = open tooling, documentation and community care — not healing NFT claims (see the global wellness ban)."
    },
    "quote": {
      "cs": "Kdo umí udělat meč, musí umět i obvaz.",
      "en": "Whoever can make a sword must also know the bandage."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/185-brigid-triple-flame.webp",
      "full": "/oasis-assets/concept_svg/185-brigid-triple-flame.svg",
      "final": false
    },
    "circle": "norse-celtic"
  },
  {
    "id": 188,
    "name": "Dagda Peace-Harp",
    "subtitle": {
      "cs": "Dagda — harfa míru",
      "en": "Dagda — the harp of peace"
    },
    "ray": "Green",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo drží společné zdroje",
      "en": "He who holds the common goods"
    },
    "location": {
      "cs": "Palouk u kamene",
      "en": "The clearing by the stone"
    },
    "questLine": {
      "cs": "Kotel, který se nenaplní sám",
      "en": "The Cauldron That Does Not Fill Itself"
    },
    "teaching": {
      "cs": "Společné věci vydrží jen tehdy, když se o ně dělí i ti, kdo je nepotřebují.",
      "en": "Common goods last only when shared even by those who do not need them."
    },
    "ability": {
      "cs": "Harfa — uklidní spor o zdroje dřív, než se rozbije.",
      "en": "Harp — calms a dispute over resources before it breaks."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Dagda v irských cyklech nese kotel, palici a harfu — spojuje válečnou připravenost s obnovou míru. V OASIS = sustainable emissions, epoch spacing, public goods fond.",
      "en": "The Dagda in the Irish cycles carries cauldron, club and harp — combining war-readiness with peace restoration. In OASIS = sustainable emissions, epoch spacing, public goods fund."
    },
    "quote": {
      "cs": "Kotel nikdy nebyl plný. Proto z něj všichni jedli.",
      "en": "The cauldron was never full. That is why everyone ate from it."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/186-dagda-peace-harp.webp",
      "full": "/oasis-assets/concept_svg/186-dagda-peace-harp.svg",
      "final": false
    },
    "circle": "norse-celtic"
  },
  {
    "id": 189,
    "name": "Morrígan Sovereignty-Raven",
    "subtitle": {
      "cs": "Morrígan — havran varování",
      "en": "Morrígan — the raven of warning"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která řekne, co se blíží",
      "en": "She who says what is approaching"
    },
    "location": {
      "cs": "Bitevní pláň před bitvou",
      "en": "The field before the battle"
    },
    "questLine": {
      "cs": "Znamení, které se nedá přeslechnout",
      "en": "The Sign You Cannot Ignore"
    },
    "teaching": {
      "cs": "Varování, které přijde pozdě, je jen popis.",
      "en": "A warning that comes late is only a description."
    },
    "ability": {
      "cs": "Havraní znamení — oznámí hrozbu s předstihem.",
      "en": "Raven's Sign — announces the threat in advance."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Morrígan v irských textech spojuje válku, věštbu a svrchovanost — figuruje v Táin Bó Cúailnge a souvisejících vrstvách. V OASIS = threat modeling, responsible disclosure, governance veto proti útokům na síť.",
      "en": "Morrígan in the Irish texts joins war, prophecy and sovereignty — figuring in the Táin Bó Cúailnge and related layers. In OASIS = threat modeling, responsible disclosure, governance veto against attacks on the network."
    },
    "quote": {
      "cs": "Nepřináším smrt. Přináším zprávu, že už je blízko.",
      "en": "I do not bring death. I bring the news that it is close."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/187-morrigan-sovereignty-raven.webp",
      "full": "/oasis-assets/concept_svg/187-morrigan-sovereignty-raven.svg",
      "final": false
    },
    "circle": "norse-celtic"
  },
  {
    "id": 190,
    "name": "Lugh Samildanach",
    "subtitle": {
      "cs": "Lugh — mnoha dovedností",
      "en": "Lugh — of many skills"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo zvládne víc než jednu věc",
      "en": "He who can do more than one thing"
    },
    "location": {
      "cs": "Brána královského dvora",
      "en": "The gate of the royal court"
    },
    "questLine": {
      "cs": "Přijď, až umíš všechno",
      "en": "Come When You Can Do It All"
    },
    "teaching": {
      "cs": "Nejsi nepostradatelný proto, že umíš všechno. Jsi, protože to umíš předat.",
      "en": "You are not indispensable because you can do everything. You are because you can pass it on."
    },
    "ability": {
      "cs": "Mnoho dovedností — zastoupí chybějícího člena týmu.",
      "en": "Many Skills — covers for the missing member of the team."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Lugh v irských pramenech vítězí v Táin jako polymat — patron Lughnasadh (sklizeň/shromáždění). V OASIS = rotace multi-sig rolí, mentor program napříč moduly (L1/pool/docs).",
      "en": "Lugh in the Irish sources wins in the Táin as a polymath — patron of Lughnasadh (harvest/assembly). In OASIS = multi-sig role rotation, a mentor program across modules (L1/pool/docs)."
    },
    "quote": {
      "cs": "U brány se ptají, co umíš. Ne kdo jsi.",
      "en": "At the gate they ask what you can do. Not who you are."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/188-lugh-samildanach.webp",
      "full": "/oasis-assets/concept_svg/188-lugh-samildanach.svg",
      "final": false
    },
    "circle": "norse-celtic"
  },
  {
    "id": 191,
    "name": "Manannán mac Lir",
    "subtitle": {
      "cs": "Manannán — mlžný průvodce",
      "en": "Manannán — the mist guide"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo drží hranici mezi světy",
      "en": "He who keeps the border between worlds"
    },
    "location": {
      "cs": "Pobřeží v mlze",
      "en": "The coast in mist"
    },
    "questLine": {
      "cs": "Cesta, kterou vidíš jen na krok",
      "en": "The Road You See One Step Ahead"
    },
    "teaching": {
      "cs": "Nepotřebuješ vidět celou cestu. Stačí další krok.",
      "en": "You do not need to see the whole road. The next step is enough."
    },
    "ability": {
      "cs": "Mlžný přechod — bezpečně převede mezi dvěma prostředími.",
      "en": "Mist Crossing — safely moves you between two environments."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Manannán v irských cyklech vládne moři a mlžným prahům mezi světy. V OASIS = segmentace sítě, feature flags, disciplína staging → mainnet.",
      "en": "Manannán in the Irish cycles rules the seas and the misty thresholds between worlds. In OASIS = network segmentation, feature flags, staging → mainnet discipline."
    },
    "quote": {
      "cs": "Mlha není překážka. Je to způsob, jak jít opatrně.",
      "en": "The mist is not an obstacle. It is a way of walking carefully."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/189-manannan-mac-lir.webp",
      "full": "/oasis-assets/concept_svg/189-manannan-mac-lir.svg",
      "final": false
    },
    "circle": "norse-celtic"
  },
  {
    "id": 192,
    "name": "Ré Solar-Barque",
    "subtitle": {
      "cs": "Ré — sluneční bárka",
      "en": "Ré — the solar barque"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo drží denní rytmus",
      "en": "He who keeps the daily rhythm"
    },
    "location": {
      "cs": "Obzor, ráno a večer",
      "en": "The horizon, morning and evening"
    },
    "questLine": {
      "cs": "Cesta přes noc",
      "en": "The Passage Through Night"
    },
    "teaching": {
      "cs": "Každý den se musí začít znovu, i když ten včerejší byl dobrý.",
      "en": "Every day must begin again, even if yesterday was good."
    },
    "ability": {
      "cs": "Denní světlo — zpřehlední čas a tempo dne.",
      "en": "Daylight — clarifies time and the pace of the day."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ré jako sluneční bůh ve faraonské kosmologii pojí den, cyklus a řád. V OASIS = disciplína block time, transparentní epochy, anti-FOMO release rytmus.",
      "en": "Ré as the sun god in pharaonic cosmology binds day, cycle and order. In OASIS = block-time discipline, transparent epochs, anti-FOMO release rhythm."
    },
    "quote": {
      "cs": "Nezastavuji se. Kdo se zastaví, ten zůstane v noci.",
      "en": "I do not stop. Whoever stops stays in the night."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/190-re-solar-barque.webp",
      "full": "/oasis-assets/concept_svg/190-re-solar-barque.svg",
      "final": false
    },
    "circle": "egypt"
  },
  {
    "id": 193,
    "name": "Hor Unifier",
    "subtitle": {
      "cs": "Hor — dvojí koruna",
      "en": "Horus — the double crown"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo spojuje dvě země",
      "en": "He who joins two lands"
    },
    "location": {
      "cs": "Hranice Horního a Dolního Egypta",
      "en": "The border of Upper and Lower Egypt"
    },
    "questLine": {
      "cs": "Dvě koruny, jedna hlava",
      "en": "Two Crowns, One Head"
    },
    "teaching": {
      "cs": "Sjednotit neznamená vymazat. Znamená to nechat obojí mluvit.",
      "en": "To unite is not to erase. It is to let both speak."
    },
    "ability": {
      "cs": "Dvojí koruna — spojí dvě rozdílné správy v jednu.",
      "en": "Double Crown — joins two different administrations into one."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Hor v klasické mytologii ztělesňuje královskou legitimitu, ochranu otce Usira a jednotu země. V OASIS = governance charter, multi-region konsensus, escrow ochrana treasury.",
      "en": "Hor in classical mythology embodies royal legitimacy, protection of his father Osiris and the unity of the land. In OASIS = governance charter, multi-region consensus, escrow protection of the treasury."
    },
    "quote": {
      "cs": "Nejsem král jedné země. Jsem ten, kdo je drží u sebe.",
      "en": "I am not king of one land. I am the one who holds them together."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/191-hor-unifier.webp",
      "full": "/oasis-assets/concept_svg/191-hor-unifier.svg",
      "final": false
    },
    "circle": "egypt"
  },
  {
    "id": 194,
    "name": "Thoth Scribe",
    "subtitle": {
      "cs": "Thovt — písař",
      "en": "Thoth — the scribe"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo zapisuje bez přikrášlení",
      "en": "He who records without embellishment"
    },
    "location": {
      "cs": "Dům života",
      "en": "The House of Life"
    },
    "questLine": {
      "cs": "Zápis, který vydrží",
      "en": "The Record That Lasts"
    },
    "teaching": {
      "cs": "Co není zapsáno, se ztratí. Co je zapsáno špatně, škodí.",
      "en": "What is not written is lost. What is written wrongly does harm."
    },
    "ability": {
      "cs": "Přesný záznam — doloží, co se stalo a kdy.",
      "en": "Accurate Record — documents what happened and when."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Thovt (Djehuty) spojuje písmo, moudrost a soudní záznam. V OASIS = Merkle důkazy, changelog, audit trail bez manipulace timestampů.",
      "en": "Thoth (Djehuty) joins writing, wisdom and the judicial record. In OASIS = Merkle proofs, changelog, audit trail without timestamp manipulation."
    },
    "quote": {
      "cs": "Nepíšu, co si přeješ. Píšu, co se stalo.",
      "en": "I do not write what you wish. I write what happened."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/192-thoth-scribe.webp",
      "full": "/oasis-assets/concept_svg/192-thoth-scribe.svg",
      "final": false
    },
    "circle": "egypt"
  },
  {
    "id": 195,
    "name": "Hathor Jubilee",
    "subtitle": {
      "cs": "Hathor — radost",
      "en": "Hathor — joy"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která drží právo na radost",
      "en": "She who keeps the right to joy"
    },
    "location": {
      "cs": "Hudební zahrada",
      "en": "The garden of music"
    },
    "questLine": {
      "cs": "Svátek, který nikoho nevyloučí",
      "en": "A Feast That Excludes No One"
    },
    "teaching": {
      "cs": "Radost, která se slaví na úkor druhých, není radost.",
      "en": "Joy celebrated at the expense of others is not joy."
    },
    "ability": {
      "cs": "Slavnost — obnoví chuť celé skupině.",
      "en": "Jubilee — restores the appetite of the whole group."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Hathor spojuje nebeskou krávu, hudbu, tanec a milost. V OASIS = oslavy komunity, bezpečné sociální eventy, anti-burnout party vrstva (bez monetizovaných „rituálů“).",
      "en": "Hathor joins the celestial cow, music, dance and grace. In OASIS = community celebration, safe social events, an anti-burnout party layer (no monetized 'rituals')."
    },
    "quote": {
      "cs": "Nepřináším zábavu. Přináším dovolení být šťastný.",
      "en": "I do not bring entertainment. I bring permission to be happy."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/193-hathor-jubilee.webp",
      "full": "/oasis-assets/concept_svg/193-hathor-jubilee.svg",
      "final": false
    },
    "circle": "egypt"
  },
  {
    "id": 196,
    "name": "Sekhmet Audit-Flame",
    "subtitle": {
      "cs": "Sachmet — oheň účtu",
      "en": "Sekhmet — the fire of account"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která trestá a pak vysvětlí",
      "en": "She who punishes and then explains"
    },
    "location": {
      "cs": "Síň účtování",
      "en": "The hall of reckoning"
    },
    "questLine": {
      "cs": "Rána a chlad",
      "en": "The Blow and the Cooling"
    },
    "teaching": {
      "cs": "Trest bez vysvětlení vychová jen strach.",
      "en": "Punishment without explanation raises only fear."
    },
    "ability": {
      "cs": "Účet — odečte, co bylo vzato, a nechá prostor to napravit.",
      "en": "Reckoning — deducts what was taken and leaves room to repair."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Sachmet spojuje válečnou zuřivost a ochranu řádu; mýtus opojení pivem jako ukojení. V OASIS = slashing podmínky, penalty vault, cooling po incidentu — ne glorifikace genocidy.",
      "en": "Sekhmet joins warlike fury and the protection of order; the myth of her beer-drunkenness as appeasement. In OASIS = slashing conditions, penalty vault, post-incident cooling — no glorification of genocide."
    },
    "quote": {
      "cs": "Spálím a pak se zeptám, jestli chceš vědět proč.",
      "en": "I burn, and then I ask whether you want to know why."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/194-sekhmet-audit-flame.webp",
      "full": "/oasis-assets/concept_svg/194-sekhmet-audit-flame.svg",
      "final": false
    },
    "circle": "egypt"
  },
  {
    "id": 197,
    "name": "Ptah Mason",
    "subtitle": {
      "cs": "Ptah — stavitel",
      "en": "Ptah — the builder"
    },
    "ray": "Green",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo tvoří slovy a vzory",
      "en": "He who creates with words and templates"
    },
    "location": {
      "cs": "Dílna u Memfidy",
      "en": "The workshop at Memphis"
    },
    "questLine": {
      "cs": "První kámen",
      "en": "The First Stone"
    },
    "teaching": {
      "cs": "Co se nemá podle čeho opravit, to se jednou postaví znovu a jinak, než bylo myšleno.",
      "en": "What has no pattern to be repaired by will one day be built again differently than intended."
    },
    "ability": {
      "cs": "Vzor — vytvoří stavební pravidlo, které jde opakovat.",
      "en": "Template — creates a building rule that can be repeated."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ptah je patron řemesla, architekt a tvůrce v memfidské teologii. V OASIS = genesis konfigurace, smart contract šablony, bezpečné factory patterny.",
      "en": "Ptah is the patron of craft, the architect and creator in Memphite theology. In OASIS = genesis configuration, smart-contract templates, safe factory patterns."
    },
    "quote": {
      "cs": "Nestavím to, co je vidět. Stavím to, podle čeho se to staví.",
      "en": "I do not build what is seen. I build what it is built by."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/195-ptah-mason.webp",
      "full": "/oasis-assets/concept_svg/195-ptah-mason.svg",
      "final": false
    },
    "circle": "egypt"
  },
  {
    "id": 198,
    "name": "Anubis Threshold",
    "subtitle": {
      "cs": "Anup — prahu strážce",
      "en": "Anubis — keeper of the threshold"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo váží, co s sebou nést",
      "en": "He who weighs what to carry along"
    },
    "location": {
      "cs": "Práh mezi dvěma cestami",
      "en": "The threshold between two roads"
    },
    "questLine": {
      "cs": "Zavazadlo na cestu",
      "en": "Luggage for the Road"
    },
    "teaching": {
      "cs": "Na novou cestu se nebere všechno. Ne všechno, co máš, je tvoje.",
      "en": "You do not take everything on a new road. Not everything you have is yours."
    },
    "ability": {
      "cs": "Záloha před odchodem — zajistí, že se nic neztratí.",
      "en": "Backup Before Departure — ensures nothing is lost."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Anup (Anubis) v pramenech spojuje balzamování, ochranu mrtvých a vážení v soudních scénách. V OASIS = migrační thresholdy, snapshot před forkem, data retention politika — nikoli posmrtné sliby hráčům.",
      "en": "Anup (Anubis) in the sources joins embalming, protection of the dead and the weighing in judgment scenes. In OASIS = migration thresholds, snapshot before fork, data-retention policy — not afterlife promises to players."
    },
    "quote": {
      "cs": "Neptám se, co jsi udělal. Ptám se, co poneseš dál.",
      "en": "I do not ask what you did. I ask what you will carry on."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/196-anubis-threshold.webp",
      "full": "/oasis-assets/concept_svg/196-anubis-threshold.svg",
      "final": false
    },
    "circle": "egypt"
  },
  {
    "id": 199,
    "name": "Amun Hidden-Field",
    "subtitle": {
      "cs": "Amon — skryté pole",
      "en": "Amun — the hidden field"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo chrání rozhodnutí v utajení",
      "en": "He who protects decisions made in confidence"
    },
    "location": {
      "cs": "Skrytá svatyně",
      "en": "The hidden sanctuary"
    },
    "questLine": {
      "cs": "Hlas, který se počítá potichu",
      "en": "The Vote Counted Quietly"
    },
    "teaching": {
      "cs": "Kdo se bojí mluvit, musí mít možnost mluvit tak, aby ho neslyšeli ti, kterých se bojí.",
      "en": "Whoever is afraid to speak must be able to speak without being heard by those they fear."
    },
    "ability": {
      "cs": "Skrytý hlas — umožní rozhodnout bez nátlaku.",
      "en": "Hidden Voice — allows a decision without pressure."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Amon (Amun) v novoříšské syntéze spojuje neviditelnou moc a vzduch. V OASIS = commit–reveal hlasování, hidden state v testech, zero-knowledge lore (bez matematických lží).",
      "en": "Amun in New Kingdom synthesis joins hidden power and air. In OASIS = commit–reveal voting, hidden state in tests, zero-knowledge lore (no mathematical falsehoods)."
    },
    "quote": {
      "cs": "Nejsem neviditelný. Jen nejsem na prodej.",
      "en": "I am not invisible. I am simply not for sale."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/197-amun-hidden-field.webp",
      "full": "/oasis-assets/concept_svg/197-amun-hidden-field.svg",
      "final": false
    },
    "circle": "egypt"
  },
  {
    "id": 200,
    "name": "Geb Foundation",
    "subtitle": {
      "cs": "Geb — základ",
      "en": "Geb — the foundation"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ten, kdo připomíná, že vše stojí na hmotě",
      "en": "He who reminds that everything rests on matter"
    },
    "location": {
      "cs": "Základová deska",
      "en": "The foundation slab"
    },
    "questLine": {
      "cs": "Co je pod tím",
      "en": "What Is Underneath"
    },
    "teaching": {
      "cs": "Každý systém stojí na něčem, co se musí obnovovat ručně.",
      "en": "Every system rests on something that must be renewed by hand."
    },
    "ability": {
      "cs": "Základ — odhalí, co fyzicky drží provoz.",
      "en": "Foundation — reveals what physically holds the service up."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Geb je bůh země, otec Usira, Seta, Eset a Neftý v klasické genealogii. V OASIS = hardware/OS baseline, node disk, carbon-aware lokace validátorů (jen lore).",
      "en": "Geb is the earth god, father of Osiris, Set, Isis and Nephthys in classical genealogy. In OASIS = hardware/OS baseline, node disk, carbon-aware validator placement (lore only)."
    },
    "quote": {
      "cs": "Nikdo se nedívá dolů. Proto se to tam rozpadá.",
      "en": "No one looks down. That is why it falls apart there."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/198-geb-foundation.webp",
      "full": "/oasis-assets/concept_svg/198-geb-foundation.svg",
      "final": false
    },
    "circle": "egypt"
  },
  {
    "id": 201,
    "name": "Nut Stellar Vault",
    "subtitle": {
      "cs": "Nut — hvězdná klenba",
      "en": "Nut — the stellar vault"
    },
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": {
      "cs": "Tělo a dech",
      "en": "Body & Breath"
    },
    "role": {
      "cs": "Ta, která drží prostor nad vším",
      "en": "She who holds the space above everything"
    },
    "location": {
      "cs": "Noční obloha",
      "en": "The night sky"
    },
    "questLine": {
      "cs": "Hvězdy jako záznam",
      "en": "Stars as a Record"
    },
    "teaching": {
      "cs": "Co se rozšíří, musí se udržovat v noci, když to nikdo nevidí.",
      "en": "Whatever is expanded must be maintained at night, when no one is watching."
    },
    "ability": {
      "cs": "Noční údržba — udrží systém, i když všichni spí.",
      "en": "Night Maintenance — keeps the system while everyone sleeps."
    },
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Nut je nebeská bohyně oblouku hvězd; mytologicky „spolkne“ slunce na noc. V OASIS = sharded state, noční joby, navigace hvězdnou mapou v meta-doku.",
      "en": "Nut is the celestial goddess arched with stars; mythologically she 'swallows' the sun at night. In OASIS = sharded state, nightly jobs, star-map navigation in the meta-doc."
    },
    "quote": {
      "cs": "Přes den na mě zapomínáš. V noci tě držím.",
      "en": "By day you forget me. At night I hold you."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/199-nut-stellar-vault.webp",
      "full": "/oasis-assets/concept_svg/199-nut-stellar-vault.svg",
      "final": false
    },
    "circle": "egypt"
  },
  {
    "id": 202,
    "name": "Bolon Yokte' K'uh",
    "subtitle": {
      "cs": "Bolon Jokte' K'uh — bůh devíti kroků",
      "en": "Bolon Yokte' K'uh — god of nine steps"
    },
    "ray": "Obsidian",
    "rarity": "Legendary",
    "cl": 7,
    "clName": {
      "cs": "Léčivý soucit",
      "en": "Healing Compassion"
    },
    "role": {
      "cs": "Ten, kdo uzavírá a otevírá věk",
      "en": "He who closes and opens an age"
    },
    "location": {
      "cs": "Práh počítání dnů",
      "en": "The threshold of counting days"
    },
    "questLine": {
      "cs": "Devět kroků k přechodu",
      "en": "Nine Steps to the Crossing"
    },
    "teaching": {
      "cs": "Konec věku není konec světa. Je to jen chvíle, kdy se musí přepočítat, co platí.",
      "en": "The end of an age is not the end of the world. It is simply the moment when what holds must be recounted."
    },
    "ability": {
      "cs": "Přechod — uzavře starý věk a otevře nový bez ztráty paměti.",
      "en": "Crossing — closes an old age and opens a new one without losing memory."
    },
    "key": "Maya Cycle Key",
    "quests": [
      {
        "title": "Krok 1: Rozpoznání",
        "description": "Find Tortuguero Monument 6 in the rainforest and read the eroded glyphs."
      },
      {
        "title": "Krok 2: Pouta",
        "description": "Reveal the rope symbol: who is the prisoner and who is the guard?"
      },
      {
        "title": "Krok 3: Xibalba",
        "description": "Descend into the nine lords of the underworld."
      },
      {
        "title": "Krok 4: Strom",
        "description": "Find the Ceiba tree growing on the border of three worlds."
      },
      {
        "title": "Krok 5: Čas",
        "description": "Understand the difference between linear and cyclical time."
      },
      {
        "title": "Krok 6: Smrt jako tvorba",
        "description": "Accept death as creation through the Fountain vision."
      },
      {
        "title": "Krok 7: Investitura",
        "description": "Ceremony of changing: remove the old avatar skin and take the new."
      },
      {
        "title": "Krok 8: Slunce",
        "description": "Birth a new cycle by activating the Genesis block in the temple courtyard."
      },
      {
        "title": "Krok 9: Zobrazení",
        "description": "Bolon Yokte manifests in full form; the player gains a permanent ability."
      }
    ],
    "essence": {
      "cs": "B'olon Yokte' K'uh je nadpantheonový bůh — starší než jednotlivá města, širší než jedna linie. Jméno znamená „devět kroků“ nebo „devět podpor“. Objevuje se při koncích velkých cyklů — ne jako zhoubce, ale jako bůh přechodů, převlékání a nového začátku.",
      "en": "B'olon Yokte' K'uh is a supra-pantheon god — older than any single city, broader than any single lineage. The name means 'Nine Steps' or 'Nine Supports'. He appears at the ends of great cycles — not as a destroyer, but as the god of transitions, re-vesting and new beginnings."
    },
    "quote": {
      "cs": "Nepřicházím soudit. Přicházím počítat.",
      "en": "I do not come to judge. I come to count."
    },
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/200-bolon-yokte-k-uh.webp",
      "full": "/oasis-assets/concept_svg/200-bolon-yokte-k-uh.svg",
      "final": false
    },
    "circle": "maya"
  }
];
