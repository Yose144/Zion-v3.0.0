//! Minimal ZIS (ZION Identity Service) client for the DAO API.
//!
//! Resolves a `zion_session` cookie into a [`ZisUser`] by calling the ZIS
//! `/api/auth/me` endpoint. Used to authenticate governance actions (votes,
//! proposal creation) for regular users without exposing the operator API key.

use std::time::Duration;

use serde::Deserialize;

/// A wallet address linked to a ZIS account.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZisLinkedAddress {
    pub address: String,
    pub chain_type: String,
    pub chain_id: Option<String>,
}

/// Resolved ZIS identity.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZisUser {
    pub id: String,
    pub primary_address: String,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub role: String,
    #[serde(default)]
    pub linked_addresses: Vec<ZisLinkedAddress>,
}

impl ZisUser {
    /// The user's ZION L1 address: first linked `zion-l1` address, else the
    /// primary address.
    pub fn zion_address(&self) -> &str {
        self.linked_addresses
            .iter()
            .find(|a| a.chain_type.eq_ignore_ascii_case("zion-l1"))
            .map(|a| a.address.as_str())
            .unwrap_or(&self.primary_address)
    }
}

#[derive(Clone)]
pub struct ZisClient {
    pub enabled: bool,
    pub zis_url: String,
    http: reqwest::Client,
    timeout: Duration,
}

impl ZisClient {
    pub fn new(enabled: bool, zis_url: impl Into<String>) -> Self {
        Self {
            enabled,
            zis_url: zis_url.into(),
            http: reqwest::Client::new(),
            timeout: Duration::from_secs(5),
        }
    }

    /// Resolve a `zion_session` cookie value into a user, or `None` when the
    /// session is missing/invalid or ZIS is unreachable.
    pub async fn resolve_session(&self, cookie_value: &str) -> Option<ZisUser> {
        if !self.enabled {
            return None;
        }
        let url = format!("{}/api/auth/me", self.zis_url.trim_end_matches('/'));
        let res = self
            .http
            .get(&url)
            .header("Cookie", format!("zion_session={cookie_value}"))
            .timeout(self.timeout)
            .send()
            .await
            .ok()?;
        if !res.status().is_success() {
            return None;
        }
        res.json::<ZisUser>().await.ok()
    }
}

/// Extract the `zion_session` cookie value from a Cookie header string.
pub fn session_cookie(cookie_header: &str) -> Option<&str> {
    cookie_header
        .split(';')
        .map(str::trim)
        .find_map(|c| c.strip_prefix("zion_session="))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_cookie_parse() {
        assert_eq!(session_cookie("zion_session=abc123"), Some("abc123"));
        assert_eq!(
            session_cookie("foo=1; zion_session=xyz ; bar=2"),
            Some("xyz")
        );
        assert_eq!(session_cookie("foo=1; bar=2"), None);
    }
}
