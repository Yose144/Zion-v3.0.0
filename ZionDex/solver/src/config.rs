//! Solver daemon configuration.
//!
//! Configuration is loaded from CLI args (clap) with env-var fallbacks using
//! the `ZION_SOLVER_*` prefix. CLI args take precedence over env vars, which
//! take precedence over the built-in defaults.

use clap::Parser;
use crate::errors::{Error, Result};

/// Command-line / environment configuration for the ZionDex Solver Daemon.
#[derive(Debug, Clone, Parser)]
#[command(
    name = "ziondex-solver",
    about = "ZionDex Solver Daemon — listens for SwapIntents, computes optimal paths, bids, and executes winning swaps"
)]
pub struct SolverConfig {
    /// Solver private key (EVM, hex with 0x prefix).
    #[arg(long = "solver-key", env = "ZION_SOLVER_KEY")]
    pub solver_key: Option<String>,

    /// Solver public address (hex).
    #[arg(long = "solver-address", env = "ZION_SOLVER_ADDRESS")]
    pub solver_address: Option<String>,

    /// Router API URL.
    #[arg(long = "router-url", env = "ZION_SOLVER_ROUTER_URL", default_value = "http://127.0.0.1:8454")]
    pub router_url: String,

    /// Solver API bind address.
    #[arg(long = "bind", env = "ZION_SOLVER_BIND", default_value = "0.0.0.0:8455")]
    pub bind_address: String,

    /// Minimum profit in basis points (default: 5 = 0.05%).
    #[arg(long = "min-profit-bps", env = "ZION_SOLVER_MIN_PROFIT_BPS", default_value_t = 5)]
    pub min_profit_bps: u16,

    /// Maximum gas price in gwei.
    #[arg(long = "max-gas-gwei", env = "ZION_SOLVER_MAX_GAS_GWEI", default_value_t = 50)]
    pub max_gas_gwei: u64,

    /// Auction timeout in seconds.
    #[arg(long = "auction-timeout", env = "ZION_SOLVER_AUCTION_TIMEOUT", default_value_t = 5)]
    pub auction_timeout_secs: u64,
}

impl SolverConfig {
    /// Parse the config from CLI args / env vars.
    pub fn parse_cli() -> Self {
        Self::parse()
    }

    /// Validate the config, returning a normalized [`ResolvedSolverConfig`].
    ///
    /// `solver_key` / `solver_address` are optional at the type level so the
    /// daemon can boot in read-only / dry-run mode, but execution paths will
    /// refuse to run without them.
    pub fn resolve(self) -> Result<ResolvedSolverConfig> {
        if self.min_profit_bps > 10000 {
            return Err(Error::Other(format!(
                "min_profit_bps {} exceeds 10000 (100%)",
                self.min_profit_bps
            )));
        }
        if self.max_gas_gwei == 0 {
            return Err(Error::Other("max_gas_gwei must be > 0".into()));
        }
        if self.auction_timeout_secs == 0 {
            return Err(Error::Other("auction_timeout_secs must be > 0".into()));
        }

        // Validate the key shape if provided (must be 0x-prefixed hex, 64 nibbles).
        if let Some(k) = self.solver_key.as_deref() {
            validate_evm_key(k)?;
        }

        Ok(ResolvedSolverConfig {
            solver_key: self.solver_key,
            solver_address: self.solver_address,
            router_url: self.router_url,
            bind_address: self.bind_address,
            min_profit_bps: self.min_profit_bps,
            max_gas_gwei: self.max_gas_gwei,
            auction_timeout_secs: self.auction_timeout_secs,
        })
    }
}

/// A validated, ready-to-run solver configuration.
#[derive(Debug, Clone)]
pub struct ResolvedSolverConfig {
    pub solver_key: Option<String>,
    pub solver_address: Option<String>,
    pub router_url: String,
    pub bind_address: String,
    pub min_profit_bps: u16,
    pub max_gas_gwei: u64,
    pub auction_timeout_secs: u64,
}

/// Validate that a private key string is a 0x-prefixed 32-byte hex value.
fn validate_evm_key(key: &str) -> Result<()> {
    if !key.starts_with("0x") {
        return Err(Error::InvalidKey("key must be 0x-prefixed".into()));
    }
    let hex = &key[2..];
    if hex.len() != 64 || !hex.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(Error::InvalidKey(format!(
            "expected 64 hex nibbles (32 bytes), got {} chars",
            hex.len()
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_defaults() {
        let cfg = SolverConfig {
            solver_key: None,
            solver_address: None,
            router_url: "http://127.0.0.1:8454".into(),
            bind_address: "0.0.0.0:8455".into(),
            min_profit_bps: 5,
            max_gas_gwei: 50,
            auction_timeout_secs: 5,
        };
        let resolved = cfg.resolve().expect("defaults resolve");
        assert_eq!(resolved.min_profit_bps, 5);
        assert_eq!(resolved.max_gas_gwei, 50);
        assert_eq!(resolved.auction_timeout_secs, 5);
    }

    #[test]
    fn test_reject_invalid_key() {
        let cfg = SolverConfig {
            solver_key: Some("nope".into()),
            solver_address: None,
            router_url: "http://127.0.0.1:8454".into(),
            bind_address: "0.0.0.0:8455".into(),
            min_profit_bps: 5,
            max_gas_gwei: 50,
            auction_timeout_secs: 5,
        };
        assert!(cfg.resolve().is_err());
    }

    #[test]
    fn test_reject_bad_bps() {
        let cfg = SolverConfig {
            solver_key: None,
            solver_address: None,
            router_url: "http://127.0.0.1:8454".into(),
            bind_address: "0.0.0.0:8455".into(),
            min_profit_bps: 20000,
            max_gas_gwei: 50,
            auction_timeout_secs: 5,
        };
        assert!(cfg.resolve().is_err());
    }
}
