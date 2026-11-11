'use client';

import Link from 'next/link';
import { SHIPPING_PAGE } from '@/data/pages';
import { COMPANY } from '@/lib/company';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import PageHero from '@/components/page-hero';

export default function ShippingPage() {
  const { lang } = useLang();

  return (
    <>
      <PageHero kicker={SHIPPING_PAGE.kicker} title={SHIPPING_PAGE.title} lead={SHIPPING_PAGE.lead} compact />

      <section className="container-lumi py-14">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="h3">{pick(SHIPPING_PAGE.methodsTitle, lang)}</h2>
            <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-card">
              <table className="w-full text-sm">
                <thead className="bg-parchment-deep/60 text-left text-[0.68rem] uppercase tracking-[0.12em] text-muted">
                  <tr>
                    <th className="px-5 py-3">{pick({ cs: 'Způsob', en: 'Method', de: 'Art' }, lang)}</th>
                    <th className="px-5 py-3">{pick({ cs: 'Cena', en: 'Price', de: 'Preis' }, lang)}</th>
                    <th className="px-5 py-3">{pick({ cs: 'Doba', en: 'Time', de: 'Zeit' }, lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {SHIPPING_PAGE.methods.map((method) => (
                    <tr key={method.name.cs} className="border-t border-line">
                      <td className="px-5 py-4 text-ink">{pick(method.name, lang)}</td>
                      <td className="px-5 py-4 text-ink-soft">{pick(method.price, lang)}</td>
                      <td className="px-5 py-4 text-ink-soft">{pick(method.time, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-muted">{pick(SHIPPING_PAGE.freeNote, lang)}</p>

            <h2 className="h3 mt-10">{pick(SHIPPING_PAGE.returnsTitle, lang)}</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{pick(SHIPPING_PAGE.returnsText, lang)}</p>

            <h2 className="h3 mt-8">{pick(SHIPPING_PAGE.addressTitle, lang)}</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{pick(SHIPPING_PAGE.addressText, lang)}</p>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-line bg-card p-6 text-sm leading-relaxed text-ink-soft">
              <h2 className="text-base font-semibold text-ink">{COMPANY.name}</h2>
              <p className="mt-2">
                {COMPANY.address}
                <br />
                {COMPANY.city}
                <br />
                <a href={`mailto:${COMPANY.email}`} className="link-underline">
                  {COMPANY.email}
                </a>
              </p>
              <p className="mt-3">
                IČO {COMPANY.ico}
                {COMPANY.vatPayer ? ` · DIČ ${COMPANY.dic}` : ' · nejsme plátci DPH'}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-parchment-deep/60 p-6 text-sm leading-relaxed text-ink-soft">
              {pick(
                {
                  cs: 'Balíme do kraftové krabice s papírovou výplní. Žádný plast, žádné vrstvy, které skončí v koši.',
                  en: 'We pack in a kraft box with paper filling. No plastic, no layers that end up in the bin.',
                  de: 'Wir verpacken in einer Kraftbox mit Papierfüllung. Kein Plastik, keine Schichten, die im Müll landen.',
                },
                lang,
              )}
            </div>
            <Link href="/reklamace" className="btn-outline w-full">
              {pick({ cs: 'Reklamace', en: 'Claims', de: 'Reklamation' }, lang)}
            </Link>
          </aside>
        </div>
      </section>
    </>
  );
}
