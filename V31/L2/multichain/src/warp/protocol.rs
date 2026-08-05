use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::warp::error::{WarpError, WarpResult};

/// WARP memo format: `WARP:<version>:<chain>:<address>`
pub const WARP_MEMO_PREFIX: &str = "WARP";
pub const WARP_MEMO_VERSION: u32 = 1;

/// Deposit proof from source chain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepositProof {
    pub tx_hash: String,
    pub block_height: u64,
    pub block_hash: String,
    pub sender: String,
    pub amount_flowers: u64,
    pub memo: String,
    pub confirmations: u64,
}

/// Message to be signed by validators for cross-chain execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarpMessage {
    pub transfer_id: Uuid,
    pub source_chain: String,
    pub dest_chain: String,
    pub recipient: String,
    pub amount_flowers: u64,
    pub fee_flowers: u64,
    pub nonce: u64,
    pub timestamp: u64,
    pub deposit_proof_hash: String,
}

impl WarpMessage {
    /// Compute a deterministic hash for signing.
    pub fn signing_hash(&self) -> Vec<u8> {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(self.transfer_id.as_bytes());
        hasher.update(self.source_chain.as_bytes());
        hasher.update(self.dest_chain.as_bytes());
        hasher.update(self.recipient.as_bytes());
        hasher.update(self.amount_flowers.to_le_bytes());
        hasher.update(self.fee_flowers.to_le_bytes());
        hasher.update(self.nonce.to_le_bytes());
        hasher.update(self.timestamp.to_le_bytes());
        hasher.update(self.deposit_proof_hash.as_bytes());
        hasher.finalize().to_vec()
    }
}

/// Instruction for the destination chain adapter to execute.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MintInstruction {
    pub dest_chain: String,
    pub recipient: String,
    pub amount_dest_atomic: u128,
    pub signatures: Vec<ValidatorSignature>,
    pub warp_message_hash: String,
}

/// A validator's signature on a WarpMessage.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatorSignature {
    pub validator_id: String,
    pub public_key: Vec<u8>,
    pub signature: Vec<u8>,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub warp_message_hash: String,
}

/// Parse a WARP memo string.
/// Format: `WARP:1:chain_name:destination_address`
pub fn parse_warp_memo(memo: &str) -> WarpResult<(String, String)> {
    let parts: Vec<&str> = memo.split(':').collect();
    if parts.len() < 4 {
        return Err(WarpError::InvalidMemo(format!(
            "Expected WARP:<ver>:<chain>:<addr>, got: {}",
            memo
        )));
    }
    if parts[0] != WARP_MEMO_PREFIX {
        return Err(WarpError::InvalidMemo(format!(
            "Memo must start with '{}', got: {}",
            WARP_MEMO_PREFIX, parts[0]
        )));
    }
    let version: u32 = parts[1]
        .parse()
        .map_err(|_| WarpError::InvalidMemo(format!("Invalid version: {}", parts[1])))?;
    if version != WARP_MEMO_VERSION {
        return Err(WarpError::InvalidMemo(format!(
            "Unsupported WARP version: {} (expected {})",
            version, WARP_MEMO_VERSION
        )));
    }
    let chain_name = parts[2].to_string();
    // Address may contain colons (e.g. in some chain formats)
    let address = parts[3..].join(":");
    if address.is_empty() {
        return Err(WarpError::InvalidMemo("Empty destination address".into()));
    }
    Ok((chain_name, address))
}

/// Build a WARP memo string.
pub fn build_warp_memo(chain_name: &str, address: &str) -> String {
    format!(
        "{}:{}:{}:{}",
        WARP_MEMO_PREFIX, WARP_MEMO_VERSION, chain_name, address
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_warp_memo_valid() {
        let (chain, addr) = parse_warp_memo("WARP:1:solana:7xKXtg2CW87d97T").unwrap();
        assert_eq!(chain, "solana");
        assert_eq!(addr, "7xKXtg2CW87d97T");
    }

    #[test]
    fn test_parse_warp_memo_evm() {
        let (chain, addr) = parse_warp_memo("WARP:1:base:0xAbCdEf1234567890").unwrap();
        assert_eq!(chain, "base");
        assert_eq!(addr, "0xAbCdEf1234567890");
    }

    #[test]
    fn test_parse_warp_memo_invalid_prefix() {
        assert!(parse_warp_memo("BRIDGE:1:base:0xabc").is_err());
    }

    #[test]
    fn test_parse_warp_memo_invalid_version() {
        assert!(parse_warp_memo("WARP:2:base:0xabc").is_err());
    }

    #[test]
    fn test_parse_warp_memo_too_short() {
        assert!(parse_warp_memo("WARP:1:base").is_err());
    }

    #[test]
    fn test_parse_warp_memo_empty_address() {
        assert!(parse_warp_memo("WARP:1:base:").is_err());
    }

    #[test]
    fn test_build_warp_memo() {
        let memo = build_warp_memo("solana", "7xKXtg2CW87d97T");
        assert_eq!(memo, "WARP:1:solana:7xKXtg2CW87d97T");
    }

    #[test]
    fn test_build_then_parse_roundtrip() {
        let memo = build_warp_memo("bitcoin", "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4");
        let (chain, addr) = parse_warp_memo(&memo).unwrap();
        assert_eq!(chain, "bitcoin");
        assert_eq!(addr, "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4");
    }

    #[test]
    fn test_warp_message_signing_hash_deterministic() {
        let msg = WarpMessage {
            transfer_id: Uuid::nil(),
            source_chain: "zion-l1".into(),
            dest_chain: "solana".into(),
            recipient: "7xKXtg".into(),
            amount_flowers: 1_000_000,
            fee_flowers: 1_500,
            nonce: 1,
            timestamp: 1700000000,
            deposit_proof_hash: "abc123".into(),
        };
        let h1 = msg.signing_hash();
        let h2 = msg.signing_hash();
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 32); // SHA-256
    }

    #[test]
    fn test_warp_message_different_amounts_different_hashes() {
        let msg1 = WarpMessage {
            transfer_id: Uuid::nil(),
            source_chain: "zion-l1".into(),
            dest_chain: "solana".into(),
            recipient: "addr".into(),
            amount_flowers: 1_000_000,
            fee_flowers: 0,
            nonce: 0,
            timestamp: 0,
            deposit_proof_hash: "".into(),
        };
        let mut msg2 = msg1.clone();
        msg2.amount_flowers = 2_000_000;
        assert_ne!(msg1.signing_hash(), msg2.signing_hash());
    }

    #[test]
    fn test_deposit_proof_serialization() {
        let proof = DepositProof {
            tx_hash: "abc".into(),
            block_height: 100,
            block_hash: "def".into(),
            sender: "zion1sender".into(),
            amount_flowers: 1_000_000,
            memo: "WARP:1:solana:addr".into(),
            confirmations: 60,
        };
        let json = serde_json::to_string(&proof).unwrap();
        let parsed: DepositProof = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.tx_hash, "abc");
        assert_eq!(parsed.amount_flowers, 1_000_000);
    }

    #[test]
    fn test_mint_instruction_serialization() {
        let inst = MintInstruction {
            dest_chain: "base".into(),
            recipient: "0xabc".into(),
            amount_dest_atomic: 1_000_000_000_000_000_000,
            signatures: vec![],
            warp_message_hash: "hash123".into(),
        };
        let json = serde_json::to_string(&inst).unwrap();
        assert!(json.contains("base"));
    }

    #[test]
    fn test_validator_signature_struct() {
        let sig = ValidatorSignature {
            validator_id: "v1".into(),
            public_key: vec![1, 2, 3],
            signature: vec![4, 5, 6],
            warp_message_hash: "abc".into(),
        };
        assert_eq!(sig.validator_id, "v1");
    }
}
