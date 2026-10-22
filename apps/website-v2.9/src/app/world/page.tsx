'use client';

import Link from 'next/link';
import {
  Brain,
  Gamepad2,
  Globe,
  Rocket,
  Flame,
  Cpu,
  Map,
  ArrowRight,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { SITE_RELEASE_LABEL } from '@/lib/site';

const WorldCopy = {
  kicker: { cs: 'Svět', en: 'World' },
  title: { cs: 'Světy ZION', en: 'The worlds of ZION' },
  lead: {
    cs: 'Jeden řetězec, více světů: od AI vrstvy a OASIS metavese přes fyzické uzly L5 Free World až po Issobellu — misi za hranice planety. Vyberte si, kam dál.',
    en: 'One chain, many worlds: from the AI layer and the OASIS metaverse to the physical nodes of L5 Free World and Issobella — the mission beyond the planet. Choose where to go next.',
  },
  enter: { cs: 'Vstoupit', en: 'Enter' },
} as const;

const DESTINATIONS = [
  {
    href: '/l3-hiran',
    icon: Brain,
    rc: '228, 30, 43',
    title: { cs: 'L3 Hiran', en: 'L3 Hiran' },
    desc: {
      cs: 'AI-nativní vrstva — Hiranyagarbha, konstituční inference a RAG nad kanonem sítě.',
      en: 'The AI-native layer — Hiranyagarbha, constitutional inference and RAG over the network canon.',
    },
  },
  {
    href: '/l4-oasis',
    icon: Gamepad2,
    rc: '252, 209, 22',
    title: { cs: 'L4 OASIS', en: 'L4 OASIS' },
    desc: {
      cs: 'Herní vrstva — avataři jako NFT, questy, gildy a území na ZION L1.',
      en: 'The game layer — avatars as NFTs, quests, guilds and territories on ZION L1.',
    },
  },
  {
    href: '/l5-free-world',
    icon: Globe,
    rc: '6, 105, 40',
    title: { cs: 'L5 Free World', en: 'L5 Free World' },
    desc: {
      cs: 'Fyzická síť uzlů svobodného světa — TerraNova body, governance a portál freeworld.',
      en: 'The physical network of free-world nodes — TerraNova sites, governance and the freeworld portal.',
    },
  },
  {
    href: '/terranova',
    icon: Map,
    rc: '252, 209, 22',
    title: { cs: 'TerraNova', en: 'TerraNova' },
    desc: {
      cs: 'Geografie sítě — dvanáct uzlů od Genesis zahrady po Síně Amenti.',
      en: 'The geography of the network — twelve nodes from the Genesis garden to the Halls of Amenti.',
    },
  },
  {
    href: '/l6-issobella',
    icon: Rocket,
    rc: '228, 30, 43',
    title: { cs: 'L6 Issobella', en: 'L6 Issobella' },
    desc: {
      cs: 'Mise za hranice planety — fyzikální stanice a deep-space horizont sítě.',
      en: 'The mission beyond the planet — a physical station and the network’s deep-space horizon.',
    },
  },
  {
    href: '/ekam',
    icon: Flame,
    rc: '252, 209, 22',
    title: { cs: 'Ekam', en: 'Ekam' },
    desc: {
      cs: 'Ekam a Deeksha — kanonický dual-algo PoW a duchovní jádro konsenzu.',
      en: 'Ekam and Deeksha — the canonical dual-algo PoW and the spiritual core of consensus.',
    },
  },
  {
    href: '/ai-native',
    icon: Cpu,
    rc: '6, 105, 40',
    title: { cs: 'AI Native', en: 'AI Native' },
    desc: {
      cs: 'Zeptejte se Hiranyagarbhy — chat nad veřejným korpusem ZION.',
      en: 'Ask Hiranyagarbha — chat over the public ZION corpus.',
    },
  },
];

export default function WorldPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  return (
    <div className="zion-page text-white">
      <section className="zion-container relative z-10 pt-14 pb-6 text-center">
        <p className="zion-kicker">{WorldCopy.kicker[cs ? 'cs' : 'en']}</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          {WorldCopy.title[cs ? 'cs' : 'en']}
          <span className="sr-only">{` · ZION ${SITE_RELEASE_LABEL}`}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-white/60">
          {WorldCopy.lead[cs ? 'cs' : 'en']}
        </p>
      </section>

      <section className="zion-container relative z-10 grid gap-5 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        {DESTINATIONS.map((d) => {
          const Icon = d.icon;
          return (
            <Link
              key={d.href}
              href={d.href}
              prefetch={false}
              className="zion-rainbow-card group flex flex-col gap-3 p-6 transition-transform duration-200 hover:-translate-y-0.5"
              style={{ '--rc': d.rc } as React.CSSProperties}
            >
              <div className="flex items-center gap-3">
                <span className="rounded-xl border border-white/10 bg-white/5 p-2">
                  <Icon className="h-5 w-5 text-white/80" />
                </span>
                <h2 className="text-lg font-semibold">{d.title[cs ? 'cs' : 'en']}</h2>
              </div>
              <p className="text-sm leading-relaxed text-white/55">
                {d.desc[cs ? 'cs' : 'en']}
              </p>
              <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zion-gold/80 group-hover:text-zion-gold">
                {WorldCopy.enter[cs ? 'cs' : 'en']}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
