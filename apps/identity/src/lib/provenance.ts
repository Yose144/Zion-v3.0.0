// Address-link provenance (audit must-fix: QTU/PRL address squatting).
//
// A linked address is `proven` when its link proof was a signature under
// the claimed address's own key (ed25519 zion-l1, SIWE evm, bitcoin,
// solana, google idToken). Quantus/pearl links are attestation-based:
// the signature comes from an account-bound ZION key, not the external
// QTU/PRL key — no browser ML-DSA/XMSS implementation exists yet — so a
// linked qz/prl address does NOT prove external-chain ownership.
//
// Consumers that treat a link as ownership proof (pool payout
// attribution, account-scoped writes via `owns()`) must gate on `proven`.
// Unproven links remain stored and visible (the 409 unique-address guard
// is unchanged), but are non-authoritative until an external-chain proof
// flow lands.

const ATTESTATION_ONLY_CHAINS = new Set(['quantus', 'pearl']);

export function linkProven(chainType: string): boolean {
  return !ATTESTATION_ONLY_CHAINS.has(chainType);
}

export function withLinkProvenance<T extends { chainType: string }>(
  rows: readonly T[],
): (T & { proven: boolean })[] {
  return rows.map((r) => ({ ...r, proven: linkProven(r.chainType) }));
}
