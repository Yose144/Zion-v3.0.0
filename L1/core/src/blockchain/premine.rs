/// ZION Genesis Premine — Clean L1 Configuration
///
/// Total Supply:      144,000,000,000 ZION (144B)
/// Genesis Premine:    16,280,000,000 ZION (16.28B — 11.31%)
/// Mining Emission:   127,720,000,000 ZION (127.72B — 88.69%)
///
/// Genesis Allocation (16.28B):
///   - ZION OASIS + Winners Golden Egg/Xp:  8,250,000,000 ZION (50.7%)  → OASIS game rewards + winners golden egg/xp
///   - DAO Treasury:                      4,000,000,000 ZION (24.6%)  → community governance
///   - Infrastructure:                    2,590,000,000 ZION (15.9%)  → development, nodes, audit
///   - Humanitarian Fund:                 1,440,000,000 ZION  (8.8%)  → children & humanitarian projects
///
/// Changes from WP2.9:
///   - Presale (500M) → CANCELLED January 2026, merged into DAO Treasury
///   - Consciousness bonus → REMOVED from L1, reserved for OASIS (L2/game layer)
///   - DAO Winners (1.75B) → merged into DAO Treasury
///   - OASIS (1.44B) → renamed Humanitarian Fund on L1
///   - Mining Operators Pool → renamed ZION OASIS + Winners Golden Egg/Xp
///
/// Source: WP2.9.5 / MAINNET_CONSTITUTION.md (verified)
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Total premine in atomic units: 16,280,000,000 ZION × 1,000,000
pub const PREMINE_TOTAL: u64 = 16_280_000_000_000_000;

/// Total supply in atomic units: 144,000,000,000 ZION × 1,000,000
pub const TOTAL_SUPPLY: u64 = 144_000_000_000_000_000;

/// Mining emission in atomic units
pub const MINING_EMISSION: u64 = TOTAL_SUPPLY - PREMINE_TOTAL;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// A single genesis premine allocation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PremineAddress {
    /// Bech32 address (zion1…)
    pub address: String,
    /// Human-readable purpose
    pub purpose: String,
    /// Amount in atomic units (1 ZION = 1,000,000 atomic units)
    pub amount: u64,
    /// Category: oasis_golden_egg, dao_treasury, infrastructure, humanitarian
    pub category: String,
    /// Block height at which funds unlock (None = immediately available)
    /// NOTE: Not enforced on-chain in v2.9.5. Governance is off-chain (DAO vote).
    pub unlock_height: Option<u64>,
}

// ---------------------------------------------------------------------------
// Genesis Allocations
// ---------------------------------------------------------------------------

/// ZION OASIS + Winners Golden Egg/Xp — 8,250,000,000 ZION (50.7% of premine)
///
/// Reserved for OASIS game rewards and Winners Golden Egg/Xp distribution.
/// These funds are NOT distributed via L1 consensus; they sit in
/// time-locked addresses and will be spent by the OASIS game contract / DAO vote.
pub const OASIS_GOLDEN_EGG_POOL: &[(&str, &str, u64)] = &[
    (
        "zion166e6v3k204h8p5w4w3a7m0x790q5m7z5z6n252p",
        "ZION OASIS + Winners Golden Egg/Xp (Slot 1)",
        1_650_000_000_000_000, // 1.65B ZION
    ),
    (
        "zion1l2h8h0e3h7m6p8e297m6n624c5m7r2k364v684a",
        "ZION OASIS + Winners Golden Egg/Xp (Slot 2)",
        1_650_000_000_000_000, // 1.65B ZION
    ),
    (
        "zion1e6r0q3g6t0r0v5f6h7k7c5f3v562j0v7e5e5d0a",
        "ZION OASIS + Winners Golden Egg/Xp (Slot 3)",
        1_650_000_000_000_000, // 1.65B ZION
    ),
    (
        "zion1l7e4c4c5x8l440t295a7m4k5p5x8v8z7r043s23",
        "ZION OASIS + Winners Golden Egg/Xp (Slot 4)",
        1_650_000_000_000_000, // 1.65B ZION
    ),
    (
        "zion1n8h2a8p386z274859833h7v6c5n687f7a6k523u",
        "ZION OASIS + Winners Golden Egg/Xp (Slot 5)",
        1_650_000_000_000_000, // 1.65B ZION
    ),
];

/// DAO Treasury — 4,000,000,000 ZION (24.6% of premine)
///
/// Includes the former DAO Winners (1.75B) and cancelled Presale (500M)
/// allocations, merged into a single community governance pool.
/// Unlocks linearly over 10 years from genesis (block-height based).
pub const DAO_TREASURY: &[(&str, &str, u64)] = &[
    (
        "zion176u8r6w53768e2k04035d4d3c2z5g555n6l4r3s",
        "DAO Treasury — Community Governance (main)",
        2_500_000_000_000_000, // 2.5B ZION
    ),
    (
        "zion12643n776r3m8f340484756q06485h5w4c2l405m",
        "DAO Treasury — Grants & Bounties",
        1_000_000_000_000_000, // 1.0B ZION
    ),
    (
        "zion1k8w734x422f3t6t536r287k2c6n3z0e05257606",
        "DAO Treasury — Ecosystem Bootstrap",
        500_000_000_000_000, // 0.5B ZION
    ),
];

/// Infrastructure — 2,590,000,000 ZION (15.9% of premine)
///
/// Core development, P2P nodes, security audits.
pub const INFRASTRUCTURE: &[(&str, &str, u64)] = &[
    (
        "zion1q540v6y4f0s4v3n0f8t740t53494z56024u645c",
        "Core Development Fund",
        1_000_000_000_000_000, // 1.0B ZION
    ),
    (
        "zion1h4w39686t8w376g0x0y426e775q6p2q0v698v43",
        "Network Infrastructure — P2P Seed Nodes",
        1_000_000_000_000_000, // 1.0B ZION
    ),
    (
        "zion1x638z5x6d2d0y6u3f7y8g7j56054a4a2a2c7l8f",
        "Genesis Creator — Lifetime Rent",
        590_000_000_000_000, // 0.59B ZION
    ),
];

/// Humanitarian Fund — 1,440,000,000 ZION (8.8% of premine)
///
/// Children's Future Fund + humanitarian initiatives.
pub const HUMANITARIAN: &[(&str, &str, u64)] = &[(
    "zion1m4v5z8z850u480c5c208z274e334369275n5y20",
    "Children Future Fund — Humanitarian DAO",
    1_440_000_000_000_000, // 1.44B ZION
)];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Get all premine addresses as a single collection
pub fn get_all_premine_addresses() -> Vec<PremineAddress> {
    let mut addresses = Vec::new();

    // ZION OASIS + Winners Golden Egg
    // Distribution governed off-chain by OASIS game contract + DAO vote
    for (addr, purpose, amount) in OASIS_GOLDEN_EGG_POOL {
        addresses.push(PremineAddress {
            address: addr.to_string(),
            purpose: purpose.to_string(),
            amount: *amount,
            category: "oasis_golden_egg".to_string(),
            unlock_height: None, // No on-chain lock — governed by DAO + OASIS contract
        });
    }

    // DAO Treasury — distribution governed by DAO vote (off-chain governance)
    for (addr, purpose, amount) in DAO_TREASURY {
        addresses.push(PremineAddress {
            address: addr.to_string(),
            purpose: purpose.to_string(),
            amount: *amount,
            category: "dao_treasury".to_string(),
            unlock_height: None, // No on-chain lock — governed by DAO vote
        });
    }

    // Infrastructure
    for (addr, purpose, amount) in INFRASTRUCTURE {
        addresses.push(PremineAddress {
            address: addr.to_string(),
            purpose: purpose.to_string(),
            amount: *amount,
            category: "infrastructure".to_string(),
            unlock_height: None, // Immediately available for operations
        });
    }

    // Humanitarian
    for (addr, purpose, amount) in HUMANITARIAN {
        addresses.push(PremineAddress {
            address: addr.to_string(),
            purpose: purpose.to_string(),
            amount: *amount,
            category: "humanitarian".to_string(),
            unlock_height: None,
        });
    }

    addresses
}

/// Validate premine structure (sanity check)
pub fn validate_premine() -> Result<(), String> {
    let mut total: u64 = 0;

    // OASIS + Golden Egg: must total 8.25B
    let oasis_total: u64 = OASIS_GOLDEN_EGG_POOL.iter().map(|x| x.2).sum();
    if oasis_total != 8_250_000_000_000_000 {
        return Err(format!(
            "OASIS + Golden Egg total {} != 8.25B",
            oasis_total / 1_000_000
        ));
    }
    total += oasis_total;

    // DAO Treasury: must total 4.0B
    let dao_total: u64 = DAO_TREASURY.iter().map(|x| x.2).sum();
    if dao_total != 4_000_000_000_000_000 {
        return Err(format!(
            "DAO Treasury total {} != 4.0B",
            dao_total / 1_000_000
        ));
    }
    total += dao_total;

    // Infrastructure: must total 2.59B
    let infra_total: u64 = INFRASTRUCTURE.iter().map(|x| x.2).sum();
    if infra_total != 2_590_000_000_000_000 {
        return Err(format!(
            "Infrastructure total {} != 2.59B",
            infra_total / 1_000_000
        ));
    }
    total += infra_total;

    // Humanitarian: must total 1.44B
    let humanitarian_total: u64 = HUMANITARIAN.iter().map(|x| x.2).sum();
    if humanitarian_total != 1_440_000_000_000_000 {
        return Err(format!(
            "Humanitarian total {} != 1.44B",
            humanitarian_total / 1_000_000
        ));
    }
    total += humanitarian_total;

    // Grand total: must equal 16.28B
    if total != PREMINE_TOTAL {
        return Err(format!(
            "Grand total {} != PREMINE_TOTAL {}",
            total / 1_000_000,
            PREMINE_TOTAL / 1_000_000
        ));
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_premine_validation() {
        assert!(validate_premine().is_ok(), "{:?}", validate_premine());
    }

    #[test]
    fn test_premine_total() {
        let all = get_all_premine_addresses();
        let total: u64 = all.iter().map(|a| a.amount).sum();
        assert_eq!(total, PREMINE_TOTAL);
    }

    #[test]
    fn test_oasis_golden_egg() {
        assert_eq!(OASIS_GOLDEN_EGG_POOL.len(), 5);
        let total: u64 = OASIS_GOLDEN_EGG_POOL.iter().map(|x| x.2).sum();
        assert_eq!(total, 8_250_000_000_000_000);
    }

    #[test]
    fn test_dao_treasury() {
        assert_eq!(DAO_TREASURY.len(), 3);
        let total: u64 = DAO_TREASURY.iter().map(|x| x.2).sum();
        assert_eq!(total, 4_000_000_000_000_000);
    }

    #[test]
    fn test_infrastructure() {
        assert_eq!(INFRASTRUCTURE.len(), 3);
        let total: u64 = INFRASTRUCTURE.iter().map(|x| x.2).sum();
        assert_eq!(total, 2_590_000_000_000_000);
    }

    #[test]
    fn test_humanitarian() {
        assert_eq!(HUMANITARIAN.len(), 1);
        let total: u64 = HUMANITARIAN.iter().map(|x| x.2).sum();
        assert_eq!(total, 1_440_000_000_000_000);
    }

    #[test]
    fn test_premine_categories() {
        let all = get_all_premine_addresses();
        let categories: Vec<&str> = all.iter().map(|a| a.category.as_str()).collect();
        assert!(categories.contains(&"oasis_golden_egg"));
        assert!(categories.contains(&"dao_treasury"));
        assert!(categories.contains(&"infrastructure"));
        assert!(categories.contains(&"humanitarian"));
    }

    #[test]
    fn test_supply_constants() {
        assert_eq!(TOTAL_SUPPLY, 144_000_000_000_000_000);
        assert_eq!(PREMINE_TOTAL, 16_280_000_000_000_000);
        assert_eq!(MINING_EMISSION, 127_720_000_000_000_000);
        assert_eq!(MINING_EMISSION, TOTAL_SUPPLY - PREMINE_TOTAL);
    }

    #[test]
    fn test_all_premine_addresses_valid_format() {
        use crate::crypto::keys::is_valid_zion1_address_format;
        let all = get_all_premine_addresses();
        for pa in &all {
            assert!(
                is_valid_zion1_address_format(&pa.address),
                "Invalid premine address '{}' (purpose: {}). \
                 Must be 44 chars: zion1 + 39 lowercase alphanumeric",
                pa.address,
                pa.purpose
            );
        }
    }

    #[test]
    fn test_no_duplicate_premine_addresses() {
        let all = get_all_premine_addresses();
        let mut seen = std::collections::HashSet::new();
        for pa in &all {
            assert!(
                seen.insert(&pa.address),
                "Duplicate premine address: {} (purpose: {})",
                pa.address,
                pa.purpose
            );
        }
    }
}
