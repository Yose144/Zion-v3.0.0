//! True AuxPoW validator (POC).
//!
//! Verifies that an auxiliary chain block hash is committed inside a parent
//! chain block header and that the parent header satisfies its own PoW target.
//!
//! This is a standalone proof-of-concept.  Full consensus integration (new
//! ZION header fields, fork height, etc.) belongs in `V3/` and is intentionally
//! out of scope here.

use anyhow::{anyhow, Result};

use crate::external_hashers::{hash_blake3_raw, meets_target};
use crate::parent_chains::{AlphHeader, CoinbaseCommitment, DcrHeader};

/// Parent chain algorithm used for the AuxPoW link.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParentAlgorithm {
    /// Decred — Blake3-256 header hash.
    DCR,
    /// Alephium — double Blake3-256 header hash.
    ALPH,
}

impl ParentAlgorithm {
    /// Hash a parent chain block header according to its algorithm.
    pub fn hash_header(self, header: &[u8]) -> [u8; 32] {
        match self {
            Self::DCR => hash_blake3_raw(header),
            Self::ALPH => {
                let h1 = hash_blake3_raw(header);
                hash_blake3_raw(&h1)
            }
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::DCR => "dcr",
            Self::ALPH => "alph",
        }
    }
}

/// Parsed parent chain header used for true AuxPoW validation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ParentHeader {
    DCR(DcrHeader),
    ALPH(AlphHeader),
}

impl ParentHeader {
    /// Compute the parent chain PoW hash.
    pub fn pow_hash(&self) -> [u8; 32] {
        match self {
            Self::DCR(h) => h.pow_hash(),
            Self::ALPH(h) => h.pow_hash(),
        }
    }

    /// Serialize the header to its raw PoW input bytes.
    pub fn raw_bytes(&self) -> Vec<u8> {
        match self {
            Self::DCR(h) => h.serialize_for_pow().to_vec(),
            Self::ALPH(h) => h.raw.clone(),
        }
    }

    /// Return the parent algorithm.
    pub fn algorithm(&self) -> ParentAlgorithm {
        match self {
            Self::DCR(_) => ParentAlgorithm::DCR,
            Self::ALPH(_) => ParentAlgorithm::ALPH,
        }
    }
}

/// Proof builder for true AuxPoW.
///
/// Constructs the data needed to prove that a ZION block is merge-mined with
/// a parent chain block.  The builder keeps the AuXpow crate self-contained;
/// V3 integration will wire it into block production and validation.
pub struct AuxPowProofBuilder;

impl AuxPowProofBuilder {
    /// Build AuxPoW data for a DCR parent header.
    ///
    /// `coinbase_commitment` is the AuxPoW commitment extracted from the
    /// parent coinbase transaction (see `CoinbaseCommitment::scan`).
    /// `aux_branch` proves the ZION leaf position inside the AuxPoW Merkle tree.
    pub fn build_dcr(
        aux_hash: [u8; 32],
        header: DcrHeader,
        parent_target: [u8; 32],
        coinbase_commitment: CoinbaseCommitment,
        aux_branch: Vec<[u8; 32]>,
    ) -> AuxPowData {
        AuxPowData {
            aux_hash,
            parent_header: header.serialize_for_pow().to_vec(),
            parent_target,
            parent_algo: ParentAlgorithm::DCR,
            coinbase_merkle_root: coinbase_commitment.aux_block_hash,
            aux_branch,
            aux_index: coinbase_commitment.merkle_nonce,
        }
    }

    /// Build AuxPoW data for an ALPH parent header.
    pub fn build_alph(
        aux_hash: [u8; 32],
        header: AlphHeader,
        parent_target: [u8; 32],
        coinbase_commitment: CoinbaseCommitment,
        aux_branch: Vec<[u8; 32]>,
    ) -> AuxPowData {
        AuxPowData {
            aux_hash,
            parent_header: header.raw.clone(),
            parent_target,
            parent_algo: ParentAlgorithm::ALPH,
            coinbase_merkle_root: coinbase_commitment.aux_block_hash,
            aux_branch,
            aux_index: coinbase_commitment.merkle_nonce,
        }
    }
}

/// Extended validation result for true AuxPoW using parsed parent headers.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuxPowFullValidation {
    /// Parent header hash meets the parent target.
    pub parent_hash_meets_target: bool,
    /// Computed AuxPoW root matches the commitment in the parent coinbase.
    pub aux_included_in_coinbase: bool,
}

impl AuxPowFullValidation {
    /// Both checks must pass for a valid true AuxPoW block.
    pub fn is_valid(&self) -> bool {
        self.parent_hash_meets_target && self.aux_included_in_coinbase
    }
}

/// Validate a true AuxPoW block using a parsed parent header and coinbase
/// commitment.
///
/// This is the Phase 3 entry point: it verifies (1) parent PoW and (2) AuxPoW
/// Merkle inclusion against the commitment stored in the parent coinbase.
pub fn validate_auxpow_full(
    header: &ParentHeader,
    aux_hash: [u8; 32],
    commitment: &CoinbaseCommitment,
    aux_branch: &[[u8; 32]],
    parent_target: [u8; 32],
) -> Result<AuxPowFullValidation> {
    let parent_hash = header.pow_hash();
    let parent_hash_meets_target = meets_target(&parent_hash, &parent_target);

    let computed_root =
        compute_aux_merkle_root(aux_hash, commitment.merkle_nonce, aux_branch)
            .ok_or_else(|| anyhow!("aux branch too deep or malformed"))?;
    let aux_included_in_coinbase = computed_root == commitment.aux_block_hash;

    Ok(AuxPowFullValidation {
        parent_hash_meets_target,
        aux_included_in_coinbase,
    })
}

/// Data required to validate a true AuxPoW block.
#[derive(Debug, Clone)]
pub struct AuxPowData {
    /// Hash of the auxiliary (ZION) block that we claim is merge-mined.
    pub aux_hash: [u8; 32],
    /// Serialized parent chain block header.
    pub parent_header: Vec<u8>,
    /// Parent chain PoW target (big-endian, 32 bytes).
    pub parent_target: [u8; 32],
    /// Parent chain algorithm.
    pub parent_algo: ParentAlgorithm,
    /// Merkle root of the AuxPoW tree as stored in the parent coinbase.
    pub coinbase_merkle_root: [u8; 32],
    /// Sibling hashes forming the path from the aux leaf to the root.
    pub aux_branch: Vec<[u8; 32]>,
    /// Leaf index of the aux chain in the AuxPoW tree.
    pub aux_index: u32,
}

/// Result of an AuxPoW validation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuxPowValidation {
    /// Parent header hash meets the parent target.
    pub parent_hash_meets_target: bool,
    /// Computed AuxPoW root matches the commitment in the parent coinbase.
    pub aux_included_in_coinbase: bool,
}

impl AuxPowValidation {
    /// A block is considered valid for true AuxPoW only when both checks pass.
    pub fn is_valid(&self) -> bool {
        self.parent_hash_meets_target && self.aux_included_in_coinbase
    }
}

/// Validate an AuxPoW link.
///
/// 1. Hash the parent header with the parent algorithm and check `<= target`.
/// 2. Recompute the AuxPoW Merkle root from `aux_hash`, `aux_index`, and
///    `aux_branch`; check it matches `coinbase_merkle_root`.
pub fn validate_auxpow(data: &AuxPowData) -> Result<AuxPowValidation> {
    let parent_hash = data.parent_algo.hash_header(&data.parent_header);
    let parent_hash_meets_target = meets_target(&parent_hash, &data.parent_target);

    let computed_root =
        compute_aux_merkle_root(data.aux_hash, data.aux_index, &data.aux_branch)
            .ok_or_else(|| anyhow!("aux branch too deep or malformed"))?;
    let aux_included_in_coinbase = computed_root == data.coinbase_merkle_root;

    Ok(AuxPowValidation {
        parent_hash_meets_target,
        aux_included_in_coinbase,
    })
}

/// Compute the root of a Blake3-based AuxPoW Merkle tree.
///
/// `index` is the leaf position of `leaf`.  Each sibling in `branch` is the
/// hash paired with the current node at that level.
pub fn compute_aux_merkle_root(
    leaf: [u8; 32],
    index: u32,
    branch: &[[u8; 32]],
) -> Option<[u8; 32]> {
    let mut current = leaf;
    let mut idx = index as usize;

    for sibling in branch {
        current = if idx.is_multiple_of(2) {
            combine(&current, sibling)
        } else {
            combine(sibling, &current)
        };
        idx /= 2;
    }

    Some(current)
}

fn combine(left: &[u8; 32], right: &[u8; 32]) -> [u8; 32] {
    let mut hasher = blake3::Hasher::new();
    hasher.update(left);
    hasher.update(right);
    *hasher.finalize().as_bytes()
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aux_merkle_root_basic() {
        let leaves: Vec<[u8; 32]> = (0..4u8)
            .map(|i| {
                let mut buf = [0u8; 32];
                buf[0] = i;
                hash_blake3_raw(&buf)
            })
            .collect();

        let l01 = combine(&leaves[0], &leaves[1]);
        let l23 = combine(&leaves[2], &leaves[3]);
        let root = combine(&l01, &l23);

        let branch = vec![leaves[1], l23];
        let computed = compute_aux_merkle_root(leaves[0], 0, &branch).unwrap();
        assert_eq!(computed, root);
    }

    #[test]
    fn validate_auxpow_synthetic_valid() {
        // Build a tiny aux tree with ZION as leaf 1.
        let mut zion_leaf_input = [0u8; 32];
        zion_leaf_input[0] = 0x5a; // 'Z'
        let aux_hash = hash_blake3_raw(&zion_leaf_input);

        let other_leaf_input = [0u8; 32];
        let other_leaf = hash_blake3_raw(&other_leaf_input);

        let root = combine(&other_leaf, &aux_hash); // index 1 → right

        // Parent header = arbitrary bytes; target = all 0xff so it always passes.
        let parent_header = b"synthetic dcr parent header".to_vec();
        let parent_target = [0xffu8; 32];

        let data = AuxPowData {
            aux_hash,
            parent_header,
            parent_target,
            parent_algo: ParentAlgorithm::DCR,
            coinbase_merkle_root: root,
            aux_branch: vec![other_leaf],
            aux_index: 1,
        };

        let result = validate_auxpow(&data).unwrap();
        assert!(result.aux_included_in_coinbase);
        assert!(result.parent_hash_meets_target);
        assert!(result.is_valid());
    }

    #[test]
    fn validate_auxpow_fails_when_root_mismatches() {
        let aux_hash = hash_blake3_raw(b"zion");
        let data = AuxPowData {
            aux_hash,
            parent_header: b"header".to_vec(),
            parent_target: [0xffu8; 32],
            parent_algo: ParentAlgorithm::DCR,
            coinbase_merkle_root: [0xABu8; 32],
            aux_branch: vec![],
            aux_index: 0,
        };

        let result = validate_auxpow(&data).unwrap();
        assert!(!result.aux_included_in_coinbase);
        assert!(result.parent_hash_meets_target);
        assert!(!result.is_valid());
    }

    #[test]
    fn alph_double_blake3_differs_from_dcr() {
        let header = b"same header";
        let dcr = ParentAlgorithm::DCR.hash_header(header);
        let alph = ParentAlgorithm::ALPH.hash_header(header);
        assert_ne!(dcr, alph, "ALPH double Blake3 must differ from DCR single Blake3");
    }

    #[test]
    fn full_validation_dcr_single_chain() {
        use crate::parent_chains::{CoinbaseCommitment, DcrHeader};

        // Synthetic ZION block hash.
        let aux_hash = hash_blake3_raw(b"zion block #1");

        // Single-chain merge mining: commitment stores the aux hash directly.
        let commitment = CoinbaseCommitment {
            aux_block_hash: aux_hash,
            merkle_size: 1,
            merkle_nonce: 0,
        };

        // DCR header with trivial target (all 0xff) so it always passes.
        let header = DcrHeader {
            version: 9,
            previous_hash: [0u8; 32],
            merkle_root: [0u8; 32],
            stake_root: [0u8; 32],
            vote_bits: 0,
            final_state: [0u8; 6],
            voters: 0,
            stake_version: 0,
            timestamp: 1_750_000_000,
            bits: 0,
            nonce: 42,
        };

        let parent_header = ParentHeader::DCR(header);
        let parent_target = [0xffu8; 32];

        let result = validate_auxpow_full(
            &parent_header,
            aux_hash,
            &commitment,
            &[],
            parent_target,
        )
        .unwrap();

        assert!(result.parent_hash_meets_target);
        assert!(result.aux_included_in_coinbase);
        assert!(result.is_valid());
    }

    #[test]
    fn full_validation_fails_when_commitment_root_mismatches() {
        use crate::parent_chains::{CoinbaseCommitment, DcrHeader};

        let aux_hash = hash_blake3_raw(b"zion block #2");
        let wrong_hash = hash_blake3_raw(b"wrong block");

        let commitment = CoinbaseCommitment {
            aux_block_hash: wrong_hash,
            merkle_size: 1,
            merkle_nonce: 0,
        };

        let header = DcrHeader {
            version: 9,
            previous_hash: [0u8; 32],
            merkle_root: [0u8; 32],
            stake_root: [0u8; 32],
            vote_bits: 0,
            final_state: [0u8; 6],
            voters: 0,
            stake_version: 0,
            timestamp: 1_750_000_001,
            bits: 0,
            nonce: 0,
        };

        let parent_header = ParentHeader::DCR(header);
        let result = validate_auxpow_full(
            &parent_header,
            aux_hash,
            &commitment,
            &[],
            [0xffu8; 32],
        )
        .unwrap();

        assert!(!result.aux_included_in_coinbase);
        assert!(!result.is_valid());
    }

    #[test]
    fn proof_builder_dcr_roundtrip() {
        use crate::parent_chains::{CoinbaseCommitment, DcrHeader};

        let aux_hash = hash_blake3_raw(b"zion block #3");
        let commitment = CoinbaseCommitment {
            aux_block_hash: aux_hash,
            merkle_size: 1,
            merkle_nonce: 7,
        };
        let header = DcrHeader {
            version: 9,
            previous_hash: [1u8; 32],
            merkle_root: [2u8; 32],
            stake_root: [3u8; 32],
            vote_bits: 0,
            final_state: [0u8; 6],
            voters: 0,
            stake_version: 0,
            timestamp: 1_750_000_002,
            bits: 0,
            nonce: 123,
        };

        let data = AuxPowProofBuilder::build_dcr(
            aux_hash,
            header.clone(),
            [0xffu8; 32],
            commitment.clone(),
            vec![],
        );

        assert_eq!(data.parent_algo, ParentAlgorithm::DCR);
        assert_eq!(data.aux_hash, aux_hash);
        assert_eq!(data.coinbase_merkle_root, commitment.aux_block_hash);
        assert_eq!(data.aux_index, commitment.merkle_nonce);
        assert_eq!(data.parent_header, header.serialize_for_pow().to_vec());
    }
}
