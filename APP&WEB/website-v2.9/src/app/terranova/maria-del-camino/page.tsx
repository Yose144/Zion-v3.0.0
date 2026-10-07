'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Anchor,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Compass,
  Crown,
  Feather,
  Heart,
  Landmark,
  LucideIcon,
  MapPin,
  Network,
  Radio,
  Route,
  Sailboat,
  Shell,
  Shield,
  Ship,
  Sparkles,
  Sun,
  Users,
  Waves,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

const DocMarkdownArticle = dynamic(() => import('@/components/docs/DocMarkdownArticle'), { ssr: false });

const Copy = {
  backToTerraNova: { cs: `Zpět na Terra Nova`, en: `Back to Terra Nova` },
  researchStage: { cs: `Příprava — výzkum plavidla`, en: `Preparation — vessel research` },
  subtitle: { cs: `Plující uzel · Tres Marias — tři lodě, tři oceány · Solární plachty · Terra Nova ®`, en: `The Sailing Node · Tres Marias — three ships, three oceans · Solar Sails · Terra Nova ®` },
  quote: {
    cs: `"Ultreia et suseia — vpřed a výš."`,
    en: `"Ultreia et suseia — onward and upward."`,
  },
  locationLine: { cs: `Světové oceány · domovský přístav Galicie`, en: `World oceans · home port Galicia` },
  introTitle: { cs: `Osmý uzel — cesta, ne místo`, en: `The eighth node — a way, not a place` },
  introBody: {
    cs: `María del Camino je osmý bod L5 Free World — a jediný, který není místo, ale cesta. Flotila Tres Marias — tři lodě pro tři oceány, každá nesoucí jedno ze tří mariánských zjevení poutníkovy cesty: atlantická plachetnice Santa María la Mayor (červená královská roucha), pacifický solární katamarán Nossa Senhora de Fátima (bílé svatební šaty) a indickooceánská María de las Nieves (zlatá roucha, nedokončené zázraky). Zhruba padesát poutníků na trup, solární plachty, vlastní energie, voda, jídlo i plný ZION uzel zprostřed oceánu.`,
    en: `María del Camino is the eighth point of L5 Free World — and the only one that is not a place but a way. The Tres Marias fleet — three ships for three oceans, each carrying one of the three Marian apparitions of the pilgrim's journey: the Atlantic tall ship Santa María la Mayor (red royal robes), the Pacific solar catamaran Nossa Senhora de Fátima (white wedding dress) and the Indian-ocean María de las Nieves (golden robes, unfinished miracles). Roughly fifty pilgrims per hull, solar sails, their own energy, water, food and a full ZION node mid-ocean.`,
  },
  fleetTitle: { cs: `Tři lodě — tres Marias`, en: `Three ships — tres Marias` },
  fleetSubtitle: { cs: `Tři zjevení · tři oceány · scháziště LUMI a Cape`, en: `Three apparitions · three oceans · LUMI & the Cape seam` },
  fleetAtlantic: {
    cs: `Klasická plachetnice v tradici Camina — pokřtěná po prvním zjevení v Pontevedře, kde se María Mayor ukázala v červených královských rouchech jako španělská královna. Domácí voda Galicie; trasa Finisterre → Lisabon (odbočka Tomar–Sabacheira) → La Palma → karibský břeh LUMI, severský výběžek Labem k Bohemii.`,
    en: `A classic sailing ship in the Camino tradition — christened after the first apparition at Pontevedra, where María Mayor appeared in red royal robes like a Spanish queen. Home waters Galicia; route Finisterre → Lisbon (Tomar–Sabacheira detour) → La Palma → the Caribbean shore of LUMI, with a northern sortie up the Elbe to Bohemia.`,
  },
  fleetPacific: {
    cs: `Solární katamarán v linii wa'a kaulua — pokřtěný po druhém zjevení u Fátimy, kde se objevila Bílá Paní ve svatebních šatech: mystická svatba, bílá orchidej, nové zjevení. Domov Te Pīko Ora (Raiatea); trasa Kostarika → Polynésie → australské pobřeží → Srí Lanka → Ekam.`,
    en: `A solar catamaran in the wa'a kaulua line — christened after the second apparition near Fátima, where the White Lady appeared in a wedding dress: the mystical wedding, the white orchid, the new apparition. Home Te Pīko Ora (Raiatea); route Costa Rica → Polynesia → Aboriginal Australia → Sri Lanka → Ekam.`,
  },
  fleetIndian: {
    cs: `Třetí loď pro Indický oceán — pokřtěná po třetím zjevení na La Palmě: María de las Nieves ve zlatých rouchech, držící vzpřímené dítě — Malého prince (Pražské Jezulátko), dítě LUMI, Elizabeth. Loď nedokončených zázraků; patronka ostrova i celé sítě. Trasa Ekam → Boa Esperança → návrat do Atlantiku.`,
    en: `The third ship for the Indian Ocean — christened after the third apparition on La Palma: María de las Nieves in golden robes, holding the upright child — the Little Prince (the Infant of Prague), the child LUMI, Elizabeth. The ship of unfinished miracles; patroness of the island and the whole network. Route Ekam → Boa Esperança → return to the Atlantic.`,
  },
  fleetMeet: {
    cs: `Tři Marie se nescházejí uprostřed moře — jejich světy se dotýkají na švech světa: na šíji Amerik (LUMI — atlantická × pacifická) a na švu oceánů u Mysu dobré naděje (Boa Esperança — atlantická × indická). Credencial sbírá razítka „tří moří".`,
    en: `The three Marys do not meet mid-ocean — their worlds touch at the seams of the world: on the isthmus of the Americas (LUMI — Atlantic × Pacific) and on the ocean seam at the Cape of Good Hope (Boa Esperança — Atlantic × Indian). The credencial collects the "three seas" stamps.`,
  },
  patronTitle: { cs: `Patron flotily — Malý princ`, en: `Patron of the fleet — the Little Prince` },
  patronSubtitle: { cs: `Pražské Jezulátko · dítě Lumi · zrod nového světa`, en: `The Infant of Prague · the child of Lumi · the birth of the new world` },
  patronBody: {
    cs: `Patronem cest všech tří Marií je Malý princ — dítě ze zlatého zjevení na La Palmě, jehož tváří je Pražské Jezulátko: dítě-král v rouše a korunce, jež v dlani drží celý svět. Dítě, které kdysi poputovalo ze Španělska do Prahy — ze země moří do země bez moře — se teď na lodích vrací na vodu. V příběhu sítě je to dítě linie LUMI / Elizabeth — a zároveň platí: každý z nás je malý princ, když se plně probudí.`,
    en: `The patron of all three Marys' journeys is the Little Prince — the child of the golden apparition on La Palma, whose face is the Infant Jesus of Prague: the child-king in robes and crown, holding the whole world in his little palm. The child who once travelled from Spain to Prague — from a land of seas to a land without one — now sails back to the water aboard the fleet. In the network's story he is the child of the LUMI / Elizabeth line — and at the same time: each of us is the little prince, once fully awake.`,
  },
  patronPoints: {
    cs: [
      `Každý trup jej nese ve své barvě — červené roucho na Santa María la Mayor, bílé na Nossa Senhora de Fátima, zlaté na María de las Nieves; tak, jak se Jezulátko po staletí obléká do liturgických barev`,
      `Svět v dětské dlani — jablko s křížkem čteme jako planetu nesenou v ruce dítěte: zrod nového světa, ne jeho dobytí`,
      `Patron, který už plul — obraz Dítěte přeplul Pacifik na manilské galeoně (Santo Niño de Cebú, 1521/1565); pacifický trup jde jeho trasou`,
    ],
    en: [
      `Each hull carries him in its own colour — red robes aboard Santa María la Mayor, white aboard Nossa Senhora de Fátima, gold aboard María de las Nieves — just as the Infant has been dressed in liturgical colours for centuries`,
      `The world in a child's palm — the orb is read as the planet carried in a child's hand: the birth of a new world, not its conquest`,
      `A patron who has already sailed — an image of the Child crossed the Pacific on a Manila galleon (Santo Niño de Cebú, 1521/1565); the Pacific hull follows his route`,
    ],
  },
  routeTitle: { cs: `Velká cesta — obeplutí světa`, en: `The Great Route — around the world` },
  routeSubtitle: { cs: `Každý uzel = jedna iniciace · credencial tří moří`, en: `Every node is an initiation · the three-seas credencial` },
  routeLead: {
    cs: `Trasa není servisní okruh — je to cesta, kterou si poutník vydobude. Dvanáct zastávek, tři oceány, tři lodě — a návrat jiným člověkem. Štafeta se předává na švech světa: atlantická Marie podává pacifické v LUMI, pacifická indické u Ekamu, indická se vrací s atlantickou na Mysu.`,
    en: `The route is no service loop — it is a journey the pilgrim earns. Twelve stops, three oceans, three ships — and a return as someone else. The baton passes at the seams of the world: the Atlantic Mary hands off to the Pacific at LUMI, the Pacific to the Indian at Ekam, and the Indian meets the Atlantic again at the Cape.`,
  },
  featuresTitle: { cs: `Co plavidlo drží`, en: `What the vessel holds` },
  featuresSubtitle: { cs: `Trup & posádka`, en: `Hull & crew` },
  caminoTitle: { cs: `Mořské Camino — cesta jako prolog`, en: `The Sea Camino — the way as prologue` },
  caminoSubtitle: { cs: `Finisterre · tři mariánská místa · etapy`, en: `Finisterre · three Marian sites · etapas` },
  caminoBody: {
    cs: `Trasa lodi začíná tam, kde pro starý svět cesta končila: na Finisterre, kam poutníci tisíc let docházeli „na konec země" — a dívali se na moře. Prologová etapa míjí tři mariánská místa z příběhu sítě: Pontevedru (María Mayor — zasvěcení), Fátimu (most mezi nebem a zemí) a La Palmu (María de las Nieves — patronka ostrova i sítě). Každý úsek je etapa: posádka i residenti sbírají on-chain razítka jako poutníčková credencial — za celý okruh compostela.`,
    en: `The ship's route begins where the old world's road ended: at Finisterre, where pilgrims for a thousand years walked to "the end of the earth" — and looked out to sea. The prologue leg passes the three Marian sites woven into the network's story: Pontevedra (María Mayor — initiation), Fátima (the bridge between heaven and earth) and La Palma (María de las Nieves — patroness of the island and the network). Each leg is an etapa: crew and residents collect on-chain stamps like the pilgrim's credencial — a compostela for the full circuit.`,
  },
  caminoPoints: {
    cs: [`Finisterre — vyplouvání z konce země`, `Etapy jako credencial — on-chain razítka`, `Compostela za celý Velký kruh`],
    en: [`Finisterre — departure from the end of the earth`, `Etapas as credencial — on-chain stamps`, `Compostela for the full Great Circle`],
  },
  phasesTitle: { cs: `Fáze rozvoje`, en: `Development Phases` },
  phasesSubtitle: { cs: `Od design study k Velkému kruhu`, en: `From design study to the Great Circle` },
  zionTitle: { cs: `Blockchain integrace`, en: `Blockchain Integration` },
  nameTitle: { cs: `Jménem Cesty`, en: `In the name of the Way` },
  nameBody: {
    cs: `Loď nese jméno María del Camino — Marie Cesty, mariánské svatyně stojící přímo na Camino Francés u Leónu. Camino de Santiago funguje od devátého století: Codex Calixtinus (~1140) byl první evropský průvodce a poutní trasy byly první fyzickou sítí kontinentu — náměty, kultura i zboží proudily po ní. L5 síť je její pokračování; loď jeho poslední etapa — ta, která pokračuje za horizont.`,
    en: `The ship carries the name María del Camino — Mary of the Way, the Marian sanctuary standing directly on the Camino Francés near León. The Camino de Santiago has run since the ninth century: the Codex Calixtinus (~1140) was Europe's first travel guide and the pilgrim routes were the continent's first physical network — ideas, culture and goods flowed along it. The L5 network is its continuation; the ship its final stage — the one that keeps going past the horizon.`,
  },
  openTitle: { cs: `Otevřené otázky — hledáme Guardians`, en: `Open Questions — looking for Guardians` },
  openItems: {
    cs: [
      `Flag state a domovské přístavy — Galicie pro Atlantik; Raiatea/Papeete pro Pacifik?`,
      `Vlastnictví: DAO-owned asset vs. foundation vs. permanentní charter`,
      `Energetická bilance pro 50 osob — solární plachty vs. hydroregenerace`,
      `LUMI exchange protokol — přestup posádek a nákladu přes šíji`,
      `Vazba na L6 Issobella — plující pozemní stanice / telemetry relay`,
    ],
    en: [
      `Flag state and home ports — Galicia for the Atlantic; Raiatea/Papeete for the Pacific?`,
      `Ownership: DAO-owned asset vs. foundation vs. permanent charter`,
      `Energy balance for 50 souls per hull — solar sails vs. hydro-regeneration`,
      `The LUMI exchange protocol — crew and cargo transfers across the isthmus`,
      `L6 Issobella link — a floating ground station / telemetry relay`,
    ],
  },
  cta: {
    cs: `Ultreia — vyplouváš? Jsi Guardian, který umí držet kurz?`,
    en: `Ultreia — will you sail? Are you a Guardian who can hold a course?`,
  },
  joinDiscord: { cs: `Připojit se na Discord`, en: `Join Discord` },
  documentation: { cs: `Dokumentace`, en: `Documentation` },
  documentationSubtitle: { cs: `Koncept a vize plujícího uzlu María del Camino — mořské Camino, solární plachty a Velký kruh.`, en: `Concept and vision of the María del Camino vessel node — the sea Camino, solar sails and the Great Circle.` },
  documentationLoading: { cs: `Načítání dokumentace…`, en: `Loading documentation…` },
  documentationError: { cs: `Dokumentaci se nepodařilo načíst.`, en: `Failed to load documentation.` },
  sisterTitle: { cs: `Síť Terra Nova`, en: `Terra Nova Network` },
  sisterSubtitle: { cs: `Propojení se sesterskými projekty`, en: `Connection with sister projects` },
  sisterBody: {
    cs: `Všechny uzly sdílejí zdrojový kód: Terra Nova etika, ZION blockchain, off-grid technologie, komunitní governance a seed library. María del Camino je spojuje doslova.`,
    en: `All nodes share the same source code: Terra Nova ethics, ZION blockchain, off-grid technology, community governance and the seed library. María del Camino connects them — literally.`,
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
    icon: Sun,
    titleCs: 'Solární plachty',
    titleEn: 'Solar sails',
    descCs: 'Plachty samotné jsou fotovoltaické — flexibilní články laminované do plachtoviny (odhad 60–200 kWp) plus hydroregenerace pod plachtami. Cíl: plavba bez fosilních paliv.',
    descEn: 'The sails themselves are photovoltaic — flexible cells laminated into sailcloth (est. 60–200 kWp) plus hydro-regeneration under sail. Target: fossil-free passage.',
    color: '#FCD116',
    rgb: '252, 209, 22',
  },
  {
    icon: Users,
    titleCs: '~50 poutníků',
    titleEn: '~50 pilgrims',
    descCs: 'Permanentní posádka Guardianů plus rotující residenti — výzkum, youth bridge programy, praktici Medical Table a noví Guardiani v tranzitu mezi uzly.',
    descEn: 'A permanent Guardian crew plus rotating residents — research, youth bridge programmes, Medical Table practitioners and new Guardians in transit between nodes.',
    color: '#22D3EE',
    rgb: '34, 211, 238',
  },
  {
    icon: Waves,
    titleCs: 'Soběstačnost na moři',
    titleEn: 'Self-sufficiency at sea',
    descCs: 'Odsolování a sběr deště, hydroponická palubní zahrada, zásoby vyměňované v uzlech — k tomu trasa existuje.',
    descEn: 'Desalination and rain catchment, a hydroponic deck garden, provisions exchanged at the nodes — that is what the route is for.',
    color: '#0EA5E9',
    rgb: '14, 165, 233',
  },
  {
    icon: Network,
    titleCs: 'Guardian node na moři',
    titleEn: 'Guardian node at sea',
    descCs: 'Plný ZION uzel validující přes satelit, LoRa/mesh gateway na stěžni — při kotvení u uzlu se loď stává jeho edge nodem.',
    descEn: 'A full ZION node validating over satellite, a LoRa/mesh gateway at the mast — at anchor it becomes the node’s own edge node.',
    color: '#A78BFA',
    rgb: '167, 139, 250',
  },
  {
    icon: Compass,
    titleCs: 'Wayfinding',
    titleEn: 'Wayfinding',
    descCs: 'Loď se učí navigaci, která předcházela mapy — hvězdy, vlny, ptáci. Campus stellae: cesta vedená hvězdami, ne GPS.',
    descEn: 'The ship learns the navigation that preceded maps — stars, swells, birds. Campus stellae: a way steered by stars, not GPS.',
    color: '#8B5CF6',
    rgb: '139, 92, 246',
  },
  {
    icon: Shell,
    titleCs: 'Pilgrim credential',
    titleEn: 'Pilgrim credential',
    descCs: 'Každý úsek je etapa — on-chain razítka jako poutníčková credencial; za celý Velký kruh compostela.',
    descEn: 'Every leg is an etapa — on-chain stamps like the pilgrim’s credencial; a compostela for completing the Great Circle.',
    color: '#F59E0B',
    rgb: '252, 209, 22',
  },
  {
    icon: Heart,
    titleCs: 'Tithe, který dopluje',
    titleEn: 'A tithe that arrives',
    descCs: 'L5 humanitární tithe umí loď fyzicky doručit — zásoby, medicína a vybavení pro uzly jako náklad, ne bankovní převod.',
    descEn: 'The ship can physically deliver the L5 humanitarian tithe — supplies, medicine and equipment for the nodes as cargo, not a bank transfer.',
    color: '#F43F5E',
    rgb: '244, 63, 94',
  },
  {
    icon: Feather,
    titleCs: 'Plovoucí knihovna',
    titleEn: 'A floating library',
    descCs: 'Seed library a kulturní archiv cestují mezi uzly mořem — semena, příběhy a znalosti jako živý oběh sítě.',
    descEn: 'The seed library and cultural archive travel between the nodes by sea — seeds, stories and knowledge as the network’s living circulation.',
    color: '#066928',
    rgb: '6, 105, 40',
  },
];

const PHASES = [
  {
    num: '0',
    cs: 'Kresba',
    en: 'Design',
    descCs: 'Design study, partnerství se sail-training a NGO flotilami, odhad CAPEX/OPEX, ověření caminských pramenů.',
    descEn: 'Design study, partnerships with sail-training and NGO fleets, CAPEX/OPEX estimate, verification of the Camino sources.',
    active: true,
  },
  {
    num: '1',
    cs: 'První etapa',
    en: 'First leg',
    descCs: 'Pilotní trasa na charterované lodi mezi dvěma uzly (Finisterre → La Palma): důkaz Guardian node at sea a mesh sync — bez vlastního trupu.',
    descEn: 'A pilot route on a chartered vessel between two nodes (Finisterre → La Palma): proof of the Guardian node at sea and mesh sync — before any hull is owned.',
    active: false,
  },
  {
    num: '2',
    cs: 'Atlantický trup',
    en: 'Atlantic hull',
    descCs: 'Refit nebo stavba Santa María la Mayor — klasické plachetnice; flag state, certifikace, pojištění, posádka.',
    descEn: 'Refit or build of Santa María la Mayor — the classic sailing ship; flag state, certification, insurance, crew.',
    active: false,
  },
  {
    num: '3',
    cs: 'Atlantický okruh',
    en: 'Atlantic circuit',
    descCs: 'První okruh atlantické trasy — Finisterre → Lisabon (Tomar–Sabacheira) → La Palma → Karibik → karibský břeh LUMI.',
    descEn: 'The first circuit of the Atlantic route — Finisterre → Lisbon (Tomar–Sabacheira) → La Palma → the Caribbean → LUMI.',
    active: false,
  },
  {
    num: '4',
    cs: 'Pacifický trup',
    en: 'Pacific hull',
    descCs: 'Stavba/refit Nossa Senhora de Fátima — solárního katamaránu; pacifický home port, LUMI exchange protokol.',
    descEn: 'Build or refit of Nossa Senhora de Fátima — the solar catamaran; Pacific home port, the LUMI exchange protocol.',
    active: false,
  },
  {
    num: '5',
    cs: 'Indický trup',
    en: 'Indian hull',
    descCs: 'Třetí Marie — María de las Nieves pro Indický oceán: zlatá loď nedokončených zázraků; trasa Ekam → Boa Esperança → návrat.',
    descEn: 'The third Mary — María de las Nieves for the Indian Ocean: the golden ship of unfinished miracles; route Ekam → Boa Esperança → the return.',
    active: false,
  },
];

const ROUTE = [
  {
    num: '0',
    hull: 'I',
    stop: { cs: 'Pontevedra · Galicie', en: 'Pontevedra · Galicia' },
    initiation: { cs: 'Poutník', en: 'The Pilgrim' },
    desc: { cs: 'Vyplutí z domácího přístavu — bazilika Santa María la Mayor, credencialy, plamen z Finisterra.', en: 'Departure from the home port — the basilica of Santa María la Mayor, the credencial, the flame carried from Finisterre.' },
  },
  {
    num: '1',
    hull: 'I',
    stop: { cs: 'Genesis Garden · Sabacheira', en: 'Genesis Garden · Sabacheira' },
    initiation: { cs: 'Země', en: 'Earth' },
    desc: { cs: 'Ruce v hlíně — první iniciace je práce v zahradě, zdroj vody a semínka.', en: 'Hands in the soil — the first initiation is work in the garden, the source and the seeds.' },
  },
  {
    num: '2',
    hull: 'I',
    stop: { cs: 'Dharma Temple · La Palma', en: 'Dharma Temple · La Palma' },
    initiation: { cs: 'Ticho', en: 'Silence' },
    desc: { cs: 'Ostrov třetího zjevení — chrámová praxe pod patronkou sítě, sníh, který nepadá, ale může.', en: 'The island of the third apparition — temple practice under the network’s patroness; the snow that never falls, yet may.' },
  },
  {
    num: '3',
    hull: 'I→II',
    stop: { cs: 'LUMI · Nová Amerika', en: 'LUMI · Nová Amerika' },
    initiation: { cs: 'Most', en: 'The Bridge' },
    desc: { cs: 'Atlantik předává Pacifiku — přechod šíje po souši (Camino de Cruces precedens); posádka i náklad se přelévají mezi loděmi.', en: 'The Atlantic hands off to the Pacific — the isthmus crossed overland (the Camino de Cruces precedent); crew and cargo pour between the ships.' },
  },
  {
    num: '4',
    hull: 'II',
    stop: { cs: 'Te Pīko Ora · Raiatea', en: 'Te Pīko Ora · Raiatea' },
    initiation: { cs: 'Oceán', en: 'Ocean' },
    desc: { cs: 'Wayfinding škola — hvězdná navigace, wa’a tradice, legy plavené bez satelitů.', en: 'The wayfinding school — star navigation, the wa’a tradition, legs sailed without satellites.' },
  },
  {
    num: '5',
    hull: 'II',
    stop: { cs: 'Uluru · Austrálie', en: 'Uluru · Australia' },
    initiation: { cs: 'Paměť', en: 'Memory' },
    desc: { cs: 'Pobřežní návštěvy na podmínky custodiánů — naslouchání nejstarším songlines planety.', en: 'Coastal visits on the custodians’ terms — listening to the planet’s oldest songlines.' },
  },
  {
    num: '6',
    hull: 'II',
    stop: { cs: 'Bodhi Lanka · Srí Lanka', en: 'Bodhi Lanka · Sri Lanka' },
    initiation: { cs: 'Akáša', en: 'Akasha' },
    desc: { cs: 'Služba a archiv — znalostní uzel před posledním skokem.', en: 'Service and archive — the knowledge node before the final hop.' },
  },
  {
    num: '7',
    hull: 'II→III',
    stop: { cs: 'Ekam · Indie', en: 'Ekam · India' },
    initiation: { cs: 'Dokončení', en: 'Completion' },
    desc: { cs: 'Loď kotví v Chennai, poutníci pokračují po souši na kampus Oneness — satori na jediném postaveném uzlu.', en: 'The ship anchors off Chennai; pilgrims continue overland to the Oneness campus — satori at the only built node.' },
  },
  {
    num: '8',
    hull: 'III',
    stop: { cs: 'Indický oceán', en: 'Indian Ocean' },
    initiation: { cs: 'Návrat', en: 'The Return' },
    desc: { cs: 'María de las Nieves přebírá poutníky — monzunová trasa přes oceán, kde cesta vrcholí obratem.', en: 'María de las Nieves takes the pilgrims aboard — the monsoon route across the ocean where the journey turns.' },
  },
  {
    num: '9',
    hull: 'III',
    stop: { cs: 'Boa Esperança · Mys', en: 'Boa Esperança · the Cape' },
    initiation: { cs: 'Obrat', en: 'The Turn' },
    desc: { cs: 'Scháziště flotily na švu oceánů — bouře se přejmenovává na naději; razítko credencialu „bouře přejmenována".', en: 'The fleet rendezvous on the seam of oceans — the storm renamed hope; the credencial stamp “the storm renamed”.' },
  },
  {
    num: '10',
    hull: 'III→I',
    stop: { cs: 'St Helena → Azory → Pontevedra', en: 'St Helena → Azores → Pontevedra' },
    initiation: { cs: 'Integrace', en: 'Integration' },
    desc: { cs: 'Návratový oblouk Atlantikem — oceánská compostela a plný credencial tří moří.', en: 'The homeward arc across the Atlantic — the oceanic compostela and a complete three-seas credencial.' },
  },
  {
    num: '11',
    hull: 'home',
    stop: { cs: 'Zlatá republika · Bohemia', en: 'Golden Republic · Bohemia' },
    initiation: { cs: 'Governance', en: 'Governance' },
    desc: { cs: 'Poslední razítko doma v srdci — satori se dokazuje návratem: po osvícení sekat dříví, nést vodu.', en: 'The last stamp at home in the heartland — satori is proven by returning: after enlightenment, chop wood, carry water.' },
  },
];

const HULL_META: Record<string, { label: { cs: string; en: string }; rc: string; text: string }> = {
  I: { label: { cs: 'Santa María la Mayor', en: 'Santa María la Mayor' }, rc: '239, 68, 68', text: 'text-red-300' },
  II: { label: { cs: 'Nossa Senhora de Fátima', en: 'Nossa Senhora de Fátima' }, rc: '14, 165, 233', text: 'text-sky-300' },
  III: { label: { cs: 'María de las Nieves', en: 'María de las Nieves' }, rc: '245, 222, 130', text: 'text-amber-200' },
  home: { label: { cs: 'Návrat domů', en: 'The way home' }, rc: '168, 85, 247', text: 'text-purple-300' },
};

const ZION_ITEMS: { label: string; icon: LucideIcon }[] = [
  { label: 'ZION L1 Node', icon: Network },
  { label: 'DAO Governance', icon: Users },
  { label: 'Guardian Wallet', icon: Shield },
  { label: 'L5 Humanitarian Tithe', icon: Heart },
  { label: 'Mesh Relay', icon: Radio },
  { label: 'Pilgrim Credential', icon: Shell },
];

const SISTERS = [
  { name: 'Genesis Garden', href: '/terranova/genesis', region: { cs: 'Sabacheira · Tomar, Portugalsko', en: 'Sabacheira · Tomar, Portugal' } },
  { name: 'Dharma Temple', href: '/terranova/dharma-temple', region: { cs: 'La Palma', en: 'La Palma' } },
  { name: 'Te Pīko Ora', href: '/terranova/te-piko-ora', region: { cs: 'Raiatea · Polynésie', en: 'Raiatea · Polynesia' } },
  { name: 'Golden Republic Bohemia', href: '/terranova/golden-republic-bohemia', region: { cs: 'Čechy', en: 'Bohemia' } },
  { name: 'Bodhi Lanka', href: '/terranova/bodhi-lanka', region: { cs: 'Srí Lanka', en: 'Sri Lanka' } },
  { name: 'LUMI · Nová Amerika', href: '/terranova/nova-amerika', region: { cs: 'Kostarika', en: 'Costa Rica' } },
  { name: 'Uluru', href: '/terranova/uluru', region: { cs: 'Northern Territory, Austrálie', en: 'Northern Territory, Australia' } },
  { name: 'Boa Esperança', href: '/terranova/boa-esperanca', region: { cs: 'Mys dobré naděje', en: 'Cape of Good Hope' } },
  { name: 'Ekam · Oneness Temple', href: '/terranova/ekam', region: { cs: 'Andhra Pradesh, Indie', en: 'Andhra Pradesh, India' } },
];

export default function MariaDelCaminoPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [doc, setDoc] = useState<string | null>(null);
  const [docError, setDocError] = useState(false);

  useEffect(() => {
    const file = cs ? '/docs/terranova/maria-del-camino.cs.md' : '/docs/terranova/maria-del-camino.en.md';
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
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="shrink-0 w-20 h-20 flex items-center justify-center zion-rainbow-sub" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
                  <Sailboat className="h-10 w-10 text-sky-300" />
                </div>

                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="zion-badge">L5 · Terra Nova · World Oceans</span>
                    <span className="zion-badge-gold inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {Copy.researchStage[cs ? 'cs' : 'en']}
                    </span>
                  </div>

                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gradient">
                    María del Camino
                  </h1>
                  <p className="text-lg text-sky-300 font-medium">
                    {Copy.subtitle[cs ? 'cs' : 'en']}
                  </p>

                  <div className="flex items-center gap-1.5 text-white/70">
                    <MapPin className="w-4 h-4 text-white/85 shrink-0" />
                    <span className="text-sm">{Copy.locationLine[cs ? 'cs' : 'en']}</span>
                  </div>

                  <blockquote className="mt-4 pl-4 border-l-2 border-white/10 text-sm text-white/70 italic leading-relaxed max-w-lg">
                    {Copy.quote[cs ? 'cs' : 'en']}
                  </blockquote>

                  <div className="grid gap-3 pt-3 sm:grid-cols-3">
                    {[
                      { icon: Users, value: cs ? '3 × ~50' : '3 × ~50', labelCs: 'Poutníků na trup', labelEn: 'Pilgrims per hull' },
                      { icon: Sailboat, value: cs ? '8. bod' : '8th point', labelCs: 'Uzel', labelEn: 'Node' },
                      { icon: Sparkles, value: cs ? 'Příprava' : 'Preparation', labelCs: 'Stav', labelEn: 'Status' },
                    ].map((signal) => {
                      const Icon = signal.icon;
                      return (
                        <div key={signal.labelCs} className="zion-rainbow-sub px-3 py-3" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
                          <div className="flex items-center gap-2 text-sky-300">
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
                src="/images/maria-del-camino/hero.webp"
                alt="María del Camino — noční oceán, plachetnice pod Mléčnou dráhou"
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
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
            <h2 className="text-2xl md:text-3xl font-semibold text-white mb-4">
              {Copy.introTitle[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-gray-300 leading-relaxed">
              {Copy.introBody[cs ? 'cs' : 'en']}
            </p>
          </div>
        </motion.section>

        {/* ═══ FLEET — TRES MARIAS ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.fleetSubtitle[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Ship className="h-7 w-7 text-sky-400" />
              {Copy.fleetTitle[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '239, 68, 68' } as React.CSSProperties}>
              <div className="overflow-hidden">
                <img
                  src="/images/maria-del-camino/atlantic.webp"
                  alt="Santa María la Mayor — atlantická plachetnice pod zlatými plachtami"
                  width={1280}
                  height={720}
                  loading="lazy"
                  decoding="async"
                  className="w-full object-cover"
                />
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-white mb-1">Santa María la Mayor <span className="text-xs text-gray-500 font-normal">· {cs ? 'Atlantik' : 'Atlantic'}</span></h3>
                <p className="text-sm text-gray-400">{Copy.fleetAtlantic[cs ? 'cs' : 'en']}</p>
              </div>
            </div>
            <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
              <div className="overflow-hidden">
                <img
                  src="/images/maria-del-camino/pacific.webp"
                  alt="Nossa Senhora de Fátima — solární katamarán se svítícími plachtami a vieirou na přídi"
                  width={1280}
                  height={720}
                  loading="lazy"
                  decoding="async"
                  className="w-full object-cover"
                />
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-white mb-1">Nossa Senhora de Fátima <span className="text-xs text-gray-500 font-normal">· Pacifik</span></h3>
                <p className="text-sm text-gray-400">{Copy.fleetPacific[cs ? 'cs' : 'en']}</p>
              </div>
            </div>
            <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '245, 222, 130' } as React.CSSProperties}>
              <div className="overflow-hidden">
                <img
                  src="/images/maria-del-camino/indian.webp"
                  alt="María de las Nieves — zlatá loď Indického oceánu"
                  width={1280}
                  height={720}
                  loading="lazy"
                  decoding="async"
                  className="w-full object-cover"
                />
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-white mb-1">María de las Nieves <span className="text-xs text-gray-500 font-normal">· {cs ? 'Indický oceán' : 'Indian Ocean'}</span></h3>
                <p className="text-sm text-gray-400">{Copy.fleetIndian[cs ? 'cs' : 'en']}</p>
              </div>
            </div>
          </div>
          <div className="zion-rainbow-sub p-5" style={{ '--rc': '20, 184, 166' } as React.CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <Anchor className="h-4 w-4 text-teal-300" />
              <span className="text-xs uppercase tracking-widest text-gray-500">LUMI · {cs ? 'scháziště' : 'meeting point'}</span>
            </div>
            <p className="text-sm text-gray-300">{Copy.fleetMeet[cs ? 'cs' : 'en']}</p>
          </div>
        </motion.section>

        {/* ═══ PATRON — MALÝ PRINC ═══ */}
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
                    src="/images/maria-del-camino/patron.webp"
                    alt="Malý princ — zlatá postavička s korunkou a světem v dlani nad mořem"
                    width={1280}
                    height={900}
                    loading="lazy"
                    decoding="async"
                    className="w-full object-cover"
                  />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500 mb-1">{Copy.patronSubtitle[cs ? 'cs' : 'en']}</p>
                <h2 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-3 mb-4">
                  <Crown className="h-7 w-7 text-amber-200" />
                  {Copy.patronTitle[cs ? 'cs' : 'en']}
                </h2>
                <p className="text-gray-300 leading-relaxed mb-6">
                  {Copy.patronBody[cs ? 'cs' : 'en']}
                </p>
                <div className="space-y-3">
                  {Copy.patronPoints[cs ? 'cs' : 'en'].map((point, i) => (
                    <div key={i} className="zion-rainbow-sub px-4 py-3" style={{ '--rc': '245, 222, 130' } as React.CSSProperties}>
                      <div className="flex items-center gap-2 text-amber-200 mb-1">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-[10px] uppercase tracking-widest text-gray-500">
                          {(cs ? ['Tři roucha', 'Svět v dlani', 'Precedent'] : ['Three robes', 'The world in hand', 'Precedent'])[i]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══ THE GREAT ROUTE ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
            <div className="mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.routeSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-3 mt-1">
                <Compass className="h-7 w-7 text-sky-400" />
                {Copy.routeTitle[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <p className="text-gray-300 leading-relaxed mb-8">
              {Copy.routeLead[cs ? 'cs' : 'en']}
            </p>
            <div className="space-y-3">
              {ROUTE.map((leg) => {
                const hulls = leg.hull.split('→');
                const meta = HULL_META[hulls[hulls.length - 1]] ?? HULL_META.I;
                return (
                  <div key={leg.num} className="zion-rainbow-sub p-4 flex gap-4 items-start" style={{ '--rc': meta.rc } as React.CSSProperties}>
                    <div className="shrink-0 w-9 h-9 rounded-full border border-white/15 bg-white/5 flex items-center justify-center font-bold text-sm text-white/80">
                      {leg.num}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3 className="font-semibold text-white">{leg.stop[cs ? 'cs' : 'en']}</h3>
                        <span className="text-xs uppercase tracking-widest text-gray-500">
                          {cs ? 'iniciace' : 'initiation'} · {leg.initiation[cs ? 'cs' : 'en']}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">{leg.desc[cs ? 'cs' : 'en']}</p>
                    </div>
                    <div className="hidden sm:flex shrink-0 flex-col items-end gap-1">
                      {hulls.map((h) => {
                        const m = HULL_META[h] ?? HULL_META.I;
                        return (
                          <span key={h} className={`text-[10px] uppercase tracking-widest ${m.text}`}>
                            {m.label[cs ? 'cs' : 'en']}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
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
              <Ship className="h-7 w-7 text-sky-400" />
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

        {/* ═══ SEA CAMINO ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
            <div className="mb-4">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.caminoSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-3 mt-1">
                <Route className="h-7 w-7 text-sky-400" />
                {Copy.caminoTitle[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <p className="text-gray-300 leading-relaxed mb-6">
              {Copy.caminoBody[cs ? 'cs' : 'en']}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {Copy.caminoPoints[cs ? 'cs' : 'en'].map((point, i) => {
                const PointIcon = [Anchor, Shell, Compass][i];
                return (
                  <div key={point} className="zion-rainbow-sub px-4 py-3" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
                    <div className="flex items-center gap-2 text-sky-300 mb-1">
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

        {/* ═══ PHASES ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
            <div className="mb-8">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.phasesSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white">{Copy.phasesTitle[cs ? 'cs' : 'en']}</h2>
            </div>
            <div className="space-y-4">
              {PHASES.map((phase) => (
                <div key={phase.num} className="zion-rainbow-sub p-5 flex gap-4" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
                  <div
                    className={`shrink-0 w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm ${
                      phase.active ? 'border-sky-400/40 bg-sky-400/10 text-sky-300' : 'border-white/10 bg-white/5 text-gray-500'
                    }`}
                  >
                    {phase.num}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">
                      {cs ? phase.cs : phase.en}
                      {phase.active && <span className="ml-2 text-[10px] uppercase tracking-widest text-sky-300">· {cs ? 'probíhá' : 'in progress'}</span>}
                    </h3>
                    <p className="text-sm text-gray-400">{cs ? phase.descCs : phase.descEn}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ═══ NAME / CAMINO HERITAGE ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
            <h2 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-3 mb-4">
              <Shell className="h-7 w-7 text-zion-purple" />
              {Copy.nameTitle[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-gray-300 leading-relaxed">
              {Copy.nameBody[cs ? 'cs' : 'en']}
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
            <div className="zion-rainbow-card p-6" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <Network className="h-5 w-5 text-sky-300" />
                {Copy.zionTitle[cs ? 'cs' : 'en']}
              </h2>
              <div className="flex flex-wrap gap-2">
                {ZION_ITEMS.map((item) => (
                  <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs text-sky-200">
                    <item.icon className="h-3 w-3" />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="zion-rainbow-card p-6" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <Landmark className="h-5 w-5 text-sky-300" />
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
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <div className="mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.sisterSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-2xl font-semibold text-white">{Copy.sisterTitle[cs ? 'cs' : 'en']}</h2>
              <p className="text-sm text-gray-400 mt-2">{Copy.sisterBody[cs ? 'cs' : 'en']}</p>
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
              <p className="text-gray-300 mb-4">{Copy.cta[cs ? 'cs' : 'en']}</p>
              <a
                href="https://discord.gg/zionterranova"
                target="_blank"
                rel="noopener noreferrer"
                className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
              >
                {Copy.joinDiscord[cs ? 'cs' : 'en']} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
