use crate::AgentState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{info, warn};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReleaseInfo {
    pub version: String,
    pub download_url: String,
    pub signature: String, // base64 ed25519 sig
    pub changelog: String,
}

pub async fn check_loop(state: Arc<AgentState>) {
    info!("OTA updater spusten");
    loop {
        let interval = 3600; // Kazdou hodinu kontrola

        let cfg = state.config.read().await;
        if cfg.auto_update != "disabled" {
            match check_for_updates(&cfg.auto_update).await {
                Ok(Some(release)) => {
                    info!("OTA: Dostupna nova verze: {}", release.version);
                    // TODO: Stahnout, overit signaturu, nainstalovat, rollback pri selhani
                }
                Ok(None) => {
                    info!("OTA: Zadna nova verze");
                }
                Err(e) => {
                    warn!("OTA check selhal: {}", e);
                }
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(interval)).await;
    }
}

async fn check_for_updates(_channel: &str) -> anyhow::Result<Option<ReleaseInfo>> {
    // TODO: GitHub releases API nebo vlastni update server
    let url = format!(
        "https://api.github.com/repos/Yose144/Zion-v3.0.0/releases/latest"
    );
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "zion-agent/1.0.0")
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await?;

    if !resp.status().is_success() {
        return Ok(None);
    }

    let _json: serde_json::Value = resp.json().await?;
    // Parse release info...

    Ok(None) // Stub
}
