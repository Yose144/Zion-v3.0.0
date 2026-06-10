//! Trae Labs Miner
//! 
//! Simple miner for our experimental algorithms
//! Based on structure from V3/L1/miner

use crate::common::*;

/// Mining result
pub struct MiningResult {
    pub nonce: u64,
    pub hash: [u8; 32],
    pub attempts: u64,
    pub found: bool,
}

/// Miner configuration
#[derive(Clone)]
pub struct MinerConfig {
    pub header: Vec<u8>,
    pub start_nonce: u64,
    pub nonce_count: u64,
    pub target: [u8; 32],
}

impl Default for MinerConfig {
    fn default() -> Self {
        Self {
            header: b"TraeLabs Experimental Block!".to_vec(),
            start_nonce: 0,
            nonce_count: 1_000_000,
            target: easy_target(),
        }
    }
}

/// Mine using Trae Lite V1
pub fn mine_lite_v1(config: &MinerConfig) -> MiningResult {
    for offset in 0..config.nonce_count {
        let nonce = config.start_nonce.wrapping_add(offset);
        let hash = crate::lite::v1_minimal::trae_lite_v1(&config.header, nonce);
        if meets_target(&hash, &config.target) {
            return MiningResult {
                nonce,
                hash,
                attempts: offset + 1,
                found: true,
            };
        }
    }
    MiningResult {
        nonce: 0,
        hash: [0u8; 32],
        attempts: config.nonce_count,
        found: false,
    }
}

/// Mine using Trae Lite V2
pub fn mine_lite_v2(config: &MinerConfig) -> MiningResult {
    for offset in 0..config.nonce_count {
        let nonce = config.start_nonce.wrapping_add(offset);
        let hash = crate::lite::v2_memory_light::trae_lite_v2(&config.header, nonce);
        if meets_target(&hash, &config.target) {
            return MiningResult {
                nonce,
                hash,
                attempts: offset + 1,
                found: true,
            };
        }
    }
    MiningResult {
        nonce: 0,
        hash: [0u8; 32],
        attempts: config.nonce_count,
        found: false,
    }
}

/// Mine using Trae Fire V1
pub fn mine_fire_v1(config: &MinerConfig) -> MiningResult {
    for offset in 0..config.nonce_count {
        let nonce = config.start_nonce.wrapping_add(offset);
        let hash = crate::fire::v1_thermal::trae_fire_v1(&config.header, nonce);
        if meets_target(&hash, &config.target) {
            return MiningResult {
                nonce,
                hash,
                attempts: offset + 1,
                found: true,
            };
        }
    }
    MiningResult {
        nonce: 0,
        hash: [0u8; 32],
        attempts: config.nonce_count,
        found: false,
    }
}

/// Mine using Trae Fire V2
pub fn mine_fire_v2(config: &MinerConfig) -> MiningResult {
    for offset in 0..config.nonce_count {
        let nonce = config.start_nonce.wrapping_add(offset);
        let hash = crate::fire::v2_recursive::trae_fire_v2(&config.header, nonce);
        if meets_target(&hash, &config.target) {
            return MiningResult {
                nonce,
                hash,
                attempts: offset + 1,
                found: true,
            };
        }
    }
    MiningResult {
        nonce: 0,
        hash: [0u8; 32],
        attempts: config.nonce_count,
        found: false,
    }
}
