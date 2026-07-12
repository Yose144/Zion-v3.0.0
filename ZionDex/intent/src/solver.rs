//! Solver trait and a reference `SimpleSolver` implementation.
//!
//! A solver computes a bid for a swap intent and, if it wins the auction,
//! executes the swap. The [`SimpleSolver`] talks to the existing ZionDex
//! Router HTTP API (`GET /quote/multi` and `POST /swap`) to find the best
//! path and execute it, charging a small fee on top.

use crate::errors::{Error, Result};
use crate::signing::sign_intent_evm;
use crate::types::{PathHop, SolverBid, SwapIntent};
use async_trait::async_trait;
use ethers::types::U256;
use serde::{Deserialize, Serialize};

/// Result of a solver executing a winning bid on-chain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    /// Transaction hash of the executed swap.
    pub tx_hash: String,
    /// Actual output amount delivered to the user.
    pub amount_out: U256,
    /// Gas used for the execution (units are chain-specific).
    pub gas_used: u64,
}

/// A solver competes in the auction and executes winning intents.
#[async_trait]
pub trait Solver: Send + Sync {
    /// Compute a bid for the given intent.
    async fn compute_bid(&self, intent: &SwapIntent) -> Result<SolverBid>;
    /// Execute the winning bid for an intent on-chain.
    async fn execute(&self, intent: &SwapIntent, bid: &SolverBid) -> Result<ExecutionResult>;
    /// Return the solver's address.
    fn address(&self) -> &str;
}

/// A simple reference solver that uses the ZionDex Router API.
pub struct SimpleSolver {
    address: String,
    private_key: String,
    router_api_url: String,
    /// Fee charged on top of the router quote, in basis points (default 10 = 0.1%).
    fee_bps: u16,
}

impl SimpleSolver {
    /// Create a new `SimpleSolver`.
    ///
    /// `router_api_url` should point at the running router (e.g.
    /// `http://127.0.0.1:8454`).
    pub fn new(address: impl Into<String>, private_key: impl Into<String>, router_api_url: impl Into<String>) -> Self {
        Self {
            address: address.into(),
            private_key: private_key.into(),
            router_api_url: router_api_url.into(),
            fee_bps: 10,
        }
    }

    /// Override the default fee (in basis points).
    pub fn with_fee_bps(mut self, fee_bps: u16) -> Self {
        self.fee_bps = fee_bps;
        self
    }

    fn apply_fee(&self, gross: U256) -> U256 {
        // amount_out_after_fee = gross * (10000 - fee_bps) / 10000
        let bps = U256::from(self.fee_bps);
        let numerator = gross * U256::from(10_000u64).saturating_sub(bps);
        numerator / U256::from(10_000u64)
    }
}

/// Shape of the response from `GET /quote/multi` on the router.
#[derive(Debug, Clone, Deserialize)]
struct MultiQuoteResponse {
    #[serde(default)]
    best_path: Option<QuotePath>,
    #[serde(default)]
    paths: Vec<QuotePath>,
}

#[derive(Debug, Clone, Deserialize)]
struct QuotePath {
    #[serde(default)]
    amount_out: Option<U256>,
    #[serde(default)]
    hops: Vec<QuoteHop>,
}

#[derive(Debug, Clone, Deserialize)]
struct QuoteHop {
    #[serde(default)]
    chain: Option<String>,
    #[serde(default)]
    dex: Option<String>,
    #[serde(default)]
    from_token: Option<String>,
    #[serde(default)]
    to_token: Option<String>,
    #[serde(default)]
    is_bridge: Option<bool>,
}

/// Shape of the response from `POST /swap` on the router.
#[derive(Debug, Clone, Deserialize)]
struct SwapResponse {
    #[serde(default)]
    tx_hash: Option<String>,
    #[serde(default)]
    amount_out: Option<U256>,
    #[serde(default)]
    gas_used: Option<u64>,
}

#[async_trait]
impl Solver for SimpleSolver {
    async fn compute_bid(&self, intent: &SwapIntent) -> Result<SolverBid> {
        let client = reqwest::Client::new();
        let url = format!(
            "{}/quote/multi?from_chain={}&to_chain={}&from_token={}&to_token={}&amount_in={}",
            self.router_api_url.trim_end_matches('/'),
            intent.from_chain,
            intent.to_chain,
            intent.from_token,
            intent.to_token,
            intent.amount_in
        );

        tracing::debug!(%url, "SimpleSolver requesting quote");

        let resp = client.get(&url).send().await?;
        if !resp.status().is_success() {
            return Err(Error::Solver(format!(
                "quote/multi returned status {}",
                resp.status()
            )));
        }
        let body: MultiQuoteResponse = resp.json().await?;
        let path = body
            .best_path
            .or_else(|| body.paths.into_iter().next())
            .ok_or_else(|| Error::Solver("no path returned by router".to_string()))?;

        let gross = path
            .amount_out
            .ok_or_else(|| Error::Solver("quote path missing amount_out".to_string()))?;
        let net = self.apply_fee(gross);

        let path_hops: Vec<PathHop> = path
            .hops
            .into_iter()
            .map(|h| PathHop {
                chain: h.chain.unwrap_or_default(),
                dex: h.dex.unwrap_or_default(),
                from_token: h.from_token.unwrap_or_default(),
                to_token: h.to_token.unwrap_or_default(),
                is_bridge: h.is_bridge.unwrap_or(false),
            })
            .collect();

        let mut bid = SolverBid::new(
            intent.id,
            self.address.clone(),
            net,
            path_hops,
            self.fee_bps,
            now_unix(),
        );

        // Sign the bid with the solver's EVM key (best-effort; ignored if invalid).
        if let Ok(sig) = sign_intent_evm(intent, &self.private_key) {
            bid.signature = sig;
        }
        Ok(bid)
    }

    async fn execute(&self, intent: &SwapIntent, bid: &SolverBid) -> Result<ExecutionResult> {
        let client = reqwest::Client::new();
        let url = format!("{}/swap", self.router_api_url.trim_end_matches('/'));

        let body = serde_json::json!({
            "user": intent.user,
            "from_chain": intent.from_chain.to_string(),
            "to_chain": intent.to_chain.to_string(),
            "from_token": intent.from_token,
            "to_token": intent.to_token,
            "amount_in": intent.amount_in,
            "min_amount_out": bid.amount_out,
            "path": bid.path,
        });

        tracing::debug!(%url, "SimpleSolver executing swap");
        let resp = client.post(&url).json(&body).send().await?;
        if !resp.status().is_success() {
            return Err(Error::Solver(format!(
                "swap returned status {}",
                resp.status()
            )));
        }
        let parsed: SwapResponse = resp.json().await?;

        Ok(ExecutionResult {
            tx_hash: parsed.tx_hash.unwrap_or_default(),
            amount_out: parsed.amount_out.unwrap_or(bid.amount_out),
            gas_used: parsed.gas_used.unwrap_or(0),
        })
    }

    fn address(&self) -> &str {
        &self.address
    }
}

fn now_unix() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
