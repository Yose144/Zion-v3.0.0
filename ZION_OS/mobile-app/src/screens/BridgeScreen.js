/**
 * BridgeScreen.js — wZION L1 ↔ EVM Bridge v3.0.0
 * ──────────────────────────────────────────────────────────────────────
 * Lets users bridge ZION between the native L1 chain and Base network (EVM).
 *
 * L1 → EVM: User sends ZION to vault on L1 (memo generated here).
 *           Rust relay monitors L1 and mints wZION on Base.
 * EVM → L1: User burns wZION here (app signs EVM TX locally).
 *           Rust relay monitors Base and releases ZION on L1.
 *
 * Testnet: Base Sepolia (live 21.2.2026) — WZION 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6
 * Design: follows SendScreen.js pattern (GlassCard, GradientButton, theme).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  RefreshControl,
  Clipboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useWallet } from '../context/WalletContext';
import GlassCard from '../components/common/GlassCard';
import GradientButton from '../components/common/GradientButton';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import CONFIG from '../constants/config';
import {
  deriveEvmWallet,
  getWzionBalance,
  getBridgeStats,
  getTxStatus,
  bridgeBurnToL1,
  prepareLockMemo,
} from '../services/WZIONBridgeService';

const DIRECTION = {
  TO_EVM : 'L1→EVM',  // lock ZION on L1, get wZION on Base
  TO_L1  : 'EVM→L1',  // burn wZION on Base, receive ZION on L1
};

const NET = __DEV__ ? CONFIG.BRIDGE.TESTNET : CONFIG.BRIDGE.MAINNET;

// ─────────────────────────────────────────────────────────────────────────────
const BridgeScreen = ({ navigation }) => {
  const { activeWallet, balance, mnemonic } = useWallet();

  // Direction toggle
  const [direction, setDirection] = useState(DIRECTION.TO_EVM);

  // EVM wallet (derived from mnemonic)
  const [evmAddress, setEvmAddress]   = useState(null);
  const [wzionBalance, setWzionBalance] = useState(null);

  // Form
  const [amount, setAmount]           = useState('');
  const [l1Recipient, setL1Recipient] = useState('');  // for EVM→L1

  // Bridge stats
  const [stats, setStats]             = useState(null);

  // UI state
  const [loading, setLoading]         = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [pendingTx, setPendingTx]     = useState(null);
  const [pendingStatus, setPendingStatus] = useState(null);

  // Memo for L1→EVM direction
  const [lockMemo, setLockMemo]       = useState(null);

  // ── Init: derive EVM address + load balances ────────────────────────────
  useEffect(() => {
    if (mnemonic) initEvmWallet(mnemonic);
  }, [mnemonic]);

  async function initEvmWallet(mn) {
    try {
      const wallet = deriveEvmWallet(mn);
      setEvmAddress(wallet.address);
      await loadBalances(wallet.address);
    } catch (e) {
      console.error('EVM wallet init:', e);
    }
  }

  async function loadBalances(addr = evmAddress) {
    if (!addr) return;
    try {
      const [bal, st] = await Promise.all([
        getWzionBalance(addr),
        getBridgeStats().catch(() => null),
      ]);
      setWzionBalance(bal);
      setStats(st);
    } catch (e) {
      console.warn('Balance load failed:', e.message);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBalances();
    setRefreshing(false);
  }, [evmAddress]);

  // ── Direction change → regenerate memo if needed ────────────────────────
  useEffect(() => {
    if (direction === DIRECTION.TO_EVM && evmAddress) {
      try {
        setLockMemo(prepareLockMemo(evmAddress));
      } catch {
        setLockMemo(null);
      }
    }
  }, [direction, evmAddress]);

  // ── Poll pending TX ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!pendingTx) return;
    const interval = setInterval(async () => {
      const status = await getTxStatus(pendingTx).catch(() => null);
      if (status?.confirmed) {
        setPendingStatus(status);
        clearInterval(interval);
        loadBalances();
        if (status.status === 1) {
          Alert.alert(
            '✅ Bridge burn confirmed!',
            `wZION burned. Rust relay is now processing your L1 release.\n\nTX: ${pendingTx.slice(0, 16)}...`
          );
        } else {
          Alert.alert('❌ Transaction reverted', 'The bridgeBurn call was reverted. Check your wZION balance and allowance.');
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [pendingTx]);

  // ── Validation ──────────────────────────────────────────────────────────
  function validate() {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid amount', 'Please enter a positive amount');
      return false;
    }
    if (amt < CONFIG.BRIDGE.MIN_BRIDGE_AMOUNT) {
      Alert.alert('Too small', `Minimum bridge amount is ${CONFIG.BRIDGE.MIN_BRIDGE_AMOUNT} ZION`);
      return false;
    }
    if (direction === DIRECTION.TO_L1) {
      if (amt > (wzionBalance ?? 0)) {
        Alert.alert('Insufficient wZION', `You only have ${wzionBalance?.toFixed(2)} wZION`);
        return false;
      }
      if (!l1Recipient || !l1Recipient.startsWith('zion1')) {
        Alert.alert('Invalid recipient', 'Please enter a valid ZION L1 address (zion1...)');
        return false;
      }
    } else {
      if (amt > (balance ?? 0)) {
        Alert.alert('Insufficient ZION', 'Not enough L1 ZION balance');
        return false;
      }
    }
    return true;
  }

  // ── Submit EVM→L1 burn ──────────────────────────────────────────────────
  async function handleBurn() {
    if (!validate()) return;
    const amt = parseFloat(amount);
    Alert.alert(
      'Confirm bridge burn',
      `Burn ${amt} wZION on ${NET.NAME}\nto release ${amt} ZION at:\n${l1Recipient}\n\nThis CANNOT be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Burn & Bridge',
          style: 'destructive',
          onPress: async () => {
            if (!mnemonic) {
              Alert.alert('No wallet', 'Open your wallet first');
              return;
            }
            setLoading(true);
            try {
              const result = await bridgeBurnToL1(mnemonic, amt, l1Recipient);
              setPendingTx(result.txHash);
              setPendingStatus(null);
              setAmount('');
              Alert.alert(
                'Burn submitted!',
                `TX: ${result.txHash.slice(0, 20)}...\n\nWaiting for confirmation. L1 release will follow automatically.`
              );
            } catch (err) {
              Alert.alert('Error', err.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  // ── Submit L1→EVM: just copy memo ──────────────────────────────────────
  function handleCopyMemo() {
    if (!lockMemo) return;
    Clipboard.setString(lockMemo.memo);
    Alert.alert(
      'Memo copied!',
      `Send ${amount || '?'} ZION to the L1 vault with this memo.\n\nVault: ${lockMemo.vaultAddress}\nMemo: ${lockMemo.memo}\n\nwZION will arrive on ${lockMemo.network} within ~5 min.`
    );
  }

  // ── Render helpers ──────────────────────────────────────────────────────
  function renderHeader() {
    return (
      <GlassCard style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Icon name="swap-horizontal" size={28} color={colors.primary} />
          <Text style={styles.headerTitle}>wZION Bridge</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Icon name="refresh" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSub}>{NET.NAME} · ERC-20 ↔ L1 Native</Text>

        {/* Direction toggle */}
        <View style={styles.directionRow}>
          {[DIRECTION.TO_EVM, DIRECTION.TO_L1].map((dir) => (
            <TouchableOpacity
              key={dir}
              style={[styles.dirBtn, direction === dir && styles.dirBtnActive]}
              onPress={() => setDirection(dir)}
            >
              <Text style={[styles.dirText, direction === dir && styles.dirTextActive]}>{dir}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </GlassCard>
    );
  }

  function renderBalances() {
    return (
      <GlassCard style={styles.balCard}>
        <View style={styles.balRow}>
          {/* L1 ZION */}
          <View style={styles.balItem}>
            <Text style={styles.balLabel}>L1 ZION</Text>
            <Text style={styles.balValue}>{balance != null ? balance.toFixed(4) : '—'}</Text>
            <Text style={styles.balSub}>native chain</Text>
          </View>
          <Icon name="swap-horizontal" size={20} color={colors.primary} style={{ marginTop: 16 }} />
          {/* wZION */}
          <View style={styles.balItem}>
            <Text style={styles.balLabel}>wZION</Text>
            <Text style={styles.balValue}>
              {wzionBalance != null ? wzionBalance.toFixed(4) : '—'}
            </Text>
            <Text style={styles.balSub}>{NET.NAME}</Text>
          </View>
        </View>
        {evmAddress && (
          <TouchableOpacity
            onPress={() => {
              Clipboard.setString(evmAddress);
              Alert.alert('Copied', 'EVM address copied to clipboard');
            }}
          >
            <Text style={styles.evmAddr}>
              EVM: {evmAddress.slice(0, 10)}...{evmAddress.slice(-8)}
            </Text>
          </TouchableOpacity>
        )}
      </GlassCard>
    );
  }

  function renderL1toEVM() {
    return (
      <GlassCard style={styles.formCard}>
        <Text style={styles.sectionTitle}>ZION → wZION (lock on L1)</Text>
        <Text style={styles.infoText}>
          Send ZION to the bridge vault on L1 with the memo below. The relay will
          automatically mint wZION to your Base address.
        </Text>

        <Text style={styles.label}>Amount (ZION)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 500"
          placeholderTextColor={colors.textSecondary}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />

        {evmAddress && (
          <>
            <Text style={styles.label}>Your EVM address (wZION recipient)</Text>
            <View style={styles.roInput}>
              <Text style={styles.roText} numberOfLines={1}>{evmAddress}</Text>
            </View>
          </>
        )}

        {lockMemo && (
          <>
            <Text style={styles.label}>L1 Vault address</Text>
            <View style={styles.roInput}>
              <Text style={styles.roText} numberOfLines={1}>{lockMemo.vaultAddress}</Text>
            </View>

            <Text style={styles.label}>Memo (COPY EXACTLY)</Text>
            <TouchableOpacity style={styles.memoBox} onPress={handleCopyMemo}>
              <Text style={styles.memoText}>{lockMemo.memo}</Text>
              <Icon name="content-copy" size={18} color={colors.primary} />
            </TouchableOpacity>
          </>
        )}

        <GradientButton
          title="Copy memo & instructions"
          onPress={handleCopyMemo}
          icon="content-copy"
          disabled={!evmAddress || !lockMemo}
        />
      </GlassCard>
    );
  }

  function renderEVMtoL1() {
    return (
      <GlassCard style={styles.formCard}>
        <Text style={styles.sectionTitle}>wZION → ZION (burn on EVM)</Text>
        <Text style={styles.infoText}>
          Burns wZION on {NET.NAME}. The relay will release ZION to your L1 address.
        </Text>

        <Text style={styles.label}>Amount to burn (wZION)</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="e.g. 500"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
          <TouchableOpacity
            style={styles.maxBtn}
            onPress={() => wzionBalance && setAmount(wzionBalance.toFixed(2))}
          >
            <Text style={styles.maxText}>MAX</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>ZION L1 recipient address</Text>
        <TextInput
          style={styles.input}
          placeholder="zion1..."
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          value={l1Recipient}
          onChangeText={setL1Recipient}
        />

        {/* Active wallet L1 address shortcut */}
        {activeWallet?.address && (
          <TouchableOpacity
            style={styles.useMyAddr}
            onPress={() => setL1Recipient(activeWallet.address)}
          >
            <Icon name="account" size={14} color={colors.primary} />
            <Text style={styles.useMyAddrText}> Use my L1 address</Text>
          </TouchableOpacity>
        )}

        {/* Pending TX indicator */}
        {pendingTx && !pendingStatus && (
          <View style={styles.pendingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.pendingText}>
              Confirming... {pendingTx.slice(0, 16)}...
            </Text>
          </View>
        )}
        {pendingStatus?.confirmed && (
          <TouchableOpacity
            onPress={() => Linking.openURL(`${NET.EXPLORER}/tx/${pendingTx}`)}
          >
            <Text style={styles.explorerLink}>
              {pendingStatus.status === 1 ? '✅' : '❌'} View on {NET.NAME} explorer ›
            </Text>
          </TouchableOpacity>
        )}

        <GradientButton
          title={loading ? 'Signing & broadcasting...' : 'Burn wZION → release ZION'}
          onPress={handleBurn}
          icon="fire"
          disabled={loading || !evmAddress}
          loading={loading}
        />
      </GlassCard>
    );
  }

  function renderStats() {
    if (!stats) return null;
    return (
      <GlassCard style={styles.statsCard}>
        <Text style={styles.statsTitle}>Bridge statistics</Text>
        <View style={styles.statsGrid}>
          {[
            ['Total minted', stats.totalMinted.toFixed(0)],
            ['Total burned', stats.totalBurned.toFixed(0)],
            ['In circulation', stats.circulating.toFixed(0)],
            ['Outstanding', stats.outstanding.toFixed(0)],
          ].map(([label, val]) => (
            <View key={label} style={styles.statItem}>
              <Text style={styles.statVal}>{val}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </GlassCard>
    );
  }

  function renderReadiness() {
    const items = [
      { label: 'wZION contract', done: true },
      { label: 'ZIONBridge contract', done: true },
      { label: 'BaseScan verified', done: false },
      { label: '3/5 Guardian multisig', done: false },
      { label: 'Relay metrics', done: true },
      { label: 'Burn widget (live)', done: true },
      { label: 'L1 → Base (mint)', done: true },
      { label: 'Base → L1 (unlock)', done: true },
    ];
    const doneCount = items.filter(i => i.done).length;
    return (
      <GlassCard style={styles.readinessCard}>
        <Text style={styles.statsTitle}>Readiness {doneCount}/{items.length}</Text>
        <View style={styles.readinessGrid}>
          {items.map((item, idx) => (
            <View key={idx} style={[styles.readinessItem, item.done ? styles.readinessDone : styles.readinessPending]}>
              <Text style={[styles.readinessIcon, item.done ? styles.readinessIconDone : styles.readinessIconPending]}>
                {item.done ? '✓' : '◐'}
              </Text>
              <Text style={[styles.readinessLabel, item.done ? styles.readinessLabelDone : styles.readinessLabelPending]} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </GlassCard>
    );
  }

  function renderContracts() {
    const wzion = NET.WZION_ADDRESS;
    const bridge = NET.BRIDGE_ADDRESS;
    return (
      <GlassCard style={styles.contractCard}>
        <Text style={styles.statsTitle}>Contracts · {NET.NAME}</Text>
        <View style={styles.contractRow}>
          <Text style={styles.contractLabel}>wZION</Text>
          <TouchableOpacity onPress={() => { Clipboard.setString(wzion); Alert.alert('Copied', 'wZION address copied'); }}>
            <Text style={styles.contractAddr}>{wzion.slice(0, 14)}…{wzion.slice(-10)}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.contractRow}>
          <Text style={styles.contractLabel}>Bridge</Text>
          <TouchableOpacity onPress={() => { Clipboard.setString(bridge); Alert.alert('Copied', 'Bridge address copied'); }}>
            <Text style={styles.contractAddr}>{bridge.slice(0, 14)}…{bridge.slice(-10)}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => Linking.openURL(`${NET.EXPLORER}/address/${wzion}`)}>
          <Text style={styles.explorerLink}>View wZION on explorer ›</Text>
        </TouchableOpacity>
      </GlassCard>
    );
  }

  // ── Root render ─────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      {renderHeader()}
      {renderBalances()}
      {direction === DIRECTION.TO_EVM ? renderL1toEVM() : renderEVMtoL1()}
      {renderStats()}
      {renderReadiness()}
      {renderContracts()}

      <View style={styles.footer}>
        <Icon name="shield-check" size={14} color={colors.textSecondary} />
        <Text style={styles.footerText}>
          {' '}Min. {CONFIG.BRIDGE.MIN_BRIDGE_AMOUNT} ZION · 60-block L1 finality · 64-block EVM finality
        </Text>
      </View>
    </ScrollView>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  headerCard: {
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
    flex: 1,
    marginLeft: spacing.sm,
  },
  headerSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  directionRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  dirBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  dirBtnActive: {
    backgroundColor: colors.primary,
  },
  dirText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  dirTextActive: {
    color: '#fff',
  },
  balCard: {
    marginBottom: spacing.sm,
  },
  balRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balItem: {
    flex: 1,
    alignItems: 'center',
  },
  balLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  balValue: {
    ...typography.h3,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  balSub: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 2,
  },
  evmAddr: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    textDecorationLine: 'underline',
  },
  formCard: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  infoText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    ...typography.body,
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  maxBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  maxText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '700',
  },
  roInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  roText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: 'monospace',
  },
  memoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  memoText: {
    flex: 1,
    color: colors.primary,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  useMyAddr: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  useMyAddrText: {
    ...typography.caption,
    color: colors.primary,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  pendingText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  explorerLink: {
    ...typography.caption,
    color: colors.primary,
    textDecorationLine: 'underline',
    marginBottom: spacing.sm,
  },
  statsCard: {
    marginBottom: spacing.sm,
  },
  statsTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  statVal: {
    ...typography.h3,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  readinessCard: {
    marginBottom: spacing.sm,
  },
  readinessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  readinessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: '45%',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
  },
  readinessDone: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderColor: 'rgba(16,185,129,0.35)',
  },
  readinessPending: {
    backgroundColor: 'rgba(234,179,8,0.08)',
    borderColor: 'rgba(234,179,8,0.35)',
  },
  readinessIcon: {
    fontSize: 13,
    width: 18,
    textAlign: 'center',
  },
  readinessIconDone: {
    color: '#6ee7b7',
  },
  readinessIconPending: {
    color: '#fcd34d',
  },
  readinessLabel: {
    ...typography.caption,
    fontWeight: '500',
    flex: 1,
  },
  readinessLabelDone: {
    color: '#6ee7b7',
  },
  readinessLabelPending: {
    color: '#fcd34d',
  },
  contractCard: {
    marginBottom: spacing.sm,
  },
  contractRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  contractLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    width: 60,
  },
  contractAddr: {
    ...typography.caption,
    color: colors.text,
    fontFamily: 'monospace',
    textDecorationLine: 'underline',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    opacity: 0.6,
  },
  footerText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});

export default BridgeScreen;
