/**
 * ZION Network Screen v3.0.0
 *
 * Shows real-time network topology, node health, chain info,
 * and sync status from the Rust core via RPC / Pool API.
 * Uses POOL_HOSTS (Edge mainnet) — V3 mainnet era.
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GlassCard from '../components/common/GlassCard';
import {colors, spacing, typography, borderRadius} from '../constants/theme';
import {CONFIG} from '../constants/config';
import {ALGORITHM_DISPLAY} from '../constants/blockchain';
import BlockchainRPC from '../services/BlockchainRPC';
import PoolAPI from '../services/PoolAPI';
import {
  TOTAL_SUPPLY,
  GENESIS_PREMINE,
  MINING_EMISSION,
  TOTAL_MINING_BLOCKS,
  TARGET_BLOCK_TIME_SEC,
  COINBASE_MATURITY,
  MAX_REORG_DEPTH,
  circulatingSupply,
  remainingMining,
  formatZion,
} from '../constants/blockchain';

const {width} = Dimensions.get('window');

const NetworkScreen = () => {
  const [loading, setLoading] = useState(false);
  const [chainInfo, setChainInfo] = useState(null);
  const [poolStats, setPoolStats] = useState(null);
  const [nodeStatuses, setNodeStatuses] = useState([]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, CONFIG.REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [network, pool] = await Promise.all([
        PoolAPI.getNetworkInfo(),
        PoolAPI.getPoolStats(),
      ]);
      setChainInfo(network);
      setPoolStats(pool);

      // Ping all nodes from POOL_HOSTS (Helsinki / USA / Asia)
      const statuses = await Promise.all(
        CONFIG.POOL_HOSTS.map(async (node) => {
          const url = `http://${node.host}:8444`;
          const start = Date.now();
          try {
            const res = await fetch(`${url}/`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({jsonrpc: '2.0', method: 'getinfo', params: [], id: 1}),
              signal: AbortSignal.timeout(5000),
            });
            const latency = Date.now() - start;
            const data = await res.json();
            return {
              name: node.name,
              host: node.host,
              online: true,
              latency,
              height: data?.result?.height || '?',
            };
          } catch {
            return {name: node.name, host: node.host, online: false, latency: null, height: null};
          }
        }),
      );
      setNodeStatuses(statuses);
    } catch (error) {
      console.error('Network data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const height = chainInfo?.height || 0;
  const progress = TOTAL_MINING_BLOCKS > 0
    ? Math.min(100, (height / TOTAL_MINING_BLOCKS) * 100)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={loadData}
          tintColor={colors.primary.gold}
        />
      }>
      {/* Chain Overview */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>⛓️ Chain Overview</Text>
        <View style={styles.grid}>
          <InfoRow label="Block Height" value={height.toLocaleString()} />
          <InfoRow label="Difficulty" value={chainInfo?.difficulty || '—'} />
          <InfoRow label="Network Hashrate" value={chainInfo?.networkHashrate || '—'} />
          <InfoRow label="Connected Peers" value={chainInfo?.peers?.toString() || '—'} />
          <InfoRow label="Target Block Time" value={`${TARGET_BLOCK_TIME_SEC}s`} />
          <InfoRow label="Coinbase Maturity" value={`${COINBASE_MATURITY} blocks`} />
          <InfoRow label="Max Reorg Depth" value={`${MAX_REORG_DEPTH} blocks`} />
        </View>
      </GlassCard>

      {/* Mining Progress */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>📊 Mining Progress</Text>
        <View style={styles.progressBarOuter}>
          <View style={[styles.progressBarInner, {width: `${progress}%`}]} />
        </View>
        <Text style={styles.progressText}>
          {progress.toFixed(4)}% of emission complete
        </Text>
        <View style={styles.grid}>
          <InfoRow label="Circulating" value={`${formatZion(circulatingSupply(height))} ZION`} />
          <InfoRow label="Remaining Mining" value={`${formatZion(remainingMining(height))} ZION`} />
          <InfoRow label="Total Mining Emission" value={`${(MINING_EMISSION / 1e9).toFixed(2)}B ZION`} />
          <InfoRow label="Genesis Premine" value={`${(GENESIS_PREMINE / 1e9).toFixed(2)}B ZION`} />
          <InfoRow label="Total Supply Cap" value={`${(TOTAL_SUPPLY / 1e9).toFixed(0)}B ZION`} />
          <InfoRow label="Blocks Until End" value={(TOTAL_MINING_BLOCKS - height).toLocaleString()} />
        </View>
      </GlassCard>

      {/* Node Status */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>🌐 Node Health</Text>
        {nodeStatuses.map((node, i) => (
          <View key={i} style={styles.nodeRow}>
            <Icon
              name={node.online ? 'check-circle' : 'close-circle'}
              size={20}
              color={node.online ? colors.status.success : colors.status.error}
            />
            <View style={styles.nodeInfo}>
              <Text style={styles.nodeUrl}>
                {node.name} <Text style={styles.nodeHost}>({node.host})</Text>
              </Text>
              {node.online ? (
                <Text style={styles.nodeDetail}>
                  {node.latency}ms · Block #{node.height}
                </Text>
              ) : (
                <Text style={[styles.nodeDetail, {color: colors.status.error}]}>
                  Unreachable
                </Text>
              )}
            </View>
          </View>
        ))}
        {nodeStatuses.length === 0 && (
          <Text style={styles.emptyText}>Loading node status...</Text>
        )}
      </GlassCard>

      {/* Pool Stats */}
      {poolStats && (
        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>🏊 Pool Overview</Text>
          <View style={styles.grid}>
            <InfoRow label="Pool Miners" value={poolStats.totalMiners?.toString() || '—'} />
            <InfoRow label="Pool Hashrate" value={poolStats.poolHashrate || '—'} />
            <InfoRow label="Blocks Found" value={poolStats.blocksFound?.toString() || '—'} />
            <InfoRow label="Last Block" value={poolStats.lastBlockTime || '—'} />
          </View>
        </GlassCard>
      )}

      {/* Version */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>ℹ️ Client Info</Text>
        <View style={styles.grid}>
          <InfoRow label="App Version" value={`v${CONFIG.VERSION}`} />
          <InfoRow label="Codename" value={CONFIG.CODENAME} />
          <InfoRow label="Algorithm" value={ALGORITHM_DISPLAY} />
          <InfoRow label="P2P Port" value={CONFIG.P2P_PORT?.toString()} />
          <InfoRow label="RPC Port" value="8444" />
          <InfoRow label="Stratum Port" value={CONFIG.POOL_PORT?.toString()} />
          <InfoRow label="Pool API Port" value="8080" />
        </View>
      </GlassCard>
    </ScrollView>
  );
};

const InfoRow = ({label, value}) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  card: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  grid: {
    gap: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  infoLabel: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  infoValue: {
    ...typography.body,
    color: colors.primary.green,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  progressBarOuter: {
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressBarInner: {
    height: '100%',
    backgroundColor: colors.primary.gold,
    borderRadius: 6,
  },
  progressText: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.text.muted,
    marginBottom: spacing.md,
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: spacing.md,
  },
  nodeInfo: {
    flex: 1,
  },
  nodeUrl: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  nodeHost: {
    ...typography.caption,
    color: colors.text.muted,
    fontWeight: '400',
  },
  nodeDetail: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
    color: colors.text.muted,
    padding: spacing.lg,
  },
});

export default NetworkScreen;
