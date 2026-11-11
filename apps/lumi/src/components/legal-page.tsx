'use client';

import Link from 'next/link';
import type { LegalDoc } from '@/data/legal';
import { COMPANY } from '@/lib/company';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import PageHero from '@/components/page-hero';

export default function LegalPage({ doc }: { doc: LegalDoc }) {
  const { lang } = useLang();
  return (
    <>
      <PageHero kicker={doc.kicker} title={doc.title} compact />
      <section className="container-lumi py-12">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <aside className="space-y-4 text-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">
              {pick({ cs: 'Aktualizováno', en: 'Updated', de: 'Aktualisiert' }, lang)}: {doc.updated}
            </p>
            {doc.note ? <p className="leading-relaxed text-ink-soft">{pick(doc.note, lang)}</p> : null}
            <div className="rounded-xl border border-line bg-white/60 p-4 text-xs leading-relaxed text-muted">
              {COMPANY.name}
              <br />
              {COMPANY.address}, {COMPANY.city}
              <br />
              IČO {COMPANY.ico}
              {COMPANY.vatPayer ? ` · DIČ ${COMPANY.dic}` : pick({ cs: ' · nejsme plátci DPH', en: ' · not VAT registered', de: ' · keine Umsatzsteuer' }, lang)}
              <br />
              <a href={`mailto:${COMPANY.email}`} className="link-underline">
                {COMPANY.email}
              </a>
            </div>
            <nav className="space-y-1.5 border-l border-line pl-4 text-xs">
              <Link href="/nakupni-rad" className="block text-ink-soft hover:text-ink">
                {pick({ cs: 'Jak nakupovat', en: 'How to order', de: 'So bestellen' }, lang)}
              </Link>
              <Link href="/obchodni-podminky" className="block text-ink-soft hover:text-ink">
                {pick({ cs: 'Obchodní podmínky', en: 'Terms', de: 'AGB' }, lang)}
              </Link>
              <Link href="/ochrana-osobnich-udaju" className="block text-ink-soft hover:text-ink">
                {pick({ cs: 'Ochrana údajů', en: 'Privacy', de: 'Datenschutz' }, lang)}
              </Link>
              <Link href="/cookies" className="block text-ink-soft hover:text-ink">
                Cookies
              </Link>
              <Link href="/odstoupeni-od-smlouvy" className="block text-ink-soft hover:text-ink">
                {pick({ cs: 'Odstoupení od smlouvy', en: 'Withdrawal', de: 'Widerruf' }, lang)}
              </Link>
              <Link href="/bezpecnost-produktu" className="block text-ink-soft hover:text-ink">
                {pick({ cs: 'Bezpečnost produktu', en: 'Product safety', de: 'Produktsicherheit' }, lang)}
              </Link>
              <Link href="/reklamace" className="block text-ink-soft hover:text-ink">
                {pick({ cs: 'Reklamace', en: 'Claims', de: 'Reklamation' }, lang)}
              </Link>
              <Link href="/doprava" className="block text-ink-soft hover:text-ink">
                {pick({ cs: 'Doprava', en: 'Shipping', de: 'Versand' }, lang)}
              </Link>
              <Link href="/pristupnost" className="block text-ink-soft hover:text-ink">
                {pick({ cs: 'Přístupnost', en: 'Accessibility', de: 'Barrierefreiheit' }, lang)}
              </Link>
            </nav>
          </aside>

          <div className="prose-lumi max-w-2xl">
            {doc.sections.map((section) => (
              <section key={section.heading.cs}>
                <h2>{pick(section.heading, lang)}</h2>
                <p>{pick(section.body, lang)}</p>
              </section>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
