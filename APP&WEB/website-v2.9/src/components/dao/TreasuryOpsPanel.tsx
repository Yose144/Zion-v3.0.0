'use client';

import { useState, type CSSProperties } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, ExternalLink, KeyRound, ShieldCheck, XCircle } from 'lucide-react';
import { signTreasuryOperation, type TreasuryOp } from '@/lib/dao-api';
import { useLang } from '@/contexts/LanguageContext';

const C = {
  signatures: { cs: 'podpisů', en: 'signatures' },
  verifiedOnly: { cs: 'ověřené', en: 'verified' },
  signingHash: { cs: 'Text k podpisu (signing hash)', en: 'Signing payload (hash)' },
  guardian: { cs: 'Guardian adresa', en: 'Guardian address' },
  signatureHex: { cs: 'Ed25519 podpis (hex)', en: 'Ed25519 signature (hex)' },
  daoKey: { cs: 'DAO API klíč', en: 'DAO API key' },
  sign: { cs: 'Připojit podpis', en: 'Attach signature' },
  signing: { cs: 'Odesílám…', en: 'Submitting…' },
  showSignForm: { cs: 'Podepsat', en: 'Sign' },
  hideSignForm: { cs: 'Skrýt', en: 'Hide' },
  expandSigs: { cs: 'Podpisy', en: 'Signatures' },
  broadcastTx: { cs: 'Broadcast TX', en: 'Broadcast TX' },
  signedOk: { cs: 'Podpis přijat.', en: 'Signature accepted.' },
};

function opStatusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case 'executed':
      return { label: 'executed', cls: 'zion-badge-green' };
    case 'signed':
      return { label: 'ready', cls: '' };
    case 'awaiting_broadcast':
      return { label: 'awaiting broadcast', cls: '' };
    default:
      return { label: status, cls: '' };
  }
}

/** One treasury op row: verified-signature progress, signature list,
 *  signing payload for offline guardian signing, inline sign form. */
function OpRow({ op, onChanged }: { op: TreasuryOp; onChanged: () => void }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [expanded, setExpanded] = useState(false);
  const [showSign, setShowSign] = useState(false);
  const [guardian, setGuardian] = useState('');
  const [signature, setSignature] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const verified = op.verified_count ?? op.signature_count;
  const pct = op.threshold > 0 ? Math.min(100, (verified / op.threshold) * 100) : 0;
  const ready = verified >= op.threshold;
  const open = op.status === 'pending' || op.status === 'signed';
  const badge = opStatusBadge(op.status);
  const opKind = op.operation && typeof op.operation === 'object' ? Object.keys(op.operation)[0] : '—';

  async function submitSignature() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      await signTreasuryOperation({
        apiKey,
        op_id: op.op_id,
        guardian: guardian.trim(),
        signature: signature.trim(),
      });
      setMsg(C.signedOk[cs ? 'cs' : 'en']);
      setSignature('');
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Sign failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm text-white truncate">{op.op_id}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {opKind}
            {op.amount_zion > 0 ? ` · ${op.amount_zion.toLocaleString()} ZION` : ''}
            {op.proposal_id ? ` · proposal #${op.proposal_id}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={`zion-badge ${badge.cls}`}>{badge.label}</span>
          <span className="font-mono text-gray-300">
            {verified}/{op.threshold} {C.signatures[cs ? 'cs' : 'en']}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label={C.expandSigs[cs ? 'cs' : 'en']}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Verified-signature progress bar */}
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-3">
        <div
          className={`h-full rounded-full ${ready ? 'bg-zion-gold' : 'bg-gradient-to-r from-zion-cyan to-zion-gold'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {op.tx_id && (
        <a
          href={`/explorer/tx/${op.tx_id}`}
          className="mt-2 inline-flex items-center gap-1 text-xs text-zion-cyan hover:underline font-mono"
        >
          <ExternalLink className="h-3 w-3" />
          {C.broadcastTx[cs ? 'cs' : 'en']}: {op.tx_id.slice(0, 18)}…
        </a>
      )}

      {expanded && (
        <div className="mt-3 space-y-1.5">
          {op.signing_hash && (
            <p className="text-[10px] text-gray-500 font-mono break-all">
              {C.signingHash[cs ? 'cs' : 'en']}: {op.signing_hash}
            </p>
          )}
          {op.signatures.map((s) => (
            <div key={`${s.guardian}-${s.created_at}`} className="flex items-center justify-between text-xs">
              <span className="font-mono text-gray-300 truncate">{s.guardian}</span>
              {s.verified ? (
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> {C.verifiedOnly[cs ? 'cs' : 'en']}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-400">
                  <XCircle className="h-3 w-3" /> unverified
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {open && !showSign && (
        <button
          type="button"
          onClick={() => setShowSign(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-zion-gold hover:text-white transition-colors"
        >
          <KeyRound className="h-3.5 w-3.5" />
          {C.showSignForm[cs ? 'cs' : 'en']}
        </button>
      )}

      {open && showSign && (
        <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
          <input
            value={guardian}
            onChange={(e) => setGuardian(e.target.value)}
            placeholder={C.guardian[cs ? 'cs' : 'en']}
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs font-mono text-white"
          />
          <input
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder={C.signatureHex[cs ? 'cs' : 'en']}
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs font-mono text-white"
          />
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={C.daoKey[cs ? 'cs' : 'en']}
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs font-mono text-white"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy || !guardian.trim() || !signature.trim() || !apiKey}
              onClick={submitSignature}
              className="zion-button-secondary px-4 py-1.5 text-xs disabled:opacity-40"
            >
              {busy ? C.signing[cs ? 'cs' : 'en'] : C.sign[cs ? 'cs' : 'en']}
            </button>
            <button
              type="button"
              onClick={() => setShowSign(false)}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              {C.hideSignForm[cs ? 'cs' : 'en']}
            </button>
          </div>
          {msg && <p className="text-xs text-emerald-400">{msg}</p>}
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
      )}
    </div>
  );
}

/** Guardian console: pending treasury ops with verified-signature progress
 *  and an inline signing form (guardian signs `signing_hash` offline). */
export default function TreasuryOpsPanel({
  ops,
  emptyLabel,
  onChanged,
}: {
  ops: TreasuryOp[];
  emptyLabel: string;
  onChanged: () => void;
}) {
  if (ops.length === 0) {
    return <p className="text-sm text-gray-500">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-3">
      {ops.map((op) => (
        <OpRow key={op.op_id} op={op} onChanged={onChanged} />
      ))}
    </div>
  );
}
