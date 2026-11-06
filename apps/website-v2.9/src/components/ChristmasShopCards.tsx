'use client';

import { BookOpen, Coins, Ticket, Flame, ShoppingCart, Lock } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

// Karty míří na detail produktu (vysvětlí, co v ceně je, jak to funguje,
// má FAQ), ne na obecný výpis obchodu — tam se člověk musí proklikat znovu.
const PASS_URL = 'https://market.zionterranova.com/vanoce/zion-pass';
const BOOK_URL = 'https://market.zionterranova.com/vanoce/kniha-kralovstvi-srdce';
const LAMP_URL = 'https://market.zionterranova.com/vanoce/lampion';

interface CardDef {
  image: string;
  imagePosition?: string;
  icon: typeof Ticket;
  kicker: { cs: string; en: string };
  title: { cs: string; en: string };
  desc: { cs: string; en: string };
  price: string;
  bonus: { cs: string; en: string };
  cta: { cs: string; en: string };
  href?: string;
  soon?: boolean;
}

const CARDS: CardDef[] = [
  {
    // Původní obrázek produktu (brána se ZION Passem), ne obecná brána Kingdom.
    image: '/images/news/christmas-2026/card-pass.webp',
    icon: Ticket,
    kicker: { cs: 'Vánoční edice · ZAP kód', en: 'Christmas edition · ZAP code' },
    title: { cs: 'ZION Pass', en: 'ZION Pass' },
    desc: {
      cs: 'Vstupenka do Nirvany — prvního světa OASIS — i do ZION Archivu. Po zaplacení dorazí jedinečný kód ZAP-…',
      en: 'Your ticket into Nirvana — the first OASIS world — and the ZION Archive. A unique ZAP-… code arrives after payment.',
    },
    price: '108 Kč',
    bonus: { cs: '+16 200 ZION bonus', en: '+16,200 ZION bonus' },
    cta: { cs: 'Koupit v eShopu', en: 'Buy in the shop' },
    href: PASS_URL,
  },
  {
    image: '/images/news/christmas-2026/card-book.webp',
    icon: BookOpen,
    kicker: { cs: 'Vánoční edice · digitální kniha', en: 'Christmas edition · digital book' },
    title: { cs: 'Království srdce', en: 'Kingdom of the Heart' },
    desc: {
      cs: 'Příběh lodi, kterou postavil tesař. Osm edic v pěti jazycích — 40 knih, 3 252 stran, PDF + EPUB, se ZION Archive Pass v ceně.',
      en: 'The story of the ship a carpenter built. Eight editions in five languages — 40 books, 3,252 pages, PDF + EPUB, ZION Archive Pass included.',
    },
    price: '216 Kč',
    bonus: { cs: '+32 400 ZION bonus', en: '+32,400 ZION bonus' },
    cta: { cs: 'Koupit v eShopu', en: 'Buy in the shop' },
    href: BOOK_URL,
  },
  {
    // Původní scéna s lampionem (tesař s dětmi), ne vánoční trh.
    image: '/images/news/christmas-2026/card-lampion.webp?v=7',
    icon: Flame,
    kicker: { cs: 'Vánoční edice · číslovaná série', en: 'Christmas edition · numbered run' },
    title: { cs: 'Lampion Království srdce', en: 'Kingdom of the Heart lantern' },
    desc: {
      cs: 'Lampion Lumi 2 — šestihranná lucerna vyřezávaná laserem, 20,9 m řezných drah a čtyři hodiny práce na kus. V ceně digitální kniha, ZION Pass a svíčka ve skle.',
      en: 'The Lumi 2 lantern — a hexagonal, laser-cut light with 20.9 m of cutting paths and four hours of work per piece. Digital book, ZION Pass and a candle in glass included.',
    },
    price: '590 Kč',
    bonus: { cs: '+88 500 ZION bonus', en: '+88,500 ZION bonus' },
    cta: { cs: 'Koupit v eShopu', en: 'Buy in the shop' },
    href: LAMP_URL,
  },
];

export default function ChristmasShopCards() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <div className="mt-10">
      <div className="mb-4 flex items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zion-gold/80">
          {cs ? 'Vánoční edice v eShopu' : 'Christmas edition in the shop'}
        </p>
        <span className="h-px flex-1 bg-gradient-to-r from-zion-gold/40 to-transparent" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => {
          const Icon = card.icon;
          const inner = (
            <>
              <div className="relative aspect-[16/8] w-full overflow-hidden">
                <img
                  src={card.image}
                  alt={card.title[cs ? 'cs' : 'en']}
                  loading="lazy"
                  decoding="async"
                  className={`h-full w-full object-cover transition-transform duration-500 ${
                    card.soon ? 'opacity-70' : 'group-hover:scale-[1.04]'
                  }`}
                  style={card.imagePosition ? { objectPosition: card.imagePosition } : undefined}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#070a12] via-transparent to-transparent" />
                <span className="zion-kicker absolute left-3 top-3 border-zion-gold/25 bg-black/55 text-zion-gold backdrop-blur-sm">
                  <Icon className="h-3.5 w-3.5" />
                  {card.kicker[cs ? 'cs' : 'en']}
                </span>
                {card.soon && (
                  // Dole, ne nahoře vpravo: kicker nalevo je dlouhý a štítek se s ním
                  // na třetí kartě překrýval („VÁNOČNÍ EDICE · RUČNÍ VÝR…").
                  <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/80 backdrop-blur-sm">
                    <Lock className="h-3 w-3" />
                    {cs ? 'Připravujeme' : 'Coming soon'}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4 sm:p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-bold text-white">{card.title[cs ? 'cs' : 'en']}</h3>
                  <span className="shrink-0 text-lg font-extrabold text-zion-gold">{card.price}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{card.desc[cs ? 'cs' : 'en']}</p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-zion-gold/25 bg-zion-gold/10 px-2.5 py-1 text-[11px] font-semibold text-zion-gold">
                    <Coins className="h-3.5 w-3.5" />
                    {card.bonus[cs ? 'cs' : 'en']}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                      card.soon ? 'text-white/45' : 'text-zion-gold group-hover:translate-x-0.5'
                    } transition-transform`}
                  >
                    {card.soon ? (
                      card.cta[cs ? 'cs' : 'en']
                    ) : (
                      <>
                        <ShoppingCart className="h-3.5 w-3.5" />
                        {card.cta[cs ? 'cs' : 'en']}
                      </>
                    )}
                  </span>
                </div>
              </div>
            </>
          );
          const cls =
            'group relative flex flex-col overflow-hidden rounded-2xl border bg-[#0a0d16]/80 backdrop-blur-sm transition-colors ' +
            (card.soon
              ? 'border-white/10'
              : 'border-white/10 hover:border-zion-gold/40');
          if (!card.href) {
            return (
              <div key={card.title.en} className={cls} aria-disabled="true">
                {inner}
              </div>
            );
          }
          // Připravované zboží odkaz vede taky — detail produktu vysvětlí,
          // co je v ceně a kdy se prodej otevře.
          return (
            <a key={card.title.en} href={card.href} className={cls}>
              {inner}
            </a>
          );
        })}
      </div>
    </div>
  );
}
