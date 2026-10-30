/**
 * Pool announcements — static feed rendered on /announcements and the home
 * ticker. Newest first; keep entries short and dated (unix seconds).
 * Bilingual like the rest of the UI.
 */
export interface Announcement {
  ts: number;
  tag: 'upgrade' | 'maintenance' | 'payout' | 'info';
  cs: { title: string; body: string };
  en: { title: string; body: string };
}

export const ANNOUNCEMENTS: Announcement[] = [
  {
    ts: 1793358000,
    tag: 'upgrade',
    cs: {
      title: 'Historie minerů 7 dní + leaderboards',
      body: 'Hashrate grafy minerů a workerů drží 7 dní (dřív 24 h), nové žebříčky top minerů na /miners a u každého coinu, odhad síťového hashrate a KPI effort na /blocks.',
    },
    en: {
      title: '7-day miner history + leaderboards',
      body: 'Miner and worker hashrate charts now keep 7 days (was 24h), new top-miner leaderboards at /miners and on every coin page, estimated network hashrate and effort KPI on /blocks.',
    },
  },
  {
    ts: 1793300000,
    tag: 'upgrade',
    cs: {
      title: 'Luck & effort telemetrie + config karty',
      body: 'Live effort gauge, rolling luck a kadence bloků na přehledu i statistikách. Nové copy-ready config karty u coinů s TCP/TLS/SOLO přepínačem.',
    },
    en: {
      title: 'Luck & effort telemetry + config cards',
      body: 'Live effort gauge, rolling luck and block cadence on the overview and stats. New copy-ready per-coin config cards with a TCP/TLS/SOLO switch.',
    },
  },
  {
    ts: 1793200000,
    tag: 'info',
    cs: {
      title: 'QTC ticker sjednocen',
      body: 'Quantus se veřejně zobrazuje jako QTC napříč API i UI — interní identifikátor QTU zůstává pro kompatibilitu.',
    },
    en: {
      title: 'QTC ticker unified',
      body: 'Quantus is publicly shown as QTC across the API and UI — the internal QTU identifier remains for compatibility.',
    },
  },
  {
    ts: 1793280000,
    tag: 'payout',
    cs: {
      title: 'QTC výplaty dočasně deferred',
      body: 'Quantus payout treasury čeká na funding — získané odměny se bezpečně parkují v ledgeru a po dofinancování se vyplatí FIFO. ZION i ostatní coiny se vyplácejí normálně.',
    },
    en: {
      title: 'QTC payouts temporarily deferred',
      body: 'The Quantus payout treasury is awaiting funding — earned rewards are safely parked in the ledger and will settle FIFO once funded. ZION and other coins pay out normally.',
    },
  },
];
