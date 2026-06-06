import React, {createContext, useState, useEffect, useContext, useCallback, useRef} from 'react';
import WalletService from '../services/WalletService';
import BlockchainRPC from '../services/BlockchainRPC';
import {createSignedTransaction} from '../services/TransactionBuilder';
import {CONFIG} from '../constants/config';

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
   * Send ZION using UTXO transaction builder
   * @param {string} recipientAddress - Destination address
   * @param {number} amountZion - Amount in ZION (not atomic)
   * @param {string} password - Wallet password for key decryption
   * @returns {Promise<{txId: string}>}
   */
  const sendZion = async (recipientAddress, amountZion, password) => {
    if (locked) throw new Error('Wallet is locked');
    if (!activeWallet) throw new Error('No active wallet');
    bumpActivity();

    // Get private key from keychain
    const {privateKey} = await WalletService.exportWallet(activeWallet.id, password);
    if (!privateKey) throw new Error('Failed to decrypt wallet');

    // Fetch fresh UTXOs
    const freshUtxos = await BlockchainRPC.getUTXOs(activeWallet.address);
    if (!freshUtxos || freshUtxos.length === 0) {
      throw new Error('No unspent outputs available');
    }

    // Build, sign & serialize transaction
    const {tx, txHash} = await createSignedTransaction({
      from: activeWallet.address,
      to: recipientAddress,
      amountZion,
      utxos: freshUtxos,
      privateKey: Buffer.from(privateKey, 'hex'),
    });

    // Broadcast signed transaction object to network
    const txId = await BlockchainRPC.broadcastTransaction(tx);

    // Refresh balance after send
    setTimeout(() => refreshBalance(), 2000);

    return {txId: txId || txHash};
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
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
