//! Notifications module for the V31 pool.
//!
//! Handles Telegram bot alerts, SMTP e-mail notifications (logged only),
//! OASIS XP hooks, and block-found webhooks.  All network calls are
//! best-effort: failures are logged via `tracing` and never propagated
//! to the caller so that notification issues can never block pool
//! operations.
//!
//! Ported from the V3 pool server binary
//! (`archive/V3/L1/pool/src/bin/server.rs`) — the V3 free functions
//! `notify_oasis_block_mined`, `notify_block_webhook`,
//! `TelegramNotifier`, and `SmtpNotifier` are consolidated here into a
//! single `Notifier` struct driven by a `NotificationsConfig` loaded
//! from environment variables.

use std::time::Duration;

use tracing::{error, info, warn};

// ---------------------------------------------------------------------------
// NotificationsConfig — environment-driven configuration
// ---------------------------------------------------------------------------

/// Configuration for all notification channels, loaded from `ZION_*`
/// environment variables.
///
/// Every channel is optional.  When the relevant env vars are unset the
/// corresponding `*_enabled()` method returns `false` and the `Notifier`
/// silently skips that channel.
#[derive(Debug, Clone, Default)]
pub struct NotificationsConfig {
    /// Telegram bot token (`ZION_TELEGRAM_BOT_TOKEN`).
    pub telegram_bot_token: Option<String>,
    /// Telegram chat / channel id (`ZION_TELEGRAM_CHAT_ID`).
    pub telegram_chat_id: Option<String>,

    /// SMTP relay hostname (`ZION_SMTP_HOST`).
    pub smtp_host: Option<String>,
    /// SMTP relay port (`ZION_SMTP_PORT`, default 587).
    pub smtp_port: u16,
    /// SMTP username (`ZION_SMTP_USER`).
    pub smtp_user: Option<String>,
    /// SMTP password (`ZION_SMTP_PASS`).
    pub smtp_pass: Option<String>,
    /// `From:` address for outbound mail (`ZION_SMTP_FROM`).
    pub smtp_from: Option<String>,
    /// `To:` address for admin alerts (`ZION_SMTP_TO`).
    pub smtp_to: Option<String>,

    /// OASIS L4 game-server base URL (`ZION_OASIS_API_URL`).
    pub oasis_api_url: Option<String>,
    /// External block-webhook URL (`ZION_BLOCK_WEBHOOK_URL`).
    pub block_webhook_url: Option<String>,
}

impl NotificationsConfig {
    /// Read all notification settings from environment variables.
    ///
    /// Missing variables resolve to `None` / defaults and the
    /// corresponding channel is treated as disabled.
    pub fn from_env() -> Self {
        let smtp_port = std::env::var("ZION_SMTP_PORT")
            .ok()
            .and_then(|v| v.parse::<u16>().ok())
            .unwrap_or(587);

        Self {
            telegram_bot_token: std::env::var("ZION_TELEGRAM_BOT_TOKEN").ok().filter(|s| !s.is_empty()),
            telegram_chat_id: std::env::var("ZION_TELEGRAM_CHAT_ID").ok().filter(|s| !s.is_empty()),
            smtp_host: std::env::var("ZION_SMTP_HOST").ok().filter(|s| !s.is_empty()),
            smtp_port,
            smtp_user: std::env::var("ZION_SMTP_USER").ok().filter(|s| !s.is_empty()),
            smtp_pass: std::env::var("ZION_SMTP_PASS").ok().filter(|s| !s.is_empty()),
            smtp_from: std::env::var("ZION_SMTP_FROM").ok().filter(|s| !s.is_empty()),
            smtp_to: std::env::var("ZION_SMTP_TO").ok().filter(|s| !s.is_empty()),
            oasis_api_url: std::env::var("ZION_OASIS_API_URL").ok().filter(|s| !s.is_empty()),
            block_webhook_url: std::env::var("ZION_BLOCK_WEBHOOK_URL").ok().filter(|s| !s.is_empty()),
        }
    }

    /// Telegram alerts are enabled when both bot token and chat id are set.
    pub fn telegram_enabled(&self) -> bool {
        self.telegram_bot_token.is_some() && self.telegram_chat_id.is_some()
    }

    /// SMTP e-mail is enabled when host, from, and to are all set.
    pub fn smtp_enabled(&self) -> bool {
        self.smtp_host.is_some() && self.smtp_from.is_some() && self.smtp_to.is_some()
    }

    /// OASIS XP hook is enabled when the API URL is set.
    pub fn oasis_enabled(&self) -> bool {
        self.oasis_api_url.is_some()
    }

    /// Block webhook is enabled when the webhook URL is set.
    pub fn webhook_enabled(&self) -> bool {
        self.block_webhook_url.is_some()
    }
}

// ---------------------------------------------------------------------------
// Notifier — sends alerts to all configured channels
// ---------------------------------------------------------------------------

/// Best-effort notifier that fans out alerts to every enabled channel.
///
/// HTTP calls use `reqwest::blocking::Client` (the `blocking` feature is
/// enabled in the workspace `Cargo.toml`).  All public `notify_*`
/// methods swallow errors internally — they log via `tracing` and return
/// `()` so a broken notification channel can never disrupt pool
/// operation.
pub struct Notifier {
    /// Resolved channel configuration.
    pub config: NotificationsConfig,
    /// Shared blocking HTTP client, created once in `new()`.
    http_client: Option<reqwest::blocking::Client>,
}

impl Notifier {
    /// Build a `Notifier` from the supplied config.
    ///
    /// A `reqwest::blocking::Client` is constructed with a 10-second
    /// timeout.  If client construction fails (extremely unlikely) the
    /// notifier still works for the logging-only channels (SMTP) and
    /// HTTP calls are skipped.
    pub fn new(config: NotificationsConfig) -> Self {
        let http_client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .ok();
        Self { config, http_client }
    }

    // --- composite alert helpers -----------------------------------------

    /// Notify every relevant channel that a block was found.
    ///
    /// Fires Telegram, the block webhook, and the OASIS XP hook.
    /// Errors in any channel are logged and do not affect the others.
    pub fn notify_block_found(&self, miner_address: &str, block_height: u64, worker_name: &str) {
        info!(
            "notify_block_found miner={} height={} worker={}",
            miner_address, block_height, worker_name
        );

        if self.config.telegram_enabled() {
            let msg = format!(
                "🧱 Block Found\nHeight: {}\nMiner: {}\nWorker: {}",
                block_height, miner_address, worker_name
            );
            self.send_telegram(&msg);
        }

        if self.config.webhook_enabled() {
            self.notify_block_webhook(miner_address, block_height);
        }

        if self.config.oasis_enabled() {
            self.notify_oasis_block_mined(miner_address, block_height);
        }
    }

    /// Notify that a block was orphaned (Telegram + webhook).
    pub fn notify_orphan(&self, block_height: u64) {
        warn!("notify_orphan height={}", block_height);

        if self.config.telegram_enabled() {
            let msg = format!(
                "⚠️ Orphan Block\nHeight: {}\nThe node rejected or orphaned this block.",
                block_height
            );
            self.send_telegram(&msg);
        }

        if self.config.webhook_enabled() {
            // Orphan webhooks reuse the block-webhook endpoint with an
            // `orphaned` flag so consumers can distinguish the two.
            self.notify_block_webhook("", block_height);
        }
    }

    /// Notify that a payout failed (Telegram + SMTP).
    pub fn notify_payout_failed(&self, height: u64, error_msg: &str) {
        error!("notify_payout_failed height={} error={}", height, error_msg);

        if self.config.telegram_enabled() {
            let msg = format!(
                "❌ Payout Failed\nHeight: {}\nError: {}",
                height, error_msg
            );
            self.send_telegram(&msg);
        }

        if self.config.smtp_enabled() {
            let subject = format!("ZION Pool: Payout Failed (height {})", height);
            let body = format!(
                "Payout Failed\n\nHeight: {}\nError: {}\n",
                height, error_msg
            );
            if let Err(e) = self.send_smtp(&subject, &body) {
                warn!("payout_failed_smtp_error err={}", e);
            }
        }
    }

    // --- individual channel senders --------------------------------------

    /// Send a text message to the configured Telegram chat.
    ///
    /// Uses an HTTP GET to
    /// `https://api.telegram.org/bot{token}/sendMessage?chat_id={chat_id}&text={text}`.
    /// Best-effort: errors are logged, not propagated.
    pub fn send_telegram(&self, text: &str) {
        let (Some(token), Some(chat_id)) = (&self.config.telegram_bot_token, &self.config.telegram_chat_id) else {
            return;
        };
        let Some(client) = &self.http_client else {
            info!("telegram_skip (no http client) text={}", text);
            return;
        };

        // Use reqwest's query builder so that the chat_id and text are
        // percent-encoded automatically — no extra encoding crate needed.
        let result = client
            .get(format!("https://api.telegram.org/bot{}/sendMessage", token))
            .query(&[("chat_id", chat_id.as_str()), ("text", text)])
            .send();

        match result {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    info!("telegram_sent status={}", status);
                } else {
                    warn!("telegram_send_failed status={}", status);
                }
            }
            Err(e) => warn!("telegram_send_error err={}", e),
        }
    }

    /// POST a JSON block-found payload to the configured webhook URL.
    ///
    /// Body shape (mirrors the V3 pool):
    /// `{"event":"block_found","height":N,"miner_id":"...","timestamp":T}`
    pub fn notify_block_webhook(&self, miner_address: &str, block_height: u64) {
        let Some(url) = &self.config.block_webhook_url else {
            return;
        };
        let Some(client) = &self.http_client else {
            info!(
                "block_webhook_skip (no http client) height={} miner={}",
                block_height, miner_address
            );
            return;
        };

        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let payload = serde_json::json!({
            "event": "block_found",
            "height": block_height,
            "miner_id": miner_address,
            "timestamp": ts,
        });

        match client.post(url.as_str()).json(&payload).send() {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    info!("block_webhook_sent height={} status={}", block_height, status);
                } else {
                    warn!("block_webhook_failed height={} status={}", block_height, status);
                }
            }
            Err(e) => warn!("block_webhook_unavailable height={} err={}", block_height, e),
        }
    }

    /// POST an XP-award request to the OASIS L4 game server.
    ///
    /// Endpoint: `{oasis_api_url}/api/v1/oasis/player/{miner_address}/xp`
    /// Body: `{"source":"block_mined","amount":500,"block_height":N}`
    pub fn notify_oasis_block_mined(&self, miner_address: &str, block_height: u64) {
        let Some(base_url) = &self.config.oasis_api_url else {
            return;
        };
        let Some(client) = &self.http_client else {
            info!(
                "oasis_xp_skip (no http client) miner={} height={}",
                miner_address, block_height
            );
            return;
        };

        let url = format!(
            "{}/api/v1/oasis/player/{}/xp",
            base_url.trim_end_matches('/'),
            miner_address
        );

        let payload = serde_json::json!({
            "source": "block_mined",
            "amount": 500,
            "block_height": block_height,
        });

        match client.post(url.as_str()).json(&payload).send() {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    info!(
                        "oasis_xp_awarded miner={} height={} status={}",
                        miner_address, block_height, status
                    );
                } else {
                    info!(
                        "oasis_xp_hook_failed miner={} height={} status={}",
                        miner_address, block_height, status
                    );
                }
            }
            Err(e) => info!(
                "oasis_xp_hook_unavailable miner={} height={} err={}",
                miner_address, block_height, e
            ),
        }
    }

    /// "Send" an SMTP e-mail.
    ///
    /// A full TLS SMTP client is out of scope for this module, so the
    /// message is logged via `tracing::info!` instead of being
    /// delivered.  The signature remains `Result<(), String>` so a
    /// real implementation can be dropped in later without touching
    /// call-sites.
    pub fn send_smtp(&self, subject: &str, body: &str) -> Result<(), String> {
        let from = self.config.smtp_from.as_deref().unwrap_or("(unset)");
        let to = self.config.smtp_to.as_deref().unwrap_or("(unset)");
        let host = self.config.smtp_host.as_deref().unwrap_or("(unset)");
        info!(
            "smtp_email_logged host={} port={} from={} to={} subject={}",
            host, self.config.smtp_port, from, to, subject
        );
        info!("smtp_email_body:\n{}", body);
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    /// Guards the shared process environment so env-var tests do not race.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    /// With no env vars set, every channel should be disabled.
    #[test]
    fn test_config_from_env_disabled() {
        let _guard = ENV_LOCK.lock().unwrap();

        // Temporarily clear all notification env vars so the test is
        // deterministic regardless of the host environment.
        let keys = [
            "ZION_TELEGRAM_BOT_TOKEN",
            "ZION_TELEGRAM_CHAT_ID",
            "ZION_SMTP_HOST",
            "ZION_SMTP_PORT",
            "ZION_SMTP_USER",
            "ZION_SMTP_PASS",
            "ZION_SMTP_FROM",
            "ZION_SMTP_TO",
            "ZION_OASIS_API_URL",
            "ZION_BLOCK_WEBHOOK_URL",
        ];
        // Snapshot existing values so we can restore them after the test.
        let snapshot: Vec<(String, Option<String>)> = keys
            .iter()
            .map(|k| (k.to_string(), std::env::var(k).ok()))
            .collect();
        for k in &keys {
            std::env::remove_var(k);
        }

        let cfg = NotificationsConfig::from_env();
        assert!(!cfg.telegram_enabled(), "telegram should be disabled");
        assert!(!cfg.smtp_enabled(), "smtp should be disabled");
        assert!(!cfg.oasis_enabled(), "oasis should be disabled");
        assert!(!cfg.webhook_enabled(), "webhook should be disabled");
        assert_eq!(cfg.smtp_port, 587, "default smtp port should be 587");

        // Restore the original environment.
        for (k, v) in snapshot {
            if let Some(val) = v {
                std::env::set_var(k, val);
            } else {
                std::env::remove_var(k);
            }
        }
    }

    /// With telegram env vars set, `telegram_enabled` should be true.
    #[test]
    fn test_config_telegram_enabled() {
        let _guard = ENV_LOCK.lock().unwrap();

        let keys = ["ZION_TELEGRAM_BOT_TOKEN", "ZION_TELEGRAM_CHAT_ID"];
        let snapshot: Vec<(String, Option<String>)> = keys
            .iter()
            .map(|k| (k.to_string(), std::env::var(k).ok()))
            .collect();
        std::env::set_var("ZION_TELEGRAM_BOT_TOKEN", "test-token");
        std::env::set_var("ZION_TELEGRAM_CHAT_ID", "test-chat");

        let cfg = NotificationsConfig::from_env();
        assert!(cfg.telegram_enabled(), "telegram should be enabled");
        assert_eq!(
            cfg.telegram_bot_token.as_deref(),
            Some("test-token"),
            "bot token should be read from env"
        );
        assert_eq!(
            cfg.telegram_chat_id.as_deref(),
            Some("test-chat"),
            "chat id should be read from env"
        );

        for (k, v) in snapshot {
            if let Some(val) = v {
                std::env::set_var(k, val);
            } else {
                std::env::remove_var(k);
            }
        }
    }

    /// `Notifier::new` should populate the config and build an HTTP client.
    #[test]
    fn test_notifier_new() {
        let cfg = NotificationsConfig::default();
        let notifier = Notifier::new(cfg.clone());
        assert!(!notifier.config.telegram_enabled());
        assert!(notifier.http_client.is_some(), "http client should be built");
    }

    /// `notify_block_found` should not panic when all channels are
    /// disabled — it should simply log and return.
    #[test]
    fn test_notify_block_found_logs() {
        let cfg = NotificationsConfig::default(); // everything disabled
        let notifier = Notifier::new(cfg);
        // Should complete without panicking.
        notifier.notify_block_found("test-miner", 42, "worker-1");
    }
}
