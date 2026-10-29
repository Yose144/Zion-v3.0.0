'use client';

import { HelpCircle } from 'lucide-react';
import { useLang } from '@/lib/i18n';

const QA: { cs: [string, string]; en: [string, string] }[] = [
  {
    cs: [
      'Musím mít účet, abych těžil?',
      'Ne. Pool je anonymous — stačí payout adresa ve formátu <wallet>.<worker> a heslo "x". Pokud chcete sdílené stats a auto-resolved payout adresy napříč coiny, použijte ZIS token jako heslo ("zis_<token>").',
    ],
    en: [
      'Do I need an account to mine?',
      'No. The pool is anonymous — just a payout address as <wallet>.<worker> and password "x". For shared stats and auto-resolved payout addresses across coins, use your ZIS token as the password ("zis_<token>").',
    ],
  },
  {
    cs: [
      'V jakém coinu dostanu výplatu?',
      'Vždy v coinu, který těžíte — žádná auto-konverze. ZION jde on-chain automaticky. PRL se vyplácí dávkami po dosažení minima (když je sweeper aktivní). QTC výplaty jsou dočasně pozastavené (deferred), dokud nebude funded payout treasury — ledger je zachován, žádný write-off. Detail: dokument QTC payout policy.',
    ],
    en: [
      'What coin am I paid in?',
      'Always the coin you mined — no auto-conversion. ZION pays on-chain automatically. PRL pays in batches once the minimum is reached (when the sweeper is live). QTC payouts are temporarily deferred until the payout treasury is funded — the ledger is retained; no silent write-off. See the QTC payout policy.',
    ],
  },
  {
    cs: [
      'Proč jsou QTC výplaty deferred?',
      'Hot treasury pro Quantus výplaty má aktuálně free balance 0. Sweeper řádky bezpečně parkne (deferred), aby neplýtval attempts na InsufficientFunds. Po funding se FIFO vyplatí. Politika: docs/3.2/QTC_PAYOUT_POLICY.md (veřejné prohlášení 2026-10-29).',
    ],
    en: [
      'Why are QTC payouts deferred?',
      'The Quantus payout hot treasury currently has free balance 0. The sweeper parks rows as deferred so it does not burn attempts on InsufficientFunds. After funding, rows settle FIFO. Policy: docs/3.2/QTC_PAYOUT_POLICY.md (public statement 2026-10-29).',
    ],
  },
  {
    cs: [
      'Jak funguje PPLNS?',
      'Odměna za blok se rozděluje podle sharů v posledním měřeném okně (podle obtížnosti, ne počtu). Dlouhodobí mineři mají férovější výplatu než pool-hoppeři.',
    ],
    en: [
      'How does PPLNS work?',
      'Each block reward is split across shares in the last difficulty-weighted window (difficulty, not count). Loyal miners earn fairly; pool-hoppers don\'t benefit.',
    ],
  },
  {
    cs: [
      'Jak se dělí odměna za blok a jaký je pool fee?',
      'Každý nalezený blok se podle protokolu dělí: 89 % mineři (PPLNS podle sharů) · 5 % humanitární fond · 5 % Issobella · 1 % pool fee. Split provádí coinbase uzlu, pool jen redistribuuje minerskou část. Aktuální hodnoty vidíte na stránce Statistiky a v /public/v1/coins.',
    ],
    en: [
      'How is the block reward split and what is the pool fee?',
      'Every found block is split by protocol: 89% miners (PPLNS by shares) · 5% humanitarian fund · 5% Issobella · 1% pool fee. The node coinbase performs the split; the pool only redistributes the miner share. Live values are on the Stats page and in /public/v1/coins.',
    ],
  },
  {
    cs: [
      'Můžu těžit sólo (winner-take-all)?',
      'Ano — dedikovaný SOLO port :8446. Kdo najde blok, bere celou 89% minerskou část sám; shary ze SOLO portu se nepočítají do PPLNS okna. Normální pool těžba zůstává na :8444/:8445.',
    ],
    en: [
      'Can I mine solo (winner-take-all)?',
      'Yes — dedicated SOLO port :8446. Whoever finds a block takes the whole 89% miner share alone; SOLO-port shares do not count toward the PPLNS window. Regular pool mining stays on :8444/:8445.',
    ],
  },
  {
    cs: [
      'Co je vardiff a proč se mi mění obtížnost?',
      'Pool dynamicky nastavuje share obtížnost podle vašeho hashratu — slabší rig submituje méně často, silnější častěji. Cíl je ~1 submit / 10–30 s. Nemění to vaši odměnu.',
    ],
    en: [
      'What is vardiff and why does my difficulty change?',
      'The pool tunes share difficulty to your hashrate — weaker rigs submit less often, stronger rigs more often. Target is ~1 submit / 10–30s. It does not change your reward.',
    ],
  },
  {
    cs: [
      'Proč je můj reject rate nenulový?',
      'Pár procent je normální (stale shares po novém jobu). Nad ~3 % zkontrolujte overclock, stabilitu sítě a správný algoritmus — rejected shary se neplatí.',
    ],
    en: [
      'Why is my reject rate non-zero?',
      'A few percent is normal (stale shares after a new job). Above ~3%, check your overclock, network stability and the correct algorithm — rejected shares are not paid.',
    ],
  },
  {
    cs: [
      'Podporujete TLS?',
      'Ano — každý coin má plain i TLS port (viz tabulka v návodu). TLS doporučujeme zejména pro větší rigy.',
    ],
    en: [
      'Do you support TLS?',
      'Yes — every coin has a plain and a TLS port (see the guide table). TLS is recommended for larger rigs.',
    ],
  },
  {
    cs: [
      'Jaký HW potřebuju pro PRL?',
      'Pearl PoUW je GPU-only: NVIDIA SM75+ (Turing a novější) nebo AMD RDNA+. Pascal (GTX 10xx) zatím není podporovaný.',
    ],
    en: [
      'What hardware do I need for PRL?',
      'Pearl PoUW is GPU-only: NVIDIA SM75+ (Turing and newer) or AMD RDNA+. Pascal (GTX 10xx) is not currently supported.',
    ],
  },
];

export default function FaqPage() {
  const { t, lang } = useLang();
  return (
    <div className="pt-8">
      <header className="page-hero">
        <p className="rasta-hero-kicker">
          <HelpCircle size={12} /> FAQ
        </p>
        <h1>{t('Časté otázky', 'Frequently asked questions')}</h1>
        <p className="page-hero-sub">
          {t(
            'Stratum porty, výplatní model, coiny a podpora — vše na jednom místě.',
            'Stratum ports, payout model, coins and support — everything in one place.',
          )}
        </p>
      </header>
      <div className="mt-8 flex flex-col gap-4">
        {QA.map((q, i) => (
          <details key={i} className="pool-card group cursor-pointer">
            <summary className="list-none text-sm font-bold text-white marker:hidden">
              <span className="mr-2 text-zion-gold">›</span>
              {lang === 'cs' ? q.cs[0] : q.en[0]}
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              {lang === 'cs' ? q.cs[1] : q.en[1]}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}
