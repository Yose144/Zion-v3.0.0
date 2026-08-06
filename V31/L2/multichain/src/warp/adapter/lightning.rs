use crate::warp::adapter::ChainAdapter;
use crate::warp::bolt11::Bolt11Invoice;
use crate::warp::config::ChainConfig;
use crate::warp::error::{WarpError, WarpResult};
use crate::warp::lightning_signer::LndClient;
use crate::warp::protocol::{DepositProof, MintInstruction};
use crate::warp::types::ChainFamily;
use async_trait::async_trait;
use tracing::{debug, info, warn};

/// Docker-compose file path for the Lightning stack (referenced in error messages).
const LN_DOCKER_PATH: &str = "V31/L2/multichain/docker/lightning/docker-compose.yml";

/// Helper to build an error message that points to the Docker setup.
fn ln_setup_error(reason: &str) -> WarpError {
    WarpError::AdapterError {
        chain: "lightning".into(),
        reason: format!(
            "{} — start LND via `docker compose -f {} up -d` and set WARP_LN_NODE_URL + WARP_LN_MACAROON (see V31/L2/multichain/docker/lightning/README.md)",
            reason, LN_DOCKER_PATH
        ),
    }
}

/// Bitcoin Lightning Network adapter.
///
/// Bridges ZION L1 to Lightning via BOLT11 invoices:
/// - Outbound: ZION user pays a Lightning invoice (ZION locked → BTC sent over LN)
/// - Inbound: Lightning payment triggers ZION mint on L1
///
/// Requires a connected LND node (REST proxy on port 8080).
/// See `V31/L2/multichain/docker/lightning/` for Docker setup instructions.
pub struct LightningAdapter {
    lnd: Option<LndClient>,
}

impl Default for LightningAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl LightningAdapter {
    pub fn new() -> Self {
        // Try to create LND client from env; if not configured, adapter stays in stub mode
        let lnd = match LndClient::from_env() {
            Ok(client) => {
                debug!("[WARP][LN] LND client configured from env");
                Some(client)
            }
            Err(_) => {
                debug!("[WARP][LN] No LND client configured — adapter in stub mode");
                None
            }
        };
        Self { lnd }
    }

    /// Create with an explicit LND client (for testing).
    pub fn with_lnd(lnd: LndClient) -> Self {
        Self { lnd: Some(lnd) }
    }

    /// Build from a `ChainConfig`.
    /// - `cfg.rpc_url` is used as the LND base URL.
    /// - `cfg.contract_address` is used as the macaroon hex; falls back to `WARP_LN_MACAROON` env.
    pub fn from_config(cfg: &ChainConfig) -> Self {
        if cfg.rpc_url.is_empty() {
            return Self::new();
        }
        let macaroon = cfg
            .contract_address
            .clone()
            .filter(|m| !m.is_empty())
            .or_else(|| std::env::var("WARP_LN_MACAROON").ok());
        let lnd = LndClient::new(&cfg.rpc_url, macaroon).ok();
        Self { lnd }
    }

    /// Check if LND is configured.
    pub fn has_lnd(&self) -> bool {
        self.lnd.is_some()
    }

    /// Decode a BOLT11 invoice using the pure-Rust parser.
    pub fn decode_invoice(&self, invoice: &str) -> WarpResult<Bolt11Invoice> {
        Bolt11Invoice::decode(invoice)
    }

    /// Create a BOLT11 invoice for inbound transfers via LND.
    pub async fn create_invoice(
        &self,
        amount_msat: u64,
        memo: &str,
        expiry: Option<u64>,
    ) -> WarpResult<String> {
        let lnd = self
            .lnd
            .as_ref()
            .ok_or_else(|| ln_setup_error("LND not configured — cannot create invoice"))?;

        let resp = lnd.add_invoice(amount_msat, memo, expiry).await?;
        resp.payment_request.ok_or_else(|| WarpError::AdapterError {
            chain: "lightning".into(),
            reason: "LND AddInvoice returned no payment_request".into(),
        })
    }

    /// Pay a BOLT11 invoice for outbound transfers via LND.
    pub async fn pay_invoice(&self, invoice: &str) -> WarpResult<String> {
        let lnd = self
            .lnd
            .as_ref()
            .ok_or_else(|| ln_setup_error("LND not configured — cannot pay invoice"))?;

        // Decode invoice first to validate it
        let parsed = self.decode_invoice(invoice)?;
        info!(
            "[WARP][LN] Paying invoice: {} sats, hash={}",
            parsed.amount_sats(),
            &parsed.payment_hash_hex[..16]
        );

        // Fee limit: 0.5% of amount, min 1000 msat
        let fee_limit = if parsed.amount_msat > 0 {
            Some((parsed.amount_msat / 200).max(1000))
        } else {
            Some(10_000) // default fee limit for any-amount invoices
        };

        let resp = lnd.send_payment(invoice, fee_limit, Some(60)).await?;

        // Return the payment preimage as proof
        let preimage = resp
            .payment_preimage
            .unwrap_or_else(|| format!("paid_{}", &parsed.payment_hash_hex[..16]));
        info!(
            "[WARP][LN] Payment settled: preimage={}",
            &preimage[..16.min(preimage.len())]
        );
        Ok(preimage)
    }

    /// Check if a payment hash has been settled.
    pub async fn is_payment_settled(&self, payment_hash_hex: &str) -> WarpResult<bool> {
        let lnd = self
            .lnd
            .as_ref()
            .ok_or_else(|| ln_setup_error("LND not configured — cannot check payment status"))?;
        lnd.is_settled(payment_hash_hex).await
    }
}

#[async_trait]
impl ChainAdapter for LightningAdapter {
    fn family(&self) -> ChainFamily {
        ChainFamily::Lightning
    }

    fn name(&self) -> &str {
        "lightning"
    }

    async fn health_check(&self) -> WarpResult<bool> {
        let lnd = match self.lnd.as_ref() {
            Some(l) => l,
            None => {
                warn!(
                    "[WARP][LN] Health check: LND not configured — start the Docker stack at {} and set WARP_LN_NODE_URL + WARP_LN_MACAROON",
                    LN_DOCKER_PATH
                );
                return Ok(false);
            }
        };

        // 1. Verify LND connectivity via GetInfo
        let info = match lnd.get_info().await {
            Ok(info) => info,
            Err(e) => {
                warn!(
                    "[WARP][LN] Health FAIL: cannot reach LND REST API — {} \
                    (check docker compose -f {} up -d)",
                    e, LN_DOCKER_PATH
                );
                return Ok(false);
            }
        };

        let synced = info.synced_to_chain.unwrap_or(false);
        let channels = info.num_active_channels.unwrap_or(0);
        let peers = info.num_peers.unwrap_or(0);

        if !synced {
            warn!(
                "[WARP][LN] Health WARN: LND not synced to chain (alias={:?} version={:?}) \
                — wait for bitcoind + LND IBD to complete",
                info.alias, info.version
            );
        }

        // 2. Check channel balance (outbound capacity)
        let outbound_msat = match lnd.outbound_capacity_msat().await {
            Ok(cap) => cap,
            Err(e) => {
                warn!(
                    "[WARP][LN] Health WARN: cannot query channel balance — {}",
                    e
                );
                0
            }
        };

        // 3. Check on-chain wallet balance
        let onchain_sat = match lnd.wallet_balance_sat().await {
            Ok(bal) => bal,
            Err(e) => {
                warn!(
                    "[WARP][LN] Health WARN: cannot query on-chain balance — {}",
                    e
                );
                0
            }
        };

        info!(
            "[WARP][LN] Health: alias={:?} channels={} peers={} synced={} \
            outbound={}msat onchain={}sat version={:?}",
            info.alias, channels, peers, synced, outbound_msat, onchain_sat, info.version
        );

        // Healthy = synced to chain AND has at least 1 active channel
        // (on-chain balance and outbound capacity are reported but not strictly required)
        Ok(synced && channels > 0)
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        // Lightning watch: poll settled invoices via LND
        // In a full implementation, we'd use SubscribeInvoiceEvents streaming
        // For now, we return empty — the router polls is_payment_settled per transfer
        let lnd = match self.lnd.as_ref() {
            Some(l) => l,
            None => {
                debug!("[WARP][LN] watch_events: LND not configured");
                return Ok(vec![]);
            }
        };

        // Check outbound capacity for health monitoring
        match lnd.outbound_capacity_msat().await {
            Ok(cap) => {
                debug!("[WARP][LN] Outbound capacity: {} msat", cap);
            }
            Err(e) => {
                warn!("[WARP][LN] Capacity check failed: {}", e);
            }
        }

        // Inbound invoices are tracked by the router via transfer IDs
        // This method returns empty for Lightning — settlements are polled
        // individually via is_payment_settled() in the confirmations() method
        Ok(vec![])
    }

    async fn execute_mint(&self, instruction: &MintInstruction) -> WarpResult<String> {
        // For outbound: pay the BOLT11 invoice specified in recipient field
        // The recipient field contains the BOLT11 invoice to pay
        let invoice = &instruction.recipient;

        // Validate it looks like a BOLT11 invoice
        if !invoice.starts_with("lnbc") && !invoice.starts_with("lntb") {
            return Err(WarpError::InvalidAddress {
                chain: "lightning".into(),
                address: format!(
                    "expected BOLT11 invoice (lnbc.../lntb...), got: {}",
                    &invoice[..invoice.len().min(40)]
                ),
            });
        }

        // Pay the invoice via LND
        self.pay_invoice(invoice).await
    }

    async fn current_height(&self) -> WarpResult<u64> {
        // Lightning has no block height; return LND's best known block height
        let lnd = match self.lnd.as_ref() {
            Some(l) => l,
            None => return Ok(0),
        };
        match lnd.get_info().await {
            Ok(info) => Ok(info.block_height.unwrap_or(0) as u64),
            Err(_) => Ok(0),
        }
    }

    async fn confirmations(&self, tx_hash: &str) -> WarpResult<u64> {
        // For Lightning, tx_hash is the payment hash (hex)
        // Return 1 if settled, 0 if pending
        let lnd = match self.lnd.as_ref() {
            Some(l) => l,
            None => return Ok(0),
        };
        match lnd.is_settled(tx_hash).await {
            Ok(true) => Ok(1),
            Ok(false) => Ok(0),
            Err(e) => {
                debug!("[WARP][LN] confirmations check failed: {}", e);
                Ok(0)
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::warp::protocol::MintInstruction;

    #[test]
    fn test_lightning_adapter_meta() {
        let a = LightningAdapter::new();
        assert_eq!(a.name(), "lightning");
        assert_eq!(a.family(), ChainFamily::Lightning);
    }

    #[test]
    fn test_lightning_adapter_no_lnd() {
        std::env::remove_var("WARP_LN_NODE_URL");
        let a = LightningAdapter::new();
        assert!(!a.has_lnd());
    }

    #[test]
    fn test_decode_invoice_invalid_prefix() {
        let a = LightningAdapter::new();
        assert!(a.decode_invoice("not_an_invoice").is_err());
    }

    #[test]
    fn test_decode_invoice_empty() {
        let a = LightningAdapter::new();
        assert!(a.decode_invoice("").is_err());
    }

    #[tokio::test]
    async fn test_health_check_no_lnd() {
        std::env::remove_var("WARP_LN_NODE_URL");
        let a = LightningAdapter::new();
        let health = a.health_check().await.unwrap();
        assert!(!health); // false because no LND configured
    }

    #[tokio::test]
    async fn test_watch_events_no_lnd_empty() {
        std::env::remove_var("WARP_LN_NODE_URL");
        let a = LightningAdapter::new();
        let events = a.watch_events().await.unwrap();
        assert!(events.is_empty());
    }

    #[tokio::test]
    async fn test_execute_mint_invalid_invoice() {
        let a = LightningAdapter::new();
        let inst = MintInstruction {
            dest_chain: "lightning".into(),
            recipient: "not_an_invoice".into(),
            amount_dest_atomic: 100,
            signatures: vec![],
            warp_message_hash: String::new(),
        };
        assert!(a.execute_mint(&inst).await.is_err());
    }

    #[tokio::test]
    async fn test_execute_mint_no_lnd() {
        std::env::remove_var("WARP_LN_NODE_URL");
        let a = LightningAdapter::new();
        let inst = MintInstruction {
            dest_chain: "lightning".into(),
            recipient: "lnbc100u1p3k252dqqnp4q0h...".into(),
            amount_dest_atomic: 100,
            signatures: vec![],
            warp_message_hash: String::new(),
        };
        // Should error because LND is not configured
        assert!(a.execute_mint(&inst).await.is_err());
    }

    #[tokio::test]
    async fn test_current_height_no_lnd() {
        std::env::remove_var("WARP_LN_NODE_URL");
        let a = LightningAdapter::new();
        assert_eq!(a.current_height().await.unwrap(), 0);
    }

    #[tokio::test]
    async fn test_confirmations_no_lnd() {
        std::env::remove_var("WARP_LN_NODE_URL");
        let a = LightningAdapter::new();
        assert_eq!(a.confirmations("abc123").await.unwrap(), 0);
    }
}
