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
  Droplets,
  Mountain,
  Network,
  Globe,
  Heart,
  Shield,
  Compass,
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
  title: string;
  location: string;
  eyebrow: string;
  statusCs: string;
  statusEn: string;
  descriptionCs: string;
  descriptionEn: string;
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
];

export default function PioneerProjectCards({ cs }: { cs: boolean }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center zion-tile">
          <Compass className="h-5 w-5 text-zion-gold" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">
            {cs ? 'Pioneer Projekty L5' : 'L5 Pioneer Projects'}
          </h2>
          <p className="text-xs text-gray-500">
            {cs ? 'Živé uzly Terra Nova po celém světě' : 'Live Terra Nova nodes around the world'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PROJECTS.map((project) => {
          const CardContent = (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-gray-500">
                    {project.eyebrow}
                  </p>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{project.title}</h3>
                    <div className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-gray-400">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{project.location}</span>
                    </div>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-300">
                  <Network className="h-3 w-3" />
                  {cs ? project.statusCs : project.statusEn}
                </span>
              </div>

              <p className="text-sm leading-relaxed text-gray-400">
                {cs ? project.descriptionCs : project.descriptionEn}
              </p>

              <div className="grid grid-cols-2 gap-2">
                {project.features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={feature.labelCs}
                      className="flex items-center gap-2 zion-tile px-3 py-2 text-xs text-gray-400"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                      <span>{cs ? feature.labelCs : feature.labelEn}</span>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {project.metrics.map((metric) => (
                  <div
                    key={metric.labelCs}
                    className="zion-tile px-3 py-2 text-center"
                  >
                    <p className="text-sm font-semibold text-white">{metric.value}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-gray-500">
                      {cs ? metric.labelCs : metric.labelEn}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10">
                <span>{cs ? 'Otevřít detail projektu' : 'Open project detail'}</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          );

          if (!project.href) {
            return (
              <div
                key={project.title}
                className="zion-rainbow-sub p-5 opacity-60"
                style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
                aria-disabled="true"
              >
                {CardContent}
              </div>
            );
          }

          return (
            <Link
              key={project.title}
              href={project.href}
              className="group zion-rainbow-sub p-5 transition-colors hover:border-white/20 hover:bg-black/30"
              style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
            >
              {CardContent}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
