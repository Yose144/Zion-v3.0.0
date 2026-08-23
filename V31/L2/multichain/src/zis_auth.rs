//! ZIS (ZION Identity Service) auth integration for the multichain gateway.
//!
//! Resolves a caller from either:
//!   - `Cookie: zion_session=...`  (browser SSO)
//!   - `Authorization: Bearer <zis-api-key>`  (headless / CLI — optional)
//!
//! Resolved users are attached as an Axum request extension and can be
//! required by handlers via `Option<Extension<ZisUser>>` or
//! `state.require_user(&extensions)`.

use std::net::SocketAddr;
use std::time::Duration;

use axum::body::Body;
use axum::extract::{ConnectInfo, State};
use axum::http::{Request, StatusCode};
use axum::middleware::Next;
use axum::response::Response;
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

/// Resolved ZIS user. Inserted into Axum request extensions.
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
    pub fn linked_address(&self, chain_type: &str, chain_id: Option<&str>) -> Option<&ZisLinkedAddress> {
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

        if res.status() == 401 || res.status() == 403 {
            return Ok(None);
        }

        if !res.status().is_success() {
            return Ok(None);
        }

        let user = res.json::<ZisUser>().await?;
        Ok(Some(user))
    }
}

/// Middleware: resolve the caller identity from the incoming request.
///
/// - Health endpoints are always skipped.
/// - If a `zion_session` cookie is present, call ZIS `/api/auth/me` and
///   insert the `ZisUser` extension.
/// - If credentials are invalid, the request still continues but no user is
///   attached. Handlers that call `require_user` will reject it.
/// - If `zis_auth.enabled` is false, the middleware is a no-op.
pub async fn resolve_zis_auth(
    State(client): State<ZisClient>,
    ConnectInfo(_addr): ConnectInfo<SocketAddr>,
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let path = req.uri().path();

    if path == "/health" || path == "/v1/multichain/health" {
        return Ok(next.run(req).await);
    }

    if !client.enabled {
        return Ok(next.run(req).await);
    }

    // Try cookie-based SSO first.
    if let Some(cookie_header) = req.headers().get("cookie").and_then(|h| h.to_str().ok()) {
        for cookie in cookie_header.split(';') {
            let cookie = cookie.trim();
            if let Some(value) = cookie.strip_prefix("zion_session=") {
                match client.resolve_session(value).await {
                    Ok(Some(user)) => {
                        req.extensions_mut().insert(user);
                        break;
                    }
                    Ok(None) => {
                        tracing::debug!("ZIS session not valid");
                    }
                    Err(e) => {
                        tracing::warn!("ZIS resolve error: {}", e);
                    }
                }
            }
        }
    }

    Ok(next.run(req).await)
}

/// Extract the resolved `ZisUser`, if any.
pub fn optional_user(extensions: &axum::http::Extensions) -> Option<&ZisUser> {
    extensions.get::<ZisUser>()
}

/// Require a resolved `ZisUser`.
///
/// - If auth is required and no user is resolved, returns `401`.
/// - If auth is optional and no user is resolved, returns `Ok(None)`.
/// - If a user is resolved, returns `Ok(Some(user))`.
pub fn require_user(
    extensions: &axum::http::Extensions,
    auth_required: bool,
) -> Result<Option<&ZisUser>, StatusCode> {
    if let Some(user) = extensions.get::<ZisUser>() {
        return Ok(Some(user));
    }
    if auth_required {
        Err(StatusCode::UNAUTHORIZED)
    } else {
        Ok(None)
    }
}
