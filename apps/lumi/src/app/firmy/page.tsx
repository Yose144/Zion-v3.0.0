'use client';

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { COMPANIES } from '@/data/pages';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import PageHero from '@/components/page-hero';
import SectionHeading from '@/components/section-heading';
import InquiryForm from '@/components/inquiry-form';

export default function CompaniesPage() {
  const { lang } = useLang();
  return (
    <>
      <PageHero
        kicker={COMPANIES.kicker}
        title={COMPANIES.title}
        lead={COMPANIES.lead}
        image={COMPANIES.image}
        imageAlt={{ cs: 'Dárkové balení lampionu', en: 'Lantern gift wrapping', de: 'Geschenkverpackung der Laterne' }}
      >
        <a href="#poptavka" className="btn-primary">
          {pick({ cs: 'Chci nabídku', en: 'Request a quote', de: 'Angebot anfragen' }, lang)}
          <ArrowRight className="h-4 w-4" />
        </a>
        <Link href="/kolekce/personalizace" className="btn-outline">
          {pick({ cs: 'Personalizace', en: 'Personalisation', de: 'Personalisierung' }, lang)}
        </Link>
      </PageHero>

      <section className="container-lumi py-16">
        <SectionHeading kicker={{ cs: 'Použití', en: 'Use cases', de: 'Einsatz' }} title={COMPANIES.useTitle} lang={lang} />
        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {COMPANIES.useCases.map((item) => (
            <div key={item.title.cs} className="card-warm p-6">
              <h3 className="text-base font-semibold text-ink">{pick(item.title, lang)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{pick(item.text, lang)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-parchment-deep/60 py-16">
        <div className="container-lumi grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading kicker={{ cs: 'Ceny', en: 'Pricing', de: 'Preise' }} title={COMPANIES.volumeTitle} lang={lang} />
            <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-card">
              <table className="w-full text-sm">
                <tbody>
                  {COMPANIES.volumeRows.map((row) => (
                    <tr key={row.range.cs} className="border-b border-line last:border-0">
                      <td className="px-5 py-4 text-ink-soft">{pick(row.range, lang)}</td>
                      <td className="px-5 py-4 text-right font-semibold text-ink">{pick(row.discount, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">{pick(COMPANIES.terms, lang)}</p>
          </div>

          <div>
            <h3 className="h3">{pick({ cs: 'Co umíme vypálit', en: 'What we can burn', de: 'Was wir brennen können' }, lang)}</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-soft">
              {[
                { cs: 'Logo firmy v křivkách (SVG, AI, PDF)', en: 'Company logo in vectors (SVG, AI, PDF)', de: 'Firmenlogo als Vektoren (SVG, AI, PDF)' },
                { cs: 'Jména klientů nebo zaměstnanců', en: 'Client or employee names', de: 'Namen von Kunden oder Mitarbeitern' },
                { cs: 'Datum, výročí nebo krátký vzkaz', en: 'A date, anniversary or short message', de: 'Datum, Jubiläum oder kurze Nachricht' },
                { cs: 'Dárkové balení s ručně psanou kartičkou', en: 'Gift wrapping with a handwritten card', de: 'Geschenkverpackung mit handgeschriebener Karte' },
              ].map((item) => (
                <li key={item.cs} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  {pick(item, lang)}
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl border border-line bg-white/60 p-4 text-sm leading-relaxed text-ink-soft">
              {pick(
                {
                  cs: 'Před výrobou vždy posíláme náhled k odsouhlasení. Zakázku začínáme po potvrzení zálohy.',
                  en: 'We always send a proof before production. We start after the deposit is confirmed.',
                  de: 'Vor der Produktion senden wir immer einen Entwurf zur Freigabe. Wir beginnen nach Bestätigung der Anzahlung.',
                },
                lang,
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="container-lumi py-16" id="poptavka">
        <div className="mx-auto max-w-2xl">
          <SectionHeading
            kicker={{ cs: 'Poptávka', en: 'Enquiry', de: 'Anfrage' }}
            title={{ cs: 'Kolik kusů a kdy?', en: 'How many pieces and when?', de: 'Wie viele Stücke und wann?' }}
            lead={{
              cs: 'Napište nám počet, termín a jestli chcete logo. Ozveme se s cenou a možnostmi vzorku.',
              en: 'Tell us the quantity, date and whether you want a logo. We will reply with a price and sample options.',
              de: 'Nennen Sie uns Stückzahl, Termin und ob Sie ein Logo wünschen. Wir antworten mit Preis und Mustermöglichkeiten.',
            }}
            lang={lang}
            align="center"
          />
          <div className="card-warm mt-8 p-6 sm:p-8">
            <InquiryForm type="firma" compact />
          </div>
        </div>
      </section>
    </>
  );
}
