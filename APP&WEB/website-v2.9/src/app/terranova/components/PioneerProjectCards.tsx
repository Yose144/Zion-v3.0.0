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
  Feather,
  Users,
  Sailboat,
  Sunrise,
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
    location: 'Sabacheira · Tomar · Portugalsko',
    eyebrow: 'L5 · Portugal Base Camp',
    statusCs: 'V přípravě',
    statusEn: 'In preparation',
    descriptionCs:
      'Uzel Terra Nova v údolí Nabão — farma, poutní albergue, voda, energie a první dlouhodobou komunitní infrastrukturu.',
    descriptionEn:
      'Terra Nova node in the Nabão valley — farm, pilgrim albergue, water, energy, and the first long-term community infrastructure.',
    features: [
      { icon: Leaf, labelCs: 'Organická farma', labelEn: 'Organic farm' },
      { icon: Sun, labelCs: 'Solar & off-grid', labelEn: 'Solar & off-grid' },
      { icon: Waves, labelCs: 'Agroal & Nabão', labelEn: 'Agroal & Nabão' },
      { icon: Trees, labelCs: 'Sázení stromů', labelEn: 'Tree planting' },
    ],
    metrics: [
      { value: '2029', labelCs: 'Stavba od', labelEn: 'Build from' },
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
      'Čtvrtý uzel L5 Free World — governance laboratoř Zlaté republiky v srdci Evropy. Kruh rozhodování, česká moudrost a ZION protokol.',
    descriptionEn:
      'The fourth L5 Free World node — governance laboratory for the Golden Republic in the heart of Europe. Decision circle, Czech wisdom and ZION protocol.',
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
      'Pátý uzel L5 Free World — Akáša, prostor, který drží všechny elementy. Nekonečná láska Ramy a Sity, nejstarší žijící strom na Zemi a ZION protokol.',
    descriptionEn:
      'The fifth L5 Free World node — Akasha, the space that holds all elements. Infinite love of Rama and Sita, the oldest living tree on Earth, and ZION protocol.',
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
  {
    href: '/terranova/ekam',
    title: 'Ekam',
    location: 'Andhra Pradesh · Indie',
    eyebrow: 'L5 · The Template',
    statusCs: 'Postaveno',
    statusEn: 'Built',
    descriptionCs:
      'Desátý bod L5 Free World — jediný, který už stojí. Bílý mramorový chrám Jednoty (2008): zlatý řez, bezsloupová hala 2 090 m², Zlatá koule. Předloha všech uzlů a vrchol Velké cesty — iniciace dokončení na místě, které pojmenovalo samotný chain.',
    descriptionEn:
      'The tenth point of L5 Free World — the only one already standing. The white-marble Temple of Oneness (2008): golden ratio, a 2,090 m² column-free hall, the Golden Orb. The template for every node and the summit of the Great Route — the initiation of completion at the place that named the chain itself.',
    features: [
      { icon: Sun, labelCs: 'Zlatá koule', labelEn: 'Golden Orb' },
      { icon: Landmark, labelCs: 'Postaveno 2008', labelEn: 'Built 2008' },
      { icon: Compass, labelCs: 'Iniciace dokončení', labelEn: 'Initiation of completion' },
      { icon: Network, labelCs: 'PoW ekam_deeksha', labelEn: 'PoW ekam_deeksha' },
    ],
    metrics: [
      { value: '2008', labelCs: 'Otevřen', labelEn: 'Opened' },
      { value: 'L5', labelCs: 'Vrstva', labelEn: 'Layer' },
      { value: 'IN', labelCs: 'Region', labelEn: 'Region' },
    ],
  },
  {
    href: '/terranova/nova-amerika',
    title: 'LUMI · Nová Amerika',
    location: 'Kostarika',
    eyebrow: 'L5 · Americas Bridge',
    statusCs: 'V přípravě',
    statusEn: 'In preparation',
    descriptionCs:
      'Šestý uzel L5 Free World — most mezi oběma Amerikami pro nativní kultury. FPIC kruh starších, semenná knihovna Amerik a sdílený pozemek s L6 pozemní stanicí.',
    descriptionEn:
      'The sixth L5 Free World node — a bridge between the two Americas for native cultures. FPIC council of elders, Seed Library of the Americas, and a plot shared with the L6 ground station.',
    features: [
      { icon: Users, labelCs: 'Kruh starších', labelEn: 'Council of elders' },
      { icon: Leaf, labelCs: 'Semenná knihovna', labelEn: 'Seed library' },
      { icon: Globe, labelCs: 'Most Amerik', labelEn: 'Americas bridge' },
      { icon: Network, labelCs: 'L5 + L6 kampus', labelEn: 'L5 + L6 campus' },
    ],
    metrics: [
      { value: 'Kostarika', labelCs: 'Osa', labelEn: 'Axis' },
      { value: 'L5', labelCs: 'Vrstva', labelEn: 'Layer' },
      { value: 'CR', labelCs: 'Region', labelEn: 'Region' },
    ],
  },
  {
    href: '/terranova/uluru',
    title: 'Uluru',
    location: 'Northern Territory · Austrálie',
    eyebrow: 'L5 · Antipodes Message',
    statusCs: 'Vize',
    statusEn: 'Vision',
    descriptionCs:
      'Sedmý bod L5 Free World — odkaz a poselství domorodé Austrálie. Škola vnímání: telepatie, vize, propojení s přírodou a zvířaty — a každoroční festival oslavy života. Uzel jako vztah, ne stavba.',
    descriptionEn:
      'The seventh point of L5 Free World — the heritage and message of Aboriginal Australia. A school of perception: telepathy, visions, connection with land and animals — and an annual celebration-of-life festival. A node as a relationship, not a construction.',
    features: [
      { icon: Mountain, labelCs: 'Tjukurpa · Snění', labelEn: 'Tjukurpa · Dreaming' },
      { icon: Feather, labelCs: 'Songlines', labelEn: 'Songlines' },
      { icon: Users, labelCs: 'Kruh custodiánů', labelEn: 'Council of custodians' },
      { icon: Heart, labelCs: 'Kanyini · odpovědnost', labelEn: 'Kanyini · responsibility' },
    ],
    metrics: [
      { value: '60 000+', labelCs: 'Let paměti', labelEn: 'Years of memory' },
      { value: 'L5', labelCs: 'Vrstva', labelEn: 'Layer' },
      { value: 'AU', labelCs: 'Region', labelEn: 'Region' },
    ],
  },
  {
    href: '/terranova/maria-del-camino',
    title: 'María del Camino',
    location: 'Světové oceány · Galicie',
    eyebrow: 'L5 · Sailing Node',
    statusCs: 'V přípravě',
    statusEn: 'In preparation',
    descriptionCs:
      'Osmý bod L5 Free World — cesta, ne místo. Flotila Tres Marias — tři lodě nesoucí tři mariánská zjevení kolem tří oceánů, ~50 poutníků na trup. Tam, kde cesta starého světa u Finisterry končila, ona začíná.',
    descriptionEn:
      'The eighth point of L5 Free World — a way, not a place. The Tres Marias fleet — three ships carrying the three Marian apparitions across three oceans, ~50 pilgrims per hull. Where the old world’s road ended at Finisterre, this one begins.',
    features: [
      { icon: Sailboat, labelCs: 'Solární plachty', labelEn: 'Solar sails' },
      { icon: Waves, labelCs: 'Soběstačnost na moři', labelEn: 'Self-sufficiency at sea' },
      { icon: Network, labelCs: 'Guardian node', labelEn: 'Guardian node' },
      { icon: Compass, labelCs: 'Mořské Camino', labelEn: 'Sea Camino' },
    ],
    metrics: [
      { value: '~50', labelCs: 'Poutníků', labelEn: 'Pilgrims' },
      { value: 'L5', labelCs: 'Vrstva', labelEn: 'Layer' },
      { value: '300M', labelCs: 'Rezerva ZION', labelEn: 'ZION reserve' },
    ],
  },
  {
    href: '/terranova/boa-esperanca',
    title: 'Boa Esperança',
    location: 'Mys dobré naděje · Jihoafrická republika',
    eyebrow: 'L5 · The Turn',
    statusCs: 'Vize',
    statusEn: 'Vision',
    descriptionCs:
      'Devátý bod L5 Free World — šev dvou oceánů a obrat Velké cesty domů. Nejstarší lidská linie (Khoisan), kolébka symbolického myšlení v Blombos, fynbos zahrada, kelp seaforest a Day-Zero vodní laboratoř. Uzel jako vztah, ne stavba.',
    descriptionEn:
      'The ninth point of L5 Free World — the seam of two oceans and the Great Route’s turn homeward. Humanity’s oldest lineage (Khoisan), the cradle of symbolic thought at Blombos, a fynbos garden, kelp seaforest and a Day-Zero water lab. A node as a relationship, not a construction.',
    features: [
      { icon: Sunrise, labelCs: 'Naděje po bouři', labelEn: 'Hope after the storm' },
      { icon: Compass, labelCs: 'Agulhas — pravý sever', labelEn: 'Agulhas — true north' },
      { icon: Users, labelCs: 'Khoisan custodiáni', labelEn: 'Khoisan custodians' },
      { icon: Waves, labelCs: 'Šev dvou oceánů', labelEn: 'Seam of two oceans' },
    ],
    metrics: [
      { value: '~100k', labelCs: 'Let kořenů', labelEn: 'Years of roots' },
      { value: 'L5', labelCs: 'Vrstva', labelEn: 'Layer' },
      { value: 'ZA', labelCs: 'Region', labelEn: 'Region' },
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
