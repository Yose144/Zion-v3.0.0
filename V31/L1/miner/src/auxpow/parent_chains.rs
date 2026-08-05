//! Parent chain header parsing and AuxPoW commitment helpers.

use anyhow::{bail, Result};

use super::hasher::hash_blake3_raw;

pub const AUXPOW_COINBASE_MAGIC: &[u8] = &[0xfa, 0xbe, b'm', b'm'];
pub const AUXPOW_COMMITMENT_LEN: usize = 44;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoinbaseCommitment {
    pub aux_block_hash: [u8; 32],
    pub merkle_size: u32,
    pub merkle_nonce: u32,
}

impl CoinbaseCommitment {
    pub fn serialize(&self) -> [u8; AUXPOW_COMMITMENT_LEN] {
        let mut out = [0u8; AUXPOW_COMMITMENT_LEN];
        out[0..4].copy_from_slice(AUXPOW_COINBASE_MAGIC);
        out[4..36].copy_from_slice(&self.aux_block_hash);
        out[36..40].copy_from_slice(&self.merkle_size.to_le_bytes());
        out[40..44].copy_from_slice(&self.merkle_nonce.to_le_bytes());
        out
    }

    pub fn parse(bytes: &[u8; AUXPOW_COMMITMENT_LEN]) -> Result<Self> {
        if &bytes[0..4] != AUXPOW_COINBASE_MAGIC {
            bail!("missing AuxPoW magic bytes");
        }
        let mut aux_block_hash = [0u8; 32];
        aux_block_hash.copy_from_slice(&bytes[4..36]);
        let merkle_size = u32::from_le_bytes(bytes[36..40].try_into()?);
        let merkle_nonce = u32::from_le_bytes(bytes[40..44].try_into()?);
        Ok(Self { aux_block_hash, merkle_size, merkle_nonce })
    }

    pub fn scan(coinbase_script: &[u8]) -> Option<Self> {
        let pos = coinbase_script
            .windows(AUXPOW_COINBASE_MAGIC.len())
            .position(|w| w == AUXPOW_COINBASE_MAGIC)?;
        let end = pos + AUXPOW_COINBASE_MAGIC.len() + 40;
        if end > coinbase_script.len() {
            return None;
        }
        let mut buf = [0u8; AUXPOW_COMMITMENT_LEN];
        buf.copy_from_slice(&coinbase_script[pos..end]);
        Self::parse(&buf).ok()
    }
}

pub const DCR_HEADER_SIZE: usize = 180;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DcrHeader {
    pub version: u32,
    pub previous_hash: [u8; 32],
    pub merkle_root: [u8; 32],
    pub stake_root: [u8; 32],
    pub vote_bits: u16,
    pub final_state: [u8; 6],
    pub voters: u16,
    pub stake_version: u32,
    pub timestamp: u32,
    pub bits: u32,
    pub nonce: u32,
}

impl DcrHeader {
    pub fn serialize_for_pow(&self) -> [u8; DCR_HEADER_SIZE] {
        let mut out = [0u8; DCR_HEADER_SIZE];
        let mut off = 0usize;
        out[off..off + 4].copy_from_slice(&self.version.to_le_bytes());
        off += 4;
        out[off..off + 32].copy_from_slice(&self.previous_hash);
        off += 32;
        out[off..off + 32].copy_from_slice(&self.merkle_root);
        off += 32;
        out[off..off + 32].copy_from_slice(&self.stake_root);
        off += 32;
        out[off..off + 2].copy_from_slice(&self.vote_bits.to_le_bytes());
        off += 2;
        out[off..off + 6].copy_from_slice(&self.final_state);
        off += 6;
        out[off..off + 2].copy_from_slice(&self.voters.to_le_bytes());
        off += 2;
        out[off..off + 4].copy_from_slice(&self.stake_version.to_le_bytes());
        off += 4;
        out[off..off + 4].copy_from_slice(&self.timestamp.to_le_bytes());
        off += 4;
        out[off..off + 4].copy_from_slice(&self.bits.to_le_bytes());
        off += 4;
        out[off..off + 4].copy_from_slice(&self.nonce.to_le_bytes());
        out
    }

    pub fn parse(bytes: &[u8; DCR_HEADER_SIZE]) -> Result<Self> {
        let mut off = 0usize;
        let version = read_u32_le(bytes, &mut off)?;
        let previous_hash = read_bytes32(bytes, &mut off)?;
        let merkle_root = read_bytes32(bytes, &mut off)?;
        let stake_root = read_bytes32(bytes, &mut off)?;
        let vote_bits = read_u16_le(bytes, &mut off)?;
        let final_state = read_bytes6(bytes, &mut off)?;
        let voters = read_u16_le(bytes, &mut off)?;
        let stake_version = read_u32_le(bytes, &mut off)?;
        let timestamp = read_u32_le(bytes, &mut off)?;
        let bits = read_u32_le(bytes, &mut off)?;
        let nonce = read_u32_le(bytes, &mut off)?;
        Ok(Self {
            version, previous_hash, merkle_root, stake_root,
            vote_bits, final_state, voters, stake_version,
            timestamp, bits, nonce,
        })
    }

    pub fn pow_hash(&self) -> [u8; 32] {
        hash_blake3_raw(&self.serialize_for_pow())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AlphHeader {
    pub raw: Vec<u8>,
}

impl AlphHeader {
    pub fn new(raw: Vec<u8>) -> Self {
        Self { raw }
    }

    pub fn pow_hash(&self) -> [u8; 32] {
        let h1 = hash_blake3_raw(&self.raw);
        hash_blake3_raw(&h1)
    }
}

fn read_u32_le(bytes: &[u8; DCR_HEADER_SIZE], off: &mut usize) -> Result<u32> {
    let v = u32::from_le_bytes(bytes[*off..*off + 4].try_into()?);
    *off += 4;
    Ok(v)
}

fn read_u16_le(bytes: &[u8; DCR_HEADER_SIZE], off: &mut usize) -> Result<u16> {
    let v = u16::from_le_bytes(bytes[*off..*off + 2].try_into()?);
    *off += 2;
    Ok(v)
}

fn read_bytes32(bytes: &[u8; DCR_HEADER_SIZE], off: &mut usize) -> Result<[u8; 32]> {
    let mut out = [0u8; 32];
    out.copy_from_slice(&bytes[*off..*off + 32]);
    *off += 32;
    Ok(out)
}

fn read_bytes6(bytes: &[u8; DCR_HEADER_SIZE], off: &mut usize) -> Result<[u8; 6]> {
    let mut out = [0u8; 6];
    out.copy_from_slice(&bytes[*off..*off + 6]);
    *off += 6;
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn commitment_roundtrip() {
        let commit = CoinbaseCommitment {
            aux_block_hash: [0xABu8; 32],
            merkle_size: 4,
            merkle_nonce: 42,
        };
        let bytes = commit.serialize();
        assert_eq!(bytes[0..4], AUXPOW_COINBASE_MAGIC[..]);
        let parsed = CoinbaseCommitment::parse(&bytes).unwrap();
        assert_eq!(parsed, commit);
    }

    #[test]
    fn commitment_scan_finds_magic_in_script() {
        let commit = CoinbaseCommitment {
            aux_block_hash: [0xCDu8; 32],
            merkle_size: 1,
            merkle_nonce: 0,
        };
        let mut script = vec![0x00u8; 10];
        script.extend_from_slice(&commit.serialize());
        script.extend_from_slice(&[0xFFu8; 5]);
        let found = CoinbaseCommitment::scan(&script).unwrap();
        assert_eq!(found, commit);
    }

    #[test]
    fn commitment_scan_missing_magic_returns_none() {
        let script = vec![0x00u8; 100];
        assert!(CoinbaseCommitment::scan(&script).is_none());
    }

    #[test]
    fn parse_rejects_bad_magic() {
        let mut bytes = [0u8; AUXPOW_COMMITMENT_LEN];
        bytes[0..4].copy_from_slice(b"bad_");
        assert!(CoinbaseCommitment::parse(&bytes).is_err());
    }

    #[test]
    fn dcr_header_roundtrip() {
        let header = DcrHeader {
            version: 9,
            previous_hash: [1u8; 32],
            merkle_root: [2u8; 32],
            stake_root: [3u8; 32],
            vote_bits: 0x0100,
            final_state: [4u8; 6],
            voters: 5,
            stake_version: 10,
            timestamp: 1_750_000_000,
            bits: 0x1b_04_04_1b,
            nonce: 1_234_567,
        };
        let serialized = header.serialize_for_pow();
        assert_eq!(serialized.len(), DCR_HEADER_SIZE);
        let parsed = DcrHeader::parse(&serialized).unwrap();
        assert_eq!(parsed, header);
        assert_eq!(header.pow_hash(), header.pow_hash());
    }

    #[test]
    fn dcr_header_nonce_changes_hash() {
        let mut header = DcrHeader {
            version: 9, previous_hash: [0u8; 32], merkle_root: [0u8; 32],
            stake_root: [0u8; 32], vote_bits: 0, final_state: [0u8; 6],
            voters: 0, stake_version: 0, timestamp: 0, bits: 0, nonce: 0,
        };
        let h0 = header.pow_hash();
        header.nonce = 1;
        let h1 = header.pow_hash();
        assert_ne!(h0, h1);
    }

    #[test]
    fn alph_double_blake3_deterministic() {
        let header = AlphHeader::new(b"alph test header".to_vec());
        let h0 = header.pow_hash();
        let h1 = header.pow_hash();
        assert_eq!(h0, h1);
        assert_ne!(h0, hash_blake3_raw(b"alph test header"));
    }
}
