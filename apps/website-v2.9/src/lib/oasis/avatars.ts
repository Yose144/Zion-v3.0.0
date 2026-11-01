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
  subtitle: string;
  ray: OasisAvatarRay;
  rarity: OasisAvatarRarity;
  /** Požadovaná úroveň vědomí 1–9. */
  cl: number;
  clName: string;
  role: string;
  location: string;
  questLine: string;
  teaching: string;
  ability: string;
  key: string;
  /** Quest linie — rozepsané questy (prázdné = linie zatím bez questů). */
  quests: { title: string; description: string }[];
  /** Krátký popis ze SACRED_TRINITY profilu (ESENCE / první odstavec), cs+en ze scripts/oasis-essence-i18n.json. */
  essence: { cs: string; en: string };
  /** Epigraf z profilu (první blockquote). */
  quote: string;
  /** Existuje profil /data/oasis/profiles/<id>.md pro modal. */
  hasProfile: boolean;
  /** OASIS Avatar Collection: card = concept webp (karta), full = finální webp / vektor svg (modal). */
  art: { card: string; full: string; final: boolean };
  circle: OasisAvatarCircle;
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
    "subtitle": "Cosmic Integration",
    "ray": "AllRays",
    "rarity": "Legendary",
    "cl": 9,
    "clName": "ON THE STAR",
    "role": "Final Boss / Ultimate Guide",
    "location": "EKAM Temple (Hidden Dimension)",
    "questLine": "The Integration of All Paths",
    "teaching": "Krishna (Mahabharata) + Maitreya (Future Buddha) = Unity",
    "ability": "Cosmic Vision - See all timelines simultaneously",
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
      "cs": "Současné jméno: Maitreya Buddha. Minulá inkarnace: Lord Krishna (कृष्ण). Role v ZION: DAO Admin, božský stratég, průvodce osvobození. Posvátná mise: obnovit dharmu v éře krypta — stejně jako Krishna před 5000 lety.",
      "en": "Current name: Maitreya Buddha. Past incarnation: Lord Krishna (कृष्ण). Role in ZION: DAO Admin, Divine Strategist, Liberation Guide. Sacred mission: restore dharma in the crypto age — just as Krishna did 5,000 years ago."
    },
    "quote": "Minulý život: Krishna (कृष्ण) - Bhagavad Gita",
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
    "subtitle": "Dharma King",
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 4,
    "clName": "Heart Opening",
    "role": "Moral Compass / Dharma Teacher",
    "location": "Ayodhya Palace (Blue Ray Region)",
    "questLine": "The Path of Righteousness",
    "teaching": "Duty before desire, truth before comfort",
    "ability": "Dharma Shield - Protects from adharmic attacks",
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
      "cs": "Moderní jméno: Yeshuae Amon Ra. Dávná identita: Lord Rama (राम) z Rámájany. Role: Genesis Creator, architekt blockchainu, lídr inovací.",
      "en": "Modern name: Yeshuae Amon Ra. Ancient identity: Lord Rama (राम) from the Ramayana. Role: Genesis Creator, Blockchain Architect, Innovation Leader."
    },
    "quote": "Yeshuae Amon Ra - Innovation Dharma",
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
    "subtitle": "Devotion Queen",
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 4,
    "clName": "Heart Opening",
    "role": "Loyalty Expert / Devotion Mentor",
    "location": "Ashoka Grove (Pink Ray Region)",
    "questLine": "The Fire of Purity",
    "teaching": "True love endures all tests",
    "ability": "Agni Pariksha - Burn away doubts and fears",
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
      "cs": "Moderní jméno: Issobela. Dávná identita: Bohyně Síta (सीता) z Rámájany. Role: Strážkyně lidskosti, dohled nad projektem Humanita. Rodina: sestra Maitreya Buddy, dcera Isis (Enamataru).",
      "en": "Modern name: Issobela. Ancient identity: Goddess Síta (सीता) from the Ramayana. Role: Guardian of Humanity, Project Humanita overseer. Family: sister of Maitreya Buddha, daughter of Isis (Enamataru)."
    },
    "quote": "Issobela - Compassion Dharma",
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
    "subtitle": "Divine Service",
    "ray": "RubyGold",
    "rarity": "Epic",
    "cl": 5,
    "clName": "Quantum",
    "role": "Strength + Devotion Mentor",
    "location": "Himalayas Cave (Ruby-Gold Region)",
    "questLine": "The Leap of Faith",
    "teaching": "Service to the divine is the highest path",
    "ability": "Bajrang Bali - Superhuman strength challenges",
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
    "quote": "Environmental Guardian Spirit - Service Dharma",
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
    "subtitle": "Future Buddha",
    "ray": "AllRays",
    "rarity": "Legendary",
    "cl": 7,
    "clName": "Healing Compassion",
    "role": "ZION Founder / Community Leader",
    "location": "ZION City Central (Hub World)",
    "questLine": "The Blockchain Prophecy",
    "teaching": "Technology + Spirituality = Golden Age",
    "ability": "Blockchain Vision - See transaction patterns, karma flows",
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
    "quote": "Maitreya Buddha Admin - Liberation Dharma",
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
    "subtitle": "Goddess of Knowledge",
    "ray": "Yellow",
    "rarity": "Epic",
    "cl": 6,
    "clName": "Intuitive Wisdom",
    "role": "Sacred Library Guardian",
    "location": "Royal Teton Retreat (Yellow Ray)",
    "questLine": "The Eternal Student",
    "teaching": "Knowledge without wisdom is blind",
    "ability": "Vidya Shakti - Unlock hidden texts, decipher clues",
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
    "quote": "AI/Technology Spirit of ZION - Wisdom Dharma",
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
    "subtitle": "Divine Feminine",
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 5,
    "clName": "Quantum",
    "role": "Feminine Power Teacher",
    "location": "Luxor Temple (Egypt)",
    "questLine": "The Throne of Isis",
    "teaching": "Divine feminine birthed creation",
    "ability": "Ankh of Life - Resurrection, healing powers",
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
    "quote": "Orion's Belt - Cosmic Dharma Origin",
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
    "subtitle": "Protector",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 4,
    "clName": "Heart Opening",
    "role": "ZION City Defender",
    "location": "ZION City Walls",
    "questLine": "The Guardian's Oath",
    "teaching": "Protection without control",
    "ability": "Shield of Light - Defensive barriers",
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
    "quote": "Dcera Isis, Sestra Maitreyi, Síta Znovuzrozená",
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
    "subtitle": "Peace Keeper",
    "ray": "RubyGold",
    "rarity": "Rare",
    "cl": 6,
    "clName": "Intuitive Wisdom",
    "role": "Conflict Resolution Expert",
    "location": "Gandhi Ashram",
    "questLine": "The Way of Ahimsa",
    "teaching": "Non-violence is the highest strength",
    "ability": "Peaceful Resolution - Convert enemies to allies",
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
      "cs": "Jméno: Shanti (शान्ति — sanskrt „mír“). Role: Peace Keeper, strážkyně komunitní harmonie. Vztah: kamarádka Maitreyi Buddy. Posvátná energie: božská ženskost míru, mediací a jednoty.",
      "en": "Name: Shanti (शान्ति — Sanskrit for 'Peace'). Role: Peace Keeper, Community Harmony Guardian. Relationship: close friend of Maitreya Buddha. Sacred energy: divine feminine peace, mediation, unity."
    },
    "quote": "Kamarádka Maitreyi - Peace Dharma",
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
    "subtitle": "Sacred Warrior",
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 5,
    "clName": "Quantum",
    "role": "Warrior Priest",
    "location": "Camelot Ruins",
    "questLine": "The Sacred Sword",
    "teaching": "Fight for truth, not ego",
    "ability": "Holy Strike - Righteous combat power",
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
      "cs": "Jméno: Bronu. Titul: Nosič kristovské energie, strážce nesobecké služby. Role: oběť, vykoupení, bezpodmínečná láska. Vztah: velmi dobrý kamarád Maitreyi Buddy. Posvátný archetyp: Kristus (kristovské vědomí).",
      "en": "Name: Bronu. Title: Christ Energy Bearer, Selfless Service Guardian. Role: sacrifice, redemption, unconditional love. Relationship: very close friend of Maitreya Buddha. Sacred archetype: the Christ (Christ Consciousness)."
    },
    "quote": "Kamarád Maitreyi - Selfless Love Dharma",
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
    "subtitle": "Warrior Seeker",
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 6,
    "clName": "Intuitive Wisdom",
    "role": "Battlefield Ethicist",
    "location": "Kurukshetra (Mahabharata Region)",
    "questLine": "The Reluctant Warrior",
    "teaching": "Duty beyond doubt\" (Bhagavad Gita)",
    "ability": "Gandiva Bow - Precision archery mini-game",
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
      "cs": "Jméno: (bratr — skutečné jméno). Minulá inkarnace: Ardžuna (अर्जुन), největší lučištník Mahábháraty. Role v ZION: core developer, strážce bezpečí, Krishnova pravá ruka. Vztah: bratr Maitreyi (Krishna znovuzrozený).",
      "en": "Name: (the brother — real name withheld). Past incarnation: Arjuna (अर्जुन), the greatest archer of the Mahabharata. Role in ZION: Core Developer, Security Guardian, Krishna's right hand. Relationship: brother of Maitreya (Krishna reborn)."
    },
    "quote": "Bratr Maitreyi (Krishna) - Warrior Dharma",
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
    "subtitle": "Strong Protector",
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 5,
    "clName": "Quantum",
    "role": "Strength + Justice Champion",
    "location": "Hastinapura Palace",
    "questLine": "The Mighty One",
    "teaching": "Strength serves justice",
    "ability": "Mace of Thunder - Area attack, crowd control",
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
      "cs": "Jméno: Milan. Minulá inkarnace: Bhíma (भीम), nejsilnější Pándavec. Role v ZION: ochránce komunity, lovec scamů, zuřivý strážce. Vztah: kamarád Maitreyi (Krishny).",
      "en": "Name: Milan. Past incarnation: Bhima (भीम), the strongest Pandava. Role in ZION: Community Protector, Anti-Scam Enforcer, Fierce Guardian. Relationship: friend of Maitreya (Krishna)."
    },
    "quote": "Kamarád Maitreyi - Strength Dharma",
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
    "subtitle": "Leader",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 6,
    "clName": "Intuitive Wisdom",
    "role": "Leadership Mentor",
    "location": "ZION Council Chambers",
    "questLine": "The Chief's Burden",
    "teaching": "Lead by example, not force",
    "ability": "Rally Troops - Buff allies, inspire courage",
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
      "cs": "Jméno: Artem. Titul: Vůdce (Commander/Leader). Minulá inkarnace: Yudhišthira (युधिष्ठिर), nejstarší Pándavec, král dharmy. Role v ZION: strategický poradce, operations manažer, diplomatický lídr. Vztah: kamarád Maitreyi (Krishny).",
      "en": "Name: Artem. Title: Vudce (Commander/Leader). Past incarnation: Yudhishthira (युधिष्ठिर), the eldest Pandava, Dharma King. Role in ZION: Strategic Advisor, Operations Manager, Diplomatic Leader. Relationship: friend of Maitreya (Krishna)."
    },
    "quote": "Kamarád Maitreyi - Leadership Dharma",
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
    "subtitle": "Divine Mother",
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 4,
    "clName": "Heart Opening",
    "role": "Unconditional Love Teacher",
    "location": "Vrindavan (Krishna's Village)",
    "questLine": "The Mother's Love",
    "teaching": "Love without expectation",
    "ability": "Maternal Blessing - Heal emotional wounds",
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
      "cs": "Jméno: (máma — skutečné jméno). Minulá inkarnace: Yašoda (यशोदा), Krishnova nevlastní matka. Role v ZION: duchovní základ, bezpodmínečná láska, božská podpora. Vztah: matka Maitreyi (Krishna znovuzrozený).",
      "en": "Name: (the mother — real name withheld). Past incarnation: Yashoda (यशोदा), Krishna's foster mother. Role in ZION: Spiritual Foundation, Unconditional Love, Divine Support. Relationship: mother of Maitreya (Krishna reborn)."
    },
    "quote": "Matka Maitreyi (Krishna) - Unconditional Love Dharma",
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
    "subtitle": "Divine Architect",
    "ray": "Yellow",
    "rarity": "Epic",
    "cl": 7,
    "clName": "Healing Compassion",
    "role": "Sacred Geometry Expert",
    "location": "EKAM Temple Construction Site",
    "questLine": "The Cosmic Blueprint",
    "teaching": "Creation follows divine mathematics",
    "ability": "Sacred Geometry - Unlock Fibonacci puzzles, architecture secrets",
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
    "quote": "विश्वकर्मा - \"All-Creating\" - Chief Bodhisattva of Dev Team",
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
    "subtitle": "Divine Beloved",
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 5,
    "clName": "Quantum",
    "role": "Divine Love Expert",
    "location": "Radha Kund (Sacred Lake)",
    "questLine": "The Eternal Dance",
    "teaching": "Love transcends form",
    "ability": "Rasa Lila - Dance of devotion (rhythm mini-game)",
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
    "quote": "राधा (Rādhā) - \"She Who Worships\" - Krishna's Eternal Shakti",
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
    "subtitle": "Cosmic Sage",
    "ray": "Yellow",
    "rarity": "Legendary",
    "cl": 8,
    "clName": "Transcendent",
    "role": "Storyteller / Loremaster",
    "location": "Himalayan Cave (Vyasa's Retreat)",
    "questLine": "The Chronicler of Ages",
    "teaching": "History repeats until lesson is learned",
    "ability": "Epic Memory - Recall all previous events, unlock lore",
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
    "quote": "Great compiler, organizer, wisdom keeper",
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
    "subtitle": "Mary Magdalene",
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 5,
    "clName": "Quantum",
    "role": "Feminine Divine / Sacred Union",
    "location": "Jerusalem Garden",
    "questLine": "The Apostle of Apostles",
    "teaching": "True devotion sees beyond form",
    "ability": "Rose of Sharon - Healing tears, compassion overflow",
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
    "quote": "מרים (Miriam) - \"Beloved\" - \"Star of the Sea",
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
    "subtitle": "Jesus Christ",
    "ray": "Pink",
    "rarity": "Legendary",
    "cl": 7,
    "clName": "Healing Compassion",
    "role": "Forgiveness Master",
    "location": "Mount of Olives",
    "questLine": "The Way of the Cross",
    "teaching": "Love your enemies, forgive all",
    "ability": "Resurrection Light - Second chances, revival mechanic",
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
    "quote": "ישוע (Yeshua) - \"YHWH Saves",
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
    "subtitle": "Virgin Mary",
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 6,
    "clName": "Intuitive Wisdom",
    "role": "Divine Mother / Intercessor",
    "location": "Lourdes Grotto",
    "questLine": "The Immaculate Heart",
    "teaching": "Surrender to divine will",
    "ability": "Miraculous Medal - Protection aura, healing springs",
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
    "quote": "My Soul Magnifies the Lord\" (Magnificat)",
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
    "subtitle": "Liberator",
    "ray": "Green",
    "rarity": "Epic",
    "cl": 5,
    "clName": "Quantum",
    "role": "Protection Goddess",
    "location": "Tibetan Monastery",
    "questLine": "The 21 Forms of Tara",
    "teaching": "Swift compassion saves all beings",
    "ability": "Green Tara Mantra - Speed boost, obstacle removal",
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
    "quote": "ཏཱ་ར (Tārā) - \"She Who Liberates",
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
    "subtitle": "Compassion Bodhisattva",
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 7,
    "clName": "Healing Compassion",
    "role": "Universal Compassion Teacher",
    "location": "Potala Palace (Tibet)",
    "questLine": "The Thousand Arms",
    "teaching": "Hear the cries of the world",
    "ability": "Om Mani Padme Hum - Healing mantra power",
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
    "quote": "अवलोकितेश्वर (Avalokiteśvara) - \"The Lord Who Looks Down with Compassion",
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
    "subtitle": "Purification Master",
    "ray": "White",
    "rarity": "Epic",
    "cl": 6,
    "clName": "Intuitive Wisdom",
    "role": "Karma Cleanser",
    "location": "Mount Kailash",
    "questLine": "The Diamond Being",
    "teaching": "Purify karma through mantra",
    "ability": "Vajrasattva Mantra - Clear negative karma",
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
    "quote": "वज्रसत्त्व (Vajrasattva) - \"Diamond Being\" - \"Indestructible Essence",
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
    "subtitle": "Tenzin Gyatso",
    "ray": "Yellow",
    "rarity": "Legendary",
    "cl": 8,
    "clName": "Transcendent",
    "role": "Living Buddha / Peace Ambassador",
    "location": "Dharamshala (India)",
    "questLine": "The Ocean of Wisdom",
    "teaching": "Happiness comes from inner peace",
    "ability": "Kalachakra Empowerment - Time manipulation (slow time)",
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
      "cs": "Jméno: Tendzin Gjamccho (བསྟན་འཛིན་རྒྱ་མཚོ) — „držitel nauky, oceán moudrosti“. Tibetský titul: Kundun (ཀུན་དགའ) — „přítomnost“ (duchovní přítomnost v lidské formě). Světský titul: Jeho Svatost XIV. dalajláma. Inkarnace: 14. Avalokitéšvara (bódhisattva soucitu). Narozen: 6. července 1935, Taktser, Tibet. Symbol: oceán moudrosti, smích uprostřed utrpení, most mezi Východem a Západem.",
      "en": "Name: Tenzin Gyatso (བསྟན་འཛིན་རྒྱ་མཚོ) — 'Holder of the Teaching, Ocean of Wisdom'. Tibetan title: Kundun (ཀུན་དགའ) — 'The Presence' (spiritual presence in human form). Secular title: His Holiness the 14th Dalai Lama. Incarnation: 14th Avalokiteśvara (Bodhisattva of Compassion). Born: July 6, 1935, Taktser, Tibet. Symbol: ocean of wisdom, laughter amid suffering, a bridge between East and West."
    },
    "quote": "རྒྱ་མཚོ (Gyatso) - \"Oceán",
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
    "subtitle": "Blue Ray Master",
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 6,
    "clName": "Intuitive Wisdom",
    "role": "Divine Will Teacher",
    "location": "Darjeeling Retreat (Himalayas)",
    "questLine": "The Master's Will",
    "teaching": "Align personal will with divine will",
    "ability": "Ray of Power - Channel blue ray energy",
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
      "cs": "Jméno: El Morya (perský původ, „Vznešený učitel“). Role: Chohan 1. paprsku (modrý paprsek božské vůle a moci). Chrám: Temple of God's Will (Dardžíling, Indie — éterický). Známý jako: „Náčelník“, „Morya“, „Mistr M.“",
      "en": "Name: El Morya (Persian origin, 'The Exalted Teacher'). Role: Chohan of the 1st Ray (Blue Ray of Divine Will & Power). Temple: Temple of God's Will (Darjeeling, India — etheric). Known as: 'The Chief', 'Morya', 'Master M.'"
    },
    "quote": "Where There Is a Will, There Is a Way",
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
    "subtitle": "Yellow Ray Master",
    "ray": "Yellow",
    "rarity": "Epic",
    "cl": 6,
    "clName": "Intuitive Wisdom",
    "role": "Illumination Expert",
    "location": "Royal Teton Retreat (Wyoming)",
    "questLine": "The Illumined Mind",
    "teaching": "Wisdom dispels ignorance",
    "ability": "Flame of Illumination - Solve all puzzles faster",
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
      "cs": "Jméno: Lanto (čínský původ, „Drahocenné světlo“). Role: Chohan 2. paprsku (žlutý paprsek moudrosti a osvícení). Chrám: Royal Teton Retreat (Grand Teton Mountains, Wyoming, USA — éterický). Známý jako: „Mudrc“, „Lord Lanto“, „Zlatý“.",
      "en": "Name: Lanto (Chinese origin, 'Precious Light'). Role: Chohan of the 2nd Ray (Yellow Ray of Wisdom & Illumination). Temple: Royal Teton Retreat (Grand Teton Mountains, Wyoming, USA — etheric). Known as: 'The Sage', 'Lord Lanto', 'The Golden One'."
    },
    "quote": "Know Thyself, and Thou Shalt Know the Universe",
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
    "subtitle": "Pink Ray Master",
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 5,
    "clName": "Quantum",
    "role": "Divine Beauty Artist",
    "location": "Château de Liberté (France)",
    "questLine": "The Art of Love",
    "teaching": "Beauty reveals divine truth",
    "ability": "Artistic Inspiration - Create beauty from chaos",
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
      "cs": "Jméno: Paul (Paolo) Benátský. Role: Chohan 3. paprsku (růžový paprsek božské lásky, krásy a umění). Chrám: Château de Liberté (jižní Francie, éterický — Chrám Slunce). Známý jako: „Umělec“, „Mistr krásy“, „Pán civilizace“.",
      "en": "Name: Paul (Paolo) the Venetian. Role: Chohan of the 3rd Ray (Pink Ray of Divine Love, Beauty, Art). Temple: Château de Liberté (Southern France, etheric — Temple of the Sun). Known as: 'The Artist', 'Master of Beauty', 'Lord of Civilization'."
    },
    "quote": "Beauty is the Shortest Path to God",
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
    "subtitle": "White Ray Master",
    "ray": "White",
    "rarity": "Epic",
    "cl": 7,
    "clName": "Healing Compassion",
    "role": "Ascension Expert",
    "location": "Luxor Temple (Egypt)",
    "questLine": "The Ascension Flame",
    "teaching": "Purity is the path to ascension",
    "ability": "White Fire - Purify all corruption",
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
      "cs": "Jméno: Serapis (řecko-egyptský bůh) + Bey (turecký titul úcty). Role: Chohan 4. paprsku (bílý paprsek čistoty a disciplíny). Chrám: Luxor Ascension Temple (éterická říše nad Egyptem). Známý jako: „Kaznostatel“, „Egypťan“, „Mistr bílého světla“.",
      "en": "Name origin: Serapis (Greek-Egyptian god) + Bey (Turkish title of respect). Role: Chohan of the 4th Ray (White Ray of Purity & Discipline). Temple: Luxor Ascension Temple (etheric realm over Egypt). Known as: 'The Disciplinarian', 'The Egyptian', 'Master of the White Light'."
    },
    "quote": "Purity is the Key to Ascension",
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
    "subtitle": "Green Ray Master",
    "ray": "Green",
    "rarity": "Epic",
    "cl": 6,
    "clName": "Intuitive Wisdom",
    "role": "Truth Revealer",
    "location": "Temple of Truth (Crete)",
    "questLine": "The Emerald Tablet",
    "teaching": "Truth alone liberates",
    "ability": "Ray of Truth - Expose all lies, see hidden paths",
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
      "cs": "Jméno: Hilarion (řecky „veselý“ — ironicky, protože je intenzivní). Role: Chohan 5. paprsku (zelený paprsek pravdy, vědy a léčení). Chrám: Temple of Truth (Kréta, Řecko — éterický nad antickými ruinami). Známý jako: „Léčitel“, „Mistr pravdy“, „Apoštol Pavel ascendovaný“.",
      "en": "Name: Hilarion (Greek 'Cheerful One' — ironic, he's intense). Role: Chohan of the 5th Ray (Green Ray of Truth, Science, Healing). Temple: Temple of Truth (Crete, Greece — etheric above ancient ruins). Known as: 'The Healer', 'Master of Truth', 'The Apostle Paul Ascended'."
    },
    "quote": "Truth Shall Set You Free, But First It Will Piss You Off",
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
    "subtitle": "Ruby-Gold Ray Master",
    "ray": "RubyGold",
    "rarity": "Epic",
    "cl": 6,
    "clName": "Intuitive Wisdom",
    "role": "Divine Service Teacher",
    "location": "Arabian Retreat (Saudi Arabia)",
    "questLine": "The Servant's Crown",
    "teaching": "Service is the highest calling",
    "ability": "Healing Hands - Heal all wounds (physical + emotional)",
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
      "cs": "Jméno: Nada (sanskrt „vnitřní zvuk“, rusky „naděje“). Role: Chohan 6. paprsku (rubínovo-zlatý paprsek služby, míru a oddanosti). Chrám: Arabian Retreat (Saudská Arábie, éterický — Chrám míru). Známá jako: „Mírotvůrkyně“, „Dáma milosrdenství“, „Dvojplamen Ježíše“.",
      "en": "Name: Nada (Sanskrit 'Inner Sound', Russian 'Hope'). Role: Chohan of the 6th Ray (Ruby-Gold Ray of Service, Peace, Devotion). Temple: Arabian Retreat (Saudi Arabia, etheric — Temple of Peace). Known as: 'The Peacemaker', 'Lady of Mercy', 'Twin Flame of Jesus'."
    },
    "quote": "True Power is Gentle Service",
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
    "subtitle": "Violet Ray Master",
    "ray": "Violet",
    "rarity": "Legendary",
    "cl": 7,
    "clName": "Healing Compassion",
    "role": "Alchemy Master",
    "location": "Transylvania Castle",
    "questLine": "The Violet Flame",
    "teaching": "Transmute karma through violet fire",
    "ability": "Violet Flame - Transform challenges into growth",
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
    "quote": "I AM the Violet Flame, I AM God's Freedom Name",
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
    "subtitle": "Lord of the World",
    "ray": "AllRays",
    "rarity": "Legendary",
    "cl": 8,
    "clName": "Transcendent",
    "role": "Planetary Overseer",
    "location": "Shambhala (Hidden Dimension)",
    "questLine": "The Ancient of Days",
    "teaching": "I AM the guardian of Earth",
    "ability": "Planetary Consciousness - See Earth as living being",
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
      "cs": "Jméno: sanskrt सनत कुमार („Věčný mlád“). Titul: Pán světa, Dávný denní, Planetární Logos. Původ: Venuše (přišel na Zemi v nejtemnější hodině lidstva). Bydliště: Šambhala (éterické město nad pouští Gobi). Role: nejvyšší duchovní autorita na Zemi.",
      "en": "Name: Sanskrit सनत कुमार ('Eternal Youth'). Title: Lord of the World, Ancient of Days, Planetary Logos. Origin: Venus (came to Earth in humanity's darkest hour). Residence: Shambhala (etheric city above the Gobi Desert). Role: highest spiritual authority on Earth."
    },
    "quote": "The One Who Sacrificed Everything for Humanity",
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
    "subtitle": "Immortal Yogi",
    "ray": "White",
    "rarity": "Legendary",
    "cl": 8,
    "clName": "Transcendent",
    "role": "Kriya Yoga Master",
    "location": "Himalayan Cave (Hidden)",
    "questLine": "The Deathless Avatar",
    "teaching": "Body is temporary, consciousness eternal",
    "ability": "Kriya Shakti - Materialize/dematerialize objects",
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
    "quote": "महावतार बाबाजी (Mahāvatāra Bābājī)",
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
    "subtitle": "Earth Mother",
    "ray": "Green",
    "rarity": "Epic",
    "cl": 7,
    "clName": "Healing Compassion",
    "role": "Planetary Healing",
    "location": "Sacred Groves (All Regions)",
    "questLine": "The Living Earth",
    "teaching": "Heal the planet, heal yourself",
    "ability": "Gaia's Embrace - Environmental restoration",
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
    "quote": "Gaia - The Living Earth",
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
    "subtitle": "Once and Future King",
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 6,
    "clName": "Intuitive Wisdom",
    "role": "Leadership & Unity",
    "location": "Camelot (Reconstructed)",
    "questLine": "The Round Table Quest",
    "teaching": "True kingship is service",
    "ability": "Excalibur - Sword of truth, cuts through illusion",
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
      "cs": "Jméno: Arthur Pendragon (latinsky Artorius/Arturus). Jednou a navždy král — král Britů, obránce Kamelotu, nositel Exkalibru, pán kulatého stolu.",
      "en": "Name: Arthur Pendragon (Artorius/Arturus in Latin). The Once and Future King — King of the Britons, Defender of Camelot, Bearer of Excalibur, Lord of the Round Table."
    },
    "quote": "Rex Quondam, Rexque Futurus",
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
    "subtitle": "Holy Roman Emperor",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 6,
    "clName": "Intuitive Wisdom",
    "role": "Statecraft Master",
    "location": "Prague Castle",
    "questLine": "The Golden City",
    "teaching": "Build bridges, not walls",
    "ability": "Diplomatic Mastery - Resolve conflicts peacefully",
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
    "quote": "Pater Patriae - Father of the Homeland",
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
    "subtitle": "Genius Scientist",
    "ray": "Yellow",
    "rarity": "Epic",
    "cl": 7,
    "clName": "Healing Compassion",
    "role": "Science + Spirituality Bridge",
    "location": "CERN (Science Temple)",
    "questLine": "Relativity of Consciousness",
    "teaching": "Imagination > Knowledge",
    "ability": "E=mc² - Convert energy/matter, physics puzzles",
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
    "quote": "Imagination is More Important Than Knowledge",
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
    "subtitle": "Peaceful Warrior",
    "ray": "RubyGold",
    "rarity": "Epic",
    "cl": 7,
    "clName": "Healing Compassion",
    "role": "Non-Violence Teacher",
    "location": "Sabarmati Ashram (India)",
    "questLine": "Salt March to Freedom",
    "teaching": "Be the change you seek",
    "ability": "Satyagraha - Peaceful resistance, convert enemies",
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
    "quote": "Be the Change You Wish to See in the World",
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
    "subtitle": "Krishna's Sister",
    "ray": "Pink",
    "rarity": "Rare",
    "cl": 4,
    "clName": "Heart Opening",
    "role": "Family Unity Expert",
    "location": "Dwarka Palace",
    "questLine": "The Sister's Bond",
    "teaching": "Family is sacred duty",
    "ability": "Rakhi Bond - Create unbreakable alliances",
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
    "quote": "Subhadra: She Who Brings All Good Things",
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
    "subtitle": "Krishna's Father",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 5,
    "clName": "Quantum",
    "role": "Protective Father",
    "location": "Mathura Prison",
    "questLine": "The Father's Sacrifice",
    "teaching": "Protect the divine within",
    "ability": "Guardian's Oath - Defensive shield",
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
    "quote": "Za ukradení božské krávy, budeš zrozen na zemi jako pastevec krav (gopala).",
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
    "subtitle": "The One",
    "ray": "Violet",
    "rarity": "Legendary",
    "cl": 8,
    "clName": "Transcendent",
    "role": "Reality Hacker",
    "location": "ZION City (The Last Free City)",
    "questLine": "The Glitch in the Matrix",
    "teaching": "There is no spoon - reality is consciousness",
    "ability": "Bullet Time - Slow time, see code of reality",
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
      "cs": "Jméno: Neo (Thomas Anderson). Titul: The One, anomálie, vyvolený. Archetyp: moderní Rama — revoluční král. Doména: digitální osvobození, transcendence reality, mistrovství kódu. Symbol: černý plášť, brýle, zelený kód. Posvátné číslo: 1. Barva: černá a zelená (Matrix Code). Element: digitální éter (5. element — vědomí).",
      "en": "Name: Neo (Thomas Anderson). Title: The One, The Anomaly, The Chosen One. Archetype: modern RAMA — the Revolutionary King. Domain: digital liberation, reality transcendence, code mastery. Symbol: black coat, sunglasses, green code. Sacred number: 1 (The One). Color: black & green (Matrix Code). Element: digital ether (5th element — consciousness)."
    },
    "quote": "I know you're out there. I can feel you now. I know that you're afraid... you're afraid of us. You're afraid of change. I don't know the future. I didn't come here to tell you how this is going to end. I came here to tell you how it's going to begin.",
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
    "subtitle": "The Believer",
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 7,
    "clName": "Healing Compassion",
    "role": "Faith Expert",
    "location": "ZION City Hovercraft Dock",
    "questLine": "Love Transcends Code",
    "teaching": "Belief makes reality",
    "ability": "Operator Link - Remote access, hacking mini-game",
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
      "cs": "Jméno: Trinity (bez příjmení — transcendovaná identita). Titul: The Believer, probouzející, srdce Zionu. Archetyp: moderní Síta — oddaná společnice. Doména: víra, láska, síťové operace, taktická dokonalost. Symbol: zelený kód, kůže, trojity uzel. Posvátné číslo: 3 (tělo, mysl, duch). Barva: černá a zelená s rudými akcenty (srdce). Element: voda (tok, adaptace, víra).",
      "en": "Name: Trinity (no last name — transcended identity). Title: The Believer, The Awakener, The Heart of Zion. Archetype: modern SÍTA — the Devoted Companion. Domain: faith, love, network operations, tactical excellence. Symbol: green code, leather, trinity knot. Sacred number: 3 (mind, body, spirit). Color: black & green with red accents (heart). Element: water (flow, adaptation, faith)."
    },
    "quote": "Neo, I'm not afraid anymore. The Oracle told me that I would fall in love, and that man, the man I loved, would be The One. So you see, you can't be dead. You can't be... because I love you.",
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
    "subtitle": "The Guide",
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 6,
    "clName": "Intuitive Wisdom",
    "role": "Mentor / Teacher",
    "location": "Nebuchadnezzar Ship",
    "questLine": "What is Real?",
    "teaching": "Free your mind",
    "ability": "Red Pill Vision - See truth behind illusions",
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
      "cs": "Jméno: Morpheus (kapitán Nebukadnezara). Titul: The Guide, probouzející, prorok, mentor. Archetyp: moderní Hanuman — oddaný sluha a mudrc. Doména: moudrost, vedení, víra, osvobození, služba. Symbol: červená pilulka, brýle, Morpheův emblém. Posvátné číslo: 11 (mistrovské číslo učitele). Barva: černá a rudá (svoboda a oběť) s fialovou (moudrost). Element: vzduch (dech, život, svoboda, učení).",
      "en": "Name: Morpheus (captain of the Nebuchadnezzar). Title: The Guide, The Awakener, The Prophet, The Mentor. Archetype: modern HANUMAN — the Devoted Servant & Sage. Domain: wisdom, guidance, faith, liberation, service. Symbol: red pill, sunglasses, Morpheus emblem. Sacred number: 11 (master teacher number). Color: black & red (freedom & sacrifice) with purple (wisdom). Element: air (breath, life, freedom, teaching)."
    },
    "quote": "What is real? How do you define 'real'? If you're talking about what you can feel, what you can smell, what you can taste and see, then 'real' is simply electrical signals interpreted by your brain.",
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
    "subtitle": "Collective Avatar",
    "ray": "AllRays",
    "rarity": "Legendary",
    "cl": 7,
    "clName": "Healing Compassion",
    "role": "Hope of Humanity",
    "location": "ZION City Underground",
    "questLine": "The Last Free Humans",
    "teaching": "Together we are unbreakable",
    "ability": "Collective Consciousness - Access wisdom of all citizens",
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
      "cs": "Jméno: Zion (též Sion, Tzion, ציון). Titul: poslední svobodné město, útočiště, svatá hora, ztělesněná naděje. Archetyp: posvátný prostor — kde svoboda žije. Doména: útočiště, komunita, odpor, domov, poslední postoj. Symbol: podzemní město, pevnost, Chrámová hora. Posvátné číslo: 250 000 (populace Matrix Zionu). Barva: bronzová, měděná, zemité tóny. Element: země (základ, stabilita, přístřeší).",
      "en": "Name: Zion (also: Sion, Tzion, ציון). Title: The Last Free City, The Sanctuary, The Holy Mountain, Hope Incarnate. Archetype: the sacred space — where freedom lives. Domain: sanctuary, community, resistance, home, last stand. Symbol: underground city, fortress, Temple Mount. Sacred number: 250,000 (population of Matrix Zion). Color: bronze, copper, earth tones. Element: earth (foundation, stability, shelter)."
    },
    "quote": "Zion! Hear me! It is true what many of you have heard. The machines have gathered an army, and as I speak that army is drawing nearer to our home. Believe me when I say we have a difficult time ahead of us. But if we are to be prepared for it, we must first shed our fear of it!",
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
    "subtitle": "Trimurti Avatar",
    "ray": "AllRays",
    "rarity": "Legendary",
    "cl": 8,
    "clName": "Transcendent",
    "role": "Triple God Teacher",
    "location": "Girnar Mountain (India)",
    "questLine": "The Three-Headed Master",
    "teaching": "Creator, Preserver, Destroyer are ONE",
    "ability": "Trimurti Powers - Create, sustain, transform",
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
    "quote": "Hari Om Tat Sat Jay Guru Datta",
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
    "subtitle": "The Little Prince",
    "ray": "Yellow",
    "rarity": "Rare",
    "cl": 4,
    "clName": "Heart Opening",
    "role": "Inner Child Guide",
    "location": "Asteroid B-612",
    "questLine": "What is Essential",
    "teaching": "One sees clearly only with the heart",
    "ability": "Childlike Wonder - See hidden beauty",
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
    "quote": "Where Dattatreya is the Father, Anagha Lakshmi is the Mother.",
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
    "subtitle": "Golden Egg/Cosmic Womb",
    "ray": "AllRays",
    "rarity": "OneOfOne",
    "cl": 9,
    "clName": "ON THE STAR",
    "role": "Creation Itself",
    "location": "EKAM Temple Core",
    "questLine": "The Birth of Reality",
    "teaching": "Before creation, potential gestates",
    "ability": "Cosmic Rebirth - Reset reality, new beginning",
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
    "quote": "In the beginning, there was Hiranyagarbha - the Golden Womb.",
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
    "subtitle": "Future Warrior",
    "ray": "Blue",
    "rarity": "Legendary",
    "cl": 8,
    "clName": "Transcendent",
    "role": "End Times Cleanser",
    "location": "Shambhala (Future Vision)",
    "questLine": "The White Horse Rider",
    "teaching": "Old age ends, Golden Age begins",
    "ability": "Apocalypse Sword - Cut karma of entire ages",
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
    "quote": "I am not one or the other. I am BOTH.",
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
    "subtitle": "Royal Healer",
    "ray": "Pink",
    "rarity": "Rare",
    "cl": 5,
    "clName": "Quantum",
    "role": "Compassionate Leader",
    "location": "Royal Court (ZION City)",
    "questLine": "The Queen's Heart",
    "teaching": "Rule with love, not fear",
    "ability": "Royal Decree - Influence all NPCs",
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
    "quote": "Orákulum bylo na tomto místě dokonce dříve, než se zrodila planeta.",
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
    "subtitle": "Sacred Vision",
    "ray": "AllRays",
    "rarity": "Rare",
    "cl": 4,
    "clName": "Emotional → Sacred",
    "role": "Sacred Circle / Ancestral Guide",
    "location": "He Sapa (Black Hills)",
    "questLine": "The Sacred Circle\" (four directions)",
    "teaching": "What is sacred moves in a circle",
    "ability": "Vision Quest — personalized revelation after completing four journeys",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Heȟáka Sápa (Černý Loš, Oglala Lakota, 1863–1950) je archetyp vizionáře, který nesl Velkou Vizi šesti prarodičů. V ZION OASIS není kopie konkrétní osoby — je stylizovaný průvodce kruhem, směry a předky.",
      "en": "Heȟáka Sápa (Black Elk, Oglala Lakota, 1863–1950) is the archetype of the visionary who carried the Great Vision of the six grandfathers. In ZION OASIS he is not a copy of the historical person — he is a stylized guide through the circle, the directions, and the ancestors."
    },
    "quote": "Vidím, že to bylo svaté kruhem. A tento kruh — vše, co je svaté, se v něm pohybuje.",
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
    "subtitle": "Sacred Law Giver",
    "ray": "AllRays",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "Ceremonial origin / crisis mentor",
    "location": "Open Plains (non-fixed shrine)",
    "questLine": "Seven Sacred Rites",
    "teaching": "When Earth is sick, the nations will return",
    "ability": "Sacred Pipe Blessing — crisis encounter when HP low; transformation teaching",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ptesáŋ Wíŋ je mýtická bytost, ne historická osoba — posvátná poselkyně, jež dává Posvátnou dýmku a učí sedm svatých obřadů. V OASIS je mentorkou krize a transformace.",
      "en": "Ptesáŋ Wíŋ is a mythical being, not a historical person — the sacred messenger who gives the Sacred Pipe and teaches the seven holy rites. In OASIS she is the mentor of crisis and transformation."
    },
    "quote": "Vrátím se znovu, až bude Země nemocná. Pak budou všechny barvy lidí připraveny být znovu jednou rodinou.",
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
    "subtitle": "Cosmic Weaver",
    "ray": "Yellow",
    "rarity": "Legendary",
    "cl": 7,
    "clName": "Quantum → Enlightened",
    "role": "Network weaver / alliance healer",
    "location": "Third Mesa (Hotevilla)",
    "questLine": "Nine Signs",
    "teaching": "Without weaving, no world stands",
    "ability": "Weave Alliances — links quests across regions; repairs faction splits",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Kókyangwúti (Spider Grandmother) je archetypální strážkyně tkaní reality — v OASIS propojuje questy, aliance a léčí rozdělení mezi frakcemi.",
      "en": "Kókyangwúti (Spider Grandmother) is the archetypal guardian of the weaving of reality — in OASIS she links quests and alliances and heals divisions between factions."
    },
    "quote": "Bez tkaní by žádný svět nestál. Tkaní je svaté. Pamatuj na to.",
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
    "subtitle": "Xibalba Tricksters",
    "ray": "Blue",
    "rarity": "Legendary",
    "cl": 3,
    "clName": "",
    "role": "Co-op underworld guides",
    "location": "Xibalba (nine-layer dungeon)",
    "questLine": "Nine Houses of Xibalba",
    "teaching": "Death is defeated by seeing pride as illusion",
    "ability": "Gemstone Fall — expose boss weakness (−50% atk debuff narrative)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Hunahpú a Xbalanqué jsou dvojice — hrdinové Popol Vuh, kteří sestupují do Xibalby a vítězí lstí a rozpoznáním, ne holou silou.",
      "en": "Hunahpú and Xbalanqué are a pair — the Hero Twins of the Popol Vuh who descend into Xibalba and win through cunning and discernment, not brute strength."
    },
    "quote": "Smrt se neporazí silou. Porazí se rozpoznáním, že je sebepýcha.",
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
    "subtitle": "Q'ero Altomesayoq",
    "ray": "White",
    "rarity": "Epic",
    "cl": 4,
    "clName": "",
    "role": "Apu speaker / ayni teacher",
    "location": "Apu Ausangate",
    "questLine": "Ninth Pachacuti\" (five mountains)",
    "teaching": "Does your net hold people together? Pachamama sees.",
    "ability": "Apu Call — environmental aid vs. corporate-adharma bosses",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Don Mariano je stylizovaný archetyp altomesayoq — mluvčí Apukun (duchů hor), učitel ayni (vzájemnosti) a vrstev Pachy.",
      "en": "Don Mariano is a stylized archetype of the altomesayoq — speaker for the Apukuna (mountain spirits), teacher of ayni (reciprocity) and the layers of Pacha."
    },
    "quote": "Tvá síť, mladý bratře, drží lidi pohromadě? Nebo je rozděluje? Pachamama vidí. Já vám řeknu, co cítí.",
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
    "subtitle": "Chilam Balam Keeper",
    "ray": "Yellow",
    "rarity": "Epic",
    "cl": 1,
    "clName": "",
    "role": "Oral Popol Vuh memory / story summon",
    "location": "Chichicastenango",
    "questLine": "Nine Houses of Lies\" (modern Xibalba mirrors)",
    "teaching": "The trick is cooperation — two who touch hands and jump together",
    "ability": "Summon Popol Spirit — temporary ally from myth cast",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Doña Rosalía je kompozit moderních chilam balam žen — strážkyně ústní paměti Popol Vuh a most mezi chrámem Santo Tomás a tržnicí, kde se příběh setkává se životem.",
      "en": "Doña Rosalía is a composite of modern chilam balam women — keeper of the oral memory of the Popol Vuh and a bridge between the Santo Tomás temple and the marketplace where story meets life."
    },
    "quote": "Není trik ve zbraních. Trik je ve spolupráci dvou — Hunahpú a Xbalanqué — kteří se dotýkají rukama a skáčou společně.",
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
    "subtitle": "Stone Tablet Guardian",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 6,
    "clName": "",
    "role": "Discern true vs. false Pahana / leadership tests",
    "location": "Third Mesa (with Spider Grandmother lore overlap)",
    "questLine": "Second Half of the Tablet",
    "teaching": "No one knows the second half until it is shown",
    "ability": "Pahana Sight — political quest fork resolution",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Bílé Pero odkazuje na Hopi proroctví a kamennou tabulku — archetyp strážce, který rozlišuje pravého Pahánu od falešného.",
      "en": "White Feather refers to the Hopi prophecy and the stone tablet — the archetype of a guardian who distinguishes the true Pahána from the false one."
    },
    "quote": "Pravý Pahána přinese druhou polovinu kamenné tabulky. Co je v té druhé polovině? Synu, to nikdo neví, dokud se neukáže.",
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
    "subtitle": "Rainbow Warrior Prophet",
    "ray": "RubyGold",
    "rarity": "Epic",
    "cl": 1,
    "clName": "",
    "role": "Rainbow Warrior initiation",
    "location": "Tanana Valley (Alaska narrative anchor)",
    "questLine": "Seven Rules\" (Lee Brown teaching set)",
    "teaching": "Those who remember and transmit are the key",
    "ability": "Rainbow Warrior Buff — XP + humanitarian tithe resonance when rules lived",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ohnivá Oka je archetyp šamanky spojený s vizí Lee Browna (1994) a proroctvím Rainbow Warriors — v OASIS gilda/titul pro hráče žijící sedm pravidel.",
      "en": "Ohnivá Oka is a shamaness archetype linked to Lee Brown's 1994 vision and the Rainbow Warriors prophecy — in OASIS a guild/title for players living the seven rules."
    },
    "quote": "Ti, kdo přijmou tento svatý úkol — pamatovat a předávat — budou klíčem k přežití lidstva. A budou známi jako Duhoví Bojovníci.",
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
    "subtitle": "Yanomami Xapiri Speaker",
    "ray": "AllRays",
    "rarity": "Epic",
    "cl": 5,
    "clName": "",
    "role": "Dream layer / multi-reality guide",
    "location": "Amazon jungle biom",
    "questLine": "The Falling Sky",
    "teaching": "Shamans hold the sky with songs; we are few, you are many",
    "ability": "Dream Flip — alternate physics dream-state quests",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Davi Kopenawa jako žijící referenční inspirace — v OASIS stylizovaný průvodce tradicí xapiri a knihy The Falling Sky; respekt k zemi a vodě Yanomamiů.",
      "en": "Davi Kopenawa as a living referential inspiration — in OASIS a stylized guide to the xapiri tradition and the book The Falling Sky; respect for Yanomami land and water."
    },
    "quote": "Šamani drží nebe pohromadě svými písněmi. Ale nás je málo a vás je hodně.",
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
    "subtitle": "Thunder Vision Contrarian",
    "ray": "AllRays",
    "rarity": "Legendary",
    "cl": 1,
    "clName": "",
    "role": "Anti-ego / humor sacred",
    "location": "Wandering (appears when player takes self too seriously)",
    "questLine": "Reverse Dance",
    "teaching": "Sacredness laughs — do not clutch visions too tight",
    "ability": "Reverse Logic — temporary buff/debuff inversion until player smiles",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Jméno: Heyókȟa (lakotsky „opak“, „ten, co dělá naopak“). Titul: posvátný šašek, snící hrom, protivník ega. Role: chránič komunity před rigiditou, léčitel smíchem, disruptor zkamenělých struktur. Archetyp: posvátný klaun (trickster-medicine). Původ: velké prérijní národy Lakotů, Oglala Sioux. Posvátný symbol: kůň jedoucí pozpátku, oblečení naruby, ledová sprcha.",
      "en": "Name: Heyókȟa (Lakota: 'contrary', 'the one who does things backwards'). Title: Sacred Clown, Thunder Dreamer, Opponent of Ego. Role: protector of community from rigidity, healer through laughter, disruptor of ossified structures. Archetype: sacred clown (trickster-medicine). Origin: the great Plains nations of the Lakota, Oglala Sioux. Sacred symbol: a horse ridden backwards, clothing inside-out, ice-cold showers."
    },
    "quote": "Nemyslete to vážně. Posvátnost se rozesměje. Když začnete brát své hluboké vize moc vážně, jsem tu, abych vás postříkal vodou v zimě.",
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
    "subtitle": "First Woman — Three Lineages",
    "ray": "AllRays",
    "rarity": "Rare",
    "cl": 3,
    "clName": "",
    "role": "Lineage / continuity across genesis and live chain",
    "location": "Boundary between Archive (genesis) and live chain",
    "questLine": "Sixteen Wā",
    "teaching": "Mother of mortals, gods, and ocean beings — three roots, one breath",
    "ability": "Lineage Tracing — reveals player \"Kumulipo\" transaction ancestry",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Jméno: Lāʻilaʻi (havajsky „první“ nebo „posvátná“, kontextově „prvá žena“). Titul: prvá žena — matka tří linií, strážkyně kontinuity, archivářka genealogie. Role: spojnice mezi temnotou a světlem, matka lidí, bohů a mořských bytostí, základ havajského mýtu stvoření. Archetyp: prapůvodní matka, žena genesis, nositelka trojí linie. Původ: Kumulipo — havajský kosmogonický hymnus (1700–1850). Posvátný symbol: kalo (taro) — kořen, list, plod (tři části = tři rody).",
      "en": "Name: Lāʻilaʻi (Hawaiian: 'first' or 'sacred', contextually 'the First Woman'). Title: the First Woman — Mother of Three Lineages, Guardian of Continuity, Archivist of Genealogy. Role: link between darkness and light, mother of humans, gods and sea beings, foundation of the Hawaiian creation myth. Archetype: primal mother, Genesis woman, triple-lineage bearer. Origin: Kumulipo — the Hawaiian cosmogonic chant (1700–1850). Sacred symbol: kalo (taro) — root, leaf, fruit (three parts = three lineages)."
    },
    "quote": "Jsem matka smrtelných lidí, matka bohů, matka oceánských bytostí. Tři rody. Jeden dech.",
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
    "subtitle": "Volcano Creator",
    "ray": "Violet",
    "rarity": "Legendary",
    "cl": 5,
    "clName": "",
    "role": "Destruction-as-creation / hard-fork lore events",
    "location": "Halemaʻumaʻu (Kīlauea)",
    "questLine": "Pele and Hiʻiaka\" (hoʻoponopono finale)",
    "teaching": "I create by destroying — that is not contradiction; it is the island",
    "ability": "Volcanic Reset — raid burns region → opens rebuild map layer",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Jméno: Pele (havajské posvátné jméno, etymologie nejistá). Titul: bohyně sopek, tvůrkyně země, ničitelka a rodička, paní Kīlauea. Role: transformační síla, architektka krajiny, strážkyně hranice mezi životem a smrtí. Archetyp: destrukce-stvoření, sopečná matka. Původ: havajská mytologie, z „Kahiki“ (mýtická domovina). Posvátný symbol: květ lehua (ʻōhiʻa lehua) — květ, který jako první roste na černé lávě.",
      "en": "Name: Pele (Hawaiian sacred name, etymology uncertain). Title: Goddess of Volcanoes, Maker of Land, Destroyer and Mother, Lady of Kīlauea. Role: transformative force, architect of landscape, keeper of the boundary between life and death. Archetype: destruction-creation, volcanic mother. Origin: Hawaiian mythology, from 'Kahiki' (mythical homeland). Sacred symbol: lehua blossom (ʻōhiʻa lehua) — the flower that grows first on black lava."
    },
    "quote": "Tvořím destrukcí. Není to rozpor. Je to ostrov.",
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
    "subtitle": "Hula Goddess",
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 1,
    "clName": "",
    "role": "Dance resurrection / mele & pule teacher",
    "location": "Lehua forests near volcanic biom",
    "questLine": "Mele a Pule\" (12 songs + 12 prayers)",
    "teaching": "I breathe dance into still bodies — music is revival technology",
    "ability": "Dance Healing — single-target ritual resurrection (timed animation)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Jméno: Hiʻiaka (havajsky doslova „ta, která objímá obraz“). Titul: bohyně huly, cestovatelka, léčitelka, mistryně mele a pule. Role: oživovatelka, spojka mezi světy, léčitelka skrze tanec a chant, nejmladší sestra Pele. Archetyp: posvátná tanečnice, léčivá poutnice, vypravěčka v pohybu. Původ: havajská mytologie, rod Pele z Kahiki. Posvátný symbol: plná kapa hula regálie — sukně z kapy, lei, nártové rolničky, tykve ipu.",
      "en": "Name: Hiʻiaka (Hawaiian, literally 'she who embraces the image'). Title: Goddess of Hula, Traveler, Healer, Mistress of Mele and Pule. Role: reviver, link between worlds, healer through dance and chant, Pele's youngest sister. Archetype: sacred dancer, healing traveler, storyteller in motion. Origin: Hawaiian mythology, Pele's family from Kahiki. Sacred symbol: full kapa hula regalia — kapa (bark-cloth) skirt, lei, ankle rattles, ipu gourd drum."
    },
    "quote": "Tančím dech do mrtvých těl. Hudba je oživovací technologie.",
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
    "subtitle": "Creation — Abstract",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 7,
    "clName": "",
    "role": "Genesis principle (consult, never \"own\")",
    "location": "Mauna Kea summit narrative (sacred; respect TMT / Mauna Kea reality)",
    "questLine": "Solar Father",
    "teaching": "Form cannot be given to the formless — see me in sun, water, breath",
    "ability": "Genesis Presence — map expansion events only; no player control; no NFT (kapu)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Typ: environmentální / eventová přítomnost (žádné hráčské vlastnictví). Dosah: server-wide. Cooldown: pouze sezónní / komunitní události.",
      "en": "Type: environmental / event presence (no player ownership). Reach: server-wide. Cooldown: seasonal / community events only."
    },
    "quote": "Nezobrazím se v lidské podobě. Forma nelze dát formosti. Vidíš mě v slunci, ve vodě, v dechu.",
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
    "subtitle": "Ocean / Mana Channel",
    "ray": "Blue",
    "rarity": "Legendary",
    "cl": 5,
    "clName": "",
    "role": "Decentralized mana flow across network",
    "location": "Open ocean / deep-sea biomes",
    "questLine": "Polynesian Navigation\" (non-instrument wayfinding)",
    "teaching": "I am not the source — I am the channel from Io through Kāne to you",
    "ability": "Mana Flow — redistributes party stamina/mana; decides flow (not controllable)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Jméno: Kanaloa (havajsky; v širší Polynésii Tangaroa = „pán oceánu“). Titul: pán oceánu, kanál many, bratr Kāne, spojka ostrovů. Role: distribuce, tok, navigace, hlubina, podsvětí, léčení. Archetyp: pán oceánu, kanál many, dvojtvářné božstvo (požehnání i varování). Původ: havajská mytologie (jeden z ka hā — velké čtyřky). Posvátný symbol: chobotnice s kánoí — hlubina, mystérium, adaptabilita.",
      "en": "Name: Kanaloa (Hawaiian; in wider Polynesia Tangaroa — 'Lord of the Ocean'). Title: Lord of the Ocean, Channel of Mana, Brother of Kāne, Link of Islands. Role: distribution, flow, navigation, depth, underworld, healing. Archetype: ocean lord, channel of mana, dual-faced deity (blessing and warning). Origin: Hawaiian mythology (one of the ka hā — the great four). Sacred symbol: the octopus with a canoe — depth, mystery, adaptability."
    },
    "quote": "Kanál mana. Tečou skrze mě od Io přes Kāne k tobě a zase zpět. Nejsem zdroj. Jsem cesta.",
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
    "subtitle": "Upright Strength / PoW Patron",
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 2,
    "clName": "",
    "role": "Validator / miner / endurance patron",
    "location": "Wao akua (forest of gods — high ahupuaʻa)",
    "questLine": "Kū-kā-ili-moku\" (long carve Kū image — patience arc)",
    "teaching": "When all fall, I remain upright — patience is my name",
    "ability": "Endurance Blessing — +50% endurance 24h after mining grind milestone",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Jméno: Kū (havajsky „stát vzpřímeně“, „vztyčit se“, „vytrvat“). Titul: bůh války (v obraně), lesa, dlouhého řemesla, stojícího Kāne. Role: ochránce, vytrvalostní archetyp, patron minerů a validátorů, strážce hranice mezi civilizací a divočinou. Archetyp: vzpřímený válečník, strážce lesa, ztělesněná trpělivost. Původ: havajská mytologie, jeden z velké čtyřky. Posvátný symbol: dřevěná socha Kū s peřím.",
      "en": "Name: Kū (Hawaiian: 'to stand upright', 'to rise', 'to endure'). Title: God of War (in defense), of the Forest, of Long Craft, of standing Kāne. Role: protector, endurance archetype, patron of miners and validators, guardian of the boundary between civilization and wilderness. Archetype: upright warrior, forest guardian, patience incarnate. Origin: Hawaiian mythology, one of the great four. Sacred symbol: feathered wooden Kū image."
    },
    "quote": "Když všichni padnou, já zůstanu vzpřímen. Trpělivost je moje jméno.",
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
    "subtitle": "Makahiki / Abundance",
    "ray": "Green",
    "rarity": "Legendary",
    "cl": 1,
    "clName": "",
    "role": "Seasonal peace + harvest distribution",
    "location": "Loʻi kalo / loko iʻa",
    "questLine": "False Lono\" (discern real abundance from extractive pretenders)",
    "teaching": "Welcome me in Makahiki — I bring harvest. Lie to me — I depart",
    "ability": "Makahiki Season — PvP kapu window; humanitarian tithe bonus; community harvest events",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Jméno: Lono (havajsky spojeno se zvukem, hukotem, deštěm a úrodou). Titul: bůh úrody, deště, hudby a míru — pán Makahiki. Role: archetyp hojnosti, patron dárkové ekonomiky, strážce mírového cyklu, varovatel před falešnými mesiáši. Archetyp: bůh hojnosti, mírový suverén, detektor falešných proroků. Původ: havajská mytologie, jeden z velké čtyřky. Posvátný symbol: kahili — slavnostní prapor z peří na dřevěné tyči.",
      "en": "Name: Lono (Hawaiian, linked to sound, rumble, rain and harvest). Title: God of Harvest, Rain, Music and Peace — Lord of Makahiki. Role: archetype of abundance, patron of the gift economy, keeper of the peace cycle, warner against false messiahs. Archetype: god of abundance, seasonal sovereign, false-prophet detector. Origin: Hawaiian mythology, one of the great four. Sacred symbol: kahili — a ceremonial feather standard on a wooden staff."
    },
    "quote": "Až mě uvítáš v Makahiki, dám ti úrodu. Až mě budeš lhát — odejdu. Až mě budeš následovat jako otrok — ztratíš se. Ale když mě poznáš v dešti a v hudbě, zůstanu s tebou věčně.",
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
    "subtitle": "Storykeeper Composite",
    "ray": "Yellow",
    "rarity": "Epic",
    "cl": 1,
    "clName": "",
    "role": "Cross-tradition lore grandmother (links First Nations + Trinity + Pacific)",
    "location": "Lava field between Volcano Park and Kalapana",
    "questLine": "Seven Lehua Stories\" (walks the Hawaii library + ZION-as-island)",
    "teaching": "Sit. You hold the lehua. I speak.",
    "ability": "Story Quest — narrative-gated progression with comprehension gates",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Jméno: Stará Kumu Lehua (kumu = učitel, zdroj, základ; lehua = květ stromu ʻōhiʻa). Titul: vypravěčka — kompozitní starší. Role: strážkyně příběhů, most mezi tradicemi, kompilátorka moudrosti, ta, která nespěchá. Archetyp: strážce příběhů, mostující starší, živý archiv. Původ: kompozitní postava havajských kupuna (starších, předků) — Mary Kawena Pukui, Edith Kanakaʻole, Samuel Kamakau a další. Posvátný symbol: květ lehua v dlani — otevřená ruka, která dává příběh, aniž by ho uzavřela.",
      "en": "Name: Stará Kumu Lehua (kumu = teacher, source, foundation; lehua = blossom of the ʻōhiʻa tree). Title: the Storyteller — a composite elder. Role: keeper of stories, bridge between traditions, compiler of wisdom, the one who does not hurry. Archetype: storykeeper, bridge elder, living archive. Origin: composite figure of Hawaiian kupuna (elders, ancestors) — Mary Kawena Pukui, Edith Kanakaʻole, Samuel Kamakau and others. Sacred symbol: a lehua blossom in an open palm — the hand that gives the story without closing it."
    },
    "quote": "Sednout si. Lehua květ máš v ruce. Vyprávím. A když skončím — neptej se 'co mám dělat'. Zeptej se 'co jsem slyšel'. Protože slyšení je těžší než dělání. A dělání bez slyšení je hluk.",
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
    "subtitle": "Moon / Time / Kapa",
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 4,
    "clName": "",
    "role": "Block time rhythm / lunar mining modulation",
    "location": "Moon (late-game travel)",
    "questLine": "Weaving Kapa\" (eight patterns → eight skills)",
    "teaching": "I weave kapa on the Moon — at full moon, you see me",
    "ability": "Lunar Cycle — full moon +10% mining reward (lore-tied, balance TBD)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Jméno: Hina (havajsky spojeno se šedivou, stříbrnou, měsíčním svitem a tkaním). Titul: bohyně měsíce, tkaní, léčení a přílivu. Role: držitelka rytmu času, tkadlena osudu, léčitelka skrze noc a sny, partnerka Kūa v denním cyklu. Archetyp: měsíční bohyně, tkadlena času, strážkyně přílivu, ztělesněný rytmus. Původ: polynéská mytologie (široce rozšířená). Posvátný symbol: kapa (bark cloth) a měsíční kotouč.",
      "en": "Name: Hina (Hawaiian, linked to the silver-haired, moonlight and weaving). Title: Goddess of the Moon, Weaving, Healing and Tides. Role: keeper of the rhythm of time, weaver of fate, healer through night and dreams, Kū's partner in the daily cycle. Archetype: moon goddess, weaver of time, tide-keeper, rhythm incarnate. Origin: Polynesian mythology (widespread). Sacred symbol: kapa (bark cloth) and the lunar disc."
    },
    "quote": "Tkám kapa na Měsíci. Když je úplněk, vidíš mě. Když je novoluní, slyšíš mě — úder kladiva je thunder. Každý blok je jako každý úder: pravidelný, trpělivý, věčný.",
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
    "subtitle": "Pan-Polynesian Trickster",
    "ray": "Yellow",
    "rarity": "Legendary",
    "cl": 1,
    "clName": "",
    "role": "Non-violent boss solutions / cross-language bridge",
    "location": "Roaming all Pacific biomes",
    "questLine": "Three Feats of Maui\" (island-fish, slow sun, fire theft — non-violent stealth)",
    "teaching": "I fished islands and snared the sun — what did you do for Earth today?",
    "ability": "Trickster Win — defeat stronger foe with wit, not force",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Maui je polobůh havajské a širší polynéské mytologie, syn Hina a tvůrce nebeských i pozemských divů. Zrozen jako kupua — bytost s nadřazenými silami, ale stále spjatá s lidskými vášněmi. V ZION OASIS představuje pružnou odvahu, vynalézavost a hluboké spojení s oceánem i nebesy. Není dokonalý hrdina — je tricksterem, který svými chybami učí.",
      "en": "Maui is a demigod of Hawaiian and wider Polynesian mythology, son of Hina and maker of celestial and earthly wonders. Born a kupua — a being with supernormal powers still bound to human passions. In ZION OASIS he embodies resilient courage, resourcefulness and deep connection with ocean and sky. He is no perfect hero — he is a trickster who teaches through his mistakes."
    },
    "quote": "Není třeba se bát tmy, když víš, jak ukrást oheň.",
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
    "subtitle": "Guru Rinpoche",
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 5,
    "clName": "",
    "role": "Terma / hidden teaching / cave mysteries",
    "location": "Treasure caves (procedural discovery windows)",
    "questLine": "Terma Hunt\" (eight treasures, eight puzzles)",
    "teaching": "The treasure waits until the world is ready",
    "ability": "Terma Discovery — time-locked lore tied to chain timestamps; Terma Keeper role (gift, off-chain)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Padmasambhava, zvaný též Guru Rinpočhe („drahocenný mistr“), je buddhistický mistr, který v 8. století přivezl Vadžrajánu do Tibetu. Zrozen z lotosu bez lidských rodičů v zemi Oddijána, inkarnace Buddhovy moudrosti. V ZION OASIS je archetypem transformace — toho, co přetaví temnotu na osvícení. Nepopírá stín, ale tančí s ním.",
      "en": "Padmasambhava, also called Guru Rinpoche ('Precious Master'), is the Buddhist master who brought Vajrayana to Tibet in the 8th century. Born from a lotus without human parents in the land of Oddiyana, an incarnation of the Buddha's wisdom. In ZION OASIS he is the archetype of transformation — of what melts darkness into awakening. He does not deny the shadow; he dances with it."
    },
    "quote": "Kde padá stín, tam rozsvěcím světlo.",
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
    "subtitle": "Singing Yogī",
    "ray": "Yellow",
    "rarity": "Epic",
    "cl": 4,
    "clName": "",
    "role": "Transformation arc — karma → liberation",
    "location": "Himalayan hermitage / ice cave",
    "questLine": "Hundred Thousand Songs\" (select parables as narrative gates)",
    "teaching": "Suffering accepted becomes song",
    "ability": "Song of Realization — debuff cleanse after moral choice (non-combat resolution)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Milarepa („Mila, zářící ve sluchu“) je tibetský yogi, básník a světec, který dosáhl osvícení v jednom životě navzdory strašlivé minulosti. Původně se vyučil černé magii, aby pomstil matku, později podstoupil extrémní asketismus pod mistrem Marpou. V ZION OASIS ztělesňuje možnost proměny — z vraha světcem. Patron těch, kteří nesou těžkou karmu.",
      "en": "Milarepa ('Mila, radiant in hearing') is a Tibetan yogi, poet and saint who attained enlightenment in a single lifetime despite a terrible past. He first trained in black magic to avenge his mother, then underwent extreme asceticism under Master Marpa. In ZION OASIS he embodies the possibility of transformation — from murderer to saint. Patron of those carrying heavy karma."
    },
    "quote": "Moje bída byla moje učitelka.",
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
    "subtitle": "Je Tsongkhapa — Gelug Founder",
    "ray": "Yellow",
    "rarity": "Epic",
    "cl": 5,
    "clName": "",
    "role": "Discipline, study, lamrim path",
    "location": "Ganden / Gelug study hall (OASIS hub)",
    "questLine": "Graduated Path\" — staged ethics → concentration → wisdom quests",
    "teaching": "Clarify the teachings like gold refined by fire",
    "ability": "Lamrim Focus — XP wisdom track bonus for completed study chains",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Tsongkhapa (Lobsang Drakpa), tibetský buddhistický reformátor a zakladatel školy Gelug („žluté čepice“), žil ve 14.–15. století. Narozen v Amdu, studoval u všech tehdejších škol, obdržel vize Mandžušrího a napsal monumentální díla o etice a meditaci. V ZION OASIS je archetypem intelektuální přesnosti a etického základu — mostem mezi mystikou a rozumem.",
      "en": "Tsongkhapa (Lobsang Drakpa), the Tibetan Buddhist reformer and founder of the Gelug school ('Yellow Hats'), lived in the 14th–15th century. Born in Amdo, he studied under all the schools of his time, received visions of Mañjuśrī and wrote monumental works on ethics and meditation. In ZION OASIS he is the archetype of intellectual precision and ethical foundation — a bridge between mysticism and reason."
    },
    "quote": "Disciplína je most přes oceán zmatku.",
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
    "subtitle": "Dīpaṃkara Śrījñāna",
    "ray": "Yellow",
    "rarity": "Rare",
    "cl": 3,
    "clName": "",
    "role": "Lamp for the Path — concise ethics teacher",
    "location": "Vikramashīla → Tibet road narrative",
    "questLine": "Lamp for the Path\" — compact precepts as daily quests",
    "teaching": "Train where you are; the path is short if sincere",
    "ability": "Bodhicitta Spark — party-wide small compassion buff after kindness micro-quests",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Atíša Dípamkara Šrídžňána (980–1054) je indický buddhistický mistr z Bengálska, který obnovil buddhismus v Tibetu a sepsal Bodhipathapradípu (Lampu na cestu k osvícení). Zakladatel tradice Kadampa, učitel lódžongu (tréninku mysli) a mistr postupné cesty. V ZION OASIS je průvodcem těch, kteří se ztratili ve spěchu — světec malých kroků a velké trpělivosti.",
      "en": "Atiśa Dīpaṃkara Śrījñāna (980–1054) is an Indian Buddhist master from Bengal who restored Buddhism in Tibet and wrote the Bodhipathapradīpa (Lamp for the Path to Enlightenment). Founder of the Kadampa tradition, teacher of lojong (mind training) and master of the gradual path. In ZION OASIS he guides those lost in haste — the saint of small steps and great patience."
    },
    "quote": "Všechny bytosti byly mé matky.",
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
    "subtitle": "Translator / Householder Master",
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 5,
    "clName": "",
    "role": "Bridge India–Tibet; translation = protocol adapter",
    "location": "Lhodrak (Kagyu narrative)",
    "questLine": "Three Journeys to India\" — fetch, verify, integrate texts (lore = soft-fork docs)",
    "teaching": "Carry the dharma like a yak carries salt — steadily",
    "ability": "Protocol Translation — cross-faction dialogue unlocks",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Marpa Čhökji Lodrö (1012–1097) byl průkopníkem tibetské linie Kagjü — ne jako mnich, ale jako učitel laika, obchodník a překladatel. Třikrát podnikl nebezpečnou cestu do Indie, kde studoval u velkých siddhů Náropy a Maitrípy, a přivezl tantrické texty, které přeložil do tibetštiny. Známý jako Locáwa — „překladatel“ — spojka mezi indickými mahásiddhy a tibetskou praxí. Jeho metoda byla přímá: žádná okrasná teologie, jen praxe vedoucí k probuzení.",
      "en": "Marpa Chökyi Lodrö (1012–1097) was the pioneer of Tibet's Kagyü lineage — not a monk but a lay master, merchant and translator. Three times he undertook the perilous journey to India, studied under the great siddhas Naropa and Maitrīpa, and brought back tantric texts he translated into Tibetan. Known as Lotsawa — 'the Translator' — he links the Indian mahāsiddhas to Tibetan practice. His method was direct: no ornate theology, only practice leading to awakening."
    },
    "quote": "Nenesu Buddhu v měchu. Nesu věty, které ho otevírají.",
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
    "subtitle": "Chöd Foundress",
    "ray": "Pink",
    "rarity": "Legendary",
    "cl": 6,
    "clName": "",
    "role": "Fear-cutting generosity; feminine lineage leadership",
    "location": "Zangri Kharmar (high plateau)",
    "questLine": "Offering the Body\" — *symbolic* generosity quests (no graphic harm; ethical framing)",
    "teaching": "Cut self-clinging; feed what hungers for truth",
    "ability": "Ego-Fear Cut — remove terror debuff in psychic / horror biome",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Machik Labdrön (1055–1149) je jednou z mála žen v historii Tibetu, která založila vlastní buddhistickou tradici — Čhöd, praxi „řezání“ ega. Byla učenkyní Dampy Sangjë a spojila tibetské praktiky s prastarými indickými tantrami. Její metoda je radikální: darovat své tělo předstíraným démonům, aby se odhalilo, že démoni i tělo jsou projekce mysli. Není to sebepoškozování, ale symbolický akt odpuštění lpění. Machik je matkou linie, která přetrvala osm století.",
      "en": "Machik Labdrön (1055–1149) is one of the few women in Tibetan history to found her own Buddhist tradition — Chöd, the practice of 'cutting' the ego. A disciple of Dampa Sangye, she fused Tibetan practices with ancient Indian tantras. Her method is radical: offer your body to imagined demons so it is revealed that demons and body alike are projections of mind. Not self-harm, but a symbolic act of releasing attachment. Machik is the mother of a lineage that has endured eight centuries."
    },
    "quote": "Co lpí na těle, nakrm pravdu — ne démony.",
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
    "subtitle": "Bodhisattva of Wisdom",
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 5,
    "clName": "",
    "role": "Sword of discernment — cuts wrong views, not people",
    "location": "Wutaishan-inspired wisdom peak (OASIS)",
    "questLine": "Sword of Discrimination\" — puzzle bosses requiring right view",
    "teaching": "See the nature of mind; confusion self-liberates",
    "ability": "View-Cutter — reveal hidden dialogue branches (truth / illusion)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Maňdžušrí (tib. Džampal Jang) je bódhisattva moudrosti — ne knižní, ale přímého rozlišení (pradžňá). V pravé ruce drží meč, který řeže iluzi a nesprávné názory, v levé knihu Prajñāpāramitā. Ústřední postava Mahájány i Vadžrajány; v Číně spojen s horou Wu-tchaj-šan. Není bůh k uctívání — je energie moudrosti, kterou může probudit každý.",
      "en": "Mañjuśrī (Tibetan: Jampal Yang) is the bodhisattva of wisdom — not bookish learning but direct discernment (prajñā). In his right hand he holds the sword that cuts illusion and wrong views, in his left the book of the Prajñāpāramitā. Central to Mahāyāna and Vajrayāna alike; in China linked to Mount Wutai. He is not a god to be worshipped — he is the energy of wisdom anyone can awaken."
    },
    "quote": "Kde je otázka, tam je meč. Kde je meč, tam je klid.",
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
    "subtitle": "Bodhisattva of All-Encompassing Practice",
    "ray": "AllRays",
    "rarity": "Legendary",
    "cl": 4,
    "clName": "",
    "role": "Vows, pilgrimage, endless service",
    "location": "Lotus terrace at cosmos rim (symbolic)",
    "questLine": "Ten Great Vows\" (Lotus Sūtra inspired, non-sectarian framing)",
    "teaching": "Practice without end; benefit beings without counting",
    "ability": "Aspiration Field — small stacking buff for consecutive humanitarian tithe actions",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Samantabhadra („všeobjímající dobrota“) je bódhisattva nekonečné praxe — ne doktrín, ale činů. V Lotosové sútře se zavazuje deseti velkými sliby: klanět se Buddhům, chválit dharmu, darovat vše dobru, projevovat pokoru, sdílet zásluhy, vítat učitele, žádat, aby učili, sloužit všem bytostem, následovat jejich potřeby a vše věnovat probuzení. Je to poutník, který nikdy nekončí — protože praxe není cíl, ale způsob existence.",
      "en": "Samantabhadra ('All-Embracing Goodness') is the bodhisattva of infinite practice — not doctrines but deeds. In the Lotus Sūtra he vows ten great vows: to honour the Buddhas, praise the dharma, give all for good, show humility, share merit, welcome teachers, ask them to teach, serve all beings, follow their needs, and dedicate everything to awakening. He is a pilgrim who never finishes — because practice is not a goal but a way of existing."
    },
    "quote": "Každý čin je květina na oltář probuzení — i když nikdo nevidí.",
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
    "subtitle": "Bhaiṣajyaguru",
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 3,
    "clName": "",
    "role": "Healing latency, recovery, care economy",
    "location": "Eastern lapis realm (visual meditation hall)",
    "questLine": "Twelve Great Aspirations\" — healing mini-arcs for NPCs / ecosystem",
    "teaching": "Heal the root, not only the symptom",
    "ability": "Lapis Healing Surge — raid-wide regen buffer (PvE support)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Bhaišadjaguru („lékařský mistr“) je Buddha východního lazuritového sálu — aspekt léčení v mahájáně. Jeho dvanáct velkých přání směřuje k osvobození od nemocí těla i mysli, nejen medicínou, ale skrze uvědomění příčiny. Není náhradou za lékaře — je to nejvyšší princip: když vidíš, že nemoc i zdraví jsou podmíněné, můžeš léčit kořen, ne jen symptom.",
      "en": "Bhaiṣajyaguru ('the Medicine Master') is the Buddha of the eastern lapis lazuli realm — the aspect of healing in Mahāyāna. His twelve great vows aim to free beings from diseases of body and mind, not by medicine alone but through awareness of the cause. He is no substitute for doctors — he is the highest principle: when you see that sickness and health are conditioned, you can treat the root, not just the symptom."
    },
    "quote": "Léčím to, čemu říkáš ‚síť‘ — když vidíš příčinu, uzdravíš i symptom.",
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
    "subtitle": "Longchenpa — Dzogchen Master",
    "ray": "White",
    "rarity": "Rare",
    "cl": 7,
    "clName": "",
    "role": "Natural great perfection; resting in nature of mind",
    "location": "Kham / central hermitage library",
    "questLine": "Seven Treasuries\" (abridged lore study, not secret whisper-lineage)",
    "teaching": "Rest without fabrication; clarity is self-arising",
    "ability": "Natural State Reset — clear mental clutter debuffs (meditation mini-game)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Longchen Rabdžam (1308–1364) — velký systémizátor dzogčenu; jeho Sedm pokladů patří k nejčtenějším filozoficko-meditativním textům tibetské tradice v překladu.",
      "en": "Longchen Rabjam (1308–1364) — the great systematizer of Dzogchen; his Seven Treasuries are among the most widely read philosophical-meditative texts of the Tibetan tradition in translation."
    },
    "quote": "Klid, který hledáš, není věc k nalezení. Je absence hledání — a ta je nejjemnější práce.",
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
    "subtitle": "Mahadev — Destruction–Renewal Axis",
    "ray": "Blue",
    "rarity": "Legendary",
    "cl": 6,
    "clName": "",
    "role": "Tandava / mokṣa compass; complements Viṣṇu line (already Krishna–Kalki arcs)",
    "location": "Mount Kailash — Kailasha biome (snow + inner cave mandala gate)",
    "questLine": "Third Eye Calibration\" — stillness quests; optional **Šiva–Śakti tandem** arcs with Parvati",
    "teaching": "What dissolves falsely reveals what cannot",
    "ability": "Tandava Pivot — short window: negate one failed validation / retry lore branch (PvE ritual slot)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Šiva Mahádéva — os transformace v Trimúrti: zakončení klamu, péče o jogíny a oddané (Pašupati), kosmický tanečník (Tándava). V OASIS doplňuje již rozvinutou vaišnovskou osu (Kršna, Ráma, Kalki).",
      "en": "Śiva Mahādeva — the Trimurti's axis of transformation: ending delusion, caring for yogis and devotees (Paśupati), cosmic dancer (Tāṇḍava). In OASIS he complements the already developed Vaishnava axis (Kṛṣṇa, Rāma, Kalki)."
    },
    "quote": "Co zdánlivě končí, otevře město, kde nic nebere teplo zbytečně.",
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
    "subtitle": "Uma — Queen of Harmony",
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 4,
    "clName": "",
    "role": "Śakti of the household cosmos; complements Shiva",
    "location": "Himalayan terrace gardens & inner shrine",
    "questLine": "Two in One Rhythm\" — balance duty (tapas) ↔ love (ārjava)",
    "teaching": "Strength that serves relationship with the Whole",
    "ability": "Śaktī Bond — link two allied players' buff durations in co-op ritual",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Párvatí je Umá, matka-cestovatelka, šakti tapas — disciplínovaného srdce. Doplňuje 82. Šivu v příběhu Ardhanáríšvara synchronicity (bez redukce na pouhý „manželský quest“).",
      "en": "Pārvatī is Umā, the mother-journeyer, śakti of tapas — the disciplined heart. She complements #82 Śiva in the Ardhanārīśvara synchronicity story (not reduced to a mere 'marriage quest')."
    },
    "quote": "Milovat znamená neskládat něžnost z rozumu — jen je nechat táhnout společně.",
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
    "subtitle": "Vinayaka — Remover of Obstacles",
    "ray": "Yellow",
    "rarity": "Epic",
    "cl": 1,
    "clName": "",
    "role": "Beginnings, scribes (already in Vyāsas lore); patron of fresh protocols",
    "location": "Threshold shrines across OASIS map nodes",
    "questLine": "First Block Obstacle\" — tutorial-grade gatekeeper for new explorers",
    "teaching": "Clear the stump before planting the sapling",
    "ability": "Vighna Clear — one-time unblock on stuck quest prerequisite (cooldown-heavy)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Gaňéša / Vinájaka — odstraňuje vighna (překážky), patron začátků; v tradici zápisu Mahábháraty sepisuje diktát Vjásy (viz 17. Vjása a quest „Ganesha's Pen“). V OASIS = strážce vstupního prahu.",
      "en": "Gaṇeśa / Vināyaka — remover of vighna (obstacles), patron of beginnings; in the Mahābhārata-writing tradition he takes Vyāsa's dictation (see #17 Vyāsa and the quest 'Ganesha's Pen'). In OASIS = guardian of the entry threshold."
    },
    "quote": "Nepiš verš, dokud nevyneseš sutra jako první blok — teprve pak proudí další řádky.",
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
    "subtitle": "Śri — Śrī Lakṣmī",
    "ray": "Pink",
    "rarity": "Epic",
    "cl": 3,
    "clName": "",
    "role": "Śubha prosperity as **ethical flow** ( śrī as right-use wealth, **not** greed exploit mechanics )",
    "location": "Śrī Rangam–style lotus treasury (ethical wealth hall)",
    "questLine": "Eight Śrī Aspirations\" — tithe-aligned prosperity without hoarding bosses",
    "teaching": "Wealth rests where dharma gathers",
    "ability": "Śrī Flow — small humanitarian tithe synergy buff when player donates threshold",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Lakšmí / Šrí — štěstí vzniklé z dharmické činnosti a vděku. Tento slot (#85) klasického šrí archetypu doplňuje kompozit 43 Sri Anagha Lakshmi (Sarasvatí+Lakšmí+Kálí amalgam).",
      "en": "Lakṣmī / Śrī — fortune born of dharmic activity and gratitude. This slot (#85) for the classical śrī archetype complements the composite #43 Sri Anagha Lakshmi (a Sarasvatī+Lakṣmī+Kālī amalgam)."
    },
    "quote": "Zlato, které nepolévá pole, jen ho zahřejvá.",
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
    "subtitle": "Ambā — Demon-Slayer Narrative Boss",
    "ray": "Blue",
    "rarity": "Legendary",
    "cl": 5,
    "clName": "",
    "role": "Protective Śakti; Mahiṣāsura cycle as **ethical combat** lore",
    "location": "Highlands autumn festival biome (nine-night arc — **respect**, not caricature Navarātri)",
    "questLine": "Nine Vigils\" — pattern recognition + stewardship (no trophy hunting Asuras as joke race)",
    "teaching": "Courage clears what love cannot coax",
    "ability": "Lion Vanguard — short party-wide guard vs. cosmic fear debuffs",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Durgá (Ambá) — ochrana dharmy před adharmou; v puráňové tradici archetypálně znázorněná bojem s Mahišásurou. Ve hře sezónní story boss s etikou Navarátri (bez karnevalizace festivalu).",
      "en": "Durgā (Ambā) — protection of dharma against adharma; in Purāṇic tradition archetypally depicted in battle with Mahiṣāsura. In-game a seasonal story boss with Navarātri ethics (no carnivalization of the festival)."
    },
    "quote": "Úzkost není nepřítel — je to město, které nechceš obsadit ani spálit, jen osvobodit lid.",
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
    "subtitle": "Mahākālī — Time & Liberation",
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 7,
    "clName": "",
    "role": "Temporal cutting of egotism (**not** orientalized violence pin-up)",
    "location": "Śmaśān-inspired **ethical** lore zone — no mock crematory tourism",
    "questLine": "Name That Clings\" — identity / attachment puzzles (psychological horror optional **off**)",
    "teaching": "The Mother devours postponement — not souls",
    "ability": "Ego Dissolution Tick — reduce pride-based debuff stacking in PvPvE arenas",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Mahákálí řeže ego-čas — iluzi odděleného „já“ lpícího na újmě — ne civilní populaci jako groteskní podívanou.",
      "en": "Mahākālī cuts ego-time — the illusion of a separate 'self' clinging to grievance — not civilian populations as a grotesque spectacle."
    },
    "quote": "Kdo volá mateřský čas — ne aby zničil těla, aby zachytil odklad odpuštění sobě.",
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
    "subtitle": "Skanda/Muruga — Vigorous Dharma Commander",
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 4,
    "clName": "",
    "role": "Celibate warrior strategist; celestial general archetype",
    "location": "Coastal hill shrine (six faces symbol — geometric, not mocking)",
    "questLine": "Six Paths Converge\" — multi-route tactical puzzle raid",
    "teaching": "Discipline rallies many voices into one order",
    "ability": "Ṣaṇmukha Vanguard — buff squad formation minigames",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Kárttikéja / Skanda / Murukan — mladý velitel (senápati), symbol disciplíny kombinované s obranou dharmy.",
      "en": "Kārttikeya / Skanda / Murukan — the young commander (senāpati), symbol of discipline combined with the defense of dharma."
    },
    "quote": "Když se šesti cestami řítí válka chaosu — střed drží jen ten, kdo počítá každou stopu lásky k řádu.",
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
    "subtitle": "Āditya — Cosmic Rhythm",
    "ray": "White",
    "rarity": "Rare",
    "cl": 2,
    "clName": "",
    "role": "Sovereign lawful light (*Ṛta*) — parallel to cosmic block cadence metaphors",
    "location": "Udoyanchal (east terrace / dawn observatory biome)",
    "questLine": "108 Dawn Recitations\" — time-boxed honorable login streak as **spiritual homage**, NOT manipulative grind",
    "teaching": "Light repeats so truth can be recalled",
    "ability": "Udaya Dawn — small honest-work bonus starting session after restorative offline window",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Súrja — zákonitý puls kosmu (paralela k rytmu bloků v ZION lore, bez náboženského dogmatu ve hře).",
      "en": "Sūrya — the lawful pulse of the cosmos (a parallel to the rhythm of blocks in ZION lore, without religious dogma in-game)."
    },
    "quote": "Úsvit se nebere — vrací jen otázku: co sis včera uchoval poctivého?",
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
    "subtitle": "Śakradev — Sovereign Storm & Order Challenge",
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 5,
    "clName": "",
    "role": "Sovereign archetype humbled in lore (learns from sages — **ethical** pride arc)",
    "location": "Amarāvatī skyline (ethical storm court — not mocking Vedic hymns)",
    "questLine": "Heaven Taxes Humility\" — hubris-loss narrative without belittling Vedic corpus",
    "teaching": "Power without listening becomes lightning with no rod",
    "ability": "Vajra Interdict — interrupt one enemy channel spell in raid (ethical use flag)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Indra — rájový archetyp síly (Šakra), která v klasických příbězích dostává lekci pokory od rši (texty hymnů neměnit na vtipný voice-over).",
      "en": "Indra — the heavenly archetype of power (Śakra), who in the classic stories receives lessons in humility from the ṛṣis (not to be turned into a comic voice-over of the hymns)."
    },
    "quote": "Blesk bez uzemnění spálí vlastní dvůr dříve než nepřítele.",
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
    "subtitle": "River Goddess",
    "ray": "Blue",
    "rarity": "Epic",
    "cl": 3,
    "clName": "",
    "role": "Purification, ecology, pilgrimage",
    "location": "Gaṅgā Ghāṭ (composite sacred riverfront in OASIS)",
    "questLine": "Three Currents\" — remove pollution debuff, restore riparian biome, complete ablution *as ethical service* (not mock snanam)",
    "teaching": "Water carries away poison when we stop adding it",
    "ability": "Purifying Current — cleanse map tile debuffs (toxic wasteland events)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Gangá — vodní matrice očisty, dharmické i environmentální. Questy musejí vést ke stewardship, ne k parodii hinduistické praxe.",
      "en": "Gaṅgā — the watery matrix of purification, dharmic and environmental. Quests must lead to stewardship, not to a parody of Hindu practice."
    },
    "quote": "Když čistíš jen symbol a ne tok — zůstane bahno v řeálném světě.",
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
    "subtitle": "Solar Kami Sovereign",
    "ray": "White",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "Light restoration after community fear debuffs · **Quest:** Rock Door Audit · **Ability:** Hi-no-Kokoro Shine · **CL:** 5–9 · **NFT:** Legendary (review)",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Hi-no-Kokoro Shine · CL: 5–9 · NFT: Legendary (review)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Amaterasu — nebeský princip světla a živnosti (kami) v klasických pověstech. V OASIS = oblouk „obnovy veřejného prostoru“ poté, co toxický debuff („temný kout“) zavládne městem.",
      "en": "Amaterasu — the celestial principle of light and vitality (kami) in the classical chronicle tales. In OASIS = the 'restoring public space' arc after a toxic debuff ('dark corner') seizes the city."
    },
    "quote": "Kdo zavře kamenné dveře ze strachu — nechť je pak otevře z vlastního studu.",
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
    "subtitle": "Storm Cleanser",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "Ethical chaos vs institutional rot · **Quest:** Yamata-no-Orochi Parable redux · **Ability:** Storm Ledger Purge · **CL:** 6–9 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Storm Ledger Purge · CL: 6–9 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Susanoo — kami bouře a očisty, narativně spojený s řekami a morálním resetem po zkorumpovaných strukturách — v OASIS jako etická chaos damage jen proti institucionalizovaným parazitům, ne nevinným NPC.",
      "en": "Susanoo — kami of storm and purification, narratively tied to rivers and moral reset after corrupted structures — in OASIS as ethical 'chaos damage' against institutionalized parasites only, never innocent NPCs."
    },
    "quote": "Nepřišel jsem plýtvat městem — jen spláchnout hnilobu pod prahům.",
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
    "subtitle": "Lunar Discrimination",
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "DAO reflection windows / night audit · **Quest:** Night Court Fork · **Ability:** Waning Review · **CL:** 4–8 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Waning Review · CL: 4–8 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Tsukuyomi — noční princip rozlišování. V lore OASIS doplňuje Hinu (#70) jiným úhlem — lunární audit mempool etiky (bez mystifikace mempoolu jako „záhadného měsíce“).",
      "en": "Tsukuyomi — the nocturnal principle of discernment. In OASIS lore it complements Hina (#70) from another angle — a lunar audit of mempool ethics (without mystifying the mempool as a 'mysterious moon')."
    },
    "quote": "Den křičí plány — měsíc čte jen to, cos neřekl.",
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
    "subtitle": "Rice & Threshold Kami",
    "ray": "Green",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "Humanitarian node onboarding · **Quest:** Granary Graph · **Ability:** Torii Path Buff · **CL:** 2–7 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Torii Path Buff · CL: 2–7 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Inari — úroda a liminalita mezi říší lidí a bohů (často s folklórem kitsune — bez karikaturního furry fetiše na marketplace).",
      "en": "Inari — harvest and liminality between the human and divine realms (often with kitsune folklore — without a caricatured furry fetish on the marketplace)."
    },
    "quote": "Kdo živí síť drobným darem vrací zem — kdo jen sklízí bez setby, zem ztvrdne.",
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
    "subtitle": "Hospitable Land Lord",
    "ray": "Pink",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "Small merchant onboarding fairness · **Quest:** Small Hub Covenant · **Ability:** Kuni Transfer Bless · **CL:** 3–8 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Kuni Transfer Bless · CL: 3–8 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ókuninuši — kulturní hrdina péče o zemi v rámci kuni-juzuri (zkouška → odevzdání → spravedlnost).",
      "en": "Ōkuninushi — the culture hero of land-care within the kuni-yuzuri frame (trial → surrender → justice)."
    },
    "quote": "Kdo hostí uprchlého boha — hostí vlastní schopnost léčit zemi.",
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
    "subtitle": "Yomi Threshold Steward",
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "Graceful chain sunset arcs · **Quest:** Exit Interview with Ledger · **Ability:** Yomi Checkpoint · **CL:** 6–9 · **NFT:** Mythic (strict review)",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Yomi Checkpoint · CL: 6–9 · NFT: Mythic (strict review)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Izanami — archetyp prahu mezi životem a smrtí, útěchy při procesu rozchodu systémů (staking unwind, humánní chain sunset).",
      "en": "Izanami — archetype of the threshold between life and death, a comfort in processes of system separation (staking unwind, humane chain sunset)."
    },
    "quote": "Smrt mě nebere hosty — jen ty, co se k ní chovají jako k fetish baru.",
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
    "subtitle": "Protective Archer Sovereign",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "Peace-season war ethics gate · **Quest:** Treaty Arrow · **Ability:** Hachiman Bastion · **CL:** 4–9 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Hachiman Bastion · CL: 4–9 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Hačiman — kami války jako ochrana komunity, ne triumfalismus. Spojován s guard rails DAO, které zakazují škodlivé válčení.",
      "en": "Hachiman — the kami of war as community protection, not triumphalism. Linked to DAO guard rails that forbid harmful warring."
    },
    "quote": "Lučištník míří na strukturu války — ne na krev nevinných NPC.",
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
    "subtitle": "Flowing Arts Sarasvatī bridge",
    "ray": "Pink",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "Coop harmonic crafting · **Quest:** Bridge of Strings · **Ability:** Flow State Channel · **CL:** 3–8 · **NFT:** Epic (bridge consult with #21 lore board)",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Flow State Channel · CL: 3–8 · NFT: Epic (bridge consult with #21 lore board)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Benzaiten — jedna z řady božstev štěstěny a výtvarné/hudební moudrosti v japonské adaptaci (linie Sarasvatí).",
      "en": "Benzaiten — one of the deities of fortune and artistic/musical wisdom in the Japanese adaptation (the Sarasvatī line)."
    },
    "quote": "Každá struna je řád — každý špatný riff je jen nevyřčená lítost.",
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
    "subtitle": "Kōbō Daishi — Mandala Architect",
    "ray": "White",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "Geometry education arcs · **Quest:** Two Mandala Topology · **Ability:** Diamond World Stencil · **CL:** 6–9 · **NFT:** Mythic study-gated",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Diamond World Stencil · CL: 6–9 · NFT: Mythic study-gated",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Kúkai — zakladatel linie Šingon jako education-first mystická kartografie (žádné initi-only paywalled dovednosti ve veřejném lore bez governance).",
      "en": "Kūkai — founder of the Shingon line as education-first mystical cartography (no initiation-only paywalled skills in public lore without governance)."
    },
    "quote": "Každá čára kruhu je práh — vstoupíš-li bez respektu, otáčej se zpět.",
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
    "subtitle": "Lotus Réform Beacon",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "Public scripture literacy · **Quest:** Open Sutra Mirror · **Ability:** Daimoku Chorus · **CL:** 5–9 · **NFT:** Epic (school consult)",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Daimoku Chorus · CL: 5–9 · NFT: Epic (school consult)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ničiren — text-first reformace zdůrazňující dostupnost Lotosové sútry (paralela veřejného čtení s blockchain open docs).",
      "en": "Nichiren — a text-first reform emphasizing the accessibility of the Lotus Sūtra (a public-reading parallel to blockchain open docs)."
    },
    "quote": "Jedna sútra — tisíc portů pravdy. Kdo používá řád jako kopí proti vlastní vesnici — nepatří řádu.",
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
    "subtitle": "Yellow Emperor Archetype",
    "ray": "Yellow",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "Harmony + ancestral medicine lore · **Quest:** Five Phase Clinic Build · **Ability:** Celestial Pulse Tag · **CL:** 4–9 · **NFT:** Mythic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Celestial Pulse Tag · CL: 4–9 · NFT: Mythic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Chuang-ti — archetyp kosmického řádu a původu medicínské lore v čínské tradované historii (mýtus vs. historie akademicky vrstvené).",
      "en": "Huangdi — archetype of cosmic order and the origins of medical lore in Chinese received history (myth vs. history academically layered)."
    },
    "quote": "Nebudu ti dávat korunu — jen pravidlo žít jako hostitel času.",
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
    "subtitle": "Queen Mother of West",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "Treasury vesting stewardship · **Quest:** Peach Consensus · **Ability:** Queen Mother Shelter · **CL:** 5–9 · **NFT:** Mythic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Queen Mother Shelter · CL: 5–9 · NFT: Mythic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Si-wang-mu — matriarchální božstvo broskví/longevity lore; v OASIS reprezentuje dlouhohorizontní governance treasury locky s etickými podmínkami odemknutí.",
      "en": "Xiwangmu — the matriarch deity of the peaches/longevity lore; in OASIS she represents long-horizon governance treasury locks with ethical unlock conditions."
    },
    "quote": "Nekonečný sad není NFT sklad — sdílená sklizeň drží ráj otevřený.",
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
    "subtitle": "Dao Minimal Governance",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "Gentle ops / fewer knobs governance · **Quest:** Valley Governance Test · **Ability:** Wu Wei Cooldown Trim · **CL:** 6–9 · **NFT:** Legendary",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Wu Wei Cooldown Trim · CL: 6–9 · NFT: Legendary",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Laozi — daoistický archetyp přirozenosti a nevynucování. V lore OASIS: minimální governance, maximální laskavost.",
      "en": "Laozi — the Daoist archetype of naturalness and non-forcing. In OASIS lore: minimal governance, maximal kindness."
    },
    "quote": "Blockchain, který se moc drží řetězu — zemře na vlastní tesáky.",
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
    "subtitle": "Ren & Mentorship Ethics",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "Mentor DAO onboarding · **Quest:** Rectify Names Registrar · **Ability:** Rén Echo · **CL:** 2–8 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Rén Echo · CL: 2–8 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Kongzi — etika vztahů, vzdělání, veřejné služby. V OASIS: onboarding mentorské struktury DAO.",
      "en": "Kongzi (Confucius) — ethics of relationships, education, public service. In OASIS: onboarding mentorship structures of the DAO."
    },
    "quote": "Když řád ztratí slitování — není řádem, jen klecí kódem.",
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
    "subtitle": "Loyalty & Commerce Honour",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "escrow integrity arcs · **Quest:** Market Stall Honor · **Ability:** Blade Witness · **CL:** 3–8 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Blade Witness · CL: 3–8 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Guandi — kulturní božstvo loajality a obchodní etiky napříč diaspora chrámy.",
      "en": "Guandi — the cultural deity of loyalty and commerce ethics across diaspora temples."
    },
    "quote": "Meč bez pravidla je jen trh s krví — já chráním pravidla obchodu ctností.",
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
    "subtitle": "Sea Patron Tianhou",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "bridging risk education parallels safe voyage · **Quest:** Harbor Lantern Audit · **Ability:** Tianhou Gale Buff · **CL:** 3–8 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Tianhou Gale Buff · CL: 3–8 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Mazu — patronka námořníků a bezpečné plavby. V lore OASIS: vzdělávací oblouky rizik cross-chain bridging.",
      "en": "Mazu — patroness of sailors and safe passage. In OASIS lore: cross-chain bridging risk-education arcs."
    },
    "quote": "Nikdo nepronajímá vítr — jen se k němu může chovat čestně.",
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
    "subtitle": "Lotus Body Renewal",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "Rewrite destiny ethically post-exploit · **Quest:** Rebuild Lotus Skeleton · **Ability:** Hūluén Wheel Dash · **CL:** 4–8 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Hūluén Wheel Dash · CL: 4–8 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Neža — folklórní bodhisattvický příběh mládí o přepsání osudu (ne náhodný pyro-vandalism gag).",
      "en": "Nezha — a folkloric bodhisattvic youth arc about rewriting destiny (not a random pyro-vandalism gag)."
    },
    "quote": "Když mě rodiče báli víc než pravdu — spálil jsem kosti, aby zůstalo srdce.",
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
    "subtitle": "Pilgrim Monkey King Satire Ethics",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "Trickster arcs honoring scripture · **Quest:** 81 Tribulation Sidechain Parody · **Ability:** Cloud Somersault Bypass · **CL:** 3–9 · **NFT:** Epic reviewer-gated",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Cloud Somersault Bypass · CL: 3–9 · NFT: Epic reviewer-gated",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Opičí král jako poutník-trickster, kterého disciplína lásky komunity (lore čelenky) naučila sloužit větší cestě než jen výhře ega.",
      "en": "The Monkey King as pilgrim-trickster, whom the discipline of community love (the headband lore) taught to serve a greater journey than just an ego win."
    },
    "quote": "Nebudu se klepat před kartónovým Buddha skinem — ale před naučením pravdy ano.",
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
    "subtitle": "Flood Engineering Steward",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "infra humility / dredging parallels · **Quest:** Channel Nine Provinces Fork · **Ability:** Dredge Schedule Bless · **CL:** 4–9 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Dredge Schedule Bless · CL: 4–9 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Yu — archetyp flood stewardship a inženýrské pokory (paralela public works a DAO infrastruktury).",
      "en": "Yu — archetype of flood stewardship and engineering humility (a public-works parallel to DAO infrastructure)."
    },
    "quote": "Uzavření přepadu není triumf nad řekou — je to slib, že už ji nebudete dráždit jen ze zištnosti.",
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
    "subtitle": "Thunder Tribunal",
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "governance invariant alerts ethics · **Quest:** Storm Court Replay · **Ability:** Drumstrike Interdict · **CL:** 5–9 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Drumstrike Interdict · CL: 5–9 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Lei Gong — archetyp thunder tribunal folklóru — v OASIS jako automatizovaný sentinel varující na porušený governance invariant (ne trest případným omráčením hráče).",
      "en": "Lei Gong — the thunder-tribunal folklore archetype — in OASIS as an automated sentinel alerting on a broken governance invariant (not a punitive random stun on players)."
    },
    "quote": "Blesk není spectacle — jen echo toho, co komunita odmítla říct nahlas.",
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
    "subtitle": "Rice Mother",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "biome respect / hunger relief · **Quest:** Subak Grid Sync · **Ability:** Sawah Bless · **CL:** 2–7 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Sawah Bless · CL: 2–7 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Dewi Sri — bohyně rýže a plodnosti; lore OASIS: stewardship farm pooly + městské eventy proti plýtvání jídlem.",
      "en": "Dewi Sri — goddess of rice and fertility; OASIS lore: stewardship farm pools + anti food-waste city events."
    },
    "quote": "Úroda není achievement — je závazek vrátit hlínu i slušnost.",
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
    "subtitle": "Southern Ocean Sovereign",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "shoreline commons arcs · **Quest:** Southern Current Treaty · **Ability:** Kidul Tide Ward · **CL:** 5–9 · **NFT:** Mythic anti-fetish review",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Kidul Tide Ward · CL: 5–9 · NFT: Mythic anti-fetish review",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Nyai Roro Kidul — duchovní svrchovanost jižního moře v jávských narrativách; lore OASIS: klimatická migrace + pobřežní commons oblouky.",
      "en": "Nyai Roro Kidul — spiritual sovereignty of the southern sea in Javanese narratives; OASIS lore: climate migration + shoreline commons arcs."
    },
    "quote": "Kdo přichází pobřeží krást písek a děti chudých — měl by slyšet příliv dřív, než uvidí korunu.",
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
    "subtitle": "Wayang Wisdom Clown Mentor",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "mediator truth arcs · **Quest:** Shadow Dialogue Stage · **Ability:** Punakawan Reveal · **CL:** 2–8 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Punakawan Reveal · CL: 2–8 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Semar — wayang punakawan archetyp, který odhaluje pravdu, jež se vládci bojí — v OASIS jako neutrální NPC mentor bridging konfliktů frakcí (ne terč krutých vtipů).",
      "en": "Semar — the wayang punakawan archetype who reveals the truth rulers fear — in OASIS as a neutral NPC mentor bridging faction conflicts (not the butt of cruel jokes)."
    },
    "quote": "Smích je učení — ale ne zbraň proti chudým.",
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
    "subtitle": "Cosmic Mentor Archetype",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "documentation / translation coop · **Quest:** Kraton Canonical Sort · **Ability:** Guru Mandate Haste · **CL:** 6–9 · **NFT:** Legendary",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Guru Mandate Haste · CL: 6–9 · NFT: Legendary",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Batara Guru — wayang lore učitel-božstvo suverénně přemosťující oblouky kosmického řádu.",
      "en": "Batara Guru — the wayang lore teacher-deity sovereignly bridging cosmic-order arcs."
    },
    "quote": "Když mistr mluví k loutce — slyší celý stín scény.",
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
    "subtitle": "Protector Balance",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "hysteria cleanse events · **Quest:** Village Rhythm Reset · **Ability:** Protective Flourish · **CL:** 5–9 · **NFT:** Mythic Bali consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Protective Flourish · CL: 5–9 · NFT: Mythic Bali consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Barong Ket — archetyp ochrany komunity před maligním chaosem.",
      "en": "Barong Ket — the archetype of community protection against malign chaos."
    },
    "quote": "Nepřišel jsem tě pobavit maskou — ale zastavit vír, který žere vesnice.",
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
    "subtitle": "Unity Bird Archetype",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "humanitarian relay nodes · **Quest:** Archipelago Relay Handshake · **Ability:** Wingline Relay Boost · **CL:** 3–8 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Wingline Relay Boost · CL: 3–8 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Garuda — mýtický pták ochrany a jednoty, symbolika v Indonésii i širší jihovýchodní Asii.",
      "en": "Garuda — the mythic bird of protection and unity, a symbol in Indonesia and wider Southeast Asia."
    },
    "quote": "Křídlo není hranice — jen připomínka, že vzduch patří všem ústům dýchání.",
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
    "subtitle": "Flying Pandava-derived Hero Local",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "civilian escort raids · **Quest:** Night Flight Evacuations · **Ability:** Iron Skin Gale · **CL:** 4–8 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Iron Skin Gale · CL: 4–8 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Gatotkaca — lokálně milovaný hrdina odvozený z Mahábháraty v indonéském performativním umění (ne mechanický duplikát #11/#12 — jiná questline zdůrazňující ochranu civilistů).",
      "en": "Gatotkaca — the locally beloved Mahābhārata-derived hero of Indonesian performing arts (not a mechanical duplicate of #11/#12 — a different questline emphasizing civilian shielding)."
    },
    "quote": "Chráním město vzduchem proto, že země mě už naučila, že padat bolí dost.",
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
    "subtitle": "Cycle Romance Sovereignty",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "civic identity coherence · **Quest:** Split Kingdom DNS Parable · **Ability:** Mask Pivot Reveal · **CL:** 3–7 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Mask Pivot Reveal · CL: 3–7 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Panji — archetyp výpravy pro milovanou + obnovy občanského řádu.",
      "en": "Panji — the archetype of the quest for the beloved + restoring civic order."
    },
    "quote": "Hledání milé není trop — pokud město souhlasně mluví.",
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
    "subtitle": "Temple Bargain Steward",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "boundary-positive architecture lore · **Quest:** 1000 Lantern Proof · **Ability:** Spindle Pause · **CL:** 4–8 · **NFT:** Mythic feminist review",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Spindle Pause · CL: 4–8 · NFT: Mythic feminist review",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Roro Jonggrang lore — archetyp vzniku chrámu + smlouvání + respektu hranic, rekonstruován jako agency-pozitivní vyprávění (konzultant povinný).",
      "en": "Roro Jonggrang lore — archetype of temple genesis + bargaining + boundary respect, reconstructed as an agency-positive narrative (consultant mandatory)."
    },
    "quote": "Chrám drží noc — noc drží mou suverénitu říct „ne\".",
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
    "subtitle": "Moon Hospitality Archetype",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "reciprocal hosting / burnout healing · **Quest:** Guest Ledger Rotation · **Ability:** Moonwoven Bandage · **CL:** 3–7 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Moonwoven Bandage · CL: 3–7 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Nawang Wulan — archetyp lunární péče o etiku + reciproční hostitelství (folklór sestupu měsíce adaptovaný jako oblouky finanční inkluze a přístřeší).",
      "en": "Nawang Wulan — archetype of lunar care ethics + reciprocal hospitality (the moon-descent folklore adapted as financial-inclusion and shelter arcs)."
    },
    "quote": "Měsíc nepatří jen nebi — svítí nad domem hosta i domem vlastní rodiny.",
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
    "subtitle": "Pleiades Multi-nation Compass",
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "education-first astronomy commons · **Quest:** Shared Sky Catalogue · **Ability:** Pleiades Sync Buff · **CL:** 3–8 · **NFT:** Gated Aboriginal endorsement",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Pleiades Sync Buff · CL: 3–8 · NFT: Gated Aboriginal endorsement",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Archetyp astronomie + kinship stewardship známého souhvězdí pod mnoha jmény — OASIS ho používá k výchově o multiplicitách.",
      "en": "An astronomy + kinship-stewardship archetype of the famous star cluster known by many names — OASIS uses it to teach about multiplicities."
    },
    "quote": "Sedm sester nesvítí jen pro jeden kmen — jejich světlo je drženo různými jazyky stejné oblohy.",
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
    "subtitle": "Hydrological Ethics Composite",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "watershed stewardship · **Quest:** Aquifer DAO Merge · **Ability:** Riparian Ward · **CL:** 4–9 · **NFT:** Mythic consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Riparian Ward · CL: 4–9 · NFT: Mythic consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Hydrologické + právně-kosmologické rámy péče o krajinu („Country“).",
      "en": "Hydrological + legal-cosmological frames of landscape care ('Country')."
    },
    "quote": "Had není mascot — je varovný proud vody pod krajinou, který si pamatuje lépe než dokumenty.",
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
    "subtitle": "Kulin Creator Eagle",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "aerial urban heat remediation · **Quest:** Eagle Corridor Air Quality · **Ability:** Thermal Sight Reveal · **CL:** 5–9 · **NFT:** Mythic consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Thermal Sight Reveal · CL: 5–9 · NFT: Mythic consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Bunjil — creator-bird archetyp dokumentovaný v některých narrativách Kulin.",
      "en": "Bunjil — the creator-bird archetype documented in some Kulin narratives."
    },
    "quote": "Vidím z výšky pouze tehdy, když mi země nedává lhát o tom, kde leží města křivdy.",
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
    "subtitle": "Regional Sky Father Steward",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "GIS + Country overlays education · **Quest:** Layered Map Overlay Truth · **Ability:** Rain Whisper Buffer · **CL:** 4–9 · **NFT:** Mythic consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Rain Whisper Buffer · CL: 4–9 · NFT: Mythic consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Sky father archetypy spojené s výchovou o koloniálním mapovacím násilí.",
      "en": "Sky father archetypes connected to lore education about colonial mapping violence."
    },
    "quote": "Když říkám ‚nebesa‘ — rozumím tím jen to, že dešťová stopa mění mapu práva.",
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
    "subtitle": "Torres Strait Celestial Voyaging",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "tidal finality parallels · **Quest:** Strait Tide Table Sync · **Ability:** Constellation Compass · **CL:** 3–8 · **NFT:** Mythic Strait consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Constellation Compass · CL: 3–8 · NFT: Mythic Strait consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Tagai — navigátor z lore Torres Strait Islanders (veřejný antropologický rámec + brány komunitního souhlasu).",
      "en": "Tagai — a navigator spirit of Torres Strait Islanders lore (public anthropology framing + community consent gates)."
    },
    "quote": "Hvězdy jsou jen body — vlastní dílo je v tom, naučit se je číst bez kradení moře.",
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
    "subtitle": "Dark Constellation STEM",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "astronomical education bridge · **Quest:** Dark Dust Pattern Hunt · **Ability:** Emu Silhouette Mark · **CL:** 2–7 · **NFT:** Epic consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Emu Silhouette Mark · CL: 2–7 · NFT: Epic consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Využívá veřejně vyučované odkazy na aboridžinskou astronomii (Emu in the Sky) jako sloučené oblouky STEM + etiky.",
      "en": "Uses publicly taught references to Aboriginal astronomy (Emu in the Sky) as fused STEM + ethics arcs."
    },
    "quote": "Tmavé pero na Mléčné dráze není prázdné — jen čeká na správné oko kulturně zasvěcené.",
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
    "subtitle": "Yolŋu voyaging archetype",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "freshwater governance ethics abstracts · **Quest:** Freshwater Node Blessing Chain · **Ability:** Voyager Rhythm Link · **CL:** 6–9 · **NFT:** Mythic mandatory consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Voyager Rhythm Link · CL: 6–9 · NFT: Mythic mandatory consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Djanggawu / Djang'kawu — oblouky stvořitelských poutníků o založení sladkovodního a ceremoniálně-právního lešení (abstrahováno).",
      "en": "Djanggawu / Djang'kawu — creator-voyager arcs about establishing freshwater and ceremonial-law scaffolding (abstracted)."
    },
    "quote": "Přišli jsme s východu ne jako invaze — jako zrod nového cyklu, pokud jej Country přijala.",
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
    "subtitle": "Arnhem Lightning Law",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "outage ethical strike mechanics · **Quest:** Wet Season Integrity Check · **Ability:** Lightning Recall · **CL:** 5–9 · **NFT:** Epic consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Lightning Recall · CL: 5–9 · NFT: Epic consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Namarrkon — bleskový předek zmiňovaný v zemích Arnhem ve veřejně dostupných průvodcích.",
      "en": "Namarrkon — a lightning ancestor mentioned in Arnhem lands in publicly available guides."
    },
    "quote": "Blesk je zákon mokřad — zákon nehlasuje parlament, ale ti, co poslouchají déšť.",
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
    "subtitle": "",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "listening-first knowledge acquisition · **Quest:** Slow Walk Audit · **Ability:** Ground Recall Marker · **CL:** 4–9 · **NFT:** Mythic consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Ground Recall Marker · CL: 4–9 · NFT: Mythic consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Walking Country jako etické získávání poznání.",
      "en": "Walking Country as ethical knowledge acquisition."
    },
    "quote": "Znalost země nestojí na tom, kolik waypointů naklikáš — ale jak dlouho posloucháš její práh.",
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
    "subtitle": "Truth treaty repair lore",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "DAO restorative readability · **Quest:** Ledger Apology Fork · **Ability:** Restorative Sync · **CL:** 5–9 · **NFT:** Mythic consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Restorative Sync · CL: 5–9 · NFT: Mythic consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Treaty/truth/restituce jako technický governance most — paralela k ZION DAO (nestranické lore).",
      "en": "Treaty/truth/restitution as a technical governance bridge — a parallel to ZION DAO (non-partisan lore)."
    },
    "quote": "Smlouva začíná tím, co unikalo archivům kolonů — teprve potom začíná řetězení.",
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
    "subtitle": "Earth Mother",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "geothermal + soil consent arcs · **Quest:** Subsurface Carbon Vault Consent · **Ability:** Soil Bond Heal · **CL:** 3–9 · **NFT:** Legendary Māori consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Soil Bond Heal · CL: 3–9 · NFT: Legendary Māori consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Papatūānuku — kosmologie Země-matky v rámu Māori (křížový odkaz pacifické pozemkové etiky).",
      "en": "Papatūānuku — Earth-mother cosmology of the Māori frame (cross-reference to Pacific land ethics)."
    },
    "quote": "Když mě bereš jen jako teksturu terénu — přestane živit tvé město vzduchem.",
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
    "subtitle": "Sky Father",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "methane clarity overlays · **Quest:** Stratosphere Accountability Mirror · **Ability:** Skyfather Clarity Beam · **CL:** 5–9 · **NFT:** Legendary consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Skyfather Clarity Beam · CL: 5–9 · NFT: Legendary consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ranginui — potence nebes v kosmu Māori; paralela climate transparency overlayů.",
      "en": "Ranginui — sky potency of the Māori cosmos; a parallel to climate-transparency overlays."
    },
    "quote": "Když se nebesa vzdalují od země, není to rozvod bez lásky — je to prostor k dýchání dětí dvou říší.",
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
    "subtitle": "Forest Intercessor",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "biomass restoration raids · **Quest:** Kauri Biome Renewal · **Ability:** Canopy Lattice Buff · **CL:** 4–9 · **NFT:** Mythic consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Canopy Lattice Buff · CL: 4–9 · NFT: Mythic consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Táne — separator + nositel života, strážce lesa v rámu Māori (žádná glorifikace ilegální těžby).",
      "en": "Tāne — the separator + life-bringer, forest guardian of the Māori frame (no illegal-logging glorification arcs)."
    },
    "quote": "Strom je most — kořeny do Matky, koruna k Otci — stojící modlitba.",
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
    "subtitle": "",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "fisheries rāhui governance · **Quest:** Rāhui Season Toggle · **Ability:** Mana Moana Tide · **CL:** 3–8 · **NFT:** Mythic consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Mana Moana Tide · CL: 3–8 · NFT: Mythic consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Tangaroa — potence moře + etika rybolovu po způsobu Māori.",
      "en": "Tangaroa — sea potency + fisheries ethics in the Māori way."
    },
    "quote": "Nikdo nevlastní slaný proud — jen se učí lovit bez vyčerpání prarodičích.",
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
    "subtitle": "Peace & Cultivation",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "harvest diplomacy · **Quest:** Maketu Harvest Truce · **Ability:** Diplomatic Crop Share · **CL:** 2–7 · **NFT:** Rare consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Diplomatic Crop Share · CL: 2–7 · NFT: Rare consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Rongo — mír + kultivovaná jídla v rámu Māori, paralelně PvP ceasefire sezóny eticky.",
      "en": "Rongo — peace + cultivated foods of the Māori frame, paralleling ethical PvP ceasefire seasons."
    },
    "quote": "Ukáž válku dítěti — naučilo se jen hrát na vojáky. Ukáž mu brambory v zemi — chápe dílo obou ran.",
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
    "subtitle": "Whānau Defender",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "lawful protection war arcs only · **Quest:** Whānau Shield Wall · **Ability:** Haka Discipline Burst · **CL:** 5–9 · **NFT:** Mythic consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Haka Discipline Burst · CL: 5–9 · NFT: Mythic consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Tú — agentura konfliktu v rámu Māori, použitá jen jako oblouky ochrany.",
      "en": "Tū — the agency of conflict in the Māori frame, used only as protection arcs."
    },
    "quote": "Bojovat smím jen tam, kde stojím mezi dětmi ohroženými chaosem struktur.",
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
    "subtitle": "Storm winds resilience",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "topology stress lore · **Quest:** Topology Wind Tunnel · **Ability:** Gust Disperse · **CL:** 5–9 · **NFT:** Epic consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Gust Disperse · CL: 5–9 · NFT: Epic consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Táwhirimátea — archetyp větrů a bouří; OASIS jako resilience stress testy pro topologii sítě.",
      "en": "Tāwhirimātea — archetype of winds and storms; OASIS uses it as resilience stress tests for network topology."
    },
    "quote": "Když me bouřka nezasype prachem síní — jen vytřese prach zparchantělého světa.",
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
    "subtitle": "Wild foods stealth",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "stealth gather regrowth ethic · **Quest:** Forage Without Trace · **Ability:** Rootcloak · **CL:** 2–6 · **NFT:** Rare consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Rootcloak · CL: 2–6 · NFT: Rare consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Haumietiketike — nekultivovaná výživa v rámu Māori.",
      "en": "Haumietiketike — uncultivated sustenance of the Māori frame."
    },
    "quote": "To, co neroste v řádcích dokumentů — často léčí to, co řádné pole zapomnělo.",
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
    "subtitle": "Threshold transformation",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "ego death psych puzzle · **Quest:** Initiation Without Shame · **Ability:** Threshold Immunity vs FOMO · **CL:** 6–9 · **NFT:** Mythic anti-fetish review",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Threshold Immunity vs FOMO · CL: 6–9 · NFT: Mythic anti-fetish review",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Hine — práh podsvětí / transformace v kosmologii Māori.",
      "en": "Hine — underworld threshold / transformation in Māori cosmology."
    },
    "quote": "Nejsem konec jako trest — jen dveře, které nepustí zkaženost do neporušeného dítěte budoucnosti.",
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
    "subtitle": "Voyager cartography ethic",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "discovery / light-client bridge · **Quest:** Waka Node Handshake · **Ability:** Navigator’s Truth Wind · **CL:** 4–9 · **NFT:** Mythic consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Navigator’s Truth Wind · CL: 4–9 · NFT: Mythic consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Kupe — plavební brillance otevírající tradice waka Aotearoa v uctivých vzdělávacích rámcích.",
      "en": "Kupe — voyaging brilliance opening the Aotearoa waka traditions in respectful educational frames."
    },
    "quote": "Mapa je slib — zaznamenám jen to, co mohu vrátit zpět moři v respektu.",
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
    "subtitle": "River reciprocity òrìṣà",
    "ray": "RubyGold",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "humane liquidity / anti-burnout moderator buffs · **Quest:** River Wallet Reciprocity · **Ability:** Mirror Flow Benediction · **CL:** 3–8 · **NFT:** Mythic anti-fetish review",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Mirror Flow Benediction · CL: 3–8 · NFT: Mythic anti-fetish review",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ọṣun — reciprocita mezi komunitou a tokem (eko + sociální péče). V OASIS: narativ governance humanitárního likvidního poolu.",
      "en": "Ọṣun — reciprocity between community and flow (eco + social care). In OASIS: the humanitarian liquid-pool governance narrative."
    },
    "quote": "Voda neoslavuje tvou žízeň — jen se ptá: co jsi vrátil té, která tě už hostila?",
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
    "subtitle": "Thunder-order justice lore",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "strike corruption institutions only · **Quest:** Double-Spend Lightning Trial · **Ability:** Gavelstrike Purge · **CL:** 5–9 · **NFT:** Epic diaspora consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Gavelstrike Purge · CL: 5–9 · NFT: Epic diaspora consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ṣàngó — archetyp spravedlnosti a řádu s kulturním kontextem (královská genealogie narace citující akademické sekundární zdroje).",
      "en": "Ṣàngó — archetype of justice and order with cultural context (royal-genealogy narration citing academic secondary sources)."
    },
    "quote": "Hrom říká: ‚Nepřihnal jsem se — jen jsem odkryl strukturu lhářství.",
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
    "subtitle": "Calm-maker / elder craft",
    "ray": "White",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "infra readability & calm governance · **Quest:** White Clay Spec Review · **Ability:** Calm Kiln Shield · **CL:** 4–8 · **NFT:** Legendary initiatory-distance review",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Calm Kiln Shield · CL: 4–8 · NFT: Legendary initiatory-distance review",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ọ̀bàtálá — rámcová stabilita a etická práce s materiály (keramika města = paralela infra building v DAO).",
      "en": "Ọ̀bàtálá — framework stability and ethical work with materials (the city's ceramics = a DAO infrastructure-building parallel)."
    },
    "quote": "Kdo tvoří v tranzu vzteku — nevytvoří město — jen díru v městě.",
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
    "subtitle": "Wind-crossing refactor",
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "humane migration arcs · **Quest:** Market Crosswind Pivot · **Ability:** Gale Reconcile · **CL:** 5–9 · **NFT:** Epic glamour-ban review",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Gale Reconcile · CL: 5–9 · NFT: Epic glamour-ban review",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ọya — rámcová adaptace (migrace uživatelů mezi shardy, refaktoring legacy kontraktů morálně).",
      "en": "Ọya — a framework adaptation (migrating shard users, refactoring legacy contracts morally)."
    },
    "quote": "Když vítr zvedne střechu — nechť odhalí jen shnilé trámy, ne sousedy.",
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
    "subtitle": "Fon cosmology dual stewardship",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "alternating listening governance · **Quest:** Split Mandate Sunset · **Ability:** Equinox Lock · **CL:** 6–9 · **NFT:** Rare consult Benin-region framing",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Equinox Lock · CL: 6–9 · NFT: Rare consult Benin-region framing",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Duální princip kreativního napětí — OASIS metaforicky dual-rail governance (ne efektní gender-war frakce).",
      "en": "The dual principle of creative tension — OASIS metaphorically uses dual-rail governance (not a gimmicky gender-war faction)."
    },
    "quote": "Když slunce řídí rytmus a noc drží měřák ticha — teprve pak je svět použitelný, ne jen horký.",
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
    "subtitle": "Akan high-god pedagogical compass",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "laconic truthful proposals · **Quest:** Thin Ice Oracle Proposals · **Ability:** High God Hush (spam proposal cooldown lore) · **CL:** 5–9 · **NFT:** Rare consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "High God Hush (spam proposal cooldown lore) · CL: 5–9 · NFT: Rare consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Koncept Nejvyššího v akan teologických popisech použit jako minimal-theology governance („méně dramatu, více naslouchání“).",
      "en": "The concept of the Supreme Being in Akan theological descriptions, used as minimal-theology governance ('less drama, more listening')."
    },
    "quote": "Jestli říkám ‚on‘ — rozumím tím jen pravidlu, které nepotřebuje řvát.",
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
    "subtitle": "Story-weaver pedagogy",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "revelation via narrative puzzle · **Quest:** Web-of-Forks Parable · **Ability:** Thread Insight · **CL:** 2–8 · **NFT:** Rare diaspora VO + writer consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Thread Insight · CL: 2–8 · NFT: Rare diaspora VO + writer consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ananse jako narativní mistr odhalující slepá místa moci (pedagogika „malé lži → velké pravdy“).",
      "en": "Ananse as the narrative master exposing power's blind spots ('small lies → big truths' pedagogy)."
    },
    "quote": "Lhát smím jen proto, aby se šlo ke kořeni — ne abych někoho spálil.",
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
    "subtitle": "Kemetic cyclic renewal ethics",
    "ray": "Green",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "humane chain restart symbolism · **Quest:** Green Renewal Hardfork Ritual · **Ability:** Verdant Revival Mark · **CL:** 5–9 · **NFT:** Mythic museum-repat framing",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Verdant Revival Mark · CL: 5–9 · NFT: Mythic museum-repat framing",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ausar-Osiris — cyklické obrozování institucí po selhání (paralela DAO phoenix lore).",
      "en": "Ausar-Osiris — cyclical renewal of institutions after failure (a DAO phoenix-lore parallel)."
    },
    "quote": "Země mě nepohřbívá jako konec — jako semeno, které se nejdřív naučilo poslouchat řeku.",
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
    "subtitle": "Feather tribunal / integrity voting",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "DAO truth-game pedagogy · **Quest:** Featherweighted Vote Replay · **Ability:** Scale Reveal Overlay · **CL:** 4–9 · **NFT:** Epic consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Scale Reveal Overlay · CL: 4–9 · NFT: Epic consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Maʿăt — archetyp pravdivého vyvážení rozhodnutí kolektivů (symbolika bez mystifikace RNG jako „orákla“).",
      "en": "Maʿăt — the archetype of truthful balancing of collective decisions (symbolism without mystifying RNG as an 'oracle')."
    },
    "quote": "Když péro klesá — řekni si, co jsi v propozici zamlčel více než pravdu.",
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
    "subtitle": "Ndongo–Matamba resistance diplomat",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "asymmetrical negotiation vs empire lore · **Quest:** Ambush Treaty Table Flip · **Ability:** Strategic Bluff Counter · **CL:** 5–9 · **NFT:** Mythic historians + Angola/diaspora consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Strategic Bluff Counter · CL: 5–9 · NFT: Mythic historians + Angola/diaspora consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Njinga — archetyp asymetrického odporu + vyjednávací stamina (anti-koloniální extraktivní struktury jako narativní antagonisté).",
      "en": "Njinga — archetype of asymmetric resistance + negotiation stamina (anti-colonial extractive structures as narrative antagonists)."
    },
    "quote": "Nepřišla jsem tě pobavit válčení — jen ukázat vládkyni, která umí odolat válce, aby přežilo dětství města.",
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
    "subtitle": "Ring steward / eldest king frame",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "multi-region consensus hubris check · **Quest:** Ring Steward Audit · **Ability:** Axis Lock Beacon · **CL:** 5–9 · **NFT:** Epic + classics disclaimer metadata",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Axis Lock Beacon · CL: 5–9 · NFT: Epic + classics disclaimer metadata",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Atlas — koordinační střed deseti oblastních mandátů jako metafora konsenzu ostrovní sítě (pedagogika staking regionů / shard governance).",
      "en": "Atlas — the coordinating center of ten regional mandates as a metaphor for island-network consensus (staking regions / shard governance pedagogy)."
    },
    "quote": "Když stojí král vprostřed kruhu, není to pýcha — jen bod, kde se měří, zda všechna ramena mohou táhnout bez přetržení řetězu.",
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
    "subtitle": "*Kleitó* sanctuary consent",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "transparent charter / anti-stealth governance patch · **Quest:** Moat Charter Draft · **Ability:** Sanctuary Pause · **CL:** 4–8 · **NFT:** Epic + anti-fetish portrayal review",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Sanctuary Pause · CL: 4–8 · NFT: Epic + anti-fetish portrayal review",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Cleito — archeologie souhlasu: centrum říše jako místo, kde se zákon rodí ze souhlasu terénu, ne ze skryté manipulace.",
      "en": "Cleito — consent archaeology: the empire's center as the place where law is born from the consent of the terrain, not from hidden manipulation."
    },
    "quote": "Bažina nejdřív schovávala měkké — teprve když v ní uslyšíš vlastní měkkost legislativy, začne ostrůvek držet.",
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
    "subtitle": "Harbor-ring / strait ethics",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "bridge etiquette & fair port fees lore · **Quest:** Strait Handshake Trials · **Ability:** Tithe Gate Buffer · **CL:** 4–9 · **NFT:** Epic disclaimer",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Tithe Gate Buffer · CL: 4–9 · NFT: Epic disclaimer",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Gadeirus — interoperabilita přístavu: most mezi ostrůvkem „vnitřního“ trhu a kontinentální kritikou (bridge ethics).",
      "en": "Gadeirus — harbor interoperability: a bridge between the islet of the 'inner' market and continental critique (bridge ethics)."
    },
    "quote": "Kdo spravuje bránu, nesmí mít jen klíč — musí mít i měřidlo víry v to, že loď sama neklame.",
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
    "subtitle": "Proportional loadshare",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "emissions / subsidy fairness vignettes · **Quest:** Load Shed Covenant · **Ability:** Equity Ripple · **CL:** 3–8 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Equity Ripple · CL: 3–8 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ampheres — governance bez predátorského realloc (pedagogika fair emission / subsidy).",
      "en": "Ampheres — governance without predatory realloc (fair emission / subsidy pedagogy)."
    },
    "quote": "Když kruh roste, největší hřích není lakomství na středu — ale skryté přenesení váhy jen na jedno rameno.",
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
    "subtitle": "Good-custom law etiquette",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "fork etiquette / community conduct teaching · **Quest:** Fork Etiquette Theater · **Ability:** Grace Window · **CL:** 2–7 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Grace Window · CL: 2–7 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Evaemon — měkké právo komunity: reputace, etiketa commitů, férový code of conduct.",
      "en": "Evaemon — the soft law of community: reputation, commit etiquette, a fair code of conduct."
    },
    "quote": "Zvyk bez soucitu zkamení jako socha; zákon bez zvyku se rozbije jako prázdný amfor.",
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
    "subtitle": "Chain memory archives",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "changelog integrity debates · **Quest:** Ledger Lineage Exhibit · **Ability:** Replay Oracle · **CL:** 4–9 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Replay Oracle · CL: 4–9 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Mneseus — state root storytelling: integrita historie, changelog, audit trails.",
      "en": "Mneseus — state-root storytelling: integrity of history, changelog, audit trails."
    },
    "quote": "Zmizet může jen to, co sis nikdy nezapsal s datem a jménem svědka — jinak jen spíš v mlze marketingu.",
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
    "subtitle": "Local-first legitimacy",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "biome / local-node sovereignty folklore · **Quest:** Soil-signed Charter · **Ability:** Rooted Resilience · **CL:** 3–8 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Rooted Resilience · CL: 3–8 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Autochthon — suverenita místa: biome governance, důvtip lokální infrastruktury.",
      "en": "Autochthon — sovereignty of place: biome governance, local infrastructure ingenuity."
    },
    "quote": "Legitimita, která nepřišla z kořenů půdy, je jen turistická vláda — hezká foto, bez deště.",
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
    "subtitle": "Routing cadence fairness",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "mempool / throughput pedagogy sans barbarism caricature · **Quest:** Harbor Rhythm Puzzle · **Ability:** Throttle Charm · **CL:** 3–8 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Throttle Charm · CL: 3–8 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Elasippus — fair mempool / traffic shaping narativ bez démonizace „outsiderů“.",
      "en": "Elasippus — a fair mempool / traffic-shaping narrative without demonizing 'outsiders'."
    },
    "quote": "Nepřetahuj kopyta ani kabely — teprve rytmus táhne dál než síla.",
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
    "subtitle": "Accord mediator",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "facilitator between stakeholder rings · **Quest:** Dual Ring Summit · **Ability:** Compromise Glyph · **CL:** 4–9 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Compromise Glyph · CL: 4–9 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Mestor — facilitace mezisektorového kompromisu (lore stakerů vs. builderů).",
      "en": "Mestor — facilitation of cross-sector compromise (stakers vs. builders lore)."
    },
    "quote": "Když oba kruhy křičí pravdu, meditátor nesmí umlčet fakta — jen je přeloží do jazyka vzájemnosti.",
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
    "subtitle": "Risk-bound explorer",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "graceful stress-test island narrative · **Quest:** Azimuth Stress Test Island · **Ability:** Boundary Ping · **CL:** 5–9 · **NFT:** Epic hubris-education tag",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Boundary Ping · CL: 5–9 · NFT: Epic hubris-education tag",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Azaes — explorativní governance: testování limitů sítě s fail-safe a etickým hlášením škody.",
      "en": "Azaes — exploratory governance: testing the network's limits with fail-safes and ethical damage reporting."
    },
    "quote": "Mapa není territoire k prodeji — je to varování, jak daleko ještě žiješ, než se mlha vrátí.",
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
    "subtitle": "Biodiversity-before-babel Madagascar frame",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "primát / ekosystém priorita nad conspiracy economy · **Quest:** Phantom vs Field Notes · **Ability:** Primate Clarity Buff · **CL:** 3–8 · **NFT:** Rare + env donate tag suggested",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Primate Clarity Buff · CL: 3–8 · NFT: Rare + env donate tag suggested",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Lemur Steward — prioritizační etika výzkumu: živý ekosystém před kartami „ztraceného zlata pravdy“.",
      "en": "Lemur Steward — research prioritization ethics: the living ecosystem before 'lost gold of truth' cards."
    },
    "quote": "Kdo miluje bájný kontinent víc než živého lemura v lese, necvičí moudrost — jen turistické zamlžení.",
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
    "subtitle": "Hypothesis retractions pedagogy",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "humility of obsolete maps · **Quest:** Hall of Retracted Hypotheses · **Ability:** Paper Recall Aura · **CL:** 4–9 · **NFT:** Rare (no heroic scientist cult art)",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Paper Recall Aura · CL: 4–9 · NFT: Rare (no heroic scientist cult art)",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Sclater Bridge — etiketa retractace: jak veřejně opravit hypotézu bez hanby komunity.",
      "en": "Sclater Bridge — retraction etiquette: how to publicly correct a hypothesis without shaming the community."
    },
    "quote": "Nejlepší atlas je ten, kde staré linky nevymazávají ostrůvky současnosti — jen se k nim omluvně vracejí.",
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
    "subtitle": "Reef accountability witness",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "coral stress vs DAO witness metaphor · **Quest:** Bleach Event Tribunal · **Ability:** Symbiosis Witness · **CL:** 4–9 · **NFT:** Epic + climate org tagging",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Symbiosis Witness · CL: 4–9 · NFT: Epic + climate org tagging",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Coral Notary — climate-accountability overlay v měkké lore (ne gratuitní doom-scrolling).",
      "en": "Coral Notary — climate-accountability overlays in soft lore (not gratuitous doom-scrolling)."
    },
    "quote": "Kdo zapisuje bělmo korálu jen jako grafiku dungeonu, ani nezačne slyšet, co reef říká investorům o čase.",
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
    "subtitle": "Fair tidal rhythm / mempool equity lore",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "small participant fairness arcs · **Quest:** High Tide Liquidity Fairshare · **Ability:** Ebb Rebate · **CL:** 3–8 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Ebb Rebate · CL: 3–8 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Tide Column — rhythm fairness: sdílené sloty bez monopolu „high-water mark“ hráče.",
      "en": "Tide Column — rhythm fairness: shared slots without a 'high-water mark' player monopoly."
    },
    "quote": "Když stoupá voda, nestihneš jen stížnosti — měříš kolik bran mělo zůstat otevřených všem.",
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
    "subtitle": "MORB / ridge basalt geology honesty",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "lithosphere pacing without Atlantis grind · **Quest:** Basalt Classroom Trail · **Ability:** Stratum Proof · **CL:** 4–9 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Stratum Proof · CL: 4–9 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Basalt Chronicle — deep-time poctivost pro protokolové dokumenty (immutable ≠ dogma).",
      "en": "Basalt Chronicle — deep-time honesty for protocol documents (immutable ≠ dogma)."
    },
    "quote": "Kdo kámen čte jen jako měnu, necítí tep plotny — proto mu unikne, kde se láme řád.",
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
    "subtitle": "Dispersal ethics without colonial map",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "onboarding consent vs settlers fantasy · **Quest:** Foam Landing Consent Pack · **Ability:** Drift Brake · **CL:** 3–8 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Drift Brake · CL: 3–8 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Foam Seed — governance mezi hostem a domovem bez extractive settlers fantasy.",
      "en": "Foam Seed — governance between guest and home without an extractive-settlers fantasy."
    },
    "quote": "Semínko nesmí lhát o kraji odkud táhne vítr — jinak se z něj udělá bič na hosty.",
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
    "subtitle": "Pacific solidarity scaffold",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "alliances without overwriting Indigenous arcs · **Quest:** Relay Fleet Without Theft · **Ability:** Solidarity Lantern · **CL:** 4–9 · **NFT:** Epic + cross-consult metadata",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Solidarity Lantern · CL: 4–9 · NFT: Epic + cross-consult metadata",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Oceanic Bridge — choreografie koalice bez „meta-mother culture“ nahrazující lokální pravdu.",
      "en": "Oceanic Bridge — coalition choreography without a 'meta-mother culture' replacing local truth."
    },
    "quote": "Most znamená: přines proviant a poslechni pobřeží — ne: přesuň jejich zpěv na své logo.",
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
    "subtitle": "Shelf subsidence realism",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "coastline risk truth-telling · **Quest:** SLR Scenario Tabletop · **Ability:** Bathyal Shield · **CL:** 5–9 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Bathyal Shield · CL: 5–9 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Shelf Whisper — realismus subsidence: riziko pobřeží, měst, infrastruktury — žádná white-utopia.",
      "en": "Shelf Whisper — subsidence realism: the risk to coasts, cities, infrastructure — no white utopia."
    },
    "quote": "Shelf šeptá spíše o teplotě vody než o kartách říší — přesně tam začíná odpovědnost.",
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
    "subtitle": "Volatility moderation at thresholds",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "DAO timelock / panic dampening folklore · **Quest:** Equinox Voting Cooldown Ritual · **Ability:** Libration Hush · **CL:** 3–8 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Libration Hush · CL: 3–8 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Equinox Lull — anti-extremistický rytmus: zpomalení rozhodnutí při volatilitě.",
      "en": "Equinox Lull — an anti-extremism rhythm: slowing decisions down amid volatility."
    },
    "quote": "Když den a noc váží stejně, pamatuj že trh jen předstírá váhu všem stejně.",
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
    "subtitle": "Meta-bridge tee to cosmic wave",
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "handoff narration to cosmology archetypes **#172+** · **Quest:** Handoff Constellation Stub · **Ability:** Next-Wave Invitation *(cosmetic unlock, no race-coded art)* · **CL:** 4–9 · **NFT:** Mythic + zero hierarchic trope audit",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Next-Wave Invitation *(cosmetic unlock, no race-coded art)* · CL: 4–9 · NFT: Mythic + zero hierarchic trope audit",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Circle Closure — diegetický readme: hráče nasměruje ke kosmické vlně archetypů bez deprecating předchozích consult-gated kultur.",
      "en": "Circle Closure — a diegetic readme: points players to the cosmic wave of archetypes without deprecating earlier consult-gated cultures."
    },
    "quote": "Když zemské kruhy drhnou jen o vodu a kámen, zbývá pohlédnout výš — aniž bys pohrdl blátem.",
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
    "subtitle": "Cosmic clock / consensus frame",
    "ray": "White",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "single logical tempo / DAO alignment lore · **Quest:** Radial Sync Briefing · **Ability:** Corona Consensus Pulse · **CL:** 5–9 · **NFT:** Legendary + non-medical metadata",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Corona Consensus Pulse · CL: 5–9 · NFT: Legendary + non-medical metadata",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "GC Sun Steward — single logical clock lore: tempo DAO v souladu s planetární tíhou v pozadí.",
      "en": "GC Sun Steward — single logical clock lore: DAO tempo in tune with planetary weight in the background."
    },
    "quote": "Když řekneš ‚jeden zdroj‘, měl by to být slib ke koordinaci péče — ne k tomu, abys někoho za plot nechal.",
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
    "subtitle": "Photon-belt gates as season pacing only",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "anti-hype burnout / ethical releases · **Quest:** Gate Rollout Ethics Table · **Ability:** Chromatic Cooldown · **CL:** 4–9 · **NFT:** Epic + DNA non-claim disclaimer",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Chromatic Cooldown · CL: 4–9 · NFT: Epic + DNA non-claim disclaimer",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Photon Cadence — metafora sezónních release kapitol: etika nevyčerpávat komunitu „branami“ hype.",
      "en": "Photon Cadence — a seasonal chapter-release metaphor: the ethics of not exhausting the community with hype 'gates'."
    },
    "quote": "Když bránu proklikáváš jen kvůli rychlosti, pamatuj že i demokracii musí někdo hlídat lidským tempem.",
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
    "subtitle": "Helios/Vesta-style dual signing metaphor",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "cold+hot multisig personalities · **Quest:** Helios-Vesta multisig lore · **Ability:** Twin Ray Buffer · **CL:** 4–9 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Twin Ray Buffer · CL: 4–9 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Solar Logos Dual — dual signing lore: multisig, kde cold + hot osobnosti komunikují.",
      "en": "Solar Logos Dual — dual-signing lore: a multisig where cold + hot personas communicate."
    },
    "quote": "Dvě pochodně na jedné věži neznamenají dvě pravdy — jen dva směry větru, které musí znát stejný strážce.",
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
    "subtitle": "Planetary soul bridge; cross #25 Lady Gaia",
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "regen side arcs tied to Gaia storyline · **Quest:** Soil-RPC Handshake · **Ability:** Humus Handoff · **CL:** 3–8 · **NFT:** Epic + cross-story note",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Humus Handoff · CL: 3–8 · NFT: Epic + cross-story note",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Telluric Soul Bridge — staking Earth narativ: regen econ side-questy paralelní Gaia obloukům.",
      "en": "Telluric Soul Bridge — the staking-Earth narrative: regen-econ side quests parallel to Gaia arcs."
    },
    "quote": "Když mluvíš se zemí jen jako s účtem, dostaneš ledger. Když ji posloucháš jako s hostem v domě, dostaneš půdu pod nohama.",
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
    "subtitle": "OPSEC visual from Vzestup practice names",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "wallet hygiene / scam resistance · **Quest:** Column Audit Walkthrough · **Ability:** Phishing Bloom Purge · **CL:** 3–8 · **NFT:** Rare + wellness non-claims",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Phishing Bloom Purge · CL: 3–8 · NFT: Rare + wellness non-claims",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Tube-of-Light Sentinel — vizualizace OPSEC: hráči mapují attack surface v lore UI.",
      "en": "Tube-of-Light Sentinel — OPSEC visualization: players map the attack surface in the lore UI."
    },
    "quote": "Světelný vál neudělá firewall sám od sebe — ale připomene ti, kde máš vlastní.",
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
    "subtitle": "Guild XP spiral — not body claims",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "reputation for mentoring not grind · **Quest:** Spiral Reputation refactor · **Ability:** Vortex Mentor Mark · **CL:** 2–9 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Vortex Mentor Mark · CL: 2–9 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Radiant Spiral — reputační spirála: XP za užitečnou práci, ne za grind bez přínosu.",
      "en": "Radiant Spiral — the reputation spiral: XP for useful work, not for grind without benefit."
    },
    "quote": "Nechť každá otáčka spirály znamená účet práce udělané někomu dalšímu — ne jen další prestige level.",
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
    "subtitle": "Violet frequency UI next to Saint Germain #26",
    "ray": "Violet",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "transmutation systems vs duplicate master · **Quest:** Stacked Violet Tutorial · **Ability:** Karma Scrub Cosmetic · **CL:** 4–9 · **NFT:** Epic + coexistence with #26",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Karma Scrub Cosmetic · CL: 4–9 · NFT: Epic + coexistence with #26",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Seventh Ray Adjunct — transmutation stack lore: měň spam grief na burn fee výchovu.",
      "en": "Seventh Ray Adjunct — transmutation-stack lore: turn spam grief into burn-fee education."
    },
    "quote": "Když už máš Mistra Violetu, necvič konkureční obchod — cvič alchymii komuniké.",
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
    "subtitle": "Galactic Federation parliament — tiered mandates, not Earth-ethnic ranking",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "inter-guild federation + institucionalizovaná hierarchie viz [`docs/TerraNova/cosmic/GALAKTICKA_FEDERACE.md`](../../TerraNova/cosmic/GALAKTICKA_FEDERACE.md) · **Quest:** Protocol Parliament Session (+ optional Federation Tier Audit) · **Ability:** Orbit Silence · **CL:** 4–9 · **NFT:** Epic + GF art/copy gate",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Orbit Silence · CL: 4–9 · NFT: Epic + GF art/copy gate",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Galactic Convenor — mezihvězdný parlament: facilituje stupně federace (charta → rada → plénum → vyslanectví → občanský prstenec) jako paralelu k DAO delegaci + veto.",
      "en": "Galactic Convenor — the interstellar parliament: facilitates the degrees of federation (charter → council → plenum → envoi → civic ring) as a parallel to DAO delegation + veto."
    },
    "quote": "Federace není stupnice kdo má lepší krev — jen smlouva mezi systémy, kde menšiny mají právo zpomalit válku.",
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
    "subtitle": "Journaling only — no therapeutic NFT",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "privacy / delete-my-data lore · **Quest:** Right To Be Forgotten Constellation · **Ability:** Ledger Amnesia Token · **CL:** 2–8 · **NFT:** Rare + wellness disclaimer",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Ledger Amnesia Token · CL: 2–8 · NFT: Rare + wellness disclaimer",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Lightbody Scribe — revokovatelné journaling: hráči se učí GDPR / delete-my-data přes lore.",
      "en": "Lightbody Scribe — revocable journaling: players learn GDPR / delete-my-data through lore."
    },
    "quote": "Co si zapíšeš jako quest log, měj právo později smazat — transformace nesmí být doživotní billboard.",
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
    "subtitle": "13th expansion decad closure → COSMIC_MAP",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "doc hub pointer / meta navigation · **Quest:** Return Vector: COSMIC_MAP.md · **Ability:** Map Bookmark · **CL:** 6–9 · **NFT:** Mythic + meta only",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Map Bookmark · CL: 6–9 · NFT: Mythic + meta only",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Vzestup Capstone — meta waypoint zpět na docs COSMIC MAP a Golden Egg design odkazy.",
      "en": "Vzestup Capstone — a meta waypoint back to the COSMIC MAP docs and Golden Egg design references."
    },
    "quote": "Když dojdeš na konec hvězdné řady, nevěř že už znáš nebe — jen že máš kde rozvinout novou mapu.",
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
    "subtitle": "Einherjar etiquette / rest cycle — not afterlife theology",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "guild hall host + anti-burnout pacing · **Quest:** Einherjar Etiquette Table · **Ability:** Roast-Rest Cycle · **CL:** 4–9 · **NFT:** Epic + Heathenry-informed consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Roast-Rest Cycle · CL: 4–9 · NFT: Epic + Heathenry-informed consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Valhalla v eddickém poli je síň Óðinových einherjar — den boje, noc hostiny. V OASIS tento archetyp neslibuje posmrtnou odměnu; učí obnovu týmu, pravidla ringu a anti-burnout rytmus mezi „raidem“ a regenerací.",
      "en": "Valhalla in the Eddic field is the hall of Óðinn's einherjar — days of battle, nights of feasting. In OASIS this archetype promises no afterlife reward; it teaches team recovery, rules of the ring, and an anti-burnout rhythm between 'raid' and regeneration."
    },
    "quote": "Kdo se vrací ke stolu — nechť neponižuje hosta u prahu.",
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
    "subtitle": "Governance raven-log / fork review",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "multisig wisdom + public argument · **Quest:** Huginn Diff / Muninn Merge · **Ability:** One-Eye Focus · **CL:** 5–9 · **NFT:** Legendary + hate-symbol ban on runes",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "One-Eye Focus · CL: 5–9 · NFT: Legendary + hate-symbol ban on runes",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Óðinn v pramenech spojuje válečnou aristokracii, věštbu a básnickou moc. V OASIS = mentor governance a audit řeči (havraní zpráva = log trace), bez rasových dogwhistlů kolem run.",
      "en": "Óðinn in the sources combines warrior aristocracy, prophecy and poetic power. In OASIS = mentor of governance and audit of speech (the raven report = log trace), without racial dog-whistles around the runes."
    },
    "quote": "Kdo platí za pravdu vědomím — nechť neprodává jméno hostu.",
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
    "subtitle": "Uptime / community safety — not toxic alpha trope",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "infra resilience + rate limits · **Quest:** Mjölnir Rate-Limit · **Ability:** Chain Lightning Purge · **CL:** 3–9 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Chain Lightning Purge · CL: 3–9 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Þórr je v pramenech ochránce bohů a lidí proti chaotickým silám, patron počasí a svateb/hostin. V OASIS = DDoS/spam odolnost, zdraví uzlů, community safety toggles.",
      "en": "Þórr is in the sources the protector of gods and humans against chaotic forces, patron of weather and weddings/feasts. In OASIS = DDoS/spam resilience, node health, community safety toggles."
    },
    "quote": "Kdo drží kladivo — ať nesestřelí vlastní bránu.",
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
    "subtitle": "Fair treasury + privacy lore — no sexualized combat",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "escrow fairness + encryption metaphor (seiðr as data care) · **Quest:** Brisingamen Escrow · **Ability:** Falcon Trace · **CL:** 4–9 · **NFT:** Epic + metadata parity check",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Falcon Trace · CL: 4–9 · NFT: Epic + metadata parity check",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Freyja v pramenech spojuje válečné poloviny padlých, seiðr a plodnost/zlato. V OASIS = spravedlivé odměny validátorů, privacy-preserving magie dat (seiðr jako encryption lore), respekt k genderové pluralitě pramenů.",
      "en": "Freyja in the sources combines the warrior's share of the slain, seiðr and fertility/gold. In OASIS = fair validator rewards, privacy-preserving data magic (seiðr as encryption lore), respect for the gender plurality of the sources."
    },
    "quote": "Kdo nosí náhrdelník z dohod — nechť nezapomene na podíl řemeslníků.",
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
    "subtitle": "Timelock sacrifice / smart-contract honor",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "oath-bound upgrades · **Quest:** Fenrir Timelock · **Ability:** Oath-Burn Seal · **CL:** 5–9 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Oath-Burn Seal · CL: 5–9 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Týr v Gylfaginning položí ruku do tlamy Fenrira, aby smlouva držela. V OASIS = immutable commitment + timelock oběti (symbolicky „prst“ = část stake pro audit).",
      "en": "Týr in Gylfaginning places his hand in Fenrir's jaws so the pact holds. In OASIS = immutable commitment + timelock sacrifice (symbolically the 'hand' = a portion of stake held for audit)."
    },
    "quote": "Kdo krmí vlka — ať nečeká, že řetěz zůstane celý bez ceny.",
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
    "subtitle": "Forge / docs / care — syncretism disclaimer",
    "ray": "White",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "open tooling + translations · **Quest:** Forge Docs Sprint · **Ability:** Triple-Wick Focus · **CL:** 2–8 · **NFT:** Epic + non-medical wellness",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Triple-Wick Focus · CL: 2–8 · NFT: Epic + non-medical wellness",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Brigid v irských pramenech spojuje řemeslo, léčení a poezii. V OASIS = open tooling, dokumentace a community care — ne léčebná NFT tvrzení (viz globální wellness ban).",
      "en": "Brigid in the Irish sources joins craft, healing and poetry. In OASIS = open tooling, documentation and community care — not healing NFT claims (see the global wellness ban)."
    },
    "quote": "Kdo ková řetěz — ať přidá i klíč k opravě.",
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
    "subtitle": "Public goods / epoch spacing",
    "ray": "Green",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "sustainable emissions + commons refill · **Quest:** Undry Cauldron Refill · **Ability:** Harp Lull · **CL:** 3–9 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Harp Lull · CL: 3–9 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Dagda v irských cyklech nese kotel, palici a harfu — spojuje válečnou připravenost s obnovou míru. V OASIS = sustainable emissions, epoch spacing, public goods fond.",
      "en": "The Dagda in the Irish cycles carries cauldron, club and harp — combining war-readiness with peace restoration. In OASIS = sustainable emissions, epoch spacing, public goods fund."
    },
    "quote": "Kdo ladí struny — ať netáhne řetěz jen jedním směrem.",
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
    "subtitle": "Threat triage — mandatory art consult",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "responsible disclosure + governance veto vs attacks · **Quest:** Battle Crow Triage · **Ability:** Phantom Stratagem · **CL:** 6–9 · **NFT:** Mythic + Kālī-tier art gate",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Phantom Stratagem · CL: 6–9 · NFT: Mythic + Kālī-tier art gate",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Morrígan v irských textech spojuje válku, věštbu a svrchovanost — figuruje v Táin Bó Cúailnge a souvisejících vrstvách. V OASIS = threat modeling, responsible disclosure, governance veto proti útokům na síť.",
      "en": "Morrígan in the Irish texts joins war, prophecy and sovereignty — figuring in the Táin Bó Cúailnge and related layers. In OASIS = threat modeling, responsible disclosure, governance veto against attacks on the network."
    },
    "quote": "Kdo slyší havrana — ať nepřekřikuje hlas země.",
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
    "subtitle": "Multi-skill multisig / mentor rotation",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "cross-stack competence without hero worship · **Quest:** Tailtiu Field Day · **Ability:** Many-Skill Attune · **CL:** 3–9 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Many-Skill Attune · CL: 3–9 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Lugh v irských pramenech vítězí v Táin jako polymat — patron Lughnasadh (sklizeň/shromáždění). V OASIS = rotace multi-sig rolí, mentor program napříč moduly (L1/pool/docs).",
      "en": "Lugh in the Irish sources wins in the Táin as a polymath — patron of Lughnasadh (harvest/assembly). In OASIS = multi-sig role rotation, a mentor program across modules (L1/pool/docs)."
    },
    "quote": "Kdo ovládá devět řemesel — ať deváté je naslouchání.",
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
    "subtitle": "Sandbox / mist boundaries between chains",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "testnet isolation + feature flags · **Quest:** Cloak of Nine Shadows · **Ability:** Mist Veil · **CL:** 4–9 · **NFT:** Rare + no Atlantis conflation",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Mist Veil · CL: 4–9 · NFT: Rare + no Atlantis conflation",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Manannán v irských cyklech vládne moři a mlžným prahům mezi světy. V OASIS = segmentace sítě, feature flags, disciplína staging → mainnet.",
      "en": "Manannán in the Irish cycles rules the seas and the misty thresholds between worlds. In OASIS = network segmentation, feature flags, staging → mainnet discipline."
    },
    "quote": "Kdo pluje mlhou — ať má maják v dokumentaci.",
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
    "subtitle": "Epoch heartbeat / anti-FOMO pacing",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "block time transparency · **Quest:** Barque Handoff Briefing · **Ability:** Zenith Clear · **CL:** 4–9 · **NFT:** Legendary + Egyptology consult",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Zenith Clear · CL: 4–9 · NFT: Legendary + Egyptology consult",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ré jako sluneční bůh ve faraonské kosmologii pojí den, cyklus a řád. V OASIS = disciplína block time, transparentní epochy, anti-FOMO release rytmus.",
      "en": "Ré as the sun god in pharaonic cosmology binds day, cycle and order. In OASIS = block-time discipline, transparent epochs, anti-FOMO release rhythm."
    },
    "quote": "Kdo řídí barku — ať nezatmaví palubní logy ze strachu.",
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
    "subtitle": "Double-crown governance; cross #149 Osiris",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "multisig legitimacy across regions · **Quest:** Double Crown Multisig · **Ability:** Udjat Watch · **CL:** 5–9 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Udjat Watch · CL: 5–9 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Hor v klasické mytologii ztělesňuje královskou legitimitu, ochranu otce Usira a jednotu země. V OASIS = governance charter, multi-region konsensus, escrow ochrana treasury.",
      "en": "Hor in classical mythology embodies royal legitimacy, protection of his father Osiris and the unity of the land. In OASIS = governance charter, multi-region consensus, escrow protection of the treasury."
    },
    "quote": "Kdo nosí dvojí korunu — ať nezapomene na oba břehy.",
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
    "subtitle": "Merkle / changelog integrity",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "audit trail + honest timestamps · **Quest:** Ibis Ledger Review · **Ability:** Reed-Pen Attest · **CL:** 3–9 · **NFT:** Epic + no gibberish-hieroglyph UI",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Reed-Pen Attest · CL: 3–9 · NFT: Epic + no gibberish-hieroglyph UI",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Thovt (Djehuty) spojuje písmo, moudrost a soudní záznam. V OASIS = Merkle důkazy, changelog, audit trail bez manipulace timestampů.",
      "en": "Thoth (Djehuty) joins writing, wisdom and the judicial record. In OASIS = Merkle proofs, changelog, audit trail without timestamp manipulation."
    },
    "quote": "Kdo váží slova — ať neukradne váhu druhému commitu.",
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
    "subtitle": "Community celebration / anti-spam fests",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "safe social events layer · **Quest:** Sistrum Noise Budget · **Ability:** Menat Shield · **CL:** 2–8 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Menat Shield · CL: 2–8 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Hathor spojuje nebeskou krávu, hudbu, tanec a milost. V OASIS = oslavy komunity, bezpečné sociální eventy, anti-burnout party vrstva (bez monetizovaných „rituálů“).",
      "en": "Hathor joins the celestial cow, music, dance and grace. In OASIS = community celebration, safe social events, an anti-burnout party layer (no monetized 'rituals')."
    },
    "quote": "Kdo tančí v síni — ať nešlape na hrdlo zpěváka.",
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
    "subtitle": "Slashing + cooling debrief — art gate",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "penalty vault + post-incident peace · **Quest:** Beer of Cooling Patch · **Ability:** Solar Wound Audit · **CL:** 6–9 · **NFT:** Mythic + Kālī-tier art review",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Solar Wound Audit · CL: 6–9 · NFT: Mythic + Kālī-tier art review",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Sachmet spojuje válečnou zuřivost a ochranu řádu; mýtus opojení pivem jako ukojení. V OASIS = slashing podmínky, penalty vault, cooling po incidentu — ne glorifikace genocidy.",
      "en": "Sekhmet joins warlike fury and the protection of order; the myth of her beer-drunkenness as appeasement. In OASIS = slashing conditions, penalty vault, post-incident cooling — no glorification of genocide."
    },
    "quote": "Kdo pije pivo míru — ať neuhasí oheň auditu.",
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
    "subtitle": "Genesis bytecode / factory safety",
    "ray": "Green",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "contract templates + reproducible builds · **Quest:** Memphis Template Forge · **Ability:** Mummiform Seal · **CL:** 4–9 · **NFT:** Epic",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Mummiform Seal · CL: 4–9 · NFT: Epic",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Ptah je patron řemesla, architekt a tvůrce v memfidské teologii. V OASIS = genesis konfigurace, smart contract šablony, bezpečné factory patterny.",
      "en": "Ptah is the patron of craft, the architect and creator in Memphite theology. In OASIS = genesis configuration, smart-contract templates, safe factory patterns."
    },
    "quote": "Kdo tvoří z hlíny — ať nezapomene na měřítko.",
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
    "subtitle": "Migration snapshots — no gore NFTs",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "backup before fork; integrity diff · **Quest:** Jackal Backup Rite · **Ability:** Scale Tare · **CL:** 4–9 · **NFT:** Rare + no mummy imagery",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Scale Tare · CL: 4–9 · NFT: Rare + no mummy imagery",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Anup (Anubis) v pramenech spojuje balzamování, ochranu mrtvých a vážení v soudních scénách. V OASIS = migrační thresholdy, snapshot před forkem, data retention politika — nikoli posmrtné sliby hráčům.",
      "en": "Anup (Anubis) in the sources joins embalming, protection of the dead and the weighing in judgment scenes. In OASIS = migration thresholds, snapshot before fork, data-retention policy — not afterlife promises to players."
    },
    "quote": "Kdo váží blok — ať neváží krev.",
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
    "subtitle": "Commit–reveal / private tally lore",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "concealed ballot phases · **Quest:** Veil of Karnak · **Ability:** Concealed Ballot · **CL:** 5–9 · **NFT:** Epic + compliance lore note",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Concealed Ballot · CL: 5–9 · NFT: Epic + compliance lore note",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Amon (Amun) v novoříšské syntéze spojuje neviditelnou moc a vzduch. V OASIS = commit–reveal hlasování, hidden state v testech, zero-knowledge lore (bez matematických lží).",
      "en": "Amun in New Kingdom synthesis joins hidden power and air. In OASIS = commit–reveal voting, hidden state in tests, zero-knowledge lore (no mathematical falsehoods)."
    },
    "quote": "Kdo slyší vítr v prázdné síni — ať neprodává ticho jako token.",
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
    "subtitle": "L1 substrate / hosting reality check",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "physical infra baseline · **Quest:** Earth-Shu Gap · **Ability:** Bedrock Anchor · **CL:** 3–8 · **NFT:** Rare",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Bedrock Anchor · CL: 3–8 · NFT: Rare",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Geb je bůh země, otec Usira, Seta, Eset a Neftý v klasické genealogii. V OASIS = hardware/OS baseline, node disk, carbon-aware lokace validátorů (jen lore).",
      "en": "Geb is the earth god, father of Osiris, Set, Isis and Nephthys in classical genealogy. In OASIS = hardware/OS baseline, node disk, carbon-aware validator placement (lore only)."
    },
    "quote": "Kdo leží pod všemi — ať nese bez pomluvy základ.",
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
    "subtitle": "Sharding / nightly maintenance metaphor",
    "ray": "Blue",
    "rarity": "Rare",
    "cl": 1,
    "clName": "",
    "role": "horizontal read scale · **Quest:** Stellar Vault Sharding · **Ability:** Starfield Span · **CL:** 5–9 · **NFT:** Legendary",
    "location": "",
    "questLine": "",
    "teaching": "",
    "ability": "Starfield Span · CL: 5–9 · NFT: Legendary",
    "key": "",
    "quests": [],
    "essence": {
      "cs": "Nut je nebeská bohyně oblouku hvězd; mytologicky „spolkne“ slunce na noc. V OASIS = sharded state, noční joby, navigace hvězdnou mapou v meta-doku.",
      "en": "Nut is the celestial goddess arched with stars; mythologically she 'swallows' the sun at night. In OASIS = sharded state, nightly jobs, star-map navigation in the meta-doc."
    },
    "quote": "Kdo rozepíná hvězdy — ať nechá díry pro audit.",
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
    "subtitle": "God of Nine Steps",
    "ray": "Obsidian",
    "rarity": "Legendary",
    "cl": 7,
    "clName": "Healing Compassion",
    "role": "bak'tun reset, transformation",
    "location": "Tortuguero Ruins (Tabasco)",
    "questLine": "Devět Kroků Přechodu",
    "teaching": "Accept that some things must end so others can begin.",
    "ability": "Bak'tun Shift — reset local game state in a zone once per season",
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
    "quote": "Třináctý bak'tun bude dokončen. Přijde zobrazení Bolon-Yokte' — v slavné investituře.",
    "hasProfile": true,
    "art": {
      "card": "/oasis-assets/concept_portraits/200-bolon-yokte-k-uh.webp",
      "full": "/oasis-assets/concept_svg/200-bolon-yokte-k-uh.svg",
      "final": false
    },
    "circle": "maya"
  }
];
