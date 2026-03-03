/// Sprint 1.1 — Genesis & Premine Verification Tests
///
/// Validates the genesis block premine: correct totals, categories,
/// address format, timelocks, and no duplicates.  These tests ensure
/// the on-chain genesis state matches the whitepaper specification.
use zion_core::blockchain::premine;

// ═══════════════════════════════════════════════════════════════════════════
// 1. Premine totals
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_premine_grand_total() {
    let all = premine::get_all_premine_addresses();
    let total: u64 = all.iter().map(|a| a.amount).sum();
    assert_eq!(total, premine::PREMINE_TOTAL);
    assert_eq!(total, 16_280_000_000_000_000); // 16.28B ZION
}

#[test]
fn test_premine_category_totals() {
    let all = premine::get_all_premine_addresses();

    let oasis: u64 = all
        .iter()
        .filter(|a| a.category == "oasis_golden_egg")
        .map(|a| a.amount)
        .sum();
    let dao: u64 = all
        .iter()
        .filter(|a| a.category == "dao_treasury")
        .map(|a| a.amount)
        .sum();
    let infra: u64 = all
        .iter()
        .filter(|a| a.category == "infrastructure")
        .map(|a| a.amount)
        .sum();
    let humanitarian: u64 = all
        .iter()
        .filter(|a| a.category == "humanitarian")
        .map(|a| a.amount)
        .sum();

    assert_eq!(oasis, 8_250_000_000_000_000, "OASIS + Golden Egg: 8.25B");
    assert_eq!(dao, 4_000_000_000_000_000, "DAO treasury: 4.0B");
    assert_eq!(infra, 2_590_000_000_000_000, "Infrastructure: 2.59B");
    assert_eq!(humanitarian, 1_440_000_000_000_000, "Humanitarian: 1.44B");

    assert_eq!(oasis + dao + infra + humanitarian, premine::PREMINE_TOTAL);
}

#[test]
fn test_mining_emission_correct() {
    // Total supply minus premine equals mining emission
    assert_eq!(
        premine::TOTAL_SUPPLY - premine::PREMINE_TOTAL,
        premine::MINING_EMISSION
    );
    assert_eq!(premine::MINING_EMISSION, 127_720_000_000_000_000);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Address validation
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_all_premine_addresses_start_with_zion1() {
    let all = premine::get_all_premine_addresses();
    assert!(!all.is_empty(), "Premine address list must not be empty");

    for entry in &all {
        assert!(
            entry.address.starts_with("zion1"),
            "Address '{}' does not start with 'zion1' (purpose: {})",
            entry.address,
            entry.purpose
        );
    }
}

#[test]
fn test_no_duplicate_addresses() {
    let all = premine::get_all_premine_addresses();
    let mut seen = std::collections::HashSet::new();

    for entry in &all {
        assert!(
            seen.insert(&entry.address),
            "Duplicate premine address: {} (purpose: {})",
            entry.address,
            entry.purpose
        );
    }
}

#[test]
fn test_no_empty_addresses() {
    let all = premine::get_all_premine_addresses();
    for entry in &all {
        assert!(!entry.address.is_empty(), "Empty premine address");
        assert!(
            entry.address.len() >= 10,
            "Address too short: {}",
            entry.address
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Category completeness
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_all_four_categories_present() {
    let all = premine::get_all_premine_addresses();
    let categories: Vec<&str> = all.iter().map(|a| a.category.as_str()).collect();

    assert!(
        categories.contains(&"oasis_golden_egg"),
        "Missing oasis_golden_egg"
    );
    assert!(categories.contains(&"dao_treasury"), "Missing dao_treasury");
    assert!(
        categories.contains(&"infrastructure"),
        "Missing infrastructure"
    );
    assert!(categories.contains(&"humanitarian"), "Missing humanitarian");
}

#[test]
fn test_no_unknown_categories() {
    let all = premine::get_all_premine_addresses();
    let valid = [
        "oasis_golden_egg",
        "dao_treasury",
        "infrastructure",
        "humanitarian",
    ];

    for entry in &all {
        assert!(
            valid.contains(&entry.category.as_str()),
            "Unknown category '{}' for address {}",
            entry.category,
            entry.address
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Governance metadata (no on-chain locks in v2.9.5)
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_all_premine_immediately_available() {
    let all = premine::get_all_premine_addresses();

    // v2.9.6: dao_treasury has an on-chain cliff lock (B-01, ≈ 1 year).
    // All other categories are governed off-chain and have no on-chain lock.
    for entry in &all {
        if entry.category == "dao_treasury" {
            assert!(
                entry.unlock_height.is_some(),
                "{} (dao_treasury) should have a cliff lock in v2.9.6 (B-01)",
                entry.address
            );
        } else {
            assert!(
                entry.unlock_height.is_none(),
                "{} ({}) should have no on-chain lock — governance is off-chain in v2.9.6",
                entry.address,
                entry.category
            );
        }
    }
}

#[test]
fn test_dao_treasury_governance_metadata() {
    let all = premine::get_all_premine_addresses();
    let dao: Vec<_> = all
        .iter()
        .filter(|a| a.category == "dao_treasury")
        .collect();

    assert!(!dao.is_empty());
    for entry in &dao {
        // v2.9.6 (B-01): DAO treasury has a cliff lock of ≈ 1 year (height 525_600)
        assert!(
            entry.unlock_height.is_some(),
            "DAO treasury {} should have a cliff lock in v2.9.6 (B-01)",
            entry.address
        );
        assert_eq!(
            entry.unlock_height,
            Some(premine::DAO_TREASURY_LOCK_HEIGHT),
            "DAO treasury {} lock height should be DAO_TREASURY_LOCK_HEIGHT",
            entry.address
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Amount sanity
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_no_zero_amount_premine() {
    let all = premine::get_all_premine_addresses();
    for entry in &all {
        assert!(
            entry.amount > 0,
            "Zero amount for address {} ({})",
            entry.address,
            entry.purpose
        );
    }
}

#[test]
fn test_no_amount_exceeds_total_supply() {
    let all = premine::get_all_premine_addresses();
    for entry in &all {
        assert!(
            entry.amount <= premine::TOTAL_SUPPLY,
            "Amount {} exceeds total supply for {}",
            entry.amount,
            entry.address
        );
    }
}

#[test]
fn test_premine_validate_function() {
    // The built-in validator should pass
    assert!(
        premine::validate_premine().is_ok(),
        "{:?}",
        premine::validate_premine()
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. Address counts
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_oasis_golden_egg_slot_count() {
    assert_eq!(
        premine::OASIS_GOLDEN_EGG_POOL.len(),
        5,
        "Expected 5 OASIS + Golden Egg slots"
    );
}

#[test]
fn test_dao_treasury_slot_count() {
    assert_eq!(
        premine::DAO_TREASURY.len(),
        3,
        "Expected 3 DAO treasury slots"
    );
}

#[test]
fn test_infrastructure_slot_count() {
    assert_eq!(
        premine::INFRASTRUCTURE.len(),
        3,
        "Expected 3 infrastructure slots"
    );
}

#[test]
fn test_humanitarian_slot_count() {
    assert_eq!(
        premine::HUMANITARIAN.len(),
        1,
        "Expected 1 humanitarian slot"
    );
}

#[test]
fn test_total_premine_address_count() {
    let all = premine::get_all_premine_addresses();
    // 5 + 3 + 3 + 1 = 12
    assert_eq!(all.len(), 12, "Expected 12 total premine addresses");
}
