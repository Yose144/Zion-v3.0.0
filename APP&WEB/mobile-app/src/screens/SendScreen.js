/**
 * ZION Send Transaction Screen v3.0.0
 * 
 * Features:
 * - UTXO-based transaction building (matches Rust core)
 * - Send ZION to any zion1… address
 * - QR code scanning for recipient
 * - Dynamic fee estimation from blockchain.js
 * - Fees are BURNED (deflationary)
 * - Transaction confirmation with password
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useWallet } from '../context/WalletContext';
import GlassCard from '../components/common/GlassCard';
import GradientButton from '../components/common/GradientButton';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { validateAddress } from '../utils/addressValidation';
import { estimateFee, formatZion, MIN_FEE_ZION } from '../constants/blockchain';
import QRScanner from '../components/QRScanner';

const FEE_TIERS = [
  { label: 'Low',    inputs: 1, sizeKB: 0.25 },
  { label: 'Normal', inputs: 2, sizeKB: 0.50 },
  { label: 'Fast',   inputs: 4, sizeKB: 1.00 },
];

const SendScreen = ({ navigation, route }) => {
  const { activeWallet, balance, sendZion, refreshBalance } = useWallet();
  
  // Form state
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [feeTier, setFeeTier] = useState(1); // index into FEE_TIERS
  const [memo, setMemo] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [txResult, setTxResult] = useState(null);

  // Consume deep-link / navigation params (zion:address?amount=X&memo=Y)
  useEffect(() => {
    const params = route?.params;
    if (!params) return;
    if (params.recipient) setRecipient(params.recipient);
    if (params.amount) setAmount(String(params.amount));
    if (params.memo) setMemo(params.memo);
  }, [route?.params]);

  // Compute fee from blockchain constants
  const fee = estimateFee(FEE_TIERS[feeTier].sizeKB);

  // Refresh balance on mount
  useEffect(() => {
    refreshBalance?.();
  }, [activeWallet]);

  // Handle QR scan
  const handleQRScan = (data) => {
    setShowScanner(false);
    if (data.startsWith('zion:')) {
      const parts = data.replace('zion:', '').split('?');
      setRecipient(parts[0]);
      if (parts[1]) {
        const params = new URLSearchParams(parts[1]);
        if (params.get('amount')) setAmount(params.get('amount'));
        if (params.get('memo')) setMemo(params.get('memo'));
      }
    } else if (data.startsWith('zion1')) {
      setRecipient(data);
    } else {
      Alert.alert('Invalid QR', 'This QR code does not contain a valid ZION address');
    }
  };

  // Validate form
  const validateForm = () => {
    if (!recipient) {
      Alert.alert('Error', 'Please enter a recipient address');
      return false;
    }
    if (!validateAddress(recipient)) {
      Alert.alert('Error', 'Invalid ZION address. Must start with zion1 and be 44 characters');
      return false;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return false;
    }
    const total = parseFloat(amount) + fee;
    if (total > balance) {
      Alert.alert('Error', `Insufficient balance. You have ${formatZion(balance)} ZION`);
      return false;
    }
    if (recipient === activeWallet?.address) {
      Alert.alert('Error', 'Cannot send to yourself');
      return false;
    }
    return true;
  };

  const handleSendPress = () => {
    if (validateForm()) setShowConfirm(true);
  };

  // Execute UTXO transaction via WalletContext.sendZion
  const executeSend = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter your wallet password');
      return;
    }
    setLoading(true);
    try {
      const {txId} = await sendZion(recipient, parseFloat(amount), password);

      setTxResult({
        success: true,
        txId,
        amount,
        recipient,
        fee,
      });
      setRecipient('');
      setAmount('');
      setMemo('');
      setPassword('');
      setShowConfirm(false);
    } catch (error) {
      console.error('Transaction failed:', error);
      setTxResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const setMaxAmount = () => {
    const maxAmount = Math.max(0, balance - fee);
    setAmount(maxAmount > 0 ? maxAmount.toFixed(8) : '0');
  };

  // Render confirmation modal
  const renderConfirmModal = () => (
    <Modal
      visible={showConfirm}
      transparent
      animationType="fade"
      onRequestClose={() => setShowConfirm(false)}
    >
      <View style={styles.modalOverlay}>
        <GlassCard style={styles.confirmModal}>
          <Text style={styles.modalTitle}>Confirm Transaction</Text>
          
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>To:</Text>
            <Text style={styles.confirmValue} numberOfLines={1}>
              {recipient.slice(0, 12)}...{recipient.slice(-8)}
            </Text>
          </View>
          
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Amount:</Text>
            <Text style={styles.confirmAmount}>{amount} ZION</Text>
          </View>
          
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Fee:</Text>
            <Text style={styles.confirmValue}>{fee.toFixed(6)} ZION</Text>
          </View>
          
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Total:</Text>
            <Text style={styles.confirmTotal}>
              {(parseFloat(amount) + fee).toFixed(8)} ZION
            </Text>
          </View>

          {/* Fee burn notice */}
          <View style={styles.burnNotice}>
            <Icon name="fire" size={16} color={colors.status.warning} />
            <Text style={styles.burnNoticeText}>
              Fee is permanently burned (deflationary)
            </Text>
          </View>

          {memo ? (
            <View style={styles.confirmRow}>
              <Text style={styles.confirmLabel}>Memo:</Text>
              <Text style={styles.confirmValue}>{memo}</Text>
            </View>
          ) : null}

          <TextInput
            style={styles.passwordInput}
            placeholder="Enter wallet password"
            placeholderTextColor={colors.text.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <View style={styles.confirmButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowConfirm(false);
                setPassword('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <GradientButton
              title={loading ? 'Sending...' : 'Confirm & Send'}
              onPress={executeSend}
              disabled={loading || !password}
              style={styles.confirmButton}
            />
          </View>
        </GlassCard>
      </View>
    </Modal>
  );

  // Render result modal
  const renderResultModal = () => (
    <Modal
      visible={!!txResult}
      transparent
      animationType="fade"
      onRequestClose={() => setTxResult(null)}
    >
      <View style={styles.modalOverlay}>
        <GlassCard style={styles.resultModal}>
          {txResult?.success ? (
            <>
              <Icon name="check-circle" size={64} color={colors.status.success} />
              <Text style={styles.resultTitle}>Transaction Sent!</Text>
              <Text style={styles.resultText}>
                {txResult.amount} ZION sent to
              </Text>
              <Text style={styles.resultAddress}>
                {txResult.recipient.slice(0, 16)}...
              </Text>
              <Text style={styles.txIdLabel}>Transaction ID:</Text>
              <Text style={styles.txId}>{txResult.txId}</Text>
            </>
          ) : (
            <>
              <Icon name="alert-circle" size={64} color={colors.status.error} />
              <Text style={styles.resultTitle}>Transaction Failed</Text>
              <Text style={styles.errorText}>{txResult?.error}</Text>
            </>
          )}
          
          <GradientButton
            title="Close"
            onPress={() => {
              setTxResult(null);
              if (txResult?.success) {
                navigation.goBack();
              }
            }}
            style={styles.closeButton}
          />
        </GlassCard>
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Send ZION</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Balance Card */}
        <GlassCard style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>{balance.toFixed(4)} ZION</Text>
          <Text style={styles.walletAddress}>
            {activeWallet?.address?.slice(0, 16)}...
          </Text>
        </GlassCard>

        {/* Send Form */}
        <GlassCard style={styles.formCard}>
          {/* Recipient */}
          <Text style={styles.inputLabel}>Recipient Address</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="zion1..."
              placeholderTextColor={colors.text.muted}
              value={recipient}
              onChangeText={setRecipient}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => setShowScanner(true)}
            >
              <Icon name="qrcode-scan" size={24} color={colors.primary.green} />
            </TouchableOpacity>
          </View>

          {/* Amount */}
          <Text style={styles.inputLabel}>Amount</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="0.0"
              placeholderTextColor={colors.text.muted}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={styles.maxButton} onPress={setMaxAmount}>
              <Text style={styles.maxButtonText}>MAX</Text>
            </TouchableOpacity>
          </View>

          {/* Fee */}
          <Text style={styles.inputLabel}>Network Fee (burned 🔥)</Text>
          <View style={styles.feeSelector}>
            {FEE_TIERS.map((tier, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.feeOption,
                  feeTier === idx && styles.feeOptionActive,
                ]}
                onPress={() => setFeeTier(idx)}
              >
                <Text
                  style={[
                    styles.feeOptionText,
                    feeTier === idx && styles.feeOptionTextActive,
                  ]}
                >
                  {tier.label}
                </Text>
                <Text style={styles.feeAmount}>
                  {estimateFee(tier.sizeKB).toFixed(6)} ZION
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Memo (optional) */}
          <Text style={styles.inputLabel}>Memo (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Add a note..."
            placeholderTextColor={colors.text.muted}
            value={memo}
            onChangeText={setMemo}
          />
        </GlassCard>

        {/* Summary */}
        {amount && parseFloat(amount) > 0 && (
          <GlassCard style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <Text style={styles.summaryValue}>{amount} ZION</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Fee (burned 🔥)</Text>
              <Text style={styles.summaryValue}>{fee.toFixed(6)} ZION</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                {(parseFloat(amount) + fee).toFixed(8)} ZION
              </Text>
            </View>
          </GlassCard>
        )}

        {/* Send Button */}
        <GradientButton
          title="Review & Send"
          onPress={handleSendPress}
          disabled={!recipient || !amount || loading}
          style={styles.sendButton}
        />
      </ScrollView>

      {/* QR Scanner Modal */}
      <Modal visible={showScanner} animationType="slide">
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      </Modal>

      {/* Confirmation Modal */}
      {renderConfirmModal()}

      {/* Result Modal */}
      {renderResultModal()}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
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
  balanceCard: {
    alignItems: 'center',
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  balanceLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  balanceAmount: {
    ...typography.h1,
    color: colors.primary.gold,
    marginVertical: spacing.xs,
  },
  walletAddress: {
    ...typography.caption,
    color: colors.text.muted,
  },
  formCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text.primary,
    ...typography.body,
  },
  scanButton: {
    marginLeft: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
  },
  maxButton: {
    marginLeft: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.primary.green + '20',
    borderRadius: borderRadius.md,
  },
  maxButtonText: {
    color: colors.primary.green,
    fontWeight: 'bold',
  },
  feeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  feeOption: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
    marginHorizontal: spacing.xs,
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  feeOptionActive: {
    borderColor: colors.primary.green,
    backgroundColor: colors.primary.green + '15',
  },
  feeOptionText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  feeOptionTextActive: {
    color: colors.primary.green,
  },
  feeAmount: {
    ...typography.small,
    color: colors.text.muted,
    marginTop: 2,
  },
  summaryCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  summaryValue: {
    ...typography.body,
    color: colors.text.primary,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.text.muted + '30',
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  totalLabel: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  totalValue: {
    ...typography.body,
    color: colors.primary.gold,
    fontWeight: 'bold',
  },
  sendButton: {
    marginTop: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  confirmModal: {
    width: '100%',
    padding: spacing.lg,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  confirmLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  confirmValue: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
    textAlign: 'right',
  },
  confirmAmount: {
    ...typography.body,
    color: colors.primary.gold,
    fontWeight: 'bold',
  },
  confirmTotal: {
    ...typography.body,
    color: colors.primary.green,
    fontWeight: 'bold',
  },
  burnNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    marginVertical: spacing.sm,
    gap: spacing.xs,
  },
  burnNoticeText: {
    ...typography.caption,
    color: colors.status.warning,
  },
  passwordInput: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  cancelButtonText: {
    color: colors.text.secondary,
    ...typography.body,
  },
  confirmButton: {
    flex: 2,
  },
  resultModal: {
    width: '100%',
    padding: spacing.xl,
    alignItems: 'center',
  },
  resultTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  resultText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  resultAddress: {
    ...typography.body,
    color: colors.primary.green,
    marginBottom: spacing.md,
  },
  txIdLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.md,
  },
  txId: {
    ...typography.small,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.status.error,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  closeButton: {
    marginTop: spacing.lg,
    width: '100%',
  },
});

export default SendScreen;
