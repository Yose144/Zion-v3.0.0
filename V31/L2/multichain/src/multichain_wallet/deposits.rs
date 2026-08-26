//! Deposit watcher / credit logic.
//!
//! This module is responsible for polling chain adapters for deposits sent to
//! per-user deposit addresses and crediting the internal ledger once finality
//! is reached.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::Mutex;
use zion_l1_types::{Address, Asset, ChainId};

use crate::chain::ChainAdapterRegistry;
use crate::db::Db;
use crate::error::MultichainResult;
use crate::multichain_wallet::ledger::WalletLedger;
use crate::multichain_wallet::types::{AddressPurpose, DepositRecord, DepositStatus, WalletAddress};

/// Deposit watcher for all known deposit addresses.
#[derive(Clone)]
pub struct DepositWatcher {
    db: Arc<Mutex<Db>>,
    adapters: Arc<ChainAdapterRegistry>,
    ledger: WalletLedger,
    poll_interval: Duration,
    finality: HashMap<ChainId, u64>,
}

impl DepositWatcher {
    pub fn new(
        db: Arc<Mutex<Db>>,
        adapters: Arc<ChainAdapterRegistry>,
        ledger: WalletLedger,
    ) -> Self {
        let mut finality = HashMap::new();
        finality.insert(ChainId::Bitcoin, 6);
        finality.insert(ChainId::ZionL1, 1);
        finality.insert(ChainId::Ethereum, 12);
        finality.insert(ChainId::Base, 12);
        finality.insert(ChainId::Arbitrum, 12);
        finality.insert(ChainId::Optimism, 12);
        finality.insert(ChainId::Bsc, 12);
        finality.insert(ChainId::Polygon, 12);
        finality.insert(ChainId::Avalanche, 12);
        finality.insert(ChainId::Zksync, 12);
        finality.insert(ChainId::Linea, 12);

        Self {
            db,
            adapters,
            ledger,
            poll_interval: Duration::from_secs(30),
            finality,
        }
    }

    pub fn with_poll_interval(mut self, interval: Duration) -> Self {
        self.poll_interval = interval;
        self
    }

    /// Run the deposit watcher loop. This is intended to be spawned as a
    /// background task; it never returns unless it encounters a fatal error.
    pub async fn run(&self) -> MultichainResult<()> {
        loop {
            if let Err(e) = self.poll_all().await {
                tracing::warn!("deposit watcher poll failed: {e}");
            }
            tokio::time::sleep(self.poll_interval).await;
        }
    }

    /// Poll every registered chain adapter for deposits sent to known wallet
    /// deposit addresses and credit the internal ledger after finality.
    pub async fn poll_all(&self) -> MultichainResult<()> {
        let deposit_addresses = {
            let db = self.db.lock().await;
            db.load_wallet_addresses_by_purpose(AddressPurpose::Deposit)?
        };

        let by_chain = group_by_chain(deposit_addresses);

        for (chain, addresses) in by_chain {
            let Some(adapter) = self.adapters.get(chain) else {
                continue;
            };

            match adapter.watch_addresses(&addresses).await {
                Ok(events) => {
                    for event in events {
                        self.process_event(chain, &event).await?;
                    }
                }
                Err(e) => {
                    tracing::warn!("watch_addresses failed for {}: {}", chain.as_str(), e);
                }
            }
        }
        Ok(())
    }

    async fn process_event(
        &self,
        chain: ChainId,
        event: &crate::chain::adapter::DepositEvent,
    ) -> MultichainResult<()> {
        let address_str = event.recipient.encoded.clone();
        let wallet_address = {
            let db = self.db.lock().await;
            match db.load_wallet_address_by_encoded(&address_str)? {
                Some(a) => a,
                None => {
                    tracing::debug!("deposit to unknown address: {}", address_str);
                    return Ok(());
                }
            }
        };

        let asset = event
            .asset
            .clone()
            .unwrap_or_else(|| native_asset_for_chain(chain, &wallet_address));
        let asset_key = asset.id.to_string();
        let deposit_id = format!("{}:{}:{}", wallet_address.user_id, event.tx_hash.to_hex(), asset_key);

        let existing = {
            let db = self.db.lock().await;
            db.load_deposit(&deposit_id)?
        };

        let confirmations = event.confirmations;
        let finality = self.finality_for(chain);

        if let Some(existing) = existing {
            if existing.status == DepositStatus::Credited {
                return Ok(());
            }

            let mut updated = existing.clone();
            updated.confirmations = confirmations;

            if confirmations >= finality && existing.status == DepositStatus::Pending {
                self.ledger
                    .credit(&wallet_address.user_id, &asset, event.amount)
                    .await?;
                updated.status = DepositStatus::Credited;
                updated.credited_at = Some(chrono::Utc::now());
            }

            let db = self.db.lock().await;
            db.record_deposit(&updated)?;
            return Ok(());
        }

        // New deposit observation.
        let status = if confirmations >= finality {
            self.ledger
                .credit(&wallet_address.user_id, &asset, event.amount)
                .await?;
            DepositStatus::Credited
        } else {
            DepositStatus::Pending
        };

        let credited_at = if status == DepositStatus::Credited {
            Some(chrono::Utc::now())
        } else {
            None
        };

        let deposit = DepositRecord {
            id: deposit_id,
            user_id: wallet_address.user_id,
            chain,
            chain_id: wallet_address.chain_id.clone(),
            tx_hash: event.tx_hash.to_hex(),
            asset_key,
            amount: event.amount,
            confirmations,
            status,
            created_at: chrono::Utc::now(),
            credited_at,
        };

        let db = self.db.lock().await;
        db.record_deposit(&deposit)?;
        Ok(())
    }

    fn finality_for(&self, chain: ChainId) -> u64 {
        self.finality.get(&chain).copied().unwrap_or(12)
    }
}

fn group_by_chain(addresses: Vec<WalletAddress>) -> HashMap<ChainId, Vec<Address>> {
    let mut map: HashMap<ChainId, Vec<Address>> = HashMap::new();
    for addr in addresses {
        map.entry(addr.chain).or_default().push(addr.address);
    }
    map
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use crate::chain::ChainAdapter;
    use zion_l1_types::{Address, Amount, ChainFamily, Hash};

    #[derive(Default)]
    struct MockAdapter {
        events: Vec<crate::chain::adapter::DepositEvent>,
    }

    #[async_trait]
    impl ChainAdapter for MockAdapter {
        fn name(&self) -> &str {
            "mock"
        }

        fn family(&self) -> ChainFamily {
            ChainFamily::Zion
        }

        async fn health_check(&self) -> MultichainResult<bool> {
            Ok(true)
        }

        async fn watch_events(&self) -> MultichainResult<Vec<crate::chain::adapter::DepositEvent>> {
            Ok(self.events.clone())
        }

        async fn watch_addresses(
            &self,
            addresses: &[Address],
        ) -> MultichainResult<Vec<crate::chain::adapter::DepositEvent>> {
            Ok(self
                .events
                .iter()
                .filter(|e| addresses.iter().any(|a| a.encoded == e.recipient.encoded))
                .cloned()
                .collect())
        }

        async fn current_height(&self) -> MultichainResult<u64> {
            Ok(1)
        }

        async fn confirmations(&self, _tx_hash: &Hash) -> MultichainResult<u64> {
            Ok(1)
        }

        async fn send_payment(&self, _to: &Address, _amount: Amount) -> MultichainResult<Hash> {
            Ok(Hash([0u8; 32]))
        }

        async fn balance(&self, _address: &Address) -> MultichainResult<Amount> {
            Ok(Amount::ZERO)
        }

        async fn execute_outbound(&self, _transfer: &crate::types::Transfer) -> MultichainResult<Hash> {
            Ok(Hash([0u8; 32]))
        }
    }

    #[tokio::test]
    async fn deposit_watcher_credits_ledger() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));

        let user_id = "user1";
        let chain = ChainId::ZionL1;
        let address = Address::new(chain, vec![], "zion1mock").unwrap();

        let wallet_address = WalletAddress {
            address: address.clone(),
            user_id: user_id.to_string(),
            chain,
            chain_id: None,
            purpose: AddressPurpose::Deposit,
            public_key: None,
            derivation_path: "m/44'/9999'/0'/0/0".to_string(),
            is_external: false,
            created_at: chrono::Utc::now(),
        };

        {
            let db = db.lock().await;
            db.save_wallet_address(&wallet_address).unwrap();
        }

        let tx_hash = Hash::from_hex(&"0".repeat(64)).unwrap();
        let event = crate::chain::adapter::DepositEvent {
            chain,
            tx_hash,
            recipient: address,
            amount: Amount::new(1_000_000),
            memo: None,
            confirmations: 1,
            asset: None,
        };

        let mut adapters = ChainAdapterRegistry::new();
        adapters.register(chain, Box::new(MockAdapter { events: vec![event] }));

        let watcher = DepositWatcher::new(
            Arc::clone(&db),
            Arc::new(adapters),
            ledger.clone(),
        )
        .with_poll_interval(Duration::from_millis(1));

        watcher.poll_all().await.unwrap();

        let asset = Asset::native(chain, "ZION", 8, "ZION");
        let balance = ledger.balance(user_id, &asset).await.unwrap();
        assert_eq!(balance.0, 1_000_000);

        let db = db.lock().await;
        let deposits = db.load_pending_deposits().unwrap();
        assert!(deposits.iter().all(|d| d.status == DepositStatus::Credited));
    }
}

fn native_asset_for_chain(chain: ChainId, address: &WalletAddress) -> Asset {
    let ticker: String = match chain {
        ChainId::Bitcoin => "BTC".to_string(),
        ChainId::ZionL1 => "ZION".to_string(),
        ChainId::Ethereum => "ETH".to_string(),
        ChainId::Base => "ETH".to_string(),
        ChainId::Arbitrum => "ETH".to_string(),
        ChainId::Optimism => "ETH".to_string(),
        ChainId::Bsc => "BNB".to_string(),
        ChainId::Polygon => "MATIC".to_string(),
        ChainId::Avalanche => "AVAX".to_string(),
        ChainId::Zksync => "ETH".to_string(),
        ChainId::Linea => "ETH".to_string(),
        _ => address.chain.as_str().to_ascii_uppercase(),
    };
    let name = ticker.clone();
    Asset::native(chain, ticker, 8, name)
}
