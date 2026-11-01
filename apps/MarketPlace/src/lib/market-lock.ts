/**
 * Artifact marketplace launch gate.
 * The L2 artifact market opens with OASIS — until then browse is allowed
 * but all purchase paths (L2 buy, auction bid, L1 settle memo) are locked
 * in the UI. Flip to false (or wire an env/ShopSetting) at OASIS launch.
 */
export const MARKET_LOCKED = true;
