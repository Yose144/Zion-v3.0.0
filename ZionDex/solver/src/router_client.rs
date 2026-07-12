//! HTTP client for the ZionDex Router REST API.
//!
//! The solver daemon never links against the router crate; it only talks to
//! the Router over HTTP. This module wraps the three endpoints the solver
//! cares about:
//!
//! - `GET  /quote/multi`  -> [`MultiPathQuote`]
//! - `POST /swap`         -> [`SwapResult`]
//! - `GET  /health`       -> [`HealthResponse`]

use crate::errors::{Error, Result};
use crate::types::{HealthResponse, MultiPathQuote, SwapRequest, SwapResult};

/// HTTP client for the ZionDex Router.
#[derive(Debug, Clone)]
pub struct RouterClient {
    base_url: String,
    http: reqwest::Client,
}

impl RouterClient {
    /// Create a new client targeting the given router base URL.
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into().trim_end_matches('/').to_string(),
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .expect("reqwest client builds"),
        }
    }

    /// Create a client with a custom reqwest transport (used in tests).
    pub fn with_client(base_url: impl Into<String>, http: reqwest::Client) -> Self {
        Self {
            base_url: base_url.into().trim_end_matches('/').to_string(),
            http,
        }
    }

    /// The configured base URL.
    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    /// `GET /quote/multi` — fetch a multi-path quote.
    ///
    /// `amount` is a human-readable decimal string (e.g. `"1000"`).
    pub async fn get_multi_quote(
        &self,
        from_chain: &str,
        from_token: &str,
        to_chain: &str,
        to_token: &str,
        amount: &str,
    ) -> Result<MultiPathQuote> {
        let url = format!(
            "{}/quote/multi?from_chain={}&from_token={}&to_chain={}&to_token={}&amount={}",
            self.base_url,
            urlencode(from_chain),
            urlencode(from_token),
            urlencode(to_chain),
            urlencode(to_token),
            urlencode(amount),
        );

        tracing::debug!("router GET {}", url);

        let resp = self.http.get(&url).send().await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(Error::RouterApi {
                status: status.as_u16(),
                body,
            });
        }
        let quote: MultiPathQuote = resp.json().await?;
        if quote.paths.is_empty() {
            return Err(Error::NoPath {
                from: format!("{}:{}", from_chain, from_token),
                to: format!("{}:{}", to_chain, to_token),
            });
        }
        Ok(quote)
    }

    /// `POST /swap` — submit a swap for execution.
    pub async fn execute_swap(&self, swap_req: SwapRequest) -> Result<SwapResult> {
        let url = format!("{}/swap", self.base_url);
        tracing::debug!("router POST {} (quote_id={})", url, swap_req.quote_id);

        let resp = self.http.post(&url).json(&swap_req).send().await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(Error::RouterApi {
                status: status.as_u16(),
                body,
            });
        }
        let result: SwapResult = resp.json().await?;
        Ok(result)
    }

    /// `GET /health` — liveness check. Returns `true` if the router reports ok.
    pub async fn health(&self) -> Result<bool> {
        let url = format!("{}/health", self.base_url);
        let resp = self.http.get(&url).send().await?;
        let status = resp.status();
        if !status.is_success() {
            return Ok(false);
        }
        let h: HealthResponse = resp.json().await?;
        Ok(h.status.eq_ignore_ascii_case("ok"))
    }
}

/// Minimal percent-encoding for query values (encodes characters that are
/// unsafe in a URL query string).
fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => {
                out.push('%');
                out.push_str(&format!("{:02X}", b));
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_urlencode() {
        assert_eq!(urlencode("base"), "base");
        assert_eq!(urlencode("0xabc123"), "0xabc123");
        assert_eq!(urlencode("a b/c"), "a%20b%2Fc");
        assert_eq!(urlencode("USDT"), "USDT");
    }

    #[test]
    fn test_base_url_trimmed() {
        let c = RouterClient::new("http://127.0.0.1:8454/");
        assert_eq!(c.base_url(), "http://127.0.0.1:8454");
    }
}
