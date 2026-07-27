use serde::{Deserialize, Serialize};

use zion_l1_types::Hash;

use crate::transaction::Transaction;

/// Fixed-size prefix fed into the PoW hash function.
pub const POW_HEADER_SIZE: usize = 80;

/// L1 block header.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct BlockHeader {
    pub previous_hash: Hash,
    pub merkle_root: Hash,
    pub height: u64,
    pub timestamp: u64,
    pub nonce: u64,
    pub difficulty: u32,
}

impl BlockHeader {
    /// Serialize the first 80 bytes used as PoW input.
    ///
    /// Layout: prev_hash(32) | merkle_root(32) | height(8 LE) | timestamp(8 LE).
    /// `nonce` is appended by the PoW function itself, not stored in this buffer.
    pub fn pow_header(&self) -> [u8; POW_HEADER_SIZE] {
        let mut out = [0u8; POW_HEADER_SIZE];
        out[..32].copy_from_slice(&self.previous_hash.0);
        out[32..64].copy_from_slice(&self.merkle_root.0);
        out[64..72].copy_from_slice(&self.height.to_le_bytes());
        out[72..80].copy_from_slice(&self.timestamp.to_le_bytes());
        out
    }
}

/// L1 block.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct Block {
    pub header: BlockHeader,
    pub transactions: Vec<Transaction>,
}

impl Block {
    pub fn new(header: BlockHeader, transactions: Vec<Transaction>) -> Self {
        Self {
            header,
            transactions,
        }
    }
}
