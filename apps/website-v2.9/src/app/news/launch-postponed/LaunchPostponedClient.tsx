'use client';

import Link from 'next/link';
import { ArrowLeft, Calendar, AlertTriangle, Users, Coins, ShieldCheck, Clock, Github, Mail } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const Article = {
  cs: {
    back: 'Zpět na novinky',
    tag: 'Oznámení',
    date: '11. září 2026',
    title: 'Veřejný launch ZION TerraNova se odkládá',
    intro:
      'Přátelé, komunito, podporovatelé. Musíme k vám být upřímní: plánovaný veřejný launch ZION TerraNova je odložen (TBD); neuskuteční se v původně avizované podobě. Toto rozhodnutí nebylo snadné, ale považujeme ho za odpovědné. Projekt ještě není připraven na plnohodnotný veřejný start a my raději pošleme do světa něco, na čem skutečně stojíme, než abychom spěchali kvůli datu v kalendáři.',
    apologyTitle: 'Omlouváme se a děkujeme za trpělivost',
    apologyBody:
      'Víme, že mnozí z vás čekali na otevřenou síť, plnohodnotnou burzovní likviditu a uvedení na CoinGecko. Nestalo se. Důvodem není jedna konkrétní chyba, ale soubor požadavků, které ZION ještě nesplňuje na úrovni, jakou považujeme za nezbytnou pro veřejný launch bez rizika pro uživatele a reputaci projektu. Omlouváme se za zklamání, které to přináší. Zároveň děkujeme každému, kdo do ZION vkládal čas, hashrate, zpětnou vazbu i víru.',
    reasonsTitle: 'Proč se launch odkládá',
    reasons: [
      {
        icon: ShieldCheck,
        title: 'CoinGecko listing neprošel',
        text: 'Náš žádost o listing na CoinGecko nebyla v aktuální fázi schválena. Bez základního tržního trackingu a ověřitelné likvidity není smysluplné oznamovat veřejný start. Nehledáme prodejní cestu; ZION je protokolní token, který se těží, ne prodává. Ale veřejná viditelnost musí být podložená reálnými daty.',
      },
      {
        icon: Users,
        title: 'Projekt potřebuje širší tým',
        text: 'Aktuálně stojí ZION na práci velmi úzkého jádra vývojářů. Pro veřejný launch potřebujeme sestavit tým dobrovolných developerů, kteří pomohou s auditováním kódu, testováním, dokumentací, UI/UX a provozní podporou. Hledáme lidi, pro které je projekt smyslem, ne jen dalším tokenem.',
      },
      {
        icon: AlertTriangle,
        title: 'Ještě neprošel Maturity Gate (Maturitou)',
        text: 'Zavedli jsme interní připravenostní přezkoušení — Maturity Gate, neboli “Maturitu” — které ověřuje, že síť má stabilní konsensus, bezpečný bridge, doloženou emisi, kompletní dokumentaci a dostatečně testované peněženky a miner. Tuto bránou ještě nejsme schopni projít s klidem, že bychom to všechno mohli pustit do veřejného prostoru.',
      },
      {
        icon: Coins,
        title: 'Chybí základní likvidita',
        text: 'Veřejný launch vyžaduje minimální udržitelnou likviditu, aby se ZION mohl směňovat bez extrémní volatility a aby cena byla odvozená od reálného trhu, ne od pár obchodů. Tu v současné době nemáme. Vytvoření základní likvidity je jednou z podmínek, kterou musíme splnit, než budeme schopni stanovit nový termín.',
      },
    ],
    whatNowTitle: 'Co bude dál',
    whatNowBody:
      'Veřejný launch nebyl zrušen — byl odložen. Do té doby zůstává ZION v aktivním vývoji. Spustíme otevřenou výzvu pro dobrovolné vývojáře, pokračujeme v testování, zdokonalujeme explorer, peněženku a bridge, a budeme hledat cesty k získání základní likvidity. Jakmile projdeme Maturity Gate a budeme mít splněné uvedené podmínky, oznámíme nový termín. Do té doby nebudeme uvádět žádné nové pevné datum.',
    volunteerTitle: 'Hledáme dobrovolné vývojáře',
    volunteerBody:
      'Pokud máte zkušenosti s Rust, blockchainem, smart kontrakty, webovým vývojem, testováním, dokumentací nebo DevOps a chcete pomoci ZION dorůst do skutečně veřejného projektu, přidejte se. Hledáme lidi, kteří chtějí spolupracovat na něčem smysluplném, ne honit quick wins. Kontaktujte nás přes GitHub nebo e-mail uvedený níže.',
    contactGithub: 'Zion-TerraNova/v3-Mainnet',
    contactEmail: 'omnity.company@gmail.com',
    closing:
      'Děkujeme za pochopení. ZION nevznikl proto, aby býval první den na burze. Vznikl proto, aby býval dlouhodobě udržitelným, transparentním a komunitním blockchainem. Dáváme si na to čas, který potřebujeme.',
    backToHome: 'Zpět na hlavní stránku',
  },
  en: {
    back: 'Back to news',
    tag: 'Announcement',
    date: '11 September 2026',
    title: 'ZION TerraNova public launch is postponed',
    intro:
      'Friends, community, supporters. We need to be honest with you: the planned public launch of ZION TerraNova is postponed (TBD); it will not happen in the form we announced. This decision was not easy, but we believe it is the responsible one. The project is not yet ready for a full public start, and we would rather deliver something we truly stand behind than rush to meet a date on the calendar.',
    apologyTitle: 'Our apology and thanks for your patience',
    apologyBody:
      'We know that many of you were waiting for the open network, full exchange liquidity, and a CoinGecko listing. It did not happen. The reason is not a single bug, but a set of requirements that ZION has not yet met at the level we consider essential for a public launch without risk to users and to the project’s reputation. We are sorry for the disappointment this brings. At the same time, we thank everyone who has put time, hashrate, feedback, and belief into ZION.',
    reasonsTitle: 'Why the launch is being postponed',
    reasons: [
      {
        icon: ShieldCheck,
        title: 'CoinGecko listing was not approved',
        text: 'Our listing request to CoinGecko was not approved at this stage. Without basic market tracking and verifiable liquidity, announcing a public start does not make sense. We are not looking for a sales path; ZION is a protocol token that is mined, not sold. But public visibility must be backed by real data.',
      },
      {
        icon: Users,
        title: 'The project needs a broader team',
        text: 'ZION currently rests on the work of a very small core of developers. For a public launch we need to build a team of volunteer developers who can help with code auditing, testing, documentation, UI/UX, and operational support. We are looking for people for whom this project is a purpose, not just another token.',
      },
      {
        icon: AlertTriangle,
        title: 'The Maturity Gate has not yet been passed',
        text: 'We have introduced an internal readiness review — the Maturity Gate, or “Maturita” — that verifies the network has stable consensus, a secure bridge, documented emission, complete documentation, and sufficiently tested wallets and miner. We are not yet able to pass this gate with the confidence needed to release everything into the public space.',
      },
      {
        icon: Coins,
        title: 'Basic liquidity is missing',
        text: 'A public launch requires a minimum sustainable liquidity so that ZION can be traded without extreme volatility and so the price is derived from a real market, not a handful of trades. We do not have that right now. Establishing basic liquidity is one of the conditions we must meet before we can set a new date.',
      },
    ],
    whatNowTitle: 'What happens next',
    whatNowBody:
      'The public launch has not been cancelled — it has been postponed. Until then, ZION remains in active development. We will issue an open call for volunteer developers, continue testing, improve the explorer, wallet, and bridge, and look for ways to establish basic liquidity. Once we pass the Maturity Gate and meet the stated conditions, we will announce a new date. Until then, we will not publish any new fixed date.',
    volunteerTitle: 'We are looking for volunteer developers',
    volunteerBody:
      'If you have experience with Rust, blockchain, smart contracts, web development, testing, documentation, or DevOps and want to help ZION grow into a truly public project, join us. We are looking for people who want to work on something meaningful, not chase quick wins. Contact us via GitHub or the email below.',
    contactGithub: 'Zion-TerraNova/v3-Mainnet',
    contactEmail: 'omnity.company@gmail.com',
    closing:
      'Thank you for understanding. ZION was not created to be listed on day one. It was created to be a long-term, transparent, community blockchain. We are giving ourselves the time we need.',
    backToHome: 'Back to homepage',
  },
};

export default function LaunchPostponedClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const t = cs ? Article.cs : Article.en;

  return (
    <div className="min-h-screen pb-24 pt-12 px-4">
      <div className="zion-container max-w-3xl">
        <Link
          href="/news"
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t.back}
        </Link>

        <article className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="text-[10px] tracking-wider uppercase px-2.5 py-1 rounded-full border border-zion-gold/30 bg-zion-gold/10 text-zion-gold">
              {t.tag}
            </span>
            <span className="text-[11px] text-white/40 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {t.date}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
            {t.title}
          </h1>

          <p className="text-base md:text-lg text-gray-300 leading-relaxed mb-8">
            {t.intro}
          </p>

          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-zion-cyan" />
                {t.apologyTitle}
              </h2>
              <p className="text-sm md:text-base text-gray-300 leading-relaxed">
                {t.apologyBody}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-5 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-zion-gold" />
                {t.reasonsTitle}
              </h2>
              <div className="space-y-4">
                {t.reasons.map((reason, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zion-purple/10 border border-zion-purple/20">
                        <reason.icon className="h-5 w-5 text-zion-purple" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white mb-1">{reason.title}</h3>
                        <p className="text-sm text-gray-400 leading-relaxed">{reason.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-zion-cyan" />
                {t.whatNowTitle}
              </h2>
              <p className="text-sm md:text-base text-gray-300 leading-relaxed">
                {t.whatNowBody}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-zion-cyan" />
                {t.volunteerTitle}
              </h2>
              <p className="text-sm md:text-base text-gray-300 leading-relaxed mb-4">
                {t.volunteerBody}
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://github.com/Zion-TerraNova/v3-Mainnet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition"
                >
                  <Github className="h-4 w-4" />
                  {t.contactGithub}
                </a>
                <a
                  href={`mailto:${t.contactEmail}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition"
                >
                  <Mail className="h-4 w-4" />
                  {t.contactEmail}
                </a>
              </div>
            </section>

            <p className="text-sm md:text-base text-gray-300 leading-relaxed border-t border-white/10 pt-6">
              {t.closing}
            </p>
          </div>
        </article>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zion-gold hover:text-white transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t.backToHome}
          </Link>
        </div>
      </div>
    </div>
  );
}
