import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GlassCard from '../components/common/GlassCard';
import {colors, spacing, typography, borderRadius} from '../constants/theme';
import {CONFIG} from '../constants/config';

const SettingsScreen = () => {
  const [biometricEnabled, setBiometricEnabled] = React.useState(true);
  const [notifications, setNotifications] = React.useState({
    newBlock: true,
    payout: true,
    levelUp: true,
    miningWarning: true,
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* App Info */}
      <GlassCard style={styles.card}>
        <View style={styles.appHeader}>
          <View style={styles.appLogo}>
            <Icon name="star-four-points" size={48} color={colors.primary.gold} />
          </View>
          <View>
            <Text style={styles.appName}>ZION Mobile</Text>
            <Text style={styles.appVersion}>v{CONFIG.VERSION} (Build {CONFIG.BUILD_NUMBER})</Text>
          </View>
        </View>
      </GlassCard>

      {/* Security Settings */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Security</Text>
        
        <SettingRow
          icon="fingerprint"
          label="Biometric Lock"
          value={biometricEnabled}
          onToggle={setBiometricEnabled}
        />
        
        <SettingItem
          icon="lock-clock"
          label="Auto-lock"
          value={`${CONFIG.AUTO_LOCK_MINUTES} minutes`}
        />
        
        <SettingItem
          icon="key"
          label="Change Password"
          onPress={() => {}}
          showArrow
        />
        
        <SettingItem
          icon="backup-restore"
          label="Backup Wallets"
          onPress={() => {}}
          showArrow
        />
      </GlassCard>

      {/* Notifications */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        
        <SettingRow
          icon="cube"
          label="New Blocks"
          value={notifications.newBlock}
          onToggle={(val) => setNotifications({...notifications, newBlock: val})}
        />
        
        <SettingRow
          icon="currency-usd"
          label="Payouts"
          value={notifications.payout}
          onToggle={(val) => setNotifications({...notifications, payout: val})}
        />
        
        <SettingRow
          icon="star"
          label="Level Up"
          value={notifications.levelUp}
          onToggle={(val) => setNotifications({...notifications, levelUp: val})}
        />
        
        <SettingRow
          icon="alert"
          label="Mining Warnings"
          value={notifications.miningWarning}
          onToggle={(val) => setNotifications({...notifications, miningWarning: val})}
        />
      </GlassCard>

      {/* Network Settings */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Network</Text>
        
        <SettingItem
          icon="server"
          label="Pool URL"
          value={CONFIG.POOL_URL}
        />
        
        <SettingItem
          icon="api"
          label="API URL"
          value={CONFIG.API_URL}
        />
        
        <SettingItem
          icon="web"
          label="Explorer URL"
          value={CONFIG.EXPLORER_URL}
        />
      </GlassCard>

      {/* About */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>About</Text>
        
        <SettingItem
          icon="web"
          label="Website"
          value="zionterranova.com"
          onPress={() => {}}
          showArrow
        />
        
        <SettingItem
          icon="file-document"
          label="Documentation"
          onPress={() => {}}
          showArrow
        />
        
        <SettingItem
          icon="github"
          label="GitHub"
          onPress={() => {}}
          showArrow
        />
        
        <SettingItem
          icon="discord"
          label="Discord"
          onPress={() => {}}
          showArrow
        />
        
        <SettingItem
          icon="twitter"
          label="Twitter"
          onPress={() => {}}
          showArrow
        />
      </GlassCard>

      {/* Legal */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Legal</Text>
        
        <SettingItem
          icon="scale-balance"
          label="Terms of Service"
          onPress={() => {}}
          showArrow
        />
        
        <SettingItem
          icon="shield-check"
          label="Privacy Policy"
          onPress={() => {}}
          showArrow
        />
        
        <SettingItem
          icon="license"
          label="Open Source Licenses"
          onPress={() => {}}
          showArrow
        />
      </GlassCard>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          🌟 Where Technology Meets Spirit 🌟
        </Text>
        <Text style={styles.footerSubtext}>
          Made with ❤️ for the Conscious Community
        </Text>
      </View>
    </ScrollView>
  );
};

const SettingRow = ({icon, label, value, onToggle}) => (
  <View style={styles.settingRow}>
    <View style={styles.settingLeft}>
      <Icon name={icon} size={24} color={colors.primary.cyan} />
      <Text style={styles.settingLabel}>{label}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{false: colors.background.elevated, true: colors.primary.gold}}
      thumbColor="#fff"
    />
  </View>
);

const SettingItem = ({icon, label, value, onPress, showArrow}) => (
  <TouchableOpacity
    style={styles.settingRow}
    onPress={onPress}
    disabled={!onPress}>
    <View style={styles.settingLeft}>
      <Icon name={icon} size={24} color={colors.primary.cyan} />
      <View style={styles.settingTextContainer}>
        <Text style={styles.settingLabel}>{label}</Text>
        {value && <Text style={styles.settingValue}>{value}</Text>}
      </View>
    </View>
    {showArrow && (
      <Icon name="chevron-right" size={24} color={colors.text.muted} />
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  appLogo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(249,217,118,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: {
    ...typography.h2,
  },
  appVersion: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    ...typography.body,
  },
  settingValue: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  footerText: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  footerSubtext: {
    ...typography.caption,
    textAlign: 'center',
  },
});

export default SettingsScreen;
