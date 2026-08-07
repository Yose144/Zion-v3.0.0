import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useWallet} from '../context/WalletContext';
import {useMining} from '../context/MiningContext';
import PoolAPI from '../services/PoolAPI';
import GlassCard from '../components/common/GlassCard';
import GradientButton from '../components/common/GradientButton';
import {colors, spacing, typography, borderRadius} from '../constants/theme';
import {CONFIG} from '../constants/config';
import {
  BLOCK_REWARD_ZION,
  MINER_SHARE_PERCENT,
  HUMANITARIAN_PCT,
  ISSOBELLA_PCT,
  POOL_FEE_PERCENT,
  TARGET_BLOCK_TIME_SEC,
  ALGORITHM_DISPLAY,
  CHV4_NPU_FORK_HEIGHT,
  formatZion,
} from '../constants/blockchain';

const MiningScreen = () => {
  const {activeWallet} = useWallet();
  const {miningStats, startMining, stopMining, checkConditions} = useMining();
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [acceptedWarning, setAcceptedWarning] = useState(false);
  const [poolStats, setPoolStats] = useState(null);
  const [poolMinerStats, setPoolMinerStats] = useState(null);

  // Load pool stats
  useEffect(() => {
    loadPoolStats();
    const interval = setInterval(loadPoolStats, 30000);
    return () => clearInterval(interval);
  }, [activeWallet]);

  const loadPoolStats = async () => {
    try {
      const pool = await PoolAPI.getPoolStats();
      setPoolStats(pool);
      if (activeWallet?.address) {
        const miner = await PoolAPI.getMinerStats(activeWallet.address);
        setPoolMinerStats(miner);
      }
    } catch (e) {
      // silent — pool may be unreachable
    }
  };

  const handleStartMining = async () => {
    if (!activeWallet || activeWallet.chainId !== 'ZION' || activeWallet.walletType === 'external') {
      Alert.alert('ZION Wallet Required', 'Select a ZION wallet to start mobile mining.');
      return;
    }

    if (!acceptedWarning) {
      setShowWarningModal(true);
      return;
    }

    try {
      const check = await checkConditions();
      if (!check.canStart) {
        Alert.alert(
          'Cannot Start Mining',
          check.errors.join('\n'),
          [{text: 'OK'}]
        );
        return;
      }

      await startMining(activeWallet.address);
    } catch (error) {
      Alert.alert('Mining Error', error.message);
    }
  };

  const handleAcceptWarning = async () => {
    if (!activeWallet || activeWallet.chainId !== 'ZION' || activeWallet.walletType === 'external') {
      Alert.alert('ZION Wallet Required', 'Select a ZION wallet to start mobile mining.');
      return;
    }

    setAcceptedWarning(true);
    setShowWarningModal(false);
    
    // Pokus o start
    try {
      const check = await checkConditions();
      if (!check.canStart) {
        Alert.alert(
          'Cannot Start Mining',
          check.errors.join('\n'),
          [{text: 'OK'}]
        );
        return;
      }

      await startMining(activeWallet.address);
    } catch (error) {
      Alert.alert('Mining Error', error.message);
    }
  };

  const handleStopMining = () => {
    Alert.alert(
      'Stop Mining?',
      'Are you sure you want to stop mining?',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Stop', style: 'destructive', onPress: stopMining},
      ]
    );
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!activeWallet) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="alert-circle-outline" size={80} color={colors.text.muted} />
        <Text style={styles.emptyTitle}>No Wallet Selected</Text>
        <Text style={styles.emptyText}>
          Select a wallet to start mining
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mining Status */}
      <GlassCard style={styles.card}>
        <View style={styles.statusHeader}>
          <View style={[
            styles.statusIndicator,
            miningStats.isMining && styles.statusActive
          ]} />
          <Text style={styles.statusText}>
            {miningStats.isMining ? 'MINING ACTIVE' : 'MINING IDLE'}
          </Text>
        </View>

        {miningStats.isMining ? (
          <>
            {/* Hashrate Display */}
            <View style={styles.hashrateContainer}>
              <Text style={styles.hashrateValue}>
                {miningStats.hashrate.toFixed(2)}
              </Text>
              <Text style={styles.hashrateUnit}>H/s</Text>
            </View>

            {/* Mining Stats */}
            <View style={styles.statsGrid}>
              <StatItem
                icon="check-circle"
                label="Shares"
                value={miningStats.shares.toString()}
              />
              <StatItem
                icon="clock-outline"
                label="Runtime"
                value={formatTime(miningStats.runtime)}
              />
              <StatItem
                icon="timer-sand"
                label="Remaining"
                value={formatTime(miningStats.remainingTime)}
              />
              <StatItem
                icon="thermometer"
                label="Temp"
                value={`${miningStats.temperature}°C`}
              />
            </View>

            {/* Stop Button */}
            <GradientButton
              title="Stop Mining"
              onPress={handleStopMining}
              variant="purple"
              style={styles.actionButton}
            />
          </>
        ) : (
          <>
            <Text style={styles.idleText}>
              Start experimental CPU mining on your device
            </Text>
            <GradientButton
              title="Start Mining"
              onPress={handleStartMining}
              variant="gold"
              style={styles.actionButton}
            />
          </>
        )}
      </GlassCard>

      {/* Device Status */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Device Status</Text>
        <DeviceStatusItem
          icon="battery"
          label="Battery"
          value={`${miningStats.batteryLevel.toFixed(0)}%`}
          status={miningStats.batteryLevel >= CONFIG.MINING.MIN_BATTERY_PERCENT}
        />
        <DeviceStatusItem
          icon="power-plug"
          label="Charging"
          value={miningStats.isCharging ? 'Yes' : 'No'}
          status={!CONFIG.MINING.REQUIRE_CHARGING || miningStats.isCharging}
        />
        <DeviceStatusItem
          icon="wifi"
          label="WiFi"
          value={miningStats.isWiFi ? 'Connected' : 'Disconnected'}
          status={!CONFIG.MINING.REQUIRE_WIFI || miningStats.isWiFi}
        />
        <DeviceStatusItem
          icon="thermometer"
          label="Temperature"
          value={`${miningStats.temperature}°C`}
          status={miningStats.temperature < CONFIG.MINING.MAX_TEMPERATURE_C}
        />
      </GlassCard>

      {/* Mining Limits */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Safety Limits</Text>
        <Text style={styles.limitText}>
          ⏱️ Max Duration: {CONFIG.MINING.MAX_DURATION_MINUTES} minutes
        </Text>
        <Text style={styles.limitText}>
          🔋 Min Battery: {CONFIG.MINING.MIN_BATTERY_PERCENT}%
        </Text>
        <Text style={styles.limitText}>
          🌡️ Max Temperature: {CONFIG.MINING.MAX_TEMPERATURE_C}°C
        </Text>
        {CONFIG.MINING.REQUIRE_CHARGING && (
          <Text style={styles.limitText}>⚡ Requires Charging</Text>
        )}
        {CONFIG.MINING.REQUIRE_WIFI && (
          <Text style={styles.limitText}>📶 Requires WiFi</Text>
        )}
      </GlassCard>

      {/* Pool Connection Status */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Pool Status</Text>
        <DeviceStatusItem
          icon="server-network"
          label="Pool Connection"
          value={poolStats ? 'Online' : 'Offline'}
          status={!!poolStats}
        />
        <DeviceStatusItem
          icon="account-group"
          label="Pool Miners"
          value={poolStats?.totalMiners?.toString() || '—'}
          status={true}
        />
        <DeviceStatusItem
          icon="speedometer"
          label="Pool Hashrate"
          value={poolStats?.poolHashrate || '—'}
          status={true}
        />
        {poolMinerStats && (
          <>
            <DeviceStatusItem
              icon="flash"
              label="Your Pool Hashrate"
              value={poolMinerStats.hashrate || '0 H/s'}
              status={true}
            />
            <DeviceStatusItem
              icon="currency-usd"
              label="Pending Payout"
              value={`${poolMinerStats.pending || '0'} ZION`}
              status={true}
            />
          </>
        )}
      </GlassCard>

      {/* Block Reward Info */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>⛏️ Reward Structure</Text>
        {/* CHv4 algo badge */}
        <View style={styles.algoBadge}>
          <Icon name="cpu-64-bit" size={14} color={colors.primary.gold} />
          <Text style={styles.algoBadgeText}>{ALGORITHM_DISPLAY} — NPU Mixing aktivní</Text>
        </View>
        <Text style={styles.limitText}>
          💰 Block Reward: {formatZion(BLOCK_REWARD_ZION)} ZION / block
        </Text>
        <Text style={styles.limitText}>
          ⛏️ Miners: {MINER_SHARE_PERCENT}% ({formatZion(BLOCK_REWARD_ZION * MINER_SHARE_PERCENT / 100)} ZION)
        </Text>
        <Text style={styles.limitText}>
          🌍 Humanitarian (L5): {HUMANITARIAN_PCT}% ({formatZion(BLOCK_REWARD_ZION * HUMANITARIAN_PCT / 100)} ZION)
        </Text>
        <Text style={styles.limitText}>
          🔭 Issobella (L6): {ISSOBELLA_PCT}% ({formatZion(BLOCK_REWARD_ZION * ISSOBELLA_PCT / 100)} ZION)
        </Text>
        <Text style={styles.limitText}>
          🏊 Pool Fee: {POOL_FEE_PERCENT}%
        </Text>
        <Text style={styles.limitText}>
          ⏱️ Target Block Time: {TARGET_BLOCK_TIME_SEC}s
        </Text>
        <Text style={styles.limitText}>
          📡 Stratum: {CONFIG.POOL_HOST}:{CONFIG.POOL_PORT}
        </Text>
      </GlassCard>

      {/* Warning Card */}
      <GlassCard style={[styles.card, styles.warningCard]}>
        <Icon name="alert" size={32} color={colors.status.warning} />
        <Text style={styles.warningTitle}>Experimental Feature</Text>
        <Text style={styles.warningText}>
          Mobile mining is EXPERIMENTAL and NOT recommended for regular use.
          It may:
          {'\n'}• Drain battery quickly
          {'\n'}• Cause device heating
          {'\n'}• Reduce device lifespan
          {'\n'}• Provide minimal rewards
          {'\n\n'}
          Use at your own risk. Desktop mining is recommended for best results.
        </Text>
      </GlassCard>

      {/* Warning Modal */}
      <Modal visible={showWarningModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modal}>
            <Icon name="alert-octagon" size={64} color={colors.status.warning} />
            <Text style={styles.modalTitle}>⚠️ Important Warning</Text>
            
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalText}>
                Mobile mining is EXPERIMENTAL and comes with significant risks:
                {'\n\n'}
                <Text style={styles.boldText}>Battery & Performance:</Text>
                {'\n'}• Rapid battery drain
                {'\n'}• Device overheating
                {'\n'}• Reduced performance
                {'\n'}• Shortened battery lifespan
                {'\n\n'}
                <Text style={styles.boldText}>Rewards:</Text>
                {'\n'}• Very low hashrate (~10-50 H/s)
                {'\n'}• Minimal ZION earnings
                {'\n'}• High energy cost vs. reward
                {'\n\n'}
                <Text style={styles.boldText}>Recommendations:</Text>
                {'\n'}• Use only when device is charging
                {'\n'}• Monitor temperature closely
                {'\n'}• Limit session to 30 minutes
                {'\n'}• Desktop mining is MUCH more efficient
                {'\n\n'}
                <Text style={styles.boldText}>
                  By proceeding, you accept these risks and understand this is
                  for EXPERIMENTAL purposes only.
                </Text>
              </Text>
            </ScrollView>

            <View style={styles.modalActions}>
              <GradientButton
                title="I Understand - Proceed"
                onPress={handleAcceptWarning}
                variant="gold"
                style={styles.modalButton}
              />
              <GradientButton
                title="Cancel"
                onPress={() => setShowWarningModal(false)}
                variant="purple"
                style={styles.modalButton}
              />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </ScrollView>
  );
};

const StatItem = ({icon, label, value}) => (
  <View style={styles.statItem}>
    <Icon name={icon} size={24} color={colors.primary.green} />
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const DeviceStatusItem = ({icon, label, value, status}) => (
  <View style={styles.deviceStatusItem}>
    <View style={styles.deviceStatusLeft}>
      <Icon
        name={icon}
        size={24}
        color={status ? colors.status.success : colors.status.error}
      />
      <Text style={styles.deviceStatusLabel}>{label}</Text>
    </View>
    <Text style={[
      styles.deviceStatusValue,
      {color: status ? colors.status.success : colors.status.error}
    ]}>
      {value}
    </Text>
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
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.text.muted,
    marginRight: spacing.sm,
  },
  statusActive: {
    backgroundColor: colors.status.success,
  },
  statusText: {
    ...typography.label,
  },
  hashrateContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  hashrateValue: {
    ...typography.h1,
    fontSize: 48,
    color: colors.primary.gold,
  },
  hashrateUnit: {
    ...typography.h3,
    color: colors.text.muted,
  },
  idleText: {
    ...typography.body,
    textAlign: 'center',
    marginVertical: spacing.xl,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
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
  actionButton: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  deviceStatusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  deviceStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  deviceStatusLabel: {
    ...typography.body,
  },
  deviceStatusValue: {
    ...typography.body,
    fontWeight: '600',
  },
  limitText: {
    ...typography.body,
    marginBottom: spacing.sm,
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
  },
  warningCard: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderColor: colors.status.warning,
    borderWidth: 1,
    alignItems: 'center',
  },
  warningTitle: {
    ...typography.h3,
    color: colors.status.warning,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  warningText: {
    ...typography.body,
    textAlign: 'left',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 450,
    maxHeight: '90%',
    alignItems: 'center',
  },
  modalTitle: {
    ...typography.h2,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  modalScroll: {
    maxHeight: 400,
    marginBottom: spacing.lg,
  },
  modalText: {
    ...typography.body,
    lineHeight: 24,
  },
  boldText: {
    fontWeight: 'bold',
    color: colors.primary.gold,
  },
  modalActions: {
    width: '100%',
    gap: spacing.md,
  },
  modalButton: {
    width: '100%',
  },
});

export default MiningScreen;
