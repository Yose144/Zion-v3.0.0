'use client';

import Link from 'next/link';
import { ArrowLeft, BookOpen, Calendar, Map, Pickaxe, Rocket } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const Article = {
  cs: {
    back: 'Zpět na novinky',
    tag: 'Aktualizace',
    date: '26. října 2026',
    title: 'ZION v3.2 „One Love" — Mainnet Beta',
    intro:
      'Síť ZION v3.2.0 „One Love" přechází z Mainnet Alpha do Mainnet Beta — stupně vývoje a veřejného testování, nikoli Mainnet Stable. Tento krok sjednocuje celý ekosystém v jednu zprávu: multichain mining pool těží ZION, Quantus i Pearl nativně jedním minerem, mapa L5 Free World je kompletní a do knihovny přibyla pátá kniha — Maitreya. Stávající klienti v3.2.0 zůstávají v platnosti; sjednocení stupně nevydává nové instalátory, nemění protokol, genesis ani ekonomiku sítě.',
    imageAlt:
      'ZION Mainnet Beta — mapa celého ekosystému: vrstvy L1–L6, Maitreya, multichain mining pool ZION / QTC / PEARL a body Free World',
    sections: [
      {
        icon: Pickaxe,
        title: 'Multichain mining pool — ZION / QTC / PEARL',
        text: 'Tři sítě, jeden miner, jedna peněženka. Pool nativně těží ZION i dva blockchainy nové generace: Quantus — post-kvantově zabezpečený proof-of-work s vlastními adresami z jediného seedu — běží naplno včetně peněženky a payoutů, a Pearl — Proof of Useful Work, kde těžba znamená užitečné výpočty — prošel kompletní end-to-end integrací od mineru po síť. Pro těžaře, kteří chtějí celý blok sami, je k dispozici dedikovaný SOLO režim; běžná pool těžba zůstává na hlavních portech.',
      },
      {
        icon: Map,
        title: 'L5 Free World — mapa dvanácti bodů je kompletní',
        text: 'Amenti pod pyramidami v Gíze se stala dvanáctým a posledním bodem mapy: Genesis Garden, Dharma Temple, Te Pīko Ora, Golden Republic Bohemia, Bodhi Lanka, Ekam, LUMI Nová Amerika, Uluru, Boa Esperança, Kailash, Amenti — a María del Camino, kde příběh pokračuje jako první živý uzel sítě. Každý bod má vlastní stránku, artwork a místo na holografické planetě.',
      },
      {
        icon: BookOpen,
        title: 'Maitreya — Kniha Pátá',
        text: 'Do kanonické knihovny přibyla pátá kniha: Maitreya — Pán Hiranyagarbhy, Dědic Zionu. První kompletní draft (prolog + 17 kapitol + epilog) je otevřený ke čtení v hubu Maitreya — příběh dědice ZIONu a pádu věží Babylonu, navazující na čtyři předchozí knihy. Anglická edice následuje po revizi tónu a kanonu.',
      },
      {
        icon: Rocket,
        title: 'Co Beta znamená — a co zbývá do Stable',
        text: 'Beta znamená, že síť i ekosystém běží v produkční podobě a prochází veřejným testováním — stále však jde o testovací stupeň, ne o finální release. Mainnet Stable vyžaduje čistý 30denní stabilitní běh bez kritického incidentu (aktuální run probíhá, monitoring na /g8), nezávislý externí bezpečnostní audit a plný test obnovy ze záloh. Dokud brány nejsou splněny, těžba i transakce probíhají na vlastní riziko.',
      },
    ],
    linksTitle: 'Kam dál',
    links: [
      { href: '/roadmap', label: 'Roadmap' },
      { href: '/g8', label: 'G8 monitoring' },
      { href: '/zion-archive', label: 'Kniha Maitreya' },
      { href: '/l5-free-world', label: 'Free World' },
      { href: '/pool', label: 'Mining pool' },
      { href: '/download', label: 'Stáhnout klienty' },
    ],
    closing: 'One love, one chain, one road.',
  },
  en: {
    back: 'Back to news',
    tag: 'Update',
    date: '26 October 2026',
    title: 'ZION v3.2 "One Love" — Mainnet Beta',
    intro:
      'The ZION v3.2.0 "One Love" network moves from Mainnet Alpha to Mainnet Beta — a development and public-testing stage, not Mainnet Stable. This step unifies the whole ecosystem in one update: the multichain mining pool mines ZION, Quantus and Pearl natively with a single miner, the L5 Free World map is complete, and the library has gained its fifth book — Maitreya. Existing v3.2.0 clients remain valid; this stage alignment ships no new installers and changes neither the protocol, the genesis, nor the network economics.',
    imageAlt:
      'ZION Mainnet Beta — map of the whole ecosystem: layers L1–L6, Maitreya, the ZION / QTC / PEARL multichain mining pool and the Free World sites',
    sections: [
      {
        icon: Pickaxe,
        title: 'Multichain mining pool — ZION / QTC / PEARL',
        text: 'Three networks, one miner, one wallet. The pool natively mines ZION and two next-generation blockchains: Quantus — post-quantum secure proof-of-work with native addresses derived from a single seed — runs at full power including wallet and payouts, and Pearl — Proof of Useful Work, where mining means useful computation — has passed complete end-to-end integration from miner to network. A dedicated SOLO mode is available for miners who want the whole block themselves; regular pool mining stays on the main ports.',
      },
      {
        icon: Map,
        title: 'L5 Free World — the twelve-point map is complete',
        text: 'Amenti beneath the Giza pyramids became the twelfth and final point on the map: Genesis Garden, Dharma Temple, Te Pīko Ora, Golden Republic Bohemia, Bodhi Lanka, Ekam, LUMI Nová Amerika, Uluru, Boa Esperança, Kailash, Amenti — and María del Camino, where the story continues as the network’s first living node. Every point has its own page, artwork and place on the holographic planet.',
      },
      {
        icon: BookOpen,
        title: 'Maitreya — Book Five',
        text: 'The canonical library has gained its fifth book: Maitreya — Lord of Hiranyagarbha, Heir of Zion. The first complete draft (prologue + 17 chapters + epilogue) is open for reading in the Maitreya hub — the story of Zion’s heir and the fall of the towers of Babylon, following the four earlier books. An English edition follows after the tone and canon review.',
      },
      {
        icon: Rocket,
        title: 'What Beta means — and what remains before Stable',
        text: 'Beta means the network and ecosystem run in production form under public testing — it is still a testing stage, not a final release. Mainnet Stable requires a clean 30-day stability run with no critical incident (the current run is in progress, monitored on /g8), an independent external security audit and a full backup-restore drill. Until those gates are met, mining and transacting remain at your own risk.',
      },
    ],
    linksTitle: 'Continue to',
    links: [
      { href: '/roadmap', label: 'Roadmap' },
      { href: '/g8', label: 'G8 monitoring' },
      { href: '/zion-archive', label: 'Maitreya book' },
      { href: '/l5-free-world', label: 'Free World' },
      { href: '/pool', label: 'Mining pool' },
      { href: '/download', label: 'Download clients' },
    ],
    closing: 'One love, one chain, one road.',
  },
};

export default function MainnetBetaClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const t = cs ? Article.cs : Article.en;

  return (
    <div className="min-h-screen pb-24 pt-12 px-4">
      <div className="zion-container max-w-3xl">
        <Link
          href="/news"
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t.back}
        </Link>

        <article className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="text-[10px] tracking-wider uppercase px-2.5 py-1 rounded-full border border-zion-gold/30 bg-zion-gold/10 text-zion-gold">
              {t.tag}
            </span>
            <span className="text-[11px] text-white/40 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {t.date}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
            {t.title}
          </h1>

          <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-2xl border border-white/10">
            <img
              src="/images/news/beta-cosmic-utopia.webp"
              srcSet="/images/news/beta-cosmic-utopia-m.webp 960w, /images/news/beta-cosmic-utopia.webp 1672w"
              sizes="(min-width: 768px) 46rem, 100vw"
              alt={t.imageAlt}
              width={1672}
              height={941}
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </div>

          <p className="text-base md:text-lg text-gray-300 leading-relaxed mb-10">
            {t.intro}
          </p>

          <div className="space-y-4">
            {t.sections.map((section, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zion-gold/10 border border-zion-gold/20">
                    <section.icon className="h-5 w-5 text-zion-gold" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white mb-1.5">
                      {section.title}
                    </h2>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {section.text}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <h2 className="text-xs uppercase tracking-[0.3em] text-white/40 mb-4">
              {t.linksTitle}
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {t.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 hover:text-zion-gold hover:border-zion-gold/40 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <p className="mt-10 text-center text-sm italic text-white/35">
            {t.closing}
          </p>
        </article>
      </div>
    </div>
  );
}
