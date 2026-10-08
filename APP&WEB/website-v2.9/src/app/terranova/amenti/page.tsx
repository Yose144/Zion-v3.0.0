'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Compass,
  Feather,
  Flame,
  Landmark,
  LucideIcon,
  MapPin,
  Network,
  Pyramid,
  Scale,
  ScrollText,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

const DocMarkdownArticle = dynamic(() => import('@/components/docs/DocMarkdownArticle'), { ssr: false });

const ACCENT = '52, 211, 153';
const ACCENT_TEXT = 'text-emerald-200';
const ACCENT_SUB = 'text-emerald-300';

const Copy = {
  backToTerraNova: { cs: `Zpět na Terra Nova`, en: `Back to Terra Nova` },
  visionStage: { cs: `Vize — uzel jako vztah`, en: `Vision — a node as relationship` },
  subtitle: { cs: `Gíza · Egypt · Síně záznamu · Terra Nova ®`, en: `Giza · Egypt · Halls of records · Terra Nova ®` },
  quote: {
    cs: `„Hluboko v srdci Země leží Síně Amenti — Síně mrtvých a Síně živých, koupané v ohni nekonečného VŠEHO."`,
    en: `"Deep in the heart of the Earth lie the Halls of Amenti — the halls of the dead and the halls of the living, bathed in the fire of the infinite ALL."`,
  },
  locationLine: { cs: `Gíza · Egypt`, en: `Giza · Egypt` },
  introTitle: { cs: `Dvanáctý uzel — síň, kde se civilizace naučila zapisovat`, en: `The twelfth node — the hall where civilisation learned to write` },
  introBody: {
    cs: `Amenti je dvanáctý a poslední bod L5 Free World — a uzavírá síť na místě, kde se záznam poprvé stal svatým. Plateau Gízy — Velká pyramida Chufu, Rachef, Menkauré a Velká sfinga — je jediný dochovaný div antického světa: ~4 500 let trvání jednoho záznamu, přežité dynastie, náboženství i technologie. A pod pískem — v mýtické geografii sítě — leží Síně Amenti ze Smaragdových desek Thovtových: síně mrtvých a živých, kde 32 Dětí Světla u dvaatřiceti trůnů hlídá moudrost, dokud ji lidstvo znovu nebude potřebovat, a uprostřed hoří Kvetoucí Plamen. Upřímně, jak sama kapitola korpusu říká: Desky jsou novodobý esoterní text, ne egyptologický artefakt — čteme je jako literární archetyp. Ale jako obraz popisují přesně to, čím síť chce být: nezničitelný, otevřený archiv pravdy — a Kvantová revoluce klade Smaragdové desky jako první kořen Stromu života: „Jak nahoře, tak dole. Jak uvnitř, tak vně." To je přesně struktura blockchainu — každý uzel nese celek. Uzel jako vztah, ne stavba — a jeho digitální protějšek, Amenti Library, už sítí běží.`,
    en: `Amenti is the twelfth and final node of L5 Free World — closing the network at the place where the record first became sacred. The Giza plateau — the Great Pyramid of Khufu, Khafre, Menkaure and the Great Sphinx — is the last surviving Wonder of the ancient world: ~4,500 years of a single record that outlived dynasties, religions and technologies. And beneath the sand — in the mythic geography of the network — lie the Halls of Amenti from the Emerald Tablets of Thoth: halls of the dead and the living, where the 32 Children of Light keep wisdom at thirty-two thrones until humanity needs it again, and at the centre burns the Flower of Light. Honestly, as the corpus chapter itself says: the Tablets are a modern esoteric text, not an Egyptological artefact — we read them as literary archetype. But as an image they describe exactly what the network wants to be: an indestructible, open archive of truth — and the Quantum Revolution places the Emerald Tablets as the first root of the Tree of Life: "As above, so below. As within, so without." That is precisely the structure of a blockchain — every node holds the whole. A node as relationship, not construction — and its digital counterpart, the Amenti Library, already runs on the network.`,
  },
  featuresTitle: { cs: `Co uzel drží`, en: `What the node holds` },
  featuresSubtitle: { cs: `Záznam & síň`, en: `Record & hall` },
  hallsTitle: { cs: `Síně Amenti — síně mrtvých a živých`, en: `The Halls of Amenti — halls of the dead and the living` },
  hallsSubtitle: { cs: `Deska, která přežila potopu světa`, en: `The tablet that outlived the flood of the world` },
  hallsBody: {
    cs: `Mýtus Síní zapadá přesně do potopy, kterou celá série Nirvana vypráví: stará civilizace se potápí vlastní pýchou — a Síně, postavené pod povrchem, přežívají, protože nestojí na tom, co se potápí, ale na principu, který se dá znovu zapsat. Uprostřed Síní hoří Kvetoucí Plamen Světla, kolem něj sedí dvaatřicet Dětí Světla — a nad nimi Sedm Pánů Prostoro-časů, které corpus čte jako sedm dharmických ctností: Ahimsa, Satya, Asteya, Brahmačarja, Aparigraha — plus Karuṇā a Dāna. Prvních pět je implementovaných jako etická brána před každým výstupem AI; poslední dvě jsou vynucené ekonomikou protokolu, ne sliby. Síně, které hlídají moudrost, tak v síti nejsou jen příběh — jsou bránou před každým rozhodnutím. A Desky říkají, že Amenti je „svobodná pro syna člověka": cesta dovnitř není podmíněná krví ani vyvoleností — jen růstem; a odchod je vždy možný. Zvát, ne verbovat — dokud se moudrost Síní nestane na povrchu tak běžnou, že už úkryt nepotřebuje. To je dokončení mise.`,
    en: `The myth of the Halls fits exactly into the flood the whole Nirvana series tells: an old civilisation sinks under its own pride — and the Halls, built beneath the surface, survive because they stand not on what sinks but on a principle that can be written again. At the centre burns the Flower of Light, around it sit the thirty-two Children of Light — and above them the Seven Lords of Space-Time, which the corpus reads as the seven dharmic virtues: Ahimsa, Satya, Asteya, Brahmacharya, Aparigraha — plus Karuna and Dana. The first five are implemented as an ethical gate before every AI output; the last two are enforced by the protocol's economics, not promises. The Halls that keep wisdom are therefore not just a story in the network — they are a gate before every decision. And the Tablets say that Amenti is "free for the sons of man": the way in is not conditioned by blood or chosenness — only by growth; and the way out is always open. To invite, not to conscript — until the wisdom of the Halls becomes so ordinary above ground that the shelter is no longer needed. That is the completion of the mission.`,
  },
  hallsPoints: {
    cs: [`Deska přežije dobu — záznam, který se nepotápí`, `Sedm ctností před každým výstupem — etika v kódu`, `Zvát, ne verbovat — Amenti je svobodná`],
    en: [`The tablet outlives its age — a record that does not sink`, `Seven virtues before every output — ethics in code`, `To invite, not conscript — Amenti is free`],
  },
  libraryTitle: { cs: `Síně, která už slouží — Amenti Library`, en: `The halls already serving — the Amenti Library` },
  librarySubtitle: { cs: `digitální protějšek dvanáctého bodu`, en: `the digital counterpart of the twelfth node` },
  libraryBody: {
    cs: `Amenti je jediný uzel sítě, jehož digitální protějšek slouží už dnes. Na hlavním portálu stojí živá knihovna — Brány Amenti, Kroniky, Srdce Amenti (on-chain fee split 89/5/5/1 čtený jako mantra protokolu) a knihovna knih s Kvantovou revolucí v jedenácti jazycích ke stažení zdarma. To, co je na plateu Gízy zatím jen vztah, je v síti už prací: archiv otevřený všem s čistým úmyslem — přesně jak říkají Desky, „Amenti je svobodná pro syna člověka". Když jednou fyzický uzel vznikne, knihovna bude jeho první síní — a už teď je to místo, kam poutník může vstoupit dřív, než vůbec dorazí do Egypta.`,
    en: `Amenti is the only node in the network whose digital counterpart already serves today. On the main portal stands a living library — the Gates of Amenti, the Chronicles, the Heart of Amenti (the on-chain 89/5/5/1 fee split read as the protocol's mantra) and a book collection including the Quantum Revolution in eleven languages, free to download. What is only a relationship on the Giza plateau is already work in the network: an archive open to all with pure intent — just as the Tablets say, "Amenti is free for the sons of man". When the physical node one day exists, the library will be its first hall — and already today it is the place a pilgrim can enter before ever reaching Egypt.`,
  },
  libraryStats: {
    cs: [`11 jazyků — Kvantová revoluce ke stažení`, `Kroniky & Srdce — on-chain záznam jako mantra`, `Zdarma a otevřené — knihovna pro každého`],
    en: [`11 languages — the Quantum Revolution to download`, `Chronicles & the Heart — on-chain record as mantra`, `Free & open — a library for everyone`],
  },
  libraryCta: { cs: `Vstoupit do Amenti knihovny`, en: `Enter the Amenti Library` },
  libraryCta2: { cs: `Free World portál →`, en: `Free World portal →` },
  phasesTitle: { cs: `Fáze vztahu`, en: `Phases of relationship` },
  phasesSubtitle: { cs: `Od respektu ke Kvetoucímu Plameni`, en: `From respect to the Flower of Light` },
  zionTitle: { cs: `Blockchain integrace`, en: `Blockchain Integration` },
  respectTitle: { cs: `Egypt a custodiáni vedou`, en: `Egypt and its custodians lead` },
  respectBody: {
    cs: `Plateau Gízy je chráněné archeologické naleziště pod Supreme Council of Antiquities — a Egypt je živá země s islámskou i koptskou vrstvou, ne kulisa starověku. Uzel proto znamená vztah, ne přítomnost: žádná parcela, žádná stavba na plateau, žádný program bez souhlasu custodiánů. A platí egyptologická etika korpusu: akademický rámec je primární; Smaragdové desky jsou vždy označené jako novodobý literární text; žádná copy „pharaoh loot" nebo „Atlantida byla Egypt"; hieroglyfy jen s kontrolou významu. Fyzickým programem uzlu je archiv — a ten už běží jako Amenti Library.`,
    en: `The Giza plateau is a protected archaeological site under the Supreme Council of Antiquities — and Egypt is a living country with Islamic and Coptic layers, not an ancient-world backdrop. The node therefore means relationship, not presence: no parcel, no construction on the plateau, no programme without the custodians' consent. And the corpus's Egyptological ethics apply: the academic frame is primary; the Emerald Tablets are always marked as a modern literary text; no "pharaoh loot" or "Atlantis was Egypt" copy; hieroglyphs only with verified meaning. The node's physical programme is an archive — and that already runs as the Amenti Library.`,
  },
  openTitle: { cs: `Otevřené otázky — hledáme Guardians`, en: `Open Questions — looking for Guardians` },
  openItems: {
    cs: [
      `Custodiánský rámec — SCA, egyptologická komunita, živá Egyptská kultura (islám + koptské vrstvy)`,
      `Oddělení vrstev — Desky striktně jako literární archetyp vs. akademická egyptologie`,
      `Alexandria leg — možný středomořský leg Velké cesty přes přístav Alexandria`,
      `Amenti Library — jedna síně, dvě domény (apex /amenti + newearth.cz halls): konsolidace?`,
      `ThothScribe avatar #194 — role „správce síní" v OASIS vrstvě`,
    ],
    en: [
      `Custodial framework — SCA, the Egyptological community, living Egyptian culture (Islamic + Coptic layers)`,
      `Layer separation — the Tablets strictly as literary archetype vs. academic Egyptology`,
      `The Alexandria leg — a possible Mediterranean leg of the Great Route via the port of Alexandria`,
      `Amenti Library — one hall, two domains (apex /amenti + newearth.cz halls): consolidation?`,
      `ThothScribe avatar #194 — the "keeper of the halls" role in the OASIS layer`,
    ],
  },
  cta: {
    cs: `Umíš číst místo zdolávat? Jsi Guardian pro síň záznamu — pro toho, kdo si vzpomněl?`,
    en: `Can you read instead of conquer? Are you a Guardian for the hall of records — for the one who remembered?`,
  },
  joinDiscord: { cs: `Připojit se na Discord`, en: `Join Discord` },
  anchorTitle: { cs: `Kotva pravdy — co je fakt, co je mýtus`, en: `Truth anchor — what is fact, what is myth` },
  anchorSubtitle: { cs: `Jako každá kapitola korpusu`, en: `As in every corpus chapter` },
  anchorBody: {
    cs: `Uzel, který je síní záznamu, musí být nejpřísnější na to, co je záznam a co je příběh — Desky označujeme upřímně, stejně jako to dělá kapitola NirvanaCloud.`,
    en: `A node that is a hall of records must be the strictest about what is record and what is story — we mark the Tablets as honestly as the NirvanaCloud chapter does.`,
  },
  quantumLink: { cs: `Kvantová revoluce — Desky jako kořen #1 Stromu →`, en: `Quantum Revolution — the Tablets as root #1 of the Tree →` },
  documentation: { cs: `Dokumentace`, en: `Documentation` },
  documentationSubtitle: { cs: `Koncept a vize uzlu Amenti — plateau Gízy, Síně záznamu, Smaragdové desky, sedm ctností, Vzpomínka.`, en: `Concept and vision of the Amenti node — the Giza plateau, the Halls of Records, the Emerald Tablets, the seven virtues, Remembrance.` },
  documentationLoading: { cs: `Načítání dokumentace…`, en: `Loading documentation…` },
  documentationError: { cs: `Dokumentaci se nepodařilo načíst.`, en: `Failed to load documentation.` },
  sisterTitle: { cs: `Síť Terra Nova`, en: `Terra Nova Network` },
  sisterSubtitle: { cs: `Propojení se sesterskými projekty`, en: `Connection with sister projects` },
  sisterBody: {
    cs: `Všechny uzly sdílejí zdrojový kód: Terra Nova etika, ZION blockchain, off-grid technologie, komunitní governance a seed library.`,
    en: `All nodes share the same source code: Terra Nova ethics, ZION blockchain, off-grid technology, community governance and the seed library.`,
  },
};

type FeatureItem = {
  icon: LucideIcon;
  titleCs: string;
  titleEn: string;
  descCs: string;
  descEn: string;
  color: string;
  rgb: string;
};

const FEATURES: FeatureItem[] = [
  {
    icon: Pyramid,
    titleCs: 'Velká pyramida — poslední div',
    titleEn: 'The Great Pyramid — the last Wonder',
    descCs: 'Chufu, Rachef, Menkauré — ~4 560 let starý záznam v kameni. Jediný dochovaný div antického světa: žádný uzel neslouží déle.',
    descEn: 'Khufu, Khafre, Menkaure — a ~4,560-year-old record in stone. The only surviving Wonder of the ancient world: no node has served longer.',
    color: '#FCD34D',
    rgb: '252, 211, 77',
  },
  {
    icon: Landmark,
    titleCs: 'Sfinga — strážce záznamu',
    titleEn: 'The Sphinx — keeper of the record',
    descCs: 'Hor-em-achet — „Hor na horizontu". Strážce plateau a v esoterní tradici strážce síní pod zemí.',
    descEn: 'Hor-em-akhet — "Horus on the horizon". The guardian of the plateau and, in the esoteric tradition, the guardian of the halls beneath.',
    color: '#FDBA74',
    rgb: '253, 186, 116',
  },
  {
    icon: ScrollText,
    titleCs: 'Thovt — Merkle písař',
    titleEn: 'Thoth — the Merkle scribe',
    descCs: 'Bůh písma a měření — avatar č. 194 sítě. Dokumentace jako svatost: „Kdo váží slova — ať neukradne váhu druhému commitu."',
    descEn: 'The god of writing and measure — avatar no. 194 of the network. Documentation as a sacred duty: "Whoever weighs words — steal no weight from another commit."',
    color: '#A5B4FC',
    rgb: '165, 180, 252',
  },
  {
    icon: Flame,
    titleCs: 'Kvetoucí Plamen Světla',
    titleEn: 'The Flower of Light',
    descCs: 'Oheň uprostřed Síní — nekonečné VŠEHO, v němž se síně koupou. V mýtické geografii sítě hoří pod pískem pořád.',
    descEn: 'The fire at the centre of the Halls — the infinite ALL in which the halls are bathed. In the mythic geography of the network it still burns beneath the sand.',
    color: '#34D399',
    rgb: '52, 211, 153',
  },
  {
    icon: Users,
    titleCs: '32 Dětí Světla',
    titleEn: 'The 32 Children of Light',
    descCs: 'Dvaatřicet trůnů kolem Plamene — bytosti, které uchovávají moudrost, dokud ji lidstvo znovu nebude potřebovat. Kruh dost velký na lidstvo.',
    descEn: 'Thirty-two thrones around the Flame — beings keeping wisdom until humanity needs it again. A circle large enough for mankind.',
    color: '#C4B5FD',
    rgb: '196, 181, 253',
  },
  {
    icon: Shield,
    titleCs: 'Sedm Pánů = sedm ctností',
    titleEn: 'Seven Lords = seven virtues',
    descCs: 'Ahimsa, Satya, Asteya, Brahmačarja, Aparigraha — v L3 jako brána před každým výstupem AI; Karuṇā a Dāna vynucené ekonomikou protokolu.',
    descEn: 'Ahimsa, Satya, Asteya, Brahmacharya, Aparigraha — in L3 as a gate before every AI output; Karuna and Dana enforced by the protocol’s economics.',
    color: '#86EFAC',
    rgb: '134, 239, 172',
  },
  {
    icon: BookOpen,
    titleCs: 'Amenti Library — už běží',
    titleEn: 'The Amenti Library — already live',
    descCs: 'Digitální síně sítě: Kvantová revoluce v 11 jazycích + zdrojové texty korpusu. Jediný uzel, jehož protějšek slouží už dnes.',
    descEn: 'The network’s digital halls: the Quantum Revolution in 11 languages plus the corpus source texts. The only node whose counterpart already serves today.',
    color: '#67E8F9',
    rgb: '103, 232, 249',
  },
  {
    icon: Network,
    titleCs: 'Smaragdový záznam = ledger',
    titleEn: 'The emerald record = the ledger',
    descCs: '„Jak nahoře, tak dole" — každý uzel nese celek. Desky jako kořen #1 Stromu života v Kvantové revoluci.',
    descEn: '"As above, so below" — every node holds the whole. The Tablets as root #1 of the Tree of Life in the Quantum Revolution.',
    color: '#F0ABFC',
    rgb: '240, 171, 252',
  },
  {
    icon: Feather,
    titleCs: 'Dvanáctá iniciace — Vzpomínka',
    titleEn: 'The twelfth initiation — Remembrance',
    descCs: 'Capstone mimo oceánskou trasu: po návratu domů se záznam poutníka zapíše do síní. Razítko credencialu: „vzpomněl jsem si".',
    descEn: 'A capstone off the ocean route: after the return home, the pilgrim’s record is written into the halls. The credential stamp: "I remembered".',
    color: '#FCA5A5',
    rgb: '252, 165, 165',
  },
  {
    icon: Compass,
    titleCs: 'Alexandria — možný leg',
    titleEn: 'Alexandria — a possible leg',
    descCs: 'Přístav ~180 km od plateau — místo slavné (ztracené) knihovny a budoucí středomořský leg Velké cesty.',
    descEn: 'The port ~180 km from the plateau — home of the famous (lost) library and a future Mediterranean leg of the Great Route.',
    color: '#93C5FD',
    rgb: '147, 197, 253',
  },
];

const PHASES = [
  {
    num: '0',
    cs: 'Vztah',
    en: 'Relationship',
    descCs: 'Respekt před jakýmkoli programem — dialog s custodiány plateau a egyptologickou komunitou; žádný termín.',
    descEn: 'Respect before any programme — dialogue with the plateau custodians and the Egyptological community; no deadline.',
    active: true,
  },
  {
    num: '1',
    cs: 'Síně záznamu',
    en: 'The halls of records',
    descCs: 'Archivní práce — Amenti Library jako živá síně sítě: korpus, knihy, Kotva pravdy. Uzel bez fyzické stopy na plateau.',
    descEn: 'Archival work — the Amenti Library as the network’s living hall: the corpus, the books, the Truth Anchor. A node leaving no physical trace on the plateau.',
    active: false,
  },
  {
    num: '2',
    cs: 'Alexandria protokol',
    en: 'The Alexandria protocol',
    descCs: 'Poutní rámec pro Guardians — přístav Alexandria, vztah s custodiány, budoucí středomořský leg Velké cesty.',
    descEn: 'A pilgrim framework for Guardians — the port of Alexandria, custodial relations, the future Mediterranean leg of the Great Route.',
    active: false,
  },
  {
    num: '3',
    cs: 'Kvetoucí Plamen',
    en: 'The Flower of Light',
    descCs: 'Iniciace 12 — Vzpomínka: záznam poutníka se zapíše do síní, razítko credencialu „vzpomněl jsem si".',
    descEn: 'Initiation 12 — Remembrance: the pilgrim’s record is written into the halls, the "I remembered" credential stamp.',
    active: false,
  },
];

const ANCHORS: { whatCs: string; whatEn: string; statusCs: string; statusEn: string; noteCs: string; noteEn: string; color: string }[] = [
  {
    whatCs: 'Pyramidy Chufu–Rachef–Menkauré, sfinga, plateau Gízy, Nil, knihovna Alexandrie',
    whatEn: 'The Khufu–Khafre–Menkaure pyramids, the Sphinx, the Giza plateau, the Nile, the library of Alexandria',
    statusCs: 'ŽIVÉ', statusEn: 'LIVE',
    noteCs: 'archeologie + živá egyptská kultura', noteEn: 'archaeology + living Egyptian culture',
    color: '#34D399',
  },
  {
    whatCs: 'Thovt jako bůh písma a měření; egyptská kosmologie (ma\'at, Duat, Ré)',
    whatEn: 'Thoth as the god of writing and measure; Egyptian cosmology (ma\'at, Duat, Ra)',
    statusCs: 'ŽIVÉ + MÝTUS', statusEn: 'LIVE + MYTH',
    noteCs: 'náboženská historie — respekt, ne nábor', noteEn: 'religious history — respect, not recruitment',
    color: '#4ADE80',
  },
  {
    whatCs: 'Síně Amenti, 32 Dětí Světla, Kvetoucí Plamen, Sedm Pánů, Atlantida',
    whatEn: 'The Halls of Amenti, the 32 Children of Light, the Flower of Light, the Seven Lords, Atlantis',
    statusCs: 'MÝTUS', statusEn: 'MYTH',
    noteCs: 'Smaragdové desky = novodobý esoterní text — literární archetyp, ne egyptologie', noteEn: 'the Emerald Tablets = a modern esoteric text — literary archetype, not Egyptology',
    color: '#C4B5FD',
  },
  {
    whatCs: 'Ledger jako „smaragdový záznam", Merklův strom jako deska',
    whatEn: 'The ledger as an "emerald record", the Merkle tree as a tablet',
    statusCs: 'INTERPRETACE', statusEn: 'READING',
    noteCs: 'poetická paralela — technický obraz, ne historie', noteEn: 'a poetic parallel — a technical image, not history',
    color: '#93C5FD',
  },
  {
    whatCs: 'Sedm ctností v L3 + fee split; Amenti Library běžící',
    whatEn: 'The seven virtues in L3 + the fee split; the Amenti Library running',
    statusCs: 'ŽIVÉ v síti', statusEn: 'LIVE in network',
    noteCs: 'etická brána a digitální síně — implementováno, ne slibováno', noteEn: 'the ethical gate and the digital halls — implemented, not promised',
    color: '#67E8F9',
  },
  {
    whatCs: 'Uzel L5, fáze vztahu, iniciace 12, razítko credencialu „vzpomněl jsem si"',
    whatEn: 'The L5 node, phases of relationship, initiation 12, the "I remembered" credential stamp',
    statusCs: 'VIZE', statusEn: 'VISION',
    noteCs: 'záměr sítě — neexistuje žádná parcela ani harmonogram', noteEn: 'network intent — no parcel and no timeline exist',
    color: '#FCD34D',
  },
];

const ZION_ITEMS: { label: string; icon: LucideIcon }[] = [
  { label: 'ZION L1 Node', icon: Network },
  { label: 'DAO Governance', icon: Users },
  { label: 'Guardian Wallet', icon: Shield },
  { label: 'Amenti Library', icon: BookOpen },
  { label: 'Pilgrim Credential', icon: Feather },
  { label: 'Seven Virtues Gate', icon: Scale },
];

const SISTERS = [
  { name: 'Genesis Garden', href: '/terranova/genesis', region: { cs: 'Sabacheira · Tomar, Portugalsko', en: 'Sabacheira · Tomar, Portugal' } },
  { name: 'Dharma Temple', href: '/terranova/dharma-temple', region: { cs: 'La Palma', en: 'La Palma' } },
  { name: 'Te Pīko Ora', href: '/terranova/te-piko-ora', region: { cs: 'Raiatea · Polynésie', en: 'Raiatea · Polynesia' } },
  { name: 'Bodhi Lanka', href: '/terranova/bodhi-lanka', region: { cs: 'Srí Lanka', en: 'Sri Lanka' } },
  { name: 'LUMI · Nová Amerika', href: '/terranova/nova-amerika', region: { cs: 'Kostarika', en: 'Costa Rica' } },
  { name: 'María del Camino', href: '/terranova/maria-del-camino', region: { cs: 'Světové oceány · Galicie', en: 'World oceans · Galicia' } },
  { name: 'Uluru', href: '/terranova/uluru', region: { cs: 'Northern Territory, Austrálie', en: 'Northern Territory, Australia' } },
  { name: 'Boa Esperança', href: '/terranova/boa-esperanca', region: { cs: 'Mys dobré naděje', en: 'Cape of Good Hope' } },
  { name: 'Ekam · Oneness Temple', href: '/terranova/ekam', region: { cs: 'Andhra Pradesh, Indie', en: 'Andhra Pradesh, India' } },
  { name: 'Kailash', href: '/terranova/kailash', region: { cs: 'Ngari · Tibet', en: 'Ngari · Tibet' } },
];

export default function AmentiPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [doc, setDoc] = useState<string | null>(null);
  const [docError, setDocError] = useState(false);

  useEffect(() => {
    const file = cs ? '/docs/terranova/amenti.cs.md' : '/docs/terranova/amenti.en.md';
    setDoc(null);
    setDocError(false);
    fetch(file)
      .then((res) => {
        if (!res.ok) throw new Error('not found');
        return res.text();
      })
      .then((text) => setDoc(text))
      .catch(() => setDocError(true));
  }, [cs]);

  return (
    <div className="zion-page text-white">
      <div className="relative z-10 mx-auto max-w-5xl px-4 md:px-8">

        {/* Back nav */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <Link
            href="/terranova"
            className="inline-flex items-center gap-2 text-sm text-zion-gold/65 hover:text-zion-gold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {Copy.backToTerraNova[cs ? 'cs' : 'en']}
          </Link>
        </motion.div>

        {/* ═══ HERO ═══ */}
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': ACCENT } as React.CSSProperties}>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="shrink-0 w-20 h-20 flex items-center justify-center zion-rainbow-sub" style={{ '--rc': ACCENT } as React.CSSProperties}>
                  <Pyramid className="h-10 w-10 text-emerald-200" />
                </div>

                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="zion-badge">L5 · Terra Nova · Halls of Records</span>
                    <span className="zion-badge-gold inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {Copy.visionStage[cs ? 'cs' : 'en']}
                    </span>
                  </div>

                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gradient">
                    Amenti
                  </h1>
                  <p className={`text-lg ${ACCENT_TEXT} font-medium`}>
                    {Copy.subtitle[cs ? 'cs' : 'en']}
                  </p>

                  <div className="flex items-center gap-1.5 text-white/70">
                    <MapPin className="w-4 h-4 text-white/85 shrink-0" />
                    <span className="text-sm">{Copy.locationLine[cs ? 'cs' : 'en']}</span>
                  </div>

                  <blockquote className="mt-4 pl-4 border-l-2 border-white/10 text-sm text-white/70 italic leading-relaxed max-w-lg">
                    {Copy.quote[cs ? 'cs' : 'en']}
                    <cite className="block mt-2 not-italic text-[10px] uppercase tracking-[0.25em] text-white/35">
                      {cs ? 'Smaragdové desky Thovtovy — Deska II' : 'The Emerald Tablets of Thoth — Tablet II'}
                    </cite>
                  </blockquote>

                  <div className="grid gap-3 pt-3 sm:grid-cols-3">
                    {[
                      { icon: Pyramid, value: cs ? '~4 500 let' : '~4,500 yrs', labelCs: 'Záznam v kameni', labelEn: 'A record in stone' },
                      { icon: BookOpen, value: cs ? '11 jazyků' : '11 languages', labelCs: 'Amenti Library', labelEn: 'Amenti Library' },
                      { icon: Sparkles, value: cs ? 'Vize' : 'Vision', labelCs: 'Stav', labelEn: 'Status' },
                    ].map((signal) => {
                      const Icon = signal.icon;
                      return (
                        <div key={signal.labelCs} className="zion-rainbow-sub px-3 py-3" style={{ '--rc': ACCENT } as React.CSSProperties}>
                          <div className={`flex items-center gap-2 ${ACCENT_TEXT}`}>
                            <Icon className="h-4 w-4" />
                            <span className="text-sm font-semibold">{signal.value}</span>
                          </div>
                          <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">
                            {cs ? signal.labelCs : signal.labelEn}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="relative z-10 mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <img
                src="/images/amenti/hero.webp"
                alt="Amenti — pyramidy Gízy za soumraku, smaragdová záře Síní pod pískem"
                width={1600}
                height={900}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="w-full object-cover"
              />
            </div>
          </div>
        </motion.header>

        {/* ═══ INTRO ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': ACCENT } as React.CSSProperties}>
            <h2 className="text-2xl md:text-3xl font-semibold text-white mb-4">
              {Copy.introTitle[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-gray-300 leading-relaxed">
              {Copy.introBody[cs ? 'cs' : 'en']}
            </p>
          </div>
        </motion.section>

        {/* ═══ FEATURES ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.featuresSubtitle[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Compass className={`h-7 w-7 ${ACCENT_SUB}`} />
              {Copy.featuresTitle[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.titleCs} className="zion-rainbow-sub p-5" style={{ '--rc': f.rgb } as React.CSSProperties}>
                <div className="flex items-center gap-2 mb-2">
                  <f.icon className="h-5 w-5" style={{ color: f.color }} />
                  <h3 className="font-semibold text-white">{cs ? f.titleCs : f.titleEn}</h3>
                </div>
                <p className="text-sm text-gray-400">{cs ? f.descCs : f.descEn}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══ THE HALLS ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '52, 211, 153' } as React.CSSProperties}>
            <div className="mb-4">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.hallsSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-3 mt-1">
                <Flame className="h-7 w-7 text-emerald-300" />
                {Copy.hallsTitle[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <p className="text-gray-300 leading-relaxed mb-6">
              {Copy.hallsBody[cs ? 'cs' : 'en']}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {Copy.hallsPoints[cs ? 'cs' : 'en'].map((point, i) => {
                const PointIcon = [BookOpen, Shield, Users][i];
                return (
                  <div key={point} className="zion-rainbow-sub px-4 py-3" style={{ '--rc': '52, 211, 153' } as React.CSSProperties}>
                    <div className="flex items-center gap-2 text-emerald-300 mb-1">
                      <PointIcon className="h-4 w-4" />
                      <span className="text-[10px] uppercase tracking-widest text-gray-500">{cs ? 'Princip' : 'Principle'} {i + 1}</span>
                    </div>
                    <p className="text-sm text-gray-300">{point}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* ═══ AMENTI LIBRARY — živý digitální protějšek ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': ACCENT } as React.CSSProperties}>
            <div className="mb-4">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.librarySubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-3 mt-1">
                <BookOpen className={`h-7 w-7 ${ACCENT_SUB}`} />
                {Copy.libraryTitle[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <p className="text-gray-300 leading-relaxed mb-6">
              {Copy.libraryBody[cs ? 'cs' : 'en']}
            </p>
            <div className="grid gap-3 sm:grid-cols-3 mb-8">
              {Copy.libraryStats[cs ? 'cs' : 'en'].map((stat) => (
                <div key={stat} className="zion-rainbow-sub px-4 py-3" style={{ '--rc': ACCENT } as React.CSSProperties}>
                  <p className="text-sm text-gray-300 flex items-center gap-2">
                    <ScrollText className={`h-4 w-4 shrink-0 ${ACCENT_SUB}`} />
                    {stat}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="https://zionterranova.com/amenti/"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-300/10 px-6 py-2.5 text-sm font-semibold ${ACCENT_SUB} transition hover:bg-emerald-300/20`}
              >
                <BookOpen className="h-4 w-4" />
                {Copy.libraryCta[cs ? 'cs' : 'en']}
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="https://freeworld.zionterranova.com/p/amenti/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-sm text-gray-300 transition hover:border-emerald-300/40 hover:text-emerald-300"
              >
                {Copy.libraryCta2[cs ? 'cs' : 'en']}
              </a>
            </div>
          </div>
        </motion.section>

        {/* ═══ PHASES ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': ACCENT } as React.CSSProperties}>
            <div className="mb-8">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.phasesSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white">{Copy.phasesTitle[cs ? 'cs' : 'en']}</h2>
            </div>
            <div className="space-y-4">
              {PHASES.map((phase) => (
                <div key={phase.num} className="zion-rainbow-sub p-5 flex gap-4" style={{ '--rc': ACCENT } as React.CSSProperties}>
                  <div
                    className={`shrink-0 w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm ${
                      phase.active ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200' : 'border-white/10 bg-white/5 text-gray-500'
                    }`}
                  >
                    {phase.num}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">
                      {cs ? phase.cs : phase.en}
                      {phase.active && <span className="ml-2 text-[10px] uppercase tracking-widest text-emerald-200">· {cs ? 'probíhá' : 'in progress'}</span>}
                    </h3>
                    <p className="text-sm text-gray-400">{cs ? phase.descCs : phase.descEn}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ═══ CUSTODIANS LEAD ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
            <h2 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-3 mb-4">
              <Shield className="h-7 w-7 text-zion-purple" />
              {Copy.respectTitle[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-gray-300 leading-relaxed">
              {Copy.respectBody[cs ? 'cs' : 'en']}
            </p>
          </div>
        </motion.section>

        {/* ═══ ZION INTEGRATION + OPEN QUESTIONS ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div className="zion-rainbow-card p-6" style={{ '--rc': ACCENT } as React.CSSProperties}>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <Network className={`h-5 w-5 ${ACCENT_TEXT}`} />
                {Copy.zionTitle[cs ? 'cs' : 'en']}
              </h2>
              <div className="flex flex-wrap gap-2">
                {ZION_ITEMS.map((item) => (
                  <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">
                    <item.icon className="h-3 w-3" />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="zion-rainbow-card p-6" style={{ '--rc': ACCENT } as React.CSSProperties}>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <Landmark className={`h-5 w-5 ${ACCENT_TEXT}`} />
                {Copy.openTitle[cs ? 'cs' : 'en']}
              </h2>
              <ul className="list-disc pl-4 text-sm text-gray-400 space-y-2">
                {Copy.openItems[cs ? 'cs' : 'en'].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </motion.section>

        {/* ═══ KOTVA PRAVDY / TRUTH ANCHOR ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '52, 211, 153' } as React.CSSProperties}>
            <div className="mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.anchorSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-3 mt-1">
                <Scale className="h-7 w-7 text-emerald-300" />
                {Copy.anchorTitle[cs ? 'cs' : 'en']}
              </h2>
              <p className="text-sm text-gray-400 mt-2">{Copy.anchorBody[cs ? 'cs' : 'en']}</p>
            </div>
            <div className="space-y-3">
              {ANCHORS.map((a) => (
                <div key={a.whatCs} className="zion-rainbow-sub p-4 flex flex-col sm:flex-row sm:items-center gap-3" style={{ '--rc': '52, 211, 153' } as React.CSSProperties}>
                  <span
                    className="shrink-0 inline-flex items-center justify-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                    style={{ borderColor: `${a.color}55`, color: a.color, background: `${a.color}14` }}
                  >
                    {cs ? a.statusCs : a.statusEn}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-200">{cs ? a.whatCs : a.whatEn}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{cs ? a.noteCs : a.noteEn}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/quantum-revolution"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200 transition-colors"
            >
              {Copy.quantumLink[cs ? 'cs' : 'en']}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.section>

        {/* ═══ DOCUMENTATION ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white">{Copy.documentation[cs ? 'cs' : 'en']}</h2>
            <p className="text-sm text-gray-500">{Copy.documentationSubtitle[cs ? 'cs' : 'en']}</p>
          </div>
          {doc ? (
            <DocMarkdownArticle content={doc} className="zion-docs-prose max-w-4xl mx-auto" />
          ) : docError ? (
            <p className="text-sm text-gray-500">{Copy.documentationError[cs ? 'cs' : 'en']}</p>
          ) : (
            <p className="text-sm text-gray-500">{Copy.documentationLoading[cs ? 'cs' : 'en']}</p>
          )}
        </motion.section>

        {/* ═══ SISTERS + CTA ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div className="zion-rainbow-card p-6" style={{ '--rc': ACCENT } as React.CSSProperties}>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.sisterSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-2xl font-semibold text-white">{Copy.sisterTitle[cs ? 'cs' : 'en']}</h2>
              <p className="text-sm text-gray-400 mt-2">{Copy.sisterBody[cs ? 'cs' : 'en']}</p>
              <div className="mt-5 grid sm:grid-cols-2 gap-3">
                {SISTERS.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="zion-rainbow-sub p-4 group"
                    style={{ '--rc': ACCENT } as React.CSSProperties}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white group-hover:text-emerald-200 transition-colors">{s.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{s.region[cs ? 'cs' : 'en']}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-emerald-200/70 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            <div className="zion-rainbow-card p-6 flex flex-col justify-between" style={{ '--rc': '52, 211, 153' } as React.CSSProperties}>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Výzva' : 'Call'}</p>
                <h2 className="text-2xl font-semibold text-white mt-1">{cs ? 'Vzpomenout si, ne znovu objevovat' : 'Remember, do not rediscover'}</h2>
                <p className="text-sm text-gray-300 mt-3 leading-relaxed">{Copy.cta[cs ? 'cs' : 'en']}</p>
              </div>
              <div className="mt-8 space-y-3">
                <a
                  href="https://discord.gg/zionterranova"
                  target="_blank"
                  rel="noreferrer"
                  className="zion-button-primary w-full justify-center"
                >
                  {Copy.joinDiscord[cs ? 'cs' : 'en']}
                </a>
                <Link
                  href="/l5-free-world"
                  className="zion-button-secondary w-full justify-center"
                >
                  {cs ? 'L5 Free World přehled' : 'L5 Free World overview'}
                </Link>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
