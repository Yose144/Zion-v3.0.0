/**
 * ZION Receive Screen v3.0.0
 * 
 * Features:
 * - Display wallet QR code
 * - Copy address to clipboard
 * - Share address
 * - Request specific amount
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  TextInput,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import QRCode from 'react-native-qrcode-svg';
import { useWallet } from '../context/WalletContext';
import GlassCard from '../components/common/GlassCard';
import GradientButton from '../components/common/GradientButton';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

const ReceiveScreen = ({ navigation }) => {
  const { activeWallet } = useWallet();
  const [requestAmount, setRequestAmount] = useState('');
  const [showAmountInput, setShowAmountInput] = useState(false);

  const address = activeWallet?.address || '';

  // Generate QR value (with optional amount)
  const getQRValue = () => {
    if (requestAmount && parseFloat(requestAmount) > 0) {
      return `zion:${address}?amount=${requestAmount}`;
    }
    return address;
  };

  // Copy address to clipboard
  const copyAddress = () => {
    Clipboard.setString(address);
    Alert.alert('Copied!', 'Address copied to clipboard');
  };

  // Share address
  const shareAddress = async () => {
    try {
      const message = requestAmount
        ? `Send ${requestAmount} ZION to my wallet:\n${address}\n\nOr scan this link:\nzion:${address}?amount=${requestAmount}`
        : `My ZION wallet address:\n${address}`;

      await Share.share({
        message,
        title: 'ZION Wallet Address',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  if (!activeWallet) {
    return (
      <View style={styles.container}>
        <Text style={styles.noWalletText}>No wallet selected</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Receive ZION</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* QR Code Card */}
      <GlassCard style={styles.qrCard}>
        <View style={styles.qrContainer}>
          <QRCode
            value={getQRValue()}
            size={200}
            backgroundColor="white"
            color={colors.background.dark}
            logo={require('../../assets/zion-logo.png')}
            logoSize={40}
            logoBackgroundColor="white"
            logoBorderRadius={8}
          />
        </View>

        {requestAmount && parseFloat(requestAmount) > 0 && (
          <View style={styles.requestAmountBadge}>
            <Text style={styles.requestAmountText}>
              Request: {requestAmount} ZION
            </Text>
          </View>
        )}
      </GlassCard>

      {/* Wallet Info */}
      <GlassCard style={styles.infoCard}>
        <Text style={styles.walletName}>{activeWallet.name}</Text>
        
        <View style={styles.addressContainer}>
          <Text style={styles.addressLabel}>Your ZION Address</Text>
          <Text style={styles.address} selectable>
            {address}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={copyAddress}>
            <Icon name="content-copy" size={24} color={colors.primary.cyan} />
            <Text style={styles.actionText}>Copy</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={shareAddress}>
            <Icon name="share-variant" size={24} color={colors.primary.cyan} />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowAmountInput(!showAmountInput)}
          >
            <Icon
              name={showAmountInput ? 'close' : 'currency-usd'}
              size={24}
              color={colors.primary.gold}
            />
            <Text style={styles.actionText}>
              {showAmountInput ? 'Cancel' : 'Request'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Request Amount Input */}
        {showAmountInput && (
          <View style={styles.amountInputContainer}>
            <Text style={styles.inputLabel}>Request Amount (optional)</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.amountInput}
                placeholder="0.0"
                placeholderTextColor={colors.text.muted}
                value={requestAmount}
                onChangeText={setRequestAmount}
                keyboardType="decimal-pad"
              />
              <Text style={styles.currencyLabel}>ZION</Text>
            </View>
            {requestAmount && (
              <Text style={styles.qrNote}>
                QR code now includes the requested amount
              </Text>
            )}
          </View>
        )}
      </GlassCard>

      {/* Instructions */}
      <GlassCard style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>How to Receive ZION</Text>
        <View style={styles.instruction}>
          <Icon name="numeric-1-circle" size={20} color={colors.primary.cyan} />
          <Text style={styles.instructionText}>
            Share your address or QR code with the sender
          </Text>
        </View>
        <View style={styles.instruction}>
          <Icon name="numeric-2-circle" size={20} color={colors.primary.cyan} />
          <Text style={styles.instructionText}>
            They scan the QR or paste the address in their wallet
          </Text>
        </View>
        <View style={styles.instruction}>
          <Icon name="numeric-3-circle" size={20} color={colors.primary.cyan} />
          <Text style={styles.instructionText}>
            Funds arrive after network confirmation (~1 min)
          </Text>
        </View>
      </GlassCard>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  noWalletText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  qrCard: {
    alignItems: 'center',
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  qrContainer: {
    padding: spacing.md,
    backgroundColor: 'white',
    borderRadius: borderRadius.lg,
  },
  requestAmountBadge: {
    marginTop: spacing.md,
    backgroundColor: colors.primary.gold + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  requestAmountText: {
    ...typography.caption,
    color: colors.primary.gold,
    fontWeight: 'bold',
  },
  infoCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  walletName: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  addressContainer: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  addressLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.xs,
  },
  address: {
    ...typography.small,
    color: colors.text.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  actionText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  amountInputContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.text.muted + '30',
  },
  inputLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountInput: {
    flex: 1,
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text.primary,
    ...typography.body,
  },
  currencyLabel: {
    ...typography.body,
    color: colors.primary.gold,
    marginLeft: spacing.sm,
    fontWeight: 'bold',
  },
  qrNote: {
    ...typography.small,
    color: colors.status.success,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  instructionsCard: {
    padding: spacing.md,
  },
  instructionsTitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  instruction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  instructionText: {
    ...typography.body,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
});

export default ReceiveScreen;
