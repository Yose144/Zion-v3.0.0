'use client';

import { useState } from 'react';
import { Check, Copy, Users } from 'lucide-react';
import QRCode from '@/components/explorer/QRCode';
import { useLang } from '@/contexts/LanguageContext';

const C = {
  title: { cs: 'Delegace hlasu (memo)', en: 'Vote delegation (memo)' },
  explainer: {
    cs: 'Svou volební váhu můžete delegovat na jinou adresu: pošlete si self-transfer s memem níže. Když váš delegate odhlasuje, vaše balance se připočítá k jeho hlasu — pokud jste na daný návrh nehlasovali sami. Delegace není tranzitivní a lze ji kdykoliv zrušit memem `DAO:delegate:none`.',
    en: 'You can delegate your voting weight to another address: send yourself a self-transfer with the memo below. When your delegate votes, your balance is added to their vote — unless you already voted on that proposal yourself. Delegation is non-transitive and can be revoked anytime with the `DAO:delegate:none` memo.',
  },
  addrLabel: { cs: 'Adresa delegate', en: 'Delegate address' },
  addrPlaceholder: { cs: 'zion1…', en: 'zion1…' },
  invalidAddr: { cs: 'Adresa musí začínat zion1', en: 'Address must start with zion1' },
  memoLabel: { cs: 'Memo k vložení do transakce', en: 'Memo to attach to the transaction' },
  revokeLabel: { cs: 'Zrušit delegaci', en: 'Revoke delegation' },
  copied: { cs: 'Zkopírováno', en: 'Copied' },
  copy: { cs: 'Kopírovat', en: 'Copy' },
};

/**
 * D6 UX helper: generates the L1 self-transfer memos for vote delegation —
 * `DAO:delegate:<zion1address>` to assign, `DAO:delegate:none` to revoke.
 * Wire format defined by `parse_dao_memo`; weight accounting is handled by
 * the DAO runtime (non-transitive, consumed per-proposal).
 */
export default function DelegateMemoCard() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [addr, setAddr] = useState('');
  const [copied, setCopied] = useState<'set' | 'revoke' | null>(null);
  const [touched, setTouched] = useState(false);

  const clean = addr.trim();
  const valid = /^zion1.{3,}$/.test(clean);
  const memo = `DAO:delegate:${valid ? clean : '<zion1_address>'}`;
  const revokeMemo = 'DAO:delegate:none';

  async function copyText(text: string, which: 'set' | 'revoke') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard unavailable — memo stays selectable */
    }
  }

  return (
    <div className="zion-rainbow-sub p-5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
      <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
        <Users className="h-4 w-4 text-zion-purple" />
        {C.title[cs ? 'cs' : 'en']}
      </h3>
      <p className="text-[11px] text-gray-500 mb-3 leading-relaxed max-w-2xl">
        {C.explainer[cs ? 'cs' : 'en']}
      </p>
      <p className="text-[10px] text-gray-500 mb-1">{C.addrLabel[cs ? 'cs' : 'en']}</p>
      <input
        type="text"
        value={addr}
        onChange={(e) => setAddr(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder={C.addrPlaceholder[cs ? 'cs' : 'en']}
        spellCheck={false}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-mono text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none mb-3"
      />
      {touched && !valid && clean.length > 0 && (
        <p className="text-[11px] text-zion-purple mb-2">{C.invalidAddr[cs ? 'cs' : 'en']}</p>
      )}
      <p className="text-[10px] text-gray-500 mb-1">{C.memoLabel[cs ? 'cs' : 'en']}</p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[220px] space-y-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs font-mono text-zion-purple select-all break-all">
              {memo}
            </code>
            <button
              type="button"
              onClick={() => copyText(`DAO:delegate:${clean}`, 'set')}
              disabled={!valid}
              className="shrink-0 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-40"
            >
              {copied === 'set' ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied === 'set' ? C.copied[cs ? 'cs' : 'en'] : C.copy[cs ? 'cs' : 'en']}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs font-mono text-gray-500 select-all break-all">
              {revokeMemo}
            </code>
            <button
              type="button"
              onClick={() => copyText(revokeMemo, 'revoke')}
              className="shrink-0 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
            >
              {copied === 'revoke' ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied === 'revoke' ? C.copied[cs ? 'cs' : 'en'] : C.revokeLabel[cs ? 'cs' : 'en']}
            </button>
          </div>
        </div>
        {valid && <QRCode value={`DAO:delegate:${clean}`} size={88} />}
      </div>
    </div>
  );
}
