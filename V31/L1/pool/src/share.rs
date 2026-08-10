#[derive(Clone, Debug)]
pub struct Share {
    pub job_id: String,
    pub worker: String,
    pub nonce: u64,
    pub hash: [u8; 32],
    pub extranonce: Vec<u8>,
}

#[derive(Clone, Debug)]
pub struct ShareSubmission {
    pub worker: String,
    pub job_id: String,
    pub nonce_hex: String,
    /// Per-share difficulty (work weight) used for PPLNS accounting.
    /// Defaults to 1 for tests; callers should set this to the session's
    /// vardiff value or the network difficulty for non-vardiff protocols.
    pub difficulty: u64,
}
