'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  CircleDot,
  Clock,
  Droplets,
  Flower2,
  GitBranch,
  Landmark,
  Mic,
  Sparkles,
  TreePine,
  Users,
  Waves,
  LucideIcon,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const ResonanceCopy = {
  resonanceProtocol: { cs: `Protokol Rezonance`, en: `Resonance Protocol` },
  soundTimeAndTheIntergeneration: { cs: `Zvuk, čas a mezigenerační most. Před hlasováním — přízvuk. Před slovem — tón. Před smlouvou — smlouva frekvencí.`, en: `Sound, time and the intergenerational bridge. Before the vote — attunement. Before the word — tone. Before the contract — the covenant of frequency.` },
  documentation: { cs: `Dokumentace`, en: `Documentation` },
  sevenFrequencies: { cs: `Sedm frekvencí`, en: `Seven Frequencies` },
  eachLayerOfTheZionStackResonat: { cs: `Každá vrstva ZION zásobníku rezonuje na své frekvenci. 108 Hz je univerzální nosná vlna všech vrstev.`, en: `Each layer of the ZION stack resonates at its own frequency. 108 Hz is the universal carrier wave across all layers.` },
  universalCarrier: { cs: `Univerzální nosná vlna`, en: `Universal carrier` },
  temporalAnchorMantraMultiplier: { cs: `Časový kotvící bod, mantra multiplikátor, podpis block headeru`, en: `Temporal anchor, mantra multiplier, block header signature` },
  threeGatesOfAttunement: { cs: `Tři brány naladění`, en: `Three Gates of Attunement` },
  beforeAProposalReachesDaoVotin: { cs: `Než návrh dosáhne DAO hlasování, musí projít třemi bránami Rady Rezonance.`, en: `Before a proposal reaches DAO voting, it must pass through three gates of the Resonance Council.` },
  everyContractIsAPrayer: { cs: `Každý kontrakt je modlitba`, en: `Every contract is a prayer` },
  theResonanceProtocolDoesNotVot: { cs: `Protokol Rezonance nehlasuje — připravuje pole, ve kterém DAO jedná. Jako Oneness Hall v EKAM před osmi komorami, Rezonance je centrální kupole, kterou protéká veškerá governance.`, en: `The Resonance Protocol does not vote — it prepares the field in which the DAO acts. Like EKAM\'s Oneness Hall before the eight chambers, Resonance is the central dome through which all governance flows.` },
  openDocumentation: { cs: `Otevřít dokumentaci`, en: `Open documentation` },
};

type SectionData = {
  icon: LucideIcon;
  titleCs: string;
  titleEn: string;
  descCs: string;
  descEn: string;
  color: string;
  rgb: string;
};

type FrequencyItem = {
  ray: string;
  chakra: string;
  hz: number;
  layer: string;
  roleCs: string;
  roleEn: string;
  color: string;
  rgb: string;
};

const FREQUENCIES: FrequencyItem[] = [
  {
    ray: 'Blue (Will)',
    chakra: 'Root',
    hz: 396,
    layer: 'L1 Core',
    roleCs: 'Validace · „Já zakládám"',
    roleEn: 'Validation · "I establish"',
    color: '#3B82F6',
    rgb: '59,130,246',
  },
  {
    ray: 'Yellow (Wisdom)',
    chakra: 'Sacral',
    hz: 417,
    layer: 'L2 DAO',
    roleCs: 'Governance · „Já rozeznávám"',
    roleEn: 'Governance · "I discern"',
    color: '#EAB308',
    rgb: '234,179,8',
  },
  {
    ray: 'Pink (Love)',
    chakra: 'Solar Plexus',
    hz: 528,
    layer: 'L3 Bridge',
    roleCs: 'Spojení · „Já tkám"',
    roleEn: 'Connection · "I weave"',
    color: '#EC4899',
    rgb: '228, 30, 43',
  },
  {
    ray: 'White (Purity)',
    chakra: 'Heart',
    hz: 639,
    layer: 'L4 Oasis',
    roleCs: 'Kurátorství · „Já odrážím"',
    roleEn: 'Curation · "I reflect"',
    color: '#F8FAFC',
    rgb: '248,250,252',
  },
  {
    ray: 'Green (Truth)',
    chakra: 'Throat',
    hz: 741,
    layer: 'L5 Community',
    roleCs: 'Komunita · „Já živím"',
    roleEn: 'Community · "I nourish"',
    color: '#22C55E',
    rgb: '7, 137, 48',
  },
  {
    ray: 'Ruby (Service)',
    chakra: 'Third Eye',
    hz: 852,
    layer: 'L6 Steward',
    roleCs: 'Ekosystém · „Já chráním"',
    roleEn: 'Ecosystem · "I protect"',
    color: '#EF4444',
    rgb: '228, 30, 43',
  },
  {
    ray: 'Violet (Freedom)',
    chakra: 'Crown',
    hz: 963,
    layer: 'L7 Meta',
    roleCs: 'Protokol · „Já rozpouštím"',
    roleEn: 'Protocol · "I dissolve"',
    color: '#A855F7',
    rgb: '228, 30, 43',
  },
];

const SECTIONS: SectionData[] = [
  {
    icon: Users,
    titleCs: 'Rada Rezonance',
    titleEn: 'Resonance Council',
    descCs:
      'Před každým návrhem Tier-2+ DAO se schází Rada Rezonance: Guardian, Youth Delegate, Elder a Frequency Keeper. Tři brány — Sankalpa (tón záměru), Kruhová rezonance a Svědek vody — musí být překročeny, než návrh obdrží pečeť pro hlasování.',
    descEn:
      'Before any Tier-2+ DAO proposal, the Resonance Council convenes: Guardian, Youth Delegate, Elder, and Frequency Keeper. Three gates — Sankalpa (tone of intent), Circle Resonance, and Water Witness — must be passed before the proposal earns its voting seal.',
    color: '#A78BFA',
    rgb: '167,139,250',
  },
  {
    icon: Clock,
    titleCs: 'Fibonacciho časová schránka',
    titleEn: 'Fibonacci Time Capsule',
    descCs:
      'Na každém Fibonacciho block height se automaticky vytvoří prázdná schránka. Starší obyvatelé pokládají otázky, mladí nahrávají vize, Guardiani syntetizují dokument — a po svědectví Rady je obsah uzamčen až do dalšího Fibonacciho čísla, kdy jej odemyká nejmladší Sapling.',
    descEn:
      'At every Fibonacci block height an empty capsule is created automatically. Elders ask questions, youth record visions, Guardians synthesize a document — and after Council witness the content is locked until the next Fibonacci number, when the youngest Sapling unlocks it.',
    color: '#F59E0B',
    rgb: '252, 209, 22',
  },
  {
    icon: GitBranch,
    titleCs: 'Most mládeže a starších',
    titleEn: 'Youth–Elder Bridge',
    descCs:
      'Dvojitý váhový systém: standardní kvadratická váha návrhu se násobí Rezonančním koeficientem (1,0–1,5x) podle HRV koherence mladých a starších. Seedling Circle sleduje agregovaný frekvenční drift, Sprout Assembly hlasuje třemi kameny, Sapling Council má právo veta nad kurikulem.',
    descEn:
      'Dual-weight system: standard quadratic proposal weight is multiplied by a Resonance Coefficient (1.0–1.5x) based on HRV coherence of youth and elders. Seedling Circle tracks aggregate frequency drift, Sprout Assembly votes with three stones, Sapling Council holds curriculum veto.',
    color: '#34D399',
    rgb: '52,211,153',
  },
  {
    icon: Mic,
    titleCs: 'Registr Světelné řeči',
    titleEn: 'Light Language Registry',
    descCs:
      'Minimální on-chain registr tónových záměrů. Každý návrh může nést 30sekundový zvukový záznam své podstaty (ne čtení, ale vtělený výraz). Frekvenční Keepers extrahují základní frekvenci a harmonickou koherenci; spektrální hash slouží jako lehká biometrická identita.',
    descEn:
      'Minimal on-chain registry of tonal intentions. Every proposal may carry a 30-second audio recording of its essence (not a reading, but an embodied expression). Frequency Keepers extract fundamental frequency and harmonic coherence; spectral hash serves as lightweight biometric identity.',
    color: '#078930',
    rgb: '7,137,48',
  },
];

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export default function ResonancePage() {
  const { lang } = useLang();

  return (
    <main className="relative overflow-hidden zion-page">
      {/* HERO */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_at_50%_0%,rgba(228, 30, 43,0.18),transparent_70%)]" />
        <div className="zion-container relative">
          <FadeIn>
            <div className="flex items-center gap-3 mb-6">
              <span className="zion-badge text-zion-purple">
                <Sparkles className="h-3.5 w-3.5" />
                L5 · Protocol
              </span>
              <span className="zion-badge text-gray-400">
                <AudioLines className="h-3.5 w-3.5" />
                v1.0
              </span>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gradient-soft">
              {ResonanceCopy.resonanceProtocol[lang === 'cs' ? 'cs' : 'en']}
            </h1>
          </FadeIn>

          <FadeIn delay={0.15}>
            <p className="mt-6 max-w-3xl text-lg md:text-xl text-gray-300 leading-relaxed">
              {ResonanceCopy.soundTimeAndTheIntergeneration[lang === 'cs' ? 'cs' : 'en']}
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/docs" className="zion-button-primary group">
                <BookOpen className="h-4 w-4" />
                {ResonanceCopy.documentation[lang === 'cs' ? 'cs' : 'en']}
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/terranova" className="zion-button-secondary group">
                <TreePine className="h-4 w-4" />
                Terra Nova
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* SEVEN FREQUENCIES */}
      <section className="relative py-20 border-t border-white/5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_50%_0%,rgba(228, 30, 43,0.12),transparent_70%)]" />
        <div className="zion-container relative">
          <FadeIn>
            <div className="mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gradient-soft">
                {ResonanceCopy.sevenFrequencies[lang === 'cs' ? 'cs' : 'en']}
              </h2>
              <p className="mt-3 text-gray-400 max-w-2xl">
                {ResonanceCopy.eachLayerOfTheZionStackResonat[lang === 'cs' ? 'cs' : 'en']}
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {FREQUENCIES.map((f, i) => (
              <FadeIn key={f.layer} delay={i * 0.05}>
                <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className="inline-flex items-center justify-center w-10 h-10 rounded-2xl text-sm font-bold"
                      style={{ background: `rgba(${f.rgb},0.15)`, color: f.color }}
                    >
                      {f.hz}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.28em] text-gray-500 font-semibold">
                      {f.layer}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">{f.ray}</h3>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{f.chakra}</p>
                  <p className="text-sm text-gray-300">{lang === 'cs' ? f.roleCs : f.roleEn}</p>
                </div>
              </FadeIn>
            ))}

            {/* Carrier wave card */}
            <FadeIn delay={FREQUENCIES.length * 0.05}>
              <div className="zion-rainbow-sub p-5 flex flex-col justify-center items-center text-center" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zion-gold-500/15 text-zion-gold-400 mb-3">
                  <Waves className="h-6 w-6" />
                </span>
                <h3 className="text-lg font-bold text-white mb-1">108 Hz</h3>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                  {ResonanceCopy.universalCarrier[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <p className="text-sm text-gray-300">
                  {ResonanceCopy.temporalAnchorMantraMultiplier[lang === 'cs' ? 'cs' : 'en']}
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* SECTIONS: Council / Time Capsule / Bridge / Registry */}
      <section className="relative py-20 border-t border-white/5">
        <div className="zion-container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SECTIONS.map((s, i) => (
              <FadeIn key={s.titleEn} delay={i * 0.08}>
                <div className="zion-rainbow-card p-6 md:p-8 h-full" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="inline-flex items-center justify-center w-10 h-10 rounded-2xl"
                      style={{ background: `rgba(${s.rgb},0.15)` }}
                    >
                      <s.icon className="h-5 w-5" style={{ color: s.color }} />
                    </span>
                    <h3 className="text-xl font-bold text-white">{lang === 'cs' ? s.titleCs : s.titleEn}</h3>
                  </div>
                  <p className="text-gray-300 leading-relaxed">{lang === 'cs' ? s.descCs : s.descEn}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* THREE GATES */}
      <section className="relative py-20 border-t border-white/5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_50%_0%,rgba(7, 137, 48,0.10),transparent_70%)]" />
        <div className="zion-container relative">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-bold text-gradient-soft mb-3">
              {ResonanceCopy.threeGatesOfAttunement[lang === 'cs' ? 'cs' : 'en']}
            </h2>
            <p className="text-gray-400 max-w-2xl mb-12">
              {ResonanceCopy.beforeAProposalReachesDaoVotin[lang === 'cs' ? 'cs' : 'en']}
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                gate: 'A',
                icon: Mic,
                titleCs: 'Tón záměru (Sankalpa)',
                titleEn: 'Tone of Intent (Sankalpa)',
                descCs:
                  'Navrhovatel nahraje 30sekundový zvukový záznam podstaty návrhu. Frequency Keeper analyzuje základní frekvenci a spektrální koherenci. Kritérium není specifický Hz, ale sebe-konzistence.',
                descEn:
                  "The proposer records a 30-second audio of the proposal's essence. The Frequency Keeper analyzes fundamental frequency and spectral coherence. The criterion is not a specific Hz, but self-consistency.",
                color: '#A78BFA',
                rgb: '167,139,250',
              },
              {
                gate: 'B',
                icon: CircleDot,
                titleCs: 'Kruhová rezonance',
                titleEn: 'Circle Resonance',
                descCs:
                  'Rada kolektivně tónuje 108 Hz po dobu 3 minut, pak frekvenci vrstvy po dobu 2 minut, a poté 7 minut ticha. Každý člen řekne: „Rezonuji", „Disonuji" nebo „Harmonizuji".',
                descEn:
                  'The Council collectively tones 108 Hz for 3 minutes, then the layer frequency for 2 minutes, then 7 minutes of silence. Each member says: "I resonate", "I dissonate", or "I harmonize".',
                color: '#22C55E',
                rgb: '7, 137, 48',
              },
              {
                gate: 'C',
                icon: Droplets,
                titleCs: 'Svědek vody',
                titleEn: 'Witness of Water',
                descCs:
                  'Miska vody z místního zdroje stojí v centru kruhu. Každý člen položí ruku na nádobu a promluví jedno slovo. Voda se vrátí zpět do země nebo moře s on-chain GPS a časovým hash-em.',
                descEn:
                  'A bowl of water from the local source stands in the center of the circle. Each member places a hand on the vessel and speaks one word. The water returns to the earth or sea with an on-chain GPS and timestamp hash.',
                color: '#078930',
                rgb: '7,137,48',
              },
            ].map((g, i) => (
              <FadeIn key={g.gate} delay={i * 0.08}>
                <div className="zion-rainbow-card p-6 md:p-8 h-full" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="inline-flex items-center justify-center w-10 h-10 rounded-2xl text-sm font-bold"
                      style={{ background: `rgba(${g.rgb},0.15)`, color: g.color }}
                    >
                      {g.gate}
                    </span>
                    <h3 className="text-lg font-bold text-white">{lang === 'cs' ? g.titleCs : g.titleEn}</h3>
                  </div>
                  <p className="text-gray-300 leading-relaxed text-sm">{lang === 'cs' ? g.descCs : g.descEn}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="relative py-20 border-t border-white/5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_50%_0%,rgba(252, 209, 22,0.12),transparent_70%)]" />
        <div className="zion-container relative">
          <FadeIn>
            <div className="zion-cta-banner">
              <Flower2 className="h-10 w-10 text-zion-gold mx-auto mb-6" />
              <h2 className="text-3xl md:text-4xl font-bold text-gradient-soft mb-4">
                {ResonanceCopy.everyContractIsAPrayer[lang === 'cs' ? 'cs' : 'en']}
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto mb-8">
                {ResonanceCopy.theResonanceProtocolDoesNotVot[lang === 'cs' ? 'cs' : 'en']}
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/docs" className="zion-button-primary group">
                  <BookOpen className="h-4 w-4" />
                  {ResonanceCopy.openDocumentation[lang === 'cs' ? 'cs' : 'en']}
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
  );
}
