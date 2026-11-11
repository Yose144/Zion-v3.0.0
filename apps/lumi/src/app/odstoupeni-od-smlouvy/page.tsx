'use client';

import Link from 'next/link';
import { Mail } from 'lucide-react';
import { WITHDRAWAL } from '@/data/shop-legal';
import { COMPANY } from '@/lib/company';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import PageHero from '@/components/page-hero';

export default function WithdrawalPage() {
  const { lang } = useLang();

  return (
    <>
      <PageHero kicker={WITHDRAWAL.kicker} title={WITHDRAWAL.title} lead={WITHDRAWAL.lead} compact>
        <a href={`mailto:${COMPANY.email}?subject=Odstoupeni%20od%20smlouvy`} className="btn-primary">
          <Mail className="h-4 w-4" />
          {pick({ cs: 'Napsat e-mail', en: 'Send an e-mail', de: 'E-Mail senden' }, lang)}
        </a>
        <Link href="/reklamace" className="btn-outline">
          {pick({ cs: 'Reklamace', en: 'Claims', de: 'Reklamation' }, lang)}
        </Link>
      </PageHero>

      <section className="container-lumi py-14">
        <ol className="grid gap-5 md:grid-cols-3">
          {WITHDRAWAL.steps.map((step, index) => (
            <li key={step.title.cs} className="card-warm p-6">
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-amber-700">0{index + 1}</span>
              <h2 className="mt-2 text-base font-semibold text-ink">{pick(step.title, lang)}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{pick(step.text, lang)}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-2xl border border-rust/25 bg-rust/5 p-6 text-sm leading-relaxed text-ink-soft">
          {pick(WITHDRAWAL.conditions, lang)}
        </div>

        <div className="mt-10">
          <h2 className="h3">{pick(WITHDRAWAL.formTitle, lang)}</h2>
          <p className="mt-2 text-sm text-muted">
            {pick(
              {
                cs: 'Zkopírujte formulář do e-mailu nebo ho vytiskněte a přiložte k zásilce.',
                en: 'Copy the form into an e-mail or print it and enclose it with the parcel.',
                de: 'Kopieren Sie das Formular in eine E-Mail oder drucken Sie es aus und legen Sie es der Sendung bei.',
              },
              lang,
            )}
          </p>
          <pre className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card p-6 text-xs leading-relaxed text-ink-soft">
            {pick(WITHDRAWAL.form, lang)}
          </pre>
        </div>

        <p className="mt-8 text-sm text-muted">
          {pick({ cs: 'Právní základ', en: 'Legal basis', de: 'Rechtsgrundlage' }, lang)}:{' '}
          <Link href="/obchodni-podminky" className="link-underline text-ink">
            {pick({ cs: 'obchodní podmínky', en: 'terms and conditions', de: 'AGB' }, lang)}
          </Link>{' '}
          ·{' '}
          <Link href="/ochrana-osobnich-udaju" className="link-underline text-ink">
            {pick({ cs: 'ochrana údajů', en: 'privacy', de: 'Datenschutz' }, lang)}
          </Link>
        </p>
      </section>
    </>
  );
}
