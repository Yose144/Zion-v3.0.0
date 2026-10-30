//! ZIS (ZION Identity Service) session verification for pool auth.
//!
//! Phase C of the multi-algo roadmap: a miner session may carry a ZIS API
//! key (`zis_…`) in the V3 Hello `auth_token` field.  The pool verifies it
//! against the identity service (`POST /api/keys/verify`), binds the
//! session to the ZIS user for per-user accounting, honors an operator
//! ban list, and can auto-resolve the user's linked payout addresses.
//!
//! Wire format (backward compatible): `auth_token` is serde-defaulted —
//! miners/pools without ZIS auth interoperate unchanged.  The Welcome
//! message echoes the bound user id in `zis_user` ("" = anonymous).
//!
//! Configuration:
//!   ZION_POOL_ZIS_AUTH        off|optional|required   (default: off)
//!   ZION_POOL_ZIS_URL         default http://127.0.0.1:8096
//!   ZION_POOL_ZIS_SERVICE_KEY sent as `x-service-key` header (ZIS-side
//!                             service rate-limit bucket)
//!   ZION_POOL_ZIS_TIMEOUT_MS  verify HTTP timeout      (default: 3000)
//!   ZION_POOL_ZIS_CACHE_TTL   positive cache seconds   (default: 300)
//!   ZION_POOL_BANNED_ZIS      comma-separated user ids rejected at Hello

use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Deserialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ZisAuthMode {
    /// Auth_token ignored entirely — pre-ZIS behaviour (default).
    Off,
    /// Valid tokens bind the session; invalid/absent tokens fall back to
    /// anonymous wallet mode.
    Optional,
    /// Sessions must present a valid, unbanned token or are rejected.
    Required,
}

#[derive(Debug, Clone)]
pub struct ZisIdentity {
    /// ZIS user id (`sub`).
    pub sub: String,
    /// First proven linked `zion-l1` address, if any — used as a payout
    /// fallback when the miner supplies no explicit payout_address.
    pub zion_address: Option<String>,
    /// First proven linked `quantus` address, if any.
    pub quantus_address: Option<String>,
    /// First proven linked `pearl` address, if any (PRL payout fallback — F2e).
    pub pearl_address: Option<String>,
    /// Proven linked addresses only — ownership check for the
    /// `/public/v1/account/*` endpoints (A2.2/A2.3): a wallet must appear
    /// here before its settings may be read or written.  Attestation-only
    /// links (quantus/pearl flagged `proven:false` by ZIS) are excluded:
    /// they prove control of the attesting ZION key, not the external
    /// address, so honouring them would enable address squatting
    /// (audit 3.B3).
    pub addresses: Vec<String>,
}

impl ZisIdentity {
    /// `true` when `wallet` is a *proven* ZIS-linked address of this
    /// identity — the sole ownership proof for account-scoped writes.
    pub fn owns(&self, wallet: &str) -> bool {
        self.addresses.iter().any(|a| a == wallet)
    }
}

#[derive(Deserialize)]
struct VerifyResponse {
    valid: Option<bool>,
    user: Option<VerifyUser>,
}

#[derive(Deserialize)]
struct VerifyUser {
    id: Option<String>,
    #[serde(default, rename = "linkedAddresses")]
    linked_addresses: Vec<LinkedAddress>,
}

#[derive(Deserialize)]
struct LinkedAddress {
    address: String,
    #[serde(rename = "chainType")]
    chain_type: String,
    /// Ownership provenance flag emitted by ZIS (`proven:false` =
    /// attestation-only link that does not prove external-key control).
    /// Absent on older ZIS versions — treated conservatively: quantus and
    /// pearl links are attestation-based by construction, so a missing
    /// flag means unproven for them and proven for self-signed chains.
    proven: Option<bool>,
}

impl LinkedAddress {
    fn is_proven(&self) -> bool {
        self.proven
            .unwrap_or(!matches!(self.chain_type.as_str(), "quantus" | "pearl"))
    }
}

pub struct ZisVerifier {
    url: String,
    service_key: Option<String>,
    pos_ttl: Duration,
    neg_ttl: Duration,
    /// Cache keyed by a hash of the API key (keys are never stored).
    cache: Mutex<HashMap<u64, (Option<ZisIdentity>, Instant)>>,
    banned: HashSet<String>,
    client: reqwest::Client,
    timeout: Duration,
    /// Lazily-built blocking client for the synchronous API server
    /// (`/public/v1/account/*` runs on std::thread handlers, not tokio —
    /// building `reqwest::blocking` inside a tokio worker panics, so this
    /// must never be touched from async code).
    blocking_client: std::sync::OnceLock<reqwest::blocking::Client>,
}

impl ZisVerifier {
    pub fn from_env() -> Self {
        let url = std::env::var("ZION_POOL_ZIS_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:8096".to_string());
        let service_key = std::env::var("ZION_POOL_ZIS_SERVICE_KEY").ok();
        let timeout = Duration::from_millis(
            std::env::var("ZION_POOL_ZIS_TIMEOUT_MS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(3000),
        );
        let pos_ttl = Duration::from_secs(
            std::env::var("ZION_POOL_ZIS_CACHE_TTL")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(300),
        );
        let neg_ttl = Duration::from_secs(60);
        let banned = std::env::var("ZION_POOL_BANNED_ZIS")
            .unwrap_or_default()
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        let client = reqwest::Client::builder()
            .timeout(timeout)
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        Self {
            url,
            service_key,
            pos_ttl,
            neg_ttl,
            cache: Mutex::new(HashMap::new()),
            banned,
            client,
            timeout,
            blocking_client: std::sync::OnceLock::new(),
        }
    }

    pub fn auth_mode() -> ZisAuthMode {
        match std::env::var("ZION_POOL_ZIS_AUTH")
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str()
        {
            "optional" => ZisAuthMode::Optional,
            "required" => ZisAuthMode::Required,
            _ => ZisAuthMode::Off,
        }
    }

    pub fn is_banned(&self, sub: &str) -> bool {
        self.banned.contains(sub)
    }

    fn key_hash(token: &str) -> u64 {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        token.hash(&mut h);
        h.finish()
    }

    /// Construct a verifier directly (tests — avoids env mutation races).
    #[cfg(test)]
    pub(crate) fn for_test(url: String) -> Self {
        Self {
            url,
            service_key: None,
            pos_ttl: Duration::from_secs(300),
            neg_ttl: Duration::from_secs(60),
            cache: Mutex::new(HashMap::new()),
            banned: HashSet::new(),
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(2))
                .build()
                .unwrap(),
            timeout: Duration::from_secs(2),
            blocking_client: std::sync::OnceLock::new(),
        }
    }

    /// Verify an API key against ZIS.  Returns Some(identity) for valid,
    /// unbanned keys; None for invalid keys or ZIS-unreachable (fail-closed
    /// on required mode, fail-open handled by the caller in optional mode).
    pub async fn verify(&self, token: &str) -> Option<ZisIdentity> {
        let kh = Self::key_hash(token);
        {
            let cache = self.cache.lock().unwrap();
            if let Some((cached, at)) = cache.get(&kh) {
                let ttl = if cached.is_some() {
                    self.pos_ttl
                } else {
                    self.neg_ttl
                };
                if at.elapsed() < ttl {
                    return cached.clone();
                }
            }
        }
        let mut req = self
            .client
            .post(format!(
                "{}/api/keys/verify",
                self.url.trim_end_matches('/')
            ))
            .json(&serde_json::json!({ "apiKey": token }));
        if let Some(sk) = &self.service_key {
            req = req.header("x-service-key", sk);
        }
        let parsed = match req.send().await {
            Ok(resp) => resp.json::<VerifyResponse>().await.ok(),
            Err(_) => None,
        };
        let identity = parsed
            .filter(|v| v.valid == Some(true))
            .and_then(|v| v.user)
            .and_then(Self::identity_from_user);
        {
            let mut cache = self.cache.lock().unwrap();
            // Bound the cache so a hostile key flood cannot grow it without
            // limit; ~8k entries is years of headroom for a 10k-miner pool.
            if cache.len() >= 8192 {
                cache.clear();
            }
            cache.insert(kh, (identity.clone(), Instant::now()));
        }
        identity
    }

    /// Blocking variant of [`verify`] for the synchronous API server —
    /// same endpoint, same shared cache. Must only run on std::thread
    /// handlers (reqwest::blocking panics inside a tokio worker).
    pub fn verify_blocking(&self, token: &str) -> Option<ZisIdentity> {
        let kh = Self::key_hash(token);
        {
            let cache = self.cache.lock().unwrap();
            if let Some((cached, at)) = cache.get(&kh) {
                let ttl = if cached.is_some() {
                    self.pos_ttl
                } else {
                    self.neg_ttl
                };
                if at.elapsed() < ttl {
                    return cached.clone();
                }
            }
        }
        let client = self.blocking_client.get_or_init(|| {
            reqwest::blocking::Client::builder()
                .timeout(self.timeout)
                .build()
                .unwrap_or_else(|_| reqwest::blocking::Client::new())
        });
        let mut req = client
            .post(format!(
                "{}/api/keys/verify",
                self.url.trim_end_matches('/')
            ))
            .json(&serde_json::json!({ "apiKey": token }));
        if let Some(sk) = &self.service_key {
            req = req.header("x-service-key", sk);
        }
        let parsed = match req.send() {
            Ok(resp) => resp.json::<VerifyResponse>().ok(),
            Err(_) => None,
        };
        let identity = parsed
            .filter(|v| v.valid == Some(true))
            .and_then(|v| v.user)
            .and_then(Self::identity_from_user);
        {
            let mut cache = self.cache.lock().unwrap();
            if cache.len() >= 8192 {
                cache.clear();
            }
            cache.insert(kh, (identity.clone(), Instant::now()));
        }
        identity
    }

    /// Map a verified `user` payload to an identity — first-per-chain
    /// payout fallbacks plus the *proven* linked-address list used for
    /// ownership checks on account endpoints.  Unproven links (ZIS marks
    /// quantus/pearl attestation links `proven:false`) never populate
    /// payout fallbacks and never satisfy `owns()` — a squatted external
    /// address must not grant payout attribution or account writes.
    fn identity_from_user(u: VerifyUser) -> Option<ZisIdentity> {
        u.id.map(|sub| ZisIdentity {
            sub,
            zion_address: u
                .linked_addresses
                .iter()
                .find(|a| a.chain_type == "zion-l1" && a.is_proven())
                .map(|a| a.address.clone()),
            quantus_address: u
                .linked_addresses
                .iter()
                .find(|a| a.chain_type == "quantus" && a.is_proven())
                .map(|a| a.address.clone()),
            pearl_address: u
                .linked_addresses
                .iter()
                .find(|a| a.chain_type == "pearl" && a.is_proven())
                .map(|a| a.address.clone()),
            addresses: u
                .linked_addresses
                .iter()
                .filter(|a| a.is_proven())
                .map(|a| a.address.clone())
                .collect(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn verifier_for(url: String) -> ZisVerifier {
        ZisVerifier::for_test(url)
    }

    /// Minimal mock ZIS: serves `responses` one per accepted connection,
    /// counting connections so cache behaviour is observable.
    async fn mock_zis(responses: Vec<String>) -> (String, tokio::task::JoinHandle<usize>) {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let url = format!("http://{addr}");
        let handle = tokio::spawn(async move {
            use tokio::io::{AsyncReadExt, AsyncWriteExt};
            let mut hits = 0usize;
            for body in responses {
                let Ok((mut sock, _)) = listener.accept().await else {
                    break;
                };
                hits += 1;
                let mut buf = vec![0u8; 8192];
                let _ = sock.read(&mut buf).await;
                let resp = format!(
                    "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = sock.write_all(resp.as_bytes()).await;
            }
            hits
        });
        (url, handle)
    }

    #[tokio::test]
    async fn verify_valid_key_binds_identity_and_caches() {
        let body = r#"{"valid":true,"user":{"id":"u42","linkedAddresses":[
            {"address":"zion1link","chainType":"zion-l1","proven":true},
            {"address":"qz99","chainType":"quantus","proven":true}]}}"#
            .to_string();
        let (url, hits) = mock_zis(vec![body]).await;
        let v = verifier_for(url);

        let id1 = v.verify("zis_aaaaaaaaaaaaaaaa").await.unwrap();
        assert_eq!(id1.sub, "u42");
        assert_eq!(id1.zion_address.as_deref(), Some("zion1link"));
        assert_eq!(id1.quantus_address.as_deref(), Some("qz99"));

        // Second verify of the same key must be served from cache — the
        // mock only accepts one connection.
        let id2 = v.verify("zis_aaaaaaaaaaaaaaaa").await.unwrap();
        assert_eq!(id2.sub, "u42");
        let _ = tokio::time::timeout(Duration::from_millis(200), hits).await;
    }

    #[tokio::test]
    async fn verify_binds_pearl_linked_address() {
        // F2e: a `chainType:"pearl"` linked address lands on
        // `ZisIdentity::pearl_address` (PRL payout fallback).
        let body = r#"{"valid":true,"user":{"id":"u9","linkedAddresses":[
            {"address":"prl1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq","chainType":"pearl","proven":true},
            {"address":"qz77","chainType":"quantus","proven":true}]}}"#
            .to_string();
        let (url, _hits) = mock_zis(vec![body]).await;
        let v = verifier_for(url);
        let idn = v.verify("zis_pearlpearlpearl0").await.unwrap();
        assert_eq!(idn.sub, "u9");
        assert_eq!(
            idn.pearl_address.as_deref(),
            Some("prl1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq")
        );
        assert_eq!(idn.quantus_address.as_deref(), Some("qz77"));
        assert!(idn.zion_address.is_none());
    }

    #[tokio::test]
    async fn verify_invalid_key_returns_none() {
        let (url, _hits) = mock_zis(vec![
            r#"{"error":"UNAUTHORIZED","message":"Invalid API key"}"#.to_string(),
        ])
        .await;
        let v = verifier_for(url);
        assert!(v.verify("zis_bbbbbbbbbbbbbbbb").await.is_none());
    }

    #[tokio::test]
    async fn verify_unreachable_zis_returns_none() {
        // Nothing listening on this port.
        let v = verifier_for("http://127.0.0.1:1".to_string());
        assert!(v.verify("zis_cccccccccccccccc").await.is_none());
    }

    #[test]
    fn banned_sub_detected() {
        let mut v = verifier_for("http://127.0.0.1:1".to_string());
        v.banned.insert("u-evil".to_string());
        assert!(v.is_banned("u-evil"));
        assert!(!v.is_banned("u42"));
    }

    #[test]
    fn auth_mode_parses() {
        // Default (unset) is Off; exact match on lowercase env values.
        std::env::remove_var("ZION_POOL_ZIS_AUTH");
        assert_eq!(ZisVerifier::auth_mode(), ZisAuthMode::Off);
        std::env::set_var("ZION_POOL_ZIS_AUTH", "required");
        assert_eq!(ZisVerifier::auth_mode(), ZisAuthMode::Required);
        std::env::set_var("ZION_POOL_ZIS_AUTH", "optional");
        assert_eq!(ZisVerifier::auth_mode(), ZisAuthMode::Optional);
        std::env::set_var("ZION_POOL_ZIS_AUTH", "bogus");
        assert_eq!(ZisVerifier::auth_mode(), ZisAuthMode::Off);
        std::env::remove_var("ZION_POOL_ZIS_AUTH");
    }

    #[test]
    fn verify_response_parses_linked_addresses() {
        let body = r#"{"valid":true,"user":{"id":"u123","linkedAddresses":[
            {"address":"zion1abc","chainType":"zion-l1","chainId":null},
            {"address":"qzxxxx","chainType":"quantus","chainId":null},
            {"address":"0xdead","chainType":"evm","chainId":"base"}]}}"#;
        let v: VerifyResponse = serde_json::from_str(body).unwrap();
        assert_eq!(v.valid, Some(true));
        let u = v.user.unwrap();
        assert_eq!(u.id.as_deref(), Some("u123"));
        assert_eq!(u.linked_addresses.len(), 3);
        assert!(u
            .linked_addresses
            .iter()
            .any(|a| a.chain_type == "zion-l1" && a.address == "zion1abc"));
        assert!(u
            .linked_addresses
            .iter()
            .any(|a| a.chain_type == "quantus" && a.address == "qzxxxx"));
    }

    /// Sync mock for the blocking verify path — the account endpoints run
    /// on std::thread handlers, not tokio, so the async mock above cannot
    /// serve them.
    fn mock_zis_blocking(responder: impl Fn(&str) -> String + Send + 'static) -> String {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        std::thread::spawn(move || {
            use std::io::{Read, Write};
            while let Ok((mut sock, _)) = listener.accept() {
                let mut buf = vec![0u8; 8192];
                let n = sock.read(&mut buf).unwrap_or(0);
                let req = String::from_utf8_lossy(&buf[..n]).into_owned();
                let body = responder(&req);
                let resp = format!(
                    "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = sock.write_all(resp.as_bytes());
            }
        });
        format!("http://{addr}")
    }

    /// A2.2/A2.3: `verify_blocking` hits `{url}/api/keys/verify`, parses the
    /// linked-address list into `addresses` for ownership checks, and
    /// shares the cache with the async path.
    ///
    /// 3.B3 regression: quantus/pearl links without `proven:true` are
    /// attestation-only — they must NOT populate payout fallbacks and must
    /// NOT satisfy `owns()`.  A squatter who links a victim's qz/prl
    /// address gains no payout attribution or account-settings access.
    #[test]
    fn verify_blocking_binds_identity_and_owns() {
        let url = mock_zis_blocking(|req| {
            if req.contains("zis_good_token") {
                r#"{"valid":true,"user":{"id":"u7","linkedAddresses":[
                    {"address":"zion1w","chainType":"zion-l1"},
                    {"address":"q1w","chainType":"quantus"},
                    {"address":"p1w","chainType":"pearl","proven":false}]}}"#
            } else {
                r#"{"valid":false}"#
            }
            .to_string()
        });
        let v = verifier_for(url);
        let idn = v.verify_blocking("zis_good_token").unwrap();
        assert_eq!(idn.sub, "u7");
        assert_eq!(idn.zion_address.as_deref(), Some("zion1w"));
        // Unproven attestation links never become payout fallbacks —
        // `quantus` missing the flag (old-ZIS shape) and `pearl` flagged
        // false are gated the same way.
        assert_eq!(idn.quantus_address, None);
        assert_eq!(idn.pearl_address, None);
        assert_eq!(idn.addresses, vec!["zion1w".to_string()]);
        assert!(idn.owns("zion1w"));
        assert!(!idn.owns("q1w"));
        assert!(!idn.owns("p1w"));
        assert!(!idn.owns("zion1other"));
        assert!(!idn.owns(""));
        // Invalid → None (fail-closed for account writes).
        assert!(v.verify_blocking("zis_bad_token").is_none());
    }

    /// `proven:true` restores a quantus/pearl link for payout fallback and
    /// ownership — the shape a future external-chain proof flow emits.
    #[test]
    fn verify_blocking_proven_attestation_links_apply() {
        let url = mock_zis_blocking(|req| {
            if req.contains("zis_good_token") {
                r#"{"valid":true,"user":{"id":"u8","linkedAddresses":[
                    {"address":"q2w","chainType":"quantus","proven":true},
                    {"address":"p2w","chainType":"pearl","proven":true}]}}"#
            } else {
                r#"{"valid":false}"#
            }
            .to_string()
        });
        let v = verifier_for(url);
        let idn = v.verify_blocking("zis_good_token").unwrap();
        assert_eq!(idn.quantus_address.as_deref(), Some("q2w"));
        assert_eq!(idn.pearl_address.as_deref(), Some("p2w"));
        assert!(idn.owns("q2w"));
        assert!(idn.owns("p2w"));
    }
}
