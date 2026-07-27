use zion_cosmic_harmony::ExternalCoin;

/// A stratum job received from an external (AuxPoW) pool.
#[derive(Clone, Debug)]
pub struct Job {
    pub job_id: String,
    pub coin: ExternalCoin,
    /// Header bytes to be hashed; length is algorithm-specific.
    pub header: Vec<u8>,
    /// 32-byte difficulty target (little-endian comparison).
    pub target: [u8; 32],
    /// ExtraNonce provided by the pool for share uniqueness.
    pub extranonce: Vec<u8>,
}

/// A found share ready for submission.
#[derive(Clone, Debug)]
pub struct Share {
    pub job_id: String,
    pub coin: ExternalCoin,
    pub nonce: u64,
    pub hash: [u8; 32],
}
