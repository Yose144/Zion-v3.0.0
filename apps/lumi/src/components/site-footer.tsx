'use client';

import Link from 'next/link';
import { Mail, MapPin, Truck } from 'lucide-react';
import { SITE } from '@/data/site';
import { COMPANY } from '@/lib/company';
import { pick, type Localized } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';

export default function SiteFooter() {
  const { lang } = useLang();

  return (
    <footer className="mt-24 bg-forest text-parchment">
      <div className="container-lumi py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Link href="/" className="h-display text-2xl font-semibold tracking-[0.14em] text-parchment">
              LUMI
            </Link>
            <p className="mt-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-amber-300/80">
              {pick(SITE.tagline, lang)}
            </p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-parchment/75">{pick(SITE.footer.about, lang)}</p>
            <div className="mt-5 space-y-2 text-sm text-parchment/80">
              <a href={`mailto:${COMPANY.email}`} className="flex items-center gap-2 hover:text-amber-300">
                <Mail className="h-4 w-4 text-amber-400" /> {COMPANY.email}
              </a>
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  Fakturační adresa
                  <br />
                  {COMPANY.address}
                  <br />
                  {COMPANY.city}
                </span>
              </p>
              <p className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-amber-400" />
                {pick({ cs: 'Zásilkovna · osobní odběr', en: 'Zásilkovna · pickup', de: 'Zásilkovna · Abholung' }, lang)}
              </p>
            </div>
          </div>

          {SITE.footer.columns.map((column) => (
            <div key={column.title.cs}>
              <h3 className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-parchment/55">
                {pick(column.title, lang)}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-parchment/80 transition-colors hover:text-amber-300">
                      {pick(link.label, lang)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-parchment/20 pt-6 text-xs text-parchment/55 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {COMPANY.name} · {pick(SITE.footer.rights, lang)}
          </p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>IČO {COMPANY.ico}</span>
            <span>{COMPANY.vatPayer ? `DIČ ${COMPANY.dic}` : pick({ cs: 'Nejsme plátci DPH', en: 'Not VAT registered', de: 'Keine Umsatzsteuer' }, lang)}</span>
            <span>{pick(SITE.footer.madeIn, lang)}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

/** Menší text pro patičku — používá se i v právních stránkách. */
export function LegalHint({ text }: { text: Localized }) {
  const { lang } = useLang();
  return <p className="text-xs leading-relaxed text-muted">{pick(text, lang)}</p>;
}
