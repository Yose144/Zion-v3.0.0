'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { CSSProperties } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import { ArrowLeft, ArrowRightLeft, Lock, Shield, ExternalLink, Copy, Flame, CheckCircle2 } from 'lucide-react';
import { BRIDGE_CONTRACTS } from '@/lib/bridge-api';
import { CONTRACTS } from '@/lib/defi-contracts';

// BridgeBurnWidget uses browser-only hooks (ethers, WalletContext) — disable SSR.
const BridgeBurnWidget = dynamic(() => import('@/components/BridgeBurnWidget'), {
  ssr: false,
  loading: () => (
    <div className="zion-rainbow-card p-6 md:p-10 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-white/10 mb-4" />
      <div className="h-4 w-96 max-w-full rounded bg-white/5 mb-2" />
      <div className="h-4 w-64 rounded bg-white/5" />
    </div>
  ),
});

const CopyText = {
  title: { cs: 'Bridge', en: 'Bridge' },
  subtitle: {
    cs: 'Převod ZION ↔ wZION mezi L1 a Base. Lock ZION na L1 → mint wZION na Base. Burn wZION → unlock ZION na L1.',
    en: 'Transfer ZION ↔ wZION between L1 and Base. Lock ZION on L1 → mint wZION on Base. Burn wZION → unlock ZION on L1.',
  },
  back: { cs: 'Zpět na peněženku', en: 'Back to wallet' },
  staking: { cs: 'Staking', en: 'Staking' },
  lock: { cs: 'Lock (ZION → wZION)', en: 'Lock (ZION → wZION)' },
  burn: { cs: 'Burn (wZION → ZION)', en: 'Burn (wZION → ZION)' },
  lockDesc: {
    cs: 'Pošlete ZION na bridge vault adresu na L1 s memo formátem BRIDGE:base:<vaše_evm_adresa>. Validators mint wZION na vaši EVM adresu po finalitě (60 bloků).',
    en: 'Send ZION to the bridge vault address on L1 with memo format BRIDGE:base:<your_evm_address>. Validators mint wZION to your EVM address after finality (60 blocks).',
  },
  bridgeVault: { cs: 'Bridge Vault (L1)', en: 'Bridge Vault (L1)' },
  memoFormat: { cs: 'Memo formát', en: 'Memo format' },
  yourEvmAddress: { cs: 'vaše EVM adresa', en: 'your EVM address' },
  copy: { cs: 'Kopírovat', en: 'Copy' },
  copied: { cs: 'Zkopírováno!', en: 'Copied!' },
  fullBridgePage: { cs: 'Otevřít plnou bridge stránku', en: 'Open full bridge page' },
  bridgeContract: { cs: 'Bridge kontrakt (Base)', en: 'Bridge contract (Base)' },
  wzionContract: { cs: 'wZION kontrakt (Base)', en: 'wZION contract (Base)' },
  validators: { cs: '5/5 Guardian validátoři', en: '5/5 Guardian validators' },
  timelock: { cs: 'Timelock pro velké částky (≥1M wZION): 24h', en: 'Timelock for large amounts (≥1M wZION): 24h' },
  finality: { cs: 'L1 finalita: 60 bloků', en: 'L1 finality: 60 blocks' },
};

export default function BridgePage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const t = (key: keyof typeof CopyText) => CopyText[key][cs ? 'cs' : 'en'];
  const [copied, setCopied] = useState(false);

  const bridgeVaultAddress = 'zion1j3w3h7k8m635h734y786j5804305m822t5uk546';

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="zion-page text-white min-h-screen">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-zion-purple/18 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-zion-cyan/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-zion-gold/10 blur-3xl" />
      </div>

      <div className="zion-container relative z-10 max-w-7xl space-y-8 pt-8">
        {/* Hero header */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="zion-rainbow-card p-6 md:p-10"
            style={{ '--rc': '6, 182, 212' } as CSSProperties}
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <Link
                  href="/wallet/multichain"
                  className="inline-flex items-center gap-2 text-sm text-zion-cyan hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('back')}
                </Link>
                <div className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/40 bg-zion-cyan/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-cyan uppercase">
                  <ArrowRightLeft className="h-4 w-4" />
                  {t('title')}
                </div>
                <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                  {t('title')}
                </h1>
                <p className="text-lg text-gray-300 max-w-2xl">{t('subtitle')}</p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/wallet/staking"
                  className="zion-button-secondary inline-flex items-center gap-2"
                >
                  <Shield className="h-4 w-4" />
                  {t('staking')}
                </Link>
                <Link
                  href="/bridge"
                  className="zion-button-primary inline-flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('fullBridgePage')}
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Lock section (L1 → L2) */}
        <section>
          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '147, 51, 234' } as CSSProperties}>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5 text-zion-purple" />
              {t('lock')}
            </h2>
            <p className="text-sm text-gray-300 mb-6">{t('lockDesc')}</p>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Bridge vault address */}
              <div className="zion-rainbow-sub p-4">
                <label className="block text-xs text-gray-400 mb-2">{t('bridgeVault')}</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono text-zion-gold break-all">
                    {bridgeVaultAddress}
                  </code>
                  <button
                    onClick={() => handleCopy(bridgeVaultAddress)}
                    className="rounded-lg border border-white/10 bg-black/40 p-2 hover:border-zion-gold/40"
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Memo format */}
              <div className="zion-rainbow-sub p-4">
                <label className="block text-xs text-gray-400 mb-2">{t('memoFormat')}</label>
                <code className="text-sm font-mono text-zion-cyan break-all">
                  BRIDGE:base:&lt;{t('yourEvmAddress')}&gt;
                </code>
              </div>
            </div>

            {/* Info row */}
            <div className="mt-4 grid gap-2 md:grid-cols-3 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-zion-cyan" />
                {t('validators')}
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-3 w-3 text-zion-gold" />
                {t('timelock')}
              </div>
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-3 w-3 text-zion-purple" />
                {t('finality')}
              </div>
            </div>
          </div>
        </section>

        {/* Burn section (L2 → L1) */}
        <section>
          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '228, 30, 43' } as CSSProperties}>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Flame className="h-5 w-5 text-red-400" />
              {t('burn')}
            </h2>
            <BridgeBurnWidget />
          </div>
        </section>

        {/* Contract addresses */}
        <section>
          <div className="zion-rainbow-card p-6" style={{ '--rc': '100, 100, 100' } as CSSProperties}>
            <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">
              {cs ? 'Kontrakty' : 'Contracts'}
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('bridgeContract')}</label>
                <code className="text-xs font-mono text-gray-300 break-all">
                  {CONTRACTS.ZIONBridge}
                </code>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('wzionContract')}</label>
                <code className="text-xs font-mono text-gray-300 break-all">
                  {CONTRACTS.wZION}
                </code>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
