'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLangT } from '@/lib/useTranslation';

interface BalanceRow {
  accountCode: string;
  name: string;
  cls: number;
  mdHal: number;
  dalHal: number;
  balanceHal: number;
}

interface LedgerLine {
  id: string;
  accountCode: string;
  side: 'MD' | 'DAL';
  amountHal: number;
}

interface LedgerEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  documentRef: string | null;
  sourceType: string | null;
  period: number;
  lines: LedgerLine[];
}

interface Account {
  code: string;
  name: string;
  class: number;
}

interface GeneralLedgerLine {
  entryId: string;
  entryNumber: string;
  date: string;
  description: string;
  documentRef: string | null;
  sourceType: string | null;
  side: 'MD' | 'DAL';
  amountHal: number;
  balanceHal: number;
}

interface GeneralLedger {
  accountCode: string;
  name: string;
  cls: number;
  period: number;
  openingHal: number;
  mdHal: number;
  dalHal: number;
  closingHal: number;
  lines: GeneralLedgerLine[];
}

interface InventoryRow {
  accountCode: string;
  name: string;
  cls: number;
  kind: 'asset' | 'liability' | 'equity';
  balanceHal: number;
}

interface Inventory {
  period: number;
  rows: InventoryRow[];
  assetsHal: number;
  liabilitiesHal: number;
  equityHal: number;
  profitHal: number;
  controlDiffHal: number;
  mdTotalHal: number;
  dalTotalHal: number;
  balanced: boolean;
}

interface DocumentRow {
  entryId: string;
  entryNumber: string;
  date: string;
  description: string;
  documentRef: string | null;
  sourceType: string;
  totalHal: number;
  orderId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
}

interface Documents {
  period: number;
  rows: DocumentRow[];
  unposted: { invoices: number; paidOrders: number };
}

type Tab = 'balance' | 'journal' | 'ledger' | 'inventory' | 'documents';

function fmt(amountHal: number): string {
  const sign = amountHal < 0 ? '−' : '';
  const abs = Math.abs(amountHal);
  return `${sign}${Math.floor(abs / 100).toLocaleString('cs-CZ')},${String(abs % 100).padStart(2, '0')}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('cs-CZ');
}

export default function AdminAccountingPage() {
  const { t } = useLangT();
  const [period, setPeriod] = useState(new Date().getFullYear());
  const [tab, setTab] = useState<Tab>('balance');
  const [reloadKey, setReloadKey] = useState(0);

  const [balance, setBalance] = useState<{
    rows: BalanceRow[];
    balanced: boolean;
    mdTotalHal: number;
    dalTotalHal: number;
  } | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [ledgerAccount, setLedgerAccount] = useState('221');
  const [ledger, setLedger] = useState<GeneralLedger | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [documents, setDocuments] = useState<Documents | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>('');

  // formulář manuálního dokladu
  const [mDate, setMDate] = useState(new Date().toISOString().slice(0, 10));
  const [mDesc, setMDesc] = useState('');
  const [mRef, setMRef] = useState('');
  const [mLines, setMLines] = useState([
    { accountCode: '221', side: 'MD' as const, czk: '' },
    { accountCode: '518', side: 'DAL' as const, czk: '' },
  ]);

  const loadCore = useCallback(() => {
    return Promise.all([
      fetch(`/api/admin/accounting/balance?period=${period}`).then((r) => r.json()),
      fetch(`/api/admin/accounting/entries?period=${period}&limit=200`).then((r) => r.json()),
      fetch('/api/admin/accounting/accounts').then((r) => r.json()),
    ]).then(([b, e, a]) => {
      if (b?.data) setBalance(b.data);
      if (e?.data) setEntries(e.data);
      if (a?.data) setAccounts(a.data);
    });
  }, [period]);

  useEffect(() => {
    loadCore().catch(console.error);
  }, [loadCore, reloadKey]);

  useEffect(() => {
    if (tab === 'ledger') {
      fetch(`/api/admin/accounting/ledger?period=${period}&account=${encodeURIComponent(ledgerAccount)}`)
        .then((r) => r.json())
        .then((res) => setLedger(res?.data ?? null))
        .catch(console.error);
    } else if (tab === 'inventory') {
      fetch(`/api/admin/accounting/inventory?period=${period}`)
        .then((r) => r.json())
        .then((res) => setInventory(res?.data ?? null))
        .catch(console.error);
    } else if (tab === 'documents') {
      fetch(`/api/admin/accounting/documents?period=${period}`)
        .then((r) => r.json())
        .then((res) => setDocuments(res?.data ?? null))
        .catch(console.error);
    }
  }, [tab, period, ledgerAccount, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const seed = async () => {
    setBusy('seed');
    const res = await fetch('/api/admin/accounting/accounts', { method: 'POST' }).then((r) => r.json());
    setMsg(res?.success ? t('admin.accSeedOk', { n: res.data?.upserted ?? 0 }) : t('admin.accSeedFail'));
    setBusy(null);
    reload();
  };

  const sync = async () => {
    setBusy('sync');
    const res = await fetch('/api/admin/accounting/sync', { method: 'POST' }).then((r) => r.json());
    if (res?.data) {
      const d = res.data;
      setMsg(t('admin.accSyncOk', { i: d.invoicesPosted, p: d.paymentsPosted, s: d.stornosPosted, k: d.skipped, e: d.errors.length }));
    } else {
      setMsg(res?.error ?? t('admin.accSyncFail'));
    }
    setBusy(null);
    reload();
  };

  const setLine = (i: number, patch: Partial<{ accountCode: string; side: 'MD' | 'DAL'; czk: string }>) =>
    setMLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submitEntry = async () => {
    setBusy('entry');
    const res = await fetch('/api/admin/accounting/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        date: mDate,
        description: mDesc,
        documentRef: mRef || null,
        lines: mLines.filter((l) => l.czk.trim()).map((l) => ({
          accountCode: l.accountCode.trim(),
          side: l.side,
          amountHal: Math.round(parseFloat(l.czk.replace(',', '.')) * 100),
        })),
      }),
    }).then((r) => r.json());
    if (res?.success) {
      setMsg(t('admin.accEntryOk', { n: res.data?.entry?.entryNumber ?? '' }));
      setMDesc(''); setMRef('');
      setMLines([
        { accountCode: '221', side: 'MD', czk: '' },
        { accountCode: '518', side: 'DAL', czk: '' },
      ]);
    } else {
      setMsg(res?.error ?? t('admin.accEntryFail'));
    }
    setBusy(null);
    reload();
  };

  const tabClass = (active: boolean) =>
    `px-4 py-3 text-sm font-semibold border-b-2 transition ${active ? 'border-rasta-gold text-rasta-gold' : 'border-transparent text-gray-400 hover:text-white'}`;

  const exportUrl = (type: 'journal' | 'ledger' | 'inventory', account?: string) =>
    `/api/admin/accounting/export?type=${type}&period=${period}${account ? `&account=${encodeURIComponent(account)}` : ''}`;

  const kindLabel = (kind: InventoryRow['kind']) =>
    kind === 'asset'
      ? t('admin.accKindAsset')
      : kind === 'liability'
        ? t('admin.accKindLiability')
        : t('admin.accKindEquity');

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-black text-gradient">{t('admin.accountingTitle')}</h1>
        <div className="flex items-center gap-2 text-sm">
          <select
            value={period}
            onChange={(e) => setPeriod(parseInt(e.target.value, 10))}
            className="bg-white/5 border border-white/10 rounded-md px-2 py-1.5"
          >
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={seed} disabled={busy === 'seed'} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-50">
            {t('admin.accSeed')}
          </button>
          <button onClick={sync} disabled={busy === 'sync'} className="px-3 py-1.5 rounded-lg bg-rasta-gold/20 text-rasta-gold hover:bg-rasta-gold/30 disabled:opacity-50 font-semibold">
            {busy === 'sync' ? t('admin.loading') : t('admin.accSync')}
          </button>
        </div>
      </div>

      {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">{msg}</div>}

      {/* Taby */}
      <div className="flex gap-1 mb-4 border-b border-white/10 flex-wrap">
        <button onClick={() => setTab('balance')} className={tabClass(tab === 'balance')}>
          {t('admin.accTabBalance')}
        </button>
        <button onClick={() => setTab('journal')} className={tabClass(tab === 'journal')}>
          {t('admin.accTabJournal')}
        </button>
        <button onClick={() => setTab('ledger')} className={tabClass(tab === 'ledger')}>
          {t('admin.accTabLedger')}
        </button>
        <button onClick={() => setTab('inventory')} className={tabClass(tab === 'inventory')}>
          {t('admin.accTabInventory')}
        </button>
        <button onClick={() => setTab('documents')} className={tabClass(tab === 'documents')}>
          {t('admin.accTabDocuments')}
        </button>
        <div className="flex-1" />
        <a
          href={exportUrl(tab === 'ledger' ? 'ledger' : tab === 'inventory' ? 'inventory' : 'journal', tab === 'ledger' ? ledgerAccount : undefined)}
          className="px-3 py-3 text-xs text-gray-400 hover:text-rasta-gold transition"
          title={t('admin.accExportHint')}
        >
          📄 {t('admin.accExportCsv')}
        </a>
      </div>

      {/* ── Obratová předvaha ── */}
      {tab === 'balance' && (
        <>
          <h2 className="text-lg font-bold mb-2 text-gray-300">{t('admin.accBalanceTitle', { y: period })}</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-zion-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-gray-400">
                  <th className="p-3">{t('admin.accCode')}</th>
                  <th className="p-3">{t('admin.accName')}</th>
                  <th className="p-3 text-right">MD</th>
                  <th className="p-3 text-right">DAL</th>
                  <th className="p-3 text-right">{t('admin.accBalance')}</th>
                </tr>
              </thead>
              <tbody>
                {(balance?.rows ?? []).map((r) => (
                  <tr key={r.accountCode} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 font-mono text-rasta-gold">{r.accountCode}</td>
                    <td className="p-3">{r.name}</td>
                    <td className="p-3 text-right font-mono">{fmt(r.mdHal)}</td>
                    <td className="p-3 text-right font-mono">{fmt(r.dalHal)}</td>
                    <td className={`p-3 text-right font-mono ${r.balanceHal < 0 ? 'text-red-400' : 'text-green-400'}`}>{fmt(r.balanceHal)}</td>
                  </tr>
                ))}
                {balance && balance.rows.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-gray-500">{t('admin.accNoEntries')}</td></tr>
                )}
              </tbody>
              {balance && balance.rows.length > 0 && (
                <tfoot>
                  <tr className="border-t border-white/10 font-bold">
                    <td className="p-3" colSpan={2}>{t('admin.accTotals')}</td>
                    <td className="p-3 text-right font-mono">{fmt(balance.mdTotalHal)}</td>
                    <td className="p-3 text-right font-mono">{fmt(balance.dalTotalHal)}</td>
                    <td className={`p-3 text-right font-mono ${balance.balanced ? 'text-green-400' : 'text-red-400'}`}>
                      {balance.balanced ? '✓ MD=DAL' : '✗ ' + fmt(balance.mdTotalHal - balance.dalTotalHal)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {/* ── Deník + manuální doklad ── */}
      {tab === 'journal' && (
        <>
          <h2 className="text-lg font-bold mb-2 text-gray-300">{t('admin.accManualTitle')}</h2>
          <div className="rounded-xl border border-white/10 bg-zion-card p-4 mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
              <input value={mDesc} onChange={(e) => setMDesc(e.target.value)} placeholder={t('admin.accDescPh')} className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
              <input value={mRef} onChange={(e) => setMRef(e.target.value)} placeholder={t('admin.accRefPh')} className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
            </div>
            {mLines.map((l, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 mb-2">
                <select value={l.accountCode} onChange={(e) => setLine(i, { accountCode: e.target.value })} className="bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm font-mono">
                  {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
                </select>
                <select value={l.side} onChange={(e) => setLine(i, { side: e.target.value as 'MD' | 'DAL' })} className="bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm">
                  <option value="MD">MD</option>
                  <option value="DAL">DAL</option>
                </select>
                <input value={l.czk} onChange={(e) => setLine(i, { czk: e.target.value })} placeholder="0,00" className="bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-sm w-32 font-mono" />
                {mLines.length > 2 && (
                  <button onClick={() => setMLines((ls) => ls.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300 text-sm">✕</button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => setMLines((ls) => [...ls, { accountCode: '518', side: 'DAL', czk: '' }])} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm">
                {t('admin.accAddLine')}
              </button>
              <button onClick={submitEntry} disabled={busy === 'entry' || !mDesc.trim()} className="px-4 py-1.5 rounded-lg bg-rasta-green/20 text-green-400 hover:bg-rasta-green/30 font-semibold text-sm disabled:opacity-50">
                {busy === 'entry' ? t('admin.loading') : t('admin.accPost')}
              </button>
            </div>
          </div>

          <h2 className="text-lg font-bold mb-2 text-gray-300">{t('admin.accJournalTitle', { y: period })}</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-zion-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-gray-400">
                  <th className="p-3">{t('admin.accEntryNo')}</th>
                  <th className="p-3">{t('admin.accDate')}</th>
                  <th className="p-3">{t('admin.accDesc')}</th>
                  <th className="p-3">{t('admin.accDocRef')}</th>
                  <th className="p-3">{t('admin.accSource')}</th>
                  <th className="p-3 text-right">{t('admin.accLines')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-white/5 hover:bg-white/5 align-top">
                    <td className="p-3 font-mono text-rasta-gold whitespace-nowrap">{e.entryNumber}</td>
                    <td className="p-3 whitespace-nowrap">{fmtDate(e.date)}</td>
                    <td className="p-3">{e.description}</td>
                    <td className="p-3 font-mono text-xs">{e.documentRef ?? '—'}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded text-xs bg-white/10">{e.sourceType ?? 'manual'}</span></td>
                    <td className="p-3 font-mono text-xs text-right whitespace-nowrap">
                      {e.lines.map((l) => (
                        <div key={l.id}>{l.accountCode} {l.side === 'MD' ? 'MD' : 'DAL'} {fmt(l.amountHal)}</div>
                      ))}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-gray-500">{t('admin.accNoEntries')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Hlavní kniha ── */}
      {tab === 'ledger' && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <label className="text-sm text-gray-400">{t('admin.accLedgerAccount')}:</label>
            <select
              value={ledgerAccount}
              onChange={(e) => setLedgerAccount(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm font-mono"
            >
              {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
            </select>
            <a
              href={exportUrl('ledger', ledgerAccount)}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs"
            >
              📄 {t('admin.accExportCsv')}
            </a>
          </div>

          <h2 className="text-lg font-bold mb-2 text-gray-300">
            {t('admin.accLedgerTitle', { acc: ledger ? `${ledger.accountCode} ${ledger.name}` : ledgerAccount, y: period })}
          </h2>

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-zion-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-gray-400">
                  <th className="p-3">{t('admin.accEntryNo')}</th>
                  <th className="p-3">{t('admin.accDate')}</th>
                  <th className="p-3">{t('admin.accDesc')}</th>
                  <th className="p-3">{t('admin.accDocRef')}</th>
                  <th className="p-3 text-right">{t('admin.accAmount')}</th>
                  <th className="p-3 text-right">{t('admin.accRunning')}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/10 bg-white/5 font-semibold">
                  <td className="p-3" colSpan={4}>{t('admin.accOpening', { y: period })}</td>
                  <td className="p-3 text-right font-mono">—</td>
                  <td className={`p-3 text-right font-mono ${(ledger?.openingHal ?? 0) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {fmt(ledger?.openingHal ?? 0)}
                  </td>
                </tr>
                {(ledger?.lines ?? []).map((l) => (
                  <tr key={`${l.entryId}-${l.side}-${l.amountHal}-${l.entryNumber}`} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 font-mono text-rasta-gold whitespace-nowrap">{l.entryNumber}</td>
                    <td className="p-3 whitespace-nowrap">{fmtDate(l.date)}</td>
                    <td className="p-3">{l.description}</td>
                    <td className="p-3 font-mono text-xs">{l.documentRef ?? '—'}</td>
                    <td className="p-3 text-right font-mono whitespace-nowrap">
                      {l.side === 'MD' ? '+' : '−'}{fmt(l.amountHal)}
                    </td>
                    <td className={`p-3 text-right font-mono ${l.balanceHal < 0 ? 'text-red-400' : 'text-green-400'}`}>{fmt(l.balanceHal)}</td>
                  </tr>
                ))}
                {ledger && ledger.lines.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-gray-500">{t('admin.accNoEntries')}</td></tr>
                )}
              </tbody>
              {ledger && (
                <tfoot>
                  <tr className="border-t border-white/10">
                    <td className="p-3" colSpan={4}>{t('admin.accTotals')}</td>
                    <td className="p-3 text-right font-mono whitespace-nowrap">
                      MD {fmt(ledger.mdHal)} / DAL {fmt(ledger.dalHal)}
                    </td>
                    <td className={`p-3 text-right font-mono font-bold ${ledger.closingHal < 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {fmt(ledger.closingHal)}
                    </td>
                  </tr>
                  <tr className="border-t border-white/10 text-xs text-gray-400">
                    <td className="p-3" colSpan={5}>{t('admin.accClosing', { y: period })}</td>
                    <td className="p-3 text-right font-mono">{fmt(ledger.closingHal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {/* ── Inventura ── */}
      {tab === 'inventory' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-bold text-gray-300">{t('admin.accInvTitle', { y: period })}</h2>
            <a href={exportUrl('inventory')} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs">
              📄 {t('admin.accExportCsv')}
            </a>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-zion-card mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-gray-400">
                  <th className="p-3">{t('admin.accCode')}</th>
                  <th className="p-3">{t('admin.accName')}</th>
                  <th className="p-3">{t('admin.accInvClass')}</th>
                  <th className="p-3">{t('admin.accInvKind')}</th>
                  <th className="p-3 text-right">{t('admin.accBalance')}</th>
                </tr>
              </thead>
              <tbody>
                {(inventory?.rows ?? []).map((r) => (
                  <tr key={r.accountCode} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 font-mono text-rasta-gold">{r.accountCode}</td>
                    <td className="p-3">{r.name}</td>
                    <td className="p-3 text-gray-400">{r.cls}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        r.kind === 'asset' ? 'bg-green-500/15 text-green-300'
                        : r.kind === 'liability' ? 'bg-red-500/15 text-red-300'
                        : 'bg-blue-500/15 text-blue-300'
                      }`}>
                        {kindLabel(r.kind)}
                      </span>
                    </td>
                    <td className={`p-3 text-right font-mono ${r.balanceHal < 0 ? 'text-red-400' : 'text-green-400'}`}>{fmt(r.balanceHal)}</td>
                  </tr>
                ))}
                {inventory && inventory.rows.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-gray-500">{t('admin.accNoEntries')}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {inventory && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="rounded-xl border border-white/10 bg-zion-card p-4">
                <div className="text-xs text-gray-400 mb-1">{t('admin.accInvAssets')}</div>
                <div className="text-xl font-black font-mono text-green-400">{fmt(inventory.assetsHal)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-zion-card p-4">
                <div className="text-xs text-gray-400 mb-1">{t('admin.accInvLiabilities')}</div>
                <div className="text-xl font-black font-mono text-red-400">{fmt(inventory.liabilitiesHal)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-zion-card p-4">
                <div className="text-xs text-gray-400 mb-1">{t('admin.accInvEquity')}</div>
                <div className="text-xl font-black font-mono text-blue-300">{fmt(inventory.equityHal)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-zion-card p-4">
                <div className="text-xs text-gray-400 mb-1">{t('admin.accInvProfit')}</div>
                <div className={`text-xl font-black font-mono ${inventory.profitHal < 0 ? 'text-red-400' : 'text-rasta-gold'}`}>
                  {fmt(inventory.profitHal)}
                </div>
              </div>
            </div>
          )}

          {inventory && (
            <div className={`px-4 py-3 rounded-lg border text-sm ${
              inventory.controlDiffHal === 0
                ? 'border-green-500/30 bg-green-500/10 text-green-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300'
            }`}>
              {inventory.controlDiffHal === 0
                ? `✓ ${t('admin.accInvOk')}`
                : `✗ ${t('admin.accInvControl')}: ${fmt(inventory.controlDiffHal)}`}
              {' · '}
              {inventory.balanced
                ? `MD = DAL (${fmt(inventory.mdTotalHal)})`
                : `MD ≠ DAL (${fmt(inventory.mdTotalHal)} / ${fmt(inventory.dalTotalHal)})`}
            </div>
          )}
        </>
      )}

      {/* ── Doklady a návaznosti ── */}
      {tab === 'documents' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-bold text-gray-300">{t('admin.accDocsTitle', { y: period })}</h2>
            <button
              onClick={sync}
              disabled={busy === 'sync'}
              className="px-3 py-1.5 rounded-lg bg-rasta-gold/20 text-rasta-gold hover:bg-rasta-gold/30 disabled:opacity-50 text-xs font-semibold"
            >
              {busy === 'sync' ? t('admin.loading') : t('admin.accSync')}
            </button>
          </div>

          {documents && (documents.unposted.invoices > 0 || documents.unposted.paidOrders > 0) ? (
            <div className="mb-4 px-4 py-3 rounded-lg border border-rasta-gold/30 bg-rasta-gold/10 text-sm text-rasta-gold">
              {t('admin.accDocsUnposted', {
                i: documents.unposted.invoices,
                p: documents.unposted.paidOrders,
              })}
            </div>
          ) : (
            <div className="mb-4 px-4 py-3 rounded-lg border border-green-500/30 bg-green-500/10 text-sm text-green-300">
              ✓ {t('admin.accDocsOk')}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-zion-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-gray-400">
                  <th className="p-3">{t('admin.accEntryNo')}</th>
                  <th className="p-3">{t('admin.accDate')}</th>
                  <th className="p-3">{t('admin.accDocRef')}</th>
                  <th className="p-3">{t('admin.accDesc')}</th>
                  <th className="p-3">{t('admin.accSource')}</th>
                  <th className="p-3">{t('admin.accDocsLink')}</th>
                  <th className="p-3 text-right">{t('admin.accAmount')}</th>
                </tr>
              </thead>
              <tbody>
                {(documents?.rows ?? []).map((d) => (
                  <tr key={d.entryId} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 font-mono text-rasta-gold whitespace-nowrap">{d.entryNumber}</td>
                    <td className="p-3 whitespace-nowrap">{fmtDate(d.date)}</td>
                    <td className="p-3 font-mono text-xs">{d.documentRef ?? '—'}</td>
                    <td className="p-3">{d.description}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-white/10">{d.sourceType}</span>
                    </td>
                    <td className="p-3 text-xs space-x-3 whitespace-nowrap">
                      {d.orderId && (
                        <a href={`/admin/orders?q=${encodeURIComponent(d.orderId)}`} className="text-rasta-gold hover:underline">
                          {t('admin.accLinkOrder')} {d.orderId}
                        </a>
                      )}
                      {d.invoiceNumber && (
                        <a href="/admin/invoices" className="text-rasta-gold hover:underline">
                          {t('admin.accLinkInvoice')} {d.invoiceNumber}
                        </a>
                      )}
                      {!d.orderId && !d.invoiceNumber && <span className="text-gray-500">—</span>}
                    </td>
                    <td className="p-3 text-right font-mono whitespace-nowrap">{fmt(d.totalHal)}</td>
                  </tr>
                ))}
                {documents && documents.rows.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-gray-500">{t('admin.accNoEntries')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
