'use client';

import { Mail, MapPin, Phone, Clock } from 'lucide-react';
import { CONTACT } from '@/data/pages';
import { COMPANY } from '@/lib/company';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import PageHero from '@/components/page-hero';
import ContactForm from '@/components/contact-form';

export default function ContactPage() {
  const { lang } = useLang();

  return (
    <>
      <PageHero kicker={CONTACT.kicker} title={CONTACT.title} lead={CONTACT.lead} compact />

      <section className="container-lumi py-14">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-5">
            <div className="card-warm p-6">
              <ul className="space-y-4 text-sm">
                <li className="flex gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div>
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted">{pick(CONTACT.emailLabel, lang)}</p>
                    <a href={`mailto:${COMPANY.email}`} className="link-underline text-ink">
                      {COMPANY.email}
                    </a>
                  </div>
                </li>
                {COMPANY.phone ? (
                  <li className="flex gap-3">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <div>
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted">{pick(CONTACT.phoneLabel, lang)}</p>
                      <a href={`tel:${COMPANY.phone.replace(/\s/g, '')}`} className="link-underline text-ink">
                        {COMPANY.phone}
                      </a>
                    </div>
                  </li>
                ) : null}
                <li className="flex gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div>
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted">{pick(CONTACT.addressLabel, lang)}</p>
                    <p className="text-ink">
                      {COMPANY.address}
                      <br />
                      {COMPANY.city}
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div>
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted">{pick(CONTACT.hoursLabel, lang)}</p>
                    <p className="text-ink">{pick(CONTACT.hours, lang)}</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-line bg-parchment-deep/60 p-6 text-sm leading-relaxed text-ink-soft">
              {pick(
                {
                  cs: 'Lumi je značka Omnity.One s.r.o. Fakturační údaje najdete v obchodních podmínkách.',
                  en: 'Lumi is a brand of Omnity.One s.r.o. Billing details are in the terms and conditions.',
                  de: 'Lumi ist eine Marke der Omnity.One s.r.o. Rechnungsdaten finden Sie in den AGB.',
                },
                lang,
              )}
            </div>
          </div>

          <div className="card-warm p-6 sm:p-8">
            <h2 className="h3">{pick(CONTACT.formTitle, lang)}</h2>
            <div className="mt-5">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
