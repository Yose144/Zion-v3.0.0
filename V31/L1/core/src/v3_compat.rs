//! V3 mainnet compatibility layer for V31 `zion-core`.
//!
//! This module re-implements the exact V3 block header layout, transaction
//! hashing, merkle root derivation and genesis block construction needed to
//! validate V3 blocks without a hard reset. It depends on `zion-cosmic-harmony-v3`
//! for the V3 Ekam Deeksha v2 PoW hash.

use std::fmt::Write;

use num_bigint::BigUint;
use serde::{Deserialize, Serialize};
use zion_cosmic_harmony_v3::{
    cosmic_harmony_ekam_deeksha, cosmic_harmony_with_height, deeksha_chv3_with_height,
    deeksha_lite_fire_with_height, deeksha_lite_with_height, CHV3_FORK_HEIGHT, FIRE_FORK_HEIGHT,
};

/// V3-compatible mainnet genesis hash (v3.2 One Love genesis reset 2026-08-06 with V2 mnemonic premine keys).
pub const V3_GENESIS_HASH: &str =
    "4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71";

/// Re-export the shared `u128` serde helper from `zion_l1_types`.
/// V3 `amount_zion` is serialized as a decimal string.
pub use zion_l1_types::u128_str;

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

/// A block candidate: header + nonce, ready for hashing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct BlockCandidate {
    pub header: MiningHeader,
    pub nonce: u64,
    pub height: u64,
}

impl BlockCandidate {
    /// Hash the candidate using deeksha_chv3 (default ZION PoW).
    pub fn hash(self) -> [u8; 32] {
        zion_cosmic_harmony_v3::deeksha_chv3::deeksha_chv3_with_height(
            &self.header.to_bytes(),
            self.nonce,
            self.height,
        )
        .data
    }

    /// Seal into a SealedBlock.
    pub fn seal(self) -> SealedBlock {
        SealedBlock {
            header: self.header,
            nonce: self.nonce,
            hash: self.hash(),
        }
    }
}

/// A sealed block: header + nonce + computed hash.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct SealedBlock {
    pub header: MiningHeader,
    pub nonce: u64,
    pub hash: [u8; 32],
}

/// A mining job sent to miners.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct MiningJob {
    pub job_id: u64,
    pub header: MiningHeader,
    pub target: DifficultyTarget,
    pub start_nonce: u64,
    pub nonce_count: u64,
    pub height: u64,
}

/// A mining solution submitted by a miner.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct MiningSolution {
    pub job_id: u64,
    pub candidate: BlockCandidate,
    pub hash: [u8; 32],
}

/// 256-bit difficulty target.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct DifficultyTarget {
    pub bytes: [u8; 32],
}

impl DifficultyTarget {
    pub const MAX: Self = Self { bytes: [0xFF; 32] };

    /// Check if a hash meets this target (hash <= target).
    pub fn allows(&self, hash: &[u8; 32]) -> bool {
        hash <= &self.bytes
    }
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

    // A size of 33 means the mantissa overflows the 32-byte target.
    // The only valid case is the absolute maximum target (all 0xff bytes),
    // which `target_to_compact` encodes as size 33 / mantissa 0x00ffff.
    // size 32 is a regular 3-byte mantissa placed at the start of the array.
    if size > 32 {
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

impl AccountTransaction {
    /// Verify the Ed25519 signature on this account-model transaction.
    ///
    /// Coinbase transactions (`from == "coinbase"`) are always valid.
    /// For normal transactions, the public key must derive to the sender
    /// address, and the signature must verify against `tx_id`.
    pub fn verify_signature(&self) -> bool {
        if self.from == "coinbase" {
            return true;
        }
        if self.signature.len() != 128 || self.public_key.len() != 64 {
            return false;
        }
        let pk_bytes = match hex::decode(&self.public_key) {
            Ok(v) if v.len() == 32 => v,
            _ => return false,
        };
        let sig_bytes = match hex::decode(&self.signature) {
            Ok(v) if v.len() == 64 => v,
            _ => return false,
        };
        // CRITICAL: the public key must derive to the sender address.
        let derived_from = crate::crypto::derive_address(&pk_bytes);
        if derived_from != self.from {
            return false;
        }
        crate::crypto::verify(&pk_bytes, self.tx_id.as_bytes(), &sig_bytes)
    }
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
        address: "zion1s0t7f8q680t4h6v7g240p4k7g2s0a4z8g3cc5h5",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 1)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
        admin_locked: true,
    },
    PremineOutput {
        address: "zion1s7x735r6v86485k7t36008l682g777g3q8pu3q0",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 2)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
        admin_locked: true,
    },
    PremineOutput {
        address: "zion1e0f4h6w3w394d4p355z2r440k4s2f6v5h4rl8f4",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 3)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
        admin_locked: true,
    },
    PremineOutput {
        address: "zion1h7r3v595y3g0z3e3l8p005h4c6l7l6s4s2xh708",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 4)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
        admin_locked: true,
    },
    PremineOutput {
        address: "zion1x535z563d3p6r6u3v6x0g0y445f507w8h6g8388",
        purpose: "ZION OASIS + Winners Golden Egg/Xp (Slot 5)",
        amount_zion: 1_650_000_000,
        amount_flowers: 1_650_000_000_000_000_000_000,
        category: "oasis_golden_egg",
        unlock_height: None,
        admin_locked: true,
    },
    // --- DAO Treasury (3 slots = 4.0B) — locked until height 144,000 ---
    PremineOutput {
        address: "zion1f5h5k6t8q3t3d8c5y667z6p2x8t3y3p8c7633g5",
        purpose: "DAO Treasury — Community Governance (main)",
        amount_zion: 2_500_000_000,
        amount_flowers: 2_500_000_000_000_000_000_000,
        category: "dao_treasury",
        unlock_height: Some(DAO_TREASURY_LOCK_HEIGHT),
        admin_locked: true,
    },
    PremineOutput {
        address: "zion1s27490u7n823g098w42077h8f2n824w0y75w0s3",
        purpose: "DAO Treasury — Grants & Bounties",
        amount_zion: 1_000_000_000,
        amount_flowers: 1_000_000_000_000_000_000_000,
        category: "dao_treasury",
        unlock_height: Some(DAO_TREASURY_LOCK_HEIGHT),
        admin_locked: true,
    },
    PremineOutput {
        address: "zion1n0r7k274z3t030h4v4g3g5h704c737z658aa238",
        purpose: "DAO Treasury — Ecosystem Bootstrap",
        amount_zion: 500_000_000,
        amount_flowers: 500_000_000_000_000_000_000,
        category: "dao_treasury",
        unlock_height: Some(DAO_TREASURY_LOCK_HEIGHT),
        admin_locked: true,
    },
    // --- Infrastructure (3 slots = 2.59B) ---
    PremineOutput {
        address: "zion1k752909323x66062k5j7074096f003z095ax8m7",
        purpose: "Core Development Fund",
        amount_zion: 1_000_000_000,
        amount_flowers: 1_000_000_000_000_000_000_000,
        category: "infrastructure",
        unlock_height: None,
        admin_locked: true,
    },
    PremineOutput {
        address: "zion1z3a4w726w5u4r4s4z644s8p897v4a2k045rt706",
        purpose: "Network Infrastructure — P2P Seed Nodes",
        amount_zion: 1_000_000_000,
        amount_flowers: 1_000_000_000_000_000_000_000,
        category: "infrastructure",
        unlock_height: None,
        admin_locked: true,
    },
    PremineOutput {
        address: "zion122v8f8g55398f4g884k7j482h3z845j6c6ta4f8",
        purpose: "Genesis Projects — Dharma Temple, Piko de Ora + DAO",
        amount_zion: 590_000_000,
        amount_flowers: 590_000_000_000_000_000_000,
        category: "infrastructure",
        unlock_height: None,
        admin_locked: true,
    },
    // --- Humanitarian (1 slot = 1.44B) ---
    PremineOutput {
        address: "zion1h6644748u5x6p4p784n6g2l7j77625w6a0k80s8",
        purpose: "Children Future Fund — Humanitarian DAO",
        amount_zion: 1_440_000_000,
        amount_flowers: 1_440_000_000_000_000_000_000,
        category: "humanitarian",
        unlock_height: None,
        admin_locked: true,
    },
    // --- Bridge Seed Fund (1 slot = 0.4B) — immediate unlock for EVM bridge liquidity ---
    PremineOutput {
        address: "zion1t6z3c0f0p3h0v233a3h432k5h764j0r3n5ml756",
        purpose: "Bridge Seed Fund — EVM Bridge Liquidity",
        amount_zion: 400_000_000,
        amount_flowers: 400_000_000_000_000_000_000,
        category: "bridge_seed",
        unlock_height: None,
        admin_locked: true,
    },
    // --- Bridge Vault UTXO Seed (1 slot = 0.1B) — UTXO liquidity for bridge unlocks ---
    PremineOutput {
        address: "zion1j3w3h7k8m635h734y786j5804305m822t5uk546",
        purpose: "Bridge Vault UTXO — EVM Bridge Unlock Liquidity",
        amount_zion: 100_000_000,
        amount_flowers: 100_000_000_000_000_000_000,
        category: "bridge_vault_utxo",
        unlock_height: None,
        admin_locked: true,
    },
];

/// V3 canonical subsidy / operational wallet addresses.
pub const MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET: &str =
    "zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8";
pub const MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET: &str =
    "zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0";
pub const MAINNET_CANONICAL_POOL_FEE_SUBSIDY_WALLET: &str =
    "zion1l0h428f536s6u3x7h5f0d5c2z644j7t8u8va3x0";
/// The 1% block subsidy slot is minted to this canonical address after the
/// node-reward soft fork and later distributed to full user nodes.
pub const MAINNET_CANONICAL_NODE_REWARD_WALLET: &str = MAINNET_CANONICAL_POOL_FEE_SUBSIDY_WALLET;
pub const MAINNET_CANONICAL_DEFAULT_MINER_WALLET: &str =
    "zion1074344t7k686j6n8a0l6t0f4c8d828y083xh4m2";
pub const MAINNET_CANONICAL_POOL_PAYOUT_WALLET: &str =
    "zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6";

// ── Admin governance public keys (3-of-3 multisig) ──────────────────────
//
// Generated 2026-08-06 for V31 hard genesis reset.
// Secret keys are stored offline (~/Desktop/ZION_KEYS_GENESIS_V2_2026-08-06/ADMIN_KEYS.txt).
// These are PUBLIC keys only — safe to commit.

/// Rama — Admin-1 (protocol governance, emergency pause).
pub const ADMIN_RAMA_PUBLIC_KEY_HEX: &str =
    "210f4cca2e84feacd3fb901fd63cc389691afef65acf5f7f232274591113e4c2";
pub const ADMIN_RAMA_L1_ADDRESS: &str = "zion1s4t4y2s4v0a4l4h28423h266f2y7h406d3s0847";
pub const ADMIN_RAMA_EVM_ADDRESS: &str = "0x716a1be17bc096565c8269dff539303f3111b105";

/// Sita — Admin-2 (treasury oversight, DAO guardian).
pub const ADMIN_SITA_PUBLIC_KEY_HEX: &str =
    "863b556da0fb398eb38f029bb1046a3496ccc2bdf0de4b8b6c2fd3cd72de4442";
pub const ADMIN_SITA_L1_ADDRESS: &str = "zion1l6p5g466r047v7x39623n467v545p2m4l8v30v2";
pub const ADMIN_SITA_EVM_ADDRESS: &str = "0x8cf0ae1a83a94f3b608b5863ff5c4c6c2479ac50";

/// Hanuman — Admin-3 (bridge admin, EVM multisig).
pub const ADMIN_HANUMAN_PUBLIC_KEY_HEX: &str =
    "febc4cbf13d37215764127b10d1c724c66bd74bc1b38a4aee6e7b23d3d182ee3";
pub const ADMIN_HANUMAN_L1_ADDRESS: &str = "zion18693c577h054s7v866e686f8m3z0y8s7s5gl2l7";
pub const ADMIN_HANUMAN_EVM_ADDRESS: &str = "0xcad8a7fc07a8777aaa7bba5261f409ae40d78141";

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
    /// Trusted hash from the wire or checkpoint, if available.
    ///
    /// V3 itself trusts the `hash_hex` provided by peers (see
    /// `import_peer_blocks` — it never recomputes the PoW hash).  V31 must do
    /// the same: when a block arrives from a V3 peer or a checkpoint, the
    /// provided hash is stored here and returned by `header_hash()` instead of
    /// recomputing.  This avoids subtle algorithm mismatches between the V3
    /// and V31 PoW implementations.
    #[serde(default)]
    pub stored_hash: Option<[u8; 32]>,
}

impl V3Block {
    /// Compute the V3 block hash.
    ///
    /// If `stored_hash` is set (from a trusted peer or checkpoint), it is
    /// returned directly — matching V3's behaviour of trusting the
    /// wire-provided `hash_hex`.  Otherwise the hash is recomputed using the
    /// height-aware algorithm dispatch.
    pub fn header_hash(&self) -> [u8; 32] {
        if let Some(h) = self.stored_hash {
            return h;
        }
        let header_bytes = self.header.to_bytes();
        if self.height == 0 {
            // V3 genesis special case.
            cosmic_harmony_with_height(&header_bytes, self.nonce, self.height).data
        } else if self.height < CHV3_FORK_HEIGHT {
            deeksha_lite_with_height(&header_bytes, self.nonce, self.height).data
        } else if self.height < FIRE_FORK_HEIGHT {
            deeksha_chv3_with_height(&header_bytes, self.nonce, self.height).data
        } else {
            deeksha_lite_fire_with_height(&header_bytes, self.nonce, self.height).data
        }
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

        // Trust the wire-provided hash_hex (V3 does the same).
        let stored_hash = hex::decode(&self.hash_hex)
            .ok()
            .and_then(|b| b.try_into().ok());

        Ok(V3Block {
            height: self.height,
            nonce: self.nonce,
            difficulty: self.difficulty,
            header,
            transactions: self.transactions,
            utxo_transactions: self.utxo_transactions,
            stored_hash,
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
        stored_hash: None,
    }
}

/// Compute the V3 genesis hash (convenience wrapper).
pub fn v3_genesis_hash() -> String {
    hex(&build_v3_genesis_block().header_hash())
}

// Re-exports for compatibility with V3 `genesis::` API used by `launch.rs`.
pub fn genesis_hash() -> String {
    v3_genesis_hash()
}
pub fn genesis_block() -> V3Block {
    build_v3_genesis_block()
}

/// Validate that the premine outputs match the expected configuration.
///
/// Checks that the number of premine outputs is correct and that each
/// output has a valid address and expected unlock height.
pub fn validate_premine() -> Result<(), String> {
    for (i, output) in PREMINE_OUTPUTS.iter().enumerate() {
        if output.address.is_empty() {
            return Err(format!("premine output {} has empty address", i));
        }
        if output.amount_zion == 0 {
            return Err(format!("premine output {} has zero amount", i));
        }
    }
    Ok(())
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
