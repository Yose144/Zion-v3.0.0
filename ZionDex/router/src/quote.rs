use crate::config::RouterConfig;
use crate::router::Router;
use crate::types::*;
use anyhow::Result;
use chrono::{Duration, Utc};
use tracing::info;
use uuid::Uuid;

/// Quote engine — calculates prices, slippage, fees
pub struct QuoteEngine {
    pub config: RouterConfig,
    router: Router,
}

impl QuoteEngine {
    pub fn new(config: RouterConfig) -> Self {
        let router = Router::new(config.clone());
        Self { config, router }
    }

    /// Generate a quote for a swap request
    pub async fn quote(&self, req: &QuoteRequest) -> Result<QuoteResponse> {
        info!(
            "Quote request: {} {} → {} {} (amount: {})",
            req.src_chain, req.src_token,
            req.dest_chain, req.dest_token,
            req.amount
        );

        // Resolve token symbols to TokenId
        let src_token = resolve_token(req.src_chain, &req.src_token);
        let dest_token = resolve_token(req.dest_chain, &req.dest_token);

        // Find best path
        let paths = self.router.find_paths(
            req.src_chain,
            &src_token,
            req.dest_chain,
            &dest_token,
            &req.amount,
        ).await?;

        let best_path = paths.into_iter().next().ok_or_else(|| {
            anyhow::anyhow!("No path found")
        })?;

        let quote_id = format!("q_{}", Uuid::new_v4().simple());

        Ok(QuoteResponse {
            quote_id,
            path: best_path,
            expires_at: Utc::now() + Duration::seconds(self.config.quote_expiry_secs as i64),
        })
    }

    /// Validate that a quote is still valid (not expired)
    pub fn is_valid(&self, quote: &QuoteResponse) -> bool {
        Utc::now() < quote.expires_at
    }
}

/// Resolve a token symbol string to a TokenId
fn resolve_token(chain: ChainId, symbol: &str) -> TokenId {
    match symbol.to_uppercase().as_str() {
        "ZION" => TokenId::zion(),
        "WZION" => TokenId::wzion(chain),
        "USDT" => TokenId::usdt(chain),
        "USDC" => TokenId::usdc(chain),
        "WETH" | "ETH" => TokenId::weth(),
        // If it looks like an address, treat it as a token
        s if s.starts_with("0x") || s.starts_with("zion1") => TokenId::Token {
            chain,
            address: s.to_string(),
            symbol: "UNKNOWN".into(),
            decimals: chain.decimals(),
        },
        _ => TokenId::Native { chain, symbol: symbol.to_string() },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_quote_same_chain() {
        let engine = QuoteEngine::new(RouterConfig::default());
        let req = QuoteRequest {
            src_chain: ChainId::Base,
            src_token: "wZION".into(),
            dest_chain: ChainId::Base,
            dest_token: "USDT".into(),
            amount: "1000".into(),
        };
        let result = engine.quote(&req).await;
        assert!(result.is_ok(), "Quote should succeed: {:?}", result);
        let quote = result.unwrap();
        assert!(!quote.quote_id.is_empty());
        assert!(!quote.path.steps.is_empty());
    }

    #[tokio::test]
    async fn test_quote_cross_chain() {
        let engine = QuoteEngine::new(RouterConfig::default());
        let req = QuoteRequest {
            src_chain: ChainId::Zion,
            src_token: "ZION".into(),
            dest_chain: ChainId::Base,
            dest_token: "wZION".into(),
            amount: "1000".into(),
        };
        let result = engine.quote(&req).await;
        assert!(result.is_ok(), "Cross-chain quote should succeed: {:?}", result);
    }

    #[test]
    fn test_resolve_token() {
        let t = resolve_token(ChainId::Base, "wZION");
        assert_eq!(t.symbol(), "wZION");

        let t = resolve_token(ChainId::Zion, "ZION");
        assert_eq!(t.symbol(), "ZION");

        let t = resolve_token(ChainId::Base, "USDT");
        assert_eq!(t.symbol(), "USDT");
    }
}
