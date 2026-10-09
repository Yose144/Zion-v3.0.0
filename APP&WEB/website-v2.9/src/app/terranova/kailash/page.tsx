'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Compass,
  Droplets,
  Feather,
  Flame,
  Heart,
  Landmark,
  Leaf,
  LucideIcon,
  MapPin,
  Mountain,
  Network,
  Scale,
  Shield,
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
  visionStage: { cs: `Vize — uzel jako vztah`, en: `Vision — a node as relationship` },
  subtitle: { cs: `Ngari · Tibet · Poušť očištění · Terra Nova ®`, en: `Ngari · Tibet · Desert of purification · Terra Nova ®` },
  quote: {
    cs: `„Uprostřed kruhu hoří oheň, který nespaluje dřevo, ale iluze."`,
    en: `"At the circle’s center burns a fire that consumes not wood, but illusion."`,
  },
  locationLine: { cs: `Ngari · Tibetská autonomní oblast`, en: `Ngari · Tibet Autonomous Region` },
  introTitle: { cs: `Jedenáctý uzel — poušť, kde se ze zdolávání stává kora`, en: `The eleventh node — the desert where conquest becomes kora` },
  introBody: {
    cs: `Kailash je jedenáctý bod L5 Free World — a záměrně je to vize, ne plán. Gang Rinpoche, čtyřstěnná pyramida v Transhimaláji, je jediná hora světa, na které se dohodly čtyři tradice najednou: hinduisté v ní vidí sídlo Šivy, buddhisté Děmčoka, Bön Kuntu Zangpo a džinisté místo Ríšabhanáthova osvobození. Dohodly se i na druhé věci — na ni se nestoupá. Poutník horu nechodí na ni, ale kolem ní: kora, dvaapadesátikilometrový okruh přes sedlo Dolma La (5 630 m), se koná na očištění. V poušti Ngari, na „střeše Střechy světa", očisťuje krajina tím, že nenabízí nic jiného než cestu — poušť jako Nāgárjunova prázdnota, která je plná: vakuum, ve kterém fluktuuje všechno. V jeskyních Tisé, jak hora zní tibetsky, meditoval před tisíci lety Milarepa — šedý yogi, zpěvák dohá, který dokázal, že bída je učitelka. A u nohy hory hoří — v příběhu sítě — prastarý oheň, u kterého sedí mistři všech linií Šambhaly, od tesaře až po Babajiho. Uzel vzniká jako vztah se custodiány čtyř tradic, ne jako stavba.`,
    en: `Kailash is the eleventh point of L5 Free World — and deliberately a vision, not a plan. Gang Rinpoche, the four-sided pyramid of the Transhimalaya, is the only mountain on Earth that four traditions agree on at once: Hindus see the seat of Shiva, Buddhists Demchok, Bön Kuntu Zangpo, and Jains the place of Rishabhanatha's liberation. They agree on a second thing too — it is not climbed. The pilgrim does not go up the mountain but around it: the kora, a fifty-two-kilometre circuit over the Dolma La pass (5,630 m), is performed as purification. In the Ngari desert, on the "roof of the Roof of the World", the land purifies by offering nothing but the way — a desert like Nagarjuna's emptiness that is full: a vacuum where everything fluctuates. In the caves of Tisé, as the Tibetans call the mountain, Milarepa meditated a thousand years ago — the grey yogi, singer of dohas, who proved that poverty is a teacher. And at the mountain's foot burns — in the story of the network — the primordial fire where the masters of all Shambhala lineages sit, from the Carpenter to Babaji. The node is born as a relationship with the custodians of four traditions, not as a construction.`,
  },
  featuresTitle: { cs: `Co uzel drží`, en: `What the node holds` },
  featuresSubtitle: { cs: `Oheň & poušť`, en: `Fire & desert` },
  fireTitle: { cs: `Scháziště mistrů — prastarý oheň`, en: `The council of masters — the primordial fire` },
  fireSubtitle: { cs: `Jeden krb, čtyři jazyky`, en: `One hearth, four tongues` },
  fireBody: {
    cs: `Boa Esperança je scháziště trupů na vodě — Kailash je scháziště mistrů na suchu. Kvantová revoluce, literární osa celého projektu, se odehrává přesně tady: v prostém kruhu přítomnosti nad horou — ne v chrámu, ne v paláci — kde hoří oheň, který nespaluje dřevo, ale iluze. V kruhu sedí ti, kteří si vzpomněli dřív než ostatní: Ježíš s otevřenýma rukama, Buddha dýchající tiše, Krishna s flétnou, Maria se soucitem pro každé dítě, Rúmí, Lao-c', Mistr Eckhart, Rámakrišna — a s nimi, v příběhu sítě, mistři všech linií Šambhaly od tesaře až po Babajiho. Každý jiným jazykem, všichni stejnou pravdou. Šambhala tu není skryté království k nalezení — je to stav: válečník bez nepřítele, meč rozlišující moudrosti. A oheň má tři povahy — plamen, uhlí, popel. Kailash drží uhlí: kvantový oheň, který Issobella zkoumá jako hypotézu, tu hoří jako krbová teplota custodiánů. Hořet, ne vyhořet — a počítat i s popelem.`,
    en: `Boa Esperança is the rendezvous of hulls on water — Kailash is the council of masters on land. The Quantum Revolution, the literary spine of the whole project, takes place exactly here: in a plain circle of presence above the mountain — no temple, no palace — where a fire burns that consumes not wood, but illusion. In the circle sit those who remembered before the others: Jesus with open hands, Buddha breathing quietly, Krishna with his flute, Mary with compassion for every child, Rumi, Lao Tzu, Meister Eckhart, Ramakrishna — and with them, in the network’s story, the masters of all Shambhala lineages from the Carpenter to Babaji. Each in a different tongue, all the same truth. Shambhala here is no hidden kingdom to be found — it is a state: the warrior with no enemy, the sword of discriminating wisdom. And the fire has three natures — flame, ember, ash. Kailash keeps the ember: the quantum fire Issobella studies as a hypothesis burns here as the hearth-warmth of custodians. To burn, not burn out — and to reckon with the ash.`,
  },
  firePoints: {
    cs: [`Čtyři tradice — jediná hora, na které se shodly`, `Šambhala jako mapa, ne jako místo — striktně symbolicky`, `Kora namísto vrcholu — obcházet, ne zdolávat`],
    en: [`Four traditions — the only mountain they agree on`, `Shambhala as a map, not a place — read strictly symbolically`, `Kora instead of summit — walk around, never climb`],
  },
  phasesTitle: { cs: `Fáze vztahu`, en: `Phases of relationship` },
  phasesSubtitle: { cs: `Od respektu ke korze`, en: `From respect to the kora` },
  zionTitle: { cs: `Blockchain integrace`, en: `Blockchain Integration` },
  respectTitle: { cs: `Čtyři tradice vedou`, en: `Four traditions lead` },
  respectBody: {
    cs: `Kailash není „naše" místo — patří čtyřem živým tradicím a dvěma národům, mezi kterými leží. Uzel L5 proto znamená vztah, ne přítomnost: custodiáni tibetské, indické, bönjské i džinistické linie rozhodují, co se sdílí a jak; žádný ZION znak na hřeben, žádná parcela, žádný board. Geopolitika se zapisuje do uzlu, ne obchází: přístup přes Nepál (Simikot–Hilsa) nebo Lhasa, permity, sezónní okno — a respekt, který platí dřív, než se uvažuje o jakékoli cestě.`,
    en: `Kailash is not "our" place — it belongs to four living traditions and sits between two nations. The L5 node therefore means relationship, not presence: custodians of the Tibetan, Indian, Bön and Jain lineages decide what is shared and how; no ZION sign on the ridge, no parcel, no board. Geopolitics is written into the node, not bypassed: access via Nepal (Simikot–Hilsa) or Lhasa, permits, seasonal window — and a respect that applies before any journey is even considered.`,
  },
  openTitle: { cs: `Otevřené otázky — hledáme Guardians`, en: `Open Questions — looking for Guardians` },
  openItems: {
    cs: [
      `Custodiánský rámec — čtyři tradice, vícero podmínek; kdo vede a jak (FPIC-ekvivalent)`,
      `Geopolitika — TAR permity, Nepál vs. Lhasa koridor, sezónní okno`,
      `Iniciační číslo — zaujmout prázdný slot 8 (Ekam → Boa), nebo držet uzel mimo posloupnost`,
      `Jazyková stopa — Gang Rinpoche · Kailāsa · 冈仁波齐 — jak vážit v copy`,
      `Vazba na Šambhalu v korpusu — literární sídlo scháziště mistrů (MÝTUS)`,
    ],
    en: [
      `Custodial framework — four traditions, multiple terms; who leads and how (FPIC-equivalent)`,
      `Geopolitics — TAR permits, Nepal vs. Lhasa corridor, seasonal window`,
      `Initiation number — claim the open slot 8 (Ekam → Boa) or keep the node off the sequence`,
      `Language trace — Gang Rinpoche · Kailāsa · 冈仁波齐 — how to weigh them in copy`,
      `Relation to the corpus Shambhala — literary seat of the council of masters (MYTH)`,
    ],
  },
  cta: {
    cs: `Umíš obejít horu místo zdolání? Jsi Guardian pro poušť očištění?`,
    en: `Can you walk around a mountain instead of climbing it? Are you a Guardian for the desert of purification?`,
  },
  joinDiscord: { cs: `Připojit se na Discord`, en: `Join Discord` },
  anchorTitle: { cs: `Kotva pravdy — co je fakt, co je mýtus`, en: `Truth anchor — what is fact, what is myth` },
  anchorSubtitle: { cs: `Jako každá kapitola korpusu`, en: `As in every corpus chapter` },
  anchorBody: {
    cs: `Uzel, který ctí custodiány, musí umět oddělit ověřitelné od příběhu sítě — stejné rozlišení, jaké používají kapitoly Kvantové revoluce.`,
    en: `A node that honours custodians must separate the verifiable from the network’s story — the same distinction used by the chapters of the Quantum Revolution.`,
  },
  quantumLink: { cs: `Kvantová revoluce — literární osa projektu →`, en: `Quantum Revolution — the project’s literary spine →` },
  documentation: { cs: `Dokumentace`, en: `Documentation` },
  documentationSubtitle: { cs: `Koncept a vize uzlu Kailash — poušť očištění, čtyři tradice, prastarý oheň, Šambhala jako mapa.`, en: `Concept and vision of the Kailash node — the desert of purification, four traditions, the primordial fire, Shambhala as a map.` },
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
    icon: Flame,
    titleCs: 'Prastarý oheň',
    titleEn: 'The primordial fire',
    descCs: 'Oheň, který nikdy nezhasl — scháziště mistrů všech linií Šambhaly v mýtické geografii sítě. Iniciace Očištění: hořet, ne vyhořet.',
    descEn: 'The fire that has never gone out — the council of masters of all Shambhala lineages in the network’s mythic geography. The initiation of Purification: to burn, not burn out.',
    color: '#FB923C',
    rgb: '251, 146, 60',
  },
  {
    icon: Mountain,
    titleCs: 'Gang Rinpoche — nikdy nezlaná',
    titleEn: 'Gang Rinpoche — never climbed',
    descCs: 'Čtyřstěnná pyramida 6 638 m. Jediná hora, na kterou se nikdy nevylezlo — ne proto, že by to nešlo, ale protože to nejde o vrchol.',
    descEn: 'The four-sided pyramid of 6,638 m. The only mountain never climbed — not because it cannot be done, but because it is not about the summit.',
    color: '#CBD5E1',
    rgb: '203, 213, 225',
  },
  {
    icon: Compass,
    titleCs: 'Kora — 52 km okruh',
    titleEn: 'The kora — a 52 km circuit',
    descCs: 'Poutní okruh přes sedlo Dolma La (5 630 m). Hinduisté a buddhisté po směru, Bön proti směru — tradice se rozejdou jen ve směru chůze.',
    descEn: 'The pilgrim circuit over the Dolma La pass (5,630 m). Hindus and Buddhists walk clockwise, Bön counterclockwise — the traditions part only in the direction of walking.',
    color: '#A5B4FC',
    rgb: '165, 180, 252',
  },
  {
    icon: Waves,
    titleCs: 'Manasarovar — jezero z mysli',
    titleEn: 'Manasarovar — the lake made of mind',
    descCs: 'Jedno z nejvýše položených sladkovodních jezer (~4 590 m) u nohy hory — vedle něj stinný Rakshastal. Světlo a stín u jedné hory.',
    descEn: 'One of the highest freshwater lakes on Earth (~4,590 m) at the mountain’s foot — beside it the shadow lake Rakshastal. Light and shadow at one mountain.',
    color: '#67E8F9',
    rgb: '103, 232, 249',
  },
  {
    icon: Droplets,
    titleCs: 'Čtyři řeky — jeden zdroj',
    titleEn: 'Four rivers — one source',
    descCs: 'V okruhu Kailashu pramení Indus, Sutlej, Brahmaputra a Karnali (→Ganga) — voda celé Asie z jednoho bodu. Princip: jeden pramen, čtyři směry.',
    descEn: 'Around Kailash rise the Indus, Sutlej, Brahmaputra and Karnali (→Ganga) — the water of all Asia from a single point. The principle: one source, four directions.',
    color: '#60A5FA',
    rgb: '96, 165, 250',
  },
  {
    icon: Users,
    titleCs: 'Čtyři tradice — jedna hora',
    titleEn: 'Four traditions — one mountain',
    descCs: 'Hinduismus (Šiva), buddhismus (Děmčok/Kálačakra), Bön (Kuntu Zangpo), džinismus (Ríšabhanátha). Jediná zeměpisná shoda čtyř linií planety.',
    descEn: 'Hinduism (Shiva), Buddhism (Demchok/Kalachakra), Bön (Kuntu Zangpo), Jainism (Rishabhanatha). The only geographic agreement of four of the planet’s lineages.',
    color: '#F0ABFC',
    rgb: '240, 171, 252',
  },
  {
    icon: Sun,
    titleCs: 'Ngari — poušť očištění',
    titleEn: 'Ngari — the desert of purification',
    descCs: '„Střecha Střechy světa" — vysokohorská poušť ~4 500 m. Krajina, která nenabízí nic jiného než cestu — a právě proto očisťuje.',
    descEn: 'The "roof of the Roof of the World" — a high-altitude desert at ~4,500 m. A land that offers nothing but the way — and that is exactly why it purifies.',
    color: '#FCD34D',
    rgb: '252, 211, 77',
  },
  {
    icon: Sparkles,
    titleCs: 'Šambhala jako mapa',
    titleEn: 'Shambhala as a map',
    descCs: 'Ne skryté království — stav. Šambhalský válečník nemá nepřítele, má meč rozlišující moudrosti a zůstává přítomný, dokud se temnota sama nerozpustí.',
    descEn: 'Not a hidden kingdom — a state. The Shambhala warrior has no enemy, carries the sword of discriminating wisdom, and stays present until the darkness dissolves for lack of fuel.',
    color: '#C4B5FD',
    rgb: '196, 181, 253',
  },
  {
    icon: Leaf,
    titleCs: 'Milarepa — yogi z Tisé',
    titleEn: 'Milarepa — the yogi of Tisé',
    descCs: 'Šedý yogi sítě (avatar #73) meditoval v jeskyních Tisé — dokázal, že bída je učitelka. Legenda praví, že horu „získal" jedině on — závodem s bönským knězem na slunečním paprsku.',
    descEn: 'The network’s grey yogi (avatar #73) meditated in the caves of Tisé — proving poverty is a teacher. Legend says he alone “won” the mountain — racing the Bön priest on a sunbeam.',
    color: '#86EFAC',
    rgb: '134, 239, 172',
  },
  {
    icon: Feather,
    titleCs: 'Jedenácté poleno',
    titleEn: 'The eleventh log',
    descCs: 'Deset polen, deset kapitol Kvantové revoluce — a jedenácté jsi ty: čas, pozornost, energie, láska. Jedenáctý bod sítě se ptá: kam své poleno položíš?',
    descEn: 'Ten logs, ten chapters of the Quantum Revolution — and the eleventh is you: your time, attention, energy, love. The eleventh node of the network asks: where will you lay your log?',
    color: '#FDBA74',
    rgb: '253, 186, 116',
  },
];

const PHASES = [
  {
    num: '0',
    cs: 'Vztah',
    en: 'Relationship',
    descCs: 'Respekt před jakoukoli cestou — dialog s custodiány čtyř tradic; uzel existuje jako vzájemné učení, ne stavba. Žádný termín.',
    descEn: 'Respect before any journey — dialogue with the custodians of four traditions; the node exists as mutual learning, not construction. No deadline.',
    active: true,
  },
  {
    num: '1',
    cs: 'Pouštní kruh',
    en: 'Desert circle',
    descCs: 'Malý uzlový kruh bez fyzické stopy — studium tradic koray, custodiánské mapy, čistý vztah. Custodiáni vedou vše, co se dotýká jejich země a příběhů.',
    descEn: 'A small node circle leaving no physical trace — study of the kora traditions, custodial mapping, a clean relationship. Custodians lead everything touching their land and stories.',
    active: false,
  },
  {
    num: '2',
    cs: 'Kora protokol',
    en: 'Kora protocol',
    descCs: 'Poutní rámec pro Guardians sítě — přístup přes Nepál/Lhasa, permity, sezónní okno, výšková medicína; kora na podmínky lokálních průvodců.',
    descEn: 'A pilgrim framework for network Guardians — access via Nepal/Lhasa, permits, seasonal window, altitude medicine; the kora on local guides’ terms.',
    active: false,
  },
  {
    num: '3',
    cs: 'Scháziště',
    en: 'The Council',
    descCs: 'Setkání linií u prastarého ohně — ceremonie očištění a razítko credencialu „hořím, ne vyhořel jsem".',
    descEn: 'The meeting of lineages at the primordial fire — the purification ceremony and the credential stamp "I burn, not burn out".',
    active: false,
  },
];

const ANCHORS: { whatCs: string; whatEn: string; statusCs: string; statusEn: string; noteCs: string; noteEn: string; color: string }[] = [
  {
    whatCs: 'Gang Rinpoche, shoda čtyř tradic, kora ~52 km, Manasarovar, prameny čtyř řek',
    whatEn: 'Gang Rinpoche, the agreement of four traditions, the ~52 km kora, Manasarovar, the four river sources',
    statusCs: 'ŽIVÉ', statusEn: 'LIVE',
    noteCs: 'geografie + živá náboženská tradice', noteEn: 'geography + living religious tradition',
    color: '#34D399',
  },
  {
    whatCs: 'Milarepa v jeskyních Tisé; legenda závodu s Naro Bönchungem na slunečním paprsku',
    whatEn: 'Milarepa in the caves of Tisé; the legend of the race against Naro Bönchung on a sunbeam',
    statusCs: 'ŽIVÉ + MÝTUS', statusEn: 'LIVE + MYTH',
    noteCs: 'tradiční poutní příběh, ne historický záznam', noteEn: 'traditional pilgrim story, not a historical record',
    color: '#4ADE80',
  },
  {
    whatCs: 'Kruh přítomnosti, prastarý oheň, scháziště mistrů, jedenácté poleno, Šambhala jako kraj',
    whatEn: 'The circle of presence, the primordial fire, the council of masters, the eleventh log, Shambhala as a land',
    statusCs: 'MÝTUS', statusEn: 'MYTH',
    noteCs: 'rámcové dějiště Kvantové revoluce — literární obraz, ne geologie', noteEn: 'the frame setting of the Quantum Revolution — a literary image, not geology',
    color: '#C4B5FD',
  },
  {
    whatCs: 'Poušť jako Nāgárjunova prázdnota — „vakuum, které je plné"',
    whatEn: 'The desert as Nagarjuna’s emptiness — “the vacuum that is full”',
    statusCs: 'INTERPRETACE', statusEn: 'READING',
    noteCs: 'poetická paralela, ne fyzikální tvrzení', noteEn: 'a poetic parallel, not a physics claim',
    color: '#93C5FD',
  },
  {
    whatCs: 'Kvantový oheň jako výzkumná osa L6 Issobella',
    whatEn: 'The quantum fire as an L6 Issobella research axis',
    statusCs: 'HYPOTÉZA', statusEn: 'HYPOTHESIS',
    noteCs: 'otevřená otázka, ne slib — viz Kvantová revoluce', noteEn: 'an open question, not a promise — see Quantum Revolution',
    color: '#67E8F9',
  },
  {
    whatCs: 'Uzel L5, fáze vztahu, razítko credencialu „hořím, ne vyhořel jsem"',
    whatEn: 'The L5 node, the phases of relationship, the “I burn, not burn out” credential stamp',
    statusCs: 'VIZE', statusEn: 'VISION',
    noteCs: 'záměr sítě — neexistuje žádná parcela ani harmonogram', noteEn: 'network intent — no parcel and no timeline exist',
    color: '#FCD34D',
  },
];

const ZION_ITEMS: { label: string; icon: LucideIcon }[] = [
  { label: 'ZION L1 Node', icon: Network },
  { label: 'DAO Governance', icon: Users },
  { label: 'Guardian Wallet', icon: Shield },
  { label: 'L5 Humanitarian Tithe', icon: Heart },
  { label: 'Pilgrim Credential', icon: Feather },
  { label: 'Water Commons', icon: Droplets },
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
  { name: 'Amenti', href: '/terranova/amenti', region: { cs: 'Gíza, Egypt', en: 'Giza, Egypt' } },
];

export default function KailashPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [doc, setDoc] = useState<string | null>(null);
  const [docError, setDocError] = useState(false);

  useEffect(() => {
    const file = cs ? '/docs/terranova/kailash.cs.md' : '/docs/terranova/kailash.en.md';
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
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '165, 180, 252' } as React.CSSProperties}>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="shrink-0 w-20 h-20 flex items-center justify-center zion-rainbow-sub" style={{ '--rc': '165, 180, 252' } as React.CSSProperties}>
                  <Mountain className="h-10 w-10 text-indigo-200" />
                </div>

                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="zion-badge">L5 · Terra Nova · Four Traditions</span>
                    <span className="zion-badge-gold inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {Copy.visionStage[cs ? 'cs' : 'en']}
                    </span>
                  </div>

                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gradient">
                    Kailash
                  </h1>
                  <p className="text-lg text-indigo-200 font-medium">
                    {Copy.subtitle[cs ? 'cs' : 'en']}
                  </p>

                  <div className="flex items-center gap-1.5 text-white/70">
                    <MapPin className="w-4 h-4 text-white/85 shrink-0" />
                    <span className="text-sm">{Copy.locationLine[cs ? 'cs' : 'en']}</span>
                  </div>

                  <blockquote className="mt-4 pl-4 border-l-2 border-white/10 text-sm text-white/70 italic leading-relaxed max-w-lg">
                    {Copy.quote[cs ? 'cs' : 'en']}
                    <cite className="block mt-2 not-italic text-[10px] uppercase tracking-[0.25em] text-white/35">
                      {cs ? 'Kvantová revoluce — prolog „Kruh u věčného ohně"' : 'Quantum Revolution — prologue, "The circle at the eternal fire"'}
                    </cite>
                  </blockquote>

                  <div className="grid gap-3 pt-3 sm:grid-cols-3">
                    {[
                      { icon: Mountain, value: cs ? '6 638 m' : '6,638 m', labelCs: 'Nikdy nezlaná', labelEn: 'Never climbed' },
                      { icon: Users, value: cs ? '4 tradice' : '4 traditions', labelCs: 'Jedna hora', labelEn: 'One mountain' },
                      { icon: Sparkles, value: cs ? 'Vize' : 'Vision', labelCs: 'Stav', labelEn: 'Status' },
                    ].map((signal) => {
                      const Icon = signal.icon;
                      return (
                        <div key={signal.labelCs} className="zion-rainbow-sub px-3 py-3" style={{ '--rc': '165, 180, 252' } as React.CSSProperties}>
                          <div className="flex items-center gap-2 text-indigo-200">
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
                src="/images/kailash/hero.webp"
                srcSet="/images/kailash/hero-m.webp 960w, /images/kailash/hero.webp 1600w"
                sizes="(max-width: 1320px) calc(100vw - 2rem), 1280px"
                alt="Kailash — pyramida Gang Rinpoche za hvězdné noci, prastarý oheň a kora poutníků"
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
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '165, 180, 252' } as React.CSSProperties}>
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
              <Compass className="h-7 w-7 text-indigo-300" />
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

        {/* ═══ THE FIRE ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '251, 146, 60' } as React.CSSProperties}>
            <div className="mb-4">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.fireSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-3 mt-1">
                <Flame className="h-7 w-7 text-orange-300" />
                {Copy.fireTitle[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <p className="text-gray-300 leading-relaxed mb-6">
              {Copy.fireBody[cs ? 'cs' : 'en']}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {Copy.firePoints[cs ? 'cs' : 'en'].map((point, i) => {
                const PointIcon = [Users, Sparkles, Compass][i];
                return (
                  <div key={point} className="zion-rainbow-sub px-4 py-3" style={{ '--rc': '251, 146, 60' } as React.CSSProperties}>
                    <div className="flex items-center gap-2 text-orange-300 mb-1">
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
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '165, 180, 252' } as React.CSSProperties}>
            <div className="mb-8">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.phasesSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white">{Copy.phasesTitle[cs ? 'cs' : 'en']}</h2>
            </div>
            <div className="space-y-4">
              {PHASES.map((phase) => (
                <div key={phase.num} className="zion-rainbow-sub p-5 flex gap-4" style={{ '--rc': '165, 180, 252' } as React.CSSProperties}>
                  <div
                    className={`shrink-0 w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm ${
                      phase.active ? 'border-indigo-300/40 bg-indigo-300/10 text-indigo-200' : 'border-white/10 bg-white/5 text-gray-500'
                    }`}
                  >
                    {phase.num}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">
                      {cs ? phase.cs : phase.en}
                      {phase.active && <span className="ml-2 text-[10px] uppercase tracking-widest text-indigo-200">· {cs ? 'probíhá' : 'in progress'}</span>}
                    </h3>
                    <p className="text-sm text-gray-400">{cs ? phase.descCs : phase.descEn}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ═══ FOUR TRADITIONS LEAD ═══ */}
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
            <div className="zion-rainbow-card p-6" style={{ '--rc': '165, 180, 252' } as React.CSSProperties}>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <Network className="h-5 w-5 text-indigo-200" />
                {Copy.zionTitle[cs ? 'cs' : 'en']}
              </h2>
              <div className="flex flex-wrap gap-2">
                {ZION_ITEMS.map((item) => (
                  <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-indigo-300/30 bg-indigo-300/10 px-3 py-1 text-xs text-indigo-200">
                    <item.icon className="h-3 w-3" />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="zion-rainbow-card p-6" style={{ '--rc': '165, 180, 252' } as React.CSSProperties}>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <Landmark className="h-5 w-5 text-indigo-200" />
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
            <div className="zion-rainbow-card p-6" style={{ '--rc': '165, 180, 252' } as React.CSSProperties}>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.sisterSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-2xl font-semibold text-white">{Copy.sisterTitle[cs ? 'cs' : 'en']}</h2>
              <p className="text-sm text-gray-400 mt-2">{Copy.sisterBody[cs ? 'cs' : 'en']}</p>
              <div className="mt-5 grid sm:grid-cols-2 gap-3">
                {SISTERS.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="zion-rainbow-sub p-4 group"
                    style={{ '--rc': '165, 180, 252' } as React.CSSProperties}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white group-hover:text-indigo-200 transition-colors">{s.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{s.region[cs ? 'cs' : 'en']}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-indigo-200/70 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            <div className="zion-rainbow-card p-6 flex flex-col justify-between" style={{ '--rc': '251, 146, 60' } as React.CSSProperties}>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Výzva' : 'Call'}</p>
                <h2 className="text-2xl font-semibold text-white mt-1">{cs ? 'Obcházet, ne zdolávat' : 'Walk around, never climb'}</h2>
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
                  <ArrowRight className="h-4 w-4" />
                </a>
                <Link href="/l5-free-world" className="zion-button-secondary w-full justify-center">
                  {cs ? 'L5 Free World' : 'L5 Free World'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
