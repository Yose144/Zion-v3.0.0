//! Shared types for bridge operations.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Status of a bridge operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BridgeStatus {
    /// Detected on source chain, waiting for finality
    Pending,
    /// Finality confirmed, waiting for validator consensus
    Confirmed,
    /// Validator threshold reached, executing on destination
    Executing,
    /// Successfully completed on both chains
    Completed,
    /// Failed (will be retried)
    Failed,
    /// Timelocked (large amount, waiting for delay)
    Timelocked,
}

/// Direction of bridge transfer.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BridgeDirection {
    /// ZION L1 → EVM (lock on L1, mint wZION on EVM)
    L1ToEvm,
    /// EVM → ZION L1 (burn wZION on EVM, unlock on L1)
    EvmToL1,
}

/// A lock event detected on ZION L1.
/// User sent ZION to the bridge lock address.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct L1LockEvent {
    /// L1 transaction hash (hex)
    pub l1_tx_hash: String,

    /// L1 block height where the lock TX was confirmed
    pub l1_block_height: u64,

    /// L1 sender address (bech32, e.g., "zion1q...")
    pub l1_sender: String,

    /// Amount locked (in L1 atomic units: 1 ZION = 1,000,000)
    pub amount_atomic: u64,

    /// Amount in wZION (18 decimals) — converted by relay
    pub amount_wzion: String,

    /// Target EVM chain (e.g., "base", "arbitrum")
    pub target_chain: String,

    /// Recipient EVM address (parsed from TX memo/OP_RETURN)
    pub evm_recipient: String,

    /// Timestamp of detection
    pub detected_at: DateTime<Utc>,

    /// Current status
    pub status: BridgeStatus,

    /// Number of validator confirmations
    pub confirmations: u8,
}

/// A burn event detected on EVM chain.
/// User burned wZION via bridgeBurn().
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvmBurnEvent {
    /// EVM transaction hash
    pub evm_tx_hash: String,

    /// EVM block number
    pub evm_block_number: u64,

    /// EVM chain ID (e.g., "base")
    pub evm_chain: String,

    /// Address that burned wZION
    pub evm_burner: String,

    /// Amount burned (18 decimals)
    pub amount_wzion: String,

    /// Amount to unlock on L1 (atomic units) — converted by relay
    pub amount_l1_atomic: u64,

    /// ZION L1 recipient address (bech32)
    pub l1_recipient: String,

    /// Burn ID from wZION contract
    pub burn_id: String,

    /// Timestamp of detection
    pub detected_at: DateTime<Utc>,

    /// Current status
    pub status: BridgeStatus,

    /// Number of validator confirmations for L1 unlock
    pub confirmations: u8,
}

/// Bridge statistics snapshot.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BridgeStats {
    /// Total ZION locked on L1 (atomic units)
    pub total_locked_l1: u64,

    /// Total wZION minted across all EVM chains
    pub total_minted_wzion: String,

    /// Total wZION burned across all EVM chains
    pub total_burned_wzion: String,

    /// Outstanding wZION (minted - burned, should equal locked L1)
    pub outstanding_wzion: String,

    /// Total bridge operations (both directions)
    pub total_operations: u64,

    /// Operations in last 24h
    pub operations_24h: u64,

    /// Bridge uptime (seconds)
    pub uptime_secs: u64,

    /// Per-chain stats
    pub chain_stats: Vec<ChainBridgeStats>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ChainBridgeStats {
    pub chain_id: String,
    pub chain_name: String,
    pub total_minted: String,
    pub total_burned: String,
    pub outstanding: String,
    pub operations: u64,
}

#[cfg(test)]
mod type_tests {
    use crate::{BridgeStatus, BridgeDirection, L1LockEvent, EvmBurnEvent, BridgeStats};

    #[test]
    fn test_bridge_status_serialization() {
        let status = BridgeStatus::Pending;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"Pending\"");
        let deserialized: BridgeStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, BridgeStatus::Pending);
    }

    #[test]
    fn test_all_statuses() {
        let statuses = vec![
            BridgeStatus::Pending,
            BridgeStatus::Confirmed,
            BridgeStatus::Executing,
            BridgeStatus::Completed,
            BridgeStatus::Failed,
            BridgeStatus::Timelocked,
        ];
        for s in statuses {
            let json = serde_json::to_string(&s).unwrap();
            let back: BridgeStatus = serde_json::from_str(&json).unwrap();
            assert_eq!(s, back);
        }
    }

    #[test]
    fn test_bridge_direction() {
        assert_ne!(BridgeDirection::L1ToEvm, BridgeDirection::EvmToL1);
        let d = BridgeDirection::L1ToEvm;
        let json = serde_json::to_string(&d).unwrap();
        assert_eq!(json, "\"L1ToEvm\"");
    }

    #[test]
    fn test_l1_lock_event_serialization() {
        let lock = L1LockEvent {
            l1_tx_hash: "abc123".into(),
            l1_block_height: 1000,
            l1_sender: "zion1qtest".into(),
            amount_atomic: 5_000_000,
            amount_wzion: "5000000000000000000".into(),
            target_chain: "base".into(),
            evm_recipient: "0x1234567890abcdef1234567890abcdef12345678".into(),
            detected_at: chrono::Utc::now(),
            status: BridgeStatus::Pending,
            confirmations: 0,
        };
        let json = serde_json::to_string(&lock).unwrap();
        assert!(json.contains("\"l1_tx_hash\":\"abc123\""));
        assert!(json.contains("\"amount_atomic\":5000000"));
        let back: L1LockEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(back.l1_tx_hash, "abc123");
        assert_eq!(back.amount_atomic, 5_000_000);
    }

    #[test]
    fn test_evm_burn_event_serialization() {
        let burn = EvmBurnEvent {
            evm_tx_hash: "0xdeadbeef".into(),
            evm_block_number: 50000,
            evm_chain: "base".into(),
            evm_burner: "0xaaa".into(),
            amount_wzion: "1000000000000000000".into(),
            amount_l1_atomic: 1_000_000,
            l1_recipient: "zion1qrecipient".into(),
            burn_id: "burn001".into(),
            detected_at: chrono::Utc::now(),
            status: BridgeStatus::Confirmed,
            confirmations: 2,
        };
        let json = serde_json::to_string(&burn).unwrap();
        let back: EvmBurnEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(back.burn_id, "burn001");
        assert_eq!(back.confirmations, 2);
    }

    #[test]
    fn test_bridge_stats_default() {
        let stats = BridgeStats::default();
        assert_eq!(stats.total_locked_l1, 0);
        assert_eq!(stats.total_operations, 0);
        assert!(stats.chain_stats.is_empty());
    }
}

/// Decimal conversion helpers.
pub mod conversion {
    /// Convert L1 atomic units (6 decimals) to wZION amount string (18 decimals).
    /// Example: 5_400_067_000 atomic → "5400067000000000000000" (5400.067 wZION × 1e18)
    pub fn l1_atomic_to_wzion_wei(atomic: u64) -> String {
        // L1: 1 ZION = 1,000,000 atomic (6 decimals)
        // EVM: 1 wZION = 1e18 wei (18 decimals)
        // Conversion: multiply by 1e12 (18 - 6 = 12)
        let wei = (atomic as u128) * 1_000_000_000_000u128; // × 1e12
        wei.to_string()
    }

    /// Convert wZION wei string (18 decimals) to L1 atomic units (6 decimals).
    /// Rounds down (truncates sub-atomic dust).
    pub fn wzion_wei_to_l1_atomic(wei_str: &str) -> Result<u64, String> {
        let wei: u128 = wei_str
            .parse()
            .map_err(|e| format!("Invalid wei amount: {}", e))?;
        let atomic = wei / 1_000_000_000_000u128; // ÷ 1e12
        if atomic > u64::MAX as u128 {
            return Err("Amount exceeds u64 max".into());
        }
        Ok(atomic as u64)
    }

    /// Format atomic units to human-readable ZION.
    /// Example: 5_400_067_000 → "5400.067"
    pub fn atomic_to_zion_display(atomic: u64) -> String {
        let whole = atomic / 1_000_000;
        let frac = atomic % 1_000_000;
        if frac == 0 {
            format!("{}", whole)
        } else {
            format!("{}.{:06}", whole, frac).trim_end_matches('0').to_string()
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn test_l1_to_wzion_conversion() {
            // 1 ZION = 1_000_000 atomic → 1e18 wei
            assert_eq!(
                l1_atomic_to_wzion_wei(1_000_000),
                "1000000000000000000" // 1e18
            );

            // 5400.067 ZION = 5_400_067_000 atomic → × 1e12 = 5400067000000000000000
            assert_eq!(
                l1_atomic_to_wzion_wei(5_400_067_000),
                "5400067000000000000000" // 5400.067 × 1e18
            );
        }

        #[test]
        fn test_wzion_to_l1_conversion() {
            // 1e18 wei → 1_000_000 atomic (1 ZION)
            assert_eq!(wzion_wei_to_l1_atomic("1000000000000000000").unwrap(), 1_000_000);

            // 100 wZION = 100e18 wei → 100_000_000 atomic
            assert_eq!(
                wzion_wei_to_l1_atomic("100000000000000000000").unwrap(),
                100_000_000
            );
        }

        #[test]
        fn test_display() {
            assert_eq!(atomic_to_zion_display(5_400_067_000), "5400.067");
            assert_eq!(atomic_to_zion_display(1_000_000), "1");
            assert_eq!(atomic_to_zion_display(500_000), "0.5");
        }

        #[test]
        fn test_zero_conversion() {
            assert_eq!(l1_atomic_to_wzion_wei(0), "0");
            assert_eq!(wzion_wei_to_l1_atomic("0").unwrap(), 0);
            assert_eq!(atomic_to_zion_display(0), "0");
        }

        #[test]
        fn test_roundtrip_conversion() {
            // Lock 1000 ZION → mint wZION → burn → unlock: should get same amount back
            let original_atomic = 1_000_000_000u64; // 1000 ZION
            let wzion_wei = l1_atomic_to_wzion_wei(original_atomic);
            let recovered = wzion_wei_to_l1_atomic(&wzion_wei).unwrap();
            assert_eq!(original_atomic, recovered, "Roundtrip must be lossless");
        }

        #[test]
        fn test_dust_truncation() {
            // Sub-atomic dust: 999_999_999_999 wei < 1 atomic unit, truncated to 0
            assert_eq!(wzion_wei_to_l1_atomic("999999999999").unwrap(), 0);
            // Exactly 1 atomic = 1e12 wei
            assert_eq!(wzion_wei_to_l1_atomic("1000000000000").unwrap(), 1);
        }

        #[test]
        fn test_min_bridge_amount() {
            // 100 ZION = 100_000_000 atomic
            let min = 100_000_000u64;
            let wzion = l1_atomic_to_wzion_wei(min);
            assert_eq!(wzion, "100000000000000000000"); // 100 × 1e18
        }

        #[test]
        fn test_large_amount_conversion() {
            // 10M ZION (daily limit) = 10_000_000_000_000 atomic
            let daily_limit = 10_000_000_000_000u64;
            let wzion = l1_atomic_to_wzion_wei(daily_limit);
            assert_eq!(wzion, "10000000000000000000000000"); // 10M × 1e18
            assert_eq!(wzion_wei_to_l1_atomic(&wzion).unwrap(), daily_limit);
        }

        #[test]
        fn test_invalid_wei_string() {
            assert!(wzion_wei_to_l1_atomic("not_a_number").is_err());
            assert!(wzion_wei_to_l1_atomic("").is_err());
            assert!(wzion_wei_to_l1_atomic("-1").is_err());
        }

        #[test]
        fn test_display_formatting() {
            assert_eq!(atomic_to_zion_display(100_000), "0.1");
            assert_eq!(atomic_to_zion_display(10_000), "0.01");
            assert_eq!(atomic_to_zion_display(1), "0.000001");
            assert_eq!(atomic_to_zion_display(123_456_789_000_000), "123456789");
        }
    }
}
