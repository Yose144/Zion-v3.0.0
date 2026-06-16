'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

// Sacred geometry background pattern
function SacredGeometry() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden opacity-20">
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="grad1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00ffcc" />
            <stop offset="50%" stopColor="#ff00cc" />
            <stop offset="100%" stopColor="#ffcc00" />
          </linearGradient>
        </defs>
        <g stroke="url(#grad1)" strokeWidth="0.2" strokeLinecap="round">
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={i} x1="0" y1={i * 5} x2="100" y2={(i * 5 + 10) % 100} />
          ))}
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={i + 20} x1={i * 5} y1="0" x2={(i * 5 + 10) % 100} y2="100" />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black" />
    </div>
  );
}

// Fractal flower animation
function FractalFlower() {
  return (
    <div className="absolute top-20 right-20 w-64 h-64 opacity-30 pointer-events-none">
      <svg viewBox="0 0 100 100" className="w-full h-full animate-spin" style={{ animationDuration: '60s' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <g key={i} transform={`rotate(${i * 45} 50 50)`}>
            <path
              d="M50 20 C60 35, 70 35, 80 50 C70 65, 60 65, 50 80 C40 65, 30 65, 20 50 C30 35, 40 35, 50 20"
              fill="none"
              stroke="#00ffcc"
              strokeWidth="0.5"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

// Balance display with animated counter
function BalanceDisplay({ balance }: { balance: string }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative"
    >
      <div className="text-sm text-white/50 mb-2">TOTAL BALANCE</div>
      <div className="text-5xl font-extralight bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
        {balance} ZION
      </div>
      <div className="text-white/30 text-sm mt-1">≈ $1,250.00 USD</div>
    </motion.div>
  );
}

// Wallet address with copy
function WalletAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
      <div className="text-xs text-white/50 mb-2">WALLET ADDRESS</div>
      <div className="font-mono text-sm mb-3 break-all">{address}</div>
      <button
        onClick={copyToClipboard}
        className="px-4 py-2 bg-cyan-500/20 rounded-lg text-cyan-400 hover:bg-cyan-500/30 transition-all text-sm"
      >
        {copied ? '✓ Copied!' : 'Copy Address'}
      </button>
    </div>
  );
}

// Action button
function ActionButton({ label, icon, onClick }: { label: string; icon: string; onClick?: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05, backgroundColor: 'rgba(0, 255, 204, 0.3)' }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex items-center gap-3 px-6 py-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:border-cyan-500/50 transition-all"
    >
      <span className="text-2xl">{icon}</span>
      <span className="font-light">{label}</span>
    </motion.button>
  );
}

// Recent transactions
function RecentTransactions() {
  const transactions = [
    { hash: '0x7a...f3c', amount: '+5.4 ZION', time: '2 min ago', type: 'receive' },
    { hash: '0x9b...e2a', amount: '-0.23 ZION', time: '1 hour ago', type: 'send' },
    { hash: '0x3c...a1b', amount: '+0.05 ZION', time: '5 hours ago', type: 'mining' },
  ];

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
      <div className="text-sm text-white/50 mb-4">RECENT TRANSACTIONS</div>
      {transactions.map((tx, i) => (
        <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
          <div>
            <div className="font-mono text-xs">{tx.hash}</div>
            <div className="text-white/30 text-xs">{tx.time}</div>
          </div>
          <div className={`font-light ${tx.type === 'receive' ? 'text-green-400' : tx.type === 'send' ? 'text-red-400' : 'text-cyan-400'}`}>
            {tx.amount}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WalletPage() {
  const address = 'zion1abc8def3ghi5jkl7mno9pqr2stu4vwx6yza8bcd0efg';

  return (
    <div className="min-h-screen bg-black text-white relative">
      <SacredGeometry />
      <FractalFlower />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 px-8 py-4 backdrop-blur-md bg-black/30 border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/">
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent cursor-pointer">
              ZION WEB3.0
            </span>
          </Link>
          <Link href="/hiran">
            <span className="text-sm cursor-pointer hover:text-cyan-400 transition-colors">HIRAN AI</span>
          </Link>
        </div>
      </nav>

      <main className="pt-20 px-8">
        <section className="max-w-5xl mx-auto py-16">
          <h1 className="text-5xl md:text-7xl mb-16 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            FRACTAL WALLET
          </h1>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left - Balance */}
            <div className="lg:col-span-2">
              <BalanceDisplay balance="1,247.55" />
              <WalletAddress address={address} />
            </div>

            {/* Right - Actions */}
            <div className="space-y-4">
              <ActionButton label="Send ZION" icon="📤" />
              <ActionButton label="Receive ZION" icon="📥" />
              <ActionButton label="Connect Hardware" icon="🔐" />
              <ActionButton label="Bridge to EVM" icon="🌉" />
            </div>
          </div>
        </section>

        {/* Transactions */}
        <section className="max-w-5xl mx-auto pb-16">
          <RecentTransactions />
        </section>

        {/* Sacred Geometry Explanation */}
        <section className="max-w-4xl mx-auto pb-16">
          <h2 className="text-2xl text-cyan-400 mb-8">FRACTAL SECURITY</h2>
          <p className="text-white/60 leading-relaxed">
            Your wallet security is derived from fractal mathematics. Each transaction is processed through
            a multi-layer consciousness validation, ensuring both cryptographic integrity and ethical alignment.
            Mining rewards are automatically distributed with a portion contributed to humanitarian causes.
          </p>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8 px-8 text-center text-white/40">
        <p>ZION Web3.0 - Conscious Wallet Technology</p>
      </footer>
    </div>
  );
}