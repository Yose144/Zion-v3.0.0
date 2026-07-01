import React, {createContext, useState, useEffect, useContext, useCallback, useRef} from 'react';
import WalletService from '../services/WalletService';
import BlockchainRPC from '../services/BlockchainRPC';
import {createSignedTransaction} from '../services/TransactionBuilder';
import {buildAccountTransaction} from '../services/AccountBuilder';
import {CONFIG} from '../constants/config';
import {
  queueTransaction,
  getQueue,
  removeTransaction,
  incrementAttempts,
  getPendingCount,
} from '../services/OfflineTxQueue';

const WalletContext = createContext();

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};

export const WalletProvider = ({children}) => {
  const [wallets, setWallets] = useState([]);
  const [activeWallet, setActiveWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [utxos, setUtxos] = useState([]);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pendingTxCount, setPendingTxCount] = useState(0);
  const refreshTimerRef = useRef(null);
  const lockTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const autoLockMinutes = CONFIG.AUTO_LOCK_MINUTES ?? 5;

  const bumpActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const lock = useCallback(() => {
    setLocked(true);
    setBalance(0);
    setUtxos([]);
  }, []);

  const unlock = useCallback((password) => {
    if (!password || password.length < 1) return false;
    bumpActivity();
    setLocked(false);
    return true;
  }, [bumpActivity]);

  // Auto-lock timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (!locked && Date.now() - lastActivityRef.current > autoLockMinutes * 60 * 1000) {
        console.log('🔒 Auto-lock triggered');
        lock();
      }
    }, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [locked, autoLockMinutes, lock]);

  useEffect(() => {
    initializeWallet();
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    };
  }, []);

  // Auto-refresh balance when active wallet changes
  useEffect(() => {
    if (locked) return;
    if (activeWallet?.address) {
      refreshBalance();
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = setInterval(() => refreshBalance(), 30000);
    } else {
      setBalance(0);
      setUtxos([]);
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [activeWallet?.address, locked]);

  const initializeWallet = async () => {
    try {
      await WalletService.initialize();
      refreshWallets();
      // Sync pending offline-tx count from the persisted queue.
      try {
        setPendingTxCount(await getPendingCount());
      } catch (e) {
        console.warn('Failed to load pending tx count:', e);
      }
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshWallets = () => {
    setWallets(WalletService.getWallets());
    setActiveWallet(WalletService.getActiveWallet());
  };

  /**
   * Refresh balance & UTXOs from blockchain
   */
  const refreshBalance = useCallback(async () => {
    if (!activeWallet?.address || locked) return;
    bumpActivity();
    try {
      setBalanceLoading(true);
      const [bal, utxoList] = await Promise.all([
        BlockchainRPC.getBalance(activeWallet.address),
        BlockchainRPC.getUTXOs(activeWallet.address).catch(() => []),
      ]);
      setBalance(bal?.zion ?? 0);
      setUtxos(Array.isArray(utxoList) ? utxoList : []);
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    } finally {
      setBalanceLoading(false);
    }
  }, [activeWallet?.address, locked, bumpActivity]);

  const createWallet = async (name, password, chainId) => {
    bumpActivity();
    const wallet = await WalletService.generateWallet(name, password, chainId);
    refreshWallets();
    return wallet;
  };

  const importWallet = async (privateKeyOrMnemonic, name, password, chainId) => {
    bumpActivity();
    let wallet;
    if (privateKeyOrMnemonic.includes(' ')) {
      wallet = await WalletService.importFromMnemonic(privateKeyOrMnemonic, name, password, chainId);
    } else {
      wallet = await WalletService.importFromPrivateKey(privateKeyOrMnemonic, name, password, chainId);
    }
    refreshWallets();
    return wallet;
  };

  const addExternalWallet = async ({chainId, address, name}) => {
    bumpActivity();
    const wallet = await WalletService.addExternalWallet({chainId, address, name});
    refreshWallets();
    return wallet;
  };

  const switchWallet = async (walletId) => {
    bumpActivity();
    await WalletService.setActiveWallet(walletId);
    refreshWallets();
  };

  const deleteWallet = async (walletId) => {
    bumpActivity();
    await WalletService.deleteWallet(walletId);
    refreshWallets();
  };

  const exportWallet = async (walletId, password) => {
    bumpActivity();
    return await WalletService.exportWallet(walletId, password);
  };

  /**
   * Send ZION with automatic model detection:
   * - If address has UTXOs → use UTXO transaction (v2 BLAKE3)
   * - Otherwise → fall back to Account transaction (no coinbase maturity)
   * @param {string} recipientAddress - Destination zion1 address
   * @param {number} amountZion - Amount in ZION (human units)
   * @param {string} password - Wallet password for key decryption
   * @param {string} [memo] - Optional ASCII memo (max 256 bytes)
   * @returns {Promise<{txId: string, model: string}>}
   */
  const sendZion = async (recipientAddress, amountZion, password, memo) => {
    if (locked) throw new Error('Wallet is locked');
    if (!activeWallet) throw new Error('No active wallet');
    bumpActivity();

    // Get private key from keychain (32-byte Ed25519 seed, hex string)
    const {privateKey} = await WalletService.exportWallet(activeWallet.id, password);
    if (!privateKey) throw new Error('Failed to decrypt wallet');

    // Fetch balance + UTXOs to detect which model to use
    const balance = await BlockchainRPC.getBalance(activeWallet.address);
    const freshUtxos = await BlockchainRPC.getUTXOs(activeWallet.address);
    const utxoCount = balance?.utxo_count ?? freshUtxos.length ?? 0;
    const accountBalanceFlowers = BigInt(balance?.account_balance_flowers || '0');

    let txId;
    let model;

    if (utxoCount > 0) {
      // ── UTXO model ─────────────────────────────────────────────
      model = 'utxo';
      const {tx, txHash} = await createSignedTransaction({
        from: activeWallet.address,
        to: recipientAddress,
        amountZion,
        utxos: freshUtxos,
        privateKey: Buffer.from(privateKey, 'hex'),
        memo: memo || undefined,
      });
      // Ensure the signed tx carries an id + model tag for the offline queue.
      const txIdCandidate = txHash instanceof Buffer ? txHash.toString('hex') : txHash;
      if (!tx.tx_id) tx.tx_id = txIdCandidate;
      tx._zionModel = 'utxo';
      try {
        txId = await BlockchainRPC.broadcastTransaction(tx);
      } catch (broadcastErr) {
        // Network/RPC failure → persist for later broadcast instead of throwing.
        console.warn('📡 Broadcast failed, queueing tx offline:', broadcastErr.message);
        await queueTransaction(tx);
        setPendingTxCount(await getPendingCount());
        return { txId: tx.tx_id, model, queued: true };
      }
      txId = txId || txIdCandidate;
    } else if (accountBalanceFlowers > 0n) {
      // ── Account model ──────────────────────────────────────────
      model = 'account';
      const accountTx = await buildAccountTransaction({
        from: activeWallet.address,
        to: recipientAddress,
        amountZion,
        privateKey: Buffer.from(privateKey, 'hex'),
        memo: memo || undefined,
      });
      accountTx._zionModel = 'account';
      try {
        txId = await BlockchainRPC.broadcastAccountTransaction(accountTx);
      } catch (broadcastErr) {
        console.warn('📡 Account broadcast failed, queueing tx offline:', broadcastErr.message);
        await queueTransaction(accountTx);
        setPendingTxCount(await getPendingCount());
        return { txId: accountTx.tx_id, model, queued: true };
      }
      if (!txId) txId = accountTx.tx_id;
    } else {
      throw new Error('Insufficient balance: address has neither UTXOs nor account balance');
    }

    // Refresh balance after send
    setTimeout(() => refreshBalance(), 2000);

    return {txId, model};
  };

  /**
   * Attempt to broadcast all queued (offline) transactions.
   * Called when connectivity is restored (e.g. via useNetworkStatus).
   *
   * For each queued tx:
   *  - On success → remove from queue
   *  - On failure → increment attempt counter
   * Updates pendingTxCount afterwards and returns a summary.
   *
   * @returns {Promise<{broadcast: number, failed: number, remaining: number}>}
   */
  const broadcastPendingTransactions = async () => {
    const queue = await getQueue();
    if (!queue.length) {
      setPendingTxCount(0);
      return { broadcast: 0, failed: 0, remaining: 0 };
    }

    let broadcast = 0;
    let failed = 0;

    for (const item of queue) {
      const tx = item.tx;
      const txId = tx?.tx_id;
      if (!txId) {
        // Cannot track a tx without an id — skip & drop it.
        await removeTransaction(txId);
        continue;
      }
      try {
        const isAccount = tx._zionModel === 'account';
        if (isAccount) {
          await BlockchainRPC.broadcastAccountTransaction(tx);
        } else {
          await BlockchainRPC.broadcastTransaction(tx);
        }
        await removeTransaction(txId);
        broadcast++;
      } catch (err) {
        console.warn(`📡 Re-broadcast failed for ${txId}:`, err.message);
        await incrementAttempts(txId);
        failed++;
      }
    }

    const remaining = await getPendingCount();
    setPendingTxCount(remaining);

    if (broadcast > 0) {
      // Refresh balance to reflect newly accepted transactions.
      setTimeout(() => refreshBalance(), 2000);
    }

    return { broadcast, failed, remaining };
  };

  const value = {
    wallets,
    activeWallet,
    loading,
    balance,
    utxos,
    balanceLoading,
    locked,
    lock,
    unlock,
    createWallet,
    importWallet,
    addExternalWallet,
    switchWallet,
    deleteWallet,
    exportWallet,
    refreshWallets,
    refreshBalance,
    sendZion,
    pendingTxCount,
    broadcastPendingTransactions,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
