'use client';

import { useState } from 'react';
import { ShieldCheck, ExternalLink, Copy, CheckCircle2 } from 'lucide-react';

const BridgeValidatorsCopy = {
  title: { cs: `Guardian validátoři`, en: `Guardian validators` },
  quorum: { cs: `quorum`, en: `quorum` },
  of: { cs: `z`, en: `of` },
  copied: { cs: `Zkopírováno`, en: `Copied` },
};

function shorten(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export interface BridgeValidatorsProps {
  validators?: string[];
  threshold?: string;
  count?: number;
  cs: boolean;
}

export default function BridgeValidators({ validators, threshold, count, cs }: BridgeValidatorsProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const list = validators ?? [];
  const quorum = threshold ?? (count ? `${count}/${count}` : '—');

  const copy = (addr: string) => {
    if (typeof navigator === 'undefined') return;
    void navigator.clipboard.writeText(addr).then(() => {
      setCopied(addr);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="zion-rainbow-card p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="h-5 w-5 text-zion-purple" />
        <h3 className="font-semibold text-white text-sm">
          {BridgeValidatorsCopy.title[cs ? 'cs' : 'en']}
        </h3>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-zion-purple/10 border border-zion-purple/20 px-3 py-1 text-[10px] font-semibold text-zion-purple">
          {quorum} {BridgeValidatorsCopy.quorum[cs ? 'cs' : 'en']}
        </span>
      </div>

      {list.length === 0 ? (
        <p className="text-xs text-gray-500">—</p>
      ) : (
        <ul className="space-y-2">
          {list.map((addr, idx) => (
            <li
              key={addr}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-md bg-zion-gold/10 text-zion-gold font-mono text-[10px]">
                  {idx + 1}
                </span>
                <a
                  href={`https://basescan.org/address/${addr}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-gray-300 hover:text-white truncate"
                  title={addr}
                >
                  {shorten(addr)}
                </a>
                <ExternalLink className="h-3 w-3 text-gray-600 shrink-0" />
              </div>
              <button
                type="button"
                onClick={() => copy(addr)}
                className="shrink-0 inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-zion-cyan transition-colors"
                title={copied === addr ? BridgeValidatorsCopy.copied[cs ? 'cs' : 'en'] : 'Copy'}
              >
                {copied === addr ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-zion-cyan" />
                    <span className="text-zion-cyan hidden sm:inline">
                      {BridgeValidatorsCopy.copied[cs ? 'cs' : 'en']}
                    </span>
                  </>
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
