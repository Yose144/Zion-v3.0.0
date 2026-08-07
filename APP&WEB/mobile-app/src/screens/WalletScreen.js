/**
 * ZION Wallet Screen v3.0.0
 *
 * Multi-chain wallet management:
 * - Create / import wallets (ZION, BTC, ETH, SOL, TRX, XLM)
 * - QR code receive + clipboard copy
 * - Export private key / mnemonic to clipboard
 * - Consciousness level & XP display
 * - Switch between wallets
 */
import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Clipboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import QRCode from 'react-native-qrcode-svg';
import {useWallet} from '../context/WalletContext';
import GlassCard from '../components/common/GlassCard';
import GradientButton from '../components/common/GradientButton';
import ConsciousnessRing from '../components/common/ConsciousnessRing';
import {colors, spacing, typography, borderRadius} from '../constants/theme';
import {parseZionUri, extractMnemonic, canImport} from '../utils/zionUri';
import QRScanner from '../components/QRScanner';
import {CHAINS, CHAIN_IDS} from '../constants/chains';

const WalletScreen = ({navigation}) => {
  const {
    wallets,
    activeWallet,
    createWallet,
    importWallet,
    switchWallet,
    exportWallet,
  } = useWallet();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [walletName, setWalletName] = useState('');
  const [importData, setImportData] = useState('');
  const [password, setPassword] = useState('');
  const [selectedChainId, setSelectedChainId] = useState(CHAIN_IDS.ZION);

  const renderChainSelector = () => (
    <View style={styles.chainPicker}>
      {CHAINS.filter(c => [
        CHAIN_IDS.ZION,
        CHAIN_IDS.BTC,
        CHAIN_IDS.ETH,
        CHAIN_IDS.SOL,
        CHAIN_IDS.TRX,
        CHAIN_IDS.XLM,
      ].includes(c.id)).map(chain => (
        <TouchableOpacity
          key={chain.id}
          style={[
            styles.chainChip,
            selectedChainId === chain.id && styles.chainChipActive,
          ]}
          onPress={() => setSelectedChainId(chain.id)}>
          <Text
            style={[
              styles.chainChipText,
              selectedChainId === chain.id && styles.chainChipTextActive,
            ]}>
            {chain.symbol}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const handleQRScan = async (scannedData) => {
    // QR was scanned, import the wallet
    try {
      await importWallet(scannedData, 'ZION Presale Wallet', password, CHAIN_IDS.ZION);
      Alert.alert('Success', 'Wallet imported from QR code!');
    } catch (error) {
      console.error('QR Import error:', error);
      Alert.alert('Error', 'Failed to import wallet from QR code.');
    }
  };

  const handleCreateWallet = async () => {
    try {
      await createWallet(walletName || `${selectedChainId} Wallet`, password, selectedChainId);
      setShowCreateModal(false);
      setWalletName('');
      setPassword('');
      Alert.alert('Success', 'Wallet created successfully!');
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to create wallet');
    }
  };

  const handleImportWallet = async () => {
    try {
      // Parse input - supports ZION URI, JSON, or plain mnemonic
      const parsed = parseZionUri(importData);
      let dataToImport = importData;
      
      if (parsed.type === 'import' || parsed.type === 'mnemonic') {
        // Extract mnemonic from parsed data
        dataToImport = parsed.mnemonic;
        console.log('Importing from ZION URI/mnemonic:', dataToImport.substring(0, 20) + '...');
      } else if (parsed.type === 'privateKey') {
        // Use private key directly
        dataToImport = parsed.privateKey;
        console.log('Importing from private key');
      } else if (!canImport(importData)) {
        Alert.alert(
          'Invalid Input', 
          'Please enter a valid 12-word mnemonic phrase, private key, or scan a ZION QR code.'
        );
        return;
      }
      
      await importWallet(dataToImport, walletName || 'Imported Wallet', password, selectedChainId);
      setShowImportModal(false);
      setImportData('');
      setWalletName('');
      setPassword('');
      Alert.alert('Success', 'Wallet imported successfully!');
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Error', error?.message || 'Failed to import wallet. Please check your input.');
    }
  };

  const handleExportWallet = async () => {
    try {
      if (activeWallet.walletType === 'external') {
        Alert.alert('Payout Address', `Chain: ${activeWallet.chainId}\n\nAddress: ${activeWallet.address}`);
        return;
      }

      const data = await exportWallet(activeWallet.id, password);
      const lines = [
        `Chain: ${activeWallet.chainId || CHAIN_IDS.ZION}`,
        `Address: ${data.address}`,
        data.path ? `Path: ${data.path}` : null,
        '',
        `Private Key: ${data.privateKey}`,
        data.mnemonic ? `\nMnemonic:\n${data.mnemonic}` : null,
        '\n⚠️ Keep this secure!'
      ].filter(Boolean);
      Alert.alert(
        'Wallet Export',
        lines.join('\n'),
        [
          {
            text: 'Copy',
            onPress: () => {
              Clipboard.setString(lines.join('\n'));
              Alert.alert('Copied', 'Wallet data copied to clipboard.\n\u26a0\ufe0f Keep it safe!');
            },
          },
          {text: 'Close'},
        ]
      );
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to export wallet');
    }
  };

  if (!activeWallet) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="wallet-outline" size={80} color={colors.text.muted} />
        <Text style={styles.emptyTitle}>No Wallet Found</Text>
        <Text style={styles.emptyText}>
          Create or import a wallet to get started
        </Text>
        <GradientButton
          title="Create Wallet"
          onPress={() => setShowCreateModal(true)}
          style={styles.createButton}
        />
        <GradientButton
          title="📱 Scan QR from Email"
          onPress={() => setShowQRScanner(true)}
          variant="cyan"
          style={styles.createButton}
        />
        <TouchableOpacity onPress={() => setShowImportModal(true)}>
          <Text style={styles.linkText}>Import Manually</Text>
        </TouchableOpacity>
        
        {/* QR Scanner Modal */}
        <QRScanner
          visible={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onScan={handleQRScan}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Wallet Header */}
      <GlassCard style={styles.headerCard}>
        <View style={styles.walletHeader}>
          <View style={styles.walletInfo}>
            <Text style={styles.walletName}>{activeWallet.name}</Text>
            <Text style={styles.address} numberOfLines={1}>
              {activeWallet.address}
            </Text>
            <Text style={styles.chainTag}>
              {activeWallet.chainId || CHAIN_IDS.ZION}
              {activeWallet.walletType === 'external' ? ' (payout)' : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowQRModal(true)}>
            <Icon name="qrcode" size={32} color={colors.primary.gold} />
          </TouchableOpacity>
        </View>

        {/* Balance */}
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>BALANCE</Text>
          <Text style={styles.balance}>
            {activeWallet.walletType === 'external'
              ? '—'
              : `${activeWallet.balance.toFixed(2)} ZION`}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Send')}>
            <Icon name="arrow-up" size={24} color={colors.primary.green} />
            <Text style={styles.actionText}>Send</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowQRModal(true)}>
            <Icon name="arrow-down" size={24} color={colors.primary.gold} />
            <Text style={styles.actionText}>Receive</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Transactions')}>
            <Icon name="format-list-bulleted" size={24} color={colors.primary.red} />
            <Text style={styles.actionText}>History</Text>
          </TouchableOpacity>
          {activeWallet.walletType !== 'external' && (
            <TouchableOpacity style={styles.actionButton} onPress={handleExportWallet}>
              <Icon name="export" size={24} color={colors.text.muted} />
              <Text style={styles.actionText}>Export</Text>
            </TouchableOpacity>
          )}
        </View>
      </GlassCard>

      {/* Consciousness Level */}
      <GlassCard style={styles.consciousnessCard}>
        <Text style={styles.sectionTitle}>Consciousness Level</Text>
        <View style={styles.consciousnessContent}>
          <ConsciousnessRing
            level={activeWallet.consciousness.level}
            currentXP={activeWallet.consciousness.xp}
            requiredXP={5000}
            size={100}
          />
          <View style={styles.consciousnessInfo}>
            <Text style={styles.consciousnessLevel}>
              {activeWallet.consciousness.level}
            </Text>
            <Text style={styles.consciousnessXP}>
              {activeWallet.consciousness.xp.toLocaleString()} XP
            </Text>
            <Text style={styles.consciousnessNext}>
              Next: 5,000 XP
            </Text>
          </View>
        </View>
      </GlassCard>

      {/* All Wallets */}
      {wallets.length > 1 && (
        <GlassCard style={styles.walletsCard}>
          <Text style={styles.sectionTitle}>All Wallets</Text>
          {wallets.map(wallet => (
            <TouchableOpacity
              key={wallet.id}
              style={[
                styles.walletItem,
                wallet.isActive && styles.activeWalletItem,
              ]}
              onPress={() => switchWallet(wallet.id)}>
              <View>
                <Text style={styles.walletItemName}>{wallet.name}</Text>
                <Text style={styles.walletItemChain}>
                  {wallet.chainId || CHAIN_IDS.ZION}
                  {wallet.walletType === 'external' ? ' (payout)' : ''}
                </Text>
                <Text style={styles.walletItemAddress} numberOfLines={1}>
                  {wallet.address}
                </Text>
              </View>
              {wallet.walletType !== 'external' && (
                <Text style={styles.walletItemBalance}>
                  {wallet.balance.toFixed(2)} ZION
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </GlassCard>
      )}

      {/* Add Wallet Buttons */}
      <View style={styles.addButtons}>
        <GradientButton
          title="+ Create Wallet"
          onPress={() => setShowCreateModal(true)}
          variant="gold"
          style={styles.addButton}
        />
        <GradientButton
          title="Import Wallet"
          onPress={() => setShowImportModal(true)}
          variant="cyan"
          style={styles.addButton}
        />
      </View>

      {/* Create Wallet Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modal}>
            <Text style={styles.modalTitle}>Create New Wallet</Text>
            <Text style={styles.modalSubtitle}>Select chain</Text>
            {renderChainSelector()}
            <TextInput
              style={styles.input}
              placeholder="Wallet Name (optional)"
              placeholderTextColor={colors.text.muted}
              value={walletName}
              onChangeText={setWalletName}
            />
            <TextInput
              style={styles.input}
              placeholder="Password (8+ chars, Aa1)"
              placeholderTextColor={colors.text.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <GradientButton
              title="Create"
              onPress={handleCreateWallet}
              style={styles.modalButton}
            />
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>

      {/* Import Wallet Modal */}
      <Modal visible={showImportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modal}>
            <Text style={styles.modalTitle}>Import Wallet</Text>
            <Text style={styles.modalSubtitle}>Select chain</Text>
            {renderChainSelector()}
            <TextInput
              style={styles.input}
              placeholder="Wallet Name (optional)"
              placeholderTextColor={colors.text.muted}
              value={walletName}
              onChangeText={setWalletName}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Private Key or Mnemonic Phrase"
              placeholderTextColor={colors.text.muted}
              value={importData}
              onChangeText={setImportData}
              multiline
              numberOfLines={4}
            />
            <TextInput
              style={styles.input}
              placeholder="Password (8+ chars, Aa1)"
              placeholderTextColor={colors.text.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <GradientButton
              title="📱 Scan QR Code"
              onPress={() => {
                setShowImportModal(false);
                setShowQRScanner(true);
              }}
              variant="cyan"
              style={styles.modalButton}
            />
            <GradientButton
              title="Import"
              onPress={handleImportWallet}
              style={styles.modalButton}
            />
            <TouchableOpacity onPress={() => setShowImportModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>

      {/* QR Scanner Modal */}
      <QRScanner
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScan}
      />

      {/* QR Code Modal */}
      <Modal visible={showQRModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.qrModal}>
            <Text style={styles.modalTitle}>
              Receive {activeWallet.chainId || CHAIN_IDS.ZION}
            </Text>
            <View style={styles.qrContainer}>
              <QRCode value={activeWallet.address} size={200} />
            </View>
            <Text style={styles.qrAddress} numberOfLines={2}>
              {activeWallet.address}
            </Text>
            <GradientButton
              title="Copy Address"
              onPress={() => {
                Clipboard.setString(activeWallet.address);
                Alert.alert('Copied!', 'Address copied to clipboard.');
              }}
              style={styles.modalButton}
            />
            <TouchableOpacity onPress={() => setShowQRModal(false)}>
              <Text style={styles.cancelText}>Close</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>
    </ScrollView>
  );
};

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
    marginBottom: spacing.xl,
  },
  createButton: {
    width: '100%',
    marginBottom: spacing.md,
  },
  linkText: {
    ...typography.body,
    color: colors.primary.green,
    textDecorationLine: 'underline',
  },
  headerCard: {
    marginBottom: spacing.md,
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  walletInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  walletName: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  address: {
    ...typography.caption,
    fontFamily: 'monospace',
  },
  chainTag: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  balanceContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  balanceLabel: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  balance: {
    ...typography.h1,
    fontSize: 36,
    color: colors.primary.gold,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
  },
  actionText: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  consciousnessCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  consciousnessContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  consciousnessInfo: {
    marginLeft: spacing.lg,
    flex: 1,
  },
  consciousnessLevel: {
    ...typography.h2,
    color: colors.primary.gold,
  },
  consciousnessXP: {
    ...typography.body,
    marginTop: spacing.xs,
  },
  consciousnessNext: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  walletsCard: {
    marginBottom: spacing.md,
  },
  walletItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  activeWalletItem: {
    backgroundColor: 'rgba(252, 209, 22,0.1)',
    borderWidth: 1,
    borderColor: colors.primary.gold,
  },
  walletItemName: {
    ...typography.body,
    fontWeight: '600',
  },
  walletItemAddress: {
    ...typography.caption,
    fontFamily: 'monospace',
    maxWidth: 200,
  },
  walletItemChain: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  walletItemBalance: {
    ...typography.body,
    color: colors.primary.gold,
  },
  addButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  addButton: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    ...typography.h2,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.sm,
    color: colors.text.muted,
  },
  chainPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  chainChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chainChipActive: {
    borderColor: colors.primary.gold,
    backgroundColor: 'rgba(252, 209, 22,0.12)',
  },
  chainChipText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
  },
  chainChipTextActive: {
    color: colors.primary.gold,
  },
  chainHint: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...typography.body,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalButton: {
    marginBottom: spacing.md,
  },
  cancelText: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
  },
  qrModal: {
    width: '90%',
    maxWidth: 350,
    alignItems: 'center',
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  qrAddress: {
    ...typography.caption,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});

export default WalletScreen;
