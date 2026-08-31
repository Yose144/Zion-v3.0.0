//! Withdrawal request processing.
//!
//! Records a user's withdrawal intent, debits the internal ledger, and submits
//! the on-chain payment through the appropriate chain adapter.

use std::sync::Arc;
use std::time::Duration;

use tokio::sync::Mutex;
use zion_l1_types::{Address, Amount, Asset, AssetId, ChainId};

use crate::chain::ChainAdapterRegistry;
use crate::contracts::token_decimals;
use crate::db::Db;
use crate::error::{MultichainError, MultichainResult};
use crate::multichain_wallet::ledger::WalletLedger;
use crate::multichain_wallet::types::{WithdrawalRecord, WithdrawalStatus};

/// Withdrawal processor.
#[derive(Clone)]
pub struct WithdrawalProcessor {
    db: Arc<Mutex<Db>>,
    adapters: Arc<ChainAdapterRegistry>,
    ledger: WalletLedger,
    poll_interval: Duration,
}

impl WithdrawalProcessor {
    pub fn new(
        db: Arc<Mutex<Db>>,
        adapters: Arc<ChainAdapterRegistry>,
        ledger: WalletLedger,
    ) -> Self {
        Self {
            db,
            adapters,
            ledger,
            poll_interval: Duration::from_secs(30),
        }
    }

    pub fn with_poll_interval(mut self, interval: Duration) -> Self {
        self.poll_interval = interval;
        self
    }

    /// Run the withdrawal processor loop. Intended to be spawned as a background
    /// task; it never returns unless it encounters a fatal error.
    pub async fn run(&self) -> MultichainResult<()> {
        loop {
            if let Err(e) = self.process_pending().await {
                tracing::warn!("withdrawal processor poll failed: {e}");
            }
            tokio::time::sleep(self.poll_interval).await;
        }
    }

    /// Create a pending withdrawal: debit the ledger and persist the request.
    pub async fn request_withdraw(
        &self,
        user_id: &str,
        asset: &Asset,
        amount: Amount,
        recipient_address: &str,
    ) -> MultichainResult<String> {
        let recipient = parse_recipient(recipient_address, asset.id.chain)?;
        let id = uuid::Uuid::new_v4().to_string();

        // Debit immediately so the balance is reserved.
        self.ledger.debit(user_id, asset, amount).await?;

        let record = WithdrawalRecord {
            id: id.clone(),
            user_id: user_id.to_string(),
            asset_key: asset.id.to_string(),
            amount,
            recipient_address: recipient.encoded,
            tx_hash: None,
            status: WithdrawalStatus::Pending,
            created_at: chrono::Utc::now(),
            sent_at: None,
        };

        {
            let db = self.db.lock().await;
            db.record_withdrawal(&record)?;
        }

        Ok(id)
    }

    /// Process all pending withdrawals.
    pub async fn process_pending(&self) -> MultichainResult<()> {
        let pending = {
            let db = self.db.lock().await;
            db.load_pending_withdrawals()?
        };

        for record in pending {
            if let Err(e) = self.process_one(&record).await {
                tracing::warn!("failed to process withdrawal {}: {}", record.id, e);
            }
        }
        Ok(())
    }

    async fn process_one(&self, record: &WithdrawalRecord) -> MultichainResult<()> {
        let asset = asset_from_key(&record.asset_key)?;
        let recipient = parse_recipient(&record.recipient_address, asset.id.chain)?;

        let adapter = self
            .adapters
            .get(asset.id.chain)
            .ok_or_else(|| MultichainError::AdapterNotFound(asset.id.chain.as_str().to_string()))?;

        let tx_hash = adapter
            .transfer_token(&asset, &recipient, record.amount)
            .await;

        // Credit the ledger back outside the DB lock. WalletLedger also uses the
        // same DB Mutex, so holding it while calling ledger.credit() would
        // deadlock because tokio::sync::Mutex is not reentrant.
        let credit_back = if tx_hash.is_err() {
            Some(
                self.ledger
                    .credit(&record.user_id, &asset, record.amount)
                    .await,
            )
        } else {
            None
        };

        let mut db = self.db.lock().await;
        match tx_hash {
            Ok(hash) => {
                db.update_withdrawal(&record.id, WithdrawalStatus::Sent, Some(&hash.to_hex()))?;
            }
            Err(e) => {
                if let Some(Err(credit_err)) = credit_back {
                    tracing::error!(
                        "withdrawal {} failed and ledger credit back also failed: {}",
                        record.id,
                        credit_err
                    );
                }
                db.update_withdrawal(&record.id, WithdrawalStatus::Failed, None)?;
                return Err(e);
            }
        }
        Ok(())
    }
}

fn parse_recipient(encoded: &str, chain: ChainId) -> MultichainResult<Address> {
    let bytes = match chain.family() {
        zion_l1_types::ChainFamily::Evm => {
            let hex = encoded.strip_prefix("0x").unwrap_or(encoded);
            let bytes = hex::decode(hex)
                .map_err(|_| MultichainError::Validation("invalid evm address hex".to_string()))?;
            if bytes.len() != 20 {
                return Err(MultichainError::Validation(
                    "evm address must be 20 bytes".to_string(),
                ));
            }
            bytes
        }
        zion_l1_types::ChainFamily::Solana | zion_l1_types::ChainFamily::Near => {
            bs58::decode(encoded)
                .into_vec()
                .map_err(|_| MultichainError::Validation("invalid base58 address".to_string()))?
        }
        _ => Vec::new(),
    };
    Ok(Address::new(chain, bytes, encoded)?)
}

fn asset_from_key(asset_key: &str) -> MultichainResult<Asset> {
    let parts: Vec<&str> = asset_key.split(':').collect();
    if parts.len() < 2 {
        return Err(MultichainError::Validation(format!(
            "invalid asset key: {}",
            asset_key
        )));
    }
    let chain = chain_id_from_str(parts[0])?;
    let ticker = parts[1].to_string();
    let contract = parts.get(2).map(|s| s.to_string());
    let id = AssetId::new(chain, ticker.clone(), contract.clone());
    let decimals = token_decimals(chain.as_str(), &ticker, contract.as_deref());
    Ok(Asset {
        id,
        decimals,
        name: ticker,
    })
}

fn chain_id_from_str(s: &str) -> MultichainResult<ChainId> {
    use crate::db::chain_id_from_str;
    chain_id_from_str(s)
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use zion_l1_types::{Address, ChainFamily, Hash};

    use crate::chain::adapter::DepositEvent;
    use crate::multichain_wallet::ledger::WalletLedger;

    #[derive(Default)]
    struct MockAdapter {
        calls: std::sync::Arc<std::sync::Mutex<Vec<(String, String, u128)>>>,
    }

    #[async_trait]
    impl crate::chain::adapter::ChainAdapter for MockAdapter {
        fn name(&self) -> &str {
            "mock"
        }

        fn family(&self) -> ChainFamily {
            ChainFamily::Evm
        }

        async fn health_check(&self) -> MultichainResult<bool> {
            Ok(true)
        }

        async fn watch_events(&self) -> MultichainResult<Vec<DepositEvent>> {
            Ok(Vec::new())
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

        async fn transfer_token(
            &self,
            token: &Asset,
            to: &Address,
            amount: Amount,
        ) -> MultichainResult<Hash> {
            self.calls
                .lock()
                .unwrap()
                .push((token.id.to_string(), to.encoded.clone(), amount.0));
            Ok(Hash([0u8; 32]))
        }

        async fn balance(&self, _address: &Address) -> MultichainResult<Amount> {
            Ok(Amount::ZERO)
        }

        async fn execute_outbound(
            &self,
            _transfer: &crate::types::Transfer,
        ) -> MultichainResult<Hash> {
            Ok(Hash([0u8; 32]))
        }
    }

    fn usdc_asset() -> Asset {
        Asset {
            id: AssetId::new(ChainId::Base, "USDC", Some("0xA0b86a33E6B8".to_string())),
            decimals: 6,
            name: "USD Coin".to_string(),
        }
    }

    #[tokio::test]
    async fn withdrawal_request_debits_ledger_and_process_sends_token() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let asset = usdc_asset();
        let user_id = "user1";
        let amount = Amount::new(1_000_000);

        ledger
            .credit(user_id, &asset, Amount::new(10_000_000))
            .await
            .unwrap();

        let mut adapters = crate::chain::ChainAdapterRegistry::new();
        let mock = MockAdapter::default();
        let calls = mock.calls.clone();
        adapters.register(ChainId::Base, Box::new(mock));

        let processor =
            WithdrawalProcessor::new(Arc::clone(&db), Arc::new(adapters), ledger.clone());

        processor
            .request_withdraw(
                user_id,
                &asset,
                amount,
                "0x0000000000000000000000000000000000000001",
            )
            .await
            .unwrap();

        let balance = ledger.balance(user_id, &asset).await.unwrap();
        assert_eq!(balance.0, 9_000_000);

        processor.process_pending().await.unwrap();

        let db = db.lock().await;
        let pending = db.load_pending_withdrawals().unwrap();
        assert!(pending.is_empty());

        let calls = calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].0, asset.id.to_string());
        assert_eq!(calls[0].1, "0x0000000000000000000000000000000000000001");
        assert_eq!(calls[0].2, 1_000_000);
    }
}
