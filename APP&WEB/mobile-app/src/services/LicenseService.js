// ─────────────────────────────────────────────────────────────────────────────
// LicenseService — Entitlement management + receipt validation with server
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../constants/config';
import DeviceInfo from 'react-native-device-info';

const VALIDATION_URL = CONFIG.IAP.VALIDATION_URL;
const ENTITLEMENTS_KEY = '@zion_entitlements';
const DEVICE_ID_KEY = '@zion_device_id';

class LicenseService {
  constructor() {
    this.deviceId = null;
    this.entitlements = [];
  }

  // ── Get or create device ID ─────────────────────────────────────────────────
  async getDeviceId() {
    if (this.deviceId) return this.deviceId;
    try {
      let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = DeviceInfo.getUniqueId() || `${Platform.OS}-${Date.now()}`;
        await AsyncStorage.setItem(DEVICE_ID_KEY, id);
      }
      this.deviceId = id;
      return id;
    } catch {
      return `${Platform.OS}-${Date.now()}`;
    }
  }

  // ── Validate receipt with update server ─────────────────────────────────────
  async validateReceipt({ platform, productId, receiptData, transactionId, purchaseToken }) {
    try {
      const deviceId = await this.getDeviceId();

      const response = await fetch(`${VALIDATION_URL}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          productId,
          receiptData,
          transactionId,
          purchaseToken,
          deviceId,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        return { success: false, error: result?.error || `HTTP ${response.status}` };
      }

      // Cache entitlements locally
      if (result.entitlement) {
        await this._cacheEntitlement(result.entitlement, result.expiresAt);
      }

      return result;
    } catch (err) {
      console.error('[License] validateReceipt failed:', err?.message || err);
      return { success: false, error: err?.message || 'Network error' };
    }
  }

  // ── Fetch entitlements from server ──────────────────────────────────────────
  async fetchEntitlements() {
    try {
      const deviceId = await this.getDeviceId();

      const response = await fetch(`${VALIDATION_URL}/entitlements?deviceId=${encodeURIComponent(deviceId)}`);
      const result = await response.json();

      if (response.ok && result.entitlements) {
        this.entitlements = result.entitlements;
        await this._cacheEntitlements(result.entitlements);
      }

      return this.entitlements;
    } catch (err) {
      console.error('[License] fetchEntitlements failed:', err?.message || err);
      // Fall back to cached entitlements
      return await this.getCachedEntitlements();
    }
  }

  // ── Restore purchases ───────────────────────────────────────────────────────
  async restorePurchases() {
    return await this.fetchEntitlements();
  }

  // ── Check if user has a specific entitlement ────────────────────────────────
  async hasEntitlement(entitlementName) {
    // Check cached first for instant UI
    const cached = await this.getCachedEntitlements();
    const found = cached.find(e =>
      e.entitlement === entitlementName &&
      e.status === 'active' &&
      (!e.expiresAt || new Date(e.expiresAt) > new Date())
    );
    return !!found;
  }

  // ── Convenience: is Pro? ────────────────────────────────────────────────────
  async isPro() {
    return await this.hasEntitlement(CONFIG.IAP.ENTITLEMENTS.PRO);
  }

  // ── Convenience: has Miner Boost? ───────────────────────────────────────────
  async hasMinerBoost() {
    return await this.hasEntitlement(CONFIG.IAP.ENTITLEMENTS.MINER_BOOST);
  }

  // ── Cache entitlement locally (offline access) ──────────────────────────────
  async _cacheEntitlement(entitlement, expiresAt) {
    const cached = await this.getCachedEntitlements();
    // Remove existing entry for same entitlement
    const filtered = cached.filter(e => e.entitlement !== entitlement);
    filtered.push({
      entitlement,
      status: 'active',
      expiresAt: expiresAt || null,
      cachedAt: new Date().toISOString(),
    });
    await AsyncStorage.setItem(ENTITLEMENTS_KEY, JSON.stringify(filtered));
    this.entitlements = filtered;
  }

  async _cacheEntitlements(entitlements) {
    await AsyncStorage.setItem(ENTITLEMENTS_KEY, JSON.stringify(entitlements));
    this.entitlements = entitlements;
  }

  async getCachedEntitlements() {
    try {
      const raw = await AsyncStorage.getItem(ENTITLEMENTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  // ── Clear all cached entitlements (for testing / sign out) ──────────────────
  async clearCache() {
    await AsyncStorage.removeItem(ENTITLEMENTS_KEY);
    this.entitlements = [];
  }
}

// Export singleton
export default new LicenseService();
