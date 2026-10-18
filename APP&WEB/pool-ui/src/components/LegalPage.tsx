'use client';

// Shared legal-page shell — Marketplace-style structure, CS/EN via useLang.

import { useLang } from '@/lib/i18n';
import Link from 'next/link';

export const OPERATOR = {
  name: 'Omnity.One s.r.o.',
  ico: '09120050',
  dic: 'CZ09120050',
  address: 'Horní Čermná 229',
  city: '56156',
  country: 'Česká republika',
  email: 'admin@newearth.cz',
};

export default function LegalPage({
  titleCs,
  titleEn,
  subtitleCs,
  subtitleEn,
  children,
}: {
  titleCs: string;
  titleEn: string;
  subtitleCs: string;
  subtitleEn: string;
  children: React.ReactNode;
}) {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-3xl py-12">
      <nav className="mb-6 text-xs text-white/35">
        <Link href="/" className="hover:text-white">
          {t('Přehled', 'Overview')}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-white/60">{t(titleCs, titleEn)}</span>
      </nav>
      <h1 className="gradient-text mb-2 text-3xl font-black tracking-tight">
        {t(titleCs, titleEn)}
      </h1>
      <p className="mb-8 text-sm text-white/50">{t(subtitleCs, subtitleEn)}</p>
      <div className="legal-content card p-6 sm:p-8">{children}</div>
    </div>
  );
}

export function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mb-3 mt-8 text-base font-bold text-rasta-gold first:mt-0">
      {children}
    </h2>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-sm leading-relaxed text-white/65">{children}</p>;
}

export function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mb-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-white/65">
      {children}
    </ul>
  );
}

export function WarnBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-xl border border-rasta-gold/30 bg-rasta-gold/[0.06] px-4 py-3 text-sm text-rasta-gold/90">
      {children}
    </div>
  );
}

export function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-xl border border-rasta-green/30 bg-rasta-green/[0.06] px-4 py-3 text-sm text-white/70">
      {children}
    </div>
  );
}
