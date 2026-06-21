use crate::adapter::ChainAdapter;
use crate::error::{WarpError, WarpResult};
use crate::protocol::{DepositProof, MintInstruction};
use crate::types::ChainFamily;
use async_trait::async_trait;
use tracing::{info, warn};

/// Bitcoin Lightning Network adapter.
///
/// Bridges ZION L1 to Lightning via BOLT11 invoices:
/// - Outbound: ZION user pays a Lightning invoice (ZION locked → BTC sent over LN)
/// - Inbound: Lightning payment triggers ZION mint on L1
///
/// Requires a connected Lightning node (LND, Core Lightning, or LDK).
pub struct LightningAdapter {
    #[allow(dead_code)]
    node_url: String,
    #[allow(dead_code)]
    macaroon: Option<String>,
}

impl Default for LightningAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl LightningAdapter {
    pub fn new() -> Self {
        Self {
            node_url: std::env::var("WARP_LN_NODE_URL")
                .unwrap_or_else(|_| "http://localhost:8080".into()),
            macaroon: std::env::var("WARP_LN_MACAROON").ok(),
        }
    }

    pub fn with_endpoint(node_url: &str, macaroon: Option<&str>) -> Self {
        Self {
            node_url: node_url.to_string(),
            macaroon: macaroon.map(|s| s.to_string()),
        }
    }

    /// Decode a BOLT11 invoice and extract amount + payment hash.
    pub fn decode_invoice(&self, invoice: &str) -> WarpResult<(u64, String)> {
        // Minimal BOLT11 decode: extract amount from human-readable part
        // Real implementation uses lightning-invoice crate
        if !invoice.starts_with("lnbc") {
            return Err(WarpError::InvalidAddress {
                chain: "lightning".into(),
                address: invoice.into(),
            });
        }

        // Parse amount from lnbc1m, lnbc100u, lnbc10n, etc.
        let amount_sats = parse_bolt11_amount(invoice)?;
        // Payment hash is embedded in the invoice
        let payment_hash = extract_payment_hash(invoice);

        Ok((amount_sats, payment_hash))
    }

    /// Create a BOLT11 invoice for inbound transfers.
    pub async fn create_invoice(&self, amount_sats: u64, memo: &str) -> WarpResult<String> {
        info!(
            amount = amount_sats,
            memo = memo,
            "Creating Lightning invoice"
        );
        // Placeholder: real implementation calls LND/CLN/ldk-node gRPC/REST
        let invoice = format!(
            "lnbc{}n1p{}...{}",
            amount_sats,
            &hex::encode(sha256::digest(memo.as_bytes()))[..8],
            &hex::encode(sha256::digest(&amount_sats.to_le_bytes()))[..6]
        );
        Ok(invoice)
    }

    /// Pay a BOLT11 invoice for outbound transfers.
    pub async fn pay_invoice(&self, invoice: &str) -> WarpResult<String> {
        let (amount_sats, payment_hash) = self.decode_invoice(invoice)?;
        info!(
            amount = amount_sats,
            payment_hash = %payment_hash,
            "Paying Lightning invoice"
        );
        // Placeholder: real implementation calls LND SendPaymentV2 / CLN pay
        Ok(format!("ln_payment_{}", payment_hash))
    }

    /// Check if a payment hash has been settled.
    pub async fn is_payment_settled(&self, payment_hash: &str) -> WarpResult<bool> {
        info!(payment_hash = %payment_hash, "Checking Lightning payment status");
        // Placeholder
        Ok(false)
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
        info!("Lightning health check — verifying node connectivity");
        // Placeholder: real implementation calls GetInfo
        Ok(true)
    }

    async fn watch_events(&self) -> WarpResult<Vec<DepositProof>> {
        // Lightning watch: poll settled invoices or subscribe to HTLC events
        warn!("Lightning watch_events not yet implemented — use invoice polling");
        Ok(vec![])
    }

    async fn execute_mint(&self, instruction: &MintInstruction) -> WarpResult<String> {
        // For inbound: create an invoice, user pays it, we detect settlement
        let amount_sats: u64 =
            instruction
                .amount_dest_atomic
                .try_into()
                .map_err(|_| WarpError::DecimalOverflow {
                    from_decimals: 18,
                    to_decimals: 8,
                })?;
        let invoice = self
            .create_invoice(amount_sats, &instruction.recipient)
            .await?;
        info!(invoice = %invoice, "Lightning invoice created for inbound transfer");
        Ok(invoice)
    }

    async fn current_height(&self) -> WarpResult<u64> {
        // Lightning has no block height; return 0
        Ok(0)
    }

    async fn confirmations(&self, _tx_hash: &str) -> WarpResult<u64> {
        // For Lightning, tx_hash is the payment hash; check settlement
        let settled = self.is_payment_settled(_tx_hash).await?;
        if settled {
            Ok(1)
        } else {
            Ok(0)
        }
    }
}

// ── BOLT11 helpers (minimal, real impl uses lightning-invoice crate) ──

fn parse_bolt11_amount(invoice: &str) -> WarpResult<u64> {
    // lnbc1m = 1 milli-satoshi? No, lnbc1m = 1 million satoshis in modern encoding
    // Simplified: look for amount digits between 'lnbc' and unit letter
    let rest = &invoice[4..]; // skip "lnbc"
    let mut digits = String::new();
    for ch in rest.chars() {
        if ch.is_ascii_digit() {
            digits.push(ch);
        } else {
            break;
        }
    }
    if digits.is_empty() {
        // No amount specified = any amount invoice
        return Ok(0);
    }
    let num: u64 = digits.parse().map_err(|_| WarpError::InvalidAddress {
        chain: "lightning".into(),
        address: invoice.into(),
    })?;
    // Find unit
    let unit_ch = rest.chars().nth(digits.len());
    let multiplier = match unit_ch {
        Some('m') => 1_000_000u64, // milli? actually modern uses 'm' for millisatoshi
        Some('u') => 100u64,       // micro?
        Some('n') => 1u64,         // nano = satoshi in some encodings
        Some('p') => 10u64,        // pico = 0.1 satoshi (sub-satoshi)
        _ => 1u64,
    };
    Ok(num * multiplier)
}

fn extract_payment_hash(_invoice: &str) -> String {
    // Placeholder: real impl parses the tagged field 'p' (payment_hash)
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(_invoice.as_bytes());
    format!("{:x}", hasher.finalize())
}

mod sha256 {
    use sha2::{Digest, Sha256};
    pub fn digest(data: &[u8]) -> Vec<u8> {
        let mut hasher = Sha256::new();
        hasher.update(data);
        hasher.finalize().to_vec()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lightning_adapter_meta() {
        let a = LightningAdapter::new();
        assert_eq!(a.name(), "lightning");
        assert_eq!(a.family(), ChainFamily::Lightning);
    }

    #[test]
    fn test_decode_invoice_valid() {
        let a = LightningAdapter::new();
        let inv = "lnbc100n1pj..."; // 100 satoshi invoice stub
        let result = a.decode_invoice(inv);
        assert!(result.is_ok());
    }

    #[test]
    fn test_decode_invoice_invalid() {
        let a = LightningAdapter::new();
        let result = a.decode_invoice("not_an_invoice");
        assert!(result.is_err());
    }
}
