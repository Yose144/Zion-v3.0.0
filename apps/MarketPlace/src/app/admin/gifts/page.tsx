'use client';

import { useCallback, useEffect, useState } from 'react';
import { isAuthenticated } from '@/lib/admin-auth';
import {
  listAdminGifts,
  sendAdminGift,
  type AdminGiftListItem,
  type AdminGiftResult,
} from '@/lib/shop-api';

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${d.toLocaleDateString('cs-CZ')} ${d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}`;
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="ml-2 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-white/70 transition-colors"
    >
      {copied ? '✓' : 'kopírovat'}
    </button>
  );
}

function BonusBadge({ bonus }: { bonus: AdminGiftListItem['bonus'] }) {
  if (!bonus) return <span className="text-white/40 text-xs">—</span>;
  if (bonus.status === 'distributed') {
    return (
      <span className="text-[10px] font-mono text-emerald-300" title={bonus.txHash}>
        ✅ {bonus.txHash ? `${bonus.txHash.slice(0, 12)}…` : 'distributed'}
      </span>
    );
  }
  return <span className="text-[10px] text-yellow-300">⏳ {bonus.status}</span>;
}

export default function AdminGiftsPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('1000000');
  const [withPass, setWithPass] = useState(true);
  const [withBook, setWithBook] = useState(true);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<AdminGiftResult | null>(null);
  const [gifts, setGifts] = useState<AdminGiftListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const reload = useCallback(() => {
    if (!isAuthenticated()) return;
    listAdminGifts().then((res) => {
      if (res?.success && res.data) setGifts(res.data);
      setLoadingList(false);
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountZion = Math.round(Number(amount));
    if (!email.trim() || !Number.isInteger(amountZion) || amountZion <= 0) {
      setResult({ success: false, error: 'Zadejte platný email a kladné celé množství ZION' });
      return;
    }
    const extras = [
      withPass ? 'Archive Pass' : null,
      withBook ? 'kniha Království srdce (ZIP)' : null,
    ].filter(Boolean).join(' + ');
    const extraText = extras ? ` včetně ${extras}` : '';
    if (!window.confirm(`Odeslat dárek ${amountZion.toLocaleString('cs-CZ')} ZION${extraText} na ${email.trim()}?`)) return;
    setSending(true);
    setResult(null);
    const res = await sendAdminGift({
      email: email.trim(),
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
      amountZion,
      withPass,
      withBook,
      note: note.trim() || undefined,
    });
    setSending(false);
    setResult(res ?? { success: false, error: 'Network error' });
    if (res?.success) {
      setEmail('');
      setName('');
      setPhone('');
      setNote('');
      reload();
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white">🎁 ZION Dárky</h1>
        <p className="text-sm text-white/50 mt-1">
          Jeden klik = objednávka → paid → custodial peněženka + seed emailem → nativní L1
          payout → Archive Pass → ZIP knihy Království srdce → potvrzovací email. Vše přes standardní paid pipeline.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-white/60">Email příjemce *</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nekdo@domena.cz"
              className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rasta-gold"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/60">Jméno (nepovinné)</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jméno příjemce"
              className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rasta-gold"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/60">Telefon pro WhatsApp (nepovinné)</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+420 123 456 789"
              className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rasta-gold"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/60">Množství ZION *</span>
            <input
              type="number"
              required
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rasta-gold"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/60">Poznámka (interní)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="např. kampaň Genesis"
              className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rasta-gold"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
          <input
            type="checkbox"
            checked={withPass}
            onChange={(e) => setWithPass(e.target.checked)}
            className="w-4 h-4 accent-yellow-500"
          />
          🎟️ Připojit ZION Archive Pass (Archiv + OASIS svět NIRVANA + portál nirvana.)
        </label>

        <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
          <input
            type="checkbox"
            checked={withBook}
            onChange={(e) => setWithBook(e.target.checked)}
            className="w-4 h-4 accent-yellow-500"
          />
          📖 Přiložit knihu Království srdce (ZIP, PDF + EPUB, 5 jazyků)
        </label>

        <button
          type="submit"
          disabled={sending}
          className="px-6 py-2.5 rounded-xl font-bold text-rasta-black bg-gradient-to-r from-rasta-gold to-yellow-400 hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {sending ? '⏳ Odesílám… (payout ~10–40 s)' : '🎁 Odeslat dárek'}
        </button>
        <p className="text-[11px] text-white/40">
          ⚠️ Payout jde okamžitě z pool walletu on-chain — příjemce dostane email se seed
          slovy peněženky, bonus emailem s txHash a potvrzení s pass kódem a odkazem na ZIP knihy.
          S telefonem se navíc objeví tlačítko WhatsApp s kompletní zprávou (včetně seede).
        </p>
      </form>

      {result && (
        <div
          className={`rounded-2xl border p-5 text-sm ${
            result.success && result.data
              ? 'border-emerald-500/30 bg-emerald-500/10'
              : 'border-red-500/30 bg-red-500/10'
          }`}
        >
          {result.success && result.data ? (
            <div className="space-y-1.5 font-mono text-xs">
              <p className="text-emerald-300 font-bold text-sm">✅ Dárek odeslán</p>
              <p>Objednávka: <span className="text-white/90">{result.data.orderId}</span></p>
              <p>Wallet: <span className="text-white/90 break-all">{result.data.wallet ?? '—'}</span></p>
              {result.data.pass && (
                <p>
                  Pass: <span className="text-rasta-gold font-bold">{result.data.pass.code}</span>
                  <CopyBtn value={result.data.pass.code} />
                </p>
              )}
              {result.data.book && (
                <p>
                  Kniha:{' '}
                  <a href={result.data.book.filesUrl} className="text-rasta-gold underline break-all" target="_blank" rel="noreferrer">
                    ZIP Království srdce
                  </a>
                  <CopyBtn value={result.data.book.filesUrl} />
                </p>
              )}
              <p>
                Bonus: <span className={result.data.bonus.txHash ? 'text-emerald-300' : 'text-yellow-300'}>
                  {result.data.bonus.status}
                  {result.data.bonus.txHash ? ` — ${result.data.bonus.txHash}` : ''}
                </span>
                {result.data.bonus.txHash && <CopyBtn value={result.data.bonus.txHash} />}
              </p>
              {result.data.whatsapp?.url && (
                <p className="pt-2">
                  <a
                    href={result.data.whatsapp.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm text-black bg-gradient-to-r from-emerald-400 to-green-500 hover:opacity-90 transition-opacity"
                  >
                    📱 Poslat přes WhatsApp{result.data.phone ? ` na ${result.data.phone}` : ''}
                  </a>
                  <span className="ml-2 text-[11px] text-white/40">(otevře se WhatsApp s předvyplněnou zprávou)</span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-red-300">❌ {result.error}</p>
          )}
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold text-white mb-3">Odeslané dárky</h2>
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-white/40 border-b border-white/10">
                <th className="px-4 py-2.5">Objednávka</th>
                <th className="px-4 py-2.5">Příjemce</th>
                <th className="px-4 py-2.5">ZION</th>
                <th className="px-4 py-2.5">Pass</th>
                <th className="px-4 py-2.5">Kniha</th>
                <th className="px-4 py-2.5">Payout</th>
                <th className="px-4 py-2.5">Vytvořeno</th>
              </tr>
            </thead>
            <tbody>
              {loadingList && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-white/40">Načítám…</td></tr>
              )}
              {!loadingList && gifts.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-white/40">Zatím žádné dárky</td></tr>
              )}
              {gifts.map((g) => (
                <tr key={g.orderId} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-2.5 font-mono text-[11px] text-white/70">{g.orderId}</td>
                  <td className="px-4 py-2.5">
                    <div className="text-white/90">{g.customerEmail}</div>
                    <div className="text-[11px] text-white/40">{g.customerName}</div>
                    {g.whatsapp?.url && (
                      <a
                        href={g.whatsapp.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold hover:bg-emerald-500/30 transition-colors"
                        title="Poslat dárek přes WhatsApp"
                      >
                        📱 WA
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-bold text-rasta-gold">
                    {g.zionTokens.toLocaleString('cs-CZ')}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px]">
                    {g.pass ? (
                      <span className="text-white/80">
                        {g.pass.code}
                        <CopyBtn value={g.pass.code} />
                      </span>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {g.book?.filesUrl ? (
                      <a href={g.book.filesUrl} className="text-rasta-gold underline" target="_blank" rel="noreferrer">ZIP</a>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5"><BonusBadge bonus={g.bonus} /></td>
                  <td className="px-4 py-2.5 text-white/50 text-xs">{formatDateTime(g.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
