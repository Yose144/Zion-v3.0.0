'use client';

import { useState } from 'react';
import { Check, Copy, QrCode } from 'lucide-react';
import QRCode from '@/components/explorer/QRCode';
import { useLang } from '@/contexts/LanguageContext';

const C = {
  title: { cs: 'On-chain hlas (memo)', en: 'On-chain vote (memo)' },
  explainer: {
    cs: 'Hlasujte přímo na L1: pošlete si sami sobě drobný self-transfer s tímto memem. Scanner DAO ho přečte a váha hlasu = váš zůstatek v bloku transakce. Minimum 1 ZION.',
    en: 'Vote directly on L1: send yourself a small self-transfer with this memo. The DAO scanner reads it; vote weight = your balance at the tx block. Minimum 1 ZION.',
  },
  memoLabel: { cs: 'Memo k vložení do transakce', en: 'Memo to attach to the transaction' },
  copied: { cs: 'Zkopírováno', en: 'Copied' },
  copy: { cs: 'Kopírovat', en: 'Copy' },
};

type OnChainChoice = 'yes' | 'no' | 'abstain';

/**
 * D8: generates the L1 self-transfer memo (`DAO:vote:<id>:<choice>`) the
 * governance scanner indexes, with a QR for mobile wallet entry. This is a
 * UX helper — the wire format is defined by the daemon's `parse_dao_memo`.
 */
export default function VoteMemoCard({ proposalId }: { proposalId: number }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [choice, setChoice] = useState<OnChainChoice>('yes');
  const [copied, setCopied] = useState(false);

  const memo = `DAO:vote:${proposalId}:${choice}`;

  async function copyMemo() {
    try {
      await navigator.clipboard.writeText(memo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — memo stays selectable */
    }
  }

  const choices: { id: OnChainChoice; label: string }[] = [
    { id: 'yes', label: cs ? 'PRO' : 'Yes' },
    { id: 'no', label: cs ? 'PROTI' : 'No' },
    { id: 'abstain', label: cs ? 'Zdržet se' : 'Abstain' },
  ];

  return (
    <div className="zion-rainbow-sub p-4 mb-6" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
      <h3 className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
        <QrCode className="h-3.5 w-3.5" />
        {C.title[cs ? 'cs' : 'en']}
      </h3>
      <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
        {C.explainer[cs ? 'cs' : 'en']}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[220px]">
          <div className="flex gap-1.5 mb-2">
            {choices.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChoice(c.id)}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  choice === c.id
                    ? 'bg-zion-gold/20 text-zion-gold border border-zion-gold/40'
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-500 mb-1">{C.memoLabel[cs ? 'cs' : 'en']}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs font-mono text-zion-cyan select-all">
              {memo}
            </code>
            <button
              type="button"
              onClick={copyMemo}
              className="shrink-0 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
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
        <QRCode value={memo} size={88} />
      </div>
    </div>
  );
}
