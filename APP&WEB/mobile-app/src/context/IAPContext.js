// ─────────────────────────────────────────────────────────────────────────────
// IAPContext — React context for IAP state management
// Follows WalletContext pattern
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import IAPService from '../services/IAPService';
import LicenseService from '../services/LicenseService';
import { CONFIG } from '../constants/config';

const IAPContext = createContext();

export const useIAP = () => {
  const context = useContext(IAPContext);
  if (!context) {
    throw new Error('useIAP must be used within IAPProvider');
  }
  return context;
};

export const IAPProvider = ({ children }) => {
  const [isPro, setIsPro] = useState(false);
  const [hasMinerBoost, setHasMinerBoost] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState(null);
  const [lastPurchase, setLastPurchase] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // ── Initialize IAP on mount ──────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);
      try {
        // Load cached entitlements for instant UI
        const cached = await LicenseService.getCachedEntitlements();
        if (mounted) {
          setIsPro(_checkEntitlement(cached, CONFIG.IAP.ENTITLEMENTS.PRO));
          setHasMinerBoost(_checkEntitlement(cached, CONFIG.IAP.ENTITLEMENTS.MINER_BOOST));
        }

        // Initialize IAP connection
        await IAPService.init();

        // Fetch products from store
        const storeProducts = await IAPService.fetchProducts();
        if (mounted) setProducts(storeProducts || []);

        // Fetch fresh entitlements from server
        const entitlements = await LicenseService.fetchEntitlements();
        if (mounted) {
          setIsPro(_checkEntitlement(entitlements, CONFIG.IAP.ENTITLEMENTS.PRO));
          setHasMinerBoost(_checkEntitlement(entitlements, CONFIG.IAP.ENTITLEMENTS.MINER_BOOST));
        }

        if (mounted) setInitialized(true);
      } catch (err) {
        console.error('[IAPContext] Init failed:', err?.message || err);
        if (mounted) setError(err?.message || 'IAP initialization failed');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    // Setup purchase callbacks
    IAPService.onPurchaseSuccess = (result) => {
      if (!mounted) return;
      setPurchasing(false);
      setLastPurchase(result);
      if (result.entitlement === CONFIG.IAP.ENTITLEMENTS.PRO) setIsPro(true);
      if (result.entitlement === CONFIG.IAP.ENTITLEMENTS.MINER_BOOST) setHasMinerBoost(true);
      setError(null);
    };

    IAPService.onPurchaseError = (err) => {
      if (!mounted) return;
      setPurchasing(false);
      // User cancellation is not an error
      const msg = err?.message || String(err);
      if (!msg.includes('cancelled') && !msg.includes('E_USER_CANCELLED')) {
        setError(msg);
      }
    };

    return () => {
      mounted = false;
      IAPService.onPurchaseSuccess = null;
      IAPService.onPurchaseError = null;
    };
  }, []);

  // ── Purchase a product ──────────────────────────────────────────────────────
  const purchase = useCallback(async (productId) => {
    setPurchasing(true);
    setError(null);
    try {
      await IAPService.purchase(productId);
      // Result comes via onPurchaseSuccess callback
    } catch (err) {
      setPurchasing(false);
      const msg = err?.message || String(err);
      if (!msg.includes('cancelled') && !msg.includes('E_USER_CANCELLED')) {
        setError(msg);
      }
    }
  }, []);

  // ── Restore purchases ───────────────────────────────────────────────────────
  const restorePurchases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entitlements = await IAPService.restorePurchases();
      setIsPro(_checkEntitlement(entitlements, CONFIG.IAP.ENTITLEMENTS.PRO));
      setHasMinerBoost(_checkEntitlement(entitlements, CONFIG.IAP.ENTITLEMENTS.MINER_BOOST));
    } catch (err) {
      setError(err?.message || 'Restore failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Get product info ────────────────────────────────────────────────────────
  const getProduct = useCallback((productId) => {
    return IAPService.getProduct(productId);
  }, []);

  return (
    <IAPContext.Provider
      value={{
        isPro,
        hasMinerBoost,
        products,
        loading,
        purchasing,
        error,
        lastPurchase,
        initialized,
        purchase,
        restorePurchases,
        getProduct,
        clearError: () => setError(null),
      }}
    >
      {children}
    </IAPContext.Provider>
  );
};

// ── Helper: check if entitlement is active ───────────────────────────────────
function _checkEntitlement(entitlements, name) {
  if (!Array.isArray(entitlements)) return false;
  return entitlements.some(
    e => e.entitlement === name &&
         e.status === 'active' &&
         (!e.expiresAt || new Date(e.expiresAt) > new Date())
  );
}
