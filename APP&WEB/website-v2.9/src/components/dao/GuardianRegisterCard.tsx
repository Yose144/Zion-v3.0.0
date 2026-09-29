'use client';

import { useState } from 'react';
import { Check, Copy, QrCode, ShieldCheck } from 'lucide-react';
import QRCode from '@/components/explorer/QRCode';
import { useLang } from '@/contexts/LanguageContext';

const C = {
  title: { cs: 'Registrace kandidáta (memo)', en: 'Candidate registration (memo)' },
  explainer: {
    cs: 'Kandidát na guardian se registruje přímo na L1: pošle si self-transfer s memem obsahujícím svůj Ed25519 veřejný klíč (64 hex znaků). Scanner DAO ověří, že klíč patří odesílateli, a kandidát se objeví v registru — pak může komunita hlasovat o admission.',
    en: 'A guardian candidate registers directly on L1: send yourself a self-transfer with a memo containing your Ed25519 public key (64 hex chars). The DAO scanner verifies the key belongs to the sender and lists the candidate in the registry — the community can then vote on admission.',
  },
  pubkeyLabel: { cs: 'Váš veřejný klíč (hex)', en: 'Your public key (hex)' },
  pubkeyPlaceholder: { cs: '64 hex znaků…', en: '64 hex characters…' },
  invalidKey: { cs: 'Klíč musí mít 64 hex znaků (32 bajtů)', en: 'Key must be 64 hex chars (32 bytes)' },
  memoLabel: { cs: 'Memo k vložení do transakce', en: 'Memo to attach to the transaction' },
  copied: { cs: 'Zkopírováno', en: 'Copied' },
  copy: { cs: 'Kopírovat', en: 'Copy' },
};

/**
 * D3 UX helper: generates the L1 self-transfer memo
 * (`DAO:guardian:register:<pubkey_hex>`) the governance scanner indexes for
 * guardian-candidate registration. Wire format defined by `parse_dao_memo`.
 */
export default function GuardianRegisterCard() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [pubkey, setPubkey] = useState('');
  const [copied, setCopied] = useState(false);
  const [touched, setTouched] = useState(false);

  const clean = pubkey.trim().toLowerCase();
  const valid = /^[0-9a-f]{64}$/.test(clean);
  const memo = `DAO:guardian:register:${valid ? clean : '<pubkey_hex>'}`;

  async function copyMemo() {
    if (!valid) return;
    try {
      await navigator.clipboard.writeText(`DAO:guardian:register:${clean}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — memo stays selectable */
    }
  }

  return (
    <div className="zion-rainbow-sub p-5" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
      <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-zion-cyan" />
        {C.title[cs ? 'cs' : 'en']}
      </h3>
      <p className="text-[11px] text-gray-500 mb-3 leading-relaxed max-w-2xl">
        {C.explainer[cs ? 'cs' : 'en']}
      </p>
      <p className="text-[10px] text-gray-500 mb-1">{C.pubkeyLabel[cs ? 'cs' : 'en']}</p>
      <input
        type="text"
        value={pubkey}
        onChange={(e) => setPubkey(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder={C.pubkeyPlaceholder[cs ? 'cs' : 'en']}
        spellCheck={false}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-mono text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none mb-3"
      />
      {touched && !valid && clean.length > 0 && (
        <p className="text-[11px] text-zion-purple mb-2">{C.invalidKey[cs ? 'cs' : 'en']}</p>
      )}
      <p className="text-[10px] text-gray-500 mb-1">{C.memoLabel[cs ? 'cs' : 'en']}</p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs font-mono text-zion-cyan select-all break-all">
              {memo}
            </code>
            <button
              type="button"
              onClick={copyMemo}
              disabled={!valid}
              className="shrink-0 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-40"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? C.copied[cs ? 'cs' : 'en'] : C.copy[cs ? 'cs' : 'en']}
            </button>
          </div>
        </div>
        {valid && <QRCode value={`DAO:guardian:register:${clean}`} size={88} />}
      </div>
    </div>
  );
}
