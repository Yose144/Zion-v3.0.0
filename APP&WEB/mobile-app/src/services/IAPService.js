// ─────────────────────────────────────────────────────────────────────────────
// IAPService — In-App Purchase service (iOS StoreKit 2 + Android Google Play)
// Uses react-native-iap for unified cross-platform API
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';
import * as RNIap from 'react-native-iap';
import { CONFIG } from '../constants/config';
import LicenseService from './LicenseService';

const IAP_CONFIG = CONFIG.IAP;
const SUBSCRIPTION_SKUS = IAP_CONFIG.SUBSCRIPTION_IDS;
const PRODUCT_SKUS = IAP_CONFIG.ONE_TIME_IDS;
const ALL_SKUS = IAP_CONFIG.ALL_PRODUCT_IDS;

let _initialized = false;
let _purchaseListener = null;
let _errorListener = null;

class IAPService {
  constructor() {
    this.products = [];
    this.subscriptions = [];
    this.onPurchaseSuccess = null;
    this.onPurchaseError = null;
  }

  // ── Initialize connection to store ──────────────────────────────────────────
  async init() {
    if (_initialized) return true;
    try {
      await RNIap.initConnection();
      _initialized = true;
      this._setupListeners();
      return true;
    } catch (err) {
      console.error('[IAP] initConnection failed:', err?.message || err);
      return false;
    }
  }

  // ── Setup purchase event listeners ──────────────────────────────────────────
  _setupListeners() {
    // Purchase success listener
    _purchaseListener = RNIap.purchaseUpdatedListener(async (purchase) => {
      console.log('[IAP] Purchase updated:', purchase?.productId);
      try {
        await this._handlePurchase(purchase);
      } catch (err) {
        console.error('[IAP] Purchase handling failed:', err?.message || err);
        if (this.onPurchaseError) this.onPurchaseError(err);
      }
    });

    // Purchase error listener
    _errorListener = RNIap.purchaseErrorListener((error) => {
      console.warn('[IAP] Purchase error:', error?.message || error);
      if (this.onPurchaseError) this.onPurchaseError(error);
    });
  }

  // ── Fetch available products from store ─────────────────────────────────────
  async fetchProducts() {
    if (!_initialized) await this.init();
    try {
      // Fetch one-time products
      const products = await RNIap.getProducts({ skus: PRODUCT_SKUS });
      this.products = products || [];
      console.log(`[IAP] Fetched ${this.products.length} products`);

      // Fetch subscriptions
      const subs = await RNIap.getSubscriptions({ skus: SUBSCRIPTION_SKUS });
      this.subscriptions = subs || [];
      console.log(`[IAP] Fetched ${this.subscriptions.length} subscriptions`);

      return [...this.products, ...this.subscriptions];
    } catch (err) {
      console.error('[IAP] fetchProducts failed:', err?.message || err);
      return [];
    }
  }

  // ── Initiate a purchase ─────────────────────────────────────────────────────
  async purchase(productId) {
    if (!_initialized) await this.init();
    try {
      // Check if it's a subscription or one-time product
      if (SUBSCRIPTION_SKUS.includes(productId)) {
        await RNIap.requestSubscription({ sku: productId });
      } else {
        await RNIap.requestPurchase({ sku: productId });
      }
      // Result comes via purchaseUpdatedListener
      return true;
    } catch (err) {
      console.error('[IAP] purchase failed:', err?.message || err);
      throw err;
    }
  }

  // ── Restore previous purchases (required by App Store) ──────────────────────
  async restorePurchases() {
    if (!_initialized) await this.init();
    try {
      const purchases = await RNIap.getAvailablePurchases();
      console.log(`[IAP] Restored ${purchases?.length || 0} purchases`);

      // Validate each restored purchase
      for (const purchase of purchases || []) {
        await this._handlePurchase(purchase, true);
      }

      // Reload entitlements from server
      const entitlements = await LicenseService.fetchEntitlements();
      return entitlements;
    } catch (err) {
      console.error('[IAP] restorePurchases failed:', err?.message || err);
      throw err;
    }
  }

  // ── Handle a successful purchase — validate with server ─────────────────────
  async _handlePurchase(purchase, isRestore = false) {
    const productId = purchase.productId;
    console.log(`[IAP] Handling purchase: ${productId} (restore=${isRestore})`);

    // Determine platform-specific receipt data
    const receiptData = Platform.OS === 'ios'
      ? purchase.transactionReceipt
      : purchase.purchaseToken || purchase.dataAndroid;

    if (!receiptData) {
      console.warn('[IAP] No receipt data in purchase');
      return;
    }

    // Validate receipt with our server
    const result = await LicenseService.validateReceipt({
      platform: Platform.OS,
      productId,
      receiptData,
      transactionId: purchase.transactionId,
      purchaseToken: purchase.purchaseToken,
    });

    if (result?.success) {
      console.log(`[IAP] Receipt validated — entitlement: ${result.entitlement}`);

      // Acknowledge/finish the purchase so it doesn't show as unresolved
      try {
        if (Platform.OS === 'android') {
          await RNIap.acknowledgePurchaseAndroid({
            token: purchase.purchaseToken,
          });
        }
        // For both platforms, finish the transaction
        await RNIap.finishTransaction({ purchase, isConsumable: false });
      } catch (finishErr) {
        console.warn('[IAP] finishTransaction failed:', finishErr?.message);
      }

      // Notify success callback
      if (this.onPurchaseSuccess) this.onPurchaseSuccess(result);
    } else {
      console.warn('[IAP] Receipt validation failed:', result?.error);
      if (this.onPurchaseError) this.onPurchaseError(new Error(result?.error || 'Validation failed'));
    }
  }

  // ── Get product details for display ─────────────────────────────────────────
  getProduct(productId) {
    return this.products.find(p => p.productId === productId)
      || this.subscriptions.find(s => s.productId === productId)
      || null;
  }

  // ── Check if a product is a subscription ────────────────────────────────────
  isSubscription(productId) {
    return SUBSCRIPTION_SKUS.includes(productId);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  async endConnection() {
    try {
      if (_purchaseListener) { _purchaseListener.remove(); _purchaseListener = null; }
      if (_errorListener) { _errorListener.remove(); _errorListener = null; }
      await RNIap.endConnection();
      _initialized = false;
    } catch (err) {
      console.warn('[IAP] endConnection failed:', err?.message);
    }
  }
}

// Export singleton
export default new IAPService();
