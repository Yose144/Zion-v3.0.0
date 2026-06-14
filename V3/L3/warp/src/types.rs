use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Identifies a blockchain network.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ChainFamily {
    Evm,
    Solana,
    Tron,
    Stellar,
    Cardano,
    Cosmos,
    Bitcoin,
    Sui,
    Aptos,
    Near,
    Ton,
    ZionL1,
}

impl std::fmt::Display for ChainFamily {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ChainFamily::Evm => write!(f, "evm"),
            ChainFamily::Solana => write!(f, "solana"),
            ChainFamily::Tron => write!(f, "tron"),
            ChainFamily::Stellar => write!(f, "stellar"),
            ChainFamily::Cardano => write!(f, "cardano"),
            ChainFamily::Cosmos => write!(f, "cosmos"),
            ChainFamily::Bitcoin => write!(f, "bitcoin"),
            ChainFamily::Sui => write!(f, "sui"),
            ChainFamily::Aptos => write!(f, "aptos"),
            ChainFamily::Near => write!(f, "near"),
            ChainFamily::Ton => write!(f, "ton"),
            ChainFamily::ZionL1 => write!(f, "zion-l1"),
        }
    }
}

/// Specific chain identifier (e.g. "base", "arbitrum", "bsc", "polygon", "solana", …).
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ChainId {
    pub family: ChainFamily,
    pub name: String,
    pub chain_id_numeric: Option<u64>,
    pub decimals: u8,
    pub finality_blocks: u64,
}

impl ChainId {
    pub fn evm(name: &str, chain_id: u64, finality: u64) -> Self {
        Self {
            family: ChainFamily::Evm,
            name: name.to_string(),
            chain_id_numeric: Some(chain_id),
            decimals: 18,
            finality_blocks: finality,
        }
    }

    pub fn solana() -> Self {
        Self {
            family: ChainFamily::Solana,
            name: "solana".to_string(),
            chain_id_numeric: None,
            decimals: 9,
            finality_blocks: 31,
        }
    }

    pub fn bitcoin() -> Self {
        Self {
            family: ChainFamily::Bitcoin,
            name: "bitcoin".to_string(),
            chain_id_numeric: None,
            decimals: 8,
            finality_blocks: 6,
        }
    }

    pub fn zion_l1() -> Self {
        Self {
            family: ChainFamily::ZionL1,
            name: "zion-l1".to_string(),
            chain_id_numeric: None,
            decimals: 12,
            finality_blocks: 60,
        }
    }

    pub fn tron() -> Self {
        Self {
            family: ChainFamily::Tron,
            name: "tron".to_string(),
            chain_id_numeric: None,
            decimals: 18,
            finality_blocks: 19,
        }
    }

    pub fn stellar() -> Self {
        Self {
            family: ChainFamily::Stellar,
            name: "stellar".to_string(),
            chain_id_numeric: None,
            decimals: 7,
            finality_blocks: 1,
        }
    }

    pub fn cardano() -> Self {
        Self {
            family: ChainFamily::Cardano,
            name: "cardano".to_string(),
            chain_id_numeric: None,
            decimals: 6,
            finality_blocks: 21,
        }
    }

    pub fn cosmos() -> Self {
        Self {
            family: ChainFamily::Cosmos,
            name: "cosmos".to_string(),
            chain_id_numeric: None,
            decimals: 6,
            finality_blocks: 1,
        }
    }

    pub fn sui() -> Self {
        Self {
            family: ChainFamily::Sui,
            name: "sui".to_string(),
            chain_id_numeric: None,
            decimals: 9,
            finality_blocks: 1,
        }
    }

    pub fn aptos() -> Self {
        Self {
            family: ChainFamily::Aptos,
            name: "aptos".to_string(),
            chain_id_numeric: None,
            decimals: 8,
            finality_blocks: 1,
        }
    }

    pub fn near() -> Self {
        Self {
            family: ChainFamily::Near,
            name: "near".to_string(),
            chain_id_numeric: None,
            decimals: 24,
            finality_blocks: 2,
        }
    }

    pub fn ton() -> Self {
        Self {
            family: ChainFamily::Ton,
            name: "ton".to_string(),
            chain_id_numeric: None,
            decimals: 9,
            finality_blocks: 1,
        }
    }
}

/// Represents an asset on a specific chain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub chain: ChainId,
    pub symbol: String,
    pub contract_address: Option<String>,
    pub is_native: bool,
}

/// Transfer lifecycle status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WarpStatus {
    Pending,
    Detected,
    AwaitingFinality,
    Validating,
    QuorumReached,
    Executing,
    Completed,
    Failed,
    TimelockHold,
}

impl std::fmt::Display for WarpStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WarpStatus::Pending => write!(f, "pending"),
            WarpStatus::Detected => write!(f, "detected"),
            WarpStatus::AwaitingFinality => write!(f, "awaiting_finality"),
            WarpStatus::Validating => write!(f, "validating"),
            WarpStatus::QuorumReached => write!(f, "quorum_reached"),
            WarpStatus::Executing => write!(f, "executing"),
            WarpStatus::Completed => write!(f, "completed"),
            WarpStatus::Failed => write!(f, "failed"),
            WarpStatus::TimelockHold => write!(f, "timelock_hold"),
        }
    }
}

/// A cross-chain transfer record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarpTransfer {
    pub id: Uuid,
    pub source_chain: ChainId,
    pub dest_chain: ChainId,
    pub sender: String,
    pub recipient: String,
    pub amount_flowers: u64,
    pub fee_flowers: u64,
    pub status: WarpStatus,
    pub source_tx_hash: Option<String>,
    pub dest_tx_hash: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub memo: String,
}

impl WarpTransfer {
    pub fn new(
        source: ChainId,
        dest: ChainId,
        sender: String,
        recipient: String,
        amount_flowers: u64,
        fee_flowers: u64,
        memo: String,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            source_chain: source,
            dest_chain: dest,
            sender,
            recipient,
            amount_flowers,
            fee_flowers,
            status: WarpStatus::Pending,
            source_tx_hash: None,
            dest_tx_hash: None,
            created_at: now,
            updated_at: now,
            memo,
        }
    }

    /// Net amount after fees (in source-chain atomic units).
    pub fn net_amount(&self) -> u64 {
        self.amount_flowers.saturating_sub(self.fee_flowers)
    }
}

/// Convert amount between chains with different decimal places.
/// ZION L1 = 12 decimals, EVM = 18, Solana = 9, Bitcoin = 8, etc.
pub fn convert_decimals(amount: u64, from_decimals: u8, to_decimals: u8) -> Option<u128> {
    let amount = amount as u128;
    if to_decimals >= from_decimals {
        let factor = 10u128.checked_pow((to_decimals - from_decimals) as u32)?;
        amount.checked_mul(factor)
    } else {
        let factor = 10u128.checked_pow((from_decimals - to_decimals) as u32)?;
        Some(amount / factor)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chain_id_evm_base() {
        let base = ChainId::evm("base", 8453, 12);
        assert_eq!(base.family, ChainFamily::Evm);
        assert_eq!(base.decimals, 18);
        assert_eq!(base.finality_blocks, 12);
    }

    #[test]
    fn test_chain_id_solana() {
        let sol = ChainId::solana();
        assert_eq!(sol.family, ChainFamily::Solana);
        assert_eq!(sol.decimals, 9);
    }

    #[test]
    fn test_chain_id_bitcoin() {
        let btc = ChainId::bitcoin();
        assert_eq!(btc.decimals, 8);
        assert_eq!(btc.finality_blocks, 6);
    }

    #[test]
    fn test_chain_id_zion() {
        let zion = ChainId::zion_l1();
        assert_eq!(zion.decimals, 12);
        assert_eq!(zion.finality_blocks, 60);
    }

    #[test]
    fn test_chain_family_display() {
        assert_eq!(ChainFamily::Evm.to_string(), "evm");
        assert_eq!(ChainFamily::Bitcoin.to_string(), "bitcoin");
        assert_eq!(ChainFamily::ZionL1.to_string(), "zion-l1");
    }

    #[test]
    fn test_warp_status_display() {
        assert_eq!(WarpStatus::Pending.to_string(), "pending");
        assert_eq!(WarpStatus::Completed.to_string(), "completed");
        assert_eq!(WarpStatus::TimelockHold.to_string(), "timelock_hold");
    }

    #[test]
    fn test_warp_transfer_new() {
        let t = WarpTransfer::new(
            ChainId::zion_l1(),
            ChainId::solana(),
            "zion1sender".into(),
            "7xKXtg2CW87d97T".into(),
            1_000_000,
            1_500,
            "WARP:1:solana:7xKXtg2CW87d97T".into(),
        );
        assert_eq!(t.status, WarpStatus::Pending);
        assert_eq!(t.amount_flowers, 1_000_000);
        assert_eq!(t.net_amount(), 998_500);
    }

    #[test]
    fn test_convert_decimals_zion_to_evm() {
        // 1 ZION (12 dec) → EVM (18 dec)
        let result = convert_decimals(1_000_000_000_000, 12, 18).unwrap();
        assert_eq!(result, 1_000_000_000_000_000_000);
    }

    #[test]
    fn test_convert_decimals_zion_to_solana() {
        // 1 ZION (12 dec) → Solana (9 dec)
        let result = convert_decimals(1_000_000_000_000, 12, 9).unwrap();
        assert_eq!(result, 1_000_000_000);
    }

    #[test]
    fn test_convert_decimals_zion_to_bitcoin() {
        // 1 ZION (12 dec) → Bitcoin (8 dec)
        let result = convert_decimals(1_000_000_000_000, 12, 8).unwrap();
        assert_eq!(result, 100_000_000);
    }

    #[test]
    fn test_convert_decimals_evm_to_zion() {
        // 1 wZION (18 dec) → ZION L1 (12 dec)
        let result = convert_decimals(1_000_000_000_000_000_000, 18, 12).unwrap();
        assert_eq!(result, 1_000_000_000_000);
    }

    #[test]
    fn test_convert_decimals_same() {
        // Cardano (6) → Cardano (6) — same decimal, no conversion
        let result = convert_decimals(1_000_000, 6, 6).unwrap();
        assert_eq!(result, 1_000_000);
    }

    #[test]
    fn test_convert_decimals_zion_to_stellar() {
        // 1 ZION (12 dec) → Stellar (7 dec)
        let result = convert_decimals(1_000_000_000_000, 12, 7).unwrap();
        assert_eq!(result, 10_000_000);
    }

    #[test]
    fn test_warp_transfer_net_amount_zero_fee() {
        let t = WarpTransfer::new(
            ChainId::zion_l1(),
            ChainId::evm("base", 8453, 12),
            "sender".into(),
            "0xrecipient".into(),
            1_000_000,
            0,
            "WARP:1:base:0xrecipient".into(),
        );
        assert_eq!(t.net_amount(), 1_000_000);
    }

    #[test]
    fn test_chain_id_tron() {
        let tron = ChainId::tron();
        assert_eq!(tron.family, ChainFamily::Tron);
        assert_eq!(tron.decimals, 18);
    }

    #[test]
    fn test_chain_id_stellar() {
        let stellar = ChainId::stellar();
        assert_eq!(stellar.family, ChainFamily::Stellar);
        assert_eq!(stellar.decimals, 7);
    }

    #[test]
    fn test_chain_id_cardano() {
        let cardano = ChainId::cardano();
        assert_eq!(cardano.family, ChainFamily::Cardano);
        assert_eq!(cardano.decimals, 6);
    }

    #[test]
    fn test_chain_id_cosmos() {
        let cosmos = ChainId::cosmos();
        assert_eq!(cosmos.family, ChainFamily::Cosmos);
        assert_eq!(cosmos.decimals, 6);
        assert_eq!(cosmos.finality_blocks, 1);
    }
}
