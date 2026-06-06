/**
 * ZION QR Scanner Component
 * =========================
 * Komponenta pro skenování QR kódů a import wallet.
 * 
 * Podporuje:
 * - zion://import?mnemonic=... URI
 * - Plain text mnemonic
 * - Legacy JSON format
 * 
 * @module components/QRScanner
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
  Modal,
} from 'react-native';
import {RNCamera} from 'react-native-camera';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {parseZionUri, canImport, extractMnemonic} from '../utils/zionUri';
import {colors, spacing, typography} from '../constants/theme';

/**
 * QRScanner Props
 * @typedef {Object} QRScannerProps
 * @property {boolean} visible - Whether modal is visible
 * @property {Function} onClose - Callback when modal closes
 * @property {Function} onScan - Callback with scanned mnemonic/data
 */

const QRScanner = ({visible, onClose, onScan}) => {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    // Check camera permission on mount
    checkPermission();
  }, []);

  const checkPermission = async () => {
    if (Platform.OS === 'ios') {
      // iOS permission check
      setHasPermission(true); // RNCamera handles this
    } else {
      // Android - check via react-native-camera
      setHasPermission(true);
    }
  };

  const handleBarCodeScanned = ({data}) => {
    if (scanned) return;
    
    setScanned(true);
    
    console.log('Scanned QR data:', data.substring(0, 50) + '...');
    
    // Parse the QR data
    const parsed = parseZionUri(data);
    console.log('Parsed result:', parsed);
    
    if (parsed.type === 'import' || parsed.type === 'mnemonic') {
      // Valid wallet import data
      Alert.alert(
        '✅ Wallet nalezena!',
        `Adresa: ${parsed.address || 'Bude vygenerována z mnemonic'}\n\nImportovat tuto peněženku?`,
        [
          {
            text: 'Zrušit',
            style: 'cancel',
            onPress: () => setScanned(false),
          },
          {
            text: 'Importovat',
            onPress: () => {
              onScan(parsed.mnemonic);
              onClose();
            },
          },
        ]
      );
    } else if (parsed.type === 'privateKey') {
      // Private key scanned
      Alert.alert(
        '🔑 Private Key',
        'Naskenován private key. Importovat?',
        [
          {
            text: 'Zrušit',
            style: 'cancel',
            onPress: () => setScanned(false),
          },
          {
            text: 'Importovat',
            onPress: () => {
              onScan(parsed.privateKey);
              onClose();
            },
          },
        ]
      );
    } else if (parsed.type === 'wallet') {
      // Just address info, no import possible
      Alert.alert(
        '📋 Wallet adresa',
        `Adresa: ${parsed.address}\nTokeny: ${parsed.tokens}`,
        [
          {
            text: 'OK',
            onPress: () => setScanned(false),
          },
        ]
      );
    } else {
      // Unknown format
      Alert.alert(
        '❌ Neznámý formát',
        'QR kód neobsahuje platná data pro import ZION wallet.',
        [
          {
            text: 'Zkusit znovu',
            onPress: () => setScanned(false),
          },
        ]
      );
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {hasPermission === null ? (
          <View style={styles.messageContainer}>
            <Icon name="camera-off" size={60} color={colors.text.muted} />
            <Text style={styles.messageText}>Načítám kameru...</Text>
          </View>
        ) : hasPermission === false ? (
          <View style={styles.messageContainer}>
            <Icon name="camera-off" size={60} color={colors.error} />
            <Text style={styles.messageText}>
              Přístup ke kameře byl zamítnut
            </Text>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => Linking.openSettings()}>
              <Text style={styles.settingsButtonText}>Otevřít nastavení</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <RNCamera
            style={styles.camera}
            type={RNCamera.Constants.Type.back}
            onBarCodeRead={handleBarCodeScanned}
            captureAudio={false}
            barCodeTypes={[RNCamera.Constants.BarCodeType.qr]}>
            {/* Overlay */}
            <View style={styles.overlay}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Icon name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Skenovat QR Kód</Text>
                <View style={{width: 28}} />
              </View>

              {/* Scanner frame */}
              <View style={styles.scannerFrame}>
                <View style={styles.cornerTopLeft} />
                <View style={styles.cornerTopRight} />
                <View style={styles.cornerBottomLeft} />
                <View style={styles.cornerBottomRight} />
              </View>

              {/* Instructions */}
              <View style={styles.instructions}>
                <Text style={styles.instructionText}>
                  Namiřte kameru na QR kód z emailu
                </Text>
                <Text style={styles.instructionSubtext}>
                  QR obsahuje vaši 12-slovní recovery frázi
                </Text>
              </View>
            </View>
          </RNCamera>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 50 : spacing.lg,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    ...typography.h3,
    color: '#fff',
  },
  scannerFrame: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 50,
    position: 'relative',
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 50,
    height: 50,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: colors.primary.gold,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 50,
    height: 50,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: colors.primary.gold,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 50,
    height: 50,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: colors.primary.gold,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 50,
    height: 50,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: colors.primary.gold,
  },
  instructions: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  instructionText: {
    ...typography.body,
    color: '#fff',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  instructionSubtext: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: 'center',
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  messageText: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  settingsButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary.gold,
    borderRadius: 8,
  },
  settingsButtonText: {
    ...typography.button,
    color: '#000',
  },
});

export default QRScanner;
