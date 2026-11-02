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

function fmt(amountHal: number): string {
  const sign = amountHal < 0 ? '−' : '';
  const abs = Math.abs(amountHal);
  return `${sign}${Math.floor(abs / 100).toLocaleString('cs-CZ')},${String(abs % 100).padStart(2, '0')}`;
}

export default function AdminAccountingPage() {
  const { t } = useLangT();
  const [period, setPeriod] = useState(new Date().getFullYear());
  const [balance, setBalance] = useState<{ rows: BalanceRow[]; balanced: boolean; mdTotalHal: number; dalTotalHal: number } | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
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

  const load = useCallback(() => {
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
    load().catch(console.error);
  }, [load]);

  const seed = async () => {
    setBusy('seed');
    const res = await fetch('/api/admin/accounting/accounts', { method: 'POST' }).then((r) => r.json());
    setMsg(res?.success ? t('admin.accSeedOk', { n: res.data?.upserted ?? 0 }) : t('admin.accSeedFail'));
    setBusy(null);
    load();
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
    load();
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
    load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
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

      {/* Obratová předvaha */}
      <h2 className="text-lg font-bold mb-2 text-gray-300">{t('admin.accBalanceTitle', { y: period })}</h2>
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-zion-card mb-8">
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

      {/* Manuální doklad */}
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

      {/* Deník */}
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
                <td className="p-3 whitespace-nowrap">{new Date(e.date).toLocaleDateString('cs-CZ')}</td>
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
    </div>
  );
}
