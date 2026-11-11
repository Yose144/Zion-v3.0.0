'use client';

import { useState } from 'react';
import {
  Copy,
  Check,
  ExternalLink,
  Wallet,
  ShieldAlert,
  Ticket,
  BookOpen,
  ShoppingBag,
  Gamepad2,
  Archive,
  Lightbulb,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export interface GiftRevealData {
  orderId: string;
  customerName: string;
  amountZion: number;
  walletAddress: string | null;
  seed: string | null;
  passCode: string | null;
  bookUrl: string | null;
  bonusTxHash: string | null;
}

function CopyBtn({ value, dark }: { value: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard may be unavailable */
        }
      }}
      className={`ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
        dark
          ? 'bg-white/10 text-white/80 hover:bg-white/20'
          : 'bg-rasta-black/10 text-rasta-black hover:bg-rasta-black/20'
      }`}
      title="Kopírovat"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Zkopírováno' : 'Kopírovat'}
    </button>
  );
}

function Card({
  icon,
  title,
  children,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  accent?: 'gold' | 'green' | 'red';
}) {
  const ring =
    accent === 'gold'
      ? 'border-rasta-gold/40'
      : accent === 'green'
        ? 'border-emerald-500/40'
        : accent === 'red'
          ? 'border-red-500/40'
          : 'border-white/10';
  return (
    <section className={`rounded-2xl border ${ring} bg-white/[0.04] backdrop-blur-sm p-5`}>
      <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white/80">
        <span className="text-rasta-gold">{icon}</span>
        {title}
      </h2>
      <div className="mt-3 text-sm text-white/85">{children}</div>
    </section>
  );
}

const ECOSYSTEM = [
  {
    href: 'https://market.zionterranova.com',
    icon: <ShoppingBag size={18} />,
    title: 'ZION Market',
    desc: 'E-shop — lampiony, knihy, ZION Pass',
  },
  {
    href: 'https://nirvana.zionterranova.com',
    icon: <Gamepad2 size={18} />,
    title: 'Nirvana',
    desc: '3D svět Království srdce — sem uplatníš pass',
  },
  {
    href: 'https://app.zionterranova.com/zion-archive',
    icon: <Archive size={18} />,
    title: 'ZION Archiv',
    desc: 'Kanónické texty, Kroniky, edice',
  },
  {
    href: 'https://lumi.zionterranova.com',
    icon: <Lightbulb size={18} />,
    title: 'Lumi',
    desc: 'Dřevěné lampiony ruční výroby',
  },
];

const STEPS = [
  {
    n: '1',
    title: 'Uložte si seed',
    desc: 'Seed phrase je jediný způsob, jak získat plný přístup k ZION na adrese. Napište si ho na papír — nikomu ho neposílejte.',
  },
  {
    n: '2',
    title: 'Uplatněte Archive Pass',
    desc: 'Otevřete nirvana.zionterranova.com (nebo ZION Archiv) a zadejte kód ZAP-… — otevřou se hry, světy a chat Království srdce.',
  },
  {
    n: '3',
    title: 'Prozkoumejte ekosystém',
    desc: 'Kniha Království srdce je ke stažení níže. Peněženku můžete importovat do ZIS a bonus je váš.',
  },
];

export default function GiftReveal({ data }: { data: GiftRevealData }) {
  const amount = data.amountZion.toLocaleString('cs-CZ');
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0d0d0d] text-white">
      {/* Rasta ambient glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-rasta-green/15 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -left-40 h-80 w-80 rounded-full bg-rasta-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-80 w-80 rounded-full bg-red-600/10 blur-3xl" />

      <div className="relative mx-auto max-w-2xl px-4 pb-16 pt-12">
        {/* Hero banner */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/vanoce/hero/kralovstvi-srdce-wide.webp"
            alt="Království srdce"
            className="h-44 w-full object-cover sm:h-56"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d]/55 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-center">
            <div className="text-4xl">🎁</div>
            <h1 className="rasta-text-gradient mt-1 text-3xl font-black tracking-tight sm:text-4xl">
              Váš dárek
            </h1>
            <p className="mt-1 text-sm text-white/75">
              od týmu ZION TerraNova{data.customerName ? ` — pro ${data.customerName}` : ''}
            </p>
          </div>
        </div>

        {/* Amount hero */}
        <div className="mt-8 rounded-3xl border border-rasta-gold/30 bg-gradient-to-br from-rasta-gold/15 via-transparent to-emerald-500/10 p-8 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-rasta-gold">
            Máte na ZION peněžence
          </div>
          <div className="rasta-text-gradient mt-2 text-5xl font-black sm:text-6xl">
            {amount}
          </div>
          <div className="mt-1 text-lg font-bold text-white/80">ZION</div>
          {data.bonusTxHash && (
            <p className="mt-3 font-mono text-[11px] text-white/40 break-all">
              tx {data.bonusTxHash}
            </p>
          )}
        </div>

        <div className="mt-6 space-y-4">
          {/* Wallet */}
          {data.walletAddress && (
            <Card icon={<Wallet size={16} />} title="Peněženka ZION" accent="gold">
              <p className="font-mono text-xs text-white/60 break-all">{data.walletAddress}</p>
              <CopyBtn value={data.walletAddress} dark />
            </Card>
          )}

          {/* Seed */}
          {data.seed && (
            <Card icon={<ShieldAlert size={16} />} title="Seed phrase — uschovejte" accent="red">
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 font-mono text-sm leading-relaxed text-red-100 break-words">
                {data.seed}
              </p>
              <div className="mt-2 flex items-center">
                <CopyBtn value={data.seed} dark />
                <span className="ml-2 text-[11px] text-white/50">
                  12 slov = plný přístup k tokenům. Nikomu je neříkejte.
                </span>
              </div>
            </Card>
          )}

          {/* Pass */}
          {data.passCode && (
            <Card icon={<Ticket size={16} />} title="ZION Archive Pass" accent="green">
              <div className="flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/vanoce/galerie/zion-pass/03_digitalni_darek.webp"
                  alt="ZION Archive Pass"
                  className="hidden h-20 w-32 shrink-0 rounded-lg border border-white/10 object-cover sm:block"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-lg font-black text-rasta-gold">{data.passCode}</p>
                  <p className="mt-1 text-[11px] text-white/55">
                    Digitální průkaz do světa ZION — uplatníte ho v Nirvaně i v Archivu.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <a
                      href="https://app.zionterranova.com/zion-archive"
                      target="_blank"
                      rel="noreferrer"
                      referrerPolicy="no-referrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 hover:text-emerald-200"
                    >
                      Uplatnit v ZION Archivu <ExternalLink size={12} />
                    </a>
                    <span className="text-white/30">·</span>
                    <a
                      href="https://nirvana.zionterranova.com"
                      target="_blank"
                      rel="noreferrer"
                      referrerPolicy="no-referrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 hover:text-emerald-200"
                    >
                      Uplatnit v Nirvaně <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Book */}
          {data.bookUrl && (
            <Card icon={<BookOpen size={16} />} title="Kniha Království srdce" accent="gold">
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/shop/img/books/kralovstvi-srdce-cover.webp"
                  alt="Obálka knihy Království srdce"
                  className="h-24 w-24 shrink-0 rounded-lg border border-rasta-gold/30 object-cover shadow-lg shadow-black/40"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/60">
                    Kompletní edice — PDF + EPUB, 5 jazyků.
                  </p>
                  <a
                    href={data.bookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-rasta-gold to-yellow-400 px-4 py-2 text-xs font-black text-rasta-black hover:opacity-90"
                  >
                    Stáhnout ZIP <ArrowRight size={13} />
                  </a>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Steps */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white/80">
            <Sparkles size={16} className="text-rasta-gold" />
            Co dál?
          </h2>
          <ol className="mt-3 space-y-3">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rasta-gold to-yellow-500 text-xs font-black text-rasta-black">
                  {s.n}
                </span>
                <div>
                  <div className="text-sm font-bold text-white">{s.title}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-white/60">{s.desc}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Ecosystem */}
        <section className="mt-8">
          <h2 className="text-sm font-black uppercase tracking-wider text-white/80">
            Kam vyrazit?
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ECOSYSTEM.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                referrerPolicy="no-referrer"
                className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-rasta-gold/50 hover:bg-white/[0.06]"
              >
                <span className="mt-0.5 text-rasta-gold">{l.icon}</span>
                <span>
                  <span className="flex items-center gap-1 text-sm font-bold text-white group-hover:text-rasta-gold">
                    {l.title}
                    <ExternalLink size={11} className="opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-white/50">
                    {l.desc}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-10 border-t border-white/10 pt-4 text-center">
          <p className="font-mono text-[10px] text-white/35 break-all">
            Objednávka {data.orderId}
            {data.bonusTxHash ? ` · tx ${data.bonusTxHash}` : ''}
          </p>
          <p className="mt-2 text-[11px] text-white/40">
            🌿 Darujeme srdcem — ZION TerraNova
          </p>
        </footer>
      </div>
    </div>
  );
}
