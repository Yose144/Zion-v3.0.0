/**
 * ZION Push Notification Service v3.0.0
 *
 * Wraps react-native-push-notification for cross-platform local + scheduled alerts.
 * Designed for:
 * - Payout received
 * - New block mined
 * - Mining warnings (temperature, battery)
 * - Price / network alerts
 *
 * Note: Remote (FCM) requires Firebase setup in AndroidManifest.xml & Info.plist.
 */

import PushNotification from 'react-native-push-notification';
import {Platform} from 'react-native';

class PushNotificationService {
  constructor() {
    this.initialized = false;
  }

  /**
   * Configure channels and request permissions.
   * Call once at app startup (e.g. in App.js useEffect).
   */
  initialize() {
    if (this.initialized) return;

    PushNotification.configure({
      onRegister: (token) => {
        console.log('Push token:', token);
        // In production: send token to backend for FCM topic subscription
      },
      onNotification: (notification) => {
        console.log('Notification received:', notification);
        // Handle deep linking here if needed
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    // Android notification channel
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'zion-main',
          channelName: 'ZION Main Notifications',
          importance: 4,
          vibrate: true,
        },
        (created) => console.log(`Notification channel created: ${created}`),
      );
    }

    this.initialized = true;
  }

  /**
   * Schedule a local notification.
   */
  schedule({title, message, date, channelId = 'zion-main'}) {
    PushNotification.localNotificationSchedule({
      channelId,
      title,
      message,
      date: date || new Date(Date.now() + 1000),
      playSound: true,
      soundName: 'default',
    });
  }

  /**
   * Show an immediate local notification.
   */
  notify({title, message, channelId = 'zion-main'}) {
    PushNotification.localNotification({
      channelId,
      title,
      message,
      playSound: true,
      soundName: 'default',
    });
  }

  // ─── Preset notifications ───

  payoutReceived(amountZion) {
    this.notify({
      title: '💰 ZION Payout Received',
      message: `You just received ${amountZion} ZION!`,
    });
  }

  newBlockMined(height) {
    this.notify({
      title: '⛏️ New Block Mined',
      message: `Block ${height} — Network is healthy`,
    });
  }

  miningWarning(reason) {
    this.notify({
      title: '⚠️ Mining Warning',
      message: reason,
    });
  }

  levelUp(levelName) {
    this.notify({
      title: '🌟 Level Up!',
      message: `You reached ${levelName} consciousness level!`,
    });
  }

  cancelAll() {
    PushNotification.cancelAllLocalNotifications();
  }
}

export default new PushNotificationService();
