// ─────────────────────────────────────────────────────────────────────────────
// iap.js — Apple App Store + Google Play receipt verification
// ─────────────────────────────────────────────────────────────────────────────

// ── Apple App Store receipt verification ──────────────────────────────────────
//
// Uses Apple's verifyReceipt endpoint (legacy) or App Store Server API v2.
// For simplicity we use the legacy verifyReceipt which works with the
// transactionReceipt from react-native-iap.
//
// Required env: APPLE_SHARED_SECRET (from App Store Connect → In-App Purchases → Shared Secret)

const APPLE_VERIFY_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

export async function verifyAppleReceipt(receiptData, sharedSecret) {
  if (!receiptData) {
    return { valid: false, error: 'No receipt data provided' };
  }

  if (!sharedSecret) {
    // Development mode: accept receipt without verification
    console.warn('[IAP] APPLE_SHARED_SECRET not set — skipping Apple verification');
    return { valid: true, dev: true, message: 'Dev mode: no verification' };
  }

  try {
    // Try production first, fall back to sandbox if status is 21007
    const body = JSON.stringify({
      'receipt-data': receiptData,
      password: sharedSecret,
      'exclude-old-transactions': true,
    });

    let response = await fetch(APPLE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    let result = await response.json();

    // Status 21007 = sandbox receipt sent to production → retry with sandbox
    if (result.status === 21007) {
      response = await fetch(APPLE_SANDBOX_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      result = await response.json();
    }

    if (result.status !== 0) {
      return { valid: false, error: `Apple verification failed (status ${result.status})` };
    }

    // Extract latest transaction info
    const receipt = result.receipt || {};
    const inApp = receipt.in_app || [];
    const latestTx = inApp[inApp.length - 1] || {};

    return {
      valid: true,
      productId: latestTx.product_id,
      transactionId: latestTx.transaction_id,
      originalTransactionId: latestTx.original_transaction_id,
      purchaseDate: latestTx.purchase_date_ms
        ? new Date(parseInt(latestTx.purchase_date_ms)).toISOString()
        : null,
      expiresDate: latestTx.expires_date_ms
        ? new Date(parseInt(latestTx.expires_date_ms)).toISOString()
        : null,
      isTrial: latestTx.is_trial_period === 'true',
    };
  } catch (err) {
    console.error('[IAP] Apple verification error:', err?.message || err);
    return { valid: false, error: err?.message || 'Apple verification failed' };
  }
}

// ── Google Play Developer API verification ────────────────────────────────────
//
// Uses Google Play Developer API to verify purchases.
// Required env:
//   GOOGLE_SERVICE_ACCOUNT_KEY_PATH — path to service account JSON
//   GOOGLE_PACKAGE_NAME — app package name (com.zionterranova.mobile)
//
// For subscriptions, use purchases.subscriptions.get
// For one-time products, use purchases.products.get

const GOOGLE_PACKAGE_NAME = process.env.GOOGLE_PACKAGE_NAME || 'com.zionterranova.mobile';

export async function verifyGooglePurchase(productId, purchaseToken, serviceAccountKeyPath) {
  if (!purchaseToken) {
    return { valid: false, error: 'No purchase token provided' };
  }

  if (!serviceAccountKeyPath) {
    // Development mode: accept without verification
    console.warn('[IAP] GOOGLE_SERVICE_ACCOUNT_KEY_PATH not set — skipping Google verification');
    return { valid: true, dev: true, message: 'Dev mode: no verification' };
  }

  try {
    // Dynamic import of googleapis (optional dependency)
    const { google } = await import('googleapis');

    const auth = new google.auth.GoogleAuth({
      keyFile: serviceAccountKeyPath,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const androidpublisher = google.androidpublisher({ version: 'v3', auth });

    // Determine if it's a subscription or one-time product
    const subscriptionIds = ['zion.pro.yearly', 'zion.pro.monthly'];
    let result;

    if (subscriptionIds.includes(productId)) {
      // Verify subscription
      const res = await androidpublisher.purchases.subscriptions.get({
        packageName: GOOGLE_PACKAGE_NAME,
        subscriptionId: productId,
        token: purchaseToken,
      });
      result = res.data;
    } else {
      // Verify one-time product
      const res = await androidpublisher.purchases.products.get({
        packageName: GOOGLE_PACKAGE_NAME,
        productId,
        token: purchaseToken,
      });
      result = res.data;
    }

    // Check purchase state (0 = purchased, 1 = canceled)
    if (result.purchaseState === 1) {
      return { valid: false, error: 'Purchase was canceled' };
    }

    // Check acknowledgement (0 = not acknowledged, 1 = acknowledged)
    if (result.acknowledgementState === 0) {
      console.warn('[IAP] Google purchase not yet acknowledged');
    }

    return {
      valid: true,
      productId,
      transactionId: result.orderId || result.purchaseToken,
      purchaseDate: result.startTimeMillis
        ? new Date(parseInt(result.startTimeMillis)).toISOString()
        : null,
      expiresDate: result.expiryTimeMillis
        ? new Date(parseInt(result.expiryTimeMillis)).toISOString()
        : null,
      autoRenewing: result.autoRenewing || false,
    };
  } catch (err) {
    console.error('[IAP] Google verification error:', err?.message || err);
    return { valid: false, error: err?.message || 'Google verification failed' };
  }
}

// ── Unified verification dispatcher ───────────────────────────────────────────

export async function verifyReceipt({ platform, productId, receiptData, purchaseToken, transactionId }) {
  const appleSecret = process.env.APPLE_SHARED_SECRET;
  const googleKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;

  if (platform === 'ios') {
    return await verifyAppleReceipt(receiptData, appleSecret);
  } else if (platform === 'android') {
    return await verifyGooglePurchase(productId, purchaseToken, googleKeyPath);
  } else {
    return { valid: false, error: `Unknown platform: ${platform}` };
  }
}
