'use client';

import Link from 'next/link';
import { FAQ_ITEMS } from '@/data/pages';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import PageHero from '@/components/page-hero';
import FaqAccordion from '@/components/faq-accordion';
import NewsletterForm from '@/components/newsletter-form';

export default function FaqPage() {
  const { lang } = useLang();

  const groups = Array.from(new Set(FAQ_ITEMS.map((item) => item.category.cs))).map((category) => ({
    slug: category,
    label: FAQ_ITEMS.find((item) => item.category.cs === category)!.category,
    items: FAQ_ITEMS.filter((item) => item.category.cs === category),
  }));

  return (
    <>
      <PageHero
        kicker={{ cs: 'Časté otázky', en: 'FAQ', de: 'Häufige Fragen' }}
        title={{ cs: 'Na co se nejčastěji ptáte', en: 'What people ask most', de: 'Was am häufigsten gefragt wird' }}
        lead={{
          cs: 'Od materiálu po dopravu a bezpečnost. Pokud tu odpověď není, napište nám — ozveme se do jednoho pracovního dne.',
          en: 'From material to shipping and safety. If the answer is not here, write to us — we reply within one working day.',
          de: 'Von Material über Versand bis Sicherheit. Wenn die Antwort fehlt, schreiben Sie uns — wir antworten innerhalb eines Werktags.',
        }}
        compact
      >
        <Link href="/kontakt" className="btn-primary">
          {pick({ cs: 'Napsat nám', en: 'Write to us', de: 'Schreiben Sie uns' }, lang)}
        </Link>
      </PageHero>

      <section className="container-lumi py-14">
        <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
          <nav className="hidden lg:block">
            <ul className="space-y-2 border-l border-line pl-4 text-sm">
              {groups.map((group) => (
                <li key={group.slug}>
                  <a href={`#${group.slug}`} className="text-ink-soft hover:text-ink">
                    {pick(group.label, lang)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="space-y-10">
            {groups.map((group) => (
              <section key={group.slug} id={group.slug} className="scroll-mt-28">
                <h2 className="h3 mb-4">{pick(group.label, lang)}</h2>
                <FaqAccordion items={group.items} />
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-parchment-deep/60 py-14">
        <div className="container-lumi grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="h3">{pick({ cs: 'Nové motivy a termíny', en: 'New motifs and dates', de: 'Neue Motive und Termine' }, lang)}</h2>
            <p className="mt-2 max-w-xl text-sm text-ink-soft">
              {pick({ cs: 'Jeden e-mail za sezónu. Nic víc.', en: 'One e-mail per season. Nothing more.', de: 'Eine E-Mail pro Saison. Mehr nicht.' }, lang)}
            </p>
          </div>
          <NewsletterForm source="faq" />
        </div>
      </section>
    </>
  );
}
