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
  Crown,
  Landmark,
  TreePine,
  Flower,
  LucideIcon,
} from 'lucide-react';

const TerranovaComponentsPioneerProjectCardsCopy = {
  l5PioneerProjects: { cs: `Pioneer Projekty L5`, en: `L5 Pioneer Projects` },
  liveTerraNovaNodesAroundTheWor: { cs: `Živé uzly Terra Nova po celém světě`, en: `Live Terra Nova nodes around the world` },
  openProjectDetail: { cs: `Otevřít detail projektu`, en: `Open project detail` },
};

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
    location: 'Raiatea · Francouzská Polynésie',
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
      { value: 'Raiatea', labelCs: 'Lokalita', labelEn: 'Location' },
      { value: 'L5', labelCs: 'Vrstva', labelEn: 'Layer' },
      { value: 'PF', labelCs: 'Region', labelEn: 'Region' },
    ],
  },
  {
    href: '/terranova/golden-republic-bohemia',
    title: 'Golden Republic Bohemia',
    location: 'Čechy · Česká republika',
    eyebrow: 'L5 · Governance Lab',
    statusCs: 'Plánováno',
    statusEn: 'Planned',
    descriptionCs:
      'Čtvrtý uzel L5 Trinity — governance laboratoř Zlaté republiky v srdci Evropy. Kruh rozhodování, česká moudrost a ZION protokol.',
    descriptionEn:
      'The fourth L5 Trinity node — governance laboratory for the Golden Republic in the heart of Europe. Decision circle, Czech wisdom and ZION protocol.',
    features: [
      { icon: Crown, labelCs: 'Governance kruh', labelEn: 'Governance circle' },
      { icon: Landmark, labelCs: 'Tři pavilony', labelEn: 'Three pavilions' },
      { icon: Network, labelCs: 'ZION node', labelEn: 'ZION node' },
      { icon: Leaf, labelCs: 'Permakultura', labelEn: 'Permaculture' },
    ],
    metrics: [
      { value: 'Říp', labelCs: 'Osa', labelEn: 'Axis' },
      { value: 'L5', labelCs: 'Vrstva', labelEn: 'Layer' },
      { value: 'CZ', labelCs: 'Region', labelEn: 'Region' },
    ],
  },
  {
    href: '/terranova/bodhi-lanka',
    title: 'Bodhi Lanka',
    location: 'Srí Lanka',
    eyebrow: 'L5 · Akasha Node',
    statusCs: 'Plánováno',
    statusEn: 'Planned',
    descriptionCs:
      'Pátý uzel L5 Trinity — Akáša, prostor, který drží všechny elementy. Nekonečná láska Ramy a Sity, nejstarší žijící strom na Zemi a ZION protokol.',
    descriptionEn:
      'The fifth L5 Trinity node — Akasha, the space that holds all elements. Infinite love of Rama and Sita, the oldest living tree on Earth, and ZION protocol.',
    features: [
      { icon: TreePine, labelCs: 'Bodhi strom', labelEn: 'Bodhi tree' },
      { icon: Heart, labelCs: 'Bhakti · láska', labelEn: 'Bhakti · love' },
      { icon: Flower, labelCs: 'Ayurvedská zahrada', labelEn: 'Ayurvedic garden' },
      { icon: Network, labelCs: 'ZION node', labelEn: 'ZION node' },
    ],
    metrics: [
      { value: 'Anuradhapura', labelCs: 'Osa', labelEn: 'Axis' },
      { value: 'L5', labelCs: 'Vrstva', labelEn: 'Layer' },
      { value: 'LK', labelCs: 'Region', labelEn: 'Region' },
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
            {TerranovaComponentsPioneerProjectCardsCopy.l5PioneerProjects[cs ? 'cs' : 'en']}
          </h2>
          <p className="text-xs text-zion-gold/65">
            {TerranovaComponentsPioneerProjectCardsCopy.liveTerraNovaNodesAroundTheWor[cs ? 'cs' : 'en']}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PROJECTS.map((project) => {
          const CardContent = (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-zion-gold/65">
                    {project.eyebrow}
                  </p>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{project.title}</h3>
                    <div className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-white/70">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{project.location}</span>
                    </div>
                  </div>
                </div>
                <span className="zion-badge">
                  <Network className="h-3 w-3" />
                  {cs ? project.statusCs : project.statusEn}
                </span>
              </div>

              <p className="text-sm leading-relaxed text-white/70">
                {cs ? project.descriptionCs : project.descriptionEn}
              </p>

              <div className="grid grid-cols-2 gap-2">
                {project.features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={feature.labelCs}
                      className="flex items-center gap-2 zion-tile px-3 py-2 text-xs text-white/70"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-zion-gold/65" />
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
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-zion-gold/65">
                      {cs ? metric.labelCs : metric.labelEn}
                    </p>
                  </div>
                ))}
              </div>

              <div className="zion-button-secondary">
                <span>{TerranovaComponentsPioneerProjectCardsCopy.openProjectDetail[cs ? 'cs' : 'en']}</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          );

          if (!project.href) {
            return (
              <div
                key={project.title}
                className="zion-rainbow-sub p-5 opacity-60"
                style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
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
              className="group zion-rainbow-sub p-5"
              style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
            >
              {CardContent}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
