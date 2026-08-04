//! TLS support for the ZION pool — non-fatal, opt-in via env vars.
//!
//! If `ZION_POOL_TLS_BIND`, `ZION_POOL_TLS_CERT`, and `ZION_POOL_TLS_KEY` are set,
//! the pool binds an additional TLS listener. If cert loading or binding fails,
//! the pool continues without TLS (non-fatal).

use std::sync::Arc;

use anyhow::{Context, Result};
use tokio_rustls::TlsAcceptor;

/// Load a TLS server config from PEM-encoded cert and key files.
pub fn load_tls_acceptor(cert_path: &str, key_path: &str) -> Result<TlsAcceptor> {
    let cert_pem = std::fs::read(cert_path)
        .with_context(|| format!("failed to read TLS cert: {}", cert_path))?;
    let key_pem = std::fs::read(key_path)
        .with_context(|| format!("failed to read TLS key: {}", key_path))?;

    let cert_chain: Vec<rustls::pki_types::CertificateDer> =
        rustls_pemfile::certs(&mut cert_pem.as_slice())
            .collect::<Result<Vec<_>, _>>()
            .context("failed to parse TLS cert chain")?;

    if cert_chain.is_empty() {
        anyhow::bail!("no certificates found in {}", cert_path);
    }

    let key_der = rustls_pemfile::private_key(&mut key_pem.as_slice())
        .context("failed to parse TLS private key")?
        .ok_or_else(|| anyhow::anyhow!("no private key found in {}", key_path))?;

    let mut server_config = rustls::ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(cert_chain, key_der)
        .context("failed to build TLS server config")?;

    server_config.max_early_data_size = 0;

    Ok(TlsAcceptor::from(Arc::new(server_config)))
}

/// TLS configuration parsed from environment variables.
#[derive(Clone, Debug)]
pub struct TlsConfig {
    pub bind: String,
    pub cert_path: String,
    pub key_path: String,
}

impl TlsConfig {
    /// Parse from env vars. Returns None if TLS is not configured.
    pub fn from_env() -> Option<Self> {
        let bind = std::env::var("ZION_POOL_TLS_BIND").ok()?;
        let cert_path = std::env::var("ZION_POOL_TLS_CERT").ok()?;
        let key_path = std::env::var("ZION_POOL_TLS_KEY").ok()?;
        if bind.is_empty() || cert_path.is_empty() || key_path.is_empty() {
            return None;
        }
        Some(Self {
            bind,
            cert_path,
            key_path,
        })
    }
}

/// Extra port configuration for difficulty stratification.
#[derive(Clone, Debug)]
pub struct ExtraPortConfig {
    pub bind_addr: String,
    pub label: String,
    pub default_difficulty: u64,
    pub min_difficulty: u64,
    pub max_difficulty: u64,
}

impl ExtraPortConfig {
    /// Parse extra ports from `ZION_POOL_EXTRA_PORTS` env var.
    ///
    /// Format: `bind:label:default_diff:min_diff:max_diff,...`
    /// Example: `0.0.0.0:8445:gpu:5000:100:50000,0.0.0.0:8446:farm:50000:1000:0`
    pub fn parse_from_env() -> Vec<Self> {
        let raw = match std::env::var("ZION_POOL_EXTRA_PORTS") {
            Ok(v) => v,
            Err(_) => return Vec::new(),
        };
        Self::parse(&raw)
    }

    /// Parse a comma-separated list of extra port configs.
    ///
    /// Format: `bind:label:default_diff:min_diff:max_diff,...`
    /// Where bind can be `port` or `host:port` (e.g., `8445` or `0.0.0.0:8445`).
    /// Example: `8445:gpu:5000:100:50000,0.0.0.0:8446:farm:50000:1000:0`
    pub fn parse(raw: &str) -> Vec<Self> {
        let mut ports = Vec::new();
        for entry in raw.split(',') {
            let entry = entry.trim();
            if entry.is_empty() {
                continue;
            }
            // Split by ':' — if the first part looks like an IP (contains '.'),
            // the bind address is the first two parts joined.
            let parts: Vec<&str> = entry.split(':').collect();
            let (bind_addr, rest) = if parts.len() >= 2 && parts[0].contains('.') {
                // host:port format
                (format!("{}:{}", parts[0], parts[1]), &parts[2..])
            } else if parts.len() >= 2 && parts[0].parse::<u16>().is_ok() {
                // Just a port number
                (format!("0.0.0.0:{}", parts[0]), &parts[1..])
            } else {
                continue;
            };

            let label = rest.first().copied().unwrap_or("").to_string();
            let default_difficulty = rest.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
            let min_difficulty = rest.get(2).and_then(|s| s.parse().ok()).unwrap_or(0);
            let max_difficulty = rest.get(3).and_then(|s| s.parse().ok()).unwrap_or(0);
            ports.push(Self {
                bind_addr,
                label,
                default_difficulty,
                min_difficulty,
                max_difficulty,
            });
        }
        ports
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_extra_ports() {
        let ports = ExtraPortConfig::parse(
            "8445:gpu:5000:100:50000,0.0.0.0:8446:farm:50000:1000:0",
        );
        assert_eq!(ports.len(), 2);
        assert_eq!(ports[0].bind_addr, "0.0.0.0:8445");
        assert_eq!(ports[0].label, "gpu");
        assert_eq!(ports[0].default_difficulty, 5000);
        assert_eq!(ports[0].min_difficulty, 100);
        assert_eq!(ports[0].max_difficulty, 50000);
        assert_eq!(ports[1].bind_addr, "0.0.0.0:8446");
        assert_eq!(ports[1].label, "farm");
        assert_eq!(ports[1].max_difficulty, 0);
    }

    #[test]
    fn parse_extra_ports_empty() {
        let ports = ExtraPortConfig::parse("");
        assert!(ports.is_empty());
    }

    #[test]
    fn parse_extra_ports_partial() {
        let ports = ExtraPortConfig::parse("8447:cpu");
        assert_eq!(ports.len(), 1);
        assert_eq!(ports[0].bind_addr, "0.0.0.0:8447");
        assert_eq!(ports[0].label, "cpu");
        assert_eq!(ports[0].default_difficulty, 0);
    }

    #[test]
    fn tls_config_from_env_none() {
        std::env::remove_var("ZION_POOL_TLS_BIND");
        std::env::remove_var("ZION_POOL_TLS_CERT");
        std::env::remove_var("ZION_POOL_TLS_KEY");
        assert!(TlsConfig::from_env().is_none());
    }

    #[test]
    fn tls_config_from_env_some() {
        std::env::set_var("ZION_POOL_TLS_BIND", "0.0.0.0:8445");
        std::env::set_var("ZION_POOL_TLS_CERT", "/path/cert.pem");
        std::env::set_var("ZION_POOL_TLS_KEY", "/path/key.pem");
        let cfg = TlsConfig::from_env().unwrap();
        assert_eq!(cfg.bind, "0.0.0.0:8445");
        std::env::remove_var("ZION_POOL_TLS_BIND");
        std::env::remove_var("ZION_POOL_TLS_CERT");
        std::env::remove_var("ZION_POOL_TLS_KEY");
    }
}
