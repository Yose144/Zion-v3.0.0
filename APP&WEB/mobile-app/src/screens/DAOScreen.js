/**
 * DAOScreen.js — L2 DAO Governance + Bridge Vault
 * ──────────────────────────────────────────────────────────────────────
 * Read-only view of:
 *   - DAO governance stats (proposals, treasury, quorum)
 *   - Active proposals list
 *   - Bridge Vault status (100M ZION locked for Base)
 *
 * Voting/treasury operations are guardian-only (X-DAO-Key) and are
 * performed via the website Guardian Dashboard, not the mobile app.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Clipboard,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GlassCard from '../components/common/GlassCard';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import {
  getDAOHealth,
  getDAOStats,
  getDAOProposals,
  getDAOTreasury,
  getBridgeVaultInfo,
  ATOMIC_SWAP,
} from '../services/DAOService';

const DAOScreen = () => {
  const [health, setHealth]       = useState(null);
  const [stats, setStats]         = useState(null);
  const [proposals, setProposals] = useState([]);
  const [treasury, setTreasury]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    const [h, s, p, t] = await Promise.all([
      getDAOHealth(),
      getDAOStats(),
      getDAOProposals({ limit: 20, status: 'Active' }),
      getDAOTreasury(),
    ]);
    setHealth(h);
    setStats(s);
    setProposals(p);
    setTreasury(t);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadAll();
      setLoading(false);
    })();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const vaultInfo = getBridgeVaultInfo();
  const isOnline = health?.status === 'online';

  // ── Header ────────────────────────────────────────────────────────────
  function renderHeader() {
    return (
      <View style={styles.header}>
        <Icon name="vote-outline" size={32} color={colors.primary.gold} />
        <Text style={styles.headerTitle}>DAO Governance</Text>
        <View style={[styles.statusPill, isOnline ? styles.online : styles.offline]}>
          <Text style={styles.statusText}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
        </View>
      </View>
    );
  }

  // ── Stats grid ────────────────────────────────────────────────────────
  function renderStats() {
    if (!stats) return null;
    const items = [
      ['Total proposals', String(stats.total_proposals)],
      ['Active', String(stats.active)],
      ['Passed', String(stats.passed)],
      ['Executed', String(stats.executed)],
      ['Quorum', `${stats.quorum_percent}%`],
      ['Voting period', `${stats.voting_period_days}d`],
    ];
    return (
      <GlassCard style={styles.card}>
        <Text style={styles.cardTitle}>Governance Stats</Text>
        <View style={styles.statsGrid}>
          {items.map(([label, val]) => (
            <View key={label} style={styles.statItem}>
              <Text style={styles.statVal}>{val}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.multisigRow}>
          <Icon name="shield-account" size={16} color={colors.primary.cyan} />
          <Text style={styles.multisigText}> Multisig: {stats.multisig}</Text>
        </View>
      </GlassCard>
    );
  }

  // ── Treasury ──────────────────────────────────────────────────────────
  function renderTreasury() {
    // DAO API returns: { total_zion, available_zion, available_flowers, multisig, pending_operations, ... }
    const balanceZion = treasury?.total_zion ?? treasury?.treasury_total_zion ?? stats?.treasury_total_zion ?? 4_000_000_000;
    const multisig = treasury?.multisig ?? stats?.multisig ?? '5-of-7';
    const pendingOps = treasury?.pending_operations ?? 0;
    return (
      <GlassCard style={styles.card}>
        <Text style={styles.cardTitle}>Treasury</Text>
        <View style={styles.treasuryRow}>
          <Text style={styles.treasuryLabel}>Balance</Text>
          <Text style={styles.treasuryVal}>
            {Number(balanceZion).toLocaleString()} ZION
          </Text>
        </View>
        <View style={styles.treasuryRow}>
          <Text style={styles.treasuryLabel}>Multisig</Text>
          <Text style={styles.treasuryVal}>{multisig}</Text>
        </View>
        {pendingOps > 0 && (
          <View style={styles.treasuryRow}>
            <Text style={styles.treasuryLabel}>Pending ops</Text>
            <Text style={styles.treasuryVal}>{pendingOps}</Text>
          </View>
        )}
      </GlassCard>
    );
  }

  // ── Bridge Vault ──────────────────────────────────────────────────────
  function renderBridgeVault() {
    return (
      <GlassCard style={styles.card}>
        <Text style={styles.cardTitle}>Bridge Vault (L1)</Text>
        <View style={styles.vaultRow}>
          <Text style={styles.vaultLabel}>Vault address</Text>
          <TouchableOpacity
            onPress={() => { Clipboard.setString(vaultInfo.vault_address); Alert.alert('Copied', 'Vault address copied'); }}
          >
            <Text style={styles.monoAddr}>
              {vaultInfo.vault_address.slice(0, 18)}…{vaultInfo.vault_address.slice(-10)}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.vaultRow}>
          <Text style={styles.vaultLabel}>Locked</Text>
          <Text style={styles.vaultVal}>{vaultInfo.locked_zion} ZION</Text>
        </View>
        <View style={styles.vaultRow}>
          <Text style={styles.vaultLabel}>Threshold</Text>
          <Text style={styles.vaultVal}>
            {vaultInfo.threshold}/{vaultInfo.validators} (fail-closed)
          </Text>
        </View>
        <View style={styles.vaultRow}>
          <Text style={styles.vaultLabel}>Bridge contract</Text>
          <TouchableOpacity
            onPress={() => { Clipboard.setString(vaultInfo.bridge_contract); Alert.alert('Copied', 'Bridge contract copied'); }}
          >
            <Text style={styles.monoAddr}>
              {vaultInfo.bridge_contract.slice(0, 14)}…{vaultInfo.bridge_contract.slice(-10)}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.vaultRow}>
          <Text style={styles.vaultLabel}>Validator contract</Text>
          <TouchableOpacity
            onPress={() => { Clipboard.setString(vaultInfo.validator_contract); Alert.alert('Copied', 'Validator contract copied'); }}
          >
            <Text style={styles.monoAddr}>
              {vaultInfo.validator_contract.slice(0, 14)}…{vaultInfo.validator_contract.slice(-10)}
            </Text>
          </TouchableOpacity>
        </View>
      </GlassCard>
    );
  }

  // ── Atomic Swap ───────────────────────────────────────────────────────
  function renderAtomicSwap() {
    return (
      <GlassCard style={styles.card}>
        <Text style={styles.cardTitle}>Atomic Swap (L2)</Text>
        <View style={styles.vaultRow}>
          <Text style={styles.vaultLabel}>Escrow</Text>
          <TouchableOpacity
            onPress={() => { Clipboard.setString(ATOMIC_SWAP.escrow_address); Alert.alert('Copied', 'Escrow address copied'); }}
          >
            <Text style={styles.monoAddr}>
              {ATOMIC_SWAP.escrow_address.slice(0, 18)}…{ATOMIC_SWAP.escrow_address.slice(-10)}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.vaultRow}>
          <Text style={styles.vaultLabel}>EVM contract</Text>
          <TouchableOpacity
            onPress={() => { Clipboard.setString(ATOMIC_SWAP.evm_contract); Alert.alert('Copied', 'EVM contract copied'); }}
          >
            <Text style={styles.monoAddr}>
              {ATOMIC_SWAP.evm_contract.slice(0, 14)}…{ATOMIC_SWAP.evm_contract.slice(-10)}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.vaultRow}>
          <Text style={styles.vaultLabel}>Status</Text>
          <Text style={styles.vaultVal}>{ATOMIC_SWAP.status} (port {ATOMIC_SWAP.api_port})</Text>
        </View>
        <View style={styles.vaultRow}>
          <Text style={styles.vaultLabel}>Funding</Text>
          <Text style={styles.vaultVal}>{ATOMIC_SWAP.funding_needed}</Text>
        </View>
      </GlassCard>
    );
  }

  // ── Proposals list ────────────────────────────────────────────────────
  function renderProposals() {
    if (!proposals || proposals.length === 0) {
      return (
        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Active Proposals</Text>
          <Text style={styles.emptyText}>No active proposals</Text>
        </GlassCard>
      );
    }
    return (
      <GlassCard style={styles.card}>
        <Text style={styles.cardTitle}>Active Proposals ({proposals.length})</Text>
        <View style={styles.proposalList}>
          {proposals.map((p, idx) => (
            <View key={p.id ?? idx} style={styles.proposalItem}>
              <View style={styles.proposalHeader}>
                <Text style={styles.proposalId}>#{p.id ?? idx + 1}</Text>
                <Text style={styles.proposalStatus}>{p.status ?? 'Active'}</Text>
              </View>
              <Text style={styles.proposalTitle} numberOfLines={2}>
                {p.title ?? p.description ?? 'Untitled proposal'}
              </Text>
              {p.votes_for !== undefined && (
                <View style={styles.voteRow}>
                  <Text style={styles.voteFor}>✓ {p.votes_for ?? 0}</Text>
                  <Text style={styles.voteAgainst}>✗ {p.votes_against ?? 0}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </GlassCard>
    );
  }

  // ── Root render ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.gold} />
        <Text style={styles.loadingText}>Loading DAO…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.gold} />}
    >
      {renderHeader()}
      {renderStats()}
      {renderTreasury()}
      {renderBridgeVault()}
      {renderAtomicSwap()}
      {renderProposals()}

      <View style={styles.footer}>
        <Icon name="information-outline" size={14} color={colors.text.muted} />
        <Text style={styles.footerText}>
          {' '}Guardian operations (vote/submit) available on web dashboard
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.sm,
    color: colors.text.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h2,
    marginLeft: spacing.sm,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  online: {
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  offline: {
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.primary,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  statVal: {
    ...typography.h3,
    color: colors.primary.gold,
  },
  statLabel: {
    ...typography.label,
    marginTop: 2,
  },
  multisigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  multisigText: {
    ...typography.caption,
    color: colors.primary.cyan,
  },
  treasuryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  treasuryLabel: {
    ...typography.body,
  },
  treasuryVal: {
    ...typography.body,
    color: colors.primary.gold,
    fontWeight: '700',
  },
  vaultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  vaultLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  vaultVal: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
  },
  monoAddr: {
    ...typography.caption,
    color: colors.text.primary,
    fontFamily: 'monospace',
    textDecorationLine: 'underline',
  },
  emptyText: {
    ...typography.body,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  proposalList: {
    gap: spacing.sm,
  },
  proposalItem: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  proposalId: {
    ...typography.label,
    color: colors.primary.gold,
  },
  proposalStatus: {
    ...typography.label,
    color: colors.status.success,
  },
  proposalTitle: {
    ...typography.body,
    color: colors.text.primary,
  },
  voteRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 4,
  },
  voteFor: {
    ...typography.caption,
    color: colors.status.success,
  },
  voteAgainst: {
    ...typography.caption,
    color: colors.status.error,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    opacity: 0.6,
  },
  footerText: {
    ...typography.caption,
  },
});

export default DAOScreen;
