'use client';

import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { COOKIES } from '@/data/shop-legal';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import PageHero from '@/components/page-hero';

export default function CookiesPage() {
  const { lang } = useLang();

  return (
    <>
      <PageHero kicker={COOKIES.kicker} title={COOKIES.title} lead={COOKIES.lead} compact />

      <section className="container-lumi py-14">
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <table className="w-full text-sm">
            <thead className="bg-parchment-deep/60 text-left text-[0.65rem] uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-4 py-3">{pick({ cs: 'Název', en: 'Name', de: 'Name' }, lang)}</th>
                <th className="px-4 py-3">{pick({ cs: 'Účel', en: 'Purpose', de: 'Zweck' }, lang)}</th>
                <th className="px-4 py-3">{pick({ cs: 'Typ', en: 'Type', de: 'Typ' }, lang)}</th>
                <th className="px-4 py-3">{pick({ cs: 'Platnost', en: 'Duration', de: 'Dauer' }, lang)}</th>
              </tr>
            </thead>
            <tbody>
              {COOKIES.rows.map((row) => (
                <tr key={row.name} className="border-t border-line">
                  <td className="px-4 py-3 font-mono text-xs text-ink">{row.name}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {pick(row.purpose, lang)}
                    {!row.necessary && (
                      <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                        {pick({ cs: 'jen s kartou', en: 'card only', de: 'nur Karte' }, lang)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{pick(row.type, lang)}</td>
                  <td className="px-4 py-3 text-ink-soft">{pick(row.duration, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-line bg-parchment-deep/60 p-6 text-sm leading-relaxed text-ink-soft">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <p>{pick(COOKIES.note, lang)}</p>
        </div>

        <p className="mt-6 text-sm text-muted">
          {pick({ cs: 'Více o zpracování údajů', en: 'More about data processing', de: 'Mehr zur Datenverarbeitung' }, lang)}:{' '}
          <Link href="/ochrana-osobnich-udaju" className="link-underline text-ink">
            {pick({ cs: 'Ochrana osobních údajů', en: 'Privacy policy', de: 'Datenschutzerklärung' }, lang)}
          </Link>
        </p>
      </section>
    </>
  );
}
