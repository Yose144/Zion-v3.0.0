'use client';

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { WEDDINGS } from '@/data/pages';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import PageHero from '@/components/page-hero';
import SectionHeading from '@/components/section-heading';
import InquiryForm from '@/components/inquiry-form';
import FaqAccordion from '@/components/faq-accordion';

export default function WeddingsPage() {
  const { lang } = useLang();
  return (
    <>
      <PageHero
        kicker={WEDDINGS.kicker}
        title={WEDDINGS.title}
        lead={WEDDINGS.lead}
        image={WEDDINGS.image.cs}
        imageAlt={{ cs: 'Svatební stůl s rozsvícenými lampiony', en: 'Wedding table with lit lanterns', de: 'Hochzeitstisch mit beleuchteten Laternen' }}
      >
        <a href="#poptavka" className="btn-primary">
          {pick({ cs: 'Chci vzorek a nabídku', en: 'Request a sample and quote', de: 'Muster und Angebot anfragen' }, lang)}
          <ArrowRight className="h-4 w-4" />
        </a>
        <Link href="/pruvodce" className="btn-outline">
          {pick({ cs: 'Jak se skládá', en: 'How to assemble', de: 'Aufbau' }, lang)}
        </Link>
      </PageHero>

      <section className="container-lumi py-16">
        <SectionHeading
          kicker={{ cs: 'Nabídka', en: 'Offer', de: 'Angebot' }}
          title={WEDDINGS.offersTitle}
          lang={lang}
        />
        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {WEDDINGS.offers.map((offer) => (
            <div key={offer.title.cs} className="card-warm p-6">
              <h3 className="h3">{pick(offer.title, lang)}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{pick(offer.text, lang)}</p>
              <p className="mt-4 text-sm font-semibold text-amber-800">{pick(offer.price, lang)}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted">{pick(WEDDINGS.volumeText, lang)}</p>
      </section>

      <section className="border-y border-line bg-parchment-deep/60 py-16">
        <div className="container-lumi">
          <SectionHeading kicker={{ cs: 'Postup', en: 'Process', de: 'Ablauf' }} title={WEDDINGS.processTitle} lang={lang} />
          <ol className="mt-9 grid gap-6 md:grid-cols-4">
            {WEDDINGS.process.map((step, index) => (
              <li key={step.title.cs} className="border-t border-amber-600/40 pt-4">
                <span className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-amber-700">0{index + 1}</span>
                <h3 className="mt-2 text-base font-semibold text-ink">{pick(step.title, lang)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{pick(step.text, lang)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-lumi py-16" id="poptavka">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionHeading
              kicker={{ cs: 'Poptávka', en: 'Enquiry', de: 'Anfrage' }}
              title={{ cs: 'Napište nám termín a počet stolů', en: 'Tell us the date and the number of tables', de: 'Nennen Sie uns Termin und Tischanzahl' }}
              lead={{
                cs: 'Ozveme se do jednoho pracovního dne s návrhem sady, cenou a možnostmi personalizace. Vzorek posíláme po domluvě.',
                en: 'We will get back to you within one working day with a set proposal, price and personalisation options. We send samples by arrangement.',
                de: 'Wir melden uns innerhalb eines Werktags mit einem Setvorschlag, Preis und Personalisierungsoptionen. Muster senden wir nach Absprache.',
              }}
              lang={lang}
            />
            <ul className="mt-6 space-y-2 text-sm text-ink-soft">
              {[
                { cs: 'Vzorek na vyzkoušení do vaší výzdoby', en: 'A sample to try in your own setting', de: 'Ein Muster für Ihre eigene Dekoration' },
                { cs: 'Množstevní ceny od 10 kusů', en: 'Volume pricing from 10 pieces', de: 'Staffelpreise ab 10 Stück' },
                { cs: 'Jména, datum nebo logo ve dřevě', en: 'Names, a date or a logo in wood', de: 'Namen, Datum oder Logo im Holz' },
                { cs: 'Záloha 50 %, potvrzený termín', en: '50% deposit, confirmed date', de: '50 % Anzahlung, bestätigter Termin' },
              ].map((item) => (
                <li key={item.cs} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  {pick(item, lang)}
                </li>
              ))}
            </ul>
          </div>
          <div className="card-warm p-6 sm:p-8">
            <h2 className="h3">{pick({ cs: 'Poptávka pro svatbu', en: 'Wedding enquiry', de: 'Hochzeitsanfrage' }, lang)}</h2>
            <div className="mt-5">
              <InquiryForm type="svatba" compact />
            </div>
          </div>
        </div>
      </section>

      <section className="container-lumi pb-20">
        <SectionHeading kicker={{ cs: 'Otázky', en: 'Questions', de: 'Fragen' }} title={WEDDINGS.faqTitle} lang={lang} />
        <div className="mt-6">
          <FaqAccordion items={WEDDINGS.faq} />
        </div>
      </section>
    </>
  );
}
