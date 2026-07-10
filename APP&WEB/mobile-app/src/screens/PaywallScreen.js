// ─────────────────────────────────────────────────────────────────────────────
// PaywallScreen — IAP purchase UI (Pro upgrade + Miner Boost + Donations)
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GlassCard from '../components/common/GlassCard';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { useSubscription } from '../hooks/useSubscription';

const PaywallScreen = ({ navigation }) => {
  const {
    isPro,
    hasMinerBoost,
    products,
    loading,
    purchasing,
    error,
    purchase,
    restorePurchases,
    clearError,
    productIds,
  } = useSubscription();

  // ── Handle purchase button tap ───────────────────────────────────────────────
  const handlePurchase = async (productId, title) => {
    try {
      await purchase(productId);
    } catch (err) {
      Alert.alert('Purchase Failed', err?.message || 'Please try again later.');
    }
  };

  // ── Handle restore ───────────────────────────────────────────────────────────
  const handleRestore = async () => {
    try {
      await restorePurchases();
      Alert.alert('Restore Complete', 'Your purchases have been restored.');
    } catch (err) {
      Alert.alert('Restore Failed', err?.message || 'Please try again later.');
    }
  };

  // ── Get product display info ─────────────────────────────────────────────────
  const getDisplayInfo = (productId) => {
    const product = products.find(p => p.productId === productId);
    if (product) {
      return {
        price: product.localizedPrice || product.price || '',
        title: product.title || productId,
        description: product.description || '',
      };
    }
    // Fallback if products not loaded yet
    const fallback = FALLBACK_PRICES[productId];
    return fallback || { price: '', title: productId, description: '' };
  };

  // ── Feature list for Pro ─────────────────────────────────────────────────────
  const proFeatures = [
    'Unlimited wallets',
    'Transaction history export (CSV)',
    'Advanced mining statistics',
    'Biometric unlock (Face ID / Fingerprint)',
    'Priority push notifications',
    'No advertisements',
    'Priority support',
  ];

  const boostFeatures = [
    'GPU mining unlock',
    'Advanced mining auto-tuner',
    'Real-time mining push notifications',
    'Hashrate optimization tips',
    'Temperature & power monitoring',
  ];

  if (loading && products.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.gold} />
        <Text style={styles.loadingText}>Loading store...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Icon name="crown" size={48} color={colors.primary.gold} />
        <Text style={styles.headerTitle}>Upgrade to ZION Pro</Text>
        <Text style={styles.headerSubtitle}>
          Unlock the full power of your ZION wallet & mining manager
        </Text>
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle" size={20} color="#f87171" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={clearError}>
            <Icon name="close" size={20} color={colors.text.muted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Pro status badge */}
      {isPro && (
        <View style={styles.proBadge}>
          <Icon name="check-decagram" size={24} color={colors.primary.gold} />
          <Text style={styles.proBadgeText}>Pro Active — Thank you!</Text>
        </View>
      )}

      {/* Pro Plans */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>ZION Pro</Text>
        <Text style={styles.sectionDesc}>Unlock all premium features</Text>

        {/* Feature list */}
        <View style={styles.featureList}>
          {proFeatures.map((feature, i) => (
            <View key={i} style={styles.featureRow}>
              <Icon name="check-circle" size={18} color={colors.primary.gold} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {/* Plan options */}
        <View style={styles.planGrid}>
          {/* Lifetime */}
          <TouchableOpacity
            style={[styles.planCard, isPro && styles.planCardDisabled]}
            disabled={isPro || purchasing}
            onPress={() => handlePurchase(productIds.proLifetime, 'Pro Lifetime')}
          >
            <Text style={styles.planName}>Lifetime</Text>
            <Text style={styles.planPrice}>{getDisplayInfo(productIds.proLifetime).price || '$29.99'}</Text>
            <Text style={styles.planNote}>One-time payment</Text>
            {isPro ? (
              <Text style={styles.planOwned}>Owned</Text>
            ) : (
              <Text style={styles.planCta}>Buy Now</Text>
            )}
          </TouchableOpacity>

          {/* Yearly */}
          <TouchableOpacity
            style={[styles.planCard, isPro && styles.planCardDisabled]}
            disabled={isPro || purchasing}
            onPress={() => handlePurchase(productIds.proYearly, 'Pro Yearly')}
          >
            <Text style={styles.planName}>Yearly</Text>
            <Text style={styles.planPrice}>{getDisplayInfo(productIds.proYearly).price || '$9.99/yr'}</Text>
            <Text style={styles.planNote}>Save 50%</Text>
            {isPro ? (
              <Text style={styles.planOwned}>Active</Text>
            ) : (
              <Text style={styles.planCta}>Subscribe</Text>
            )}
          </TouchableOpacity>

          {/* Monthly */}
          <TouchableOpacity
            style={[styles.planCard, isPro && styles.planCardDisabled]}
            disabled={isPro || purchasing}
            onPress={() => handlePurchase(productIds.proMonthly, 'Pro Monthly')}
          >
            <Text style={styles.planName}>Monthly</Text>
            <Text style={styles.planPrice}>{getDisplayInfo(productIds.proMonthly).price || '$1.99/mo'}</Text>
            <Text style={styles.planNote}>Cancel anytime</Text>
            {isPro ? (
              <Text style={styles.planOwned}>Active</Text>
            ) : (
              <Text style={styles.planCta}>Subscribe</Text>
            )}
          </TouchableOpacity>
        </View>
      </GlassCard>

      {/* Miner Boost */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Miner Boost</Text>
        <Text style={styles.sectionDesc}>Supercharge your mining experience</Text>

        <View style={styles.featureList}>
          {boostFeatures.map((feature, i) => (
            <View key={i} style={styles.featureRow}>
              <Icon name="check-circle" size={18} color={colors.primary.cyan} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.boostButton, hasMinerBoost && styles.planCardDisabled]}
          disabled={hasMinerBoost || purchasing}
          onPress={() => handlePurchase(productIds.minerBoost, 'Miner Boost')}
        >
          <View style={styles.boostButtonContent}>
            <View>
              <Text style={styles.boostPrice}>
                {getDisplayInfo(productIds.minerBoost).price || '$4.99'}
              </Text>
              <Text style={styles.boostNote}>One-time purchase</Text>
            </View>
            {hasMinerBoost ? (
              <Text style={styles.planOwned}>Owned</Text>
            ) : (
              <Text style={styles.boostCta}>Unlock</Text>
            )}
          </View>
        </TouchableOpacity>
      </GlassCard>

      {/* Donations */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Support Development</Text>
        <Text style={styles.sectionDesc}>ZION is open source — donations keep us going</Text>

        <View style={styles.donationRow}>
          <TouchableOpacity
            style={styles.donateButton}
            disabled={purchasing}
            onPress={() => handlePurchase(productIds.donate5, 'Donate $5')}
          >
            <Icon name="heart" size={24} color="#f87171" />
            <Text style={styles.donateAmount}>{getDisplayInfo(productIds.donate5).price || '$4.99'}</Text>
            <Text style={styles.donateLabel}>Donate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.donateButton}
            disabled={purchasing}
            onPress={() => handlePurchase(productIds.donate25, 'Donate $25')}
          >
            <Icon name="heart-multiple" size={24} color="#f87171" />
            <Text style={styles.donateAmount}>{getDisplayInfo(productIds.donate25).price || '$24.99'}</Text>
            <Text style={styles.donateLabel}>Donate</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>

      {/* Restore + Terms */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={handleRestore} disabled={loading || purchasing}>
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </TouchableOpacity>
        <Text style={styles.termsText}>
          Payments are charged to your App Store or Google Play account.{'\n'}
          Subscriptions auto-renew unless cancelled at least 24 hours before the period ends.{'\n'}
          Manage subscriptions in your store account settings.
        </Text>
      </View>

      {/* Purchasing overlay */}
      {purchasing && (
        <View style={styles.purchasingOverlay}>
          <ActivityIndicator size="large" color={colors.primary.gold} />
          <Text style={styles.purchasingText}>Processing purchase...</Text>
        </View>
      )}
    </ScrollView>
  );
};

// Fallback prices if store products not loaded
const FALLBACK_PRICES = {
  'zion.pro.lifetime': { price: '$29.99', title: 'Pro Lifetime' },
  'zion.pro.yearly': { price: '$9.99/yr', title: 'Pro Yearly' },
  'zion.pro.monthly': { price: '$1.99/mo', title: 'Pro Monthly' },
  'zion.miner.boost': { price: '$4.99', title: 'Miner Boost' },
  'zion.donate.5': { price: '$4.99', title: 'Donate $5' },
  'zion.donate.25': { price: '$24.99', title: 'Donate $25' },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.muted,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.primary.gold,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.25)',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#f87171',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  proBadgeText: {
    ...typography.body,
    color: colors.primary.gold,
    fontWeight: '600',
  },
  card: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  sectionDesc: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  featureList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    ...typography.body,
    flex: 1,
  },
  planGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  planCard: {
    flex: 1,
    backgroundColor: 'rgba(255,215,0,0.06)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
  },
  planCardDisabled: {
    opacity: 0.5,
  },
  planName: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary.gold,
  },
  planPrice: {
    ...typography.h3,
    fontSize: 18,
  },
  planNote: {
    fontSize: 11,
    color: colors.text.muted,
  },
  planCta: {
    fontSize: 13,
    color: colors.primary.cyan,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  planOwned: {
    fontSize: 13,
    color: colors.primary.gold,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  boostButton: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  boostButtonContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  boostPrice: {
    ...typography.h3,
    fontSize: 20,
    color: colors.primary.cyan,
  },
  boostNote: {
    fontSize: 12,
    color: colors.text.muted,
  },
  boostCta: {
    fontSize: 14,
    color: colors.primary.cyan,
    fontWeight: '700',
  },
  donationRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  donateButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(248,113,113,0.06)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.15)',
  },
  donateAmount: {
    ...typography.h3,
    fontSize: 18,
  },
  donateLabel: {
    fontSize: 12,
    color: colors.text.muted,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  restoreText: {
    ...typography.body,
    color: colors.primary.cyan,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 11,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 16,
  },
  purchasingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  purchasingText: {
    ...typography.body,
    color: colors.primary.gold,
  },
});

export default PaywallScreen;
