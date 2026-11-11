'use client';

import Link from 'next/link';
import { Accessibility, Mail } from 'lucide-react';
import { COMPANY } from '@/lib/company';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import PageHero from '@/components/page-hero';

const SECTIONS = [
  {
    heading: { cs: 'Závazek', en: 'Commitment', de: 'Verpflichtung' },
    body: {
      cs: 'Chceme, aby web Lumi mohli používat všichni — včetně lidí s omezeným zrakem, sluchem, pohybem nebo kognitivními obtížemi. Snažíme se o soulad s WCAG 2.1 na úrovni AA a s požadavky Evropského aktu o přístupnosti (EAA).',
      en: 'We want the Lumi website to be usable by everyone, including people with visual, hearing, mobility or cognitive impairments. We aim for WCAG 2.1 level AA and the European Accessibility Act (EAA).',
      de: 'Wir möchten, dass die Lumi-Website für alle nutzbar ist — auch für Menschen mit Seh-, Hör-, Mobilitäts- oder kognitiven Einschränkungen. Wir streben WCAG 2.1 Stufe AA und den European Accessibility Act (EAA) an.',
    },
  },
  {
    heading: { cs: 'Co je hotové', en: 'What is in place', de: 'Was bereits umgesetzt ist' },
    body: {
      cs: 'Klávesnicové ovládání, viditelné ohnisko, popisky formulářů, alternativní texty u fotografií, dostatečný kontrast textu, přepínač jazyka, žádné blikající ani automaticky přehrávané prvky. 3D náhled se načítá až po kliknutí a respektuje omezení pohybu v systému.',
      en: 'Keyboard operation, visible focus, form labels, alternative text for photos, sufficient text contrast, a language switcher, no flashing or autoplaying elements. The 3D preview loads only after a click and respects the system reduce-motion setting.',
      de: 'Tastaturbedienung, sichtbarer Fokus, Formularbeschriftungen, Alternativtexte für Fotos, ausreichender Textkontrast, Sprachumschalter, keine blinkenden oder automatisch abspielenden Elemente. Die 3D-Ansicht lädt erst nach einem Klick und respektiert die Systemeinstellung für reduzierte Bewegung.',
    },
  },
  {
    heading: { cs: 'Známá omezení', en: 'Known limitations', de: 'Bekannte Einschränkungen' },
    body: {
      cs: '3D model je doplňkový — všechny podstatné informace jsou i v textu a na fotkách. Některé ilustrační fotografie jsou zatím placeholdery. Pokud narazíte na bariéru, dejte nám vědět; opravíme ji přednostně.',
      en: 'The 3D model is supplementary — all essential information is also in text and photos. Some placeholder photos are illustrative for now. If you find a barrier, let us know; we will fix it as a priority.',
      de: 'Das 3D-Modell ist ergänzend — alle wesentlichen Informationen stehen auch in Text und Fotos. Einige Platzhalterfotos sind vorerst illustrativ. Wenn Sie auf eine Barriere stoßen, sagen Sie uns Bescheid; wir beheben sie vorrangig.',
    },
  },
  {
    heading: { cs: 'Kontakt', en: 'Contact', de: 'Kontakt' },
    body: {
      cs: 'Napište na ahoj@lumi.zionterranova.com s předmětem „Přístupnost“. Odpovídáme do pěti pracovních dnů. Pokud nejsme spokojeni s odpovědí, můžete se obrátit na Veřejného ochránce práv, který agendu přístupnosti zastřešuje.',
      en: 'Write to ahoj@lumi.zionterranova.com with the subject “Accessibility”. We reply within five working days. If you are not satisfied, you can contact the Czech Public Defender of Rights, who oversees accessibility.',
      de: 'Schreiben Sie an ahoj@lumi.zionterranova.com mit dem Betreff „Barrierefreiheit“. Wir antworten innerhalb von fünf Werktagen. Bei Unzufriedenheit können Sie sich an den tschechischen Ombudsmann wenden, der die Barrierefreiheit beaufsichtigt.',
    },
  },
] as const;

export default function AccessibilityPage() {
  const { lang } = useLang();

  return (
    <>
      <PageHero
        kicker={{ cs: 'Přístupnost', en: 'Accessibility', de: 'Barrierefreiheit' }}
        title={{ cs: 'Web, který jde používat', en: 'A website you can use', de: 'Eine Website, die nutzbar ist' }}
        compact
      >
        <a href={`mailto:${COMPANY.email}?subject=Pristupnost`} className="btn-primary">
          <Mail className="h-4 w-4" />
          {pick({ cs: 'Nahlásit bariéru', en: 'Report a barrier', de: 'Barriere melden' }, lang)}
        </a>
      </PageHero>

      <section className="container-lumi py-14">
        <div className="mb-8 flex items-center gap-3 rounded-2xl border border-line bg-card p-5 text-sm text-ink-soft">
          <Accessibility className="h-6 w-6 shrink-0 text-forest" />
          <p>
            {pick(
              {
                cs: 'Prohlášení o přístupnosti · aktualizováno 11. 11. 2026',
                en: 'Accessibility statement · updated 11 November 2026',
                de: 'Erklärung zur Barrierefreiheit · aktualisiert am 11. November 2026',
              },
              lang,
            )}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {SECTIONS.map((section) => (
            <section key={section.heading.cs} className="rounded-2xl border border-line bg-card p-6">
              <h2 className="h3">{pick(section.heading, lang)}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{pick(section.body, lang)}</p>
            </section>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted">
          <Link href="/ochrana-osobnich-udaju" className="link-underline text-ink">
            {pick({ cs: 'Ochrana osobních údajů', en: 'Privacy policy', de: 'Datenschutz' }, lang)}
          </Link>{' '}
          ·{' '}
          <Link href="/obchodni-podminky" className="link-underline text-ink">
            {pick({ cs: 'Obchodní podmínky', en: 'Terms', de: 'AGB' }, lang)}
          </Link>
        </p>
      </section>
    </>
  );
}
