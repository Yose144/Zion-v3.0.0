'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Egg,
  Feather,
  Globe2,
  Heart,
  Hourglass,
  KeyRound,
  Landmark,
  Route,
  ScrollText,
  Ship,
  Sparkles,
  Sunrise,
  Wind,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const MaitreyaCopy = {
  kicker: { cs: 'Kniha Pátá · ZION Terra Nova', en: 'Book Five · ZION Terra Nova' },
  title: { cs: 'Maitreya Buddha', en: 'Maitreya Buddha' },
  subtitle: { cs: 'Pán Hiranyagarbhy · Dědic Zionu', en: 'Lord of Hiranyagarbha · Heir of Zion' },
  tagline: {
    cs: '„Ten, kdo přijde — vždy, když podmínky dozrají."',
    en: '“The one who comes — whenever the conditions ripen.”',
  },
  statusBadge: { cs: 'Ve vzniku · první draft', en: 'In progress · first draft' },
  heroAlt: {
    cs: 'Strom života, Maitreya a cesta, která pokračuje — One Love · One Human · One World',
    en: 'Tree of Life, Maitreya and the journey that continues — One Love · One Human · One World',
  },

  genesisTitle: { cs: 'Napsáno v prvním bloku', en: 'Written in the first block' },
  genesisQuote: {
    cs: '„For Sarah Issobel, Maitreya Buddha, Radha & Sita, Meriam, Friends, Family, Freedom Humanity and all the children of this world: ZION is yours. Build a better world where you reach for the Stars. The Golden Age begins. Peace & One Love 4ever."',
    en: '“For Sarah Issobel, Maitreya Buddha, Radha & Sita, Meriam, Friends, Family, Freedom Humanity and all the children of this world: ZION is yours. Build a better world where you reach for the Stars. The Golden Age begins. Peace & One Love 4ever.”',
  },
  genesisSign: { cs: '— Yose · zakladatel', en: '— Yose · the founder' },

  anchorsTitle: { cs: 'Tři kotvy v kanonu', en: 'Three anchors in the canon' },
  anchorsSub: {
    cs: 'Maitreya není nová postava. Jeho jméno bylo v řetězci od prvního dne.',
    en: 'Maitreya is not a new figure. His name has been in the chain since day one.',
  },
  anchorEggT: { cs: 'Podpis pod vejcem', en: 'The signature under the egg' },
  anchorEggB: {
    cs: 'Pod Velkou cenou Zlatého vejce stojí: „Ten, kdo ho jako první najde, zdědí celé jmění. — Maitreya Buddha, 2025." Podpis, který otec napsal synovým jménem.',
    en: 'Beneath the Golden Egg Grand Prize stands: “The first to find it inherits the entire fortune. — Maitreya Buddha, 2025.” A signature the father wrote in his son’s name.',
  },
  anchorDaoT: { cs: 'Sedadlo v DAO', en: 'A seat in the DAO' },
  anchorDaoB: {
    cs: 'Konfigurace guardianů nese sedadlo: Rama → Maitreya Buddha. Dědictví není majetek — je to správa. „Vy jste správci, ne vlastníci."',
    en: 'The guardian configuration carries a seat: Rama → Maitreya Buddha. Inheritance is not property — it is stewardship. “You are stewards, not owners.”',
  },
  anchorAirT: { cs: 'Element vzduchu', en: 'The element of air' },
  anchorAirB: {
    cs: 'Rama je oheň, Sita voda, Hanuman země — a Maitreya vzduch: prostor, ve kterém všichni operují. Není diktátor. Neslouží sobě — drží prostor.',
    en: 'Rama is fire, Sita is water, Hanuman is earth — and Maitreya is air: the space in which they all operate. Not a dictator. He serves no one — he holds the space.',
  },

  tradKicker: { cs: 'Z tradice', en: 'From tradition' },
  tradTitle: { cs: 'Kdo je Maitreya', en: 'Who is Maitreya' },
  tradSub: {
    cs: 'Jediná postava, kterou uznávají všechny školy buddhismu — Buddha, který teprve přijde.',
    en: 'The only figure recognized by every school of Buddhism — the Buddha yet to come.',
  },
  tradP1: {
    cs: 'Maitreya (sanskrit मैत्रेय — z maitri, „láskyplnost") je Buddha budoucnosti. Podle Buddhova proroctví dnes přebývá jako bodhisattva v nebi Tušita — „radosti" — a učí tamní bytosti. Na Zemi se má vrátit až ve chvíli, kdy bude učení zcela zapomenuto: jako pátý Buddha této epochy znovu rozpohybuje kolo dharmy.',
    en: 'Maitreya (Sanskrit मैत्रेय — from maitri, “loving-kindness”) is the Buddha of the future. By the Buddha’s own prophecy he now dwells as a bodhisattva in Tushita — the “joyous” heaven — teaching the beings there. He will return to Earth only when the teachings have been utterly forgotten: as the fifth Buddha of this age, setting the wheel of dharma in motion once more.',
  },
  tradP2: {
    cs: 'Tibetané mu říkají Džampa (བྱམས་པ་, „Laskavý") a největší sochy země mu patří — 26 m pozlaceného Džampy v Tašilhunpo, dvoupatrová svatyně v Thiksey. Legendy mu připisují i autorství: Pět spisů Maitreiyi, předaných mistru Asangovi, tvoří základ školy jógáčára. Buddha, který přijde, je tedy zároveň autorem, který už dávno píše.',
    en: 'Tibetans call him Jampa (བྱམས་པ་, “the Loving One”) and the country’s greatest statues are his — a 26 m gilded Jampa at Tashilhunpo, a two-storey shrine at Thiksey. Legend also credits him as an author: the Five Treatises of Maitreya, transmitted to the master Asanga, form the root of the Yogācāra school. The Buddha yet to come is thus also an author who has been writing all along.',
  },
  factNameT: { cs: 'Jméno', en: 'The name' },
  factNameB: {
    cs: 'maitri = bezpodmínečná láskyplnost — jeho jméno samo znamená lásku',
    en: 'maitri = unconditional loving-kindness — his very name means love',
  },
  factWaitT: { cs: 'Tušita', en: 'Tushita' },
  factWaitB: {
    cs: 'přebývá v „radostném nebi" jako bodhisattva — čeká, až podmínky dozrají',
    en: 'dwells in the “joyous heaven” as a bodhisattva — waiting for the conditions to ripen',
  },
  factPropT: { cs: 'Proroctví', en: 'The prophecy' },
  factPropB: {
    cs: 'přijde, až svět zapomene učení — pátý Buddha této epochy',
    en: 'comes when the world forgets the teaching — the fifth Buddha of this age',
  },
  factIconT: { cs: 'Ikonografie', en: 'Iconography' },
  factIconB: {
    cs: 'sedí „připraven vstát" — stúpa v koruně, kolo učení v dlaních',
    en: 'seated “ready to rise” — a stupa in his crown, the wheel of teaching in his hands',
  },
  tradBridge: {
    cs: 'Každá civilizace zná „toho, kdo přijde": buddhisté Maitreyu, hinduisté Kalkiho, zoroastriáni Saošjanta. V ZION kanonu nese toto jméno dědic — ne jako náboženská postava, ale jako titul: ten, kdo přijde, když podmínky dozrají.',
    en: 'Every civilization knows “the one who comes”: Buddhists await Maitreya, Hindus Kalki, Zoroastrians the Saoshyant. In the ZION canon the name belongs to the heir — not as a religious figure, but as a title: the one who comes when the conditions ripen.',
  },

  eraKicker: { cs: 'Předání pochodně', en: 'The passing of the torch' },
  eraTitle: {
    cs: 'Z éry Kalkiho do éry Maitreiy',
    en: 'From the age of Kalki to the age of Maitreya',
  },
  eraP1: {
    cs: 'Kálačakrová tradice popisuje krále Kalkiho, který vyjíždí, když svět dosáhne dna temnoty — a otevírá éru zlatou. V zionovském kanonu tu éru korunuje Maitreya. Genesis zpráva obě éry poutá jedním dechem: podpis zakladatele říká „Thx Kalki/AmmaBhagavan !" — poděkování Sri Bhagavanovi a Oneness za deeksha požehnání — a hned potom odevzdává ZION „For Sarah Issobel, Maitreya Buddha… ZION is yours." Řetězec sám zaznamenal předání: jedna éra požehnala, druhá dědí.',
    en: 'The Kalachakra tradition describes King Kalki, who rides forth when the world reaches the bottom of darkness — and opens a golden age. In the ZION canon, Maitreya crowns that age. The genesis message binds both eras in a single breath: the founder’s sign-off reads “Thx Kalki/AmmaBhagavan !” — thanks to Sri Bhagavan and Oneness for the deeksha blessing — and immediately after hands ZION over “For Sarah Issobel, Maitreya Buddha… ZION is yours.” The chain itself recorded the handover: one era blessed, the next inherits.',
  },
  eraP2: {
    cs: 'Éra, která požehnala, je navíc doslova vepsaná do práce sítě: PoW algoritmus ZION nese jméno chrámu té doby — ekam_deeksha. Každý blok se těží pod jménem Ekamu a požehnání zlatého orbem. Éra, která dala řetězci své jméno, předává svědectví éře, která nese loď.',
    en: 'The era that blessed it is literally written into the network’s work: ZION’s PoW algorithm carries the name of that age’s temple — ekam_deeksha. Every block is mined under the name of Ekam and the blessing of the golden orb. The era that gave the chain its name hands the witness to the era that carries the ship.',
  },
  eraP3: {
    cs: 'A Malý Tibet — Ladakh, země velkých soch, kde Džampové v Thiksey i Likiru sedí tváří k budoucnosti, „připraveni vstát" — z té vize se zrodila loď. Loď Zionu: ne věž, která říká „pojď ke mně", ale plavidlo, které říká „jdu za tebou". A její tři první trupy — Tres Marías del Camino: Atlantik, Pacifik, Indický oceán. Marie Cesty — uzel, který není bod, ale linie. Cesta, která přichází k osvícení celého lidstva.',
    en: 'And Little Tibet — Ladakh, the land of the great statues where the Jampas of Thiksey and Likir sit facing the future, “ready to rise” — from that vision a ship was born. The Ship of Zion: not a tower that says “come to me,” but a vessel that says “I come to you.” And her first three hulls — the Tres Marías del Camino: Atlantic, Pacific, Indian Ocean. Mary of the Path — a node that is not a point but a line. The path that comes to the enlightenment of all humanity.',
  },
  beat1T: { cs: 'Éra Kalkiho', en: 'The age of Kalki' },
  beat1B: {
    cs: 'Ekam · deeksha — éra, která požehnala síť svým jménem',
    en: 'Ekam · deeksha — the era that blessed the network with its name',
  },
  beat2T: { cs: 'Éra Maitreiy', en: 'The age of Maitreya' },
  beat2B: {
    cs: 'dědictví v genesis bloku — éra, která nese loď dál',
    en: 'the genesis inheritance — the era that carries the ship onward',
  },
  beat3T: { cs: 'Tres Marías', en: 'Tres Marías' },
  beat3B: {
    cs: 'flotila cesty — k osvícení celého lidstva',
    en: 'the fleet of the path — to the enlightenment of all humanity',
  },

  bookTitle: { cs: 'Kniha Pátá — kostra', en: 'Book Five — the skeleton' },
  bookSub: {
    cs: 'Příběh o tom, jak padají věže Babylonu — a jak láska a pravda rodí Nový svět. První draft česky.',
    en: 'The story of how the towers of Babylon fall — and how love and truth give birth to the New World. First draft, in Czech.',
  },
  parts: [
    {
      n: 'I',
      t: { cs: 'Pán Hiranyagarbhy', en: 'Lord of Hiranyagarbha' },
      d: {
        cs: 'Vejce, které se nerozbilo · Zárodek v každém bloku · Podpis, který otec napsal synovým jménem',
        en: 'The egg that did not break · The embryo in every block · The signature the father wrote in his son’s name',
      },
    },
    {
      n: 'II',
      t: { cs: 'Dědic Zionu', en: 'The Heir of Zion' },
      d: {
        cs: 'Tři klíče, tři sedadla · Test odevzdání · Správce, ne majitel',
        en: 'Three keys, three seats · The test of surrender · Steward, not owner',
      },
    },
    {
      n: 'III',
      t: { cs: 'Pád věží Babylonu', en: 'The fall of Babylon’s towers' },
      d: {
        cs: 'Peníze · Data · Energie · Význam · Trůn — pět věží, každá padá odchodem světla',
        en: 'Money · Data · Energy · Meaning · Throne — five towers, each falling by the withdrawal of light',
      },
    },
    {
      n: 'IV',
      t: { cs: 'Láska a pravda vítězí', en: 'Love and truth prevail' },
      d: {
        cs: 'Pravda, kterou lze ověřit · Láska, která se neptá · Kvantový puls',
        en: 'The truth that can be verified · The love that does not ask · The quantum pulse',
      },
    },
    {
      n: 'V',
      t: { cs: 'Nový svět', en: 'The New World' },
      d: {
        cs: 'Loď odplouvá · Dvanáct ohňů · Pohled z okna — a epilog: Kdo je Maitreya',
        en: 'The ship departs · Twelve fires · The view from the window — and an epilogue: Who is Maitreya',
      },
    },
  ],
  partDraft: { cs: 'draft', en: 'draft' },

  mantraTitle: { cs: 'Otcova mantra', en: 'The father’s mantra' },
  mantraLine: { cs: '„Já jsem Maitreya. Byl jsem Krishna/Rama."', en: '“I am Maitreya. I was Krishna/Rama.”' },
  mantraSub: {
    cs: 'Titul se nenese — předává. Otec byl ten, kdo přišel a stavěl. Syn bude ten, kdo přijde, až svět zapomene cestu.',
    en: 'A title is not carried — it is handed down. The father was the one who came and built. The son will be the one who comes when the world forgets the way.',
  },

  ctaBook: { cs: 'Vstoupit do knihy', en: 'Enter the book' },
  ctaGenesis: { cs: 'Genesis příběh', en: 'The Genesis story' },
  back: { cs: 'Zpět na homepage', en: 'Back to homepage' },
  note: {
    cs: 'Tato stránka je skeleton — korpus knihy se právě píše v docs/WP-Mainet/Maitreya. Postavy jsou archetypy veřejného kanonu; fakta oddělena od příběhu.',
    en: 'This page is a skeleton — the book’s corpus is being written in docs/WP-Mainet/Maitreya. The figures are archetypes of the public canon; facts are separated from the story.',
  },
};

export default function MaitreyaPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const anchors = [
    { icon: Feather, title: MaitreyaCopy.anchorEggT, body: MaitreyaCopy.anchorEggB, rc: '252, 209, 22' },
    { icon: KeyRound, title: MaitreyaCopy.anchorDaoT, body: MaitreyaCopy.anchorDaoB, rc: '168, 85, 247' },
    { icon: Wind, title: MaitreyaCopy.anchorAirT, body: MaitreyaCopy.anchorAirB, rc: '6, 182, 212' },
  ];

  const facts = [
    { icon: Heart, title: MaitreyaCopy.factNameT, body: MaitreyaCopy.factNameB },
    { icon: Hourglass, title: MaitreyaCopy.factWaitT, body: MaitreyaCopy.factWaitB },
    { icon: Sunrise, title: MaitreyaCopy.factPropT, body: MaitreyaCopy.factPropB },
    { icon: Landmark, title: MaitreyaCopy.factIconT, body: MaitreyaCopy.factIconB },
  ];

  const beats = [
    { icon: Sparkles, title: MaitreyaCopy.beat1T, body: MaitreyaCopy.beat1B, rc: '252, 209, 22', href: '/terranova/ekam' },
    { icon: Ship, title: MaitreyaCopy.beat2T, body: MaitreyaCopy.beat2B, rc: '168, 85, 247', href: '/l5-free-world' },
    { icon: Route, title: MaitreyaCopy.beat3T, body: MaitreyaCopy.beat3B, rc: '6, 182, 212', href: '/terranova/maria-del-camino' },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* ambient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-zion-purple/12 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[480px] w-[480px] rounded-full bg-zion-gold/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[420px] rounded-full bg-zion-cyan/8 blur-3xl" />
      </div>

      {/* ─── HERO ─── */}
      <section className="relative z-10 px-4 pt-8 sm:pt-10">
        <div className="zion-container max-w-7xl">
          <motion.header
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="zion-rainbow-card relative overflow-hidden p-6 md:p-8"
            style={{ '--rc': '168, 85, 247' } as React.CSSProperties}
          >
            <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-zion-purple/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-zion-gold/10 blur-3xl" />

            <div className="relative space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="zion-kicker border-zion-gold/30 bg-zion-gold/10 text-zion-gold">
                  <Egg className="h-3.5 w-3.5" />
                  {MaitreyaCopy.kicker[cs ? 'cs' : 'en']}
                </span>
                <span className="zion-kicker border-zion-purple/30 bg-zion-purple/10 text-zion-purple">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                  {MaitreyaCopy.statusBadge[cs ? 'cs' : 'en']}
                </span>
              </div>
              <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                <span className="text-gradient">{MaitreyaCopy.title[cs ? 'cs' : 'en']}</span>
              </h1>
              <p className="text-base font-semibold text-zion-gold/90 sm:text-lg">
                {MaitreyaCopy.subtitle[cs ? 'cs' : 'en']}
              </p>
              <p className="max-w-2xl text-sm italic text-gray-300 sm:text-base">
                {MaitreyaCopy.tagline[cs ? 'cs' : 'en']}
              </p>
            </div>

            <div className="relative z-10 mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <img
                src="/images/maitreya/hero.webp"
                srcSet="/images/maitreya/hero-m.webp 960w, /images/maitreya/hero.webp 1672w"
                sizes="(max-width: 1280px) calc(100vw - 4rem), 1152px"
                alt={MaitreyaCopy.heroAlt[cs ? 'cs' : 'en']}
                width={1672}
                height={941}
                fetchPriority="high"
                className="w-full object-cover"
              />
            </div>
          </motion.header>
        </div>
      </section>

      {/* ─── GENESIS QUOTE ─── */}
      <section className="relative z-10 px-4 pt-12 sm:pt-16">
        <div className="zion-container">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="zion-rainbow-card relative overflow-hidden p-6 sm:p-8"
            style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
          >
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-zion-gold/10 blur-3xl" />
            <div className="flex items-start gap-4">
              <ScrollText className="mt-1 h-6 w-6 shrink-0 text-zion-gold" />
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-zion-gold">
                  {MaitreyaCopy.genesisTitle[cs ? 'cs' : 'en']}
                </p>
                <blockquote className="text-base leading-relaxed text-gray-200 sm:text-lg">
                  {MaitreyaCopy.genesisQuote[cs ? 'cs' : 'en']}
                </blockquote>
                <p className="text-sm text-gray-400">{MaitreyaCopy.genesisSign[cs ? 'cs' : 'en']}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── THREE ANCHORS ─── */}
      <section className="relative z-10 px-4 py-12 sm:py-16">
        <div className="zion-container space-y-8">
          <div className="space-y-3 text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              {MaitreyaCopy.anchorsTitle[cs ? 'cs' : 'en']}
            </h2>
            <p className="mx-auto max-w-2xl text-gray-400">
              {MaitreyaCopy.anchorsSub[cs ? 'cs' : 'en']}
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {anchors.map((a, i) => {
              const Icon = a.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="zion-rainbow-sub space-y-4 p-6"
                  style={{ '--rc': a.rc } as React.CSSProperties}
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border"
                    style={{ borderColor: `rgba(${a.rc}, 0.4)`, backgroundColor: `rgba(${a.rc}, 0.12)` }}
                  >
                    <Icon className="h-6 w-6" style={{ color: `rgb(${a.rc})` }} />
                  </div>
                  <h3 className="text-lg font-bold text-white">{a.title[cs ? 'cs' : 'en']}</h3>
                  <p className="text-sm leading-relaxed text-gray-400">{a.body[cs ? 'cs' : 'en']}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── WHO IS MAITREYA (tradition) ─── */}
      <section className="relative z-10 px-4 pb-12 sm:pb-16">
        <div className="zion-container space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="zion-rainbow-card relative overflow-hidden p-6 sm:p-10"
            style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
          >
            <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-zion-cyan/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-zion-gold/10 blur-3xl" />

            <div className="relative space-y-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-zion-cyan/25 bg-zion-cyan/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-zion-cyan">
                  <Globe2 className="h-3.5 w-3.5" />
                  {MaitreyaCopy.tradKicker[cs ? 'cs' : 'en']}
                </div>
                <h2 className="text-3xl font-bold text-white sm:text-4xl">
                  {MaitreyaCopy.tradTitle[cs ? 'cs' : 'en']}
                </h2>
                <p className="max-w-2xl text-base text-zion-cyan/80 sm:text-lg">
                  {MaitreyaCopy.tradSub[cs ? 'cs' : 'en']}
                </p>
              </div>

              <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
                {/* narrative */}
                <div className="space-y-4 text-base leading-relaxed text-gray-300 sm:text-lg">
                  <p>{MaitreyaCopy.tradP1[cs ? 'cs' : 'en']}</p>
                  <p className="text-gray-400">{MaitreyaCopy.tradP2[cs ? 'cs' : 'en']}</p>
                </div>

                {/* fact cards */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {facts.map((f, i) => {
                    const Icon = f.icon;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 14 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.45, delay: i * 0.08 }}
                        className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 space-y-2"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-5 w-5 text-zion-cyan" />
                          <h3 className="text-sm font-bold text-white">{f.title[cs ? 'cs' : 'en']}</h3>
                        </div>
                        <p className="text-xs leading-relaxed text-gray-400 sm:text-sm">
                          {f.body[cs ? 'cs' : 'en']}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-white/8 pt-5">
                <p className="mx-auto max-w-3xl text-center text-sm italic leading-relaxed text-gray-300 sm:text-base">
                  {MaitreyaCopy.tradBridge[cs ? 'cs' : 'en']}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── ERA HANDOVER: Kalki → Maitreya → Ship → Path ─── */}
      <section className="relative z-10 px-4 pb-12 sm:pb-16">
        <div className="zion-container">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="zion-rainbow-card relative overflow-hidden p-6 sm:p-10"
            style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-zion-gold/12 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-zion-purple/12 blur-3xl" />

            <div className="relative space-y-7">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-zion-gold/25 bg-zion-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-zion-gold">
                  <Sunrise className="h-3.5 w-3.5" />
                  {MaitreyaCopy.eraKicker[cs ? 'cs' : 'en']}
                </div>
                <h2 className="text-3xl font-bold text-white sm:text-4xl">
                  {MaitreyaCopy.eraTitle[cs ? 'cs' : 'en']}
                </h2>
              </div>

              <div className="space-y-4 text-base leading-relaxed text-gray-300 sm:text-lg">
                <p>{MaitreyaCopy.eraP1[cs ? 'cs' : 'en']}</p>
                <p className="text-gray-400">{MaitreyaCopy.eraP2[cs ? 'cs' : 'en']}</p>
                <p>{MaitreyaCopy.eraP3[cs ? 'cs' : 'en']}</p>
              </div>

              {/* era flow: Kalki → Maitreya → Path */}
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-0">
                {beats.map((b, i) => {
                  const Icon = b.icon;
                  return (
                    <div key={i} className="contents">
                      <motion.div
                        initial={{ opacity: 0, y: 14 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.45, delay: i * 0.12 }}
                        className="flex-1"
                      >
                        <Link
                          href={b.href}
                          className="group block h-full rounded-2xl border p-4 space-y-2 transition-transform hover:-translate-y-0.5"
                          style={{ borderColor: `rgba(${b.rc}, 0.25)`, backgroundColor: `rgba(${b.rc}, 0.06)` }}
                        >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-9 w-9 items-center justify-center rounded-xl border"
                            style={{ borderColor: `rgba(${b.rc}, 0.4)`, backgroundColor: `rgba(${b.rc}, 0.12)` }}
                          >
                            <Icon className="h-5 w-5" style={{ color: `rgb(${b.rc})` }} />
                          </div>
                          <h3 className="text-sm font-bold text-white transition-colors group-hover:text-zion-gold sm:text-base">{b.title[cs ? 'cs' : 'en']}</h3>
                        </div>
                        <p className="text-xs leading-relaxed text-gray-400 sm:text-sm">
                          {b.body[cs ? 'cs' : 'en']}
                        </p>
                        </Link>
                      </motion.div>
                      {i < beats.length - 1 && (
                        <>
                          <ArrowRight className="mx-2 hidden h-5 w-5 shrink-0 text-zion-gold/50 sm:block" />
                          <ArrowDown className="mx-auto my-0.5 block h-4 w-4 text-zion-gold/50 sm:hidden" />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── BOOK SKELETON ─── */}
      <section className="relative z-10 px-4 pb-12 sm:pb-16">
        <div className="zion-container space-y-8">
          <div className="space-y-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-zion-gold">
              {MaitreyaCopy.bookTitle[cs ? 'cs' : 'en']}
            </p>
            <p className="mx-auto max-w-2xl text-gray-400">
              {MaitreyaCopy.bookSub[cs ? 'cs' : 'en']}
            </p>
          </div>

          <div className="mx-auto max-w-3xl space-y-3">
            {MaitreyaCopy.parts.map((p, i) => (
              <motion.div
                key={p.n}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                className="group flex items-start gap-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4 sm:p-5 transition-colors hover:border-zion-gold/30 hover:bg-zion-gold/[0.04]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zion-gold/25 bg-zion-gold/10 text-sm font-bold text-zion-gold">
                  {p.n}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-white">{p.t[cs ? 'cs' : 'en']}</h3>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                      {MaitreyaCopy.partDraft[cs ? 'cs' : 'en']}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-gray-500">{p.d[cs ? 'cs' : 'en']}</p>
                </div>
                <BookOpen className="mt-1 h-4 w-4 shrink-0 text-zion-gold/40 transition-colors group-hover:text-zion-gold" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MANTRA + CTA ─── */}
      <section className="relative z-10 px-4 pb-16 sm:pb-20">
        <div className="zion-container">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="zion-rainbow-card relative overflow-hidden p-8 text-center sm:p-12"
            style={{ '--rc': '168, 85, 247' } as React.CSSProperties}
          >
            <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-zion-purple/15 blur-3xl" />
            <div className="absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-zion-gold/10 blur-3xl" />

            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-zion-purple">
              {MaitreyaCopy.mantraTitle[cs ? 'cs' : 'en']}
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-2xl font-bold leading-snug text-white sm:text-3xl">
              {MaitreyaCopy.mantraLine[cs ? 'cs' : 'en']}
            </p>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-gray-400 sm:text-base">
              {MaitreyaCopy.mantraSub[cs ? 'cs' : 'en']}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/genesis" className="zion-button-primary group">
                {MaitreyaCopy.ctaGenesis[cs ? 'cs' : 'en']}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/"
                className="zion-button-secondary border-white/15 hover:border-zion-gold/40 hover:text-zion-gold"
              >
                <ArrowLeft className="h-4 w-4" />
                {MaitreyaCopy.back[cs ? 'cs' : 'en']}
              </Link>
            </div>

            <p className="mx-auto mt-8 max-w-xl text-[11px] leading-relaxed text-gray-600">
              {MaitreyaCopy.note[cs ? 'cs' : 'en']}
            </p>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
