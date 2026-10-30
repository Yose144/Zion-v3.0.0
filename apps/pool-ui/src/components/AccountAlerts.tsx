'use client';

// /account — alert subscriptions + per-wallet payout threshold.
// HeroMiners-parity notification UX on top of the pool account API
// (worker-offline watcher evaluates subscriptions server-side).
//
// Auth: ZIS session cookie can't be read by JS, so we mint a dedicated
// `zis_*` API key (label "pool-ui") and keep it in localStorage — see
// lib/account.ts. The key only unlocks the owner's own wallets.

import { useState } from 'react';
import { Bell, BellOff, KeyRound, Send, Trash2, Webhook } from 'lucide-react';
import {
  accountView,
  deleteAlert,
  ensurePoolKey,
  flowersToZion,
  forgetPoolKey,
  setThreshold,
  upsertAlert,
  type AccountView,
  type AlertSub,
} from '@/lib/account';
import { useLang } from '@/lib/i18n';

const OFFLINE_CHOICES: [number, string][] = [
  [300, '5 min'],
  [600, '10 min'],
  [1800, '30 min'],
  [3600, '1 h'],
];

export default function AccountAlerts() {
  const { t } = useLang();
  const [key, setKey] = useState<string | null>(null);
  const [view, setView] = useState<AccountView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Per-wallet form state
  const [thresh, setThresh] = useState<Record<string, string>>({});
  const [form, setForm] = useState<Record<string, { channel: 'telegram' | 'webhook'; target: string; worker: string; offline_secs: number }>>({});

  const reload = async (k: string) => setView(await accountView(k));

  const activate = async () => {
    setBusy(true);
    setError(null);
    try {
      const k = await ensurePoolKey();
      setKey(k);
      await reload(k);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const saveThreshold = async (wallet: string) => {
    if (!key) return;
    setBusy(true);
    setError(null);
    try {
      const v = parseFloat(thresh[wallet] ?? '0');
      await setThreshold(key, wallet, Number.isFinite(v) ? v : 0);
      await reload(key);
      flash(t('Uloženo', 'Saved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const addAlert = async (wallet: string) => {
    if (!key) return;
    const f = form[wallet] ?? { channel: 'telegram', target: '', worker: '', offline_secs: 600 };
    setBusy(true);
    setError(null);
    try {
      await upsertAlert(key, wallet, {
        channel: f.channel,
        target: f.target.trim(),
        worker: f.worker.trim() || undefined,
        offline_secs: f.offline_secs,
      });
      setForm((s) => ({ ...s, [wallet]: { ...f, target: '' } }));
      await reload(key);
      flash(t('Alert přidán', 'Alert added'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const removeAlert = async (wallet: string, id: number) => {
    if (!key) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAlert(key, wallet, id);
      await reload(key);
      flash(t('Alert smazán', 'Alert deleted'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    forgetPoolKey();
    setKey(null);
    setView(null);
  };

  const wallets = view?.wallets ?? [];

  return (
    <div className="pool-card mt-6 p-6">
      <h2 className="kicker mb-4 flex items-center gap-2">
        <Bell size={14} />
        {t('Notifikace & výplatní práh', 'Notifications & payout threshold')}
      </h2>

      {!key ? (
        <div className="rounded-xl border border-dashed border-white/12 px-4 py-6 text-center">
          <p className="text-sm text-white/45">
            {t(
              'Nastav alert při výpadku workera (Telegram / webhook) a vlastní minimální výplatu pro každou adresu.',
              'Set up worker-offline alerts (Telegram / webhook) and a custom minimum payout per address.',
            )}
          </p>
          <button
            onClick={activate}
            disabled={busy}
            className="btn-gold mt-4 inline-flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-50"
          >
            <KeyRound size={14} />
            {busy ? t('Aktivuji…', 'Activating…') : t('Aktivovat správu', 'Activate management')}
          </button>
          <p className="mt-3 text-[0.65rem] text-white/30">
            {t(
              'Vytvoří pool API klíč v tvém ZIS účtu (viditelný v profilu, odvolatelný).',
              'Creates a pool API key in your ZIS account (visible in your profile, revocable).',
            )}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {wallets.length === 0 && (
            <p className="text-sm text-white/40">
              {t('Žádné napojené adresy — nejdřív přilinkuj wallet v ZIS profilu.', 'No linked addresses — link a wallet in your ZIS profile first.')}
            </p>
          )}
          {wallets.map((wallet) => {
            const override = view?.settings?.[wallet]?.min_payout_flowers;
            const subs: AlertSub[] = view?.alerts?.[wallet] ?? [];
            const f = form[wallet] ?? { channel: 'telegram' as const, target: '', worker: '', offline_secs: 600 };
            const setF = (patch: Partial<typeof f>) =>
              setForm((s) => ({ ...s, [wallet]: { ...f, ...patch } }));
            return (
              <div key={wallet} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <p className="mb-3 break-all font-mono text-xs text-white/60">{wallet}</p>

                {/* Min payout override */}
                <div className="mb-4 flex flex-wrap items-end gap-2">
                  <label className="block">
                    <span className="kicker mb-1 block">{t('min výplata (ZION, 0 = výchozí)', 'min payout (ZION, 0 = default)')}</span>
                    <input
                      value={thresh[wallet] ?? (override ? String(flowersToZion(override)) : '')}
                      onChange={(e) => setThresh((s) => ({ ...s, [wallet]: e.target.value }))}
                      placeholder="0"
                      inputMode="decimal"
                      className="w-40 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-[0.75rem] text-white placeholder:text-white/25 focus:border-rasta-gold/50 focus:outline-none"
                    />
                  </label>
                  <button
                    onClick={() => saveThreshold(wallet)}
                    disabled={busy}
                    className="rounded-lg border border-rasta-gold/40 px-3 py-1.5 text-[0.72rem] font-bold text-rasta-gold transition hover:bg-rasta-gold/10 disabled:opacity-50"
                  >
                    {t('Uložit', 'Save')}
                  </button>
                  {override && (
                    <span className="text-[0.65rem] text-white/35">
                      {t('aktuálně', 'current')}: {flowersToZion(override)} ZION
                    </span>
                  )}
                </div>

                {/* Existing alert subs */}
                {subs.length > 0 && (
                  <div className="mb-3 flex flex-col gap-1.5">
                    {subs.map((s) => (
                      <div
                        key={s.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg bg-black/30 px-3 py-2 text-[0.7rem]"
                      >
                        {s.channel === 'telegram' ? (
                          <Send size={12} className="text-sky-400" />
                        ) : (
                          <Webhook size={12} className="text-rasta-gold" />
                        )}
                        <span className="font-bold uppercase text-white/70">{s.channel}</span>
                        <span className="max-w-[14rem] truncate font-mono text-white/50" title={s.target}>
                          {s.target}
                        </span>
                        {s.worker && (
                          <span className="pill pill-sync">{s.worker}</span>
                        )}
                        <span className="text-white/35">≥{Math.round(s.offline_secs / 60)} min offline</span>
                        <span
                          className={`pill ${s.state === 'down' ? 'pill-down' : 'pill-native'}`}
                          title={t('stav poslední kontroly', 'last check state')}
                        >
                          {s.state}
                        </span>
                        <button
                          onClick={() => removeAlert(wallet, s.id)}
                          disabled={busy}
                          className="ml-auto text-white/30 transition hover:text-rasta-red disabled:opacity-50"
                          title={t('smazat', 'delete')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add alert form */}
                <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto_auto]">
                  <select
                    value={f.channel}
                    onChange={(e) => setF({ channel: e.target.value as 'telegram' | 'webhook' })}
                    className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[0.72rem] text-white focus:border-rasta-gold/50 focus:outline-none"
                  >
                    <option value="telegram">Telegram</option>
                    <option value="webhook">Webhook</option>
                  </select>
                  <input
                    value={f.target}
                    onChange={(e) => setF({ target: e.target.value })}
                    placeholder={
                      f.channel === 'telegram'
                        ? t('chat id (např. od @userinfobot)', 'chat id (e.g. via @userinfobot)')
                        : 'https://…'
                    }
                    spellCheck={false}
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-[0.72rem] text-white placeholder:text-white/25 focus:border-rasta-gold/50 focus:outline-none"
                  />
                  <input
                    value={f.worker}
                    onChange={(e) => setF({ worker: e.target.value })}
                    placeholder={t('worker (volitelné)', 'worker (optional)')}
                    spellCheck={false}
                    className="w-32 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-[0.72rem] text-white placeholder:text-white/25 focus:border-rasta-gold/50 focus:outline-none"
                  />
                  <select
                    value={f.offline_secs}
                    onChange={(e) => setF({ offline_secs: Number(e.target.value) })}
                    className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[0.72rem] text-white focus:border-rasta-gold/50 focus:outline-none"
                    title={t('kolik minut offline = alert', 'how many minutes offline = alert')}
                  >
                    {OFFLINE_CHOICES.map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => addAlert(wallet)}
                  disabled={busy || !f.target.trim()}
                  className="mt-2 rounded-lg border border-white/15 px-3 py-1.5 text-[0.72rem] font-bold text-white/70 transition hover:border-rasta-gold/40 hover:text-rasta-gold disabled:opacity-40"
                >
                  <BellOff size={11} className="mr-1 inline" />
                  {t('Přidat alert', 'Add alert')}
                </button>
              </div>
            );
          })}

          <div className="flex items-center justify-between text-[0.65rem] text-white/30">
            <span>
              {t('Pool API klíč uložen lokálně v prohlížeči.', 'Pool API key stored locally in this browser.')}
            </span>
            <button onClick={disconnect} className="underline-offset-2 hover:underline">
              {t('odpojit', 'disconnect')}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-[0.72rem] text-rasta-red">{error}</p>}
      {notice && <p className="mt-3 text-[0.72rem] text-rasta-green">{notice}</p>}
    </div>
  );
}
