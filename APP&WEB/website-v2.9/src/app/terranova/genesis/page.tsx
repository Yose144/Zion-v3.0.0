'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Droplets,
  Globe,
  Landmark,
  Leaf,
  LucideIcon,
  MapPin,
  Network,
  Sprout,
  Sun,
  Trees,
  Users,
  Waves,
  Zap,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

const DocMarkdownArticle = dynamic(() => import('@/components/docs/DocMarkdownArticle'), { ssr: false });

const GenesisGardenPreviewLazy = dynamic(
  () => import('@/components/GenesisGardenPreviewLazy'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] md:h-[520px] items-center justify-center rounded-3xl border border-white/10 bg-black/40">
        <span className="text-xs uppercase tracking-widest text-white/60">Loading 3D preview…</span>
      </div>
    ),
  }
);

const TerranovaGenesisCopy = {
  backToTerraNova: { cs: `Zpět na Terra Nova`, en: `Back to Terra Nova` },
  activeDevelopment: { cs: `Aktivní rozvoj`, en: `Active Development` },
  oneLoveOneHeartTogetherWeCreat: { cs: `"One love, one heart. Společně tvoříme budoucnost, kde je člověk a Země opět v harmonii."`, en: `"One love, one heart. Together we create a future where humanity and Earth are in harmony again."` },
  whatTheProjectOffers: { cs: `Co projekt nabízí`, en: `What the project offers` },
  activitiesInfrastructure: { cs: `Aktivity & Infrastruktura`, en: `Activities & Infrastructure` },
  developmentPhases: { cs: `Fáze rozvoje`, en: `Development Phases` },
  fromSeedToRadiance: { cs: `Cesta od zárodku k výzařování`, en: `From Seed to Radiance` },
  physicalFoundation: { cs: `Fyzická základna`, en: `Physical Foundation` },
  infrastructureOffGrid: { cs: `Infrastruktura & Off-grid`, en: `Infrastructure & Off-grid` },
  energy: { cs: `Energie`, en: `Energy` },
  source: { cs: `Zdroj`, en: `Source` },
  backup: { cs: `Záloha`, en: `Backup` },
  inDevelopment: { cs: `V rozvoji`, en: `In development` },
  status: { cs: `Status`, en: `Status` },
  installing: { cs: `🟡 Instalace`, en: `🟡 Installing` },
  goalFullEnergySelfSufficiency: { cs: `Cíl: energetická soběstačnost areálu`, en: `Goal: full energy self-sufficiency` },
  water: { cs: `Voda`, en: `Water` },
  wellRainwater: { cs: `Studna + déšť`, en: `Well + rainwater` },
  filter: { cs: `Čištění`, en: `Filter` },
  basicSystem: { cs: `🟡 Funkční základ`, en: `🟡 Basic system` },
  plannedRainwaterHarvestingFull: { cs: `Plánovaný sběr dešťové vody — plná retence`, en: `Planned rainwater harvesting — full retention` },
  gardenFood: { cs: `Zahrada & Jídlo`, en: `Garden & Food` },
  method: { cs: `Metoda`, en: `Method` },
  organicFarming: { cs: `Organická farma`, en: `Organic farming` },
  goal: { cs: `Cíl`, en: `Goal` },
  growing: { cs: `🟢 Roste`, en: `🟢 Growing` },
  treePlantingBiodiversityRestor: { cs: `Sázení stromů, obnova biodiverzity, sezónní sklizeň`, en: `Tree planting, biodiversity restoration, seasonal harvest` },
  communityGovernance: { cs: `Komunitní správa`, en: `Community Governance` },
  governanceDao: { cs: `Governance & DAO`, en: `Governance & DAO` },
  decisionModel: { cs: `Model rozhodování`, en: `Decision Model` },
  model: { cs: `Model`, en: `Model` },
  communityGovernanceTerraNovaFr: { cs: `Komunitní správa + Terra Nova ® framework`, en: `Community governance + Terra Nova ® framework` },
  decisions: { cs: `Rozhodování`, en: `Decisions` },
  consensusForKeyDecisions: { cs: `Konsensuální pro klíčová rozhodnutí`, en: `Consensus for key decisions` },
  zionDao: { cs: `ZION DAO`, en: `ZION DAO` },
  plannedProofOfCareGovernance: { cs: `Plánováno — Proof-of-Care governance`, en: `Planned — Proof-of-Care governance` },
  minCell: { cs: `Min. buňka`, en: `Min. cell` },
  k35PermanentGuardiansSeasonal: { cs: `3–5 stálých Guardians + sezónní`, en: `3–5 permanent Guardians + seasonal` },
  humanitarianCommitment: { cs: `Humanitární závazek`, en: `Humanitarian Commitment` },
  ofZionNetworkNodeRewardsGoToTh: { cs: `z node odměn ZION sítě jde do humanitárního fondu komunity`, en: `of ZION network node rewards go to the community humanitarian fund` },
  everyGuardianNodeOperatedOnThe: { cs: `Každý Guardian node, který bude provozován v areálu, přispívá 10 % odměn zpět komunitě a jejím projektům.`, en: `Every Guardian node operated on the premises contributes 10% of rewards back to the community and its projects.` },
  characterOfPlace: { cs: `Charakter místa`, en: `Character of Place` },
  aFarmOnTheEdgeOfTwoWorlds: { cs: `Farma na hranici dvou světů`, en: `A Farm on the Edge of Two Worlds` },
  zahradaGenesisStandsOnTheBound: { cs: `Zahrada Genesis stojí na hranici dvou světů: tichého vnitrozemí farmy a divokého atlantického pobřeží. Tato dualita — ticho půdy a energie oceánu — je záměrná. Projekt hledá lidi, kteří umí pracovat v hlíně i surfovat vlny. Farmáře i surfaře. Stavitele i meditující.`, en: `Zahrada Genesis stands on the boundary of two worlds: the quiet inland farm and the wild Atlantic coast. This duality — the silence of soil and the energy of the ocean — is intentional. The project looks for people who can work in clay and surf waves. Farmers and surfers. Builders and meditators.` },
  treePlantingIsNotAPrActivityIt: { cs: `Sázení stromů není PR aktivita. Je to rituál zakořenění. Každý strom, který tu vyroste, bude tu dál, když tenhle tým dávno odejde. Zahrada Genesis buduje dědictví v biologickém čase — ne v čtvrtletních zprávách.`, en: `Tree planting is not a PR activity. It is a ritual of rooting. Every tree that grows here will be here long after this team is gone. Zahrada Genesis builds legacy in biological time — not in quarterly reports.` },
  oceanMovement: { cs: `🌊 Oceán & pohyb`, en: `🌊 Ocean & movement` },
  soilSilence: { cs: `🌱 Půda & ticho`, en: `🌱 Soil & silence` },
  biologicalTime: { cs: `🌳 Biologický čas`, en: `🌳 Biological time` },
  authenticIntention: { cs: `🔥 Autentický záměr`, en: `🔥 Authentic intention` },
  blockchainIntegration: { cs: `Blockchain integrace`, en: `Blockchain Integration` },
  active: { cs: `Aktivní`, en: `Active` },
  planned: { cs: `Plánováno`, en: `Planned` },
  concept: { cs: `Koncept`, en: `Concept` },
  resourcesContact: { cs: `Zdroje a kontakt`, en: `Resources & Contact` },
  instagramTerranovaProjectThisP: { cs: `Instagram: @terranova_project · Tento projektový list je živý dokument — průběžně aktualizujeme.`, en: `Instagram: @terranova_project · This project sheet is a living document — continuously updated.` },
  dharmaTemple: { cs: `Dharma Temple`, en: `Dharma Temple` },
  tePikoOra: { cs: `Te Pīko Ora`, en: `Te Pīko Ora` },
  threeDPreview: { cs: `3D koncept`, en: `3D concept` },
  threeDPreviewSubtitle: { cs: `Interaktivní náhled tří pyramid kolem Stromu života. Koncept — ne stavba.`, en: `Interactive preview of the three pyramids around the Tree of Life. Concept — not a built structure.` },
  conceptOnlyLabel: { cs: `KONCEPT — NESTOJÍ`, en: `CONCEPT — NOT BUILT` },
  sitePlan: { cs: `Architektonický koncept`, en: `Architectural concept` },
  sitePlanSubtitle: { cs: `Masterplan, funkční zóny a legendy prvního návrhu Genesis Garden.`, en: `Masterplan, functional zones and legend of the first Genesis Garden draft.` },
  documentation: { cs: `Dokumentace`, en: `Documentation` },
  documentationSubtitle: { cs: `Kompletní plán, koncept a specifikace Genesis Garden.`, en: `Complete plan, concept and specification of Genesis Garden.` },
  documentationLoading: { cs: `Načítání dokumentace…`, en: `Loading documentation…` },
  documentationError: { cs: `Dokumentaci se nepodařilo načíst.`, en: `Failed to load documentation.` },
  terraNovaNetwork: { cs: `Síť Terra Nova`, en: `Terra Nova Network` },
  connectionWithDharma: { cs: `Propojení s Dharma Temple`, en: `Connection with Dharma Temple` },
  dimension: { cs: `Dimenze`, en: `Dimension` },
  bothProjectsShareSourceCodeTer: { cs: `Oba projekty sdílejí zdrojový kód: Terra Nova etika, ZION blockchain, off-grid technologie, komunitní governance a seed library.`, en: `Both projects share source code: Terra Nova ethics, ZION blockchain, off-grid technology, community governance and seed library.` },
  openQuestionsLookingForGuardia: { cs: `Otevřené otázky — hledáme Guardians`, en: `Open Questions — looking for Guardians` },
  joinDiscord: { cs: `Připojit se na Discord`, en: `Join Discord` },
};

type FeatureStatus = 'open' | 'active' | 'planned' | 'concept';

type FeatureItem = {
  icon: LucideIcon;
  titleCs: string;
  titleEn: string;
  descCs: string;
  descEn: string;
  status: FeatureStatus;
  color: string;
  rgb: string;
};

type IntegrationItem = {
  label: string;
  status: 'active' | 'planned' | 'tbd';
  icon: LucideIcon;
};

const FEATURES: FeatureItem[] = [
  {
    icon: Landmark,
    titleCs: 'Pyramida Memory',
    titleEn: 'Pyramid of Memory',
    descCs: 'Archiv, semínka a Akášická knihovna. Středisko znalostí a semenné banky pro L5 síť.',
    descEn: 'Archive, seeds and Akashic library. A knowledge hub and seed bank for the L5 network.',
    status: 'concept' as const,
    color: '#F6AD55',
    rgb: '246, 173, 85',
  },
  {
    icon: Users,
    titleCs: 'Pyramida Consciousness',
    titleEn: 'Pyramid of Consciousness',
    descCs: 'Komunitní sál, meditace, jídelna a setkávání. Největší ze tří pyramid — srdce lidského měřítka.',
    descEn: 'Community hall, meditation, dining and gatherings. The largest of the three pyramids — the heart of human scale.',
    status: 'concept' as const,
    color: '#34D399',
    rgb: '52, 211, 153',
  },
  {
    icon: Zap,
    titleCs: 'Pyramida Future',
    titleEn: 'Pyramid of Future',
    descCs: 'ZION node, solární a technologické centrum, dílny. Most mezi půdou a blockchainem.',
    descEn: 'ZION node, solar and technology center, workshops. A bridge between soil and blockchain.',
    status: 'concept' as const,
    color: '#A78BFA',
    rgb: '167, 139, 250',
  },
  {
    icon: Leaf,
    titleCs: 'Glamping',
    titleEn: 'Glamping',
    descCs: 'Pohodlné stany uprostřed přírody — komfort bez kompromisu. Ubytování pro hosty a long-stay farmáře.',
    descEn: 'Comfortable tents in the heart of nature — comfort without compromise. Accommodation for guests and long-stay farmers.',
    status: 'open' as const,
    color: '#34D399',
    rgb: '52,211,153',
  },
  {
    icon: Sprout,
    titleCs: 'Organická farma',
    titleEn: 'Organic Farm',
    descCs: 'Pestrá škála organických plodin, obnova biodiverzity, sezónní sklizně. Každý návštěvník může přiložit ruku k dílu.',
    descEn: 'Diverse organic crops, biodiversity restoration, seasonal harvests. Every visitor can lend a hand.',
    status: 'active' as const,
    color: '#10B981',
    rgb: '6, 105, 40',
  },
  {
    icon: Trees,
    titleCs: 'Sázení stromů',
    titleEn: 'Tree Planting',
    descCs: 'Každý strom, který tu vyroste, bude tu dál, když tenhle tým dávno odejde. Budujeme dědictví v biologickém čase.',
    descEn: 'Every tree that grows here will be here long after this team is gone. We build legacy in biological time.',
    status: 'active' as const,
    color: '#059669',
    rgb: '5,150,105',
  },
  {
    icon: Waves,
    titleCs: 'Surf škola',
    titleEn: 'Surf School',
    descCs: 'Propojení oceánu, pohybu a vědomého stylu. Surf jako praxe přítomnosti — vlna jako učitel.',
    descEn: 'Connecting ocean, movement and conscious lifestyle. Surf as a practice of presence — the wave as teacher.',
    status: 'planned' as const,
    color: '#066928',
    rgb: '6,105,40',
  },
  {
    icon: Sun,
    titleCs: 'Solar & Off-grid',
    titleEn: 'Solar & Off-grid',
    descCs: 'Fotovoltaický systém, sběr dešťové vody, kompostování. Fyzická manifestace energetické svobody.',
    descEn: 'Photovoltaic system, rainwater collection, composting. Physical manifestation of energy freedom.',
    status: 'active' as const,
    color: '#F59E0B',
    rgb: '252, 209, 22',
  },
  {
    icon: Network,
    titleCs: 'Komunitní setkání',
    titleEn: 'Community Gatherings',
    descCs: 'Workshopy, retreaty, ceremonie a festivaly. Prostor kde se lidé setkávají s autentickým záměrem.',
    descEn: 'Workshops, retreats, ceremonies and festivals. A space where people meet with authentic intention.',
    status: 'active' as const,
    color: '#8B5CF6',
    rgb: '228, 30, 43',
  },
];

const PHASES = [
  { num: 0, cs: 'Zárodek', en: 'Seed', descCs: 'Pozemek, legal základ, první Guardian', descEn: 'Land, legal base, first Guardian', done: true },
  { num: 1, cs: 'Kořeny', en: 'Roots', descCs: 'Solar, voda, organická zahrada, glamping', descEn: 'Solar, water, organic garden, glamping', active: true },
  { num: 2, cs: 'Komunita', en: 'Community', descCs: 'Stálí obyvatelé, ZION node, governance', descEn: 'Permanent residents, ZION node, governance', done: false },
  { num: 3, cs: 'Síť', en: 'Network', descCs: 'Propojení s Dharma Temple, L5 uzly', descEn: 'Connection with Dharma Temple, L5 nodes', done: false },
  { num: 4, cs: 'Výzařování', en: 'Radiance', descCs: 'Surf škola, retreaty, vzdělávací centrum', descEn: 'Surf school, retreats, education center', done: false },
];

const ZION_ITEMS: IntegrationItem[] = [
  { label: 'ZION Node', status: 'planned', icon: Network },
  { label: 'Guardian Wallet', status: 'tbd', icon: Landmark },
  { label: 'Medical Table', status: 'planned', icon: Zap },
  { label: 'LoRa / Meshtastic', status: 'planned', icon: Globe },
  { label: 'Seed Library', status: 'planned', icon: Sprout },
  { label: 'Proof-of-Care DAO', status: 'planned', icon: Users },
];

const SIGNALS = [
  { icon: Sun, value: '320+', labelCs: 'Slunečné dny', labelEn: 'Sunny days' },
  { icon: Droplets, value: 'Off-grid', labelCs: 'Voda & retence', labelEn: 'Water & retention' },
  { icon: Trees, value: 'Base Camp', labelCs: 'Farma & stromy', labelEn: 'Farm & trees' },
];

const STATUS_LABEL = {
  open: { cs: 'Otevřeno', en: 'Open', color: '#34D399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)' },
  active: { cs: 'Aktivní', en: 'Active', color: '#10B981', bg: 'rgba(6, 105, 40,0.1)', border: 'rgba(6, 105, 40,0.25)' },
  planned: { cs: 'Plánováno', en: 'Planned', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)' },
  concept: { cs: 'Koncept', en: 'Concept', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
};

const COMPARE = [
  { dim: { cs: 'Energie místa', en: 'Place Energy' }, genesis: { cs: 'Atlantický vítr & oceán', en: 'Atlantic wind & ocean' }, dharma: { cs: 'Vulkanické ticho & hory', en: 'Volcanic silence & mountains' } },
  { dim: { cs: 'Primární role', en: 'Primary Role' }, genesis: { cs: 'Base Camp', en: 'Base Camp' }, dharma: { cs: 'Sanctuary', en: 'Sanctuary' } },
  { dim: { cs: 'Klíčová aktivita', en: 'Key Activity' }, genesis: { cs: 'Farma, surf, community', en: 'Farm, surf, community' }, dharma: { cs: 'Meditace, dharma, vzdělávání', en: 'Meditation, dharma, education' } },
  { dim: { cs: 'Architektonický symbol', en: 'Architectural symbol' }, genesis: { cs: '3 pyramidy — Memory / Consciousness / Future', en: '3 pyramids — Memory / Consciousness / Future' }, dharma: { cs: '7 kopulí + Strom života', en: '7 domes + Tree of Life' } },
];

const OPEN_QUESTIONS = [
  { cs: 'Přesné GPS souřadnice a výměra pozemku (v jednání)', en: 'Exact GPS coordinates and land area (in negotiation)' },
  { cs: 'Právní forma: Associação vs Cooperativa vs hybrid', en: 'Legal form: Associação vs Cooperativa vs hybrid' },
  { cs: 'Kapacita solárního systému (kWp / kWh denně)', en: 'Solar system capacity (kWp / kWh per day)' },
  { cs: 'Timeline surf školy a partnerství s lokálním surf klubem', en: 'Surf school timeline and partnership with local surf club' },
  { cs: 'Koordinátor ZION node — nábor Tech Guardiana', en: 'ZION node coordinator — recruiting a Tech Guardian' },
  { cs: 'Dharma Temple La Palma — specifikace sdílených protokolů', en: 'Dharma Temple La Palma — shared protocol specifications' },
  { cs: 'Semenná knihovna: které odrůdy a partneři výměny?', en: 'Seed library: which varieties and exchange partners?' },
  { cs: 'Pojištění: zemědělství, odpovědnost, majetek', en: 'Insurance: agriculture, liability, property' },
  { cs: 'EU funding: LEADER, CAP, Erasmus+, LIFE', en: 'EU funding: LEADER, CAP, Erasmus+, LIFE' },
];

export default function ZahradaGenesisPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [doc, setDoc] = useState<string | null>(null);
  const [docError, setDocError] = useState(false);

  useEffect(() => {
    const file = cs ? '/docs/terranova/genesis-garden.cs.md' : '/docs/terranova/genesis-garden.en.md';
    fetch(file)
      .then((res) => {
        if (!res.ok) throw new Error('not found');
        return res.text();
      })
      .then((text) => setDoc(text))
      .catch(() => setDocError(true));
  }, [cs]);

  return (
    <div className="zion-page">
      <div className="relative z-10 zion-container max-w-5xl">

        {/* Back nav */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <Link
            href="/terranova"
            className="inline-flex items-center gap-2 text-sm text-zion-gold/65 hover:text-zion-cyan transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {TerranovaGenesisCopy.backToTerraNova[cs ? 'cs' : 'en']}
          </Link>
        </motion.div>

        {/* ═══ HERO ═══ */}
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-20 relative"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
              {/* Icon column */}
              <div className="shrink-0">
                <div className="relative flex h-28 w-28 items-center justify-center zion-rainbow-sub" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                  <div className="absolute inset-3 rounded-[26px] border border-white/5" />
                  <div className="absolute h-20 w-20 rounded-full bg-zion-gold/10 blur-2xl" />
                  <Leaf className="relative z-10 h-10 w-10 text-zion-gold" />
                  <Sprout className="absolute bottom-5 right-5 h-4 w-4 text-zion-cyan" />
                </div>
              </div>

              {/* Text column */}
              <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="zion-badge">
                    L5 · Terra Nova Pioneer
                  </span>
                  <span className="zion-badge-gold">
                    🟡 {TerranovaGenesisCopy.activeDevelopment[cs ? 'cs' : 'en']}
                  </span>
                </div>

                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gradient">
                  Zahrada Genesis
                </h1>
                <p className="text-lg text-zion-cyan font-medium">Base Camp · Terra Nova ®</p>

                <div className="flex items-center gap-1.5 text-white/70">
                  <MapPin className="w-4 h-4 text-zion-cyan shrink-0" />
                  <span className="text-sm">Algarve / Atlantické pobřeží · Portugalsko</span>
                </div>

                <blockquote className="mt-4 pl-4 border-l-2 border-zion-cyan/40 text-sm text-white/70 italic leading-relaxed max-w-lg">
                  {TerranovaGenesisCopy.oneLoveOneHeartTogetherWeCreat[cs ? 'cs' : 'en']}
                </blockquote>

                <div className="grid gap-3 pt-3 sm:grid-cols-3">
                  {SIGNALS.map((signal) => {
                    const Icon = signal.icon;
                    return (
                      <div key={signal.labelCs} className="zion-rainbow-sub px-3 py-3" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                        <div className="flex items-center gap-2 text-zion-gold">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-semibold">{signal.value}</span>
                        </div>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-zion-gold/65">
                          {cs ? signal.labelCs : signal.labelEn}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        {/* ═══ 3D PREVIEW ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05, duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-4 md:p-5" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="relative z-10 mb-4 flex flex-col items-center gap-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-1">
                {TerranovaGenesisCopy.threeDPreview[cs ? 'cs' : 'en']}
              </p>
              <h2 className="text-xl font-bold text-white">
                {TerranovaGenesisCopy.threeDPreviewSubtitle[cs ? 'cs' : 'en']}
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                {TerranovaGenesisCopy.conceptOnlyLabel[cs ? 'cs' : 'en']}
              </span>
            </div>
            <GenesisGardenPreviewLazy lang={cs ? 'cs' : 'en'} className="w-full" />
          </div>
        </motion.section>

        {/* ═══ ARCHITECTURAL CONCEPT ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="relative z-10 mb-6 text-center">
              <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-1">
                {TerranovaGenesisCopy.sitePlan[cs ? 'cs' : 'en']}
              </p>
              <h2 className="text-xl font-bold text-white">
                {TerranovaGenesisCopy.sitePlanSubtitle[cs ? 'cs' : 'en']}
              </h2>
            </div>

            <div className="relative z-10 mb-6 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <img
                src="/images/genesis-garden/concept-og.png"
                alt={cs ? 'Návrh Genesis Garden' : 'Genesis Garden concept'}
                className="w-full object-contain"
              />
            </div>

            <div className="relative z-10 grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-zion-gold">
                  {cs ? 'Tři pyramidy a Strom života' : 'Three pyramids and the Tree of Life'}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  {cs
                    ? 'Srdce areálu tvoří tři moderní krystalické pyramidy uspořádané kolem centrální zahrady s Bodhi stromem a reflektujícím bazénem. Střední pyramida Consciousness je největší a slouží komunitě. Pyramida Memory uchovává semena a znalosti. Pyramida Future hostí ZION node a technologické centrum.'
                    : 'The heart of the site is three modern crystalline pyramids arranged around a central garden with a Bodhi tree and reflecting pool. The central Consciousness pyramid is the largest and serves the community. The Memory pyramid holds seeds and knowledge. The Future pyramid hosts the ZION node and technology center.'}
                </p>
                <ul className="space-y-2 text-sm text-white/70">
                  <li className="flex items-start gap-2"><span className="text-amber-400 shrink-0">▲</span>{cs ? 'Pyramida Memory — archiv / historie / semínka' : 'Pyramid of Memory — archive / history / seeds'}</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-400 shrink-0">◆</span>{cs ? 'Pyramida Consciousness — meditace / komunita / jídelna' : 'Pyramid of Consciousness — meditation / community / dining'}</li>
                  <li className="flex items-start gap-2"><span className="text-purple-400 shrink-0">▲</span>{cs ? 'Pyramida Future — ZION / technologie / dílny' : 'Pyramid of Future — ZION / technology / workshops'}</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-zion-gold">
                  {cs ? 'Prezentační board (v přípravě)' : 'Presentation board (in preparation)'}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  {cs
                    ? 'První návrh zpracujeme jako architektonický koncept ve stylu Dharma Temple: hero perspektiva z ptačího pohledu, top-down site plan, půdorys přízemí, řez pyramidami, pohled, konstrukční princip, voda, solar, farma a Strom života.'
                    : 'The first draft will be produced as an architectural concept in the style of Dharma Temple: aerial hero perspective, top-down site plan, ground-floor plan, pyramid section, elevation, construction principle, water, solar, farm and Tree of Life.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    cs ? 'Masterplan' : 'Masterplan',
                    cs ? 'Půdorys' : 'Floor plan',
                    cs ? 'Řez' : 'Section',
                    cs ? 'Pohled' : 'Elevation',
                    cs ? 'Materiály' : 'Materials',
                    cs ? 'Solar + voda' : 'Solar + water',
                  ].map((tag) => (
                    <span key={tag} className="zion-badge text-[10px]">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══ FEATURES GRID ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-2">
              {TerranovaGenesisCopy.whatTheProjectOffers[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {TerranovaGenesisCopy.activitiesInfrastructure[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => {
              const s = STATUS_LABEL[f.status];
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.titleCs}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.07, duration: 0.5 }}
                  className="relative zion-rainbow-sub p-5 space-y-3 overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
                  style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
                >
                  <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-[50px] bg-white/5 group-hover:bg-white/10 transition-colors duration-500" />

                  <div className="flex items-start justify-between relative z-10 gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center zion-rainbow-sub" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                      <Icon className="h-5 w-5" style={{ color: f.color }} />
                    </span>
                    <span
                      className="rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em]"
                      style={{ color: s.color, borderColor: s.border, backgroundColor: s.bg }}
                    >
                      {cs ? s.cs : s.en}
                    </span>
                  </div>
                  <h3 className="font-bold text-zion-gold relative z-10">
                    {cs ? f.titleCs : f.titleEn}
                  </h3>
                  <p className="text-white/70 text-sm leading-relaxed relative z-10">
                    {cs ? f.descCs : f.descEn}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ═══ PHASE TIMELINE ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-2">
              {TerranovaGenesisCopy.developmentPhases[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {TerranovaGenesisCopy.fromSeedToRadiance[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-4 bottom-4 w-px bg-gradient-to-b from-zion-gold/40 via-white/10 to-transparent" />

            <div className="space-y-4 pl-16">
              {PHASES.map((p, i) => (
                <motion.div
                  key={p.num}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 + i * 0.08, duration: 0.5 }}
                  className="relative"
                >
                  {/* Timeline dot */}
                  <div
                    className="absolute -left-10 top-3 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                    style={{
                      borderColor: p.done ? 'rgb(252,209,22)' : p.active ? 'rgb(6,105,40)' : 'rgba(255,255,255,0.15)',
                      backgroundColor: p.done ? 'rgba(252,209,22,0.2)' : p.active ? 'rgba(6,105,40,0.2)' : 'rgba(0,0,0,0.5)',
                    }}
                  >
                    {p.done && <div className="w-1.5 h-1.5 rounded-full bg-zion-gold" />}
                    {p.active && <div className="w-1.5 h-1.5 rounded-full bg-zion-cyan animate-pulse" />}
                  </div>

                  <div className="zion-rainbow-sub p-4 space-y-1" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs font-bold tracking-wider"
                        style={{ color: p.done ? 'rgb(252,209,22)' : p.active ? 'rgb(6,105,40)' : 'rgba(255,255,255,0.3)' }}
                      >
                        {cs ? `Fáze ${p.num}` : `Phase ${p.num}`}
                      </span>
                      <span className="text-sm font-semibold text-white/80">
                        {cs ? p.cs : p.en}
                      </span>
                      {p.done && <span className="text-zion-gold text-xs">✅</span>}
                      {p.active && <span className="text-zion-cyan text-xs animate-pulse">⚡</span>}
                    </div>
                    <p className="text-zion-gold/65 text-xs">{cs ? p.descCs : p.descEn}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ═══ PHYSICAL INFRASTRUCTURE ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-2">
              {TerranovaGenesisCopy.physicalFoundation[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {TerranovaGenesisCopy.infrastructureOffGrid[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Energie */}
            <div className="relative zion-rainbow-sub p-5 space-y-3 overflow-hidden" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-[40px] bg-zion-gold/10" />
              <div className="flex items-center gap-2 relative z-10">
                <span className="inline-flex h-9 w-9 items-center justify-center zion-rainbow-sub" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                  <Sun className="h-4 w-4 text-zion-gold" />
                </span>
                <h3 className="font-bold text-zion-gold text-sm">{TerranovaGenesisCopy.energy[cs ? 'cs' : 'en']}</h3>
              </div>
              <div className="space-y-1.5 relative z-10">
                {[
                  { label: TerranovaGenesisCopy.source[cs ? 'cs' : 'en'], val: 'Solar FV systém' },
                  { label: TerranovaGenesisCopy.backup[cs ? 'cs' : 'en'], val: TerranovaGenesisCopy.inDevelopment[cs ? 'cs' : 'en'] },
                  { label: TerranovaGenesisCopy.status[cs ? 'cs' : 'en'], val: TerranovaGenesisCopy.installing[cs ? 'cs' : 'en'] },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between text-xs gap-2">
                    <span className="text-zion-gold/65">{r.label}</span>
                    <span className="text-white/85 text-right">{r.val}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-zion-gold/55 relative z-10">
                {TerranovaGenesisCopy.goalFullEnergySelfSufficiency[cs ? 'cs' : 'en']}
              </p>
            </div>

            {/* Voda */}
            <div className="relative zion-rainbow-sub p-5 space-y-3 overflow-hidden" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-[40px] bg-zion-cyan/10" />
              <div className="flex items-center gap-2 relative z-10">
                <span className="inline-flex h-9 w-9 items-center justify-center zion-rainbow-sub" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                  <Droplets className="h-4 w-4 text-zion-cyan" />
                </span>
                <h3 className="font-bold text-zion-cyan text-sm">{TerranovaGenesisCopy.water[cs ? 'cs' : 'en']}</h3>
              </div>
              <div className="space-y-1.5 relative z-10">
                {[
                  { label: TerranovaGenesisCopy.source[cs ? 'cs' : 'en'], val: TerranovaGenesisCopy.wellRainwater[cs ? 'cs' : 'en'] },
                  { label: TerranovaGenesisCopy.filter[cs ? 'cs' : 'en'], val: 'Gravitace + UV' },
                  { label: TerranovaGenesisCopy.status[cs ? 'cs' : 'en'], val: TerranovaGenesisCopy.basicSystem[cs ? 'cs' : 'en'] },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between text-xs gap-2">
                    <span className="text-zion-gold/65">{r.label}</span>
                    <span className="text-white/85 text-right">{r.val}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-zion-gold/55 relative z-10">
                {TerranovaGenesisCopy.plannedRainwaterHarvestingFull[cs ? 'cs' : 'en']}
              </p>
            </div>

            {/* Jídlo */}
            <div className="relative zion-rainbow-sub p-5 space-y-3 overflow-hidden" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-[40px] bg-zion-cyan/10" />
              <div className="flex items-center gap-2 relative z-10">
                <span className="inline-flex h-9 w-9 items-center justify-center zion-rainbow-sub" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                  <Sprout className="h-4 w-4 text-zion-cyan" />
                </span>
                <h3 className="font-bold text-zion-cyan text-sm">{TerranovaGenesisCopy.gardenFood[cs ? 'cs' : 'en']}</h3>
              </div>
              <div className="space-y-1.5 relative z-10">
                {[
                  { label: TerranovaGenesisCopy.method[cs ? 'cs' : 'en'], val: TerranovaGenesisCopy.organicFarming[cs ? 'cs' : 'en'] },
                  { label: TerranovaGenesisCopy.goal[cs ? 'cs' : 'en'], val: '40–60 % kalorií' },
                  { label: TerranovaGenesisCopy.status[cs ? 'cs' : 'en'], val: TerranovaGenesisCopy.growing[cs ? 'cs' : 'en'] },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between text-xs gap-2">
                    <span className="text-zion-gold/65">{r.label}</span>
                    <span className="text-white/85 text-right">{r.val}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-zion-gold/55 relative z-10">
                {TerranovaGenesisCopy.treePlantingBiodiversityRestor[cs ? 'cs' : 'en']}
              </p>
            </div>
          </div>
        </motion.section>

        {/* ═══ GOVERNANCE ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.38, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-2">
              {TerranovaGenesisCopy.communityGovernance[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {TerranovaGenesisCopy.governanceDao[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="relative z-10 grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-zion-cyan font-bold text-sm uppercase tracking-widest">
                  {TerranovaGenesisCopy.decisionModel[cs ? 'cs' : 'en']}
                </h3>
                <div className="space-y-3">
                  {[
                    { label: TerranovaGenesisCopy.model[cs ? 'cs' : 'en'], val: TerranovaGenesisCopy.communityGovernanceTerraNovaFr[cs ? 'cs' : 'en'] },
                    { label: TerranovaGenesisCopy.decisions[cs ? 'cs' : 'en'], val: TerranovaGenesisCopy.consensusForKeyDecisions[cs ? 'cs' : 'en'] },
                    { label: TerranovaGenesisCopy.zionDao[cs ? 'cs' : 'en'], val: TerranovaGenesisCopy.plannedProofOfCareGovernance[cs ? 'cs' : 'en'] },
                    { label: TerranovaGenesisCopy.minCell[cs ? 'cs' : 'en'], val: TerranovaGenesisCopy.k35PermanentGuardiansSeasonal[cs ? 'cs' : 'en'] },
                  ].map((row) => (
                    <div key={row.label} className="flex gap-3">
                      <span className="text-zion-gold/65 text-xs w-28 shrink-0 pt-0.5">{row.label}</span>
                      <span className="text-white/85 text-xs leading-relaxed">{row.val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-zion-gold font-bold text-sm uppercase tracking-widest">
                  {TerranovaGenesisCopy.humanitarianCommitment[cs ? 'cs' : 'en']}
                </h3>
                <div className="relative zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                  <div className="text-3xl font-black text-zion-gold mb-1">10 %</div>
                  <p className="text-white/70 text-sm">
                    {TerranovaGenesisCopy.ofZionNetworkNodeRewardsGoToTh[cs ? 'cs' : 'en']}
                  </p>
                </div>
                <p className="text-zion-gold/55 text-xs">
                  {TerranovaGenesisCopy.everyGuardianNodeOperatedOnThe[cs ? 'cs' : 'en']}
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══ CHARACTER OF PLACE ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.39, duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="relative z-10 max-w-2xl space-y-4">
              <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65">
                {TerranovaGenesisCopy.characterOfPlace[cs ? 'cs' : 'en']}
              </p>
              <h2 className="text-xl font-bold text-white">
                {TerranovaGenesisCopy.aFarmOnTheEdgeOfTwoWorlds[cs ? 'cs' : 'en']}
              </h2>
              <p className="text-white/70 text-sm leading-relaxed">
                {TerranovaGenesisCopy.zahradaGenesisStandsOnTheBound[cs ? 'cs' : 'en']}
              </p>
              <p className="text-zion-gold/65 text-sm leading-relaxed">
                {TerranovaGenesisCopy.treePlantingIsNotAPrActivityIt[cs ? 'cs' : 'en']}
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                {[
                  TerranovaGenesisCopy.oceanMovement[cs ? 'cs' : 'en'],
                  TerranovaGenesisCopy.soilSilence[cs ? 'cs' : 'en'],
                  TerranovaGenesisCopy.biologicalTime[cs ? 'cs' : 'en'],
                  TerranovaGenesisCopy.authenticIntention[cs ? 'cs' : 'en'],
                ].map((tag) => (
                  <span key={tag} className="zion-badge">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══ COMPARE WITH DHARMA ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-2">
              {TerranovaGenesisCopy.terraNovaNetwork[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {TerranovaGenesisCopy.connectionWithDharma[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <div className="zion-rainbow-card overflow-hidden" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            {/* Header row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 text-center text-[10px] uppercase tracking-[0.3em] font-semibold border-b border-white/10">
              <div className="p-3 text-zion-gold/65">{TerranovaGenesisCopy.dimension[cs ? 'cs' : 'en']}</div>
              <div className="p-3 text-white/85 sm:border-l border-white/10">🌿 {cs ? 'Zahrada Genesis' : 'Zahrada Genesis'}</div>
              <div className="p-3 text-zion-gold sm:border-l border-white/10">🕌 {cs ? 'Dharma Temple' : 'Dharma Temple'}</div>
            </div>
            {COMPARE.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-3 text-sm border-b border-white/5 last:border-0"
              >
                <div className="p-3 text-zion-gold/65 text-xs">{cs ? row.dim.cs : row.dim.en}</div>
                <div className="p-3 text-white/85 text-xs sm:border-l border-white/5">{cs ? row.genesis.cs : row.genesis.en}</div>
                <div className="p-3 text-white/85 text-xs sm:border-l border-white/5">{cs ? row.dharma.cs : row.dharma.en}</div>
              </div>
            ))}
          </div>

          <p className="text-zion-gold/55 text-xs text-center mt-4">
            {TerranovaGenesisCopy.bothProjectsShareSourceCodeTer[cs ? 'cs' : 'en']}
          </p>
        </motion.section>

        {/* ═══ ZION INTEGRATION ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.42, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-2">
              {TerranovaGenesisCopy.blockchainIntegration[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">ZION Network</h2>
          </div>

          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="relative z-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ZION_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 zion-rainbow-sub p-3" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center zion-rainbow-sub" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                    <item.icon className="h-4 w-4 text-zion-gold" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white/80">{item.label}</p>
                    <p className="text-[10px] text-zion-gold/55 capitalize">
                      {item.status === 'active'
                        ? (TerranovaGenesisCopy.active[cs ? 'cs' : 'en'])
                        : item.status === 'planned'
                        ? (TerranovaGenesisCopy.planned[cs ? 'cs' : 'en'])
                        : 'TBD'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ═══ DOCUMENTATION ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.44, duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-4 md:p-5" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="relative z-10 mb-4 text-center">
              <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-1">
                {TerranovaGenesisCopy.documentation[cs ? 'cs' : 'en']}
              </p>
              <h2 className="text-xl font-bold text-white">
                {TerranovaGenesisCopy.documentationSubtitle[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <div className="relative z-10 rounded-2xl border border-white/10 bg-black/40 p-4 md:p-6">
              {docError ? (
                <p className="text-sm text-zion-red">{TerranovaGenesisCopy.documentationError[cs ? 'cs' : 'en']}</p>
              ) : doc ? (
                <DocMarkdownArticle content={doc} className="zion-docs-prose max-w-4xl mx-auto" />
              ) : (
                <p className="text-sm text-white/60">{TerranovaGenesisCopy.documentationLoading[cs ? 'cs' : 'en']}</p>
              )}
            </div>
          </div>
        </motion.section>

        {/* ═══ OPEN QUESTIONS ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.46, duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-8 space-y-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <h3 className="text-lg font-bold text-zion-gold">
              {TerranovaGenesisCopy.openQuestionsLookingForGuardia[cs ? 'cs' : 'en']}
            </h3>
            <ul className="space-y-2">
              {OPEN_QUESTIONS.map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                  <span className="text-zion-gold shrink-0 mt-0.5">◇</span>
                  {cs ? q.cs : q.en}
                </li>
              ))}
            </ul>
            <a
              href="https://discord.gg/eatGYDbd"
              target="_blank"
              rel="noopener noreferrer"
              className="zion-button-secondary"
            >
              <Users className="w-4 h-4" />
              {TerranovaGenesisCopy.joinDiscord[cs ? 'cs' : 'en']}
            </a>
          </div>
        </motion.section>

        {/* ═══ LINKS & CONTACT ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-8 space-y-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <h3 className="text-lg font-bold text-zion-gold">
              {TerranovaGenesisCopy.resourcesContact[cs ? 'cs' : 'en']}
            </h3>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://www.newearth.cz/V2/camp.html"
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary"
              >
                <Globe className="w-4 h-4" /> newearth.cz/camp
              </a>
              <a
                href="https://github.com/Zion-TerraNova"
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary"
              >
                <Zap className="w-4 h-4" /> GitHub
              </a>
              <a
                href="https://discord.gg/eatGYDbd"
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary"
              >
                <Users className="w-4 h-4" /> Discord
              </a>
            </div>
            <p className="text-zion-gold/55 text-xs">
              {TerranovaGenesisCopy.instagramTerranovaProjectThisP[cs ? 'cs' : 'en']}
            </p>
          </div>
        </motion.section>

        {/* ═══ BOTTOM NAV ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="flex items-center justify-between"
        >
          <Link
            href="/terranova"
            className="inline-flex items-center gap-2 text-sm text-zion-gold/65 hover:text-zion-gold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {TerranovaGenesisCopy.backToTerraNova[cs ? 'cs' : 'en']}
          </Link>
          <div className="flex gap-3">
            <Link
              href="/terranova/dharma-temple"
              className="zion-button-secondary"
            >
              <span>{TerranovaGenesisCopy.dharmaTemple[cs ? 'cs' : 'en']}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/terranova/te-piko-ora"
              className="zion-button-secondary"
            >
              <span>{TerranovaGenesisCopy.tePikoOra[cs ? 'cs' : 'en']}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
