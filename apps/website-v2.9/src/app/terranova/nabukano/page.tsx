'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleSlash,
  Compass,
  Flag,
  Orbit,
  Route,
  Satellite,
  Sparkles,
  Waves,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useLang } from '@/contexts/LanguageContext';
import { tx5, t5 } from '@/lib/i18n-tx';

const NebeskaFlotilaPreviewLazy = dynamic(() => import('@/components/NebeskaFlotilaPreviewLazy'), { ssr: false });
import { useState } from 'react';

const RC = '56, 189, 248'; // nebe — modrá flotily

const Copy = {
  back: { cs: 'Zpět na Terra Nova', en: 'Back to Terra Nova' },
  badge: { cs: 'L6 · Nebeská flotila · pohyblivý uzel', en: 'L6 · Sky fleet · mobile node' },
  status: { cs: 'Vize — kýl položený není', en: 'Vision — no keel laid' },
  subtitle: {
    cs: 'Nabukano · tři nebeské Marie · osa mezi LUMI a Issobellou',
    en: 'Nabukano · three sky Marías · the axis between LUMI and Issobella',
  },
  location: {
    cs: 'Pozemní uzel LUMI (Kostarika) → Issobella · oběžná dráha Nové Země',
    en: 'Ground node LUMI (Costa Rica) → Issobella · New Earth orbit',
  },
  quote: {
    cs: '„Loď nemá nést jméno nejsilnějšího. Má nést jméno toho, kdo se naučil zvednout oči."',
    en: '“A ship should not carry the name of the strongest. It should carry the name of the one who learned to lift his eyes.”',
  },
  heroPending: {
    cs: 'Hero se připravuje',
    en: 'Hero in preparation',
  },
  heroHint: {
    cs: 'Až bude obraz hotový, nahraje se jako /images/nabukano/hero.webp (1920×1080) a objeví se tady.',
    en: 'Once the artwork is ready it goes in as /images/nabukano/hero.webp (1920×1080) and appears here.',
  },
  introTitle: { cs: 'Čtrnáctý uzel to není', en: 'It is not a fourteenth node' },
  introBody: {
    cs: 'Nebeská flotila je uzel L6 — a přesto nemá pin na pevnině. Dvanáct pozemských uzlů jsou body, archa je linie po vodě, Matrix zrcadlo na Měsíci. Flotila je svislá osa: začíná u pozemního uzlu LUMI v Kostarice, končí u stanice Issobella a mezi tím není prázdno — mezi tím je cesta. Kdo ji zakreslí jako bod, zakreslí ji špatně.',
    en: 'The sky fleet is an L6 node — and yet it has no pin on land. The twelve Earth nodes are points, the ark is a line on water, Matrix is a mirror on the Moon. The fleet is a vertical axis: it begins at the LUMI ground node in Costa Rica, ends at the Issobella station, and between them there is no emptiness — between them is the journey. Draw it as a point and you draw it wrong.',
  },
  vesselsTitle: { cs: 'Čtyři trupy', en: 'Four hulls' },
  vesselsSubtitle: {
    cs: 'Mateřská loď nese dok; tři Marie nesou tři nebe.',
    en: 'The mother ship carries the dock; the three Marías carry three skies.',
  },
  routesTitle: { cs: 'Dvě trasy', en: 'Two routes' },
  routesBody: {
    cs: 'První úsek cesty není přes moře, ale vzhůru: z pozemního uzlu LUMI k prstenu Issobelly. Odsud se flotila rozjíždí do blízkého nebe, mezi Zemi a Měsíc, nebo na dlouhou cestu ke světlu. V Nirvaně jde oblouk trasy vidět — je to ale animace konceptu, ne let.',
    en: 'The first leg is not across the sea but upward: from the LUMI ground node to the Issobella ring. From there the fleet sets out into the near sky, between Earth and the Moon, or on the long road toward the light. In Nirvana you can see the arc of the route — but it is a concept animation, not a flight.',
  },
  honestTitle: { cs: 'Co existuje a co ne', en: 'What exists and what does not' },
  exists: {
    cs: ['Kniha Nabukano v kánonu (7 kapitol, kotvy pravdy)', 'Uzel ve vesmírné scéně Nirvany a okno flotily', 'Tento popis a trasy jako obraz konceptu'],
    en: ['The book Nabukano in the canon (7 chapters, truth anchors)', 'The node in Nirvana’s space scene and the fleet window', 'This description and the routes as an image of the concept'],
  },
  notExists: {
    cs: ['Žádný trup, dok, výtah ani posádka', 'Žádná raketa, žádný modul, žádný termín', 'Žádný fond, podíl ani výnos — flotila nic neprodává'],
    en: ['No hull, dock, lift or crew', 'No rocket, module or schedule', 'No fund, share or yield — the fleet sells nothing'],
  },
  boardTitle: { cs: 'Dok, dispozice a interiéry', en: 'Dock, arrangement and interiors' },
  boardSubtitle: {
    cs: 'Studie 02 — kanonická podoba. Tři kotviště pod trupem, knihovna, zahrada, ordinace a lucerna na konci rámu. Umělecká deska, rozměry k ověření.',
    en: 'Study 02 — the canonical look. Three berths under the hull, a library, a garden, a sick bay and a lantern at the end of the frame. An artistic board, dimensions to be verified.',
  },
  boardSectionsTitle: { cs: 'Osm sekcí — jak je kreslí deska', en: 'Eight sections — as the board draws them' },
  boardCraftTitle: { cs: 'Tři nebeské Marie — doprovodné lodě', en: 'Three sky Marías — companion ships' },
  boardNote: {
    cs: 'Čtyři trupy, jeden dok, jedna osa. Čísla 01–08 odpovídají desce; kniha je kánon a deska je jeho obraz.',
    en: 'Four hulls, one dock, one axis. Numbers 01–08 follow the board; the book is the canon and the board is its image.',
  },
  cradleCaption: {
    cs: 'Kotviště pod trupem: tři berthy, dílna, lucerna na konci rámu — Issobella vlevo, Měsíc vpravo.',
    en: 'The cradle under the hull: three berths, a workshop, a lantern at the end of the frame — Issobella to the left, the Moon to the right.',
  },
  ctaBook: { cs: 'Číst knihu Nabukano', en: 'Read the book Nabukano' },
  ctaSpace: { cs: 'Otevřít ve vesmíru', en: 'Open in space' },
  ctaIssobella: { cs: 'Stanice Issobella', en: 'The Issobella station' },
  related: { cs: 'Souvisí', en: 'Related' },
};

type Vessel = {
  name: string;
  /** pracovní označení z konceptové desky (studie 01) */
  call: string;
  role: { cs: string; en: string };
  status: { cs: string; en: string };
  tone: string;
  icon: typeof Orbit;
};

const VESSELS: Vessel[] = [
  {
    name: 'Nabukano',
    call: 'MATEŘSKÁ LOĎ',
    role: { cs: 'Mateřská loď a dokovací rám; nese lucernu', en: 'Mother ship and docking frame; carries the lantern' },
    status: { cs: 'Vize', en: 'Vision' },
    tone: 'text-sky-300',
    icon: Orbit,
  },
  {
    name: 'Santa María la Mayor · nebeská',
    call: 'BLÍZKÁ ORBITA',
    role: { cs: 'Blízké nebe — oběžná dráha Nové Země', en: 'Near sky — New Earth orbit' },
    status: { cs: 'Vize', en: 'Vision' },
    tone: 'text-rose-300',
    icon: Satellite,
  },
  {
    name: 'Nossa Senhora de Fátima · nebeská',
    call: 'ZEMĚ ↔ MĚSÍC',
    role: { cs: 'Prostor mezi — Země a Měsíc', en: 'The space between — Earth and Moon' },
    status: { cs: 'Vize', en: 'Vision' },
    tone: 'text-amber-100',
    icon: Compass,
  },
  {
    name: 'María de las Nieves · nebeská',
    call: 'DALEKÝ HORIZONT',
    role: { cs: 'Dlouhá cesta — heliocentrická dráha', en: 'The long road — heliocentric orbit' },
    status: { cs: 'Horizont', en: 'Horizon' },
    tone: 'text-yellow-300',
    icon: Flag,
  },
];

export default function NabukanoPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [heroFailed, setHeroFailed] = useState(false);

  return (
    <main className="min-h-screen bg-[#02030a] text-white">
      <div className="relative z-10 mx-auto max-w-5xl px-4 md:px-8 pb-20 pt-10">
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }} className="mb-10">
          <Link href="/terranova" className="inline-flex items-center gap-2 text-sm text-zion-gold/65 hover:text-zion-gold transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {tx5(Copy.back, lang)}
          </Link>
        </motion.div>

        {/* ═══ HERO ═══ */}
        <motion.header initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-14">
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': RC } as React.CSSProperties}>
            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
              <div className="shrink-0 w-20 h-20 flex items-center justify-center zion-rainbow-sub" style={{ '--rc': RC } as React.CSSProperties}>
                <Orbit className="h-10 w-10 text-sky-300" />
              </div>
              <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="zion-badge">{tx5(Copy.badge, lang)}</span>
                  <span className="zion-badge-gold inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {tx5(Copy.status, lang)}
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gradient">Nabukano</h1>
                <p className="text-lg text-sky-300 font-medium">{tx5(Copy.subtitle, lang)}</p>
                <div className="flex items-center gap-1.5 text-white/70">
                  <Route className="w-4 h-4 text-white/85 shrink-0" />
                  <span className="text-sm">{tx5(Copy.location, lang)}</span>
                </div>
                <blockquote className="mt-4 pl-4 border-l-2 border-white/10 text-sm text-white/70 italic leading-relaxed max-w-lg">
                  {tx5(Copy.quote, lang)}
                </blockquote>
              </div>
            </div>

            {/* HERO IMAGE SLOT — když soubor chybí, drží místo poctivý placeholder */}
            <div className="relative z-10 mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              {!heroFailed ? (
                <img
                  src="/images/nabukano/hero.webp"
                  srcSet="/images/nabukano/hero-m.webp 960w, /images/nabukano/hero.webp 1920w"
                  sizes="(max-width: 1320px) calc(100vw - 2rem), 1280px"
                  alt={cs ? 'Nebeská flotila Nabukano — mateřská loď s dokem a tři nebeské Marie nad Novou Zemí' : t5('The Nabukano sky fleet — mother ship with a docking frame and three sky Marías above New Earth', lang)}
                  width={1920}
                  height={1080}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  onError={() => setHeroFailed(true)}
                  className="w-full object-cover"
                />
              ) : (
                <div
                  className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 py-16 text-center"
                  style={{ background: 'radial-gradient(120% 120% at 50% 0%, rgba(56,189,248,0.18) 0%, rgba(2,3,10,0.9) 70%)' }}
                >
                  <Orbit className="h-8 w-8 text-sky-300/70" />
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-200/80">
                    {tx5(Copy.heroPending, lang)}
                  </p>
                  <p className="max-w-md text-xs text-white/45">{tx5(Copy.heroHint, lang)}</p>
                </div>
              )}
            </div>

            <div className="relative z-10 grid gap-3 pt-5 sm:grid-cols-3">
              {[
                { icon: Waves, value: '4', labelCs: 'trupy', labelEn: 'hulls' },
                { icon: Route, value: '2', labelCs: 'trasy', labelEn: 'routes' },
                { icon: Sparkles, value: cs ? 'Vize' : t5('Vision', lang), labelCs: 'stav', labelEn: 'status' },
              ].map((signal) => {
                const Icon = signal.icon;
                return (
                  <div key={signal.labelCs} className="zion-rainbow-sub px-3 py-3" style={{ '--rc': RC } as React.CSSProperties}>
                    <div className="flex items-center gap-2 text-sky-300">
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
        </motion.header>

        {/* ═══ INTRO ═══ */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14">
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': RC } as React.CSSProperties}>
            <h2 className="text-2xl md:text-3xl font-semibold text-white mb-4">{tx5(Copy.introTitle, lang)}</h2>
            <p className="text-gray-300 leading-relaxed">{tx5(Copy.introBody, lang)}</p>
          </div>
        </motion.section>

        {/* ═══ VESSELS ═══ */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14">
          <div className="mb-6 text-center">
            <p className="text-[11px] uppercase tracking-[0.45em] text-sky-200/65 mb-1">{tx5(Copy.vesselsSubtitle, lang)}</p>
            <h2 className="text-2xl md:text-3xl font-semibold text-gradient">{tx5(Copy.vesselsTitle, lang)}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {VESSELS.map((v) => {
              const Icon = v.icon;
              return (
                <div key={v.name} className="zion-rainbow-card p-5" style={{ '--rc': RC } as React.CSSProperties}>
                  <div className="relative z-10">
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon className={`h-4 w-4 ${v.tone}`} />
                      <h3 className="text-white font-semibold">{v.name}</h3>
                      <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-sky-200/90">
                        {v.call}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-400">{tx5(v.role, lang)}</p>
                    <span className="mt-3 inline-block rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/55">
                      {tx5(v.status, lang)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>


        {/* ═══ 3D NÁHLED ═══ */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14">
          <div className="zion-rainbow-card p-4 md:p-5" style={{ '--rc': RC } as React.CSSProperties}>
            <div className="relative z-10 mb-3 text-center">
              <p className="text-[11px] uppercase tracking-[0.45em] text-sky-200/65 mb-1">
                {cs ? '3D model' : t5('3D model', lang)}
              </p>
              <p className="text-xs text-white/45">
                {cs
                  ? 'Tatáž scéna jako v Nirvaně — otáčej kolem trupu, přibliž si dok a lucernu.'
                  : 'The same scene as in Nirvana — orbit the hull, zoom in on the dock and the lantern.'}
              </p>
            </div>
            <div className="block w-full" style={{ height: 460 }}>
              <NebeskaFlotilaPreviewLazy lang={lang} className="h-full" />
            </div>
            <p className="relative z-10 mt-3 text-center text-xs text-white/35">
              {cs
                ? 'Umělecká geometrie z primitiv podle studie 02 — ne výrobní model.'
                : 'Artistic primitive geometry following study 02 — not a production model.'}
            </p>
          </div>
        </motion.section>

        {/* ═══ KONCEPČNÍ DESKA ═══ */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14">
          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': RC } as React.CSSProperties}>
            <div className="relative z-10">
              <h2 className="text-2xl md:text-3xl font-semibold text-white mb-2">{tx5(Copy.boardTitle, lang)}</h2>
              <p className="text-sm text-sky-200/70 mb-5">{tx5(Copy.boardSubtitle, lang)}</p>

              <a href="/images/nabukano/concept-board.webp" target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                <img
                  src="/images/nabukano/concept-board.webp"
                  srcSet="/images/nabukano/concept-board-m.webp 900w, /images/nabukano/concept-board.webp 1536w"
                  sizes="(max-width: 1320px) calc(100vw - 2rem), 1280px"
                  alt={cs ? 'Nabukano — studie 02: dok se třemi kotvišti, podélný řez, půdorys, knihovna, zahrada, ordinace a lucerna' : t5('Nabukano — study 02: the three-berth dock, longitudinal section, plan, library, garden, sick bay and lantern', lang)}
                  width={1536}
                  height={1024}
                  loading="lazy"
                  decoding="async"
                  className="w-full object-cover transition duration-500 hover:scale-[1.01]"
                />
              </a>

              <figure className="mt-5">
                <a href="/images/nabukano/cradle.webp" target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                  <img
                    src="/images/nabukano/cradle.webp"
                    srcSet="/images/nabukano/cradle-m.webp 900w, /images/nabukano/cradle.webp 1672w"
                    sizes="(max-width: 1320px) calc(100vw - 4rem), 1200px"
                    alt={cs ? 'Nabukano — dokovací rám se třemi kotvišti pod trupem, lucerna na konci' : t5('Nabukano — the docking cradle with three berths under the hull, lantern at its end', lang)}
                    width={1672}
                    height={941}
                    loading="lazy"
                    decoding="async"
                    className="w-full object-cover"
                  />
                </a>
                <figcaption className="mt-2 text-xs text-white/45">{tx5(Copy.cradleCaption, lang)}</figcaption>
              </figure>

              <h3 className="mt-6 mb-3 text-sm font-semibold uppercase tracking-widest text-sky-200/80">{tx5(Copy.boardSectionsTitle, lang)}</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { n: '01', cs: 'Můstek', en: 'Bridge' },
                  { n: '02', cs: 'Knihovna a jídelna', en: 'Library and mess' },
                  { n: '03', cs: 'Zahrada', en: 'Garden' },
                  { n: '04', cs: 'Ordinace', en: 'Sick bay' },
                  { n: '05', cs: 'Izolační kajuta', en: 'Isolation cabin' },
                  { n: '06', cs: 'Dokovací rám', en: 'Docking cradle' },
                  { n: '07', cs: 'Lucerna', en: 'Lantern' },
                  { n: '08', cs: 'Technické zázemí', en: 'Technical spaces' },
                ].map((item) => (
                  <div key={item.n} className="zion-rainbow-sub flex items-center gap-3 px-3 py-2" style={{ '--rc': RC } as React.CSSProperties}>
                    <span className="text-xs font-bold tracking-widest text-sky-300">{item.n}</span>
                    <span className="text-sm text-white/80">{cs ? item.cs : item.en}</span>
                  </div>
                ))}
              </div>

              <h3 className="mt-6 mb-3 text-sm font-semibold uppercase tracking-widest text-sky-200/80">{tx5(Copy.boardCraftTitle, lang)}</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { call: 'Santa María la Mayor', cs: 'Průzkumný člun', en: 'Survey craft', noteCs: 'blízká orbita', noteEn: 'near orbit' },
                  { call: 'Nossa Senhora de Fátima', cs: 'Lunární transport', en: 'Lunar transport', noteCs: 'Země ↔ Měsíc', noteEn: 'Earth ↔ Moon' },
                  { call: 'María de las Nieves', cs: 'Nákladní koráb', en: 'Cargo ship', noteCs: 'daleký horizont', noteEn: 'far horizon' },
                ].map((c) => (
                  <div key={c.call} className="zion-rainbow-sub px-4 py-3" style={{ '--rc': RC } as React.CSSProperties}>
                    <p className="text-xs font-bold uppercase tracking-wider text-sky-300">{c.call}</p>
                    <p className="mt-1 text-sm text-white/85">{cs ? c.cs : c.en}</p>
                    <p className="text-xs text-white/45">{cs ? c.noteCs : c.noteEn}</p>
                  </div>
                ))}
              </div>

              <p className="mt-5 text-xs text-white/45">{tx5(Copy.boardNote, lang)}</p>
            </div>
          </div>
        </motion.section>

        {/* ═══ ROUTES ═══ */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14">
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': RC } as React.CSSProperties}>
            <div className="relative z-10">
              <h2 className="text-2xl md:text-3xl font-semibold text-white mb-4">{tx5(Copy.routesTitle, lang)}</h2>
              <p className="text-gray-300 leading-relaxed">{tx5(Copy.routesBody, lang)}</p>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/60">
                <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1">LUMI · Kostarika</span>
                <ArrowRight className="h-4 w-4 text-sky-300/70" />
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">Issobella · L6</span>
                <ArrowRight className="h-4 w-4 text-sky-300/70" />
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">Nabukano</span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══ HONESTY ═══ */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="zion-rainbow-card p-6" style={{ '--rc': RC } as React.CSSProperties}>
              <h3 className="relative z-10 mb-3 text-sm font-semibold uppercase tracking-widest text-sky-200/80">
                {tx5(Copy.honestTitle, lang)}
              </h3>
              <ul className="relative z-10 space-y-2 text-sm text-gray-300">
                {(cs ? Copy.exists.cs : Copy.exists.en).map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/80" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="zion-rainbow-card p-6" style={{ '--rc': '244, 63, 94' } as React.CSSProperties}>
              <h3 className="relative z-10 mb-3 text-sm font-semibold uppercase tracking-widest text-rose-200/80">
                {cs ? 'Co neexistuje' : t5('What does not exist', lang)}
              </h3>
              <ul className="relative z-10 space-y-2 text-sm text-gray-300">
                {(cs ? Copy.notExists.cs : Copy.notExists.en).map((item) => (
                  <li key={item} className="flex gap-2">
                    <CircleSlash className="mt-0.5 h-4 w-4 shrink-0 text-rose-400/70" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.section>

        {/* ═══ CTA ═══ */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14">
          <div className="zion-cta-banner flex flex-col items-center gap-4 p-8 text-center md:flex-row md:justify-between md:text-left">
            <div>
              <p className="text-[11px] uppercase tracking-[0.4em] text-white/50">{tx5(Copy.related, lang)}</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {cs ? 'Kniha, nebe a osa — tři místa, kde to celé drží.' : t5('The book, the sky and the axis — three places where it all holds.', lang)}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/zion-archive/nabukano/cist" className="zion-rainbow-sub inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': RC } as React.CSSProperties}>
                <BookOpen className="h-4 w-4" />
                {tx5(Copy.ctaBook, lang)}
              </Link>
              <a href="https://nirvana.zionterranova.com/#portal=fleet" target="_blank" rel="noopener noreferrer" className="zion-rainbow-sub inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': RC } as React.CSSProperties}>
                <Orbit className="h-4 w-4" />
                {tx5(Copy.ctaSpace, lang)}
              </a>
              <Link href="/l6-issobella" className="inline-flex items-center gap-2 rounded-2xl border border-zion-gold/30 bg-zion-gold/5 px-5 py-3 text-sm font-semibold text-amber-200 hover:bg-zion-gold/10 transition-colors">
                <Satellite className="h-4 w-4" />
                {tx5(Copy.ctaIssobella, lang)}
              </Link>
            </div>
          </div>
        </motion.section>

        <footer className="text-center text-xs text-white/35">
          {cs
            ? 'MÝTUS · VIZE · HORIZONT — žádný trup neexistuje. Kniha Nabukano je kánon, tato stránka je jeho obraz.'
            : 'MYTH · VISION · HORIZON — no hull exists. The book Nabukano is the canon; this page is its image.'}
        </footer>
      </div>
    </main>
  );
}
