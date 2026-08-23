//! ZIS (ZION Identity Service) auth helpers for the OASIS L4 server.
//!
//! Mirrors the multichain `zis_auth` module so OASIS can resolve the same
//! `zion_session` cookie and `zis_...` API keys without depending on the
//! L2 crate.

use std::time::Duration;

use serde::{Deserialize, Serialize};
use tracing;

/// A linked wallet address stored in ZIS.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ZisLinkedAddress {
    pub id: String,
    pub user_id: String,
    pub address: String,
    pub chain_type: String,
    pub chain_id: Option<String>,
    pub verified_at: String,
}

/// OASIS player profile linked to a ZIS user.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ZisOasisPlayer {
    pub id: String,
    pub user_id: String,
    pub address: String,
    pub total_xp: i64,
    pub level: String,
    pub guild_id: Option<String>,
    pub blocks_mined: i64,
    pub zion_earned: String,
    pub tithe_total: String,
    pub challenges_done: i64,
    pub daily_streak: i64,
    pub best_streak: i64,
    pub last_active: Option<String>,
    pub created_at: String,
}

/// Resolved ZIS user.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ZisUser {
    pub id: String,
    pub primary_address: String,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub avatar: Option<String>,
    pub bio: Option<String>,
    pub role: String,
    pub created_at: String,
    pub last_login: Option<String>,
    pub login_count: i64,
    pub linked_addresses: Vec<ZisLinkedAddress>,
    pub oasis_player: Option<ZisOasisPlayer>,
}

impl ZisUser {
    /// Return the first linked address for a given chain type and optional chain id.
    pub fn linked_address(
        &self,
        chain_type: &str,
        chain_id: Option<&str>,
    ) -> Option<&ZisLinkedAddress> {
        self.linked_addresses.iter().find(|a| {
            a.chain_type.eq_ignore_ascii_case(chain_type)
                && chain_id.map_or(true, |c| a.chain_id.as_deref() == Some(c))
        })
    }
}

/// Lightweight client that calls the ZION Identity Service.
#[derive(Clone, Debug)]
pub struct ZisClient {
    pub enabled: bool,
    pub zis_url: String,
    pub http: reqwest::Client,
    pub timeout: Duration,
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

    /// Resolve a ZIS user from a raw API key.
    pub async fn resolve_api_key(&self, api_key: &str) -> Result<Option<ZisUser>, reqwest::Error> {
        if !self.enabled {
            return Ok(None);
        }

        let url = format!("{}/api/keys/verify", self.zis_url.trim_end_matches('/'));
        let res = self
            .http
            .post(&url)
            .json(&serde_json::json!({ "apiKey": api_key }))
            .timeout(self.timeout)
            .send()
            .await?;

        if res.status() == 401 || res.status() == 403 || !res.status().is_success() {
            return Ok(None);
        }

        #[derive(Deserialize)]
        struct VerifyResponse {
            user: ZisUser,
        }

        let body = res.json::<VerifyResponse>().await?;
        Ok(Some(body.user))
    }

    /// Resolve a ZIS user from a `zion_session` cookie value.
    pub async fn resolve_session(&self, cookie_value: &str) -> Result<Option<ZisUser>, reqwest::Error> {
        if !self.enabled {
            return Ok(None);
        }

        let url = format!("{}/api/auth/me", self.zis_url.trim_end_matches('/'));
        let cookie = format!("zion_session={}", cookie_value);

        let res = self
            .http
            .get(&url)
            .header("Cookie", cookie)
            .timeout(self.timeout)
            .send()
            .await?;

        if res.status() == 401 || res.status() == 403 || !res.status().is_success() {
            return Ok(None);
        }

        let user = res.json::<ZisUser>().await?;
        Ok(Some(user))
    }
}

/// Resolve a `ZisUser` from the request headers without being an Axum middleware.
/// Used by `auth::require_auth` to combine ZIS and wallet-signature auth.
pub async fn resolve_user_from_headers(
    client: &ZisClient,
    headers: &axum::http::HeaderMap,
) -> Option<ZisUser> {
    if !client.enabled {
        return None;
    }

    // Cookie-based SSO.
    if let Some(cookie_header) = headers.get("cookie").and_then(|h| h.to_str().ok()) {
        for cookie in cookie_header.split(';') {
            let cookie = cookie.trim();
            if let Some(value) = cookie.strip_prefix("zion_session=") {
                match client.resolve_session(value).await {
                    Ok(Some(user)) => return Some(user),
                    Ok(None) => tracing::debug!("ZIS session not valid"),
                    Err(e) => tracing::warn!("ZIS resolve error: {}", e),
                }
            }
        }
    }

    // API key via Authorization header.
    if let Some(auth_header) = headers.get("authorization").and_then(|h| h.to_str().ok()) {
        let token = auth_header
            .strip_prefix("Bearer ")
            .or_else(|| auth_header.strip_prefix("bearer "))
            .unwrap_or(auth_header)
            .trim();
        if token.starts_with("zis_") {
            match client.resolve_api_key(token).await {
                Ok(Some(user)) => return Some(user),
                Ok(None) => tracing::debug!("ZIS API key not valid"),
                Err(e) => tracing::warn!("ZIS API key resolve error: {}", e),
            }
        }
    }

    None
}
