//! L1 blockchain scanner for humanitarian fund accumulation.

use crate::db::FreeWorldDb;
use crate::error::FreeWorldResult;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tracing::{info, warn};

#[derive(Clone)]
pub struct ScannerConfig {
    pub rpc_url: String,
    pub poll_interval: Duration,
    pub fund_address: String,
}

pub struct L1Scanner {
    config: ScannerConfig,
    db: Arc<Mutex<FreeWorldDb>>,
}

impl L1Scanner {
    pub fn new(config: ScannerConfig, db: Arc<Mutex<FreeWorldDb>>) -> Self {
        Self { config, db }
    }

    pub async fn run(&self) {
        info!("L1 scanner starting: rpc={}, fund={}", self.config.rpc_url, self.config.fund_address);
        let mut interval = tokio::time::interval(self.config.poll_interval);

        loop {
            interval.tick().await;
            if let Err(e) = self.tick().await {
                warn!("Scanner tick error: {}", e);
            }
        }
    }

    async fn tick(&self) -> FreeWorldResult<()> {
        // Placeholder: in production this would query L1 RPC for:
        // 1. Current block height
        // 2. Coinbase TXs with 5% humanitarian split
        // 3. Update fund_balance accordingly
        let db = self.db.lock().unwrap();
        let mut balance = db.get_fund_balance()?;
        balance.last_block_height += 1;
        balance.updated_at = chrono::Utc::now().to_rfc3339();
        db.update_fund_balance(&balance)?;
        Ok(())
    }
}
