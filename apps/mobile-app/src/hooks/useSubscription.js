// ─────────────────────────────────────────────────────────────────────────────
// useSubscription — Convenience hook for IAP/subscription state
// ─────────────────────────────────────────────────────────────────────────────

import { useContext } from 'react';
import { IAPContext } from '../context/IAPContext';

export function useSubscription() {
  const iap = useContext(IAPContext);

  return {
    // State
    isPro: iap.isPro,
    hasMinerBoost: iap.hasMinerBoost,
    isFree: !iap.isPro && !iap.hasMinerBoost,
    loading: iap.loading,
    purchasing: iap.purchasing,
    error: iap.error,
    initialized: iap.initialized,
    products: iap.products,

    // Actions
    purchase: iap.purchase,
    restorePurchases: iap.restorePurchases,
    getProduct: iap.getProduct,
    clearError: iap.clearError,

    // Product IDs (convenience)
    productIds: {
      proLifetime: 'zion.pro.lifetime',
      proYearly: 'zion.pro.yearly',
      proMonthly: 'zion.pro.monthly',
      minerBoost: 'zion.miner.boost',
      donate5: 'zion.donate.5',
      donate25: 'zion.donate.25',
    },
  };
}

export default useSubscription;
