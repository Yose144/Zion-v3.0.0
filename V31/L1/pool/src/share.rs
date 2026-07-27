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
}
