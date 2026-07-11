/**
 * DexScreen.js — ZionDex Cross-Chain Swap v1.0
 * ──────────────────────────────────────────────────────────────────────
 * Mobile swap interface for ZionDex Router API.
 * Supports cross-chain swaps between 13+ chains.
 *
 * Design: follows BridgeScreen.js pattern (GlassCard, GradientButton, theme).
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
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useWallet } from '../context/WalletContext';
import GlassCard from '../components/common/GlassCard';
import GradientButton from '../components/common/GradientButton';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import CONFIG from '../constants/config';

const ROUTER_URL = CONFIG.ZIONDEX_ROUTER_URL || 'http://localhost:8454';

const CHAINS = [
  { id: 'zion', name: 'ZION L1', color: '#fbbf24' },
  { id: 'base', name: 'Base', color: '#0052ff' },
  { id: 'arbitrum', name: 'Arbitrum', color: '#28a0f0' },
  { id: 'bsc', name: 'BNB Chain', color: '#f0b90b' },
  { id: 'polygon', name: 'Polygon', color: '#8247e5' },
  { id: 'optimism', name: 'Optimism', color: '#ff0420' },
  { id: 'avalanche', name: 'Avalanche', color: '#e84142' },
  { id: 'solana', name: 'Solana', color: '#14f195' },
  { id: 'tron', name: 'Tron', color: '#ff060a' },
  { id: 'stellar', name: 'Stellar', color: '#7d5fff' },
  { id: 'cardano', name: 'Cardano', color: '#0033ad' },
  { id: 'aptos', name: 'Aptos', color: '#06b6d4' },
  { id: 'sui', name: 'Sui', color: '#4da2ff' },
  { id: 'near', name: 'NEAR', color: '#00ec97' },
  { id: 'ton', name: 'TON', color: '#0098ea' },
];

const TOKENS_BY_CHAIN = {
  zion: ['ZION'],
  base: ['wZION', 'USDT', 'USDC', 'WETH'],
  arbitrum: ['wZION', 'USDC', 'WETH', 'ARB'],
  bsc: ['wZION', 'USDT', 'BNB'],
  polygon: ['wZION', 'USDC', 'WMATIC'],
  optimism: ['wZION', 'USDC', 'WETH'],
  avalanche: ['wZION', 'USDC', 'WAVAX'],
  solana: ['ZION', 'USDC', 'SOL'],
  tron: ['ZION', 'USDT', 'TRX'],
  stellar: ['ZION', 'USDC', 'XLM'],
  cardano: ['ZION', 'ADA'],
  aptos: ['ZION', 'USDC', 'APT'],
  sui: ['ZION', 'USDC', 'SUI'],
  near: ['ZION', 'USDC', 'NEAR'],
  ton: ['ZION', 'USDT', 'TON'],
};

export default function DexScreen({ navigation }) {
  const { wallet } = useWallet();

  const [srcChain, setSrcChain] = useState('solana');
  const [destChain, setDestChain] = useState('base');
  const [srcToken, setSrcToken] = useState('USDC');
  const [destToken, setDestToken] = useState('wZION');
  const [amount, setAmount] = useState('100');
  const [quote, setQuote] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | quoting | quoted | executing | success | error
  const [error, setError] = useState(null);
  const [showChainPicker, setShowChainPicker] = useState(null); // 'src' | 'dest' | null

  // Fetch quote
  const fetchQuote = useCallback(async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !srcToken || !destToken) {
      setQuote(null);
      setPhase('idle');
      return;
    }

    setPhase('quoting');
    setError(null);

    try {
      const resp = await fetch(`${ROUTER_URL}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          src_chain: srcChain,
          src_token: srcToken,
          dest_chain: destChain,
          dest_token: destToken,
          amount: amount,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Quote failed: ${text}`);
      }

      const data = await resp.json();
      setQuote(data);
      setPhase('quoted');
    } catch (e) {
      setError(e.message || 'Failed to get quote');
      setPhase('error');
      setQuote(null);
    }
  }, [srcChain, srcToken, destChain, destToken, amount]);

  // Debounced quote
  useEffect(() => {
    const timer = setTimeout(() => void fetchQuote(), 500);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  // Execute swap
  const executeSwap = async () => {
    if (!quote) return;

    setPhase('executing');
    setError(null);

    try {
      const resp = await fetch(`${ROUTER_URL}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote_id: quote.quote_id,
          sender: wallet?.address || 'user',
          recipient: wallet?.address || 'user',
          max_slippage_bps: 200,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Swap failed: ${text}`);
      }

      const data = await resp.json();
      setPhase('success');
      Alert.alert('Swap Submitted', `Swap ID: ${data.swap_id}\nStatus: ${data.status}`);
    } catch (e) {
      setError(e.message || 'Swap failed');
      setPhase('error');
    }
  };

  const swapChains = () => {
    setSrcChain(destChain);
    setDestChain(srcChain);
    setSrcToken(destToken);
    setDestToken(srcToken);
  };

  const availableSrcTokens = TOKENS_BY_CHAIN[srcChain] || [];
  const availableDestTokens = TOKENS_BY_CHAIN[destChain] || [];

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={phase === 'quoting'} onRefresh={fetchQuote} />}>
      {/* Header */}
      <View style={styles.header}>
        <Icon name="swap-horizontal" size={28} color={colors.primary} />
        <Text style={styles.title}>ZionDex Swap</Text>
      </View>

      {/* Source */}
      <GlassCard style={styles.card}>
        <Text style={styles.label}>FROM</Text>

        {/* Chain picker */}
        <TouchableOpacity
          style={styles.chainButton}
          onPress={() => setShowChainPicker('src')}
        >
          <View style={[styles.chainDot, { backgroundColor: CHAINS.find(c => c.id === srcChain)?.color }]} />
          <Text style={styles.chainName}>{CHAINS.find(c => c.id === srcChain)?.name}</Text>
          <Icon name="chevron-down" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Token + amount */}
        <View style={styles.tokenRow}>
          <TouchableOpacity
            style={styles.tokenButton}
            onPress={() => {
              const idx = availableSrcTokens.indexOf(srcToken);
              setSrcToken(availableSrcTokens[(idx + 1) % availableSrcTokens.length] || availableSrcTokens[0]);
            }}
          >
            <Text style={styles.tokenSymbol}>{srcToken || 'Select'}</Text>
            <Icon name="chevron-down" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.0"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />
        </View>
      </GlassCard>

      {/* Swap direction */}
      <TouchableOpacity style={styles.swapButton} onPress={swapChains}>
        <Icon name="swap-vertical" size={24} color={colors.primary} />
      </TouchableOpacity>

      {/* Destination */}
      <GlassCard style={styles.card}>
        <Text style={styles.label}>TO</Text>

        <TouchableOpacity
          style={styles.chainButton}
          onPress={() => setShowChainPicker('dest')}
        >
          <View style={[styles.chainDot, { backgroundColor: CHAINS.find(c => c.id === destChain)?.color }]} />
          <Text style={styles.chainName}>{CHAINS.find(c => c.id === destChain)?.name}</Text>
          <Icon name="chevron-down" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.tokenRow}>
          <TouchableOpacity
            style={styles.tokenButton}
            onPress={() => {
              const idx = availableDestTokens.indexOf(destToken);
              setDestToken(availableDestTokens[(idx + 1) % availableDestTokens.length] || availableDestTokens[0]);
            }}
          >
            <Text style={styles.tokenSymbol}>{destToken || 'Select'}</Text>
            <Icon name="chevron-down" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.amountOutput}>
            {quote ? parseFloat(quote.path.expected_output).toFixed(6) : '0.0'}
          </Text>
        </View>

        {phase === 'quoting' && <Text style={styles.quotingText}>Fetching best price...</Text>}
        {phase === 'quoted' && quote && (
          <Text style={styles.quoteInfo}>
            Min: {parseFloat(quote.path.min_output).toFixed(6)} · Fee: {(quote.path.total_fee_bps / 100).toFixed(2)}%
          </Text>
        )}
      </GlassCard>

      {/* Swap path */}
      {quote && quote.path.steps && quote.path.steps.length > 0 && (
        <GlassCard style={styles.pathCard}>
          <Text style={styles.pathTitle}>SWAP PATH ({quote.path.steps.length} steps)</Text>
          {quote.path.steps.map((step, i) => (
            <View key={i} style={styles.pathStep}>
              <Text style={styles.pathStepNum}>{i + 1}</Text>
              <Text style={styles.pathStepText}>
                {step.type === 'bridge'
                  ? `${step.from_chain} → ${step.to_chain} (${step.asset})`
                  : `${step.from_token} → ${step.to_token} on ${step.chain}`}
              </Text>
            </View>
          ))}
          <View style={styles.pathStats}>
            <Text style={styles.pathStat}>Est. time: ~{Math.ceil(quote.path.estimated_time_secs / 60)} min</Text>
            <Text style={styles.pathStat}>Impact: {(quote.path.price_impact_bps / 100).toFixed(2)}%</Text>
          </View>
        </GlassCard>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <Icon name="alert-circle" size={20} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Execute button */}
      <GradientButton
        onPress={executeSwap}
        disabled={!quote || phase === 'quoting' || phase === 'executing'}
        style={styles.executeButton}
      >
        {phase === 'executing' ? (
          <ActivityIndicator color="#000" />
        ) : phase === 'quoting' ? (
          'Getting quote...'
        ) : phase === 'quoted' ? (
          'Swap'
        ) : phase === 'success' ? (
          'Swap Again'
        ) : (
          'Enter amount'
        )}
      </GradientButton>

      {/* Chain picker modal */}
      {showChainPicker && (
        <View style={styles.chainPickerOverlay}>
          <View style={styles.chainPicker}>
            <Text style={styles.chainPickerTitle}>Select Chain</Text>
            {CHAINS.filter(c => c.id !== (showChainPicker === 'src' ? destChain : srcChain)).map(chain => (
              <TouchableOpacity
                key={chain.id}
                style={styles.chainPickerItem}
                onPress={() => {
                  if (showChainPicker === 'src') {
                    setSrcChain(chain.id);
                    setSrcToken('');
                  } else {
                    setDestChain(chain.id);
                    setDestToken('');
                  }
                  setShowChainPicker(null);
                }}
              >
                <View style={[styles.chainDot, { backgroundColor: chain.color }]} />
                <Text style={styles.chainName}>{chain.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowChainPicker(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  card: {
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  chainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  chainDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chainName: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tokenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
  },
  tokenSymbol: {
    ...typography.bodyBold,
    color: colors.text,
  },
  amountInput: {
    flex: 1,
    ...typography.h3,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  amountOutput: {
    flex: 1,
    ...typography.h3,
    color: colors.primary,
    paddingVertical: spacing.sm,
  },
  quotingText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  quoteInfo: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  swapButton: {
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pathCard: {
    marginBottom: spacing.sm,
  },
  pathTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  pathStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  pathStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary + '20',
    color: colors.primary,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pathStepText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  pathStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pathStat: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.error + '15',
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    flex: 1,
  },
  executeButton: {
    marginTop: spacing.sm,
  },
  chainPickerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  chainPicker: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  chainPickerTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  chainPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  cancelText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
