//! Bridge / lock-mint logic.
//!
//! The `Bridge` coordinates `Transfer`s with `TransferDirection::LockMint` or
//! `BurnRelease` between two `ChainAdapter`s registered in the system.

use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::Mutex;
use zion_l1_types::{ChainId, Hash};

use crate::bridge::consensus::BridgeConsensus;
use crate::chain::{ChainAdapter, ChainAdapterRegistry, DepositEvent};
use crate::error::{MultichainError, MultichainResult};
use crate::types::{Transfer, TransferDirection, TransferStatus};

pub mod consensus;

const MAX_ATTEMPTS: u32 = 3;
const POLL_INTERVAL_MS: u64 = 10;

pub struct Bridge {
    adapters: Arc<ChainAdapterRegistry>,
    consensus: Option<BridgeConsensus>,
    processed_tx_hashes: Arc<Mutex<HashSet<Hash>>>,
}

impl Bridge {
    pub fn new(adapters: Arc<ChainAdapterRegistry>) -> Self {
        Self {
            adapters,
            consensus: None,
            processed_tx_hashes: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    /// Create a bridge with validator consensus enabled.
    pub fn with_consensus(adapters: Arc<ChainAdapterRegistry>, consensus: BridgeConsensus) -> Self {
        Self {
            adapters,
            consensus: Some(consensus),
            processed_tx_hashes: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    pub async fn submit(&self, transfer: &mut Transfer) -> MultichainResult<Hash> {
        match transfer.direction {
            TransferDirection::LockMint => self.lock_mint(transfer).await,
            TransferDirection::BurnRelease => self.burn_release(transfer).await,
            _ => Err(MultichainError::Unsupported(format!(
                "direction {:?} is not a bridge operation",
                transfer.direction
            ))),
        }
    }

    async fn lock_mint(&self, transfer: &mut Transfer) -> MultichainResult<Hash> {
        let source = self.adapter(transfer.source.address.chain)?;
        let target = self.adapter(transfer.target.address.chain)?;

        transfer.status = TransferStatus::Detected;

        if let Some(event) = self.poll_for_event(source, transfer).await {
            transfer.id = event.tx_hash.to_hex();
            transfer.status = TransferStatus::Executing;

            self.verify_consensus(transfer)?;

            match target.execute_outbound(transfer).await {
                Ok(hash) => {
                    transfer.status = TransferStatus::Completed;
                    return Ok(hash);
                }
                Err(e) => return Err(e),
            }
        }

        Err(MultichainError::Validation(
            "no deposit event detected on source chain".to_string(),
        ))
    }

    async fn burn_release(&self, transfer: &mut Transfer) -> MultichainResult<Hash> {
        let source = self.adapter(transfer.source.address.chain)?;
        let target = self.adapter(transfer.target.address.chain)?;

        transfer.status = TransferStatus::Detected;

        if let Some(event) = self.poll_for_event(source, transfer).await {
            transfer.id = event.tx_hash.to_hex();
            transfer.status = TransferStatus::Executing;

            self.verify_consensus(transfer)?;

            match target.execute_outbound(transfer).await {
                Ok(hash) => {
                    transfer.status = TransferStatus::Completed;
                    return Ok(hash);
                }
                Err(e) => return Err(e),
            }
        }

        Err(MultichainError::Validation(
            "no burn event detected on source chain".to_string(),
        ))
    }

    /// If a `BridgeConsensus` is configured, sign the transfer locally and
    /// demand a quorum.  If no consensus is configured, the bridge operates in
    /// single-node / Alpha mode and the check is a no-op.
    ///
    /// FIND-026 fix: if consensus IS configured but the local node cannot
    /// produce a quorum (not enough validator keys), fail closed rather than
    /// silently degrading. This prevents the bridge from operating in an
    /// unsafe sub-quorum mode.
    fn verify_consensus(&self, transfer: &Transfer) -> MultichainResult<()> {
        if let Some(consensus) = &self.consensus {
            // Fail closed if we don't have enough keys for quorum.
            if !consensus.can_sign_quorum_locally() {
                return Err(MultichainError::Validation(
                    "bridge consensus: insufficient local validator keys for quorum (FIND-026)".to_string(),
                ));
            }
            consensus
                .sign_and_verify(transfer)
                .map(|_| ())
                .map_err(|e| MultichainError::Validation(format!("bridge consensus: {e}")))?;
        }
        Ok(())
    }

    fn adapter(&self, chain: zion_l1_types::ChainId) -> MultichainResult<&dyn ChainAdapter> {
        self.adapters
            .get(chain)
            .ok_or_else(|| MultichainError::AdapterNotFound(chain.as_str().to_string()))
    }

    async fn poll_for_event(
        &self,
        adapter: &dyn ChainAdapter,
        transfer: &Transfer,
    ) -> Option<DepositEvent> {
        let expected = &transfer.source;

        for attempt in 0..MAX_ATTEMPTS {
            if let Ok(events) = adapter.watch_events().await {
                if let Some(event) = events.iter().find(|e| {
                    e.recipient == expected.address
                        && e.amount == expected.amount
                        && bridge_memo_matches(transfer, &e.memo)
                }) {
                    let mut processed = self.processed_tx_hashes.lock().await;
                    if processed.contains(&event.tx_hash) {
                        continue;
                    }
                    processed.insert(event.tx_hash.clone());
                    return Some(event.clone());
                }
            }

            if attempt + 1 < MAX_ATTEMPTS {
                tokio::time::sleep(Duration::from_millis(POLL_INTERVAL_MS)).await;
            }
        }

        None
    }
}

fn bridge_memo(transfer: &Transfer) -> Option<String> {
    Some(format!("bridge:{}", transfer.id))
}

fn bridge_memo_matches(transfer: &Transfer, memo: &Option<String>) -> bool {
    if memo.as_ref() == bridge_memo(transfer).as_ref() {
        return true;
    }
    if let Some(m) = memo {
        if let Some((chain, recipient)) = parse_bridge_memo(m) {
            let target_chain = transfer.target.address.chain;
            if chain_name_to_id(chain).ok() == Some(target_chain)
                && recipient == transfer.target.address.encoded
            {
                return true;
            }
        }
    }
    false
}

fn parse_bridge_memo(memo: &str) -> Option<(&str, &str)> {
    let rest = memo
        .strip_prefix("BRIDGE:")
        .or_else(|| memo.strip_prefix("bridge:"))?;
    let (chain, recipient) = rest.split_once(':')?;
    if chain.is_empty() || recipient.is_empty() {
        return None;
    }
    Some((chain, recipient))
}

fn chain_name_to_id(name: &str) -> MultichainResult<ChainId> {
    match name.to_lowercase().as_str() {
        "bitcoin" | "btc" => Ok(ChainId::Bitcoin),
        "base" => Ok(ChainId::Base),
        "ethereum" | "eth" => Ok(ChainId::Ethereum),
        "zion-l1" | "zion" | "zionl1" => Ok(ChainId::ZionL1),
        _ => Err(MultichainError::AdapterNotFound(name.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use async_trait::async_trait;

    use zion_l1_types::{Address, Amount, Asset, ChainFamily, ChainId, Hash};

    use crate::chain::{ChainAdapter, ChainAdapterRegistry, DepositEvent};
    use crate::types::{Transfer, TransferDirection, TransferEndpoint, TransferStatus};

    use super::*;

    struct MockAdapter {
        name: &'static str,
        chain: ChainId,
        events: Vec<DepositEvent>,
    }

    impl MockAdapter {
        fn new(name: &'static str, chain: ChainId, events: Vec<DepositEvent>) -> Self {
            Self {
                name,
                chain,
                events,
            }
        }
    }

    #[async_trait]
    impl ChainAdapter for MockAdapter {
        fn name(&self) -> &str {
            self.name
        }

        fn family(&self) -> ChainFamily {
            self.chain.family()
        }

        async fn health_check(&self) -> MultichainResult<bool> {
            Ok(true)
        }

        async fn watch_events(&self) -> MultichainResult<Vec<DepositEvent>> {
            Ok(self.events.clone())
        }

        async fn execute_outbound(&self, _transfer: &Transfer) -> MultichainResult<Hash> {
            Ok(Hash::default())
        }

        async fn current_height(&self) -> MultichainResult<u64> {
            Ok(1)
        }

        async fn confirmations(&self, _tx_hash: &Hash) -> MultichainResult<u64> {
            Ok(1)
        }

        async fn send_payment(&self, _to: &Address, _amount: Amount) -> MultichainResult<Hash> {
            Ok(Hash::default())
        }

        async fn balance(&self, _address: &Address) -> MultichainResult<Amount> {
            Ok(Amount::ZERO)
        }
    }

    fn make_registry(
        zion_events: Vec<DepositEvent>,
        base_events: Vec<DepositEvent>,
    ) -> ChainAdapterRegistry {
        let mut registry = ChainAdapterRegistry::new();
        registry.register(
            ChainId::ZionL1,
            Box::new(MockAdapter::new("zion", ChainId::ZionL1, zion_events)),
        );
        registry.register(
            ChainId::Base,
            Box::new(MockAdapter::new("base", ChainId::Base, base_events)),
        );
        registry
    }

    fn endpoint(chain: ChainId, encoded: &str, asset: Asset, amount: Amount) -> TransferEndpoint {
        let bytes = match chain.family() {
            ChainFamily::Evm => vec![0u8; 20],
            _ => vec![0x1u8; 20],
        };
        TransferEndpoint {
            address: Address::new(chain, bytes, encoded).unwrap(),
            asset,
            amount,
        }
    }

    #[tokio::test]
    async fn lock_mint_completes_with_event() {
        let id = "lock-mint-test";
        let source = endpoint(
            ChainId::ZionL1,
            "zion1source",
            Asset::native(ChainId::ZionL1, "ZION", 6, "ZION"),
            Amount::new(1_000_000),
        );
        let target = endpoint(
            ChainId::Base,
            "0xTarget",
            Asset::native(ChainId::Base, "wZION", 6, "Wrapped ZION"),
            Amount::new(1_000_000),
        );
        let event = DepositEvent {
            chain: ChainId::ZionL1,
            tx_hash: Hash::default(),
            recipient: source.address.clone(),
            amount: source.amount,
            memo: Some(format!("bridge:{id}")),
            confirmations: 1,
            asset: None,
        };
        let registry = make_registry(vec![event], vec![]);
        let bridge = Bridge::new(Arc::new(registry));
        let mut transfer = Transfer::new(id, TransferDirection::LockMint, source, target);

        let result = bridge.submit(&mut transfer).await;

        assert!(result.is_ok());
        assert_eq!(transfer.status, TransferStatus::Completed);
    }

    #[tokio::test]
    async fn lock_mint_errors_when_no_event() {
        let id = "lock-mint-fallback";
        let source = endpoint(
            ChainId::ZionL1,
            "zion1source",
            Asset::native(ChainId::ZionL1, "ZION", 6, "ZION"),
            Amount::new(1_000_000),
        );
        let target = endpoint(
            ChainId::Base,
            "0xTarget",
            Asset::native(ChainId::Base, "wZION", 6, "Wrapped ZION"),
            Amount::new(1_000_000),
        );
        let registry = make_registry(vec![], vec![]);
        let bridge = Bridge::new(Arc::new(registry));
        let mut transfer = Transfer::new(id, TransferDirection::LockMint, source, target);

        let result = bridge.submit(&mut transfer).await;

        assert!(matches!(
            result,
            Err(MultichainError::Validation(_))
        ));
    }

    #[tokio::test]
    async fn burn_release_completes_with_event() {
        let id = "burn-release-test";
        let source = endpoint(
            ChainId::Base,
            "0xSource",
            Asset::native(ChainId::Base, "wZION", 6, "Wrapped ZION"),
            Amount::new(1_000_000),
        );
        let target = endpoint(
            ChainId::ZionL1,
            "zion1target",
            Asset::native(ChainId::ZionL1, "ZION", 6, "ZION"),
            Amount::new(1_000_000),
        );
        let event = DepositEvent {
            chain: ChainId::Base,
            tx_hash: Hash::default(),
            recipient: source.address.clone(),
            amount: source.amount,
            memo: Some(format!("bridge:{id}")),
            confirmations: 1,
            asset: None,
        };
        let registry = make_registry(vec![], vec![event]);
        let bridge = Bridge::new(Arc::new(registry));
        let mut transfer = Transfer::new(id, TransferDirection::BurnRelease, source, target);

        let result = bridge.submit(&mut transfer).await;

        assert!(result.is_ok());
        assert_eq!(transfer.status, TransferStatus::Completed);
    }

    #[tokio::test]
    async fn unsupported_direction_returns_error() {
        let id = "unsupported";
        let source = endpoint(
            ChainId::ZionL1,
            "zion1source",
            Asset::native(ChainId::ZionL1, "ZION", 6, "ZION"),
            Amount::new(1_000_000),
        );
        let target = endpoint(
            ChainId::Base,
            "0xTarget",
            Asset::native(ChainId::Base, "wZION", 6, "Wrapped ZION"),
            Amount::new(1_000_000),
        );
        let registry = make_registry(vec![], vec![]);
        let bridge = Bridge::new(Arc::new(registry));
        let mut transfer = Transfer::new(id, TransferDirection::Htlc, source, target);

        let result = bridge.submit(&mut transfer).await;

        assert!(matches!(result, Err(MultichainError::Unsupported(_))));
    }
}
