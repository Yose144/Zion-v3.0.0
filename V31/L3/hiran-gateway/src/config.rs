//! Gateway configuration — env-driven, no secrets in repo.
//! Spec: `docs/3.2/B2B_HIRAN_API_MVP_SPEC.md`

use anyhow::Result;

#[derive(Debug, Clone)]
pub struct GatewayConfig {
    /// Bind address (loopback — nginx terminates TLS).
    pub bind: String,
    /// ZIS service-to-service key verification endpoint.
    pub zis_verify_url: String,
    /// SQLite usage/plan database path.
    pub db_path: String,
    /// Model catalog JSON path (alias → upstream chains).
    pub models_path: String,
    /// Optional admin key enabling `/v1/admin/*` (X-Admin-Key).
    pub admin_key: Option<String>,
    /// Primary-upstream timeout; later chain entries get fallback timeout.
    pub timeout_secs: u64,
    pub fallback_timeout_secs: u64,
    /// ZIS verify result cache TTL.
    pub auth_cache_secs: u64,
    /// Upstream liveness probe cache TTL for /v1/models.
    pub probe_cache_secs: u64,
    /// Stripe billing (empty → /v1/stripe/webhook disabled).
    pub stripe_webhook_secret: Option<String>,
    pub stripe_price_pro: Option<String>,
    pub stripe_price_team: Option<String>,
}

impl GatewayConfig {
    pub fn from_env() -> Result<Self> {
        let cfg = Self {
            bind: std::env::var("HIRAN_BIND").unwrap_or_else(|_| "127.0.0.1:8007".into()),
            zis_verify_url: std::env::var("ZIS_VERIFY_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:8096/api/keys/verify".into()),
            db_path: std::env::var("HIRAN_DB").unwrap_or_else(|_| "./hiran-gateway.db".into()),
            models_path: std::env::var("HIRAN_MODELS")
                .unwrap_or_else(|_| "/etc/zion/hiran-models.json".into()),
            admin_key: std::env::var("HIRAN_ADMIN_KEY")
                .ok()
                .filter(|k| !k.is_empty()),
            timeout_secs: env_u64("HIRAN_TIMEOUT_SECS", 90),
            fallback_timeout_secs: env_u64("HIRAN_FALLBACK_TIMEOUT_SECS", 180),
            auth_cache_secs: env_u64("HIRAN_AUTH_CACHE_SECS", 60),
            probe_cache_secs: env_u64("HIRAN_PROBE_CACHE_SECS", 30),
            stripe_webhook_secret: std::env::var("STRIPE_WEBHOOK_SECRET")
                .ok()
                .filter(|v| !v.is_empty()),
            stripe_price_pro: std::env::var("STRIPE_PRICE_PRO")
                .ok()
                .filter(|v| !v.is_empty()),
            stripe_price_team: std::env::var("STRIPE_PRICE_TEAM")
                .ok()
                .filter(|v| !v.is_empty()),
        };
        Ok(cfg)
    }
}

fn env_u64(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}
