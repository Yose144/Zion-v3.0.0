'use client';

import { useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useZionWallet } from '@/contexts/ZionWalletContext';
import {
  Wallet, Plus, Import, Send, RefreshCw, Trash2, Copy, Eye, EyeOff,
  Shield, KeyRound, Download, BookOpen, Lock, Fingerprint,
  Zap, Globe2, Usb, AlertTriangle, Activity, ArrowRight,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const WalletCopy = {
  ed25519: { cs: `Ed25519`, en: `Ed25519` },
  stateOfTheArtCurveCryptography: { cs: `Nejmodernější křivková kryptografie — rychlé a bezpečné podpisy.`, en: `State-of-the-art curve cryptography — fast and secure signatures.` },
  bip39Mnemonic: { cs: `BIP39 Mnemonic`, en: `BIP39 Mnemonic` },
  k1224WordSeedForEasyBackupAndRe: { cs: `12–24 slovní seed pro snadné zálohování a obnovení.`, en: `12–24 word seed for easy backup and recovery.` },
  utxoModel: { cs: `UTXO Model`, en: `UTXO Model` },
  nativeZionL1UtxoModelTranspare: { cs: `Nativní UTXO model ZION L1 — transparentní a auditovatelný.`, en: `Native ZION L1 UTXO model — transparent and auditable.` },
  onChain: { cs: `On-Chain`, en: `On-Chain` },
  fullyOnChainWalletNoCustodialS: { cs: `Plně on-chain wallet — žádné custodial služby.`, en: `Fully on-chain wallet — no custodial services.` },
  initializingZionWallet: { cs: `Inicializace ZION Wallet...`, en: `Initializing ZION Wallet...` },
  passwordMustBeAtLeast8Characte: { cs: `Heslo musí mít alespoň 8 znaků`, en: `Password must be at least 8 characters` },
  walletCreatedYouCanNowSignIn: { cs: `Peněženka vytvořena! Nyní se můžete přihlásit.`, en: `Wallet created! You can now sign in.` },
  mnemonicAndPasswordRequired: { cs: `Vyžadováno mnemonic a heslo`, en: `Mnemonic and password required` },
  walletImportedSuccessfully: { cs: `Peněženka importována!`, en: `Wallet imported successfully!` },
  privateKeyAndPasswordRequired: { cs: `Vyžadován private key a heslo`, en: `Private key and password required` },
  fillAllRequiredFields: { cs: `Vyplňte všechna povinná pole`, en: `Fill all required fields` },
  trezorWalletConnected: { cs: `Trezor peněženka připojena!`, en: `Trezor wallet connected!` },
  ledgerWalletConnected: { cs: `Ledger peněženka připojena!`, en: `Ledger wallet connected!` },
  copiedToClipboard: { cs: `Zkopírováno do schránky!`, en: `Copied to clipboard!` },
  noWallet: { cs: `Žádná peněženka`, en: `No wallet` },
  watchOnly: { cs: `Watch-only`, en: `Watch-only` },
  software: { cs: `Software`, en: `Software` },
  hardware: { cs: `Hardware`, en: `Hardware` },
  local: { cs: `Lokalní`, en: `Local` },
  nativeZionBlockchainWallet: { cs: `Nativní peněženka ZION blockchainu`, en: `Native ZION blockchain wallet` },
  zionWallet: { cs: `ZION Wallet`, en: `ZION Wallet` },
  fullyOnChainWalletForZionL1Cre: { cs: `Plně on-chain peněženka pro ZION L1. Vytvořte, importujte, odešlete a zálohujte své ZION tokeny s Ed25519 kryptografií a UTXO modelem. Žádné custodial služby — plná kontrola nad klíči.`, en: `Fully on-chain wallet for ZION L1. Create, import, send, and back up your ZION tokens with Ed25519 cryptography and UTXO model. No custodial services — full key control.` },
  localOnly: { cs: `Local-only`, en: `Local-only` },
  quickOverview: { cs: `Rychlý přehled`, en: `Quick Overview` },
  wallet: { cs: `Peněženka`, en: `Wallet` },
  address: { cs: `Adresa`, en: `Address` },
  balance: { cs: `Zůstatek`, en: `Balance` },
  telemetry: { cs: `Telemetrie`, en: `Telemetry` },
  walletStatistics: { cs: `Statistiky peněženky`, en: `Wallet Statistics` },
  currentMetricsFromYourLocalZio: { cs: `Aktuální metriky z lokální ZION Wallet.`, en: `Current metrics from your local ZION Wallet.` },
  wallets: { cs: `Peněženky`, en: `Wallets` },
  total: { cs: `celkem`, en: `total` },
  activeBalance: { cs: `Aktivní zůstatek`, en: `Active Balance` },
  cryptography: { cs: `Kryptografie`, en: `Cryptography` },
  security: { cs: `Zabezpečení`, en: `Security` },
  level: { cs: `úroveň`, en: `level` },
  features: { cs: `Vlastnosti`, en: `Features` },
  whyZionWallet: { cs: `Proč ZION Wallet?`, en: `Why ZION Wallet?` },
  goToLogin: { cs: `Přejít na přihlášení`, en: `Go to Login` },
  activeWallet: { cs: `Aktivní peněženka`, en: `Active Wallet` },
  hardwareWalletWatchOnly: { cs: `Hardware peněženka — pouze pro sledování`, en: `Hardware Wallet — Watch Only` },
  trezorLedgerFirmwareDoesNotYet: { cs: `Trezor/Ledger firmware zatím nepodporuje podepisování transakcí pro ZION. Pro odeslání tokenů použijte software peněženku se stejným seedem (méně bezpečné) nebo počkejte na Ledger aplikaci.`, en: `Trezor/Ledger firmware does not yet support transaction signing for ZION. To send tokens, use a software wallet with the same seed (less secure) or wait for the Ledger app.` },
  yourWallets: { cs: `Vaše peněženky`, en: `Your Wallets` },
  walletOperations: { cs: `Peněženkové operace`, en: `Wallet operations` },
  createNewWallet: { cs: `Vytvořit novou peněženku`, en: `Create New Wallet` },
  walletName: { cs: `Název peněženky`, en: `Wallet Name` },
  passwordMin8Chars: { cs: `Heslo (min. 8 znaků)`, en: `Password (min 8 chars)` },
  creating: { cs: `Vytváření...`, en: `Creating...` },
  createWallet: { cs: `Vytvořit peněženku`, en: `Create Wallet` },
  importWallet: { cs: `Importovat peněženku`, en: `Import Wallet` },
  fromMnemonicBip39: { cs: `Z Mnemonic (BIP39)`, en: `From Mnemonic (BIP39)` },
  enter12Or24WordMnemonicPhrase: { cs: `Zadejte 12 nebo 24 slovní frázi...`, en: `Enter 12 or 24 word mnemonic phrase...` },
  encryptionPassword: { cs: `Šifrovací heslo`, en: `Encryption password` },
  importing: { cs: `Importování...`, en: `Importing...` },
  importFromMnemonic: { cs: `Importovat z Mnemonic`, en: `Import from Mnemonic` },
  fromPrivateKeyHex: { cs: `Z Private Key (hex)`, en: `From Private Key (hex)` },
  k64CharHexPrivateKey: { cs: `64-znakový hex private key`, en: `64-char hex private key` },
  importFromPrivateKey: { cs: `Importovat z Private Key`, en: `Import from Private Key` },
  hardwareWalletWatchOnly_2: { cs: `Hardware peněženka (Watch-only)`, en: `Hardware Wallet (Watch-only)` },
  importPublicKeyFromTrezorOrLed: { cs: `Importujte veřejný klíč z Trezoru nebo Ledgeru.`, en: `Import public key from Trezor or Ledger.` },
  connecting: { cs: `Připojování...`, en: `Connecting...` },
  warningTrezorLedgerFirmwareDoe: { cs: `Varování: Trezor/Ledger firmware zatím neumožňuje podepisování transakcí pro ZION. Peněženka bude pouze pro sledování.`, en: `Warning: Trezor/Ledger firmware does not yet support transaction signing for ZION. Wallet will be watch-only.` },
  sendZion: { cs: `Odeslat ZION`, en: `Send ZION` },
  selectOrCreateAWalletFirst: { cs: `Nejprve vyberte nebo vytvořte peněženku.`, en: `Select or create a wallet first.` },
  recipientAddressZion1: { cs: `Adresa příjemce (zion1...)`, en: `Recipient Address (zion1...)` },
  amountZion: { cs: `Částka (ZION)`, en: `Amount (ZION)` },
  memoOptional: { cs: `Memo (volitelné)`, en: `Memo (optional)` },
  optionalMessage: { cs: `Volitelná zpráva...`, en: `Optional message...` },
  walletPassword: { cs: `Heslo peněženky`, en: `Wallet Password` },
  enterWalletPassword: { cs: `Zadejte heslo peněženky`, en: `Enter wallet password` },
  sending: { cs: `Odesílání...`, en: `Sending...` },
  exportWalletSecrets: { cs: `Exportovat tajemství`, en: `Export Wallet Secrets` },
  selectAWalletFirst: { cs: `Nejprve vyberte peněženku.`, en: `Select a wallet first.` },
  enterPasswordToDecrypt: { cs: `Zadejte heslo pro dešifrování`, en: `Enter password to decrypt` },
  exportMnemonic: { cs: `Exportovat Mnemonic`, en: `Export Mnemonic` },
  exportPrivateKey: { cs: `Exportovat Private Key`, en: `Export Private Key` },
  secretNeverShare: { cs: `Tajemství (nikdy nesdílejte!)`, en: `Secret (never share!)` },
  learnMoreAboutZionWallet: { cs: `Více o ZION Wallet`, en: `Learn more about ZION Wallet` },
  download: { cs: `Stáhnout`, en: `Download` },
  documentation: { cs: `Dokumentace`, en: `Documentation` },
};

const getFeatures = (cs: boolean) => [
  {
    title: WalletCopy.ed25519[cs ? 'cs' : 'en'],
    desc: WalletCopy.stateOfTheArtCurveCryptography[cs ? 'cs' : 'en'],
    icon: Fingerprint,
    color: 'text-zion-cyan-400',
  },
  {
    title: WalletCopy.bip39Mnemonic[cs ? 'cs' : 'en'],
    desc: WalletCopy.k1224WordSeedForEasyBackupAndRe[cs ? 'cs' : 'en'],
    icon: KeyRound,
    color: 'text-zion-gold',
  },
  {
    title: WalletCopy.utxoModel[cs ? 'cs' : 'en'],
    desc: WalletCopy.nativeZionL1UtxoModelTranspare[cs ? 'cs' : 'en'],
    icon: Zap,
    color: 'text-zion-cyan-400',
  },
  {
    title: WalletCopy.onChain[cs ? 'cs' : 'en'],
    desc: WalletCopy.fullyOnChainWalletNoCustodialS[cs ? 'cs' : 'en'],
    icon: Globe2,
    color: 'text-zion-purple-400',
  },
];

type Tab = 'create' | 'import' | 'send' | 'export';

const TABS: { key: Tab; labelCs: string; labelEn: string; icon: typeof Plus }[] = [
  { key: 'create', labelCs: 'Vytvořit', labelEn: 'Create', icon: Plus },
  { key: 'import', labelCs: 'Import', labelEn: 'Import', icon: Import },
  { key: 'send', labelCs: 'Odeslat', labelEn: 'Send', icon: Send },
  { key: 'export', labelCs: 'Export', labelEn: 'Export', icon: Download },
];

function StatCard({
  icon,
  colorClass,
  bgClass,
  label,
  value,
  sub,
  rc = '252, 209, 22',
}: {
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  label: string;
  value: string;
  sub?: string;
  rc?: string;
}) {
  return (
    <div className="zion-rainbow-sub p-4 transition-colors" style={{ '--rc': rc } as CSSProperties}>
      <div className={`flex items-center justify-center h-8 w-8 rounded-xl ${bgClass} mb-3 ${colorClass} [&>svg]:h-4 [&>svg]:w-4`}>
        {icon}
      </div>
      <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-white font-mono mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function WalletPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const features = getFeatures(cs);

  const {
    initialized,
    wallets,
    activeWallet,
    balance,
    loading,
    error,
    createWallet,
    importFromMnemonic,
    importFromPrivateKey,
    importFromTrezor,
    importFromLedger,
    setActiveWallet,
    deleteWallet,
    refreshBalance,
    send,
    exportMnemonic,
    exportPrivateKey,
    isHardwareWallet,
  } = useZionWallet();

  const [tab, setTab] = useState<Tab>('create');
  const [password, setPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [walletName, setWalletName] = useState('My Wallet');
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendMemo, setSendMemo] = useState('');
  const [exportedSecret, setExportedSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [txResult, setTxResult] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [localError, setLocalError] = useState('');

  if (!initialized) {
    return (
      <div className="zion-page text-white">
        <div className="zion-container max-w-7xl">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <Wallet className="w-12 h-12 mx-auto mb-4 text-zinc-500 animate-pulse" />
              <p className="text-zinc-400">{WalletCopy.initializingZionWallet[cs ? 'cs' : 'en']}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!password || password.length < 8) {
      setSuccessMsg('');
      setLocalError(WalletCopy.passwordMustBeAtLeast8Characte[cs ? 'cs' : 'en']);
      return;
    }
    try {
      await createWallet(walletName, password);
      setPassword('');
      setSuccessMsg(WalletCopy.walletCreatedYouCanNowSignIn[cs ? 'cs' : 'en']);
      setLocalError('');
    } catch (e: any) {
      setSuccessMsg('');
      setLocalError(e.message);
    }
  };

  const handleImportMnemonic = async () => {
    if (!mnemonic || !password) { alert(WalletCopy.mnemonicAndPasswordRequired[cs ? 'cs' : 'en']); return; }
    try {
      await importFromMnemonic(mnemonic, walletName, password);
      setMnemonic(''); setPassword('');
      alert(WalletCopy.walletImportedSuccessfully[cs ? 'cs' : 'en']);
    } catch (e: any) { alert(e.message); }
  };

  const handleImportPrivateKey = async () => {
    if (!privateKey || !password) { alert(WalletCopy.privateKeyAndPasswordRequired[cs ? 'cs' : 'en']); return; }
    try {
      await importFromPrivateKey(privateKey, walletName, password);
      setPrivateKey(''); setPassword('');
      alert(WalletCopy.walletImportedSuccessfully[cs ? 'cs' : 'en']);
    } catch (e: any) { alert(e.message); }
  };

  const handleSend = async () => {
    if (!activeWallet || !sendTo || !sendAmount || !password) {
      alert(WalletCopy.fillAllRequiredFields[cs ? 'cs' : 'en']); return;
    }
    try {
      const txid = await send(sendTo, parseFloat(sendAmount), password, sendMemo || undefined);
      setTxResult(`Transaction submitted! TXID: ${txid}`);
      setSendTo(''); setSendAmount(''); setSendMemo(''); setPassword('');
    } catch (e: any) { alert(e.message); }
  };

  const handleExportMnemonic = async () => {
    if (!activeWallet || !password) return;
    try {
      const m = await exportMnemonic(activeWallet.id, password);
      setExportedSecret(m);
      setShowSecret(false);
    } catch (e: any) { alert(e.message); }
  };

  const handleExportPrivateKey = async () => {
    if (!activeWallet || !password) return;
    try {
      const pk = await exportPrivateKey(activeWallet.id, password);
      setExportedSecret(pk);
      setShowSecret(false);
    } catch (e: any) { alert(e.message); }
  };

  const handleImportTrezor = async () => {
    try {
      await importFromTrezor(walletName);
      alert(WalletCopy.trezorWalletConnected[cs ? 'cs' : 'en']);
    } catch (e: any) { alert(e.message); }
  };

  const handleImportLedger = async () => {
    try {
      await importFromLedger(walletName);
      alert(WalletCopy.ledgerWalletConnected[cs ? 'cs' : 'en']);
    } catch (e: any) { alert(e.message); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(WalletCopy.copiedToClipboard[cs ? 'cs' : 'en']);
  };

  const activeName = activeWallet?.name ?? (WalletCopy.noWallet[cs ? 'cs' : 'en']);
  const activeAddress = activeWallet?.address ?? '—';
  const activeBalanceDisplay = balance !== null ? `${balance.toFixed(6)} ZION` : '—';
  const hardwareStatus = isHardwareWallet
    ? (WalletCopy.watchOnly[cs ? 'cs' : 'en'])
    : (WalletCopy.software[cs ? 'cs' : 'en']);

  const walletCount = wallets.length;
  const activeBalance = balance !== null ? `${balance.toFixed(6)} ZION` : '---';
  const ed25519Type = 'Ed25519';
  const securityLevel = isHardwareWallet
    ? (WalletCopy.hardware[cs ? 'cs' : 'en'])
    : (WalletCopy.local[cs ? 'cs' : 'en']);

  return (
    <div className="zion-page text-white">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 -left-28 h-[520px] w-[520px] rounded-full bg-zion-gold/18 blur-3xl" />
        <div className="absolute top-40 -right-24 h-[420px] w-[420px] rounded-full bg-zion-cyan/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[620px] rounded-full bg-zion-purple/10 blur-3xl" />
      </div>

      <div className="zion-container relative z-10 max-w-7xl space-y-10">

        {/* ── HERO ── */}
        <section className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="zion-rainbow-card p-6 md:p-10"
            style={{ '--rc': '228, 30, 43' } as CSSProperties}
          >
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold-300 uppercase">
                  <Wallet className="h-4 w-4" />
                  ZION L1 Wallet
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                    {WalletCopy.nativeZionBlockchainWallet[cs ? 'cs' : 'en']}
                  </p>
                  <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                    {WalletCopy.zionWallet[cs ? 'cs' : 'en']}
                  </h1>
                </div>
                <p className="text-lg text-gray-300 max-w-2xl">
                  {WalletCopy.fullyOnChainWalletForZionL1Cre[cs ? 'cs' : 'en']}
                </p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="inline-flex items-center gap-2 rounded-full border border-zion-cyan-500/30 bg-zion-cyan-500/10 px-4 py-2 text-cyan-200">
                    <Fingerprint className="h-3 w-3" /> Ed25519
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-4 py-2 text-amber-200">
                    <KeyRound className="h-3 w-3" /> BIP39
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                    <Lock className="h-3 w-3" /> {WalletCopy.localOnly[cs ? 'cs' : 'en']}
                  </span>
                </div>
              </div>

              {/* Quick info side card */}
              <div className="w-full lg:max-w-md space-y-3">
                <div
                  className="zion-rainbow-sub p-5"
                  style={{ '--rc': '252, 209, 22' } as CSSProperties}
                >
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                    {WalletCopy.quickOverview[cs ? 'cs' : 'en']}
                  </p>
                  <div className="space-y-3">
                    <div
                      className="flex items-center justify-between zion-rainbow-sub p-3"
                      style={{ '--rc': '252, 209, 22' } as CSSProperties}
                    >
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Wallet className="h-4 w-4 text-zion-gold" />
                        {WalletCopy.wallet[cs ? 'cs' : 'en']}
                      </div>
                      <span className="font-mono text-white text-sm">{activeName}</span>
                    </div>
                    <div
                      className="flex items-center justify-between zion-rainbow-sub p-3"
                      style={{ '--rc': '252, 209, 22' } as CSSProperties}
                    >
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Copy className="h-4 w-4 text-zion-gold" />
                        {WalletCopy.address[cs ? 'cs' : 'en']}
                      </div>
                      <span className="font-mono text-white text-xs break-all max-w-[180px]">{activeAddress}</span>
                    </div>
                    <div
                      className="flex items-center justify-between zion-rainbow-sub p-3"
                      style={{ '--rc': '252, 209, 22' } as CSSProperties}
                    >
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Activity className="h-4 w-4 text-zion-gold" />
                        {WalletCopy.balance[cs ? 'cs' : 'en']}
                      </div>
                      <span className="font-mono text-white">{activeBalanceDisplay}</span>
                    </div>
                    <div
                      className="flex items-center justify-between zion-rainbow-sub p-3"
                      style={{ '--rc': '252, 209, 22' } as CSSProperties}
                    >
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Usb className="h-4 w-4 text-zion-gold" />
                        {WalletCopy.hardware[cs ? 'cs' : 'en']}
                      </div>
                      <span className="font-mono text-white">{hardwareStatus}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── QUICK STATS ── */}
        <section className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{WalletCopy.telemetry[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Activity className="h-7 w-7 text-zion-cyan-400" />
                {WalletCopy.walletStatistics[cs ? 'cs' : 'en']}
              </h2>
              <p className="text-sm text-gray-400">
                {WalletCopy.currentMetricsFromYourLocalZio[cs ? 'cs' : 'en']}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                icon={<Wallet className="h-5 w-5" />}
                colorClass="text-zion-gold"
                bgClass="bg-zion-gold/10"
                label={WalletCopy.wallets[cs ? 'cs' : 'en']}
                value={String(walletCount)}
                sub={WalletCopy.total[cs ? 'cs' : 'en']}
              />
              <StatCard
                icon={<Activity className="h-5 w-5" />}
                colorClass="text-zion-cyan"
                bgClass="bg-zion-cyan/10"
                label={WalletCopy.activeBalance[cs ? 'cs' : 'en']}
                value={activeBalance}
                sub="ZION"
              />
              <StatCard
                icon={<Fingerprint className="h-5 w-5" />}
                colorClass="text-zion-cyan-400"
                bgClass="bg-zion-cyan-400/10"
                label={WalletCopy.cryptography[cs ? 'cs' : 'en']}
                value={ed25519Type}
                sub="Ed25519"
              />
              <StatCard
                icon={<Shield className="h-5 w-5" />}
                colorClass="text-zion-purple-400"
                bgClass="bg-zion-purple-400/10"
                label={WalletCopy.security[cs ? 'cs' : 'en']}
                value={securityLevel}
                sub={WalletCopy.level[cs ? 'cs' : 'en']}
              />
            </div>
          </motion.div>
        </section>

        {/* ── FEATURES ── */}
        <section className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="zion-rainbow-card p-6 md:p-8"
            style={{ '--rc': '228, 30, 43' } as CSSProperties}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{WalletCopy.features[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Shield className="h-7 w-7 text-zion-cyan-400" />
                {WalletCopy.whyZionWallet[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {features.map((f) => (
                <div key={f.title} className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                  <f.icon className={`h-8 w-8 ${f.color} mb-3`} />
                  <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── WALLET UI ── */}
        <section className="relative z-10 max-w-4xl mx-auto">
          <div className="space-y-8">
            {(error || localError) && (
              <div className="zion-rainbow-sub p-4 text-zion-purple-300" style={{ '--rc': '228, 30, 43' } as CSSProperties}>
                {localError || error}
              </div>
            )}
            {successMsg && (
              <div className="zion-rainbow-sub p-4 text-zion-cyan-300" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                <p>{successMsg}</p>
                <Link href="/login" className="inline-flex items-center gap-2 text-emerald-200 hover:text-emerald-100 font-medium mt-2">
                  <ArrowRight className="w-4 h-4" />
                  {WalletCopy.goToLogin[cs ? 'cs' : 'en']}
                </Link>
              </div>
            )}

            {/* Active wallet card */}
            {activeWallet && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="zion-rainbow-card p-6"
                style={{ '--rc': '228, 30, 43' } as CSSProperties}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-400">{WalletCopy.activeWallet[cs ? 'cs' : 'en']}</p>
                    <p className="text-lg font-semibold text-white">{activeWallet.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={refreshBalance} className="p-2 hover:bg-white/10 rounded-2xl transition" disabled={loading}>
                      <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <code className="bg-black/60 px-3 py-1.5 rounded-xl text-sm font-mono text-zion-gold flex-1 truncate">
                    {activeWallet.address}
                  </code>
                  <button onClick={() => copyToClipboard(activeWallet.address)} className="p-2 hover:bg-white/10 rounded-2xl transition">
                    <Copy className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <p className="text-2xl font-bold text-zion-cyan mt-3">
                  {balance !== null ? `${balance.toFixed(6)} ZION` : '---'}
                </p>
                {isHardwareWallet && (
                  <div className="mt-4 zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-zion-gold-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-200">
                        <p className="font-medium">{WalletCopy.hardwareWalletWatchOnly[cs ? 'cs' : 'en']}</p>
                        <p className="text-zion-gold-300/80 mt-1">
                          {WalletCopy.trezorLedgerFirmwareDoesNotYet[cs ? 'cs' : 'en']}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Wallet list */}
            {wallets.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="zion-rainbow-card p-6"
                style={{ '--rc': '228, 30, 43' } as CSSProperties}
              >
                <h2 className="text-lg font-semibold text-white mb-4">{WalletCopy.yourWallets[cs ? 'cs' : 'en']} ({wallets.length})</h2>
                <div className="space-y-2">
                  {wallets.map((w) => (
                    <div
                      key={w.id}
                      className={`flex items-center justify-between cursor-pointer transition ${
                        activeWallet?.id === w.id
                          ? 'zion-rainbow-sub p-3'
                          : 'zion-panel-soft p-3 border border-white/5 hover:border-white/15'
                      }`}
                      style={activeWallet?.id === w.id ? ({ '--rc': '252, 209, 22' } as CSSProperties) : undefined}
                      onClick={() => setActiveWallet(w.id)}
                    >
                      <div>
                        <p className="font-medium text-white">{w.name}</p>
                        <p className="text-xs text-gray-500 font-mono truncate max-w-[300px]">{w.address}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteWallet(w.id); }}
                        className="p-2 hover:bg-zion-purple-500/10 rounded-2xl text-zion-purple-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="zion-rainbow-card p-6"
              style={{ '--rc': '228, 30, 43' } as CSSProperties}
            >
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-6">
                <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mr-1 hidden sm:inline">
                  {WalletCopy.walletOperations[cs ? 'cs' : 'en']}
                </span>
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                        active
                          ? 'zion-rainbow-sub'
                          : 'border border-white/10 bg-white/5 text-gray-300 hover:border-white/25 hover:text-white'
                      }`}
                      style={active ? ({ '--rc': '252, 209, 22' } as CSSProperties) : undefined}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {cs ? t.labelCs : t.labelEn}
                    </button>
                  );
                })}
              </div>

              {/* Create tab */}
              {tab === 'create' && (
                <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-zion-gold" /> {WalletCopy.createNewWallet[cs ? 'cs' : 'en']}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{WalletCopy.walletName[cs ? 'cs' : 'en']}</label>
                      <input
                        type="text"
                        value={walletName}
                        onChange={(e) => setWalletName(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{WalletCopy.passwordMin8Chars[cs ? 'cs' : 'en']}</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setLocalError(''); setSuccessMsg(''); }}
                        className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                      />
                    </div>
                    {localError && (
                      <div className="rounded-xl border border-zion-purple-500/20 bg-zion-purple-500/5 px-4 py-3 text-sm text-zion-purple-400">
                        {localError}
                      </div>
                    )}
                    {successMsg && (
                      <div className="rounded-xl border border-zion-cyan-500/20 bg-zion-cyan-500/5 px-4 py-3 text-sm text-zion-cyan-400">
                        <p className="mb-2">{successMsg}</p>
                        <Link href="/login" className="inline-flex items-center gap-2 text-zion-cyan-300 hover:text-emerald-200 font-medium">
                          <ArrowRight className="w-4 h-4" />
                          {WalletCopy.goToLogin[cs ? 'cs' : 'en']}
                        </Link>
                      </div>
                    )}
                    <button
                      onClick={handleCreate}
                      disabled={loading}
                      className="zion-button-primary text-sm"
                      style={{ '--rc': '252, 209, 22' } as CSSProperties}
                    >
                      {loading ? (WalletCopy.creating[cs ? 'cs' : 'en']) : (WalletCopy.createWallet[cs ? 'cs' : 'en'])}
                    </button>
                  </div>
                </div>
              )}

              {/* Import tab */}
              {tab === 'import' && (
                <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Import className="w-5 h-5 text-zion-gold" /> {WalletCopy.importWallet[cs ? 'cs' : 'en']}
                  </h3>
                  <div className="space-y-6">
                    <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                      <p className="text-sm font-medium text-gray-300 mb-3">{WalletCopy.fromMnemonicBip39[cs ? 'cs' : 'en']}</p>
                      <textarea
                        value={mnemonic}
                        onChange={(e) => setMnemonic(e.target.value)}
                        placeholder={WalletCopy.enter12Or24WordMnemonicPhrase[cs ? 'cs' : 'en']}
                        className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none h-24"
                      />
                      <div className="mt-3 space-y-3">
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={WalletCopy.encryptionPassword[cs ? 'cs' : 'en']}
                          className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                        />
                        <button
                          onClick={handleImportMnemonic}
                          disabled={loading}
                          className="zion-button-primary text-sm"
                          style={{ '--rc': '7, 137, 48' } as CSSProperties}
                        >
                          {loading ? (WalletCopy.importing[cs ? 'cs' : 'en']) : (WalletCopy.importFromMnemonic[cs ? 'cs' : 'en'])}
                        </button>
                      </div>
                    </div>
                    <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                      <p className="text-sm font-medium text-gray-300 mb-3">{WalletCopy.fromPrivateKeyHex[cs ? 'cs' : 'en']}</p>
                      <input
                        type="text"
                        value={privateKey}
                        onChange={(e) => setPrivateKey(e.target.value)}
                        placeholder={WalletCopy.k64CharHexPrivateKey[cs ? 'cs' : 'en']}
                        className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none font-mono text-sm"
                      />
                      <div className="mt-3 space-y-3">
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={WalletCopy.encryptionPassword[cs ? 'cs' : 'en']}
                          className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                        />
                        <button
                          onClick={handleImportPrivateKey}
                          disabled={loading}
                          className="zion-button-primary text-sm"
                          style={{ '--rc': '7, 137, 48' } as CSSProperties}
                        >
                          {loading ? (WalletCopy.importing[cs ? 'cs' : 'en']) : (WalletCopy.importFromPrivateKey[cs ? 'cs' : 'en'])}
                        </button>
                      </div>
                    </div>
                    <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                      <p className="text-sm font-medium text-gray-300 mb-3">{WalletCopy.hardwareWalletWatchOnly_2[cs ? 'cs' : 'en']}</p>
                      <p className="text-xs text-gray-400 mb-3">{WalletCopy.importPublicKeyFromTrezorOrLed[cs ? 'cs' : 'en']}</p>
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={handleImportTrezor}
                          disabled={loading}
                          className="zion-button-secondary text-sm"
                          style={{ '--rc': '7, 137, 48' } as CSSProperties}
                        >
                          {loading ? (WalletCopy.connecting[cs ? 'cs' : 'en']) : 'Trezor'}
                        </button>
                        <button
                          onClick={handleImportLedger}
                          disabled={loading}
                          className="zion-button-secondary text-sm"
                          style={{ '--rc': '228, 30, 43' } as CSSProperties}
                        >
                          {loading ? (WalletCopy.connecting[cs ? 'cs' : 'en']) : 'Ledger'}
                        </button>
                      </div>
                      <p className="text-xs text-zion-gold-300/70 mt-2">
                        {WalletCopy.warningTrezorLedgerFirmwareDoe[cs ? 'cs' : 'en']}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Send tab */}
              {tab === 'send' && (
                <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Send className="w-5 h-5 text-zion-gold" /> {WalletCopy.sendZion[cs ? 'cs' : 'en']}
                  </h3>
                  {!activeWallet ? (
                    <p className="text-gray-500">{WalletCopy.selectOrCreateAWalletFirst[cs ? 'cs' : 'en']}</p>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">{WalletCopy.recipientAddressZion1[cs ? 'cs' : 'en']}</label>
                        <input
                          type="text"
                          value={sendTo}
                          onChange={(e) => setSendTo(e.target.value)}
                          placeholder="zion1..."
                          className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">{WalletCopy.amountZion[cs ? 'cs' : 'en']}</label>
                        <input
                          type="number"
                          value={sendAmount}
                          onChange={(e) => setSendAmount(e.target.value)}
                          placeholder="0.00"
                          step="0.000001"
                          className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">{WalletCopy.memoOptional[cs ? 'cs' : 'en']}</label>
                        <input
                          type="text"
                          value={sendMemo}
                          onChange={(e) => setSendMemo(e.target.value)}
                          placeholder={WalletCopy.optionalMessage[cs ? 'cs' : 'en']}
                          className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">{WalletCopy.walletPassword[cs ? 'cs' : 'en']}</label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={WalletCopy.enterWalletPassword[cs ? 'cs' : 'en']}
                          className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={handleSend}
                        disabled={loading}
                        className="zion-button-primary text-sm"
                        style={{ '--rc': '7, 137, 48' } as CSSProperties}
                      >
                        {loading ? (WalletCopy.sending[cs ? 'cs' : 'en']) : (WalletCopy.sendZion[cs ? 'cs' : 'en'])}
                      </button>
                      {txResult && (
                        <p className="text-zion-cyan text-sm mt-2 zion-rainbow-sub p-3 font-mono" style={{ '--rc': '252, 209, 22' } as CSSProperties}>{txResult}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Export tab */}
              {tab === 'export' && (
                <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Download className="w-5 h-5 text-zion-gold" /> {WalletCopy.exportWalletSecrets[cs ? 'cs' : 'en']}
                  </h3>
                  {!activeWallet ? (
                    <p className="text-gray-500">{WalletCopy.selectAWalletFirst[cs ? 'cs' : 'en']}</p>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">{WalletCopy.walletPassword[cs ? 'cs' : 'en']}</label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={WalletCopy.enterPasswordToDecrypt[cs ? 'cs' : 'en']}
                          className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-2 text-white focus:border-zion-cyan focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={handleExportMnemonic}
                          className="zion-button-secondary text-sm"
                          style={{ '--rc': '252, 209, 22' } as CSSProperties}
                        >
                          <KeyRound className="h-4 w-4" /> {WalletCopy.exportMnemonic[cs ? 'cs' : 'en']}
                        </button>
                        <button
                          onClick={handleExportPrivateKey}
                          className="zion-button-secondary text-sm"
                          style={{ '--rc': '7, 137, 48' } as CSSProperties}
                        >
                          <Fingerprint className="h-4 w-4" /> {WalletCopy.exportPrivateKey[cs ? 'cs' : 'en']}
                        </button>
                      </div>
                      {exportedSecret && (
                        <div className="mt-4 zion-rainbow-sub p-4" style={{ '--rc': '228, 30, 43' } as CSSProperties}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-zion-purple-300 text-sm font-medium">{WalletCopy.secretNeverShare[cs ? 'cs' : 'en']}</p>
                            <div className="flex gap-2">
                              <button onClick={() => setShowSecret(!showSecret)} className="p-1 hover:bg-red-900/30 rounded transition">
                                {showSecret ? <EyeOff className="w-4 h-4 text-zion-purple-300" /> : <Eye className="w-4 h-4 text-zion-purple-300" />}
                              </button>
                              <button onClick={() => copyToClipboard(exportedSecret)} className="p-1 hover:bg-red-900/30 rounded transition">
                                <Copy className="w-4 h-4 text-zion-purple-300" />
                              </button>
                            </div>
                          </div>
                          <code className="block font-mono text-sm break-all text-red-200">
                            {showSecret ? exportedSecret : '•'.repeat(Math.min(exportedSecret.length, 50))}
                          </code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </section>

        {/* ── CTA BANNER ── */}
        <section className="relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="zion-cta-banner"
          >
            <h2 className="text-2xl font-semibold text-white text-center mb-6">
              {WalletCopy.learnMoreAboutZionWallet[cs ? 'cs' : 'en']}
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/explorer" className="zion-button-secondary group text-sm" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                <Globe2 className="h-4 w-4" /> Explorer
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/download" className="zion-button-secondary group text-sm" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                <Download className="h-4 w-4" /> {WalletCopy.download[cs ? 'cs' : 'en']}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/docs" className="zion-button-secondary group text-sm" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                <BookOpen className="h-4 w-4" /> {WalletCopy.documentation[cs ? 'cs' : 'en']}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </motion.div>
        </section>

      </div>
    </div>
  );
}
