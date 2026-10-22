/**
 * ZION Onboarding Screen v3.0.0
 *
 * First-launch flow for new users:
 * 1. Welcome / brand intro
 * 2. Create or import wallet
 * 3. Seed phrase backup (mandatory before proceeding)
 * 4. Biometric setup suggestion
 *
 * Shown once; skipped if wallets already exist.
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Clipboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useWallet} from '../context/WalletContext';
import GlassCard from '../components/common/GlassCard';
import GradientButton from '../components/common/GradientButton';
import {colors, spacing, typography} from '../constants/theme';

const STEPS = ['welcome', 'createOrImport', 'backupPhrase', 'secure'];

const OnboardingScreen = ({navigation, route}) => {
  const [step, setStep] = useState(0);
  const [walletCreated, setWalletCreated] = useState(null);
  const [mnemonicVisible, setMnemonicVisible] = useState(false);
  const [confirmedBackup, setConfirmedBackup] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const {createWallet, importWallet} = useWallet();

  const currentStep = STEPS[step];

  // Consume deep-link import params (zion://import?mnemonic=...)
  useEffect(() => {
    const params = route?.params;
    if (params?.importMnemonic) {
      setPendingImport(params.importMnemonic);
      setStep(1); // jump to createOrImport step so user can confirm
    }
  }, [route?.params]);

  const handleCreateWallet = async () => {
    try {
      // Generate with a default password; user changes later if desired
      const wallet = await createWallet('ZION Wallet', 'TempPass123!', 'ZION');
      setWalletCreated(wallet);
      setStep(2); // go to backup
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleImportWallet = async (mnemonicOrKey) => {
    try {
      const wallet = await importWallet(mnemonicOrKey.trim(), 'Imported', 'TempPass123!', 'ZION');
      setWalletCreated(wallet);
      setStep(3); // skip backup (already has seed)
    } catch (error) {
      Alert.alert('Import Failed', error.message);
    }
  };

  const copyMnemonic = () => {
    if (walletCreated?.mnemonic) {
      Clipboard.setString(walletCreated.mnemonic);
      Alert.alert('Copied', 'Seed phrase copied to clipboard. Store it securely!');
    }
  };

  const finishOnboarding = () => {
    // In production: persist flag to AsyncStorage so this is skipped next time
    navigation.replace('Main');
  };

  // ─── WELCOME ───
  if (currentStep === 'welcome') {
    return (
      <ScrollView contentContainerStyle={styles.centered}>
        <Icon name="star-four-points" size={80} color={colors.primary.gold} />
        <Text style={styles.title}>Welcome to ZION</Text>
        <Text style={styles.subtitle}>
          The conscious blockchain wallet.{'\n'}
          Secure. Decentralized. Yours.
        </Text>
        <GradientButton title="Get Started" onPress={() => setStep(1)} />
      </ScrollView>
    );
  }

  // ─── CREATE OR IMPORT ───
  if (currentStep === 'createOrImport') {
    return (
      <ScrollView contentContainerStyle={styles.centered}>
        <Text style={styles.title}>Your Wallet</Text>
        <Text style={styles.subtitle}>
          Create a new wallet or restore an existing one with your seed phrase.
        </Text>

        {pendingImport ? (
          <GlassCard style={styles.optionCard}>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => handleImportWallet(pendingImport)}>
              <Icon name="link-variant" size={40} color={colors.primary.green} />
              <Text style={styles.optionTitle}>Import from Deep Link</Text>
              <Text style={styles.optionDesc}>
                A wallet was shared via a ZION link. Tap to import it now.
              </Text>
            </TouchableOpacity>
          </GlassCard>
        ) : null}

        <GlassCard style={styles.optionCard}>
          <TouchableOpacity style={styles.optionButton} onPress={handleCreateWallet}>
            <Icon name="wallet-plus" size={40} color={colors.primary.gold} />
            <Text style={styles.optionTitle}>Create New Wallet</Text>
            <Text style={styles.optionDesc}>Generate a fresh 24-word seed phrase</Text>
          </TouchableOpacity>
        </GlassCard>

        <GlassCard style={styles.optionCard}>
          <TouchableOpacity
            style={styles.optionButton}
            onPress={() => {
              Alert.prompt(
                'Import Wallet',
                'Enter your 12 or 24 word seed phrase or private key:',
                [
                  {text: 'Cancel', style: 'cancel'},
                  {text: 'Import', onPress: (text) => text && handleImportWallet(text)},
                ],
                'plain-text'
              );
            }}>
            <Icon name="import" size={40} color={colors.primary.green} />
            <Text style={styles.optionTitle}>Import Existing</Text>
            <Text style={styles.optionDesc}>Restore from seed phrase or private key</Text>
          </TouchableOpacity>
        </GlassCard>
      </ScrollView>
    );
  }

  // ─── BACKUP PHRASE ───
  if (currentStep === 'backupPhrase') {
    return (
      <ScrollView contentContainerStyle={styles.centered}>
        <Icon name="shield-check" size={60} color={colors.status.success} />
        <Text style={styles.title}>Backup Your Seed</Text>
        <Text style={styles.subtitle}>
          This is the ONLY way to recover your wallet.{'\n'}
          Write it down and store it offline. Never share it.
        </Text>

        <GlassCard style={styles.phraseCard}>
          <View style={styles.phraseHeader}>
            <Text style={styles.phraseLabel}>Your Seed Phrase</Text>
            <TouchableOpacity onPress={() => setMnemonicVisible(!mnemonicVisible)}>
              <Icon
                name={mnemonicVisible ? 'eye-off' : 'eye'}
                size={22}
                color={colors.primary.green}
              />
            </TouchableOpacity>
          </View>

          {mnemonicVisible ? (
            <View style={styles.wordsGrid}>
              {walletCreated?.mnemonic
                ?.split(' ')
                .map((word, i) => (
                  <View key={i} style={styles.wordChip}>
                    <Text style={styles.wordIndex}>{i + 1}</Text>
                    <Text style={styles.wordText}>{word}</Text>
                  </View>
                ))}
            </View>
          ) : (
            <View style={styles.hiddenPhrase}>
              <Text style={styles.hiddenText}>••• ••• ••• ••• ••• •••</Text>
              <Text style={styles.hiddenText}>••• ••• ••• ••• ••• •••</Text>
            </View>
          )}

          <TouchableOpacity style={styles.copyButton} onPress={copyMnemonic}>
            <Icon name="content-copy" size={18} color={colors.primary.gold} />
            <Text style={styles.copyText}>Copy to Clipboard</Text>
          </TouchableOpacity>
        </GlassCard>

        <View style={styles.checkboxRow}>
          <TouchableOpacity
            style={[styles.checkbox, confirmedBackup && styles.checkboxChecked]}
            onPress={() => setConfirmedBackup(!confirmedBackup)}>
            {confirmedBackup && <Icon name="check" size={14} color="#000" />}
          </TouchableOpacity>
          <Text style={styles.checkboxLabel}>
            I have written down my seed phrase and stored it securely offline
          </Text>
        </View>

        <GradientButton
          title="Continue"
          onPress={() => setStep(3)}
          disabled={!confirmedBackup}
        />
      </ScrollView>
    );
  }

  // ─── SECURE ───
  return (
    <ScrollView contentContainerStyle={styles.centered}>
      <Icon name="lock" size={60} color={colors.primary.gold} />
      <Text style={styles.title}>Stay Secure</Text>
      <Text style={styles.subtitle}>
        Enable biometric authentication for quick, secure access to your wallet.
      </Text>

      <GlassCard style={styles.tipCard}>
        <Icon name="shield-alert" size={28} color={colors.status.warning} />
        <Text style={styles.tipTitle}>Security Tips</Text>
        <Text style={styles.tipText}>
          • Never share your seed phrase{'\n'}
          • Use a strong password{'\n'}
          • Keep your app updated{'\n'}
          • Beware of phishing attempts
        </Text>
      </GlassCard>

      <GradientButton title="Enter ZION Wallet" onPress={finishOnboarding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centered: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: 'transparent',
  },
  title: {
    ...typography.h1,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  optionCard: {
    width: '100%',
    marginBottom: spacing.md,
  },
  optionButton: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  optionTitle: {
    ...typography.h3,
    marginTop: spacing.md,
  },
  optionDesc: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  phraseCard: {
    width: '100%',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  phraseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  phraseLabel: {
    ...typography.h3,
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  wordChip: {
    width: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  wordIndex: {
    color: colors.text.muted,
    fontSize: 12,
    marginRight: spacing.sm,
    minWidth: 20,
  },
  wordText: {
    ...typography.body,
    fontWeight: '600',
  },
  hiddenPhrase: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  hiddenText: {
    ...typography.h2,
    color: colors.text.muted,
    letterSpacing: 4,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(252, 209, 22,0.1)',
    borderRadius: 8,
  },
  copyText: {
    color: colors.primary.gold,
    marginLeft: spacing.sm,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.primary.gold,
    marginRight: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary.gold,
  },
  checkboxLabel: {
    ...typography.caption,
    flex: 1,
    lineHeight: 18,
  },
  tipCard: {
    width: '100%',
    padding: spacing.lg,
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  tipTitle: {
    ...typography.h3,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  tipText: {
    ...typography.caption,
    lineHeight: 20,
    textAlign: 'left',
    width: '100%',
  },
});

export default OnboardingScreen;
