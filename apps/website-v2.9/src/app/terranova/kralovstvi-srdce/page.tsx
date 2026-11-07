'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Anchor,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Compass,
  Crown,
  Droplets,
  Feather,
  Fish,
  Heart,
  Landmark,
  Leaf,
  LucideIcon,
  MapPin,
  Network,
  Radio,
  Route,
  Ship,
  Shield,
  Sprout,
  Sun,
  Thermometer,
  Users,
  Waves,
  Wheat,
  Wind,
  Wrench,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tx5, t5 } from '@/lib/i18n-tx';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

const DocMarkdownArticle = dynamic(() => import('@/components/docs/DocMarkdownArticle'), { ssr: false });
const KralovstviSrdcePreviewLazy = dynamic(() => import('@/components/KralovstviSrdcePreviewLazy'), { ssr: false });

const SEA = '14, 116, 144';

const Copy = {
  backToTerraNova: { cs: `Zpět na Terra Nova`, en: `Back to Terra Nova` },
  stage: { cs: `Vize — pracovní studie`, en: `Vision — working studies` },
  subtitle: {
    cs: `Archa · třináctý uzel · čtvrté plavidlo flotily · pluje s keporkaky`,
    en: `The Ark · thirteenth node · the fleet's fourth vessel · sails with humpback whales`,
  },
  quote: {
    cs: `„Postav si loď. Ne protože přijde potopa — ale protože jednoho dne někdo bude ve vodě."`,
    en: `“Build yourself a ship. Not because a flood is coming — but because one day someone will be in the water.”`,
  },
  locationLine: {
    cs: `Světové oceány · velrybí koridor · žádný pevný přístav`,
    en: `World oceans · the whale corridor · no fixed port`,
  },
  introTitle: { cs: `Třináctý uzel — přístav, který se pohybuje`, en: `The thirteenth node — a harbour that moves` },
  introBody: {
    cs: `Dvanáct uzlů L5 stojí na zemi. Třináctý je na vodě. Království srdce · Nirvana je archa: plující kolonie pro nejvýš sto lidí, semenný archiv, knihovna a plný uzel řetězce — a především loď, která se umí vrátit. Kde tři Marie vezou poutníky tam, archa veze cestu zpátky: pro člověka, pro semeno, pro knihu, pro dovednost.`,
    en: `Twelve L5 nodes stand on land. The thirteenth is on the water. Království srdce · Nirvana is an ark: a sailing colony for at most one hundred people, a seed vault, a library and a full node of the chain — and above all a ship that knows how to come back. Where the three Marys carry pilgrims outward, the ark carries the way home: for a person, for a seed, for a book, for a skill.`,
  },
  quarterTitle: { cs: `Čtvrté plavidlo`, en: `The fourth vessel` },
  quarterSubtitle: { cs: `Tři Marie vezou poutníky · archa veze přístav`, en: `Three Marys carry pilgrims · the ark carries the harbour` },
  quarterBody: {
    cs: `Když tři Marie vypluly na tři oceány, zůstala na břehu otázka, kterou plachta neodpoví: lodě poutníků vezou ty, kdo vyrazili. Kdo se vrátí pro člověka, který vyrazit nemůže? Archa není nová loď — je to ta samá loď, postavená znovu: větší, ocelová, se semeny místo zvířat a se sto lidmi místo osmi. Nese na kýlu totéž jméno, které nosí každý trup, jenž veze lidi domů: Království srdce.`,
    en: `When the three Marys sailed onto three oceans, one question stayed on the shore that no sail can answer: the pilgrims' ships carry those who set out. Who returns for the person who cannot? The ark is not a new ship — it is the same ship built again: larger, in steel, with seeds instead of animals and one hundred people instead of eight. On its keel it carries the same name every hull carries that brings people home: the Kingdom of the Heart.`,
  },
  quarterPoints: {
    cs: [
      `Čtvrtý trup vedle Tres Marías — ne poutník, ne most: přístav.`,
      `Posádka nejsou námořníci jedné sezóny, ale stovězinci — kolonie, která se obnovuje.`,
      `Každá kritická dovednost je na palubě dvakrát — po dvou ze všeho, i u strojů.`,
    ],
    en: [
      `A fourth hull beside the Tres Marías — not a pilgrim, not a bridge: a harbour.`,
      `The crew is not one season's sailors but hundred-dwellers — a colony that renews itself.`,
      `Every critical skill is aboard twice — two of everything, engines included.`,
    ],
  },
  whaleTitle: { cs: `Velrybí oběh — trasa, kterou neurčuje mapa`, en: `The whale circuit — a route no map decides` },
  whaleSubtitle: { cs: `Keporkaci · sezóny · uzly na obzoru`, en: `Humpbacks · seasons · nodes on the horizon` },
  whaleLead: {
    cs: `Keporkak dělá přesně to, co archa potřebuje: v létě se krmí v chladných produktivních vodách, v zimě rodí v tropech — a celou dobu se drží kontinentálních šelfů a seamountů. Jeho koridory se navíc střídají přesně v rytmu, ve kterém se střídají cyklónové sezóny obou hemisfér. Archa proto neplánuje trasu proti počasí, ale s ním: jede za velrybou, protože velryba ví, kudy je voda bezpečná. Každý úsek obvodu navštíví jeden L5 uzel — loď se tak stává pohyblivým článkem sítě, ne izolovaným bunkrem.`,
    en: `The humpback does exactly what the ark needs: it feeds in cold productive waters in summer, calves in the tropics in winter — and keeps to continental shelves and seamounts all the while. Its corridors also alternate in precisely the rhythm in which the two hemispheres' cyclone seasons alternate. So the ark does not plan against the weather but with it: it follows the whale, because the whale knows where the water is safe. Every leg of the circuit visits one L5 node — the ship becomes a moving link of the network, not an isolated bunker.`,
  },
  numbersTitle: { cs: `Čísla na jednom místě`, en: `The numbers in one place` },
  numbersSubtitle: { cs: `Poctivé rozpětí, ne slib`, en: `An honest range, not a promise` },
  numbersNote: {
    cs: `Hodnoty jsou z pracovních studií — parametry k ověření feasibility studií, ne závazek. Kýl položen není.`,
    en: `The figures come from working studies — parameters for a feasibility study to verify, not a commitment. No keel has been laid.`,
  },
  holdsTitle: { cs: `Co archa nese`, en: `What the ark carries` },
  holdsSubtitle: { cs: `Trup · kolonie · archiv`, en: `Hull · colony · archive` },
  phasesTitle: { cs: `Fáze rozvoje`, en: `Development phases` },
  phasesSubtitle: { cs: `Od studie k velrybímu obvodu`, en: `From study to the whale circuit` },
  patronTitle: { cs: `Patron archy — Malý princ v barvě moře`, en: `Patron of the ark — the Little Prince in the colour of the sea` },
  patronSubtitle: { cs: `Čtvrté roucho řady · mořská modř`, en: `The fourth robe of the row · sea blue` },
  patronBody: {
    cs: `Malý princ pluje na všech třech trupech Tres Marías — v červeném, bílém a zlatém rouše. Na arše dostává čtvrté: barvu moře. Není to estetika, je to řemeslo — smola, kterou se trup maže zevnitř i zvnitřku, se z modré vody rodí a do ní se vrací. Dítě stojí na přídi tam, kde María del Camino položila lucernu, drží svět v dlani a dívá se do tmy, kterou lucerna osvětluje.`,
    en: `The Little Prince sails on all three hulls of the Tres Marías — in red, white and gold robes. Aboard the ark he receives a fourth: the colour of the sea. It is not aesthetics, it is craft — the pitch that seals the hull inside and out is born of blue water and returns to it. The child stands on the prow where María del Camino set down her lantern, holds the world in his palm and looks into the dark the lantern illuminates.`,
  },
  keelTitle: { cs: `Jméno na kýlu`, en: `The name on the keel` },
  keelBody: {
    cs: `Království srdce není jméno nové lodi — je to jméno, které nese každý trup, jenž veze lidi domů. Začalo v dílně tesaře z Nazareta, pokračovalo lodí na Kinneretu a flotilou, která se schází, a na arše se vrací ve své největší podobě. Proto archa není pokračování příběhu o potopě. Je to příběh o tom, že voda nikdy nedostane poslední slovo.`,
    en: `The Kingdom of the Heart is not the name of a new ship — it is the name carried by every hull that brings people home. It began in a carpenter's workshop in Nazareth, continued with a boat on the Kinneret and a fleet that gathers, and returns aboard the ark in its largest form. Which is why the ark is not a continuation of the flood story. It is the story of water never getting the last word.`,
  },
  zionTitle: { cs: `Blockchain integrace`, en: `Blockchain integration` },
  openTitle: { cs: `Otevřené otázky`, en: `Open questions` },
  openItems: {
    cs: [
      `Novostavba plachetnice (~€70–100M, 4–6 let) vs. přestavba výzkumného trupu (~€30–55M, ~3,5 roku)?`,
      `Registry: zapsat program jako vizní uzel hned, nebo až po proveditelnostní studii?`,
      `Odolnost na okraji ledu — nutná, nebo stačí severní hranice velrybího pásma?`,
      `Kolonie znamená rodiny a děti: škola, porodnice a bezpečnostní standard na palubě?`,
      `Vztah k flotile — mateřská loď Marií, nebo sesterská linie?`,
      `Bezpečnostní doktrína neutrální svatyně — kde končí pomoc a začíná obrana?`,
    ],
    en: [
      `A purpose-built schooner (~€70–100M, 4–6 years) vs. a research-hull refit (~€30–55M, ~3.5 years)?`,
      `Registry: enrol the programme as a vision node now, or only after the feasibility study?`,
      `Ice-margin resilience — necessary, or is the northern edge of the whale band enough?`,
      `A colony means families and children: school, birth suite and a safety standard aboard?`,
      `Relation to the fleet — the Marys' mother ship, or a sister line?`,
      `Security doctrine of a neutral sanctuary — where does help end and defence begin?`,
    ],
  },
  threeD: { cs: `3D model archy`, en: `3D model of the ark` },
  threeDSubtitle: {
    cs: `Studie B3 — trup, tři stěžně, skleník na palubě a solární střecha. Keporkaci plují s ní.`,
    en: `Study B3 — hull, three masts, a glasshouse on deck and a solar roof. The humpbacks swim alongside.`,
  },
  decksTitle: { cs: `Dispozice palub — studie B3`, en: `Deck arrangement — study B3` },
  decksSubtitle: { cs: `Čtyři úrovně: technika, obydlí, společný život, můstek`, en: `Four levels: technical, accommodation, common life, bridge` },
  decksNote: {
    cs: `Konceptuální studie, ne výrobní plán. Pracovní délka ~85 m, komunita do 100 osob, ocelový trup s dřevěnými interiéry. Stabilitu, kapacitu a konstrukci musí ověřit námořní architekti.`,
    en: `A concept study, not a production plan. Roughly 85 m working length, a community of up to 100, a steel hull with wooden interiors. Stability, capacity and construction have to be verified by naval architects.`,
  },
  decks: {
    cs: [
      { name: 'Horní paluba', detail: 'Můstek, skleník, terasa, solární střecha, bezpečné obchozí paluby, navigační a komunikační zázemí.' },
      { name: 'Hlavní paluba', detail: 'Společná jídelna, kuchyně, knihovna a škola, tichá místnost, zdravotní ošetřovna, dílny a schodiště mezi palubami.' },
      { name: 'Obytná paluba', detail: 'Rodinné kajuty, kajuty s patrovými lůžky, společné sociální zázemí, prádelna, úložné prostory, kliďová zóna na přídi.' },
      { name: 'Technické zázemí', detail: 'Sklad potravin a materiálu, nádrže na vodu, bateriové úložiště, pomocné generátory, elektrický pohon 2×, servisní dílny, oddělené bezpečné členění.' },
    ],
    en: [
      { name: 'Upper deck', detail: 'Bridge, glasshouse, terrace, solar roof, safe walk-around decks, navigation and communications.' },
      { name: 'Main deck', detail: 'Common dining room, kitchen, library and school, quiet room, infirmary, workshops and the stair between decks.' },
      { name: 'Accommodation deck', detail: 'Family cabins, double-bunk cabins, shared sanitary facilities, laundry, storage, a quiet zone forward.' },
      { name: 'Technical spaces', detail: 'Food and material stores, water tanks, battery room, auxiliary generators, electric propulsion ×2, service workshops, separate safe subdivision.' },
    ],
  },
  systemsTitle: { cs: `Konstrukce a pohon`, en: `Construction and propulsion` },
  systems: {
    cs: [
      'Ocelová kostra a obšívka, vodotěsné členění, lehké nástavby, servisní přístup ke každému systému.',
      'Plachty jako hlavní pohon, pomocný elektrický pohon, baterie, solární střecha a nouzové generátory.',
      'Dřevěné interiéry a prosklené paluby: loď má být obyvatelná, ne jen plavitelná.',
    ],
    en: [
      'Steel frame and plating, watertight subdivision, light superstructures, service access to every system.',
      'Sail as primary propulsion, auxiliary electric drive, batteries, a solar roof and emergency generators.',
      'Wooden interiors and glazed decks: the ship should be habitable, not merely seaworthy.',
    ],
  },
  documentation: { cs: `Dokumentace`, en: `Documentation` },
  documentationSubtitle: {
    cs: `Koncept, velrybí navigace, bilance a čtyři technické studie — poctivě označené jako vize.`,
    en: `Concept, whale navigation, budgets and four technical studies — honestly labelled as a vision.`,
  },
  documentationLoading: { cs: `Načítání dokumentace…`, en: `Loading documentation…` },
  documentationError: { cs: `Dokumentaci se nepodařilo načíst.`, en: `Failed to load documentation.` },
  sisterTitle: { cs: `Síť Terra Nova`, en: `Terra Nova Network` },
  sisterSubtitle: { cs: `Dvanáct pevných uzlů a jedna plující linie`, en: `Twelve fixed nodes and one sailing line` },
  sisterBody: {
    cs: `Všechny uzly sdílí tentýž zdrojový kód: etiku Terra Nova, řetězec ZION, off-grid technologie, komunitní správu a semennou knihovnu. Archa je spojuje po vodě — a vrací se pro ty, kdo zůstali na břehu.`,
    en: `All nodes share the same source code: Terra Nova ethics, the ZION chain, off-grid technology, community governance and the seed library. The ark connects them by water — and returns for those left on the shore.`,
  },
  cta: {
    cs: `Hledáme Guardiany, kteří umí držet kurz — a ty, kdo rozumí lodím.`,
    en: `We are looking for Guardians who can hold a course — and for those who understand ships.`,
  },
  joinDiscord: { cs: `Připojit se na Discord`, en: `Join Discord` },
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
    icon: Users,
    titleCs: 'Kolonie do sta lidí',
    titleEn: 'A colony of up to one hundred',
    descCs: 'Ne posádka jedné expedice, ale společnost, která se obnovuje: rodiny, škola, porodnice, světinec a ústava pro sto. Kolem čtyřiceti kritických rolí je obsazeno dvakrát.',
    descEn: 'Not a single expedition’s crew but a society that renews itself: families, a school, a birth suite, a sanctuary and a constitution for one hundred. Around forty critical roles are covered twice.',
    color: '#0E7490',
    rgb: SEA,
  },
  {
    icon: Sprout,
    titleCs: 'Semenný archiv −18 °C',
    titleEn: 'Seed vault at −18 °C',
    descCs: 'Třicet až šedesát tisíc akcesí prioritních plodin, dvojí duplikát na souši. Banka, kterou loď zároveň jí (klíčky) a znovu zaseje — archiv jako spíž.',
    descEn: 'Thirty to sixty thousand accessions of priority crops, duplicated on land. A bank the ship also eats from (sprouts) and re-sows — the archive as larder.',
    color: '#066928',
    rgb: '6, 105, 40',
  },
  {
    icon: BookOpen,
    titleCs: 'Paměť, která pluje',
    titleEn: 'A memory that sails',
    descCs: 'Knihovna bez internetu: knihy, léčiva, návody, mapy, technická dokumentace a plný uzel řetězce v odstíněném rámu. Civilizační paměť mimo pevninu.',
    descEn: 'A library without the internet: books, medicines, manuals, charts, technical documentation and a full chain node in a shielded rack. Civilisational memory off the mainland.',
    color: '#F59E0B',
    rgb: '245, 158, 11',
  },
  {
    icon: Fish,
    titleCs: 'Velrybí navigace',
    titleEn: 'Whale navigation',
    descCs: 'Sezónní migrace mezi mírným pásmem a tropy — stejný rytmus, jakým se střídají cyklónové sezóny obou hemisfér. Trasa vede po šelfech a seamountech, kde je i rybolov.',
    descEn: 'Seasonal migration between the temperate band and the tropics — the same rhythm in which the two hemispheres’ cyclone seasons alternate. The route follows shelves and seamounts, where the fishing is too.',
    color: '#0EA5E9',
    rgb: '14, 165, 233',
  },
  {
    icon: Wheat,
    titleCs: 'Produkční paluby',
    titleEn: 'Production decks',
    descCs: 'Cíl 70–80 % kalorií z paluby: skleníková hydroponie, aquaponie, klíčárna, drůbež, králíci, mikro-kozy, spirulina — a rotující zásoby jako pojistka, ne jako základ.',
    descEn: 'A target of 70–80% of calories from the deck: greenhouse hydroponics, aquaponics, sprouting, poultry, rabbits, micro-goats, spirulina — with rotating stores as insurance, not as the base.',
    color: '#CA8A04',
    rgb: '202, 138, 4',
  },
  {
    icon: Droplets,
    titleCs: 'Voda a energie',
    titleEn: 'Water and energy',
    descCs: 'Odsolování plus střecha jako sběrač deště; fotovoltaická kůže, větrné turbíny na rámech a hydrogenerace za plavby. Nafta zůstává v lékárničce — na pohotovost, ne na život.',
    descEn: 'Desalination plus a roof that doubles as rain catchment; a photovoltaic skin, wind turbines on frames and hydro-generation under sail. Diesel stays in the medicine cabinet — for emergencies, not for living.',
    color: '#0891B2',
    rgb: '8, 145, 178',
  },
  {
    icon: Shield,
    titleCs: 'Ark mode',
    titleEn: 'Ark mode',
    descCs: 'Uzavřený profil pro mega-bouři: minimum otvorů pod palubou, trojoddílový standard, dvojité dno, sea anchor a citadela jádra. Cílem není ujet — cílem je přečkat.',
    descEn: 'A closed profile for a mega-storm: minimum openings below deck, three-compartment standard, double bottom, sea anchor and a citadel core. The goal is not to outrun it — the goal is to survive it.',
    color: '#7C3AED',
    rgb: '124, 58, 237',
  },
  {
    icon: Wrench,
    titleCs: 'Dílna a opravitelnost',
    titleEn: 'Workshop and repairability',
    descCs: 'Svařitelná ocel, soustruh, fréza, kovárna i plátenice — loď, která si umí ušít vlastní plachtu a vykovat vlastní díl. Elektronika je vrstva, ne páteř.',
    descEn: 'Weldable steel, a lathe, a mill, a forge and a sail loft — a ship that can sew its own sail and forge its own part. Electronics are a layer, not the spine.',
    color: '#B45309',
    rgb: '180, 83, 9',
  },
];

const WHALE_CYCLE = [
  {
    period: { cs: 'Prosinec – duben', en: 'December – April' },
    hemisphere: { cs: 'Severní zima', en: 'Northern winter' },
    whale: {
      cs: 'Karibik a Baja — rodiště, klidné teplé vody',
      en: 'Caribbean and Baja — calving grounds, calm warm water',
    },
    ark: { cs: 'Karibik → Kostarika (průchod Panamou v okně)', en: 'Caribbean → Costa Rica (Panama passage in the window)' },
    node: 'LUMI',
    href: '/terranova/nova-amerika',
  },
  {
    period: { cs: 'Duben – červen', en: 'April – June' },
    hemisphere: { cs: 'Severní přechod', en: 'Northern transition' },
    whale: { cs: 'Severní migrace podél šelfu', en: 'Northern migration along the shelf' },
    ark: { cs: 'Azory a Kanáry → Ibérie', en: 'Azores and Canaries → Iberia' },
    node: 'Genesis Garden',
    href: '/terranova/genesis',
  },
  {
    period: { cs: 'Červen – říjen', en: 'June – October' },
    hemisphere: { cs: 'Severní léto', en: 'Northern summer' },
    whale: { cs: 'Krmení Island, Norsko, Grónsko', en: 'Feeding off Iceland, Norway, Greenland' },
    ark: { cs: 'Ibérie → Azory → mírný Atlantik (archa zůstává níž)', en: 'Iberia → Azores → temperate Atlantic (the ark stays lower)' },
    node: 'Tomar · Galicie',
    href: '/terranova/genesis',
  },
  {
    period: { cs: 'Říjen – listopad', en: 'October – November' },
    hemisphere: { cs: 'Přechod na jih', en: 'Southward transition' },
    whale: { cs: 'Jižní migrace k rovníku', en: 'Southern migration toward the equator' },
    ark: { cs: 'Kapverdy → rovníkový průchod', en: 'Cape Verde → equatorial passage' },
    node: '—',
    href: '',
  },
  {
    period: { cs: 'Červen – říjen', en: 'June – October' },
    hemisphere: { cs: 'Jižní zima', en: 'Southern winter' },
    whale: { cs: 'Tonga, Fidži, Raiatea, Mosambik — rodiště', en: 'Tonga, Fiji, Raiatea, Mozambique — calving grounds' },
    ark: { cs: 'Tahiti a Raiatea → Tonga → Fidži', en: 'Tahiti and Raiatea → Tonga → Fiji' },
    node: 'Te Pīko Ora',
    href: '/terranova/te-piko-ora',
  },
  {
    period: { cs: 'Listopad – březen', en: 'November – March' },
    hemisphere: { cs: 'Jižní léto', en: 'Southern summer' },
    whale: { cs: 'Krmení u Antarktidy — archa jde jen na okraj (~40–50° j. š.)', en: 'Feeding off Antarctica — the ark only goes to the edge (~40–50° S)' },
    ark: { cs: 'Nový Zéland → jižní Afrika', en: 'New Zealand → southern Africa' },
    node: 'Boa Esperança',
    href: '/terranova/boa-esperanca',
  },
  {
    period: { cs: 'Celoročně', en: 'Year-round' },
    hemisphere: { cs: 'Indický oceán', en: 'Indian Ocean' },
    whale: { cs: 'Jediná nemigrující populace — Arabské moře', en: 'The only non-migrating population — the Arabian Sea' },
    ark: { cs: 'Okruh Indickým oceánem', en: 'A circuit of the Indian Ocean' },
    node: 'Bodhi Lanka',
    href: '/terranova/bodhi-lanka',
  },
];

const NUMBERS: { labelCs: string; labelEn: string; valueCs: string; valueEn: string; icon: LucideIcon }[] = [
  { labelCs: 'Lidé', labelEn: 'People', valueCs: '≤ 100', valueEn: '≤ 100', icon: Users },
  { labelCs: 'Trup', labelEn: 'Hull', valueCs: '78–90 × 16–18 m', valueEn: '78–90 × 16–18 m', icon: Ship },
  { labelCs: 'Plachty', labelEn: 'Sail plan', valueCs: '2 500–4 000 m²', valueEn: '2,500–4,000 m²', icon: Wind },
  { labelCs: 'Baterie', labelEn: 'Battery', valueCs: '2–4 MWh', valueEn: '2–4 MWh', icon: Sun },
  { labelCs: 'Voda', labelEn: 'Water', valueCs: '~8 m³ / den', valueEn: '~8 m³ / day', icon: Droplets },
  { labelCs: 'Potrava z paluby', labelEn: 'Food from the deck', valueCs: '70–80 %', valueEn: '70–80%', icon: Wheat },
  { labelCs: 'Semenný archiv', labelEn: 'Seed vault', valueCs: '30–60 tis. akcesí', valueEn: '30–60k accessions', icon: Sprout },
  { labelCs: 'Autonomie', labelEn: 'Autonomy', valueCs: '180 dní plná', valueEn: '180 days full', icon: Thermometer },
  { labelCs: 'Obvod', labelEn: 'Circuit', valueCs: '~30 000 nm / 2–3 roky', valueEn: '~30,000 nm / 2–3 yrs', icon: Route },
  { labelCs: 'Proporce trupu', labelEn: 'Hull ratio', valueCs: 'L : B ≈ 6 : 1', valueEn: 'L : B ≈ 6 : 1', icon: Compass },
  { labelCs: 'CAPEX', labelEn: 'CAPEX', valueCs: '€30–55M refit · €70–100M novostavba', valueEn: '€30–55M refit · €70–100M newbuild', icon: Landmark },
  { labelCs: 'Horizont', labelEn: 'Horizon', valueCs: '3,5–6 let od studie', valueEn: '3.5–6 years from study', icon: Calendar },
];

const PHASES = [
  {
    num: '0',
    cs: 'Studie',
    en: 'Study',
    descCs: 'Proveditelnostní a koncepční studie s námořním architektem, specifikace stolidé kolonie, energetická a potravinová bilance, raný dialog s klasifikační společností a vlajkou.',
    descEn: 'Feasibility and concept study with a naval architect, specification for a hundred-person colony, energy and food budgets, early class and flag dialogue.',
    active: true,
  },
  {
    num: '1',
    cs: 'Registr a financování',
    en: 'Registry and funding',
    descCs: 'Zápis programu do L5 registru jako vizní uzel s nulovým rozpočtem, partnerská mapa — genbanky, námořní architekti, záchranné a nemocniční lodi.',
    descEn: 'Enrol the programme in the L5 registry as a vision node with zero budget; a partnership map — gene banks, naval architects, rescue and hospital ships.',
    active: false,
  },
  {
    num: '2',
    cs: 'Trup',
    en: 'Hull',
    descCs: 'Přestavba výzkumného trupu (rychlejší cesta) nebo novostavba plachetnice s arkózními proporcemi; trials a certifikace.',
    descEn: 'A research-hull refit (the faster path) or a purpose-built schooner with ark proportions; trials and certification.',
    active: false,
  },
  {
    num: '3',
    cs: 'Shakedown',
    en: 'Shakedown',
    descCs: 'Zkušební okruh Atlantikem a první uzlová linka: farm deck v provozu, semenný archiv v tepelném cyklu, posádka ve dvou.',
    descEn: 'A shakedown circuit across the Atlantic and the first node link: farm deck in operation, seed vault through a full thermal cycle, crew doubled up.',
    active: false,
  },
  {
    num: '4',
    cs: 'Velrybí obvod',
    en: 'The whale circuit',
    descCs: 'Plný dvou- až tříletý obvod přes všechny uzly sítě — archa se stává pohyblivým článkem sítě a záchrannou paží.',
    descEn: 'The full two- to three-year circuit across every node of the network — the ark becomes a moving link of the network and a rescue arm.',
    active: false,
  },
];

const ZION_ITEMS: { label: string; icon: LucideIcon }[] = [
  { label: 'ZION L1 Node', icon: Network },
  { label: 'DAO Governance', icon: Users },
  { label: 'Guardian Wallet', icon: Shield },
  { label: 'L5 Humanitarian Tithe', icon: Heart },
  { label: 'Mesh Relay', icon: Radio },
  { label: 'Seed Library', icon: Leaf },
];

const SISTERS = [
  { name: 'Zahrada Genesis', href: '/terranova/genesis', region: { cs: 'Sabacheira · Tomar, Portugalsko', en: 'Sabacheira · Tomar, Portugal' } },
  { name: 'Dharma Temple', href: '/terranova/dharma-temple', region: { cs: 'La Palma', en: 'La Palma' } },
  { name: 'Te Pīko Ora', href: '/terranova/te-piko-ora', region: { cs: 'Raiatea · Polynésie', en: 'Raiatea · Polynesia' } },
  { name: 'Golden Republic Bohemia', href: '/terranova/golden-republic-bohemia', region: { cs: 'Čechy', en: 'Bohemia' } },
  { name: 'Bodhi Lanka', href: '/terranova/bodhi-lanka', region: { cs: 'Srí Lanka', en: 'Sri Lanka' } },
  { name: 'LUMI · Nová Amerika', href: '/terranova/nova-amerika', region: { cs: 'Kostarika', en: 'Costa Rica' } },
  { name: 'Uluru', href: '/terranova/uluru', region: { cs: 'Northern Territory, Austrálie', en: 'Northern Territory, Australia' } },
  { name: 'María del Camino', href: '/terranova/maria-del-camino', region: { cs: 'Světové oceány · Tres Marías', en: 'World oceans · Tres Marías' } },
  { name: 'Boa Esperança', href: '/terranova/boa-esperanca', region: { cs: 'Mys dobré naděje', en: 'Cape of Good Hope' } },
  { name: 'Ekam · Oneness Temple', href: '/terranova/ekam', region: { cs: 'Andhra Pradesh, Indie', en: 'Andhra Pradesh, India' } },
  { name: 'Kailash', href: '/terranova/kailash', region: { cs: 'Ngari, Tibet', en: 'Ngari, Tibet' } },
  { name: 'Amenti', href: '/terranova/amenti', region: { cs: 'Gíza, Egypt', en: 'Giza, Egypt' } },
];

export default function KralovstviSrdcePage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [doc, setDoc] = useState<string | null>(null);
  const [docError, setDocError] = useState(false);

  useEffect(() => {
    const file = cs
      ? '/docs/terranova/kralovstvi-srdce.cs.md'
      : '/docs/terranova/kralovstvi-srdce.en.md';
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
            {tx5(Copy.backToTerraNova, lang)}
          </Link>
        </motion.div>

        {/* ═══ HERO ═══ */}
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': SEA } as React.CSSProperties}>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="shrink-0 w-20 h-20 flex items-center justify-center overflow-hidden zion-rainbow-sub" style={{ '--rc': SEA } as React.CSSProperties}>
                  <img
                    src="/images/kralovstvi-srdce/seal.webp"
                    alt={cs ? 'Pečeť Království srdce' : t5('The Kingdom of the Heart seal', lang)}
                    width={80}
                    height={80}
                    loading="eager"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="zion-badge">L5 · 13. uzel · Terra Nova</span>
                    <span className="zion-badge-gold inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {tx5(Copy.stage, lang)}
                    </span>
                  </div>

                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gradient">
                    {tx5(
                      {
                        cs: 'Království srdce · Nirvana',
                        en: 'Kingdom of the Heart · Nirvana',
                        es: 'Reino del Corazón · Nirvana',
                        pt: 'Reino do Coração · Nirvana',
                        fr: 'Royaume du Cœur · Nirvana',
                      },
                      lang,
                    )}
                  </h1>
                  <p className="text-lg text-cyan-300 font-medium">
                    {tx5(Copy.subtitle, lang)}
                  </p>

                  <div className="flex items-center gap-1.5 text-white/70">
                    <MapPin className="w-4 h-4 text-white/85 shrink-0" />
                    <span className="text-sm">{tx5(Copy.locationLine, lang)}</span>
                  </div>

                  <blockquote className="mt-4 pl-4 border-l-2 border-white/10 text-sm text-white/70 italic leading-relaxed max-w-lg">
                    {tx5(Copy.quote, lang)}
                  </blockquote>

                  <div className="grid gap-3 pt-3 sm:grid-cols-3">
                    {[
                      { icon: Users, value: '≤ 100', labelCs: 'Lidí na palubě', labelEn: 'People aboard' },
                      { icon: Fish, value: '~30 000 nm', labelCs: 'Velrybí obvod', labelEn: 'Whale circuit' },
                      { icon: Waves, value: cs ? '13. uzel' : t5('13th node', lang), labelCs: 'Stav: vize', labelEn: 'Status: vision' },
                    ].map((signal) => {
                      const Icon = signal.icon;
                      return (
                        <div key={signal.labelCs} className="zion-rainbow-sub px-3 py-3" style={{ '--rc': SEA } as React.CSSProperties}>
                          <div className="flex items-center gap-2 text-cyan-300">
                            <Icon className="h-4 w-4" />
                            <span className="text-sm font-semibold">{signal.value}</span>
                          </div>
                          <p className="text-[11px] uppercase tracking-widest text-gray-500 mt-1">
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
                src="/images/kralovstvi-srdce/hero.webp"
                srcSet="/images/kralovstvi-srdce/hero-m.webp 960w, /images/kralovstvi-srdce/hero.webp 1600w"
                sizes="(max-width: 1320px) calc(100vw - 2rem), 1280px"
                alt={cs
                  ? 'Království srdce — archa za západu slunce u pobřeží Nové země, na přídi Malý princ a dívka s lucernou, u boku keporkak'
                  : 'The Kingdom of the Heart — the ark at sunset off the shore of the new world, the Little Prince and a girl with a lantern on the prow, a humpback alongside'}
                width={1600}
                height={639}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="w-full object-cover"
              />
            </div>
          </div>
        </motion.header>

        {/* ═══ 3D MODEL ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05, duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-4 md:p-5" style={{ '--rc': SEA } as React.CSSProperties}>
            <div className="relative z-10 mb-4 text-center">
              <p className="text-[11px] uppercase tracking-[0.45em] text-zion-gold/65 mb-1">
                {tx5(Copy.threeD, lang)}
              </p>
              <h2 className="text-xl font-bold text-white">
                {tx5(Copy.threeDSubtitle, lang)}
              </h2>
            </div>
            <KralovstviSrdcePreviewLazy lang={lang} className="w-full" />
          </div>
        </motion.section>

        {/* ═══ INTRO ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': SEA } as React.CSSProperties}>
            <h2 className="text-2xl md:text-3xl font-semibold text-white mb-4">
              {tx5(Copy.introTitle, lang)}
            </h2>
            <p className="text-gray-300 leading-relaxed">
              {tx5(Copy.introBody, lang)}
            </p>
          </div>
        </motion.section>

        {/* ═══ FOURTH VESSEL ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(Copy.quarterSubtitle, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Anchor className="h-7 w-7 text-cyan-400" />
              {tx5(Copy.quarterTitle, lang)}
            </h2>
          </div>
          <div className="zion-rainbow-card p-6 md:p-10 mb-4" style={{ '--rc': SEA } as React.CSSProperties}>
            <p className="text-gray-300 leading-relaxed">
              {tx5(Copy.quarterBody, lang)}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {(lang === 'cs' ? Copy.quarterPoints.cs : Copy.quarterPoints.en).map((point, i) => {
                const PointIcon = [Ship, Users, Shield][i];
                return (
                  <div key={point} className="zion-rainbow-sub px-4 py-3" style={{ '--rc': SEA } as React.CSSProperties}>
                    <div className="flex items-center gap-2 text-cyan-300 mb-1">
                      <PointIcon className="h-4 w-4" />
                      <span className="text-[11px] uppercase tracking-widest text-gray-500">
                        {cs ? 'Princip' : t5('Principle', lang)} {i + 1}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300">{point}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <img
                src="/images/kralovstvi-srdce/shipyard.webp"
                alt={cs
                  ? 'Tesař z Nazareta hoblí trám pro velkou archu — v dílně, kde příběh začal, s Malým princem a dívkou s lucernou'
                  : 'The carpenter of Nazareth planes a beam for the great ark — in the workshop where the story began, watched by the Little Prince and the girl with the lantern'}
                width={1280}
                height={720}
                loading="lazy"
                decoding="async"
                className="w-full object-cover"
              />
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <img
                src="/images/kralovstvi-srdce/paradise.webp"
                alt={cs
                  ? 'Zahrada a chrám na břehu s plujícími loděmi — představa kolonie, kterou archa zásobuje'
                  : 'A garden and temple on the shore with sailing ships — the colony the ark supplies'}
                width={1280}
                height={720}
                loading="lazy"
                decoding="async"
                className="w-full object-cover"
              />
            </div>
          </div>
          <p className="mt-3 text-center text-xs leading-relaxed text-white/50">
            {cs
              ? 'Vize, ne stavba: kýl archy položen není. Obrázky jsou ilustrace směru, kterým se studie ubírá.'
              : 'A vision, not a construction: no keel has been laid. The images illustrate the direction the studies are taking.'}
          </p>
        </motion.section>

        {/* ═══ DECK ARRANGEMENT (B3) ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(Copy.decksSubtitle, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Compass className="h-7 w-7 text-cyan-400" />
              {tx5(Copy.decksTitle, lang)}
            </h2>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 mb-4">
            <img
              src="/images/kralovstvi-srdce/deck-plans.webp"
              srcSet="/images/kralovstvi-srdce/deck-plans-m.webp 960w, /images/kralovstvi-srdce/deck-plans.webp 1536w"
              sizes="(max-width: 1100px) calc(100vw - 2rem), 1024px"
              alt={cs
                ? 'Studie B3 — obytná archa inspirovaná keporkakem: čtyři paluby, interiéry, konstrukce a pohon'
                : 'Study B3 — a residential ark inspired by the humpback: four decks, interiors, construction and propulsion'}
              width={1536}
              height={1024}
              loading="lazy"
              decoding="async"
              className="w-full object-contain"
            />
          </div>
          <p className="mb-6 text-center text-xs leading-relaxed text-white/50">
            {tx5(Copy.decksNote, lang)}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(lang === 'cs' ? Copy.decks.cs : Copy.decks.en).map((deck, i) => {
              const DeckIcon = [Sun, Users, Heart, Wrench][i];
              return (
                <div key={deck.name} className="zion-rainbow-sub p-4" style={{ '--rc': SEA } as React.CSSProperties}>
                  <div className="flex items-center gap-2 text-cyan-300 mb-1">
                    <DeckIcon className="h-4 w-4" />
                    <span className="text-sm font-semibold text-white">{deck.name}</span>
                  </div>
                  <p className="text-sm text-gray-400">{deck.detail}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 zion-rainbow-sub p-5" style={{ '--rc': '202, 138, 4' } as React.CSSProperties}>
            <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
              <Waves className="h-4 w-4 text-amber-300" />
              {tx5(Copy.systemsTitle, lang)}
            </h3>
            <ul className="list-disc pl-4 space-y-1.5 text-sm text-gray-400">
              {(lang === 'cs' ? Copy.systems.cs : Copy.systems.en).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </motion.section>

        {/* ═══ WHALE CIRCUIT ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
            <div className="mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(Copy.whaleSubtitle, lang)}</p>
              <h2 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-3 mt-1">
                <Fish className="h-7 w-7 text-sky-400" />
                {tx5(Copy.whaleTitle, lang)}
              </h2>
            </div>
            <p className="text-gray-300 leading-relaxed mb-8">
              {tx5(Copy.whaleLead, lang)}
            </p>
            <div className="space-y-3">
              {WHALE_CYCLE.map((leg, i) => (
                <div
                  key={`${leg.period.cs}-${i}`}
                  className="zion-rainbow-sub p-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4"
                  style={{ '--rc': '14, 165, 233' } as React.CSSProperties}
                >
                  <div className="shrink-0 sm:w-40">
                    <p className="text-sm font-semibold text-white">{tx5(leg.period, lang)}</p>
                    <p className="text-[11px] uppercase tracking-widest text-gray-500">{tx5(leg.hemisphere, lang)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-sky-200/90 flex items-start gap-2">
                      <Fish className="h-4 w-4 mt-0.5 shrink-0 text-sky-400" />
                      <span>{tx5(leg.whale, lang)}</span>
                    </p>
                    <p className="mt-1 text-sm text-gray-400 flex items-start gap-2">
                      <Ship className="h-4 w-4 mt-0.5 shrink-0 text-cyan-400" />
                      <span>{tx5(leg.ark, lang)}</span>
                    </p>
                  </div>
                  <div className="shrink-0 sm:w-40 sm:text-right">
                    <p className="text-[11px] uppercase tracking-widest text-gray-500">{cs ? 'uzel' : t5('node', lang)}</p>
                    {leg.href ? (
                      <Link href={leg.href} className="text-sm text-zion-gold hover:text-zion-gold/80 transition-colors">
                        {leg.node}
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-500">{leg.node}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs leading-relaxed text-white/50">
              {cs
                ? 'Trasa se vyhýbá cyklónovým oknům obou hemisfér, průlivy s bezpečnostním rizikem proplouvá v konvojích a k okraji ledu zajíždí jen jako do rezervy — velryby můžou výš, archa ne.'
                : 'The route avoids both hemispheres’ cyclone windows, passes security-risk straits in convoy, and only visits the ice edge as a reserve — whales may go higher, the ark does not.'}
            </p>
          </div>
        </motion.section>

        {/* ═══ NUMBERS ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(Copy.numbersSubtitle, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Compass className="h-7 w-7 text-cyan-400" />
              {tx5(Copy.numbersTitle, lang)}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {NUMBERS.map((item) => (
              <div key={item.labelCs} className="zion-rainbow-sub p-4" style={{ '--rc': SEA } as React.CSSProperties}>
                <div className="flex items-center gap-2 text-cyan-300 mb-1">
                  <item.icon className="h-4 w-4" />
                  <span className="text-[11px] uppercase tracking-widest text-gray-500">
                    {cs ? item.labelCs : item.labelEn}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white">{cs ? item.valueCs : item.valueEn}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-white/50">{tx5(Copy.numbersNote, lang)}</p>
        </motion.section>

        {/* ═══ WHAT IT HOLDS ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(Copy.holdsSubtitle, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Ship className="h-7 w-7 text-cyan-400" />
              {tx5(Copy.holdsTitle, lang)}
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

        {/* ═══ PHASES ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': SEA } as React.CSSProperties}>
            <div className="mb-8">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(Copy.phasesSubtitle, lang)}</p>
              <h2 className="text-3xl font-semibold text-white">{tx5(Copy.phasesTitle, lang)}</h2>
            </div>
            <div className="space-y-4">
              {PHASES.map((phase) => (
                <div key={phase.num} className="zion-rainbow-sub p-5 flex gap-4" style={{ '--rc': SEA } as React.CSSProperties}>
                  <div
                    className={`shrink-0 w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm ${
                      phase.active ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300' : 'border-white/10 bg-white/5 text-gray-500'
                    }`}
                  >
                    {phase.num}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">
                      {cs ? phase.cs : phase.en}
                      {phase.active && (
                        <span className="ml-2 text-[11px] uppercase tracking-widest text-cyan-300">
                          · {cs ? 'probíhá' : t5('in progress', lang)}
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-400">{cs ? phase.descCs : phase.descEn}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ═══ PATRON + KEEL ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '245, 222, 130' } as React.CSSProperties}>
            <div className="flex flex-col md:flex-row gap-8">
              <div className="md:w-2/5 shrink-0">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                  <img
                    src="/images/kralovstvi-srdce/seal.webp"
                    alt={cs
                      ? 'Pečeť Království srdce — srdce, plachetnice, mušle a hvězda nad oceánem'
                      : 'The Kingdom of the Heart seal — a heart, a sailing ship, a shell and a star over the ocean'}
                    width={512}
                    height={512}
                    loading="lazy"
                    decoding="async"
                    className="w-full object-contain"
                  />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500 mb-1">{tx5(Copy.patronSubtitle, lang)}</p>
                <h2 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-3 mb-4">
                  <Crown className="h-7 w-7 text-amber-200" />
                  {tx5(Copy.patronTitle, lang)}
                </h2>
                <p className="text-gray-300 leading-relaxed mb-6">{tx5(Copy.patronBody, lang)}</p>
                <div className="border-t border-white/10 pt-5">
                  <div className="flex items-center gap-2 text-amber-200 mb-2">
                    <Feather className="h-4 w-4" />
                    <span className="text-[11px] uppercase tracking-widest text-gray-500">{tx5(Copy.keelTitle, lang)}</span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{tx5(Copy.keelBody, lang)}</p>
                </div>
                <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                  <img
                    src="/images/kralovstvi-srdce/timeline.webp"
                    alt={cs
                      ? 'Časová osa sítě: 2008 EvoluZion · 2012 Srdce Amenti · 2026 Nirvana · 2029 OASIS · L6 Issobella'
                      : 'Timeline of the network: 2008 EvoluZion · 2012 Heart of Amenti · 2026 Nirvana · 2029 OASIS · L6 Issobella'}
                    width={1600}
                    height={639}
                    loading="lazy"
                    decoding="async"
                    className="w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══ ZION + OPEN QUESTIONS ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div className="zion-rainbow-card p-6" style={{ '--rc': SEA } as React.CSSProperties}>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <Network className="h-5 w-5 text-cyan-300" />
                {tx5(Copy.zionTitle, lang)}
              </h2>
              <div className="flex flex-wrap gap-2">
                {ZION_ITEMS.map((item) => (
                  <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                    <item.icon className="h-3 w-3" />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="zion-rainbow-card p-6" style={{ '--rc': SEA } as React.CSSProperties}>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <Landmark className="h-5 w-5 text-cyan-300" />
                {tx5(Copy.openTitle, lang)}
              </h2>
              <ul className="list-disc pl-4 text-sm text-gray-400 space-y-2">
                {(lang === 'cs' ? Copy.openItems.cs : Copy.openItems.en).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
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
            <h2 className="text-2xl font-semibold text-white">{tx5(Copy.documentation, lang)}</h2>
            <p className="text-sm text-gray-500">{tx5(Copy.documentationSubtitle, lang)}</p>
          </div>
          {doc ? (
            <DocMarkdownArticle content={doc} className="zion-docs-prose max-w-4xl mx-auto" />
          ) : docError ? (
            <p className="text-sm text-gray-500">{tx5(Copy.documentationError, lang)}</p>
          ) : (
            <p className="text-sm text-gray-500">{tx5(Copy.documentationLoading, lang)}</p>
          )}
        </motion.section>

        {/* ═══ SISTERS + CTA ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <div className="mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(Copy.sisterSubtitle, lang)}</p>
              <h2 className="text-2xl font-semibold text-white">{tx5(Copy.sisterTitle, lang)}</h2>
              <p className="text-sm text-gray-400 mt-2">{tx5(Copy.sisterBody, lang)}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SISTERS.map((s) => (
                <Link key={s.name} href={s.href} className="zion-rainbow-sub p-4 group hover:bg-white/5 transition-colors" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-white text-sm">{s.name}</h3>
                      <p className="text-xs text-gray-500">{cs ? s.region.cs : s.region.en}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-zion-gold/60 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-8 text-center">
              <p className="text-gray-300 mb-4">{tx5(Copy.cta, lang)}</p>
              <a
                href="https://discord.gg/zionterranova"
                target="_blank"
                rel="noopener noreferrer"
                className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
              >
                {tx5(Copy.joinDiscord, lang)} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
