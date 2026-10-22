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
import {useWallet} from '../context/WalletContext';
import PoolAPI from '../services/PoolAPI';
import GlassCard from '../components/common/GlassCard';
import ConsciousnessRing from '../components/common/ConsciousnessRing';
import {colors, spacing, typography, borderRadius} from '../constants/theme';
import {CONFIG} from '../constants/config';
import {
  BLOCK_REWARD_ZION,
  TOTAL_SUPPLY,
  MINING_EMISSION,
  GENESIS_PREMINE,
  MINER_SHARE_PERCENT,
  HUMANITARIAN_PCT,
  ISSOBELLA_PCT,
  POOL_FEE_PERCENT,
  TARGET_BLOCK_TIME_SEC,
  ALGORITHM,
  ALGORITHM_DISPLAY,
  CHV4_NPU_FORK_HEIGHT,
  formatZion,
  circulatingSupply,
  remainingMining,
} from '../constants/blockchain';

const {width} = Dimensions.get('window');

const DashboardScreen = () => {
  const {activeWallet} = useWallet();
  const [loading, setLoading] = useState(false);
  const [poolStats, setPoolStats] = useState(null);
  const [minerStats, setMinerStats] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [recentBlocks, setRecentBlocks] = useState([]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, CONFIG.REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [activeWallet]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pool, network, blocks] = await Promise.all([
        PoolAPI.getPoolStats(),
        PoolAPI.getNetworkInfo(),
        PoolAPI.getRecentBlocks(5),
      ]);

      setPoolStats(pool);
      setNetworkInfo(network);
      setRecentBlocks(blocks);

      if (activeWallet) {
        const miner = await PoolAPI.getMinerStats(activeWallet.address);
        setMinerStats(miner);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!activeWallet) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="information-outline" size={80} color={colors.text.muted} />
        <Text style={styles.emptyTitle}>No Wallet Selected</Text>
        <Text style={styles.emptyText}>
          Create or select a wallet to view dashboard
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.primary.gold} />
      }>
      {/* Miner Stats */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Your Mining Stats</Text>
        <View style={styles.statsGrid}>
          <StatItem
            icon="flash"
            label="Hashrate"
            value={minerStats?.hashrate || '0 H/s'}
            color={colors.primary.green}
          />
          <StatItem
            icon="check-circle"
            label="Shares"
            value={minerStats?.shares || '0'}
            color={colors.primary.gold}
          />
          <StatItem
            icon="clock-outline"
            label="Last Share"
            value={minerStats?.lastShare || 'Never'}
            color={colors.primary.red}
          />
          <StatItem
            icon="currency-usd"
            label="Pending"
            value={`${minerStats?.pending || '0'} ZION`}
            color={colors.status.success}
          />
        </View>
      </GlassCard>

      {/* Consciousness Progress */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Consciousness Level</Text>
        <View style={styles.consciousnessContainer}>
          <ConsciousnessRing
            level={activeWallet.consciousness.level}
            currentXP={activeWallet.consciousness.xp}
            requiredXP={5000}
            size={120}
          />
          <View style={styles.consciousnessDetails}>
            <Text style={styles.consciousnessLevel}>
              {activeWallet.consciousness.level}
            </Text>
            <Text style={styles.consciousnessXP}>
              {activeWallet.consciousness.xp.toLocaleString()} XP
            </Text>
            <View style={styles.multiplierBadge}>
              <Text style={styles.multiplierText}>
                {CONFIG.CONSCIOUSNESS_LEVELS[activeWallet.consciousness.level]?.multiplier}x Multiplier
              </Text>
            </View>
          </View>
        </View>
      </GlassCard>

      {/* Pool Stats */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Pool Statistics</Text>
        <View style={styles.statsGrid}>
          <StatItem
            icon="account-group"
            label="Miners"
            value={poolStats?.totalMiners || '0'}
            color={colors.primary.gold}
          />
          <StatItem
            icon="speedometer"
            label="Pool Hashrate"
            value={poolStats?.poolHashrate || '0 H/s'}
            color={colors.primary.green}
          />
          <StatItem
            icon="cube-outline"
            label="Blocks Found"
            value={poolStats?.blocksFound || '0'}
            color={colors.primary.red}
          />
          <StatItem
            icon="chart-line"
            label="Difficulty"
            value={networkInfo?.difficulty || '0'}
            color={colors.status.info}
          />
        </View>
      </GlassCard>

      {/* Network Info */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Network Status</Text>
        <View style={styles.networkGrid}>
          <NetworkItem label="Block Height" value={networkInfo?.height?.toLocaleString() || '0'} />
          <NetworkItem label="Block Time" value={`${TARGET_BLOCK_TIME_SEC}s target`} />
          <NetworkItem label="Network Hashrate" value={networkInfo?.networkHashrate || '0 H/s'} />
          <NetworkItem label="Connected Peers" value={networkInfo?.peers || '0'} />
        </View>
      </GlassCard>

      {/* Emission & Tokenomics */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>💰 Emission & Tokenomics</Text>
        {/* CHv4 Algorithm Badge */}
        <View style={styles.algoBadge}>
          <Icon name="cpu-64-bit" size={16} color={colors.primary.gold} />
          <Text style={styles.algoBadgeText}>
            {ALGORITHM_DISPLAY} — NPU Mixing INT8 MLP (CHV4_FORK=0)
          </Text>
        </View>
        <View style={styles.networkGrid}>
          <NetworkItem
            label="Block Reward"
            value={`${formatZion(BLOCK_REWARD_ZION)} ZION`}
          />
          <NetworkItem
            label="⛏️ Miners (89%)"
            value={`${formatZion(BLOCK_REWARD_ZION * MINER_SHARE_PERCENT / 100)} ZION`}
          />
          <NetworkItem
            label="🌍 Humanitarian L5 (5%)"
            value={`${formatZion(BLOCK_REWARD_ZION * HUMANITARIAN_PCT / 100)} ZION`}
          />
          <NetworkItem
            label="🔭 Issobella L6 (5%)"
            value={`${formatZion(BLOCK_REWARD_ZION * ISSOBELLA_PCT / 100)} ZION`}
          />
          <NetworkItem
            label="🏊 Pool Fee (1%)"
            value={`${formatZion(BLOCK_REWARD_ZION * POOL_FEE_PERCENT / 100)} ZION`}
          />
          <NetworkItem
            label="Daily Emission"
            value={`~${formatZion(BLOCK_REWARD_ZION * 1440)} ZION`}
          />
          <NetworkItem
            label="Circulating Supply"
            value={`${formatZion(circulatingSupply(networkInfo?.height || 0))} ZION`}
          />
          <NetworkItem
            label="Total Supply"
            value={`${(TOTAL_SUPPLY / 1e9).toFixed(1)}B ZION`}
          />
          <NetworkItem
            label="Fee Policy"
            value="🔥 Burned (deflationary)"
          />
        </View>
      </GlassCard>

      {/* Recent Blocks */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Recent Blocks</Text>
        {recentBlocks.map((block, index) => (
          <BlockItem key={index} block={block} />
        ))}
        {recentBlocks.length === 0 && (
          <Text style={styles.noDataText}>No recent blocks found</Text>
        )}
      </GlassCard>
    </ScrollView>
  );
};

const StatItem = ({icon, label, value, color}) => (
  <View style={styles.statItem}>
    <Icon name={icon} size={32} color={color} />
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const NetworkItem = ({label, value}) => (
  <View style={styles.networkItem}>
    <Text style={styles.networkLabel}>{label}</Text>
    <Text style={styles.networkValue}>{value}</Text>
  </View>
);

const BlockItem = ({block}) => (
  <View style={styles.blockItem}>
    <View style={styles.blockIcon}>
      <Icon name="cube" size={24} color={colors.primary.gold} />
    </View>
    <View style={styles.blockInfo}>
      <Text style={styles.blockHeight}>Block #{block.height}</Text>
      <Text style={styles.blockTime}>{block.timestamp}</Text>
    </View>
    <View style={styles.blockReward}>
      <Text style={styles.blockRewardValue}>{block.reward} ZION</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.h2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
  },
  card: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statItem: {
    flex: 1,
    minWidth: (width - spacing.md * 4) / 2,
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: borderRadius.md,
  },
  statLabel: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  statValue: {
    ...typography.h3,
    marginTop: spacing.xs,
  },
  consciousnessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  consciousnessDetails: {
    flex: 1,
  },
  consciousnessLevel: {
    ...typography.h2,
    color: colors.primary.gold,
    marginBottom: spacing.xs,
  },
  consciousnessXP: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  multiplierBadge: {
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  multiplierText: {
    ...typography.caption,
    color: colors.background.dark,
    fontWeight: 'bold',
  },
  networkGrid: {
    gap: spacing.sm,
  },
  algoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(252, 209, 22,0.08)',
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(252, 209, 22,0.25)',
  },
  algoBadgeText: {
    fontSize: 12,
    color: '#fcd116',
    fontWeight: '600',
    flex: 1,
  },
  networkItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  networkLabel: {
    ...typography.body,
  },
  networkValue: {
    ...typography.body,
    color: colors.primary.green,
    fontWeight: '600',
  },
  blockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  blockIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(252, 209, 22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  blockInfo: {
    flex: 1,
  },
  blockHeight: {
    ...typography.body,
    fontWeight: '600',
  },
  blockTime: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  blockReward: {
    alignItems: 'flex-end',
  },
  blockRewardValue: {
    ...typography.body,
    color: colors.primary.gold,
    fontWeight: 'bold',
  },
  noDataText: {
    ...typography.body,
    textAlign: 'center',
    padding: spacing.lg,
  },
});

export default DashboardScreen;
