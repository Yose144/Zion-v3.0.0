import React, {useState} from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import {colors, spacing, typography, borderRadius} from '../../constants/theme';

/**
 * Transaction Confirmation Modal
 * Zobrazí detail transakce před podpisem - security best practice
 * 
 * Usage:
 *   <TransactionConfirmModal
 *     visible={showConfirm}
 *     transaction={{
 *       recipient: 'zion1abc...',
 *       amount: 100,
 *       fee: 0.1,
 *       token: 'ZION'
 *     }}
 *     onConfirm={handleConfirm}
 *     onCancel={handleCancel}
 *   />
 */

const TransactionConfirmModal = ({
  visible,
  transaction,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    if (!confirmed) {
      Alert.alert(
        'Confirmation Required',
        'Please check the box to confirm transaction details.',
        [{text: 'OK'}]
      );
      return;
    }
    onConfirm();
  };

  if (!transaction) return null;

  const totalAmount = (
    parseFloat(transaction.amount) + parseFloat(transaction.fee || 0)
  ).toFixed(8);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <LinearGradient
            colors={[colors.primary.gold, colors.primary.yellow]}
            style={styles.header}>
            <Icon name="shield-check" size={32} color="#fff" />
            <Text style={styles.headerTitle}>Confirm Transaction</Text>
          </LinearGradient>

          {/* Transaction Details */}
          <View style={styles.content}>
            {/* Recipient */}
            <View style={styles.row}>
              <Text style={styles.label}>Recipient</Text>
              <View style={styles.addressContainer}>
                <Text style={styles.address} numberOfLines={1} ellipsizeMode="middle">
                  {transaction.recipient}
                </Text>
                <Icon name="content-copy" size={16} color={colors.primary.gold} />
              </View>
            </View>

            {/* Amount */}
            <View style={styles.row}>
              <Text style={styles.label}>Amount</Text>
              <Text style={styles.amount}>
                {parseFloat(transaction.amount).toFixed(8)} {transaction.token || 'ZION'}
              </Text>
            </View>

            {/* Fee */}
            <View style={styles.row}>
              <Text style={styles.label}>Network Fee</Text>
              <Text style={styles.fee}>
                {parseFloat(transaction.fee || 0).toFixed(8)} {transaction.token || 'ZION'}
              </Text>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Total */}
            <View style={styles.row}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.total}>
                {totalAmount} {transaction.token || 'ZION'}
              </Text>
            </View>

            {/* Warning Box */}
            <View style={styles.warningBox}>
              <Icon name="alert" size={20} color="#FFA500" />
              <Text style={styles.warningText}>
                Once confirmed, this transaction cannot be reversed. Please verify all details carefully.
              </Text>
            </View>

            {/* Confirmation Checkbox */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setConfirmed(!confirmed)}>
              <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
                {confirmed && <Icon name="check" size={16} color="#fff" />}
              </View>
              <Text style={styles.checkboxLabel}>
                I have verified the recipient address and amount
              </Text>
            </TouchableOpacity>

            {/* Transaction Hash (if available) */}
            {transaction.hash && (
              <View style={styles.hashContainer}>
                <Text style={styles.hashLabel}>Transaction Hash:</Text>
                <Text style={styles.hash} numberOfLines={1}>
                  {transaction.hash}
                </Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={loading}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.confirmButton, !confirmed && styles.buttonDisabled]}
              onPress={handleConfirm}
              disabled={loading || !confirmed}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="check-circle" size={20} color="#fff" />
                  <Text style={styles.confirmButtonText}>Confirm & Sign</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContainer: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 450,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.primary.gold + '30',
  },
  header: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: '#fff',
  },
  content: {
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    flex: 1,
  },
  addressContainer: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background.dark + '60',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  address: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    flex: 1,
    fontFamily: 'monospace',
  },
  amount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary.gold,
  },
  fee: {
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  totalLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  total: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary.gold,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: '#FFA500',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: '#FFA500',
    lineHeight: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary.green,
    borderColor: colors.primary.green,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  hashContainer: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.background.dark + '40',
    borderRadius: borderRadius.sm,
  },
  hashLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginBottom: spacing.xs,
  },
  hash: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontFamily: 'monospace',
  },
  actions: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  cancelButton: {
    backgroundColor: colors.background.dark,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  confirmButton: {
    backgroundColor: colors.primary.green,
  },
  confirmButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default TransactionConfirmModal;
