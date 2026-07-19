"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Key,
  Loader2,
  MessageSquare,
  Shield,
  ShieldCheck,
  ShieldX,
  Signature,
  XCircle,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { SITE_RELEASE_LABEL } from "@/lib/site";
import { verifyMessage } from "@/lib/explorer/api";
import type { VerifyMessageResult } from "@/lib/explorer/types";

/* ── component ───────────────────────────────────────────────── */

export default function VerifyMessagePageClient() {
  const { lang } = useLang();
  const cs = lang === "cs";

  const [publicKey, setPublicKey] = useState("");
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyMessageResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setError(null);
    setResult(null);

    if (!publicKey.trim() || !message.trim() || !signature.trim()) {
      setError(cs ? "Vyplňte public key, zprávu a podpis" : "Fill in public key, message, and signature");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyMessage({
        publicKey: publicKey.trim(),
        message: message.trim(),
        signature: signature.trim(),
        address: address.trim() || undefined,
      });
      setResult(res);
      if (res.error && !res.valid) {
        setError(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setPublicKey("");
    setMessage("");
    setSignature("");
    setAddress("");
    setResult(null);
    setError(null);
  };

  /* ── render ──────────────────────────────────────────────── */

  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      {/* ── Background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-emerald-500/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-emerald-500/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-4xl space-y-10 pt-6 pb-8">
        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
          style={{ "--rc": "74, 222, 128" } as React.CSSProperties}
        >
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-emerald-300 uppercase">
              <ShieldCheck className="h-4 w-4" />
              {SITE_RELEASE_LABEL} · {cs ? "Verify" : "Verify"}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                {cs ? "Kryptografie" : "Cryptography"}
              </p>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                {cs ? "Ověření zprávy" : "Verify Message"}
              </h1>
            </div>
            <p className="text-lg text-gray-300 max-w-2xl">
              {cs
                ? "Ověřte Ed25519 podpis zprávy proti public key. Volitelně zkontrolujte, zda public key odpovídá ZION adrese."
                : "Verify an Ed25519 message signature against a public key. Optionally check that the public key matches a ZION address."}
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="zion-badge zion-badge-green">
                <Shield className="h-3 w-3" /> Ed25519
              </span>
              <span className="zion-badge text-zion-cyan border-zion-cyan/40 bg-zion-cyan/10">
                <Key className="h-3 w-3" /> {cs ? "Client-side verify" : "Client-side verify"}
              </span>
              <span className="zion-badge zion-badge-gold">
                <Signature className="h-3 w-3" /> @noble/ed25519
              </span>
            </div>
          </div>
        </motion.section>

        {/* ═══════ INPUT FORM ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <div className="zion-rainbow-card rounded-3xl bg-black/60 p-6 md:p-8" style={{ "--rc": "74, 222, 128" } as React.CSSProperties}>
            <div className="space-y-5">
              {/* Public Key */}
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                  <Key className="w-4 h-4 text-emerald-400" />
                  {cs ? "Public Key (hex)" : "Public Key (hex)"}
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder="ed25519 public key in hex (64 bytes = 128 hex chars)"
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm font-mono text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition"
                  spellCheck={false}
                />
              </div>

              {/* Message */}
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                  <MessageSquare className="w-4 h-4 text-zion-cyan" />
                  {cs ? "Zpráva" : "Message"}
                  <span className="text-rose-400">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="The message that was signed..."
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-zion-cyan/40 focus:ring-1 focus:ring-zion-cyan/20 transition resize-y"
                  spellCheck={false}
                />
              </div>

              {/* Signature */}
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                  <Signature className="w-4 h-4 text-zion-gold" />
                  {cs ? "Podpis (hex)" : "Signature (hex)"}
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="ed25519 signature in hex (64 bytes = 128 hex chars)"
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm font-mono text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-zion-gold/40 focus:ring-1 focus:ring-zion-gold/20 transition"
                  spellCheck={false}
                />
              </div>

              {/* Address (optional) */}
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                  <Shield className="w-4 h-4 text-zion-purple" />
                  {cs ? "ZION adresa (volitelné)" : "ZION Address (optional)"}
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="zion1... (if provided, checks that pubkey matches this address)"
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm font-mono text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-zion-purple/40 focus:ring-1 focus:ring-zion-purple/20 transition"
                  spellCheck={false}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {cs
                    ? "Pokud zadáno, ověří se že public key derivuje tuto ZION adresu (SHA-256 → RIPEMD-160 → base32)."
                    : "If provided, verifies that the public key derives this ZION address (SHA-256 → RIPEMD-160 → base32)."}
                </p>
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-4 pt-2">
                <button
                  onClick={handleVerify}
                  disabled={loading || !publicKey.trim() || !message.trim() || !signature.trim()}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-zion-cyan text-white font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-emerald-500/20"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {cs ? "Ověřuji…" : "Verifying…"}
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      {cs ? "Ověřit podpis" : "Verify Signature"}
                    </>
                  )}
                </button>
                <button
                  onClick={handleClear}
                  className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:bg-white/10 hover:text-white transition"
                >
                  {cs ? "Vyčistit" : "Clear"}
                </button>
              </div>
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
                result.valid
                  ? "border-emerald-500/30"
                  : "border-rose-500/30"
              }`}
              style={{ "--rc": result.valid ? "74, 222, 128" : "251, 113, 133" } as React.CSSProperties}
            >
              {/* Big status */}
              <div className="flex items-center gap-4 mb-6">
                {result.valid ? (
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                    <ShieldCheck className="w-8 h-8 text-emerald-400" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                    <ShieldX className="w-8 h-8 text-rose-400" />
                  </div>
                )}
                <div>
                  <h2 className={`text-3xl font-bold ${result.valid ? "text-emerald-400" : "text-rose-400"}`}>
                    {result.valid
                      ? cs ? "Podpis platný" : "Signature Valid"
                      : cs ? "Podpis neplatný" : "Signature Invalid"}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {result.algorithm && (
                      <span className="font-mono text-white/50">{result.algorithm}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Details grid */}
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Signature check */}
                <div className="zion-rainbow-sub p-4 rounded-xl" style={{ "--rc": result.valid ? "74, 222, 128" : "251, 113, 133" } as React.CSSProperties}>
                  <div className="flex items-center gap-2 mb-2">
                    {result.valid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span className="text-xs text-gray-400 uppercase tracking-wider">
                      {cs ? "Ed25519 podpis" : "Ed25519 Signature"}
                    </span>
                  </div>
                  <div className={`text-sm font-bold ${result.valid ? "text-emerald-400" : "text-rose-400"}`}>
                    {result.valid
                      ? cs ? "Podpis odpovídá public key" : "Signature matches public key"
                      : cs ? "Podpis neodpovídá public key" : "Signature does not match public key"}
                  </div>
                </div>

                {/* Address match check */}
                {result.providedAddress && (
                  <div className="zion-rainbow-sub p-4 rounded-xl" style={{ "--rc": result.addressMatch ? "74, 222, 128" : "251, 113, 133" } as React.CSSProperties}>
                    <div className="flex items-center gap-2 mb-2">
                      {result.addressMatch ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                      <span className="text-xs text-gray-400 uppercase tracking-wider">
                        {cs ? "Shoda adresy" : "Address Match"}
                      </span>
                    </div>
                    <div className={`text-sm font-bold ${result.addressMatch ? "text-emerald-400" : "text-rose-400"}`}>
                      {result.addressMatch
                        ? cs ? "Public key → adresa OK" : "Public key → address OK"
                        : cs ? "Public key neodpovídá adrese" : "Public key does not match address"}
                    </div>
                  </div>
                )}

                {/* Derived address */}
                {result.address && (
                  <div className="zion-rainbow-sub p-4 rounded-xl" style={{ "--rc": "6, 182, 212" } as React.CSSProperties}>
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                      {cs ? "Derivovaná adresa" : "Derived Address"}
                    </div>
                    <code className="text-sm font-mono text-zion-cyan break-all">
                      {result.address}
                    </code>
                  </div>
                )}

                {/* Provided address */}
                {result.providedAddress && (
                  <div className="zion-rainbow-sub p-4 rounded-xl" style={{ "--rc": "168, 85, 247" } as React.CSSProperties}>
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                      {cs ? "Zadaná adresa" : "Provided Address"}
                    </div>
                    <code className="text-sm font-mono text-zion-purple break-all">
                      {result.providedAddress}
                    </code>
                  </div>
                )}
              </div>

              {/* Error detail */}
              {result.error && !result.valid && (
                <div className="mt-4 p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
                  <div className="text-xs text-rose-400 uppercase tracking-wider mb-1">
                    {cs ? "Detail chyby" : "Error detail"}
                  </div>
                  <code className="text-sm font-mono text-rose-300 break-all">
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
            <div className="zion-rainbow-card rounded-2xl bg-black/60 p-6 border-2 border-rose-500/30" style={{ "--rc": "251, 113, 133" } as React.CSSProperties}>
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-rose-400" />
                <div>
                  <h3 className="text-lg font-bold text-rose-400">
                    {cs ? "Chyba" : "Error"}
                  </h3>
                  <code className="text-sm font-mono text-rose-300 break-all">
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
          <div className="zion-rainbow-card rounded-2xl bg-black/60 p-6" style={{ "--rc": "74, 222, 128" } as React.CSSProperties}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-white">
                  {cs ? "Jak ověřování funguje" : "How verification works"}
                </h3>
                <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                  <li>
                    {cs
                      ? "Ed25519 podpis se ověřuje proti public key pomocí @noble/ed25519 knihovny (client-side, žádný RPC)."
                      : "Ed25519 signature is verified against the public key using @noble/ed25519 library (client-side, no RPC)."}
                  </li>
                  <li>
                    {cs
                      ? "ZION adresa: SHA-256(pubkey) → RIPEMD-160 → custom base32 → zion1 prefix + 4-char checksum."
                      : "ZION address: SHA-256(pubkey) → RIPEMD-160 → custom base32 → zion1 prefix + 4-char checksum."}
                  </li>
                  <li>
                    {cs
                      ? "Public key nelze extrahovat z adresy (jednosměrný hash). Lze pouze ověřit, zda pubkey odpovídá adrese."
                      : "Public key cannot be extracted from address (one-way hash). You can only verify whether a pubkey matches an address."}
                  </li>
                  <li>
                    {cs
                      ? "Algoritmus: Ed25519 (Edwards-curve Digital Signature Algorithm, RFC 8032)."
                      : "Algorithm: Ed25519 (Edwards-curve Digital Signature Algorithm, RFC 8032)."}
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
