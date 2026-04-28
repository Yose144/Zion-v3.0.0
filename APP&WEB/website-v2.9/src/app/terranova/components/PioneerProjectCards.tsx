'use client';

import Link from 'next/link';
import {
  ArrowRight,
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
  href: string;
  title: string;
  location: string;
  eyebrow: string;
  statusCs: string;
  statusEn: string;
  descriptionCs: string;
  descriptionEn: string;
  accent: 'emerald' | 'violet';
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
    eyebrow: 'L5 · Island Sanctuary',
    statusCs: 'Příprava lokality',
    statusEn: 'Site planning',
    descriptionCs:
      'Horský a vulkanický retreat uzel Terra Nova pro ticho, zahradu, vodu z výškového profilu a klidnou komunitní správu.',
    descriptionEn:
      'Mountain and volcanic Terra Nova retreat node for silence, garden, water from elevation, and calm community governance.',
    accent: 'violet',
    features: [
      { icon: Orbit, labelCs: 'Meditace', labelEn: 'Meditation' },
      { icon: Sprout, labelCs: 'Syntropic zahrada', labelEn: 'Syntropic garden' },
      { icon: Mountain, labelCs: 'Vulkanická krajina', labelEn: 'Volcanic landscape' },
      { icon: Droplets, labelCs: 'Voda & mikrohydro', labelEn: 'Water & micro-hydro' },
    ],
    metrics: [
      { value: '2027', labelCs: 'Seed fáze', labelEn: 'Seed phase' },
      { value: 'L5', labelCs: 'Vrstva', labelEn: 'Layer' },
      { value: 'ES', labelCs: 'Region', labelEn: 'Region' },
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
    <div className="grid gap-4 md:grid-cols-2">
      {PROJECTS.map((project) => {
        const accent = accentClasses(project.accent);
        return (
          <Link
            key={project.title}
            href={project.href}
            className={`group relative overflow-hidden rounded-[28px] border bg-black/35 p-5 transition-all duration-500 ${accent.border}`}
          >
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent.glowA}`} />
            <div className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl ${accent.glowB}`} />
            <div className={`pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full blur-3xl ${accent.glowC}`} />
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ background: 'linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.07) 28%, transparent 56%)' }} />

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

              <p className="max-w-xl text-sm leading-relaxed text-gray-300">
                {cs ? project.descriptionCs : project.descriptionEn}
              </p>

              <div className="grid grid-cols-2 gap-2">
                {project.features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div key={feature.labelCs} className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${accent.chip}`}>
                      <Icon className={`h-4 w-4 shrink-0 ${accent.icon}`} />
                      <span>{cs ? feature.labelCs : feature.labelEn}</span>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {project.metrics.map((metric) => (
                  <div key={metric.labelCs} className={`rounded-2xl border px-3 py-2 ${accent.metric}`}>
                    <p className="text-sm font-semibold">{metric.value}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-gray-500">{cs ? metric.labelCs : metric.labelEn}</p>
                  </div>
                ))}
              </div>

              <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${accent.cta}`}>
                <span>{cs ? 'Otevřít detail projektu' : 'Open project detail'}</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}