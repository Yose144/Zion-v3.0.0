"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Code,
  FileJson,
  Hash,
  Loader2,
  Radio,
  Send,
  Zap,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { SITE_RELEASE_LABEL } from "@/lib/site";
import { broadcastTransaction, broadcastRaw } from "@/lib/explorer/api";
import type { BroadcastResult } from "@/lib/explorer/types";

const ExplorerBroadcastBroadcastPageClientCopy = {
  emptyPayload: { cs: `Prázdný payload`, en: `Empty payload` },
  invalidJson: { cs: `Neplatný JSON`, en: `Invalid JSON` },
  broadcast: { cs: `Broadcast`, en: `Broadcast` },
  submit: { cs: `Odeslat`, en: `Submit` },
  broadcastTransaction: { cs: `Broadcast transakce`, en: `Broadcast Transaction` },
  submitASignedTransactionToTheZ: { cs: `Odešlete podepsanou transakci do ZION sítě. Podporuje account-model JSON i raw hex formát.`, en: `Submit a signed transaction to the ZION network. Supports account-model JSON and raw hex format.` },
  transactionsMustBeSignedBefore: { cs: `Transakce musí být podepsána před odesláním. Tento nástroj nepodepisuje — pouze odesílá již podepsaná data do sítě.`, en: `Transactions must be signed before broadcasting. This tool does not sign — it only submits already-signed data to the network.` },
  format: { cs: `Formát:`, en: `Format:` },
  model: { cs: `Model:`, en: `Model:` },
  loadExample: { cs: `Načíst příklad`, en: `Load example` },
  broadcasting: { cs: `Odesílám…`, en: `Broadcasting…` },
  broadcastTransaction_2: { cs: `Odeslat transakci`, en: `Broadcast Transaction` },
  clear: { cs: `Vyčistit`, en: `Clear` },
  transactionAccepted: { cs: `Transakce přijata`, en: `Transaction Accepted` },
  transactionRejected: { cs: `Transakce zamítnuta`, en: `Transaction Rejected` },
  transactionId: { cs: `ID transakce`, en: `Transaction ID` },
  view: { cs: `Zobrazit`, en: `View` },
  error: { cs: `Chyba`, en: `Error` },
  howToBroadcast: { cs: `Jak broadcastovat`, en: `How to broadcast` },
  accountModelSignTheTransaction: { cs: `Account-model: podepište transakci pomocí wallet SDK, vložte JSON s from/to/amount/fee/nonce/public_key/signature.`, en: `Account-model: sign the transaction using the wallet SDK, paste JSON with from/to/amount/fee/nonce/public_key/signature.` },
  utxoModelUseTheSubmittransacti: { cs: `UTXO model: použijte submitTransaction RPC formát s inputs/outputs.`, en: `UTXO model: use the submitTransaction RPC format with inputs/outputs.` },
  rawHexForPreSignedBinaryTransa: { cs: `Raw hex: pro pre-signed binární transakce v hex formátu.`, en: `Raw hex: for pre-signed binary transactions in hex format.` },
  afterSuccessfulBroadcastYouRec: { cs: `Po úspěšném broadcastu dostanete tx_id pro sledování v průzkumníku.`, en: `After successful broadcast you receive a tx_id to track in the explorer.` },
};

/* ── component ───────────────────────────────────────────────── */

type InputMode = "json" | "hex";
type TxModel = "account" | "utxo";

export default function BroadcastPageClient() {
  const { lang } = useLang();
  const cs = lang === "cs";

  const [mode, setMode] = useState<InputMode>("json");
  const [txModel, setTxModel] = useState<TxModel>("account");
  const [payload, setPayload] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBroadcast = async () => {
    setError(null);
    setResult(null);

    if (!payload.trim()) {
      setError(ExplorerBroadcastBroadcastPageClientCopy.emptyPayload[cs ? 'cs' : 'en']);
      return;
    }

    setLoading(true);
    try {
      let res: BroadcastResult;
      if (mode === "hex") {
        res = await broadcastRaw(payload.trim());
      } else {
        // Parse JSON
        let parsed: unknown;
        try {
          parsed = JSON.parse(payload);
        } catch {
          setError(ExplorerBroadcastBroadcastPageClientCopy.invalidJson[cs ? 'cs' : 'en']);
          setLoading(false);
          return;
        }
        res = await broadcastTransaction(parsed, txModel);
      }
      setResult(res);
      if (!res.accepted && res.error) {
        setError(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const examples: Record<InputMode, string> = {
    json: JSON.stringify(
      {
        from: "zion1example0000000000000000000000000000",
        to: "zion1recipient000000000000000000000000000",
        amount: 100,
        fee: 0.001,
        nonce: 1,
        public_key: "ed25519_public_key_hex",
        signature: "ed25519_signature_hex",
        memo: "",
      },
      null,
      2,
    ),
    hex: "0x...raw_transaction_hex...",
  };

  const loadExample = () => {
    setPayload(examples[mode]);
  };

  /* ── render ──────────────────────────────────────────────── */

  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      {/* ── Background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-purple/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-cyan/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-purple/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-4xl space-y-10 pt-6 pb-8">
        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
          style={{ "--rc": "251, 113, 133" } as React.CSSProperties}
        >
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-zion-purple/40 bg-zion-purple/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-purple uppercase">
              <Radio className="h-4 w-4" />
              {SITE_RELEASE_LABEL} · {ExplorerBroadcastBroadcastPageClientCopy.broadcast[cs ? 'cs' : 'en']}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                {ExplorerBroadcastBroadcastPageClientCopy.submit[cs ? 'cs' : 'en']}
              </p>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                {ExplorerBroadcastBroadcastPageClientCopy.broadcastTransaction[cs ? 'cs' : 'en']}
              </h1>
            </div>
            <p className="text-lg text-gray-300 max-w-2xl">
              {ExplorerBroadcastBroadcastPageClientCopy.submitASignedTransactionToTheZ[cs ? 'cs' : 'en']}
            </p>
            {/* Warning */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-zion-gold/5 border border-zion-gold/20">
              <AlertCircle className="w-5 h-5 text-zion-gold flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-200/80">
                {ExplorerBroadcastBroadcastPageClientCopy.transactionsMustBeSignedBefore[cs ? 'cs' : 'en']}
              </p>
            </div>
          </div>
        </motion.section>

        {/* ═══════ INPUT FORM ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <div className="zion-rainbow-card rounded-3xl bg-black/60 p-6 md:p-8" style={{ "--rc": "251, 113, 133" } as React.CSSProperties}>
            {/* Mode selector */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">{ExplorerBroadcastBroadcastPageClientCopy.format[cs ? 'cs' : 'en']}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMode("json")}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      mode === "json"
                        ? "bg-zion-cyan/15 text-zion-cyan border border-zion-cyan/30"
                        : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    <FileJson className="w-3.5 h-3.5" />
                    JSON
                  </button>
                  <button
                    onClick={() => setMode("hex")}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      mode === "hex"
                        ? "bg-zion-gold/15 text-zion-gold border border-zion-gold/30"
                        : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5" />
                    Raw Hex
                  </button>
                </div>
              </div>

              {/* TX model selector (only for JSON mode) */}
              {mode === "json" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">{ExplorerBroadcastBroadcastPageClientCopy.model[cs ? 'cs' : 'en']}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTxModel("account")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                        txModel === "account"
                          ? "bg-zion-cyan/15 text-zion-cyan border border-zion-cyan/30"
                          : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      account
                    </button>
                    <button
                      onClick={() => setTxModel("utxo")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                        txModel === "utxo"
                          ? "bg-zion-purple/15 text-zion-purple border border-zion-purple/30"
                          : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      utxo
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={loadExample}
                className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60 hover:bg-white/10 hover:text-white transition"
              >
                <Code className="w-3.5 h-3.5" />
                {ExplorerBroadcastBroadcastPageClientCopy.loadExample[cs ? 'cs' : 'en']}
              </button>
            </div>

            {/* Textarea */}
            <div className="relative">
              <textarea
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                placeholder={
                  mode === "json"
                    ? '{\n  "from": "zion1...",\n  "to": "zion1...",\n  "amount": 100,\n  ...\n}'
                    : "0x...raw_transaction_hex..."
                }
                rows={12}
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-mono text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-zion-cyan/40 focus:ring-1 focus:ring-zion-cyan/20 transition resize-y"
                spellCheck={false}
              />
            </div>

            {/* Submit button */}
            <div className="flex items-center gap-4 mt-6">
              <button
                onClick={handleBroadcast}
                disabled={loading || !payload.trim()}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-zion-purple to-zion-cyan text-white font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-zion-purple/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {ExplorerBroadcastBroadcastPageClientCopy.broadcasting[cs ? 'cs' : 'en']}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {ExplorerBroadcastBroadcastPageClientCopy.broadcastTransaction_2[cs ? 'cs' : 'en']}
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setPayload("");
                  setResult(null);
                  setError(null);
                }}
                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:bg-white/10 hover:text-white transition"
              >
                {ExplorerBroadcastBroadcastPageClientCopy.clear[cs ? 'cs' : 'en']}
              </button>
            </div>
          </div>
        </motion.section>

        {/* ═══════ RESULT ═══════ */}
        {result && (
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              className={`zion-rainbow-card rounded-3xl bg-black/60 p-6 md:p-8 border-2 ${
                result.accepted
                  ? "border-zion-cyan/30"
                  : "border-zion-purple/30"
              }`}
              style={{ "--rc": result.accepted ? "74, 222, 128" : "251, 113, 133" } as React.CSSProperties}
            >
              <div className="flex items-center gap-4 mb-4">
                {result.accepted ? (
                  <CheckCircle2 className="w-8 h-8 text-zion-cyan" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-zion-purple" />
                )}
                <div>
                  <h2 className={`text-2xl font-bold ${result.accepted ? "text-zion-cyan" : "text-zion-purple"}`}>
                    {result.accepted
                      ? ExplorerBroadcastBroadcastPageClientCopy.transactionAccepted[cs ? 'cs' : 'en']
                      : ExplorerBroadcastBroadcastPageClientCopy.transactionRejected[cs ? 'cs' : 'en']}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {result.method && (
                      <span className="font-mono text-white/50">via {result.method}</span>
                    )}
                  </p>
                </div>
              </div>

              {result.tx_id && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-400 uppercase tracking-wider">
                    {ExplorerBroadcastBroadcastPageClientCopy.transactionId[cs ? 'cs' : 'en']}
                  </div>
                  <div className="flex items-center gap-3">
                    <code className="text-sm font-mono text-zion-cyan break-all">
                      {result.tx_id}
                    </code>
                    <Link
                      href={`/explorer/tx?hash=${result.tx_id}`}
                      className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-zion-cyan/10 border border-zion-cyan/20 text-xs text-zion-cyan hover:bg-zion-cyan/20 transition"
                    >
                      {ExplorerBroadcastBroadcastPageClientCopy.view[cs ? 'cs' : 'en']}
                    </Link>
                  </div>
                </div>
              )}

              {result.error && (
                <div className="mt-4 p-4 rounded-xl bg-zion-purple/5 border border-zion-purple/20">
                  <div className="text-xs text-zion-purple uppercase tracking-wider mb-1">
                    {ExplorerBroadcastBroadcastPageClientCopy.error[cs ? 'cs' : 'en']}
                  </div>
                  <code className="text-sm font-mono text-zion-purple break-all">
                    {result.error}
                  </code>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* ═══════ ERROR ═══════ */}
        {error && !result && (
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="zion-rainbow-card rounded-2xl bg-black/60 p-6 border-2 border-zion-purple/30" style={{ "--rc": "251, 113, 133" } as React.CSSProperties}>
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-zion-purple" />
                <div>
                  <h3 className="text-lg font-bold text-zion-purple">
                    {ExplorerBroadcastBroadcastPageClientCopy.error[cs ? 'cs' : 'en']}
                  </h3>
                  <code className="text-sm font-mono text-zion-purple break-all">
                    {error}
                  </code>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* ═══════ INFO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="zion-rainbow-card rounded-2xl bg-black/60 p-6" style={{ "--rc": "7, 137, 48" } as React.CSSProperties}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-zion-cyan/10 border border-zion-cyan/20 flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-zion-cyan" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-white">
                  {ExplorerBroadcastBroadcastPageClientCopy.howToBroadcast[cs ? 'cs' : 'en']}
                </h3>
                <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                  <li>
                    {ExplorerBroadcastBroadcastPageClientCopy.accountModelSignTheTransaction[cs ? 'cs' : 'en']}
                  </li>
                  <li>
                    {ExplorerBroadcastBroadcastPageClientCopy.utxoModelUseTheSubmittransacti[cs ? 'cs' : 'en']}
                  </li>
                  <li>
                    {ExplorerBroadcastBroadcastPageClientCopy.rawHexForPreSignedBinaryTransa[cs ? 'cs' : 'en']}
                  </li>
                  <li>
                    {ExplorerBroadcastBroadcastPageClientCopy.afterSuccessfulBroadcastYouRec[cs ? 'cs' : 'en']}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
