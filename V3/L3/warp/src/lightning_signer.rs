//! # LND REST Client — WARP Lightning Phase C
//!
//! HTTP REST client for LND (Lightning Network Daemon).
//! Uses LND's built-in REST proxy (default port 8080) instead of gRPC.
//!
//! ## Authentication
//! LND REST uses macaroon-based auth via the `Grpc-Metadata-macaroon` header
//! and TLS via `tls.cert`. For simplicity, we support:
//! - `WARP_LN_NODE_URL` — LND REST base URL (e.g. `https://lnd:8080`)
//! - `WARP_LN_MACAROON` — hex-encoded invoice macaroon
//! - `WARP_LN_TLS_CERT` — path to tls.cert (optional, for self-signed)
//!
//! ## REST Endpoints used
//! - `GET /v1/getinfo` — node info (health check)
//! - `POST /v1/invoices` — create invoice (AddInvoice)
//! - `POST /v1/channels/transactions` — pay invoice (SendPaymentSync)
//! - `GET /v1/invoice/{rhash}` — lookup invoice status
//! - `GET /v1/channels` — list channels (liquidity monitoring)

use crate::error::{WarpError, WarpResult};
use serde::{Deserialize, Serialize};
use tracing::{debug, info};

// ─────────────────────────────────────────────────────────────────────────────
// LND REST response types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct GetInfoResponse {
    pub identity_pubkey: Option<String>,
    pub alias: Option<String>,
    pub num_active_channels: Option<u32>,
    pub num_peers: Option<u32>,
    pub block_height: Option<u32>,
    pub synced_to_chain: Option<bool>,
    pub synced_to_graph: Option<bool>,
    pub version: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AddInvoiceRequest {
    pub value_msat: u64,
    pub memo: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expiry: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description_hash: Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct AddInvoiceResponse {
    pub payment_request: Option<String>,
    pub r_hash: Option<String>,
    pub add_index: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SendPaymentRequest {
    pub payment_request: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fee_limit_msat: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout_seconds: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct SendPaymentResponse {
    pub payment_hash: Option<String>,
    pub payment_preimage: Option<String>,
    pub payment_error: Option<String>,
    pub payment_route: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct LookupInvoiceResponse {
    pub settled: Option<bool>,
    pub value_msat: Option<String>,
    pub amt_paid_msat: Option<String>,
    pub r_hash: Option<String>,
    pub payment_request: Option<String>,
    pub state: Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct Channel {
    pub active: Option<bool>,
    pub remote_pubkey: Option<String>,
    pub channel_point: Option<String>,
    pub capacity: Option<String>,
    pub local_balance: Option<String>,
    pub remote_balance: Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ListChannelsResponse {
    pub channels: Option<Vec<Channel>>,
}

// ─────────────────────────────────────────────────────────────────────────────
// LND REST Client
// ─────────────────────────────────────────────────────────────────────────────

pub struct LndClient {
    base_url: String,
    macaroon_hex: Option<String>,
    client: reqwest::Client,
}

impl LndClient {
    /// Create from environment variables.
    pub fn from_env() -> WarpResult<Self> {
        let base_url = std::env::var("WARP_LN_NODE_URL").map_err(|_| WarpError::AdapterError {
            chain: "lightning".into(),
            reason: "WARP_LN_NODE_URL not set".into(),
        })?;
        let macaroon_hex = std::env::var("WARP_LN_MACAROON").ok();
        Self::new(&base_url, macaroon_hex)
    }

    /// Create with explicit URL + macaroon.
    pub fn new(base_url: &str, macaroon_hex: Option<String>) -> WarpResult<Self> {
        let mut builder = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .danger_accept_invalid_certs(true); // LND uses self-signed TLS

        // Add macaroon header if provided
        if let Some(ref mac) = macaroon_hex {
            let mut headers = reqwest::header::HeaderMap::new();
            let header_value = reqwest::header::HeaderValue::from_str(mac)
                .map_err(|e| WarpError::AdapterError {
                    chain: "lightning".into(),
                    reason: format!("invalid macaroon hex: {}", e),
                })?;
            headers.insert("Grpc-Metadata-macaroon", header_value);
            builder = builder.default_headers(headers);
        }

        let client = builder.build().map_err(|e| WarpError::AdapterError {
            chain: "lightning".into(),
            reason: format!("HTTP client build failed: {}", e),
        })?;

        Ok(Self {
            base_url: base_url.to_string(),
            macaroon_hex,
            client,
        })
    }

    /// Check if the client has a macaroon configured.
    pub fn has_macaroon(&self) -> bool {
        self.macaroon_hex.is_some()
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    // ── GetInfo ──────────────────────────────────────────────────────────────

    /// Call LND GetInfo — returns node info for health checks.
    pub async fn get_info(&self) -> WarpResult<GetInfoResponse> {
        let url = self.url("/v1/getinfo");
        debug!("[WARP][LN] GetInfo → {}", url);
        self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "lightning".into(),
                reason: format!("GetInfo request failed: {}", e),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "lightning".into(),
                reason: format!("GetInfo parse failed: {}", e),
            })
    }

    // ── AddInvoice ───────────────────────────────────────────────────────────

    /// Create a Lightning invoice for inbound transfers.
    pub async fn add_invoice(
        &self,
        amount_msat: u64,
        memo: &str,
        expiry: Option<u64>,
    ) -> WarpResult<AddInvoiceResponse> {
        let url = self.url("/v1/invoices");
        let req = AddInvoiceRequest {
            value_msat: amount_msat,
            memo: memo.to_string(),
            expiry,
            description_hash: None,
        };
        debug!("[WARP][LN] AddInvoice {} msat, memo={}", amount_msat, memo);
        self.client
            .post(&url)
            .json(&req)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "lightning".into(),
                reason: format!("AddInvoice request failed: {}", e),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "lightning".into(),
                reason: format!("AddInvoice parse failed: {}", e),
            })
    }

    // ── SendPayment ──────────────────────────────────────────────────────────

    /// Pay a BOLT11 invoice (outbound transfer).
    pub async fn send_payment(
        &self,
        payment_request: &str,
        fee_limit_msat: Option<u64>,
        timeout_seconds: Option<u32>,
    ) -> WarpResult<SendPaymentResponse> {
        let url = self.url("/v1/channels/transactions");
        let req = SendPaymentRequest {
            payment_request: payment_request.to_string(),
            fee_limit_msat,
            timeout_seconds,
        };
        info!(
            "[WARP][LN] SendPayment invoice={} fee_limit={:?} timeout={:?}",
            &payment_request[..payment_request.len().min(40)],
            fee_limit_msat,
            timeout_seconds
        );
        let resp = self
            .client
            .post(&url)
            .json(&req)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "lightning".into(),
                reason: format!("SendPayment request failed: {}", e),
            })?;

        let status = resp.status();
        let body: SendPaymentResponse = resp.json().await.map_err(|e| WarpError::AdapterError {
            chain: "lightning".into(),
            reason: format!("SendPayment parse failed: {} (HTTP {})", e, status),
        })?;

        if let Some(ref err) = body.payment_error {
            if !err.is_empty() {
                return Err(WarpError::AdapterError {
                    chain: "lightning".into(),
                    reason: format!("Payment failed: {}", err),
                });
            }
        }

        Ok(body)
    }

    // ── LookupInvoice ────────────────────────────────────────────────────────

    /// Look up an invoice by its R-hash (hex encoded).
    pub async fn lookup_invoice(&self, r_hash_hex: &str) -> WarpResult<LookupInvoiceResponse> {
        let url = self.url(&format!("/v1/invoice/{}", r_hash_hex));
        debug!("[WARP][LN] LookupInvoice r_hash={}", r_hash_hex);
        self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "lightning".into(),
                reason: format!("LookupInvoice request failed: {}", e),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "lightning".into(),
                reason: format!("LookupInvoice parse failed: {}", e),
            })
    }

    /// Check if an invoice has been settled (paid).
    pub async fn is_settled(&self, r_hash_hex: &str) -> WarpResult<bool> {
        let invoice = self.lookup_invoice(r_hash_hex).await?;
        Ok(invoice.settled.unwrap_or(false)
            || invoice.state.as_deref() == Some("SETTLED"))
    }

    // ── ListChannels ─────────────────────────────────────────────────────────

    /// List all channels for liquidity monitoring.
    pub async fn list_channels(&self) -> WarpResult<Vec<Channel>> {
        let url = self.url("/v1/channels");
        let resp: ListChannelsResponse = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "lightning".into(),
                reason: format!("ListChannels request failed: {}", e),
            })?
            .json()
            .await
            .map_err(|e| WarpError::AdapterError {
                chain: "lightning".into(),
                reason: format!("ListChannels parse failed: {}", e),
            })?;
        Ok(resp.channels.unwrap_or_default())
    }

    /// Get total outbound capacity (sum of local_balance across active channels).
    pub async fn outbound_capacity_msat(&self) -> WarpResult<u64> {
        let channels = self.list_channels().await?;
        let total: u64 = channels
            .iter()
            .filter(|c| c.active.unwrap_or(false))
            .filter_map(|c| c.local_balance.as_deref())
            .filter_map(|s| s.parse::<u64>().ok())
            .sum();
        Ok(total * 1000) // LND returns satoshis, convert to msat
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lnd_client_new_no_macaroon() {
        let client = LndClient::new("https://localhost:8080", None);
        assert!(client.is_ok());
        let client = client.unwrap();
        assert!(!client.has_macaroon());
    }

    #[test]
    fn test_lnd_client_new_with_macaroon() {
        let client = LndClient::new("https://localhost:8080", Some("aabbccdd".into()));
        assert!(client.is_ok());
        let client = client.unwrap();
        assert!(client.has_macaroon());
    }

    #[test]
    fn test_lnd_client_from_env_missing() {
        std::env::remove_var("WARP_LN_NODE_URL");
        assert!(LndClient::from_env().is_err());
    }

    #[test]
    fn test_add_invoice_request_serialization() {
        let req = AddInvoiceRequest {
            value_msat: 10_000_000,
            memo: "WARP:inbound:zion1test".into(),
            expiry: Some(3600),
            description_hash: None,
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("10000000"));
        assert!(json.contains("WARP:inbound"));
    }

    #[test]
    fn test_send_payment_request_serialization() {
        let req = SendPaymentRequest {
            payment_request: "lnbc100u1p...".into(),
            fee_limit_msat: Some(500),
            timeout_seconds: Some(60),
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("lnbc100u1p"));
    }

    #[test]
    fn test_get_info_response_deserialize() {
        let json = r#"{
            "identity_pubkey": "03abc123...",
            "alias": "WARP-Node",
            "num_active_channels": 3,
            "synced_to_chain": true,
            "version": "0.18.0"
        }"#;
        let info: GetInfoResponse = serde_json::from_str(json).unwrap();
        assert_eq!(info.alias, Some("WARP-Node".into()));
        assert_eq!(info.synced_to_chain, Some(true));
    }

    #[test]
    fn test_lookup_invoice_settled() {
        let json = r#"{
            "settled": true,
            "state": "SETTLED",
            "value_msat": "10000000"
        }"#;
        let inv: LookupInvoiceResponse = serde_json::from_str(json).unwrap();
        assert_eq!(inv.settled, Some(true));
        assert_eq!(inv.state, Some("SETTLED".into()));
    }

    #[test]
    fn test_lookup_invoice_open() {
        let json = r#"{
            "settled": false,
            "state": "OPEN",
            "value_msat": "10000000"
        }"#;
        let inv: LookupInvoiceResponse = serde_json::from_str(json).unwrap();
        assert_eq!(inv.settled, Some(false));
    }

    #[test]
    fn test_list_channels_response() {
        let json = r#"{
            "channels": [
                {
                    "active": true,
                    "capacity": "5000000",
                    "local_balance": "3000000",
                    "remote_balance": "2000000"
                },
                {
                    "active": false,
                    "capacity": "1000000",
                    "local_balance": "0",
                    "remote_balance": "1000000"
                }
            ]
        }"#;
        let resp: ListChannelsResponse = serde_json::from_str(json).unwrap();
        let channels = resp.channels.unwrap();
        assert_eq!(channels.len(), 2);
        assert_eq!(channels[0].active, Some(true));
        assert_eq!(channels[1].active, Some(false));
    }
}
