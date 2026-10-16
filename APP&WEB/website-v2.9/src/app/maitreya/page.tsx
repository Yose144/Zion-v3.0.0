'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Egg,
  Feather,
  KeyRound,
  ScrollText,
  Sparkles,
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

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* ambient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-zion-purple/12 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[480px] w-[480px] rounded-full bg-zion-gold/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[420px] rounded-full bg-zion-cyan/8 blur-3xl" />
      </div>

      {/* ─── HERO ─── */}
      <section className="relative">
        <div className="relative h-[52vh] min-h-[380px] w-full overflow-hidden sm:h-[60vh]">
          <img
            src="/images/maitreya/hero.webp"
            srcSet="/images/maitreya/hero-m.webp 960w, /images/maitreya/hero.webp 1672w"
            sizes="100vw"
            alt={MaitreyaCopy.heroAlt[cs ? 'cs' : 'en']}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#05060a] via-[#05060a]/55 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#05060a]/60 via-transparent to-transparent" />

          <div className="absolute inset-0 flex items-end">
            <div className="zion-container w-full pb-10 sm:pb-14">
              <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="space-y-4"
              >
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
                <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl xl:text-7xl">
                  <span className="text-gradient">{MaitreyaCopy.title[cs ? 'cs' : 'en']}</span>
                </h1>
                <p className="text-lg font-semibold text-zion-gold/90 sm:text-2xl">
                  {MaitreyaCopy.subtitle[cs ? 'cs' : 'en']}
                </p>
                <p className="max-w-2xl text-base italic text-gray-300 sm:text-lg">
                  {MaitreyaCopy.tagline[cs ? 'cs' : 'en']}
                </p>
              </motion.div>
            </div>
          </div>
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
