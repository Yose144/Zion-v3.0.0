'use client';

import Link from 'next/link';
import { ArrowLeft, BookOpen, Calendar, ChevronDown, Gamepad2, Globe, HelpCircle, Lamp, ListOrdered, Ticket } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tx5, t5 } from '@/lib/i18n-tx';

const Article = {
  cs: {
    back: 'Zpět na novinky',
    tag: 'Vánoce',
    date: '4. listopadu 2026',
    title: 'Vánoce v ZION — tři dary, kniha v osmi edicích, klient Kingdom a první svět OASIS',
    intro:
      'Tři dary, jedna cesta. Vánoční edice přidává k příběhu Království srdce dva další: ZION Pass, který otevírá Nirvanu i Archiv, a ručně gravírovaný lampion se světlem z téhož příběhu. Kniha mezitím dorostla do osmi edic v pěti jazycích. A ekosystém se rozšiřuje o herní klient Kingdom, který zůstává ve vývoji, a o Nirvanu — první svět OASIS, který už je živý.',
    imageAlt:
      'Vánoce 2026 — tesař s knihou, archa na vodě, brána Kingdom a svět Nirvana v jednom obraze',
    sections: [
      {
        icon: Ticket,
        title: 'ZION Pass — jeden kód, dva světy',
        image: '/images/news/christmas-2026/pass-wide.webp',
        imageAlt: 'Zlatá brána mezi světy — ZION Pass na podstavci mezi stromem života a knihovnou',
        text: 'Digitální průkaz za 108 Kč, který po zaplacení dorazí e-mailem jako kód ZAP-…. Tentýž kód otevře Nirvanu — 3D svět s arénou na Marsu, závodem na Venuši, soubojem na Merkuru, poutí u Jupitera a MOBA o Zemi — i ZION Archiv s kanonickými texty a Kronikami. K Passu patří 202 avatarů, společný chat a vánoční bonus 10 800 ZION na peněženku. Kód se váže na průkaz, ne na osobu, takže se dá přeposlat jako dárek.',
      },
      {
        icon: BookOpen,
        title: 'Království srdce — osm edic v pěti jazycích',
        image: '/images/news/christmas-2026/book-wide.webp',
        imageAlt: 'Tesař u hoblice s dětmi, na tabletu obálka knihy Království srdce',
        text: 'Duchovní legenda o tesaři z Nazareta, který v dílně svého otce stavěl loď pro moře, jež není na žádné mapě. Za 216 Kč dostanete kompletní korpus: osm samostatných edic téhož příběhu — od klasického midraše po Knihu Kýlu vyprávěnou dřevem — každou v češtině, angličtině, španělštině, francouzštině a portugalštině. Celkem 40 knih, 3 252 stran a 619 498 slov ve formátech PDF i EPUB. Vlajková ilustrovaná edice má 24 kapitol a epilog, každá kapitola nese tabulku „Kotva pravdy", která odděluje Písmo, tradici, historii, legendu a literární obraz. Ke knize patří ZION Archive Pass a vánoční bonus 21 600 ZION.',
      },
      {
        icon: Lamp,
        title: 'Lampion Království srdce — světlo z příběhu',
        image: '/images/news/christmas-2026/lampion-wide.webp?v=7',
        imageAlt: 'Tesař s dětmi u hořícího lampionu, na stole kniha Království srdce a ZION Pass',
        text: 'Lampion Lumi 2 — šestihranná lucerna vyřezávaná laserem — vychází ze scény, kde Lumi nese lampu k bráně. Vzory na těle nejsou dekorace: je to šest mandal z knihy. Jeden kus znamená 20,9 metru řezných drah, 614 obrysů a čtyři hodiny laseru, proto je edice číslovaná a vyrábí se v malých dávkách. Vánoční edice za 590 Kč obsahuje digitální knihu v plné sadě, ZION Pass a bonus 88 500 ZION; digitální část dorazí hned, fyzický lampion odejde ze dílny do dvou týdnů. Geometrii výrobku určuje samostatná technická dokumentace, ne ilustrace.',
      },
      {
        icon: Gamepad2,
        title: 'Kingdom — nový herní klient (ve vývoji)',
        image: '/images/news/christmas-2026/kingdom-1200.webp',
        imageAlt: 'Zlatá brána Kingdom s lucernou — portály do světů a služeb ekosystému',
        text: 'Ekosystém dnes tvoří dvanáct aplikací a čtrnáct hostname — Kingdom je jeden klient, do kterého se postupně vstřebají: Brána (vstup) → Místnost (shell) → Světy a Portály. Cílem je desktopová aplikace, okno bez prohlížeče s peněženkou, těžbou a tray agentem přímo uvnitř. Kingdom přitom nic nevlastní: žádnou databázi, žádné peníze ani klíče — jen čte živá data ze služeb přes portály Řetěz, Kovárna, Tržiště, Snem, Knihovna, Přístav, Věž a Issobella, a nese už třináct světů OASIS. Webová podoba na kingdom.zionterranova.com zatím stojí za závěsou údržby — o spuštění dáme vědět v novinkách.',
      },
      {
        icon: Globe,
        title: 'Nirvana — první svět OASIS je živý',
        image: '/images/news/christmas-2026/nirvana-worlds-1200.webp',
        imageAlt: 'Vesmír Nirvany — planety otevírají hry: Venuše, Měsíc, Saturn, Mars, Země a strom Brány do OASIS',
        text: 'První svět OASIS se jmenuje Nirvana a běží na nirvana.zionterranova.com. Vesmír, ve kterém planety otevírají hry: Země — MOBA se třemi linkami a uzly L5 (online 2v2), Mars — aréna deathmatch sólo i online, Venuše — závodní okruh na tři kola, Merkur — souboj best of 3 online, Saturn — Kroniky, Pouť s arkádami a kolem a šatník se 202 avatary. Chat a multiplayer běží na vlastní realtime službě a ovládání funguje i na dotykových zařízeních.',
      },
    ],
    stepsTitle: 'Jak to funguje',
    steps: [
      'Vyberete dar — Pass, knihu, nebo lampion. Každý nese vlastní ZION bonus.',
      'Zaplatíte převodem, kartou nebo v ZIONu. U digitálních darů není doprava, u lampionu ji spočítá pokladna.',
      'Do minuty po zaplacení dorazí e-mail: kód ZAP-…, odkaz na knihy (40 souborů) a ZION peněženka s bonusem.',
      'Kód uplatníte na nirvana.zionterranova.com i v ZION Archivu. Peněženku naimportujete do ZIS a bonus máte na adrese.',
      'U lampionu navíc: digitální část přichází hned, samotný výrobek odchází ze dílny, až bude hotový.',
    ],
    faqTitle: 'Časté otázky',
    faq: [
      {
        q: 'Kdy mi přijde e-mail s kódem a peněženkou?',
        a: 'U karty a ZIONu obvykle do minuty po zaplacení. U bankovního převodu ve chvíli, kdy platba dorazí na účet.',
      },
      {
        q: 'Má ZION bonus peněžní hodnotu?',
        a: 'Ne. ZION je experimentální ekosystém, bonus nemá garantovanou peněžní hodnotu a nezakládá nárok na výnos. Kupujete dar a podporu světa.',
      },
      {
        q: 'Co přesně je kód ZAP-…?',
        a: 'Váš průkaz. Jeden kód platí v Nirvaně i v Archivu a váže se na průkaz, ne na osobu — takže ho můžete darovat.',
      },
      {
        q: 'Co udělám se seed phrase od peněženky?',
        a: 'Uložte ji offline — papír nebo trezor, nikdy do cloudu ani do screenshotu. Kdo má seed, má peněženku.',
      },
      {
        q: 'Jak je to s vrácením a reklamací?',
        a: 'Digitální obsah je doručen okamžitě, takže se na něj podle obchodních podmínek vztahuje výluka z práva na odstoupení. Lampion je zboží na zakázku — reklamace řeší reklamační řád.',
      },
    ],
    linksTitle: 'Kam dál',
    links: [
      { href: 'https://market.zionterranova.com/vanoce', label: 'Vánoční edice — přehled', external: true },
      { href: 'https://market.zionterranova.com/vanoce/zion-pass', label: 'ZION Pass', external: true },
      { href: 'https://market.zionterranova.com/vanoce/kniha-kralovstvi-srdce', label: 'Kniha Království srdce', external: true },
      { href: 'https://market.zionterranova.com/vanoce/lampion', label: 'Lampion', external: true },
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
    date: '4 November 2026',
    title: 'Christmas at ZION — three gifts, a book in eight editions, the Kingdom client and the first OASIS world',
    intro:
      'Three gifts, one road. The Christmas edition adds two more to the story of Kingdom of the Heart: the ZION Pass, which opens Nirvana and the Archive, and a hand-engraved lantern carrying light from the same story. Meanwhile the book has grown into eight editions across five languages. And the ecosystem expands with the Kingdom game client, still in development, and Nirvana — the first OASIS world, already live.',
    imageAlt:
      'Christmas 2026 — the carpenter with the book, the ark at sea, the Kingdom gate and the world of Nirvana in one picture',
    sections: [
      {
        icon: Ticket,
        title: 'ZION Pass — one code, two worlds',
        image: '/images/news/christmas-2026/pass-wide.webp',
        imageAlt: 'The golden gate between worlds — the ZION Pass on a pedestal between the tree of life and the library',
        text: 'A digital credential for 108 CZK that arrives by e-mail after payment as a ZAP-… code. The same code opens Nirvana — a 3D world with the Mars arena, the Venus race, the Mercury duel, the Jupiter fairground and the Earth MOBA — and the ZION Archive with its canonical texts and Chronicles. The Pass includes 202 avatars, a shared chat and a Christmas bonus of 10,800 ZION to your wallet. The code binds to the credential, not a person, so it can be forwarded as a gift.',
      },
      {
        icon: BookOpen,
        title: 'Kingdom of the Heart — eight editions in five languages',
        image: '/images/news/christmas-2026/book-wide.webp',
        imageAlt: 'The carpenter at the bench with children, the cover of Kingdom of the Heart on a tablet',
        text: 'A spiritual legend about a carpenter of Nazareth who built a ship in his father’s workshop — for a sea that is on no map. For 216 CZK you get the complete corpus: eight distinct editions of the same story — from a classical midrash to the Book of the Keel told by the wood itself — each in Czech, English, Spanish, French and Portuguese. Forty books in total, 3,252 pages and 619,498 words in PDF and EPUB. The illustrated flagship has 24 chapters and an epilogue, and every chapter carries an “Anchor of Truth” table separating Scripture, tradition, history, legend and literary image. The book includes a ZION Archive Pass and a Christmas bonus of 21,600 ZION.',
      },
      {
        icon: Lamp,
        title: 'The Kingdom of the Heart lantern — light from the story',
        image: '/images/news/christmas-2026/lampion-wide.webp?v=7',
        imageAlt: 'The carpenter with children around the lit lantern, the Kingdom of the Heart book and ZION Pass on the table',
        text: 'A hand-engraved lantern bearing the Heart of the Kingdom pattern comes from the scene where Lumi carries her lamp to the gate. The patterns on its body are not decoration — they are the mandalas from the book. The Christmas edition at 432 CZK includes the full digital book set, a ZION Pass and a 43,200 ZION bonus; the digital part arrives immediately, while the crafted lantern ships from the workshop once finished, which is why the sale is still marked as coming soon. The geometry of the piece is defined by its own technical documentation, not by an illustration.',
      },
      {
        icon: Gamepad2,
        title: 'Kingdom — the new game client (in development)',
        image: '/images/news/christmas-2026/kingdom-1200.webp',
        imageAlt: 'Kingdom’s golden gate with the lantern — portals into the ecosystem’s worlds and services',
        text: 'The ecosystem today spans twelve applications and fourteen hostnames — Kingdom is the single client they will gradually be absorbed into: the Gate (entry) → the Room (shell) → Worlds and Portals. The goal is a desktop app: a browserless window with the wallet, mining and tray agent built right in. Kingdom owns nothing: no database, no money or keys — it only reads live data from the services through the Chain, Forge, Market, Senate, Library, Harbor, Tower and Issobella portals, and already carries thirteen OASIS worlds. The web version at kingdom.zionterranova.com currently sits behind a maintenance curtain — we will announce the launch in the news.',
      },
      {
        icon: Globe,
        title: 'Nirvana — the first OASIS world is live',
        image: '/images/news/christmas-2026/nirvana-worlds-1200.webp',
        imageAlt: 'The Nirvana universe — planets open games: Venus, the Moon, Saturn, Mars, Earth and the Gate-to-OASIS tree',
        text: 'The first OASIS world is called Nirvana and runs at nirvana.zionterranova.com. A universe where planets open games: Earth — a MOBA with three lanes and L5 nodes (online 2v2), Mars — a deathmatch arena solo and online, Venus — a three-lap racing circuit, Mercury — an online best-of-3 duel, Saturn — the Chronicles, the Fair with arcades and a wheel, and a wardrobe of 202 avatars. Chat and multiplayer run on a dedicated realtime service, and the controls work on touch devices too.',
      },
    ],
    stepsTitle: 'How it works',
    steps: [
      'You pick a gift — the Pass, the book, or the lantern. Each carries its own ZION bonus.',
      'You pay by transfer, card or in ZION. Digital gifts ship nothing; the lantern’s shipping is calculated at checkout.',
      'Within a minute of payment an e-mail arrives: a ZAP-… code, a link to the books (40 files) and a ZION wallet with the bonus.',
      'You redeem the code on nirvana.zionterranova.com and in the ZION Archive. Import the wallet into ZIS and the bonus is yours.',
      'With the lantern: the digital part arrives immediately, the crafted piece ships from the workshop once finished.',
    ],
    faqTitle: 'Frequently asked',
    faq: [
      {
        q: 'When does the e-mail with the code and wallet arrive?',
        a: 'Card and ZION payments usually within a minute. With a bank transfer, the moment the payment lands in the account.',
      },
      {
        q: 'Does the ZION bonus have monetary value?',
        a: 'No. ZION is an experimental ecosystem; the bonus has no guaranteed monetary value and creates no claim on returns. You are buying a gift and support for the world.',
      },
      {
        q: 'What exactly is the ZAP-… code?',
        a: 'Your credential. One code works in Nirvana and in the Archive, and it binds to the credential rather than a person — so it can be gifted.',
      },
      {
        q: 'What do I do with the wallet seed phrase?',
        a: 'Store it offline — paper or a safe, never in the cloud or a screenshot. Whoever has the seed has the wallet.',
      },
      {
        q: 'What about returns and complaints?',
        a: 'Digital content is delivered instantly, so under the terms it is excluded from the right of withdrawal. The lantern is made to order — complaints follow the complaints policy.',
      },
    ],
    linksTitle: 'Continue to',
    links: [
      { href: 'https://market.zionterranova.com/vanoce', label: 'Christmas edition — overview', external: true },
      { href: 'https://market.zionterranova.com/vanoce/zion-pass', label: 'ZION Pass', external: true },
      { href: 'https://market.zionterranova.com/vanoce/kniha-kralovstvi-srdce', label: 'Kingdom of the Heart', external: true },
      { href: 'https://market.zionterranova.com/vanoce/lampion', label: 'Lantern', external: true },
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
              src="/images/news/christmas-2026/hero-1600.webp?v=7"
              srcSet="/images/news/christmas-2026/hero-960.webp?v=7 960w, /images/news/christmas-2026/hero-1600.webp?v=7 1600w"
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

          {/* Jak to funguje */}
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white mb-4">
              <ListOrdered className="h-4 w-4 text-zion-gold" />
              {t.stepsTitle}
            </h2>
            <ol className="grid gap-3 sm:grid-cols-2">
              {t.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zion-gold/40 bg-zion-gold/10 text-[11px] font-bold text-zion-gold">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-gray-300">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* FAQ */}
          <div className="mt-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white mb-4">
              <HelpCircle className="h-4 w-4 text-zion-gold" />
              {t.faqTitle}
            </h2>
            <div className="space-y-2">
              {t.faq.map((item, i) => (
                <details key={i} className="group rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden [&_summary]:list-none">
                  <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-gray-200 transition-colors hover:text-zion-gold">
                    {item.q}
                    <ChevronDown className="h-4 w-4 shrink-0 text-white/30 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="px-4 pb-3 text-sm leading-relaxed text-gray-400">{item.a}</p>
                </details>
              ))}
            </div>
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
