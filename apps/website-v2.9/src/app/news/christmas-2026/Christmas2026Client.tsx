'use client';

import Link from 'next/link';
import { ArrowLeft, BookOpen, Calendar, Gamepad2, Globe, Rocket } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const Article = {
  cs: {
    back: 'Zpět na novinky',
    tag: 'Vánoce',
    date: '3. listopadu 2026',
    title: 'Vánoce v ZION — kniha Království srdce v prodeji, klient Kingdom a první svět OASIS',
    intro:
      'Tři zprávy v jedné. Na Štědrý den míří vánoční prodej digitální knihy Království srdce — příběhu tesaře a lodi, která v ekosystému nesla jméno všemu, co stavíme. Zároveň se ekosystém rozšiřuje o nový herní klient Kingdom, který zůstává ve vývoji, a o Nirvanu — první svět OASIS, který už je živý a otevřený.',
    imageAlt:
      'Vánoce 2026 — tesař s knihou, archa na vodě, brána Kingdom a svět Nirvana v jednom obraze',
    sections: [
      {
        icon: BookOpen,
        title: 'Království srdce — vánoční prodej odstartoval',
        image: '/images/news/christmas-2026/kralovstvi-srdce-1200.webp',
        imageAlt: 'Tesařova dílna — tesař s dětmi a lucernou u hoblice, v pozadí archa ve stavební dok',
        text: 'Duchovní legenda o tesaři z Nazareta, který v dílně svého otce stavěl loď pro moře, jež není na žádné mapě — a říkal jí Království srdce. Deset kapitol a epilog, každá kapitola s tabulkou „Kotva pravdy“, která odděluje Písmo, tradici a autorův obraz. Digitální vydání ke stažení je v obchodě za 144 Kč — nově jako ilustrovaná edice v pěti jazycích (CZ · EN · FR · ES · PT), PDF i EPUB. Ke knize patří ZION Archive Pass — vstup do ZION Archivu — a do 24. 12. 2026 vánoční bonus: 144 000 ZION a Genesis vstup pro Guardians ekosystému.',
      },
      {
        icon: Gamepad2,
        title: 'Kingdom — nový herní klient (ve vývoji)',
        image: '/images/news/christmas-2026/kingdom-1200.webp',
        imageAlt: 'Zlatá brána Kingdom s lucernou — portály do světů a služeb ekosystému',
        text: 'Ekosystém dnes tvoří dvanáct aplikací a čtrnáct hostname — Kingdom je jeden klient, do kterého se postupně vstřebají: Brána (vstup) → Místnost (shell) → Světy a Portály. Cílem je desktopová aplikace na Electronu — okno bez prohlížeče s peněženkou, těžbou a tray agentem přímo uvnitř. Kingdom přitom nic nevlastní: žádnou databázi, žádné peníze ani klíče — jen čte živá data ze služeb přes portály Řetěz, Kovárna (pool), Tržiště, Snem (DAO), Knihovna (14 knih), Přístav (L5), Věž (Hiran) a Issobella, a nese už třináct světů OASIS. Webová podoba na kingdom.zionterranova.com zatím stojí za závěsou údržby — klient je ve vývoji a o spuštění dáme vědět.',
      },
      {
        icon: Globe,
        title: 'Nirvana — první svět OASIS je živý',
        image: '/images/news/christmas-2026/nirvana-worlds-1200.webp',
        imageAlt: 'Vesmír Nirvany — planety otevírají hry: Venuše, Měsíc, Saturn, Mars, Země a strom Brány do OASIS',
        text: 'První svět OASIS se jmenuje Nirvana a běží na nirvana.zionterranova.com. Vesmír, ve kterém planety otevírají hry: Země — MOBA se třemi linkami a uzly L5 (online 2v2), Mars — aréna deathmatch sólo i online, Venuše — závodní okruh na tři kola, Merkur — souboj best of 3 online, Saturn — Kroniky (archiv patnácti kapitol), Pouť s arkádami a kolem a šatník s 200 avatary z OASISu. Chat a multiplayer běží přes vlastní realtime službu a ovládání funguje i na dotykových zařízeních.',
      },
      {
        icon: Rocket,
        title: 'Jak se dostat dovnitř',
        text: 'Vstup do Nirvany a do ZION Archivu odemyká jediný kód ve formátu ZAP-…, který dorazí po zaplacení. Kniha Království srdce obsahuje ZION Archive Pass (Archiv), samostatný ZION Pass (108 Kč) otevírá Nirvanu i Archiv. Kingdom klient zůstává ve vývoji — o spuštění desktopové verze dáme vědět v novinkách.',
      },
    ],
    linksTitle: 'Kam dál',
    links: [
      { href: 'https://market.zionterranova.com/shop?category=books', label: 'Obchod — knihy', external: true },
      { href: 'https://nirvana.zionterranova.com', label: 'Nirvana', external: true },
      { href: 'https://kingdom.zionterranova.com', label: 'Kingdom', external: true },
      { href: '/terranova/kralovstvi-srdce', label: 'Království srdce — Archa' },
      { href: '/zion-archive', label: 'ZION Archiv' },
      { href: '/l4-oasis', label: 'OASIS' },
    ] as { href: string; label: string; external?: boolean }[],
    closing: 'One love, one chain, one road.',
  },
  en: {
    back: 'Back to news',
    tag: 'Christmas',
    date: '3 November 2026',
    title: 'Christmas at ZION — Kingdom of the Heart on sale, the Kingdom client and the first OASIS world',
    intro:
      'Three updates in one. The Christmas sale of the digital book Kingdom of the Heart is heading for Christmas Eve — the story of a carpenter and the ship that lent its name to everything we are building in this ecosystem. At the same time, the ecosystem gains a new game client, Kingdom, which remains in development, and Nirvana — the first OASIS world, already live and open.',
    imageAlt:
      'Christmas 2026 — the carpenter with the book, the ark at sea, the Kingdom gate and the world of Nirvana in one picture',
    sections: [
      {
        icon: BookOpen,
        title: 'Kingdom of the Heart — the Christmas sale has started',
        image: '/images/news/christmas-2026/kralovstvi-srdce-1200.webp',
        imageAlt: 'The carpenter’s workshop — a carpenter with children and a lantern at the bench, the ark in its drydock behind',
        text: 'A spiritual legend about a carpenter of Nazareth who built a ship in his father’s workshop — for a sea that is on no map — and called it the Kingdom of the Heart. Ten chapters and an epilogue, each chapter carrying an “Anchor of Truth” table that separates Scripture, tradition and the author’s imagination. The digital download edition is in the shop for 144 CZK — now as an illustrated edition in five languages (CZ · EN · FR · ES · PT), PDF and EPUB. The book includes a ZION Archive Pass — entry to the ZION Archive — and until 24 December 2026 a Christmas bonus: 144,000 ZION and Genesis entry for the ecosystem’s Guardians.',
      },
      {
        icon: Gamepad2,
        title: 'Kingdom — the new game client (in development)',
        image: '/images/news/christmas-2026/kingdom-1200.webp',
        imageAlt: 'Kingdom’s golden gate with the lantern — portals into the ecosystem’s worlds and services',
        text: 'The ecosystem today spans twelve applications and fourteen hostnames — Kingdom is the single client they will gradually be absorbed into: the Gate (entry) → the Room (shell) → Worlds and Portals. The goal is a desktop Electron app — a browserless window with the wallet, mining and tray agent built right in. Kingdom owns nothing: no database, no money or keys — it only reads live data from the services through the Chain, Forge (pool), Market, Senate (DAO), Library (14 books), Harbor (L5), Tower (Hiran) and Issobella portals, and already carries thirteen OASIS worlds. The web version at kingdom.zionterranova.com currently sits behind a maintenance curtain — the client is in development and we will announce its launch.',
      },
      {
        icon: Globe,
        title: 'Nirvana — the first OASIS world is live',
        image: '/images/news/christmas-2026/nirvana-worlds-1200.webp',
        imageAlt: 'The Nirvana universe — planets open games: Venus, the Moon, Saturn, Mars, Earth and the Gate-to-OASIS tree',
        text: 'The first OASIS world is called Nirvana and runs at nirvana.zionterranova.com. A universe where planets open games: Earth — a MOBA with three lanes and L5 nodes (online 2v2), Mars — a deathmatch arena solo and online, Venus — a three-lap racing circuit, Mercury — an online best-of-3 duel, Saturn — the Chronicles (a fifteen-chapter archive), the Fair with arcades and a wheel, and a wardrobe of 200 OASIS avatars. Chat and multiplayer run on a dedicated realtime service, and the controls work on touch devices too.',
      },
      {
        icon: Rocket,
        title: 'How to get inside',
        text: 'Entry to Nirvana and to the ZION Archive is unlocked by a single ZAP-… code delivered after payment. The Kingdom of the Heart book includes a ZION Archive Pass (the Archive); the standalone ZION Pass (108 CZK) opens both Nirvana and the Archive. The Kingdom client remains in development — we will announce the desktop version in the news.',
      },
    ],
    linksTitle: 'Continue to',
    links: [
      { href: 'https://market.zionterranova.com/shop?category=books', label: 'Shop — books', external: true },
      { href: 'https://nirvana.zionterranova.com', label: 'Nirvana', external: true },
      { href: 'https://kingdom.zionterranova.com', label: 'Kingdom', external: true },
      { href: '/terranova/kralovstvi-srdce', label: 'Kingdom of the Heart — the Ark' },
      { href: '/zion-archive', label: 'ZION Archive' },
      { href: '/l4-oasis', label: 'OASIS' },
    ] as { href: string; label: string; external?: boolean }[],
    closing: 'One love, one chain, one road.',
  },
};

export default function Christmas2026Client() {
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
            <span className="text-[11px] tracking-wider uppercase px-2.5 py-1 rounded-full border border-zion-gold/30 bg-zion-gold/10 text-zion-gold">
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
              src="/images/news/christmas-2026/hero-1600.webp"
              srcSet="/images/news/christmas-2026/hero-960.webp 960w, /images/news/christmas-2026/hero-1600.webp 1600w"
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
                  <div className="min-w-0 flex-1">
                    {'image' in section && section.image && (
                      <img
                        src={section.image}
                        alt={section.imageAlt ?? ''}
                        loading="lazy"
                        className="float-right ml-4 mb-2 w-40 shrink-0 rounded-xl border border-white/10 object-cover sm:w-56 md:w-64"
                      />
                    )}
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
              {t.links.map((link) =>
                link.external ? (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 hover:text-zion-gold hover:border-zion-gold/40 transition-colors"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 hover:text-zion-gold hover:border-zion-gold/40 transition-colors"
                  >
                    {link.label}
                  </Link>
                ),
              )}
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
