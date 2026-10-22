/**
 * ZION Transaction History Screen v3.0.0
 * 
 * Features:
 * - List all transactions (ZION)
 * - Filter by type (all / sent / received)
 * - Transaction detail modal with full TX info
 * - Pull to refresh
 * - Accessible from WalletScreen via Stack navigation
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useWallet } from '../context/WalletContext';
import GlassCard from '../components/common/GlassCard';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import BlockchainRPC from '../services/BlockchainRPC';

const TransactionHistoryScreen = ({ navigation }) => {
  const { activeWallet } = useWallet();
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all, sent, received
  const [selectedTx, setSelectedTx] = useState(null);

  const address = activeWallet?.address || '';

  // Load transactions
  const loadTransactions = useCallback(async () => {
    if (!address) return;
    
    try {
      const txs = await BlockchainRPC.getTransactionHistory(address, 100);
      setTransactions(txs);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [address]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Refresh handler
  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (filter === 'all') return true;
    if (filter === 'sent') return tx.from === address;
    if (filter === 'received') return tx.to === address;
    return true;
  });

  // Format date
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Less than 24 hours
    if (diff < 86400000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // Less than 7 days
    if (diff < 604800000) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    // Older
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Format amount
  const formatAmount = (amount, isSent) => {
    const prefix = isSent ? '-' : '+';
    return `${prefix}${parseFloat(amount).toFixed(4)}`;
  };

  // Render transaction item
  const renderTransaction = ({ item }) => {
    const isSent = item.from === address;
    const counterparty = isSent ? item.to : item.from;
    
    return (
      <TouchableOpacity onPress={() => setSelectedTx(item)}>
        <GlassCard style={styles.txCard}>
          <View style={styles.txIcon}>
            <Icon
              name={isSent ? 'arrow-up-circle' : 'arrow-down-circle'}
              size={32}
              color={isSent ? colors.status.warning : colors.status.success}
            />
          </View>
          
          <View style={styles.txInfo}>
            <Text style={styles.txType}>{isSent ? 'Sent' : 'Received'}</Text>
            <Text style={styles.txAddress} numberOfLines={1}>
              {isSent ? 'To: ' : 'From: '}
              {counterparty.slice(0, 10)}...{counterparty.slice(-6)}
            </Text>
          </View>
          
          <View style={styles.txAmount}>
            <Text
              style={[
                styles.amount,
                { color: isSent ? colors.status.warning : colors.status.success },
              ]}
            >
              {formatAmount(item.amount, isSent)}
            </Text>
            <Text style={styles.txTime}>{formatDate(item.timestamp)}</Text>
          </View>
          
          {item.status === 'pending' && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>Pending</Text>
            </View>
          )}
        </GlassCard>
      </TouchableOpacity>
    );
  };

  // Render transaction detail modal
  const renderDetailModal = () => {
    if (!selectedTx) return null;
    
    const isSent = selectedTx.from === address;
    
    return (
      <Modal
        visible={!!selectedTx}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTx(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedTx(null)}
        >
          <GlassCard style={styles.detailModal}>
            <View style={styles.detailHeader}>
              <Icon
                name={isSent ? 'arrow-up-circle' : 'arrow-down-circle'}
                size={48}
                color={isSent ? colors.status.warning : colors.status.success}
              />
              <Text style={styles.detailTitle}>
                {isSent ? 'Sent' : 'Received'}
              </Text>
              <Text
                style={[
                  styles.detailAmount,
                  { color: isSent ? colors.status.warning : colors.status.success },
                ]}
              >
                {formatAmount(selectedTx.amount, isSent)} ZION
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>
                  {selectedTx.status === 'confirmed' ? '✓ Confirmed' : '⏳ Pending'}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>
                {new Date(selectedTx.timestamp).toLocaleString()}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>From</Text>
              <Text style={styles.detailAddress} selectable>
                {selectedTx.from}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>To</Text>
              <Text style={styles.detailAddress} selectable>
                {selectedTx.to}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fee</Text>
              <Text style={styles.detailValue}>
                {selectedTx.fee || '0.001'} ZION
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>TX Hash</Text>
              <Text style={styles.detailHash} selectable numberOfLines={2}>
                {selectedTx.hash || selectedTx.txid || 'N/A'}
              </Text>
            </View>

            {selectedTx.confirmations && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Confirmations</Text>
                <Text style={styles.detailValue}>{selectedTx.confirmations}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedTx(null)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </GlassCard>
        </TouchableOpacity>
      </Modal>
    );
  };

  // Render empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="receipt" size={64} color={colors.text.muted} />
      <Text style={styles.emptyTitle}>No Transactions</Text>
      <Text style={styles.emptyText}>
        {filter === 'all'
          ? "You haven't made any transactions yet"
          : `No ${filter} transactions found`}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Transactions</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Icon name="refresh" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {['all', 'sent', 'received'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f && styles.filterTextActive,
              ]}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transaction List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.green} />
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.hash || item.txid || item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary.green}
            />
          }
          ListEmptyComponent={renderEmpty}
        />
      )}

      {/* Detail Modal */}
      {renderDetailModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  filterTabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
  },
  filterTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  filterTabActive: {
    backgroundColor: colors.primary.green + '30',
  },
  filterText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  filterTextActive: {
    color: colors.primary.green,
    fontWeight: 'bold',
  },
  listContent: {
    padding: spacing.md,
    paddingTop: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  txIcon: {
    marginRight: spacing.md,
  },
  txInfo: {
    flex: 1,
  },
  txType: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  txAddress: {
    ...typography.small,
    color: colors.text.secondary,
  },
  txAmount: {
    alignItems: 'flex-end',
  },
  amount: {
    ...typography.body,
    fontWeight: 'bold',
  },
  txTime: {
    ...typography.small,
    color: colors.text.muted,
  },
  pendingBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.status.warning + '30',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  pendingText: {
    ...typography.small,
    color: colors.status.warning,
    fontSize: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xl * 3,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  detailModal: {
    width: '100%',
    padding: spacing.lg,
  },
  detailHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  detailTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  detailAmount: {
    ...typography.h1,
    fontWeight: 'bold',
  },
  detailRow: {
    marginBottom: spacing.md,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.xs,
  },
  detailValue: {
    ...typography.body,
    color: colors.text.primary,
  },
  detailAddress: {
    ...typography.small,
    color: colors.text.primary,
    fontFamily: 'monospace',
  },
  detailHash: {
    ...typography.small,
    color: colors.primary.green,
    fontFamily: 'monospace',
  },
  statusBadge: {
    backgroundColor: colors.status.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  statusText: {
    ...typography.small,
    color: colors.status.success,
  },
  closeButton: {
    marginTop: spacing.md,
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
  },
  closeButtonText: {
    ...typography.body,
    color: colors.text.primary,
  },
});

export default TransactionHistoryScreen;
