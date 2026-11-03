'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Locale } from '@zion/contract';
import { t } from '@zion/i18n';

declare global {
  interface Window {
    zion?: {
      app: {
        info: () => Promise<{ platform: string; version: string; dev: boolean }>;
        openMiner: () => Promise<{ success: boolean }>;
      };
      wallet: {
        status: () => Promise<Bridge<WalletStatus>>;
        create: (password: string) => Promise<Bridge<{ address: string; mnemonic: string }>>;
        importMnemonic: (args: { mnemonic: string; password: string }) => Promise<Bridge<{ address: string }>>;
        unlock: (password: string) => Promise<Bridge<{ unlocked: boolean }>>;
        lock: () => Promise<Bridge<{ unlocked: boolean }>>;
        balance: (address: string) => Promise<Bridge<WalletBalance>>;
        send: (tx: { from: string; to: string; amountZion: number; memo?: string; password: string }) => Promise<Bridge<{ tx_id: string; status: string }>>;
      };
    };
  }
}

type Bridge<T> = { ok: true; data: T } | { ok: false; error: string };
type WalletStatus = { exists: boolean; unlocked: boolean; address: string | null };
type WalletBalance = { address: string; total: number | string; spendable: number | string; utxoCount: number; unlocked: boolean };

/**
 * Desktop peněženka — žije jen uvnitř Electron klienta přes preload bridge
 * `window.zion`. V prohlížeči bridge chybí → panel se nevykreslí vůbec.
 *
 * IPC volání nejsou `fetch` — data nepřichází přes manifest.reads, ale z
 * lokálního main procesu (peněženka drží klíč mimo DOM, viz F7 v PLAN.md).
 */
export function DesktopWalletPanel({ locale }: { locale: Locale }) {
  const [bridge, setBridge] = useState<NonNullable<Window['zion']> | null>(null);
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async (b = bridge) => {
    if (!b) return;
    const s = await b.wallet.status();
    if (s.ok) setStatus(s.data);
    if (s.ok && s.data.exists && s.data.address) {
      const bal = await b.wallet.balance(s.data.address);
      if (bal.ok) setBalance(bal.data);
      else setBalance(null);
    } else {
      setBalance(null);
    }
  }, [bridge]);

  useEffect(() => {
    const b = window.zion ?? null;
    setBridge(b);
    if (b) void refresh(b);
  }, [refresh]);

  if (!bridge || !status) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const guard = <T,>(r: Bridge<T>): T | null => (r.ok ? r.data : (setErr(r.error), null));

  const onCreate = () => run(async () => {
    const r = guard(await bridge.wallet.create(password));
    if (r) {
      setMnemonic(r.mnemonic);
      setPassword('');
      await refresh();
    }
  });

  const onImport = () => run(async () => {
    const r = guard(await bridge.wallet.importMnemonic({ mnemonic: phrase.trim(), password }));
    if (r) {
      setPhrase('');
      setPassword('');
      setShowImport(false);
      await refresh();
    }
  });

  const onSend = () => run(async () => {
    if (!status.address) return;
    const r = guard(
      await bridge.wallet.send({
        from: status.address,
        to: to.trim(),
        amountZion: Number(amount),
        memo: memo || undefined,
        password,
      }),
    );
    if (r) {
      setNote(`${t(locale, 'walletSent')} · ${r.tx_id}`);
      setTo('');
      setAmount('');
      setMemo('');
      setPassword('');
      setShowSend(false);
      await refresh();
    }
  });

  return (
    <div className="k-card" style={{ maxWidth: 640 }}>
      <div className="k-row" style={{ justifyContent: 'space-between' }}>
        <div className="k-card-title">{t(locale, 'walletTitle')}</div>
        <button
          className="k-btn k-ghost"
          onClick={() => void bridge.app.openMiner()}
        >
          Miner
        </button>
      </div>

      <p className="k-sub" style={{ marginTop: 8 }}>{t(locale, 'walletLocal')}</p>

      {!status.exists ? (
        <>
          <p className="k-sub">{t(locale, 'walletNone')}</p>
          <input
            className="k-input"
            type="password"
            placeholder={t(locale, 'walletPassword')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {showImport ? (
            <input
              className="k-input"
              placeholder={t(locale, 'walletMnemonic')}
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
            />
          ) : null}
          <div className="k-row" style={{ marginTop: 8 }}>
            {showImport ? (
              <button className="k-btn" disabled={busy || !password || !phrase.trim()} onClick={onImport}>
                {busy ? t(locale, 'walletWorking') : t(locale, 'walletImport')}
              </button>
            ) : (
              <>
                <button className="k-btn" disabled={busy || !password} onClick={onCreate}>
                  {busy ? t(locale, 'walletWorking') : t(locale, 'walletCreate')}
                </button>
                <button className="k-btn k-ghost" onClick={() => setShowImport(true)}>
                  {t(locale, 'walletImport')}
                </button>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="k-stats" style={{ marginTop: 8 }}>
            <div className="k-stat">
              <div className="k-stat-label">{t(locale, 'walletAddress')}</div>
              <div className="k-code" style={{ marginTop: 4, wordBreak: 'break-all' }}>
                {status.address}
              </div>
            </div>
            {balance ? (
              <div className="k-stat">
                <div className="k-stat-label">{t(locale, 'walletBalance')}</div>
                <div className="k-stat-value">
                  {Number(balance.spendable).toFixed(6)} ZION
                </div>
              </div>
            ) : null}
          </div>

          {(
            <>
              {mnemonic ? (
                <div className="k-stat" style={{ marginTop: 8 }}>
                  <div className="k-stat-label">{t(locale, 'walletMnemonic')}</div>
                  <div className="k-code" style={{ marginTop: 4 }}>{mnemonic}</div>
                  <p className="k-sub" style={{ marginTop: 6 }}>{t(locale, 'walletBackup')}</p>
                </div>
              ) : null}

              {showSend ? (
                <div style={{ marginTop: 8 }}>
                  <input className="k-input" placeholder={t(locale, 'walletTo')} value={to} onChange={(e) => setTo(e.target.value)} />
                  <input className="k-input" placeholder={t(locale, 'walletAmount')} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
                  <input className="k-input" placeholder={t(locale, 'walletMemo')} value={memo} onChange={(e) => setMemo(e.target.value)} />
                  <input className="k-input" type="password" placeholder={t(locale, 'walletPassword')} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              ) : null}

              <div className="k-row" style={{ marginTop: 8 }}>
                {showSend ? (
                  <>
                    <button className="k-btn" disabled={busy || !to.trim() || !amount || !password} onClick={onSend}>
                      {busy ? t(locale, 'walletWorking') : t(locale, 'walletSend')}
                    </button>
                    <button className="k-btn k-ghost" onClick={() => setShowSend(false)}>{t(locale, 'back')}</button>
                  </>
                ) : (
                  <>
                    <button className="k-btn k-ghost" onClick={() => void refresh()}>{t(locale, 'walletRefresh')}</button>
                    <button className="k-btn" onClick={() => setShowSend(true)}>{t(locale, 'walletSend')}</button>
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}

      {err ? <p className="k-sub" style={{ color: 'var(--k-danger, #e07a5f)', marginTop: 8 }}>{err}</p> : null}
      {note ? <p className="k-sub" style={{ marginTop: 8 }}>{note}</p> : null}
    </div>
  );
}
