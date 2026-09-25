'use client';

import {
  ArrowRight,
  BookOpen,
  Bot,
  CircleDot,
  Globe2,
  Heart,
  Landmark,
  ScrollText,
  ShieldCheck,
  Telescope,
  UserCheck,
  Wrench,
} from 'lucide-react';
import type { CSSProperties } from 'react';

type ParliamentVisionProps = {
  lang: 'cs' | 'en';
  treasuryGuardians: number;
  multisig: string;
};

const Copy = {
  visionBadge: { cs: 'VIZE', en: 'VISION' },
  title: { cs: 'Zlatý dům · DAO Parlament', en: 'Golden House · DAO Parliament' },
  subtitle: { cs: 'Kruh kolem Země', en: 'A circle around Earth' },
  intro: {
    cs: 'Navržený parlament Zlaté republiky: lokální kruhy, čtyři komory a Hiran jako zrcadlo — ne vládce.',
    en: 'The proposed parliament of the Golden Republic: local circles, four chambers, and Hiran as a mirror — not a ruler.',
  },
  hiranCenter: { cs: 'Hiran · zrcadlo', en: 'Hiran · mirror' },
  chambers: [
    { cs: 'Péče', en: 'Care' },
    { cs: 'Opravy', en: 'Restoration' },
    { cs: 'Poznání', en: 'Knowledge' },
    { cs: 'Horizontu', en: 'Horizon' },
  ],
  orbitNote: {
    cs: 'Ilustrační orbit — tečky jsou lokální kruhy, ne živý počet.',
    en: 'Illustrative orbit — dots are local circles, not a live count.',
  },
  treasuryGuardiansTitle: { cs: 'Treasury Guardians', en: 'Treasury Guardians' },
  treasuryGuardiansBody: {
    cs: 'Malá skupina signerů treasury — operativní role, ne parlament.',
    en: 'The small signer set guarding the treasury — an operational role, not the parliament.',
  },
  earthGuardiansTitle: { cs: 'Earth Guardians', en: 'Earth Guardians' },
  earthGuardiansGoal: { cs: 'Symbolický cíl 144 000', en: 'Symbolic goal 144,000' },
  earthGuardiansBody: {
    cs: 'Dobrovolná globální síť lokálních kruhů. Registry pending — nejsou to treasury klíče ani pevný limit.',
    en: 'A voluntary global network of local circles. Registry pending — not treasury keys and not a hard cap.',
  },
  hiranTitle: { cs: 'Hiran', en: 'Hiran' },
  hiranRole: { cs: 'Zrcadlo + drafty', en: 'Mirror + drafts' },
  hiranBody: {
    cs: 'Hiran analyzuje a připravuje návrhy — podává je vždy lidský sponsor.',
    en: 'Hiran analyzes and drafts proposals — a human sponsor always submits them.',
  },
  flowTitle: { cs: 'Tok návrhu', en: 'Proposal flow' },
  flowSteps: [
    { cs: 'Lokální kruh', en: 'Local circle' },
    { cs: 'Hiran zrcadlo/draft', en: 'Hiran mirror/draft' },
    { cs: 'Lidský sponsor', en: 'Human sponsor' },
    { cs: 'Komora parlamentu', en: 'Parliament chamber' },
    { cs: 'On-chain záznam', en: 'On-chain record' },
  ],
  hiranBoundaryTitle: { cs: 'Hranice Hiranovy role', en: 'Hiran boundary' },
  hiranBoundary: {
    cs: 'Hiran má 0 hlasů a 0 podpisových klíčů. Každý návrh podává lidský sponsor. Hiran není vládce ani autonomní rozhodovatel.',
    en: 'Hiran has 0 votes and 0 signing keys. Every proposal is submitted by a human sponsor. Hiran is not a ruler or an autonomous decision-maker.',
  },
  legend: { cs: 'Legenda', en: 'Legend' },
  legendLive: { cs: 'LIVE — běží v produkci', en: 'LIVE — running in production' },
  legendPrototype: { cs: 'PROTOTYPE — prototyp/offline', en: 'PROTOTYPE — prototype/offline' },
  legendVision: { cs: 'VISION — dlouhodobá vize', en: 'VISION — long-term vision' },
};

const CHAMBER_ICONS = [Heart, Wrench, BookOpen, Telescope];

const ORBIT_DOTS = 24;

export default function ParliamentVision({ lang, treasuryGuardians, multisig }: ParliamentVisionProps) {
  const signerConfigKnown = treasuryGuardians > 0 && multisig !== '—';

  const truthCards = [
    {
      title: Copy.treasuryGuardiansTitle[lang],
      badge: signerConfigKnown ? 'LIVE CONFIG' : 'STATUS UNKNOWN',
      badgeClass: signerConfigKnown
        ? 'zion-badge-green'
        : 'border-gray-500/40 bg-gray-500/10 text-gray-400',
      icon: <ShieldCheck className="h-5 w-5 text-zion-cyan" />,
      value: signerConfigKnown ? `${treasuryGuardians} · ${multisig}` : '—',
      body: Copy.treasuryGuardiansBody[lang],
      rc: '6, 105, 40',
    },
    {
      title: Copy.earthGuardiansTitle[lang],
      badge: 'VISION',
      badgeClass: 'border-zion-purple/40 bg-zion-purple/10 text-zion-purple',
      icon: <Globe2 className="h-5 w-5 text-zion-purple" />,
      value: Copy.earthGuardiansGoal[lang],
      body: Copy.earthGuardiansBody[lang],
      rc: '147, 51, 234',
    },
    {
      title: Copy.hiranTitle[lang],
      badge: 'PROTOTYPE · OFFLINE',
      badgeClass: 'border-zion-gold/40 bg-zion-gold/10 text-zion-gold',
      icon: <Bot className="h-5 w-5 text-zion-gold" />,
      value: Copy.hiranRole[lang],
      body: Copy.hiranBody[lang],
      rc: '252, 209, 22',
    },
  ];

  const flowIcons = [CircleDot, Bot, UserCheck, Landmark, ScrollText];

  return (
    <div className="space-y-12">
      <section
        className="zion-rainbow-card p-8"
        style={{ '--rc': '147, 51, 234' } as CSSProperties}
      >
        <div className="flex flex-col gap-2 mb-6">
          <span className="zion-badge w-fit border-zion-purple/40 bg-zion-purple/10 text-zion-purple">
            {Copy.visionBadge[lang]}
          </span>
          <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
            <Globe2 className="h-7 w-7 text-zion-purple" />
            {Copy.title[lang]}
          </h2>
          <p className="text-lg text-gray-300">{Copy.subtitle[lang]}</p>
          <p className="text-sm text-gray-400 max-w-2xl">{Copy.intro[lang]}</p>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-md">
          <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <circle cx="200" cy="200" r="182" fill="none" stroke="rgba(147,51,234,0.35)" strokeWidth="1" strokeDasharray="3 6" />
            <circle cx="200" cy="200" r="112" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            {Array.from({ length: ORBIT_DOTS }).map((_, i) => {
              const angle = (i / ORBIT_DOTS) * Math.PI * 2;
              const x = 200 + Math.cos(angle) * 182;
              const y = 200 + Math.sin(angle) * 182;
              return <circle key={i} cx={x} cy={y} r="4" fill="rgba(6,182,212,0.55)" />;
            })}
          </svg>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-zion-gold/50 bg-zion-gold/10 shadow-[0_0_32px_rgba(252,209,22,0.25)]">
              <Bot className="h-7 w-7 text-zion-gold" />
            </div>
            <span className="text-[10px] uppercase tracking-widest text-gray-400 whitespace-nowrap">
              {Copy.hiranCenter[lang]}
            </span>
          </div>

          {Copy.chambers.map((chamber, i) => {
            const Icon = CHAMBER_ICONS[i];
            const pos = [
              'left-1/2 top-[10%] -translate-x-1/2 -translate-y-1/2',
              'left-[78%] top-1/2 -translate-x-1/2 -translate-y-1/2',
              'left-1/2 top-[78%] -translate-x-1/2 -translate-y-1/2',
              'left-[22%] top-1/2 -translate-x-1/2 -translate-y-1/2',
            ][i];
            return (
              <div key={chamber.en} className={`absolute ${pos} flex flex-col items-center gap-1`}>
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-zion-cyan/40 bg-black/70 backdrop-blur-sm">
                  <Icon className="h-5 w-5 text-zion-cyan" />
                </div>
                <span className="rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white whitespace-nowrap">
                  {chamber[lang]}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-gray-500">{Copy.orbitNote[lang]}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {truthCards.map((card) => (
          <div key={card.title} className="zion-rainbow-card p-5" style={{ '--rc': card.rc } as CSSProperties}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {card.icon}
                <h3 className="font-semibold text-white">{card.title}</h3>
              </div>
              <span className={`zion-badge ${card.badgeClass}`}>{card.badge}</span>
            </div>
            <p className="font-mono text-sm text-white mb-2">{card.value}</p>
            <p className="text-xs text-gray-400 leading-relaxed">{card.body}</p>
          </div>
        ))}
      </section>

      <section className="zion-rainbow-card p-6" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
        <p className="text-xs uppercase tracking-wider text-gray-400 mb-4">{Copy.flowTitle[lang]}</p>
        <div className="flex flex-wrap items-center gap-2">
          {Copy.flowSteps.map((step, i) => {
            const Icon = flowIcons[i];
            return (
              <div key={step.en} className="flex items-center gap-2">
                <span className="zion-rainbow-sub inline-flex items-center gap-2 px-3 py-2 text-xs text-white" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                  <Icon className="h-3.5 w-3.5 text-zion-cyan" />
                  {step[lang]}
                </span>
                {i < Copy.flowSteps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-gray-500" />}
              </div>
            );
          })}
        </div>
      </section>

      <section className="zion-rainbow-card p-6" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-5 w-5 text-zion-gold" />
          <h3 className="font-semibold text-white">{Copy.hiranBoundaryTitle[lang]}</h3>
        </div>
        <p className="text-sm text-gray-300 max-w-3xl">{Copy.hiranBoundary[lang]}</p>
      </section>

      <section className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
        <span className="uppercase tracking-wider">{Copy.legend[lang]}:</span>
        <span className="zion-badge zion-badge-green">{Copy.legendLive[lang]}</span>
        <span className="zion-badge border-zion-gold/40 bg-zion-gold/10 text-zion-gold">{Copy.legendPrototype[lang]}</span>
        <span className="zion-badge border-zion-purple/40 bg-zion-purple/10 text-zion-purple">{Copy.legendVision[lang]}</span>
      </section>
    </div>
  );
}
