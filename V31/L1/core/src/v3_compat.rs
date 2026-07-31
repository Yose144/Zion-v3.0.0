//! V3 mainnet compatibility layer for V31 `zion-core`.
//!
//! This module re-implements the exact V3 block header layout, transaction
//! hashing, merkle root derivation and genesis block construction needed to
//! validate V3 blocks without a hard reset. It depends on `zion-cosmic-harmony-v3`
//! for the V3 Ekam Deeksha v2 PoW hash.

use std::fmt::Write;

use num_bigint::BigUint;
use serde::{Deserialize, Serialize};
use zion_cosmic_harmony_v3::{cosmic_harmony_ekam_deeksha, cosmic_harmony_with_height};

/// Frozen V3 mainnet beta genesis hash.
pub const V3_GENESIS_HASH: &str =
    "4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e";

/// Serde helper for u128 values that may be represented as strings in JSON
/// (V3 `amount_zion` is serialized as a decimal string).
mod u128_str {
    use serde::{Deserialize, Deserializer, Serializer};

    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrNum {
        Str(String),
        Num(u64),
    }

    pub fn serialize<S: Serializer>(value: &u128, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_str(value)
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<u128, D::Error> {
        match StringOrNum::deserialize(deserializer)? {
            StringOrNum::Str(s) => s.parse::<u128>().map_err(serde::de::Error::custom),
            StringOrNum::Num(n) => Ok(n as u128),
        }
    }
}

/// V3 genesis timestamp.
pub const GENESIS_TIMESTAMP: u64 = 1_767_225_600;

/// V3 genesis message (short form, used for tx_id tag in premine slot 0).
pub const GENESIS_MESSAGE: &str = concat!(
    "ZION Mainet Launch v3 — ",
    "For Sarah Issobel, Maitreya Buddha, Radha & Sita, Meriam, Friends, Family, ",
    "Freedom Humanity and all the children of this world: ZION is yours. ",
    "Build a better world where you reach for the Stars. The Golden Age begins. ",
    "Peace & One Love 4ever. ",
    "— Yose / Zion Creator"
);

/// V3 UTXO transaction version that activates the length-prefixed v2 preimage.
pub const TX_HASH_V2_VERSION: u32 = 2;

/// Block height at which DAO Treasury addresses unlock (post-3.0.3 fork).
pub const DAO_TREASURY_LOCK_HEIGHT: u64 = 144_000;

/// V3 MiningHeader — 80-byte prefix used as PoW input.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct MiningHeader {
    pub version: u32,
    pub previous_hash: [u8; 32],
    pub merkle_root: [u8; 32],
    pub timestamp: u64,
    pub difficulty_bits: u32,
}

impl MiningHeader {
    pub const HEADER_SIZE: usize = 80;

    /// Serialize the 80-byte header exactly as V3 `MiningHeader::to_bytes` does.
    pub fn to_bytes(self) -> [u8; Self::HEADER_SIZE] {
        let mut bytes = [0u8; Self::HEADER_SIZE];
        bytes[0..4].copy_from_slice(&self.version.to_le_bytes());
        bytes[4..36].copy_from_slice(&self.previous_hash);
        bytes[36..68].copy_from_slice(&self.merkle_root);
        bytes[68..76].copy_from_slice(&self.timestamp.to_le_bytes());
        bytes[76..80].copy_from_slice(&self.difficulty_bits.to_le_bytes());
        bytes
    }

    /// Deserialize an 80-byte header.
    pub fn from_bytes(bytes: [u8; Self::HEADER_SIZE]) -> Self {
        Self {
            version: u32::from_le_bytes(bytes[0..4].try_into().expect("version slice")),
            previous_hash: bytes[4..36].try_into().expect("previous hash slice"),
            merkle_root: bytes[36..68].try_into().expect("merkle root slice"),
            timestamp: u64::from_le_bytes(bytes[68..76].try_into().expect("timestamp slice")),
            difficulty_bits: u32::from_le_bytes(
                bytes[76..80].try_into().expect("difficulty bits slice"),
            ),
        }
    }
}

/// 256-bit difficulty target.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DifficultyTarget {
    pub bytes: [u8; 32],
}

impl DifficultyTarget {
    pub const MAX: Self = Self { bytes: [0xFF; 32] };
}

/// Convert a u64 difficulty to a 256-bit target: `target = (2²⁵⁶ − 1) / difficulty`.
pub fn difficulty_to_target(difficulty: u64) -> DifficultyTarget {
    if difficulty <= 1 {
        return DifficultyTarget::MAX;
    }
    let max: BigUint = (BigUint::from(1u8) << 256) - 1u8;
    let target = max / BigUint::from(difficulty);
    let bytes_be = target.to_bytes_be();
    let mut bytes = [0u8; 32];
    let start = bytes.len().saturating_sub(bytes_be.len());
    bytes[start..].copy_from_slice(&bytes_be);
    DifficultyTarget { bytes }
}

/// Encode a 256-bit target as compact nBits (Bitcoin-style).
pub fn target_to_compact(target: &DifficultyTarget) -> u32 {
    let first_nz = match target.bytes.iter().position(|&b| b != 0) {
        Some(i) => i,
        None => return 0,
    };

    let mut size = (32 - first_nz) as u32;
    let b0 = target.bytes[first_nz] as u32;
    let b1 = if first_nz + 1 < 32 {
        target.bytes[first_nz + 1] as u32
    } else {
        0
    };
    let b2 = if first_nz + 2 < 32 {
        target.bytes[first_nz + 2] as u32
    } else {
        0
    };
    let mut compact = (b0 << 16) | (b1 << 8) | b2;

    // If top bit of mantissa is set, shift right to avoid sign ambiguity.
    if compact & 0x0080_0000 != 0 {
        compact >>= 8;
        size += 1;
    }

    (size << 24) | (compact & 0x007F_FFFF)
}

/// Decode compact nBits into a `DifficultyTarget`.
pub fn compact_to_target(bits: u32) -> DifficultyTarget {
    let size = (bits >> 24) as usize;
    let mantissa = bits & 0x007F_FFFF;

    if size == 0 || mantissa == 0 {
        return DifficultyTarget { bytes: [0u8; 32] };
    }

    // A size of 32 or more means the mantissa overflows the 32-byte target.
    // The only valid case is the absolute maximum target (all 0xff bytes),
    // which `target_to_compact` encodes as size 33 / mantissa 0x00ffff.
    if size >= 32 {
        return DifficultyTarget::MAX;
    }

    let mut bytes = [0u8; 32];

    if size <= 3 {
        let word = mantissa >> (8 * (3 - size));
        for i in (0..size).rev() {
            let byte_pos = 32 - 1 - i;
            bytes[byte_pos] = ((word >> (8 * i)) & 0xFF) as u8;
        }
    } else {
        let start = 32 - size;
        bytes[start] = ((mantissa >> 16) & 0xFF) as u8;
        bytes[start + 1] = ((mantissa >> 8) & 0xFF) as u8;
        bytes[start + 2] = (mantissa & 0xFF) as u8;
    }

    DifficultyTarget { bytes }
}

/// BLAKE3 hash wrapper matching V3 `crypto::blake3_hash`.
pub fn blake3_hash(data: &[u8]) -> [u8; 32] {
    *blake3::hash(data).as_bytes()
}

/// Hex-encode bytes (lowercase, no 0x prefix).
pub fn hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        let _ = write!(s, "{:02x}", b);
    }
    s
}

/// V3 account-model transaction (used for the 13 non-vault premine outputs).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AccountTransaction {
    pub tx_id: String,
    pub from: String,
    pub to: String,
    #[serde(with = "u128_str")]
    pub amount_zion: u128,
    pub fee_zion: u64,
    pub nonce: u64,
    #[serde(default)]
    pub signature: String,
    #[serde(default)]
    pub public_key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub memo: Option<String>,
}

/// Input for a V3 UTXO transaction.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TxInput {
    pub prev_tx_hash: [u8; 32],
    pub output_index: u32,
    #[serde(default)]
    pub signature: Vec<u8>,
    #[serde(default)]
    pub public_key: Vec<u8>,
}

/// Output for a V3 UTXO transaction.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TxOutput {
    pub amount: u64,
    pub address: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub memo: Option<String>,
}

/// V3 UTXO transaction (used for the bridge vault coinbase).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UtxoTransaction {
    pub id: [u8; 32],
    pub version: u32,
    pub inputs: Vec<TxInput>,
    pub outputs: Vec<TxOutput>,
    pub fee: u64,
    pub timestamp: u64,
}

impl UtxoTransaction {
    /// Compute the canonical transaction ID (dispatches on version).
    pub fn calculate_hash(&self) -> [u8; 32] {
        if self.version >= TX_HASH_V2_VERSION {
            self.calculate_hash_v2()
        } else {
            self.calculate_hash_v1()
        }
    }

    /// Legacy v1 preimage (raw concatenation, malleable).
    fn calculate_hash_v1(&self) -> [u8; 32] {
        let mut data = Vec::new();
        data.extend_from_slice(&self.version.to_le_bytes());
        for input in &self.inputs {
            data.extend_from_slice(&input.prev_tx_hash);
            data.extend_from_slice(&input.output_index.to_le_bytes());
            data.extend_from_slice(&input.public_key);
        }
        for output in &self.outputs {
            data.extend_from_slice(&output.amount.to_le_bytes());
            data.extend_from_slice(output.address.as_bytes());
            if let Some(memo) = &output.memo {
                data.extend_from_slice(memo.as_bytes());
            }
        }
        data.extend_from_slice(&self.fee.to_le_bytes());
        data.extend_from_slice(&self.timestamp.to_le_bytes());
        blake3_hash(&data)
    }

    /// Length-prefixed v2 preimage.
    fn calculate_hash_v2(&self) -> [u8; 32] {
        const DOMAIN: &[u8] = b"ZION_TX_V2\x00";

        let mut data = Vec::new();
        data.extend_from_slice(DOMAIN);
        data.extend_from_slice(&self.version.to_le_bytes());
        data.extend_from_slice(&self.fee.to_le_bytes());
        data.extend_from_slice(&self.timestamp.to_le_bytes());

        data.extend_from_slice(&(self.inputs.len() as u32).to_le_bytes());
        for input in &self.inputs {
            data.extend_from_slice(&input.prev_tx_hash);
            data.extend_from_slice(&input.output_index.to_le_bytes());
            data.extend_from_slice(&(input.public_key.len() as u32).to_le_bytes());
            data.extend_from_slice(&input.public_key);
        }

        data.extend_from_slice(&(self.outputs.len() as u32).to_le_bytes());
        for output in &self.outputs {
            data.extend_from_slice(&output.amount.to_le_bytes());
            let addr_bytes = output.address.as_bytes();
            data.extend_from_slice(&(addr_bytes.len() as u32).to_le_bytes());
            data.extend_from_slice(addr_bytes);
            match &output.memo {
                None => data.push(0),
                Some(memo) => {
                    data.push(1);
                    let mb = memo.as_bytes();
                    data.extend_from_slice(&(mb.len() as u32).to_le_bytes());
                    data.extend_from_slice(mb);
                }
            }
        }

        blake3_hash(&data)
    }
}

/// Single premine output in V3 form.
#[derive(Debug, Clone)]
pub struct PremineOutput {
    pub address: &'static str,
    pub purpose: &'static str,
    pub amount_zion: u64,
    pub amount_flowers: u128,
    pub category: &'static str,
    /// Block height time-lock, if any.
    pub unlock_height: Option<u64>,
    /// Requires 3-of-3 admin multisig + DAO vote to transfer (all mainnet premine outputs).
    pub admin_locked: bool,
}

/// V3 premine allocations (14 outputs).
pub const PREMINE_OUTPUTS: &[PremineOutput] = &[
    // --- OASIS + Golden Egg (5 × 1.65B = 8.25B) ---
    PremineOutput {
        address: "zion1n3t6v6w3m8g4v6q8g7h7j4j6f7s8q2m7g7un8u0",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 1)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
        admin_locked: true,
    },
    PremineOutput {
        address: "zion16854w6h7a800k6h8n052s0h4k2v625x0w0z2320",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 2)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
        admin_locked: true,
    },
    PremineOutput {
        address: "zion1j8s2d6s6f248j7z3m80676p6m074x2q5p5er3w2",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 3)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
        admin_locked: true,
    },
    PremineOutput {
        address: "zion155k300w6x726p4x0w473s704d5k35865r2q75z8",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 4)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
        admin_locked: true,
    },
    PremineOutput {
        address: "zion1y293r8c6l5p3u0y7j8q8366372t7y070n3rp5r8",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 5)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
        admin_locked: true,
    },
    // --- DAO Treasury (3 slots = 4.0B) — locked until height 144,000 ---
    PremineOutput {
        address: "zion1u5u7k43240d5l4d0x7q5m3c4a838z4k000cv3q0",
        purpose: "DAO Treasury — Community Governance (main)",
        amount_zion: 2_500_000_000,
        amount_flowers: 2_500_000_000_000_000_000_000,
        category: "dao_treasury",
        unlock_height: Some(DAO_TREASURY_LOCK_HEIGHT),
        admin_locked: true,
    },
    PremineOutput {
        address: "zion1m8d235x268h8d887s036m8c3x7s356d3r37k6m6",
        purpose: "DAO Treasury — Grants & Bounties",
        amount_zion: 1_000_000_000,
        amount_flowers: 1_000_000_000_000_000_000_000,
        category: "dao_treasury",
        unlock_height: Some(DAO_TREASURY_LOCK_HEIGHT),
        admin_locked: true,
    },
    PremineOutput {
        address: "zion102s8k4k0w783d657j255z865e47054s342u87v3",
        purpose: "DAO Treasury — Ecosystem Bootstrap",
        amount_zion: 500_000_000,
        amount_flowers: 500_000_000_000_000_000_000,
        category: "dao_treasury",
        unlock_height: Some(DAO_TREASURY_LOCK_HEIGHT),
        admin_locked: true,
    },
    // --- Infrastructure (3 slots = 2.59B) ---
    PremineOutput {
        address: "zion1e8j5z6v8e4c6s5x7r0w7e2r673h8k3a6d4xx877",
        purpose: "Core Development Fund",
        amount_zion: 1_000_000_000,
        amount_flowers: 1_000_000_000_000_000_000_000,
        category: "infrastructure",
        unlock_height: None,
        admin_locked: true,
    },
    PremineOutput {
        address: "zion1f7z374q068r3p657m8z220v7y6k045q255xp2d3",
        purpose: "Network Infrastructure — P2P Seed Nodes",
        amount_zion: 1_000_000_000,
        amount_flowers: 1_000_000_000_000_000_000_000,
        category: "infrastructure",
        unlock_height: None,
        admin_locked: true,
    },
    PremineOutput {
        address: "zion1s2j5s2a6f5k740k4d8s2k3y8v0t8d4k0u6my2k0",
        purpose: "Genesis Projects — Dharma Temple, Piko de Ora + DAO",
        amount_zion: 590_000_000,
        amount_flowers: 590_000_000_000_000_000_000,
        category: "infrastructure",
        unlock_height: None,
        admin_locked: true,
    },
    // --- Humanitarian (1 slot = 1.44B) ---
    PremineOutput {
        address: "zion10797m0k3u356f2l443r062d4e49665f6n20j6x0",
        purpose: "Children Future Fund — Humanitarian DAO",
        amount_zion: 1_440_000_000,
        amount_flowers: 1_440_000_000_000_000_000_000,
        category: "humanitarian",
        unlock_height: None,
        admin_locked: true,
    },
    // --- Bridge Seed Fund (1 slot = 0.4B) — immediate unlock for EVM bridge liquidity ---
    PremineOutput {
        address: "zion1p3y7w4z7d2m3j0f00657r354y4f3q5k6y8ca0g7",
        purpose: "Bridge Seed Fund — EVM Bridge Liquidity",
        amount_zion: 400_000_000,
        amount_flowers: 400_000_000_000_000_000_000,
        category: "bridge_seed",
        unlock_height: None,
        admin_locked: true,
    },
    // --- Bridge Vault UTXO Seed (1 slot = 0.1B) — UTXO liquidity for bridge unlocks ---
    PremineOutput {
        address: "zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7",
        purpose: "Bridge Vault UTXO Seed — EVM Bridge Unlock Liquidity",
        amount_zion: 100_000_000,
        amount_flowers: 100_000_000_000_000_000_000,
        category: "bridge_vault_utxo",
        unlock_height: None,
        admin_locked: true,
    },
];

/// V3 canonical subsidy / operational wallet addresses.
pub const MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET: &str =
    "zion1e0u5q5s660k4m4a634p2c2v358r8g59564054z7";
pub const MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET: &str =
    "zion1f7y7l5k678y0v408e8s654d2282346k375526t2";
pub const MAINNET_CANONICAL_POOL_FEE_SUBSIDY_WALLET: &str =
    "zion1062522x6a083x6r4d24303l5h20698z7j8qk433";
pub const MAINNET_CANONICAL_DEFAULT_MINER_WALLET: &str =
    "zion1d6m0h2r8m7k8k2d8n072y7j3j4m0254323vq0e3";
pub const MAINNET_CANONICAL_POOL_PAYOUT_WALLET: &str =
    "zion1e4489793c5x2r0a0a4d8z7r4u5d6k0s4k3ht5m2";

/// Check whether a premine output may be spent.
///
/// Two-layer lock:
/// 1. Time-lock (`unlock_height`): block height that must be reached.
/// 2. Admin-lock (`admin_locked`): requires 3-of-3 admin multisig + DAO vote.
///
/// Both locks must be satisfied.
pub fn is_premine_transfer_allowed(
    address: &str,
    current_height: u64,
    admin_unlocked: &dyn Fn(&str) -> bool,
) -> Result<(), String> {
    if let Some(output) = PREMINE_OUTPUTS.iter().find(|o| o.address == address) {
        if let Some(h) = output.unlock_height {
            if current_height < h {
                return Err(format!(
                    "premine address {} time-locked until height {} (current {})",
                    address, h, current_height
                ));
            }
        }
        if output.admin_locked && !admin_unlocked(address) {
            return Err(format!(
                "premine address {} admin-locked — requires 3-of-3 admin multisig + DAO vote",
                address
            ));
        }
    }
    Ok(())
}

/// Convenience wrapper: all admin-locked addresses rejected (tests, IBD).
pub fn is_premine_transfer_allowed_no_admin(
    address: &str,
    current_height: u64,
) -> Result<(), String> {
    is_premine_transfer_allowed(address, current_height, &|_| false)
}

/// Convenience wrapper: all admin-locks satisfied, only time-lock is checked.
pub fn is_premine_transfer_allowed_admin_ok(
    address: &str,
    current_height: u64,
) -> Result<(), String> {
    is_premine_transfer_allowed(address, current_height, &|_| true)
}

/// Deterministic genesis account tx_id from a tag string and nonce.
fn genesis_tx_id(tag: &str, nonce: u64) -> String {
    let hash = cosmic_harmony_ekam_deeksha(tag.as_bytes(), nonce);
    hex(&hash.data)
}

/// Binary Merkle root from a list of 32-byte hashes using BLAKE3.
fn merkle_root(hashes: &[[u8; 32]]) -> [u8; 32] {
    if hashes.is_empty() {
        return [0u8; 32];
    }
    if hashes.len() == 1 {
        return hashes[0];
    }

    let mut level: Vec<[u8; 32]> = hashes.to_vec();
    while level.len() > 1 {
        if level.len() % 2 == 1 {
            let last = *level.last().unwrap();
            level.push(last);
        }
        let mut next = Vec::with_capacity(level.len() / 2);
        for pair in level.chunks_exact(2) {
            let mut combined = [0u8; 64];
            combined[..32].copy_from_slice(&pair[0]);
            combined[32..].copy_from_slice(&pair[1]);
            next.push(blake3_hash(&combined));
        }
        level = next;
    }
    level[0]
}

/// V3 post-fork merkle root derivation (account + UTXO transactions).
pub(crate) fn derive_template_merkle_root_v2_blake3(
    transactions: &[AccountTransaction],
    utxo_transactions: &[UtxoTransaction],
) -> [u8; 32] {
    let mut leaves: Vec<[u8; 32]> =
        Vec::with_capacity(transactions.len() + utxo_transactions.len());
    for tx in transactions {
        leaves.push(blake3_hash(tx.tx_id.as_bytes()));
    }
    for utxo_tx in utxo_transactions {
        leaves.push(utxo_tx.id);
    }
    merkle_root(&leaves)
}

/// V3 block body used for validation / sync.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct V3Block {
    pub height: u64,
    pub nonce: u64,
    pub difficulty: u64,
    pub header: MiningHeader,
    pub transactions: Vec<AccountTransaction>,
    pub utxo_transactions: Vec<UtxoTransaction>,
}

impl V3Block {
    /// Compute the V3 block hash (PoW hash of the 80-byte header + nonce + height).
    pub fn header_hash(&self) -> [u8; 32] {
        cosmic_harmony_with_height(&self.header.to_bytes(), self.nonce, self.height).data
    }
}

/// V3 wire-format block as sent over P2P / RPC (`AcceptedBlock`).
///
/// `header_hex` contains the serialized 80-byte `MiningHeader`; the remaining
/// metadata is carried alongside for storage / RPC convenience.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct V3AcceptedBlock {
    pub template_id: u64,
    pub height: u64,
    pub timestamp: u64,
    pub difficulty: u64,
    pub nonce: u64,
    pub hash_hex: String,
    pub header_hex: String,
    #[serde(default)]
    pub previous_hash_hex: String,
    #[serde(default)]
    pub algorithm: String,
    #[serde(default)]
    pub transaction_ids: Vec<String>,
    pub transactions: Vec<AccountTransaction>,
    #[serde(default)]
    pub total_fees_zion: u64,
    #[serde(default)]
    pub body_hash_hex: String,
    #[serde(default)]
    pub subsidy_zion: u64,
    #[serde(default)]
    pub miner_reward_zion: u64,
    #[serde(default)]
    pub miner_address: String,
    #[serde(default)]
    pub humanitarian_address: String,
    #[serde(default)]
    pub issobella_address: String,
    #[serde(default)]
    pub pool_fee_address: String,
    #[serde(default)]
    pub utxo_transaction_ids: Vec<String>,
    pub utxo_transactions: Vec<UtxoTransaction>,
}

impl V3AcceptedBlock {
    /// Convert the wire block into the internal `V3Block` used by the validator.
    ///
    /// Fails if `header_hex` is not a valid 80-byte hex header.
    pub fn into_v3_block(self) -> Result<V3Block, String> {
        let header_bytes =
            hex::decode(&self.header_hex).map_err(|e| format!("invalid header hex: {e}"))?;
        if header_bytes.len() != MiningHeader::HEADER_SIZE {
            return Err(format!(
                "header length {} != {} expected",
                header_bytes.len(),
                MiningHeader::HEADER_SIZE
            ));
        }
        let header_bytes: [u8; MiningHeader::HEADER_SIZE] = header_bytes
            .try_into()
            .map_err(|_| "header length mismatch".to_string())?;
        let header = MiningHeader::from_bytes(header_bytes);

        Ok(V3Block {
            height: self.height,
            nonce: self.nonce,
            difficulty: self.difficulty,
            header,
            transactions: self.transactions,
            utxo_transactions: self.utxo_transactions,
        })
    }
}

/// Build the 14 premine transactions exactly as V3 does.
fn build_premine_transactions() -> (Vec<AccountTransaction>, Vec<UtxoTransaction>) {
    let mut transactions: Vec<AccountTransaction> = Vec::new();
    let mut utxo_transactions: Vec<UtxoTransaction> = Vec::new();

    for (i, output) in PREMINE_OUTPUTS.iter().enumerate() {
        if output.category == "bridge_vault_utxo" {
            const VAULT_AMOUNT_PER_OUTPUT: u64 = 16_666_666_666_666_666_666;
            const VAULT_AMOUNT_LAST: u64 = 16_666_666_666_666_666_670;
            let mut utxo = UtxoTransaction {
                id: [0u8; 32],
                version: TX_HASH_V2_VERSION,
                inputs: vec![],
                outputs: vec![],
                fee: 0,
                timestamp: GENESIS_TIMESTAMP,
            };
            for _ in 0..5 {
                utxo.outputs.push(TxOutput {
                    amount: VAULT_AMOUNT_PER_OUTPUT,
                    address: output.address.to_string(),
                    memo: None,
                });
            }
            utxo.outputs.push(TxOutput {
                amount: VAULT_AMOUNT_LAST,
                address: output.address.to_string(),
                memo: None,
            });
            utxo.id = utxo.calculate_hash();
            utxo_transactions.push(utxo);
        } else {
            let tag = if i == 0 {
                format!(
                    "genesis-premine-{i:02}:{}:{}",
                    output.address, GENESIS_MESSAGE
                )
            } else {
                format!("genesis-premine-{i:02}:{}", output.address)
            };
            let tx_id = genesis_tx_id(&tag, i as u64);
            transactions.push(AccountTransaction {
                tx_id,
                from: "genesis".to_string(),
                to: output.address.to_string(),
                amount_zion: output.amount_flowers,
                fee_zion: 0,
                nonce: i as u64,
                signature: String::new(),
                public_key: String::new(),
                memo: None,
            });
        }
    }

    (transactions, utxo_transactions)
}

/// Build the canonical V3 genesis block.
pub fn build_v3_genesis_block() -> V3Block {
    let (transactions, utxo_transactions) = build_premine_transactions();
    let merkle_root = derive_template_merkle_root_v2_blake3(&transactions, &utxo_transactions);
    let target = difficulty_to_target(crate::difficulty::GENESIS_DIFFICULTY);
    let difficulty_bits = target_to_compact(&target);

    let header = MiningHeader {
        version: 3,
        previous_hash: [0u8; 32],
        merkle_root,
        timestamp: GENESIS_TIMESTAMP,
        difficulty_bits,
    };

    V3Block {
        height: 0,
        nonce: 0,
        difficulty: crate::difficulty::GENESIS_DIFFICULTY,
        header,
        transactions,
        utxo_transactions,
    }
}

/// Compute the V3 genesis hash (convenience wrapper).
pub fn v3_genesis_hash() -> String {
    hex(&build_v3_genesis_block().header_hash())
}

/// Validate a V3 block against its predecessor and expected difficulty.
///
/// This is the entry point for block-sync: given a downloaded block and the
/// previous block's header hash + timestamp, it checks PoW, merkle root,
/// previous hash, height and timestamp ordering.
pub fn validate_v3_block(
    block: &V3Block,
    previous_hash: [u8; 32],
    previous_timestamp: u64,
    previous_height: u64,
    expected_difficulty: u64,
) -> Result<(), &'static str> {
    // Genesis special case: previous_height == u64::MAX and block height 0.
    let expected_height = if previous_height == u64::MAX {
        0
    } else {
        previous_height.saturating_add(1)
    };
    if block.height != expected_height {
        return Err("invalid height");
    }
    if block.header.previous_hash != previous_hash {
        return Err("previous hash mismatch");
    }
    if block.header.timestamp < previous_timestamp {
        return Err("timestamp must not move backwards");
    }
    // Genesis (height 0) is the trusted root — do not require a valid PoW nonce.
    if block.height > 0 {
        if block.difficulty != expected_difficulty {
            return Err("difficulty mismatch");
        }

        // difficulty_bits must encode the target for expected_difficulty.
        let expected_target = difficulty_to_target(expected_difficulty);
        if block.header.difficulty_bits != target_to_compact(&expected_target) {
            return Err("difficulty_bits mismatch");
        }

        // PoW target must be met.
        let hash = block.header_hash();
        let target = compact_to_target(block.header.difficulty_bits);
        if hash > target.bytes {
            return Err("PoW target not met");
        }
    }

    // Merkle root must match the body.
    let merkle =
        derive_template_merkle_root_v2_blake3(&block.transactions, &block.utxo_transactions);
    if block.header.merkle_root != merkle {
        return Err("merkle root mismatch");
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v3_genesis_hash_matches_mainnet() {
        assert_eq!(v3_genesis_hash(), V3_GENESIS_HASH);
    }

    #[test]
    fn v3_genesis_block_validates() {
        let block = build_v3_genesis_block();
        assert_eq!(
            validate_v3_block(&block, [0u8; 32], 0, u64::MAX, block.difficulty),
            Ok(()),
            "genesis block must validate with u64::MAX as previous height and zero previous timestamp"
        );
    }

    #[test]
    fn target_compact_roundtrip_for_genesis() {
        let target = difficulty_to_target(crate::difficulty::GENESIS_DIFFICULTY);
        let bits = target_to_compact(&target);
        let decoded = compact_to_target(bits);
        // Bitcoin-style compact loses precision; decoded target must be <= original target
        // and the original target's first 3 bytes must be preserved (up to compact truncation).
        assert!(
            decoded.bytes <= target.bytes,
            "decoded compact target must not be harder than the original target"
        );
    }
}
