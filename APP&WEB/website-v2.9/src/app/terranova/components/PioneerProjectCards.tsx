'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Lock,
  Leaf,
  MapPin,
  Orbit,
  Sprout,
  Sun,
  Trees,
  Waves,
  Landmark,
  Droplets,
  Mountain,
  Network,
  Globe,
  Heart,
  Shield,
  Flame,
  Sparkles,
  Star,
  Compass,
  Wind,
  Snowflake,
  Satellite,
  Terminal,
  Users,
  LucideIcon,
} from 'lucide-react';

type CardFeature = {
  icon: LucideIcon;
  labelCs: string;
  labelEn: string;
};

type CardMetric = {
  labelCs: string;
  labelEn: string;
  value: string;
};

type ProjectCardData = {
  href?: string;
  isSecret?: boolean;
  title: string;
  location: string;
  eyebrow: string;
  statusCs: string;
  statusEn: string;
  descriptionCs: string;
  descriptionEn: string;
  accent: 'emerald' | 'violet' | 'amber' | 'sky' | 'rose' | 'indigo';
  features: CardFeature[];
  metrics: CardMetric[];
};

const PROJECTS: ProjectCardData[] = [
  {
    href: '/terranova/genesis',
    title: 'Zahrada Genesis',
    location: 'Algarve · Portugalsko',
    eyebrow: 'L5 · Portugal Base Camp',
    statusCs: 'Aktivní rozvoj',
    statusEn: 'Active development',
    descriptionCs:
      'Atlantický uzel Terra Nova pro farmaření, glamping, vodu, energii a první dlouhodobou komunitní infrastrukturu.',
    descriptionEn:
      'Atlantic Terra Nova node for farming, glamping, water, energy, and the first long-term community infrastructure.',
    accent: 'emerald',
    features: [
      { icon: Leaf, labelCs: 'Organická farma', labelEn: 'Organic farm' },
      { icon: Sun, labelCs: 'Solar & off-grid', labelEn: 'Solar & off-grid' },
      { icon: Waves, labelCs: 'Surf & oceán', labelEn: 'Surf & ocean' },
      { icon: Trees, labelCs: 'Sázení stromů', labelEn: 'Tree planting' },
    ],
    metrics: [
      { value: '2026', labelCs: 'Aktivní fáze', labelEn: 'Active phase' },
      { value: 'L5', labelCs: 'Vrstva', labelEn: 'Layer' },
      { value: 'EU', labelCs: 'Region', labelEn: 'Region' },
    ],
  },
  {
    href: '/terranova/dharma-temple',
    title: 'Dharma Temple',
    location: 'La Palma · Kanárské ostrovy',
    eyebrow: 'L5 · Sanctuary',
    statusCs: 'V přípravě',
    statusEn: 'In preparation',
    descriptionCs:
      'Spirituální a vzdělávací uzel Terra Nova — místo meditace, syntropic zahrady, dharma governance a hlubokého zastavení.',
    descriptionEn:
      'Terra Nova spiritual and educational node — a place for meditation, syntropic garden, dharma governance and deep stillness.',
    accent: 'violet',
    features: [
      { icon: Orbit, labelCs: 'Meditace & Ticho', labelEn: 'Meditation & Silence' },
      { icon: Sprout, labelCs: 'Syntropic zahrada', labelEn: 'Syntropic garden' },
      { icon: Mountain, labelCs: 'Vulkanická krajina', labelEn: 'Volcanic landscape' },
      { icon: Droplets, labelCs: 'Off-grid voda', labelEn: 'Off-grid water' },
    ],
    metrics: [
      { value: 'UNESCO', labelCs: 'Bioreservace', labelEn: 'Biosphere' },
      { value: 'L5', labelCs: 'Vrstva', labelEn: 'Layer' },
      { value: 'ES', labelCs: 'Region', labelEn: 'Region' },
    ],
  },
  {
    href: '/terranova/te-piko-ora',
    title: 'Te Pīko Ora',
    location: 'Tahiti · Francouzská Polynésie',
    eyebrow: 'L5 · Paradise Node',
    statusCs: 'Plánováno',
    statusEn: 'Planned',
    descriptionCs:
      'Tichomořský uzel Terra Nova — ochrana mořského i pozemského dědictví, regenerativní komunita a kulturní most mezi Polynésií a ZION.',
    descriptionEn:
      'Pacific Terra Nova node — protection of marine and land heritage, regenerative community, and cultural bridge between Polynesia and ZION.',
    accent: 'amber',
    features: [
      { icon: Globe, labelCs: 'Kulturní obnova', labelEn: 'Cultural revival' },
      { icon: Heart, labelCs: 'Komunitní fond', labelEn: 'Community fund' },
      { icon: Shield, labelCs: 'Ochrana dědictví', labelEn: 'Heritage protection' },
      { icon: Waves, labelCs: 'Oceán & útesy', labelEn: 'Ocean & reefs' },
    ],
    metrics: [
      { value: 'Tahiti', labelCs: 'Lokalita', labelEn: 'Location' },
      { value: 'L5', labelCs: 'Vrstva', labelEn: 'Layer' },
      { value: 'PF', labelCs: 'Region', labelEn: 'Region' },
    ],
  },
  {
    isSecret: true,
    title: 'Projekt 3 — Na tahity',
    location: 'TBD',
    eyebrow: 'L5 · Future Node',
    statusCs: 'Koncept',
    statusEn: 'Concept',
    descriptionCs:
      'Třetí pilotní uzel Terra Nova — lokace a koncept se vyvíjej. Bude se zaměřovat na specifickou komunitní potřebu a kulturní kontext.',
    descriptionEn:
      'Third Terra Nova pilot node — location and concept to be developed. Will focus on specific community needs and cultural context.',
    accent: 'sky',
    features: [
      { icon: Sparkles, labelCs: 'Koncept v přípravě', labelEn: 'Concept in preparation' },
      { icon: Terminal, labelCs: 'Technický výzkum', labelEn: 'Technical research' },
      { icon: Users, labelCs: 'Komunitní zapojení', labelEn: 'Community engagement' },
      { icon: Wind, labelCs: 'Regenerativní design', labelEn: 'Regenerative design' },
    ],
    metrics: [
      { value: 'TBD', labelCs: 'Lokalita', labelEn: 'Location' },
      { value: 'L5', labelCs: 'Vrstva', labelEn: 'Layer' },
      { value: 'TBD', labelCs: 'Region', labelEn: 'Region' },
    ],
  },
];

function accentClasses(accent: ProjectCardData['accent']) {
  if (accent === 'emerald') {
    return {
      border: 'border-emerald-400/20 hover:border-emerald-300/35',
      glowA: 'from-emerald-500/18 via-teal-400/8 to-transparent',
      glowB: 'bg-emerald-400/20',
      glowC: 'bg-teal-400/15',
      badge: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
      eye: 'text-emerald-400/80',
      title: 'text-emerald-200',
      location: 'text-emerald-300',
      chip: 'border-emerald-400/20 bg-emerald-400/8 text-emerald-200',
      metric: 'border-emerald-400/15 bg-emerald-400/6 text-emerald-300',
      cta: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/16',
      icon: 'text-emerald-300',
    };
  }

  if (accent === 'amber') {
    return {
      border: 'border-amber-400/20 hover:border-amber-300/35',
      glowA: 'from-amber-500/18 via-orange-400/8 to-transparent',
      glowB: 'bg-amber-400/20',
      glowC: 'bg-orange-400/15',
      badge: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
      eye: 'text-amber-400/80',
      title: 'text-amber-200',
      location: 'text-amber-300',
      chip: 'border-amber-400/20 bg-amber-400/8 text-amber-200',
      metric: 'border-amber-400/15 bg-amber-400/6 text-amber-300',
      cta: 'border-amber-400/25 bg-amber-400/10 text-amber-200 hover:bg-amber-400/16',
      icon: 'text-amber-300',
    };
  }

  if (accent === 'sky') {
    return {
      border: 'border-sky-400/20 hover:border-sky-300/35',
      glowA: 'from-sky-500/18 via-cyan-400/8 to-transparent',
      glowB: 'bg-sky-400/20',
      glowC: 'bg-cyan-400/15',
      badge: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
      eye: 'text-sky-400/80',
      title: 'text-sky-200',
      location: 'text-sky-300',
      chip: 'border-sky-400/20 bg-sky-400/8 text-sky-200',
      metric: 'border-sky-400/15 bg-sky-400/6 text-sky-300',
      cta: 'border-sky-400/25 bg-sky-400/10 text-sky-200 hover:bg-sky-400/16',
      icon: 'text-sky-300',
    };
  }

  if (accent === 'rose') {
    return {
      border: 'border-rose-400/20 hover:border-rose-300/35',
      glowA: 'from-rose-500/18 via-pink-400/8 to-transparent',
      glowB: 'bg-rose-400/20',
      glowC: 'bg-pink-400/15',
      badge: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
      eye: 'text-rose-400/80',
      title: 'text-rose-200',
      location: 'text-rose-300',
      chip: 'border-rose-400/20 bg-rose-400/8 text-rose-200',
      metric: 'border-rose-400/15 bg-rose-400/6 text-rose-300',
      cta: 'border-rose-400/25 bg-rose-400/10 text-rose-200 hover:bg-rose-400/16',
      icon: 'text-rose-300',
    };
  }

  if (accent === 'indigo') {
    return {
      border: 'border-indigo-400/20 hover:border-indigo-300/35',
      glowA: 'from-indigo-500/18 via-blue-400/8 to-transparent',
      glowB: 'bg-indigo-400/20',
      glowC: 'bg-blue-400/15',
      badge: 'border-indigo-400/25 bg-indigo-400/10 text-indigo-300',
      eye: 'text-indigo-400/80',
      title: 'text-indigo-200',
      location: 'text-indigo-300',
      chip: 'border-indigo-400/20 bg-indigo-400/8 text-indigo-200',
      metric: 'border-indigo-400/15 bg-indigo-400/6 text-indigo-300',
      cta: 'border-indigo-400/25 bg-indigo-400/10 text-indigo-200 hover:bg-indigo-400/16',
      icon: 'text-indigo-300',
    };
  }

  return {
    border: 'border-violet-400/20 hover:border-violet-300/35',
    glowA: 'from-violet-500/18 via-fuchsia-400/8 to-transparent',
    glowB: 'bg-violet-400/20',
    glowC: 'bg-fuchsia-400/15',
    badge: 'border-violet-400/25 bg-violet-400/10 text-violet-300',
    eye: 'text-violet-400/80',
    title: 'text-violet-200',
    location: 'text-violet-300',
    chip: 'border-violet-400/20 bg-violet-400/8 text-violet-200',
    metric: 'border-violet-400/15 bg-violet-400/6 text-violet-300',
    cta: 'border-violet-400/25 bg-violet-400/10 text-violet-200 hover:bg-violet-400/16',
    icon: 'text-violet-300',
  };
}

export default function PioneerProjectCards({ cs }: { cs: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {PROJECTS.map((project) => {
        const accent = accentClasses(project.accent);
        const cardClassName = `group relative overflow-hidden rounded-[28px] border bg-black/35 p-5 transition-all duration-500 ${accent.border}${project.isSecret ? ' cursor-default saturate-75' : ''}`;
        const content = (
          <>
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent.glowA}`} />
            <div className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl ${accent.glowB}`} />
            <div className={`pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full blur-3xl ${accent.glowC}`} />
            <div className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${project.isSecret ? 'opacity-40' : 'opacity-0 group-hover:opacity-100'}`} style={{ background: 'linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.07) 28%, transparent 56%)' }} />
            {project.isSecret && (
              <>
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_42%),repeating-linear-gradient(135deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0.03)_10px,transparent_10px,transparent_22px)] opacity-80" />
                <div className="pointer-events-none absolute inset-0 backdrop-blur-[1.5px]" />
                <div className="pointer-events-none absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-black/45 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.26em] text-violet-100/80 shadow-[0_0_30px_rgba(168,85,247,0.16)]">
                  <Lock className="h-3.5 w-3.5" />
                  {cs ? 'Sealed' : 'Sealed'}
                </div>
              </>
            )}

            <div className="relative z-10 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className={`text-[10px] uppercase tracking-[0.28em] ${accent.eye}`}>{project.eyebrow}</p>
                  <div>
                    <h3 className={`text-xl font-semibold ${accent.title}`}>{project.title}</h3>
                    <div className={`mt-1 inline-flex items-center gap-1.5 text-sm ${accent.location}`}>
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{project.location}</span>
                    </div>
                  </div>
                </div>

                <span className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${accent.badge}`}>
                  <Network className="h-3.5 w-3.5" />
                  {cs ? project.statusCs : project.statusEn}
                </span>
              </div>

              <p className={`max-w-xl text-sm leading-relaxed ${project.isSecret ? 'text-gray-400' : 'text-gray-300'}`}>
                {cs ? project.descriptionCs : project.descriptionEn}
              </p>

              <div className="grid grid-cols-2 gap-2">
                {project.features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div key={feature.labelCs} className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${accent.chip}${project.isSecret ? ' border-dashed opacity-80' : ''}`}>
                      <Icon className={`h-4 w-4 shrink-0 ${accent.icon}`} />
                      <span>{cs ? feature.labelCs : feature.labelEn}</span>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {project.metrics.map((metric) => (
                  <div key={metric.labelCs} className={`rounded-2xl border px-3 py-2 ${accent.metric}${project.isSecret ? ' opacity-75' : ''}`}>
                    <p className="text-sm font-semibold">{metric.value}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-gray-500">{cs ? metric.labelCs : metric.labelEn}</p>
                  </div>
                ))}
              </div>

              <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${accent.cta}${project.isSecret ? ' border-dashed bg-black/35 text-violet-100/85 opacity-90' : ''}`}>
                <span>
                  {project.isSecret
                    ? cs
                      ? 'Sealed concept · doplníme později'
                      : 'Sealed concept · details later'
                    : cs
                      ? 'Otevřít detail projektu'
                      : 'Open project detail'}
                </span>
                {project.isSecret ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                )}
              </div>
            </div>
          </>
        );

        if (!project.href || project.isSecret) {
          return (
            <div key={project.title} className={cardClassName} aria-disabled="true">
              {content}
            </div>
          );
        }

        return (
          <Link key={project.title} href={project.href} className={cardClassName}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}