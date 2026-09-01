//! Custodial swap executor that debits/credits the internal ledger and
//! optionally settles the output token on-chain.
//!
//! This is the E2E layer for ZionDex: it runs the local `DexRouter` to price a
//! swap, updates pool reserves, moves the user's internal balances, and — when
//! a `recipient` is supplied — sends the output token from the L2 hot wallet
//! using the chain's adapter.
//!
//! Non-custodial HTLC swap methods are also provided for two-sided atomic
//! cross-chain swaps where the user locks funds on the source chain and the L2
//! operator locks the target output on the target chain.

use std::sync::Arc;

use tokio::sync::{Mutex, RwLock};
use zion_l1_types::{Address, Amount, Asset, ChainId, Hash};

use crate::chain::ChainAdapterRegistry;
use crate::db::Db;
use crate::error::{MultichainError, MultichainResult};
use crate::multichain_wallet::journal::JournalLedger;
use crate::multichain_wallet::ledger::WalletLedger;
use crate::multichain_wallet::types::{DexOrder, DexOrderStatus};
use crate::swap::dex::DexRouter;
use crate::swap::htlc::HtlcSwap;
use crate::types::{Transfer, TransferDirection, TransferEndpoint};

/// Executor for user-facing DEX swaps against the custodial multichain wallet.
#[derive(Clone)]
pub struct SwapExecutor {
    db: Arc<Mutex<Db>>,
    adapters: Arc<ChainAdapterRegistry>,
    ledger: WalletLedger,
    /// Optional journal ledger for atomic credit/debit with audit trail.
    /// When set, all swap-related balance changes use atomic journal entries
    /// instead of the plain `WalletLedger`.
    journal: Option<JournalLedger>,
    router: Arc<RwLock<DexRouter>>,
    htlc: Option<HtlcSwap>,
}

/// Parameters for a non-custodial two-sided HTLC swap.
#[derive(Clone, Debug)]
pub struct HtlcSwapRequest {
    pub amount_in: Amount,
    pub min_amount_out: Amount,
    pub hashlock: Hash,
    pub target_timelock: u64,
    /// Operator's target-chain wallet address (the locker side).
    pub operator_target_address: Address,
    /// User's target-chain address (the claim side).
    pub target_recipient: Address,
    /// Optional user source-chain details. If provided they are recorded on the
    /// target-side HTLC record so the operator can claim the source lock later.
    pub source_user_address: Option<String>,
    pub source_chain: Option<ChainId>,
    pub source_amount: Option<Amount>,
    pub source_timelock: Option<u64>,
    pub source_lock_tx_id: Option<String>,
    pub source_refund_pubkey: Option<[u8; 32]>,
    pub source_claimant_pubkey: Option<[u8; 32]>,
    pub target_refund_pubkey: Option<[u8; 32]>,
    pub target_claimant_pubkey: Option<[u8; 32]>,
}

impl SwapExecutor {
    pub fn new(
        db: Arc<Mutex<Db>>,
        adapters: Arc<ChainAdapterRegistry>,
        ledger: WalletLedger,
        router: Arc<RwLock<DexRouter>>,
    ) -> Self {
        Self {
            db,
            adapters,
            ledger,
            journal: None,
            router,
            htlc: None,
        }
    }

    /// Attach a `JournalLedger` for atomic credit/debit with audit trail.
    pub fn with_journal(mut self, journal: JournalLedger) -> Self {
        self.journal = Some(journal);
        self
    }

    /// Attach an `HtlcSwap` coordinator to enable non-custodial HTLC swaps.
    pub fn with_htlc(mut self, htlc: HtlcSwap) -> Self {
        self.htlc = Some(htlc);
        self
    }

    /// Execute a swap for `user_id`.
    ///
    /// 1. Debit `from` from the user's ledger.
    /// 2. Quote and execute against the in-memory `DexRouter`.
    /// 3. If `recipient` is `Some`, send the output token from the L2 hot
    ///    wallet to that address (on-chain settlement).
    /// 4. Otherwise credit the output token to the user's internal ledger.
    pub async fn execute_swap(
        &self,
        user_id: &str,
        from: &Asset,
        to: &Asset,
        amount: Amount,
        min_amount_out: Amount,
        recipient: Option<Address>,
    ) -> MultichainResult<DexOrder> {
        let order_id = uuid::Uuid::new_v4().to_string();
        let mut order = DexOrder {
            id: order_id.clone(),
            user_id: user_id.to_string(),
            from_asset_key: from.id.to_string(),
            to_asset_key: to.id.to_string(),
            amount_in: amount,
            amount_out: Amount::ZERO,
            min_amount_out,
            recipient_address: recipient.as_ref().map(|r| r.encoded.clone()),
            route: Vec::new(),
            tx_hash: None,
            htlc_hash: None,
            status: DexOrderStatus::Pending,
            created_at: chrono::Utc::now(),
            executed_at: None,
        };

        // 1. Debit input from the user's ledger (atomic journal if available).
        self.debit(user_id, from, amount, "swap", Some(&order_id)).await?;

        // 2. Quote and execute against the router.
        let mut router = self.router.write().await;
        let quote = match router.quote_multi(from, to, amount, 1, 4) {
            Ok(mut quotes) => quotes.pop().ok_or_else(|| {
                MultichainError::Unsupported(format!("no route from {} to {}", from.id, to.id))
            })?,
            Err(e) => {
                drop(router);
                self.credit(user_id, from, amount, "swap_refund", Some(&order.id)).await?;
                order.status = DexOrderStatus::Failed;
                self.save_order(&order).await?;
                return Err(e);
            }
        };

        if quote.expected_out < min_amount_out {
            drop(router);
            self.credit(user_id, from, amount, "swap_refund", Some(&order.id)).await?;
            order.status = DexOrderStatus::Failed;
            self.save_order(&order).await?;
            return Err(MultichainError::Validation(format!(
                "slippage: expected {} but min was {}",
                quote.expected_out.0, min_amount_out.0
            )));
        }

        // Phase 5: execute the full route hop-by-hop (AMM or 1:1 bridge pools).
        //
        // If the route is a single hop and the matching pool has an on-chain
        // `amm_pair` contract, execute the swap on-chain via the AMM and send
        // the output directly to the recipient (or hot wallet if custodial).
        // Otherwise, fall back to the in-memory AMM execution.
        let on_chain_pair = if quote.route.len() == 2 {
            router.find_pool(&quote.route[0], &quote.route[1])
        } else {
            None
        };

        let on_chain_amm = on_chain_pair
            .as_ref()
            .and_then(|p| p.amm_pair.clone())
            .filter(|_| {
                // Only use on-chain AMM for same-chain swaps on EVM chains.
                from.id.chain == to.id.chain
            });

        let amount_out = if let Some(ref pair_addr) = on_chain_amm {
            // On-chain AMM swap: send input from hot wallet to the pair
            // contract, swap, and send output to the recipient or back to
            // the hot wallet (custodial case).
            drop(router);

            let adapter = self.adapters.get(to.id.chain).ok_or_else(|| {
                MultichainError::AdapterNotFound(to.id.chain.as_str().to_string())
            })?;

            // The recipient for on-chain swap output: user-supplied recipient
            // or the hot wallet itself (custodial — output stays on hot
            // wallet, internal ledger is credited separately).
            let swap_recipient = match &recipient {
                Some(r) => r.clone(),
                None => {
                    // Custodial: send output back to the hot wallet address.
                    // We use a zero address placeholder; the adapter will use
                    // its own wallet address as the recipient.
                    Address {
                        chain: to.id.chain,
                        bytes: Vec::new(),
                        encoded: String::new(),
                    }
                }
            };

            match adapter
                .amm_swap(&pair_addr, from, to, amount, &swap_recipient)
                .await
            {
                Ok((tx_hash, out)) => {
                    order.tx_hash = Some(tx_hash.to_hex());
                    out
                }
                Err(e) => {
                    self.credit(user_id, from, amount, "swap_refund", Some(&order.id)).await?;
                    order.status = DexOrderStatus::Failed;
                    self.save_order(&order).await?;
                    return Err(e);
                }
            }
        } else {
            // In-memory AMM execution (custodial).
            let mut current = amount;
            for window in quote.route.windows(2) {
                let from_id = &window[0];
                let to_id = &window[1];
                let hop_from = router.find_asset(from_id).ok_or_else(|| {
                    MultichainError::Unsupported(format!("unknown hop asset {from_id}"))
                })?;
                let hop_to = router.find_asset(to_id).ok_or_else(|| {
                    MultichainError::Unsupported(format!("unknown hop asset {to_id}"))
                })?;
                current = match router.execute(&hop_from, &hop_to, current) {
                    Ok(out) => out,
                    Err(e) => {
                        drop(router);
                        self.credit(user_id, from, amount, "swap_refund", Some(&order.id)).await?;
                        order.status = DexOrderStatus::Failed;
                        self.save_order(&order).await?;
                        return Err(e);
                    }
                };
            }
            drop(router);
            current
        };

        if amount_out < min_amount_out {
            // This should not happen after the quote check, but keep the user safe.
            self.credit(user_id, from, amount, "swap_refund", Some(&order.id)).await?;
            order.status = DexOrderStatus::Failed;
            self.save_order(&order).await?;
            return Err(MultichainError::Validation(
                "executed amount below minimum".to_string(),
            ));
        }

        order.amount_out = amount_out;
        order.route = quote.route.iter().map(|a| a.to_string()).collect();
        order.status = DexOrderStatus::Executed;
        order.executed_at = Some(chrono::Utc::now());

        // 3. On-chain settlement if a recipient was supplied.
        if let Some(recipient) = recipient {
            if recipient.chain != to.id.chain {
                self.credit(user_id, from, amount, "swap_refund", Some(&order.id)).await?;
                order.status = DexOrderStatus::Failed;
                self.save_order(&order).await?;
                return Err(MultichainError::Validation(format!(
                    "recipient chain {} does not match output chain {}",
                    recipient.chain.as_str(),
                    to.id.chain.as_str()
                )));
            }

            // If the swap was already executed on-chain via the AMM, the
            // output was sent directly to the recipient — no additional
            // transfer needed.
            if order.tx_hash.is_some() && on_chain_amm.is_some() {
                order.status = DexOrderStatus::Settled;
            } else {
                let adapter = self.adapters.get(to.id.chain).ok_or_else(|| {
                    MultichainError::AdapterNotFound(to.id.chain.as_str().to_string())
                })?;

                match adapter.transfer_token(to, &recipient, amount_out).await {
                    Ok(tx_hash) => {
                        order.tx_hash = Some(tx_hash.to_hex());
                        order.status = DexOrderStatus::Settled;
                    }
                    Err(e) => {
                        // Credit the output token to the user's internal ledger so
                        // the swap is not lost; the operator can retry withdrawal.
                        self.credit(user_id, to, amount_out, "swap_output", Some(&order.id)).await?;
                        order.status = DexOrderStatus::Failed;
                        self.save_order(&order).await?;
                        return Err(e);
                    }
                }
            }
        } else {
            // 4. Keep the output on the internal ledger.
            self.credit(user_id, to, amount_out, "swap_output", Some(&order.id)).await?;
        }

        self.save_order(&order).await?;
        Ok(order)
    }

    async fn save_order(&self, order: &DexOrder) -> MultichainResult<()> {
        let db = self.db.lock().await;
        db.save_dex_order(order)
    }

    /// Debit using journal ledger (atomic + audit trail) if available,
    /// otherwise fall back to the plain WalletLedger.
    async fn debit(
        &self,
        user_id: &str,
        asset: &Asset,
        amount: Amount,
        reason: &str,
        reference_id: Option<&str>,
    ) -> MultichainResult<()> {
        if let Some(ref journal) = self.journal {
            journal.debit(user_id, asset, amount, reason, reference_id).await
        } else {
            self.ledger.debit(user_id, asset, amount).await
        }
    }

    /// Credit using journal ledger (atomic + audit trail) if available,
    /// otherwise fall back to the plain WalletLedger.
    async fn credit(
        &self,
        user_id: &str,
        asset: &Asset,
        amount: Amount,
        reason: &str,
        reference_id: Option<&str>,
    ) -> MultichainResult<()> {
        if let Some(ref journal) = self.journal {
            journal.credit(user_id, asset, amount, reason, reference_id).await
        } else {
            self.ledger.credit(user_id, asset, amount).await
        }
    }

    /// Load a previously created swap order.
    pub async fn get_order(&self, order_id: &str) -> MultichainResult<Option<DexOrder>> {
        let db = self.db.lock().await;
        db.load_dex_order(order_id)
    }

    /// List all swap orders for a user.
    pub async fn list_orders(&self, user_id: &str) -> MultichainResult<Vec<DexOrder>> {
        let db = self.db.lock().await;
        db.load_dex_orders_for_user(user_id)
    }

    /// Create a non-custodial two-sided HTLC swap order.
    ///
    /// The L2 operator locks the quoted target output on the target chain. The
    /// user is expected to have locked (or be about to lock) the source input
    /// on the source chain using the same `hashlock`.
    pub async fn execute_htlc_swap(
        &self,
        user_id: &str,
        from: &Asset,
        to: &Asset,
        req: &HtlcSwapRequest,
    ) -> MultichainResult<DexOrder> {
        let htlc = self.htlc.as_ref().ok_or_else(|| {
            MultichainError::Unsupported("HTLC swap coordinator not configured".to_string())
        })?;

        if req.operator_target_address.chain != to.id.chain {
            return Err(MultichainError::Validation(format!(
                "operator target address chain {} does not match target asset chain {}",
                req.operator_target_address.chain.as_str(),
                to.id.chain.as_str()
            )));
        }
        if req.target_recipient.chain != to.id.chain {
            return Err(MultichainError::Validation(format!(
                "target recipient chain {} does not match target asset chain {}",
                req.target_recipient.chain.as_str(),
                to.id.chain.as_str()
            )));
        }

        let order_id = uuid::Uuid::new_v4().to_string();
        let mut order = DexOrder {
            id: order_id,
            user_id: user_id.to_string(),
            from_asset_key: from.id.to_string(),
            to_asset_key: to.id.to_string(),
            amount_in: req.amount_in,
            amount_out: Amount::ZERO,
            min_amount_out: req.min_amount_out,
            recipient_address: Some(req.target_recipient.encoded.clone()),
            route: Vec::new(),
            tx_hash: None,
            htlc_hash: Some(req.hashlock.to_hex()),
            status: DexOrderStatus::HtlcLocked,
            created_at: chrono::Utc::now(),
            executed_at: None,
        };

        // 1. Price the swap. The target output is what the operator will lock.
        let router = self.router.write().await;
        let quote = match router.quote_multi(from, to, req.amount_in, 1, 4) {
            Ok(mut quotes) => quotes.pop().ok_or_else(|| {
                MultichainError::Unsupported(format!("no route from {} to {}", from.id, to.id))
            })?,
            Err(e) => {
                drop(router);
                order.status = DexOrderStatus::Failed;
                self.save_order(&order).await?;
                return Err(e);
            }
        };

        if quote.expected_out < req.min_amount_out {
            drop(router);
            order.status = DexOrderStatus::Failed;
            self.save_order(&order).await?;
            return Err(MultichainError::Validation(format!(
                "slippage: expected {} but min was {}",
                quote.expected_out.0, req.min_amount_out.0
            )));
        }

        let amount_out = quote.expected_out;
        order.amount_out = amount_out;
        order.route = quote.route.iter().map(|a| a.to_string()).collect();
        drop(router);

        // 2. Record the order before attempting the on-chain target lock.
        self.save_order(&order).await?;

        // 3. Lock the target-side HTLC from the operator's target wallet.
        let source_endpoint = TransferEndpoint {
            address: req.operator_target_address.clone(),
            asset: to.clone(),
            amount: amount_out,
        };
        let target_endpoint = TransferEndpoint {
            address: req.target_recipient.clone(),
            asset: to.clone(),
            amount: amount_out,
        };
        let mut transfer = Transfer::new(
            format!("htlc-lock-{}", req.hashlock.to_hex()),
            TransferDirection::Htlc,
            source_endpoint,
            target_endpoint,
        );
        transfer.hashlock = Some(req.hashlock);
        transfer.timelock = Some(req.target_timelock);
        transfer.source_pubkey = req.target_refund_pubkey;
        transfer.target_pubkey = req.target_claimant_pubkey;

        match htlc.initiate(&mut transfer).await {
            Ok(_) => {
                order.tx_hash = transfer.lock_tx_id;
                self.save_order(&order).await?;
            }
            Err(e) => {
                order.status = DexOrderStatus::Failed;
                self.save_order(&order).await?;
                return Err(e);
            }
        }

        // 4. Record source-side details if the user has already provided them.
        if let Some(source_chain) = req.source_chain {
            let source_address = req.source_user_address.clone().unwrap_or_default();
            let source_amount = req
                .source_amount
                .map(|a| a.0 as u64)
                .unwrap_or(req.amount_in.0 as u64);
            htlc.set_source_details(
                &req.hashlock.to_hex(),
                &source_address,
                source_chain.as_str(),
                source_amount,
                req.source_refund_pubkey,
                req.source_claimant_pubkey,
            )
            .await?;
        }

        if let Some(source_lock_tx_id) = req.source_lock_tx_id.as_deref() {
            let source_expires_at = req
                .source_timelock
                .ok_or_else(|| {
                    MultichainError::Validation(
                        "source timelock required when source lock tx is provided".to_string(),
                    )
                })?
                .try_into()
                .map_err(|_| {
                    MultichainError::Validation("source timelock out of range".to_string())
                })?;
            htlc.set_source_lock(&req.hashlock.to_hex(), source_lock_tx_id, source_expires_at)
                .await?;
        }

        Ok(order)
    }

    /// Record the user's source-side lock transaction on an existing HTLC swap order.
    pub async fn record_source_htlc_lock(
        &self,
        order_id: &str,
        source_lock_tx_id: &str,
        source_expires_at: u64,
    ) -> MultichainResult<DexOrder> {
        let htlc = self.htlc.as_ref().ok_or_else(|| {
            MultichainError::Unsupported("HTLC swap coordinator not configured".to_string())
        })?;

        let order = self
            .get_order(order_id)
            .await?
            .ok_or_else(|| MultichainError::Validation(format!("order {} not found", order_id)))?;
        if order.status != DexOrderStatus::HtlcLocked {
            return Err(MultichainError::Validation(format!(
                "order {} is not in htlc_locked state",
                order_id
            )));
        }
        let hash_hex = order
            .htlc_hash
            .as_deref()
            .ok_or_else(|| MultichainError::Validation("order missing htlc_hash".to_string()))?;

        htlc.set_source_lock(
            hash_hex,
            source_lock_tx_id,
            source_expires_at.try_into().map_err(|_| {
                MultichainError::Validation("source_expires_at out of range".to_string())
            })?,
        )
        .await?;

        Ok(order)
    }

    /// Claim the source-side HTLC after the user has revealed the preimage.
    pub async fn claim_htlc_swap(
        &self,
        order_id: &str,
        secret: &[u8],
        source_asset: &Asset,
        source_operator_recipient: &Address,
        source_user_address: Option<&Address>,
    ) -> MultichainResult<DexOrder> {
        let htlc = self.htlc.as_ref().ok_or_else(|| {
            MultichainError::Unsupported("HTLC swap coordinator not configured".to_string())
        })?;

        let mut order = self
            .get_order(order_id)
            .await?
            .ok_or_else(|| MultichainError::Validation(format!("order {} not found", order_id)))?;
        if order.status != DexOrderStatus::HtlcLocked {
            return Err(MultichainError::Validation(format!(
                "order {} is not in htlc_locked state",
                order_id
            )));
        }
        let hash_hex = order
            .htlc_hash
            .as_deref()
            .ok_or_else(|| MultichainError::Validation("order missing htlc_hash".to_string()))?;
        let hash = Hash::from_hex(hash_hex)
            .ok_or_else(|| MultichainError::Validation("invalid htlc_hash".to_string()))?;

        let record = htlc
            .get_record(hash_hex)
            .await
            .ok_or_else(|| MultichainError::TransferNotFound(hash_hex.to_string()))?;
        if record.source_lock_tx_id.is_none() {
            return Err(MultichainError::Validation(
                "source lock not recorded for HTLC swap".to_string(),
            ));
        }

        let source_endpoint = TransferEndpoint {
            address: source_user_address.cloned().unwrap_or_else(|| {
                // Fallback: a placeholder on the source chain is enough for the adapter.
                Address::new(
                    source_asset.id.chain,
                    Vec::new(),
                    &source_operator_recipient.encoded,
                )
                .unwrap_or_else(|_| source_operator_recipient.clone())
            }),
            asset: source_asset.clone(),
            amount: order.amount_in,
        };
        let target_endpoint = TransferEndpoint {
            address: source_operator_recipient.clone(),
            asset: source_asset.clone(),
            amount: order.amount_in,
        };
        let mut transfer = Transfer::new(
            format!("htlc-claim-{}", hash_hex),
            TransferDirection::Htlc,
            source_endpoint,
            target_endpoint,
        );
        transfer.hashlock = Some(hash);

        htlc.claim_source(secret, &source_operator_recipient.encoded, &mut transfer)
            .await?;

        let record = htlc
            .get_record(hash_hex)
            .await
            .ok_or_else(|| MultichainError::TransferNotFound(hash_hex.to_string()))?;
        order.status = DexOrderStatus::HtlcSettled;
        order.tx_hash = record.release_tx_id;
        order.executed_at = Some(chrono::Utc::now());
        self.save_order(&order).await?;

        Ok(order)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use sha2::{Digest, Sha256};
    use zion_l1_types::{Address, AssetId, ChainFamily, ChainId, Hash};

    use crate::chain::adapter::{ChainAdapter, DepositEvent};
    use crate::chain::ChainAdapterRegistry;
    use crate::multichain_wallet::ledger::WalletLedger;
    use crate::swap::dex::{DexRouter, Pool};
    use crate::swap::htlc::HtlcSwap;

    struct MockAdapter {
        family: ChainFamily,
        transfer_token_calls: std::sync::Arc<std::sync::Mutex<Vec<(String, String, u128)>>>,
    }

    impl Default for MockAdapter {
        fn default() -> Self {
            Self {
                family: ChainFamily::Evm,
                transfer_token_calls: std::sync::Arc::new(std::sync::Mutex::new(Vec::new())),
            }
        }
    }

    impl MockAdapter {
        fn new(family: ChainFamily) -> Self {
            Self {
                family,
                transfer_token_calls: std::sync::Arc::new(std::sync::Mutex::new(Vec::new())),
            }
        }
    }

    #[async_trait]
    impl ChainAdapter for MockAdapter {
        fn name(&self) -> &str {
            "mock"
        }

        fn family(&self) -> ChainFamily {
            self.family
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
            self.transfer_token_calls.lock().unwrap().push((
                token.id.to_string(),
                to.encoded.clone(),
                amount.0,
            ));
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

    fn evm_asset(chain: ChainId, ticker: &str, contract: &str) -> Asset {
        Asset {
            id: AssetId::new(chain, ticker, Some(contract.to_string())),
            decimals: 18,
            name: ticker.to_string(),
        }
    }

    #[tokio::test]
    async fn internal_swap_updates_ledger_and_pool_reserves() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let mut dex = DexRouter::new();
        let zion = Asset::native(ChainId::ZionL1, "ZION", 6, "ZION");
        let usdc = Asset::native(ChainId::ZionL1, "USDC", 6, "USD Coin");

        dex.add_pool(Pool {
            id: 1,
            asset_a: zion.clone(),
            asset_b: usdc.clone(),
            reserve_a: Amount::new(100_000_000_000),
            reserve_b: Amount::new(1_000_000_000_000),
            fee_bps: 30,
            amm_pair: None,
            amm_factory: None,
        });

        let user_id = "user1";
        ledger
            .credit(user_id, &zion, Amount::new(10_000_000))
            .await
            .unwrap();

        let adapters = ChainAdapterRegistry::new();
        let executor = SwapExecutor::new(
            Arc::clone(&db),
            Arc::new(adapters),
            ledger.clone(),
            Arc::new(RwLock::new(dex)),
        );

        let order = executor
            .execute_swap(
                user_id,
                &zion,
                &usdc,
                Amount::new(1_000_000),
                Amount::ZERO,
                None,
            )
            .await
            .unwrap();

        assert_eq!(order.status, DexOrderStatus::Executed);
        assert!(order.amount_out.0 > 0);

        let zion_balance = ledger.balance(user_id, &zion).await.unwrap();
        assert_eq!(zion_balance.0, 9_000_000);

        let usdc_balance = ledger.balance(user_id, &usdc).await.unwrap();
        assert_eq!(usdc_balance.0, order.amount_out.0);
    }

    #[tokio::test]
    async fn external_settlement_calls_adapter_transfer_token() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let mut dex = DexRouter::new();
        let base = ChainId::Base;
        let wzion = evm_asset(base, "wZION", "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6");
        let usdc = evm_asset(base, "USDC", "0xA0b86a33E6B8");

        dex.add_pool(Pool {
            id: 1,
            asset_a: wzion.clone(),
            asset_b: usdc.clone(),
            reserve_a: Amount::new(100_000_000_000_000_000_000_000u128),
            reserve_b: Amount::new(1_000_000_000_000_000),
            fee_bps: 30,
            amm_pair: None,
            amm_factory: None,
        });

        let user_id = "user1";
        ledger
            .credit(user_id, &wzion, Amount::new(10_000_000_000_000_000_000u128))
            .await
            .unwrap();

        let mut adapters = ChainAdapterRegistry::new();
        let mock = MockAdapter::default();
        let calls = mock.transfer_token_calls.clone();
        adapters.register(base, Box::new(mock));

        let executor = SwapExecutor::new(
            Arc::clone(&db),
            Arc::new(adapters),
            ledger.clone(),
            Arc::new(RwLock::new(dex)),
        );

        let recipient = Address::new(
            base,
            vec![0u8; 20],
            "0x0000000000000000000000000000000000000001",
        )
        .unwrap();

        let order = executor
            .execute_swap(
                user_id,
                &wzion,
                &usdc,
                Amount::new(1_000_000_000_000_000_000u128),
                Amount::ZERO,
                Some(recipient.clone()),
            )
            .await
            .unwrap();

        assert_eq!(order.status, DexOrderStatus::Settled);
        assert!(order.tx_hash.is_some());

        let recorded = calls.lock().unwrap();
        assert_eq!(recorded.len(), 1);
        assert_eq!(recorded[0].0, usdc.id.to_string());
        assert_eq!(recorded[0].1, recipient.encoded);
        assert_eq!(recorded[0].2, order.amount_out.0);
    }

    #[tokio::test]
    async fn zion_to_btc_swap_settles_on_bitcoin() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let mut dex = DexRouter::new();
        let zion = Asset::native(ChainId::ZionL1, "ZION", 6, "ZION");
        let btc = Asset::native(ChainId::Bitcoin, "BTC", 8, "Bitcoin");

        dex.add_pool(Pool {
            id: 1,
            asset_a: zion.clone(),
            asset_b: btc.clone(),
            reserve_a: Amount::new(100_000_000_000),
            reserve_b: Amount::new(10_000_000_000),
            fee_bps: 30,
            amm_pair: None,
            amm_factory: None,
        });

        let user_id = "user1";
        ledger
            .credit(user_id, &zion, Amount::new(10_000_000))
            .await
            .unwrap();

        let mut adapters = ChainAdapterRegistry::new();
        let mock = MockAdapter::new(ChainFamily::Utxo);
        let calls = mock.transfer_token_calls.clone();
        adapters.register(ChainId::Bitcoin, Box::new(mock));

        let executor = SwapExecutor::new(
            Arc::clone(&db),
            Arc::new(adapters),
            ledger.clone(),
            Arc::new(RwLock::new(dex)),
        );

        let recipient = Address::new(ChainId::Bitcoin, Vec::new(), "bc1qrecipient").unwrap();

        let order = executor
            .execute_swap(
                user_id,
                &zion,
                &btc,
                Amount::new(1_000_000),
                Amount::ZERO,
                Some(recipient.clone()),
            )
            .await
            .unwrap();

        assert_eq!(order.status, DexOrderStatus::Settled);
        assert!(order.amount_out.0 > 0);
        assert_eq!(order.route, vec![zion.id.to_string(), btc.id.to_string()]);

        let recorded = calls.lock().unwrap();
        assert_eq!(recorded.len(), 1);
        assert_eq!(recorded[0].0, btc.id.to_string());
        assert_eq!(recorded[0].1, recipient.encoded);
        assert_eq!(recorded[0].2, order.amount_out.0);

        let zion_balance = ledger.balance(user_id, &zion).await.unwrap();
        assert_eq!(zion_balance.0, 9_000_000);
    }

    #[tokio::test]
    async fn btc_to_zion_swap_settles_on_zion_l1() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let mut dex = DexRouter::new();
        let zion = Asset::native(ChainId::ZionL1, "ZION", 6, "ZION");
        let btc = Asset::native(ChainId::Bitcoin, "BTC", 8, "Bitcoin");

        dex.add_pool(Pool {
            id: 1,
            asset_a: zion.clone(),
            asset_b: btc.clone(),
            reserve_a: Amount::new(100_000_000_000),
            reserve_b: Amount::new(10_000_000_000),
            fee_bps: 30,
            amm_pair: None,
            amm_factory: None,
        });

        let user_id = "user1";
        ledger
            .credit(user_id, &btc, Amount::new(100_000))
            .await
            .unwrap();

        let mut adapters = ChainAdapterRegistry::new();
        let mock = MockAdapter::new(ChainFamily::Zion);
        let calls = mock.transfer_token_calls.clone();
        adapters.register(ChainId::ZionL1, Box::new(mock));

        let executor = SwapExecutor::new(
            Arc::clone(&db),
            Arc::new(adapters),
            ledger.clone(),
            Arc::new(RwLock::new(dex)),
        );

        let recipient = Address::new(ChainId::ZionL1, Vec::new(), "zion1recipient").unwrap();

        let order = executor
            .execute_swap(
                user_id,
                &btc,
                &zion,
                Amount::new(100_000),
                Amount::ZERO,
                Some(recipient.clone()),
            )
            .await
            .unwrap();

        assert_eq!(order.status, DexOrderStatus::Settled);
        assert!(order.amount_out.0 > 0);
        assert_eq!(order.route, vec![btc.id.to_string(), zion.id.to_string()]);

        let recorded = calls.lock().unwrap();
        assert_eq!(recorded.len(), 1);
        assert_eq!(recorded[0].0, zion.id.to_string());
        assert_eq!(recorded[0].1, recipient.encoded);
        assert_eq!(recorded[0].2, order.amount_out.0);
    }

    #[tokio::test]
    async fn cross_chain_bridge_hop_then_amm_settles_on_target_chain() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let mut dex = DexRouter::new();

        let zion = Asset::native(ChainId::ZionL1, "ZION", 6, "ZION");
        let wzion = Asset::with_contract(
            ChainId::Base,
            "wZION",
            "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6",
            18,
            "Wrapped ZION",
        );
        let usdc = Asset::with_contract(ChainId::Base, "USDC", "0xA0b86a33E6B8", 6, "USD Coin");

        // Bridge edge: ZION (ZionL1) <-> wZION (Base)
        dex.add_bridge_edge(zion.clone(), wzion.clone(), 10);

        // AMM pool on Base: wZION / USDC
        dex.add_pool(Pool {
            id: 2,
            asset_a: wzion.clone(),
            asset_b: usdc.clone(),
            reserve_a: Amount::new(100_000_000_000_000_000_000_000u128),
            reserve_b: Amount::new(1_000_000_000_000),
            fee_bps: 30,
            amm_pair: None,
            amm_factory: None,
        });

        let user_id = "user1";
        ledger
            .credit(user_id, &zion, Amount::new(10_000_000))
            .await
            .unwrap();

        let mut adapters = ChainAdapterRegistry::new();
        let mock = MockAdapter::new(ChainFamily::Evm);
        let calls = mock.transfer_token_calls.clone();
        adapters.register(ChainId::Base, Box::new(mock));

        let executor = SwapExecutor::new(
            Arc::clone(&db),
            Arc::new(adapters),
            ledger.clone(),
            Arc::new(RwLock::new(dex)),
        );

        let recipient = Address::new(
            ChainId::Base,
            vec![0u8; 20],
            "0x0000000000000000000000000000000000000002",
        )
        .unwrap();

        let order = executor
            .execute_swap(
                user_id,
                &zion,
                &usdc,
                Amount::new(10_000_000),
                Amount::ZERO,
                Some(recipient.clone()),
            )
            .await
            .unwrap();

        assert_eq!(order.status, DexOrderStatus::Settled);
        assert!(order.amount_out.0 > 0);
        assert_eq!(order.route.len(), 3);

        let recorded = calls.lock().unwrap();
        assert_eq!(recorded.len(), 1);
        assert_eq!(recorded[0].0, usdc.id.to_string());
        assert_eq!(recorded[0].1, recipient.encoded);
        assert_eq!(recorded[0].2, order.amount_out.0);

        let zion_balance = ledger.balance(user_id, &zion).await.unwrap();
        assert_eq!(zion_balance.0, 0);
    }

    #[tokio::test]
    async fn htlc_swap_locks_target_then_claims_source() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ledger = WalletLedger::new(Arc::clone(&db));
        let mut dex = DexRouter::new();

        let btc = Asset::native(ChainId::Bitcoin, "BTC", 8, "Bitcoin");
        let wzion = Asset::with_contract(
            ChainId::Base,
            "wZION",
            "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6",
            18,
            "Wrapped ZION",
        );

        // 1:1 bridge pool so the quoted target amount is close to the source amount.
        dex.add_bridge_edge(btc.clone(), wzion.clone(), 0);

        let mut adapters = ChainAdapterRegistry::new();
        adapters.register(ChainId::Base, Box::new(MockAdapter::new(ChainFamily::Evm)));
        adapters.register(
            ChainId::Bitcoin,
            Box::new(MockAdapter::new(ChainFamily::Utxo)),
        );

        let adapters = Arc::new(adapters);
        let htlc = HtlcSwap::with_db(Arc::clone(&adapters), Arc::clone(&db));
        let executor = SwapExecutor::new(
            Arc::clone(&db),
            Arc::clone(&adapters),
            ledger.clone(),
            Arc::new(RwLock::new(dex)),
        )
        .with_htlc(htlc.clone());

        // User and operator addresses.
        let operator_target = Address::new(
            ChainId::Base,
            vec![0u8; 20],
            "0x0000000000000000000000000000000000000001",
        )
        .unwrap();
        let target_recipient = Address::new(
            ChainId::Base,
            vec![0u8; 20],
            "0x0000000000000000000000000000000000000002",
        )
        .unwrap();
        let operator_source = Address::new(ChainId::Bitcoin, Vec::new(), "bc1qoperator").unwrap();

        // HTLC secret + hash.
        let secret = [0xABu8; 32];
        let hashlock = Hash::new(Sha256::digest(&secret).into());
        let far_future = chrono::Utc::now().timestamp() as u64 + 3_600;

        let req = HtlcSwapRequest {
            amount_in: Amount::new(100_000),
            min_amount_out: Amount::ZERO,
            hashlock,
            target_timelock: far_future,
            operator_target_address: operator_target,
            target_recipient,
            source_user_address: Some("bc1quser".to_string()),
            source_chain: Some(ChainId::Bitcoin),
            source_amount: None,
            source_timelock: Some(far_future + 3_600),
            source_lock_tx_id: Some("deadbeef".to_string()),
            source_refund_pubkey: None,
            source_claimant_pubkey: None,
            target_refund_pubkey: None,
            target_claimant_pubkey: None,
        };

        let order = executor
            .execute_htlc_swap("user1", &btc, &wzion, &req)
            .await
            .unwrap();

        assert_eq!(order.status, DexOrderStatus::HtlcLocked);
        assert!(order.amount_out.0 > 0);
        assert_eq!(order.htlc_hash, Some(hashlock.to_hex()));
        assert!(order.tx_hash.is_some());

        let record = htlc.get_record(&hashlock.to_hex()).await.unwrap();
        assert_eq!(record.state, crate::swap::htlc::SwapState::Pending);
        assert_eq!(record.source_address, Some("bc1quser".to_string()));
        assert_eq!(record.source_lock_tx_id, Some("deadbeef".to_string()));

        // Operator claims the source-side HTLC after the user revealed the secret.
        let order = executor
            .claim_htlc_swap(
                &order.id,
                &secret,
                &btc,
                &operator_source,
                Some(&Address::new(ChainId::Bitcoin, Vec::new(), "bc1quser").unwrap()),
            )
            .await
            .unwrap();

        assert_eq!(order.status, DexOrderStatus::HtlcSettled);
        assert!(order.tx_hash.is_some());
    }
}
